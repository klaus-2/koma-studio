use std::{
    borrow::Cow,
    collections::HashSet,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};
use thiserror::Error;

use crate::commands::{
    api::client::{http_client, stable_hash},
    desktop::{
        build_runtime_config, check_local_backend_health, resolve_desktop_env_value,
        update_channel_from_version,
    },
};

const DISCORD_WEBHOOK_ENV: &str = "BUG_REPORT_DISCORD_WEBHOOK_URL";
const IMGUR_CLIENT_ID_ENV: &str = "IMGUR_CLIENT_ID";
const IMGUR_API_URL: &str = "https://api.imgur.com/3/image";
const CONFIG_MISSING_MESSAGE: &str =
    "BUG_REPORT_DISCORD_WEBHOOK_URL e IMGUR_CLIENT_ID devem estar configurados.";
const DISCORD_WEBHOOK_PREFIXES: &[&str] = &[
    "https://discord.com/api/webhooks/",
    "https://discordapp.com/api/webhooks/",
];
const ALLOWED_LOG_EXTENSIONS: &[&str] = &["log", "txt", "json", "ndjson", "jsonl"];

const MAX_AUTO_LOG_FILES: usize = 12;
const MAX_AUTO_LOG_FILE_BYTES: u64 = 1_500_000;
const MAX_MANUAL_ATTACHMENTS: usize = 5;
const MAX_MANUAL_FILE_BYTES: usize = 8 * 1024 * 1024;
/// Discord caps webhook request bodies by guild tier (8 MiB on default
/// servers). The attachment budget stays under the floor so the report never
/// dies with a 413 *after* the screenshot was already uploaded to Imgur; the
/// pretty-printed diagnostics.json (~1-3 KiB) rides on top of it.
const MAX_DISCORD_REQUEST_BYTES: usize = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES: usize =
    MAX_DISCORD_REQUEST_BYTES - 256 * 1024;
const MAX_SCREENSHOT_BYTES: usize = 10 * 1024 * 1024;
/// Discord rejects multipart webhooks with more than ten `files[n]` parts.
const MAX_DISCORD_FILES: usize = 10;
const MAX_TITLE_CHARS: usize = 200;
const MAX_DESCRIPTION_CHARS: usize = 4000;
const MAX_FIELD_CHARS: usize = 1024;
const MAX_FILE_NAME_CHARS: usize = 120;
const MAX_UPSTREAM_ERROR_CHARS: usize = 512;
const MAX_WEBHOOK_BODY_BYTES: usize = 256 * 1024;
/// Smallest edge we accept when downscaling an oversized screenshot.
const MIN_SCREENSHOT_EDGE: u32 = 320;
const BACKEND_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const DEFAULT_ATTACHMENT_NAME: &str = "attachment.bin";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/// `Rejected` becomes a soft `{ ok: false, status, error }` answer (frontend
/// contract). `Internal` is a hard IPC rejection: nothing the user can fix.
#[derive(Debug, Error)]
enum BugReportError {
    #[error("{message}")]
    Rejected {
        status: u16,
        message: Cow<'static, str>,
    },
    #[error("{0}")]
    Internal(String),
}

impl BugReportError {
    fn rejected(status: u16, message: impl Into<Cow<'static, str>>) -> Self {
        Self::Rejected {
            status,
            message: message.into(),
        }
    }

    fn internal(error: impl std::fmt::Display) -> Self {
        Self::Internal(error.to_string())
    }
}

// ---------------------------------------------------------------------------
// IPC contracts
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Severity {
    Low,
    High,
    Critical,
    // `serde(other)` must sit on the LAST variant; order is semantic-free here.
    #[default]
    #[serde(other)]
    Medium,
}

impl Severity {
    fn label(self) -> &'static str {
        match self {
            Self::Low => "low",
            Self::Medium => "medium",
            Self::High => "high",
            Self::Critical => "critical",
        }
    }

    fn color(self) -> u32 {
        match self {
            Self::Low => 0x2ecc71,
            Self::Medium => 0x3498db,
            Self::High => 0xf39c12,
            Self::Critical => 0xe74c3c,
        }
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BugReportContext {
    route: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ManualAttachmentInput {
    name: Option<String>,
    mime_type: Option<String>,
    content_base64: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BugReportSubmitPayload {
    title: Option<String>,
    description: Option<String>,
    severity: Option<Severity>,
    screenshot_data_url: Option<String>,
    steps_to_reproduce: Option<String>,
    expected_result: Option<String>,
    actual_result: Option<String>,
    contact: Option<String>,
    context: Option<BugReportContext>,
    auto_log_ids: Option<Vec<String>>,
    attachments: Option<Vec<ManualAttachmentInput>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
enum LogSource {
    App,
    Runtime,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportAutoLogEntry {
    id: String,
    name: String,
    size: u64,
    source: LogSource,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportDiagnostics {
    timestamp: String,
    app_name: String,
    app_version: String,
    tauri_version: &'static str,
    webview_version: Option<String>,
    platform: &'static str,
    arch: &'static str,
    os_family: &'static str,
    app_packaged: bool,
    env_mode: &'static str,
    update_channel: String,
    mini_backend_running: bool,
    auth_api_url: String,
    local_api_url: String,
    runtime_artifacts_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportPrepareResponse {
    screenshot_data_url: Option<String>,
    auto_logs: Vec<BugReportAutoLogEntry>,
    diagnostics: BugReportDiagnostics,
    ready: bool,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportSubmitResponse {
    ok: bool,
    status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    screenshot_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<Cow<'static, str>>,
}

// ---------------------------------------------------------------------------
// Internal models
// ---------------------------------------------------------------------------

#[derive(Debug, Clone)]
struct BugReportConfig {
    webhook_url: String,
    imgur_client_id: String,
}

#[derive(Debug, Clone)]
struct AutoLogFile {
    id: String,
    name: String,
    size: u64,
    source: LogSource,
    path: PathBuf,
    modified: SystemTime,
}

#[derive(Debug)]
struct Attachment {
    name: String,
    mime_type: Cow<'static, str>,
    bytes: Vec<u8>,
}

#[derive(Debug)]
struct PreparedSubmission {
    title: String,
    description: String,
    severity: Severity,
    /// `None` when the user chose not to attach a screenshot or none was
    /// captured — the report is still submitted, without the Imgur image.
    screenshot_base64: Option<String>,
    route: String,
    narrative: Vec<(&'static str, String)>,
    attachments: Vec<Attachment>,
}

#[derive(Debug)]
struct RawImage {
    width: u32,
    height: u32,
    rgba: Vec<u8>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command(rename = "desktop-api:bug-report:prepare")]
pub async fn prepare<R: Runtime>(app: AppHandle<R>) -> Result<BugReportPrepareResponse, String> {
    let config = resolve_config(&app)?;
    let diagnostics = diagnostics(&app).await?;

    // Screen capture, PNG encoding and directory scanning are CPU/IO bound:
    // never on the async executor, never on the main thread.
    let (auto_logs, screenshot_result) = tauri::async_runtime::spawn_blocking(move || {
        let logs = collect_auto_logs(&app);
        let screenshot = capture_screen_data_url();
        (logs, screenshot)
    })
    .await
    .map_err(|error| error.to_string())?;

    let screenshot_data_url = screenshot_result.as_ref().ok().cloned().flatten();
    let configured = config.is_some();
    let error = if configured {
        screenshot_result.err()
    } else {
        Some(CONFIG_MISSING_MESSAGE.to_owned())
    };

    Ok(BugReportPrepareResponse {
        ready: configured && screenshot_data_url.is_some(),
        screenshot_data_url,
        auto_logs: auto_logs
            .into_iter()
            .map(|entry| BugReportAutoLogEntry {
                id: entry.id,
                name: entry.name,
                size: entry.size,
                source: entry.source,
            })
            .collect(),
        diagnostics,
        error,
    })
}

#[tauri::command(rename = "desktop-api:bug-report:submit")]
pub async fn submit<R: Runtime>(
    app: AppHandle<R>,
    payload: BugReportSubmitPayload,
) -> Result<BugReportSubmitResponse, String> {
    match submit_inner(app, payload).await {
        Ok(response) => Ok(response),
        Err(BugReportError::Rejected { status, message }) => {
            log::warn!("bug-report: submission rejected ({status}): {message}");
            Ok(BugReportSubmitResponse {
                ok: false,
                status,
                screenshot_url: None,
                error: Some(message),
            })
        }
        Err(BugReportError::Internal(message)) => {
            log::error!("bug-report: internal failure: {message}");
            Err(message)
        }
    }
}

async fn submit_inner<R: Runtime>(
    app: AppHandle<R>,
    payload: BugReportSubmitPayload,
) -> Result<BugReportSubmitResponse, BugReportError> {
    let config = resolve_config(&app)
        .map_err(BugReportError::Internal)?
        .ok_or_else(|| BugReportError::rejected(412, CONFIG_MISSING_MESSAGE))?;
    let diagnostics = diagnostics(&app).await.map_err(BugReportError::Internal)?;

    let prepared =
        tauri::async_runtime::spawn_blocking(move || prepare_submission(&app, payload))
            .await
            .map_err(BugReportError::internal)??;

    let client = http_client().map_err(BugReportError::Internal)?;
    let screenshot_url = match prepared.screenshot_base64.as_deref() {
        Some(image) => Some(
            upload_screenshot_to_imgur(
                &client,
                &config.imgur_client_id,
                &prepared.title,
                image,
            )
            .await?,
        ),
        None => None,
    };
    let status = send_discord_report(
        &client,
        &config.webhook_url,
        prepared,
        &diagnostics,
        screenshot_url.as_deref(),
    )
    .await?;

    Ok(BugReportSubmitResponse {
        ok: true,
        status,
        screenshot_url,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// Input preparation (runs on a blocking thread)
// ---------------------------------------------------------------------------

fn prepare_submission<R: Runtime>(
    app: &AppHandle<R>,
    payload: BugReportSubmitPayload,
) -> Result<PreparedSubmission, BugReportError> {
    let title = truncate(trimmed(payload.title.as_deref()), MAX_TITLE_CHARS);
    let description = truncate(trimmed(payload.description.as_deref()), MAX_DESCRIPTION_CHARS);
    if title.is_empty() || description.is_empty() {
        return Err(BugReportError::rejected(
            400,
            "Titulo e descricao sao obrigatorios.",
        ));
    }

    // An absent screenshot must not reject the report: the frontend omits it
    // whenever prepare reported no capture (e.g. non-Windows) or the user
    // chose not to include one.
    let screenshot_base64 = payload
        .screenshot_data_url
        .filter(|value| !value.trim().is_empty())
        .map(validate_screenshot_data_url)
        .transpose()?;
    let manual = decode_manual_attachments(payload.attachments.unwrap_or_default())?;
    let manual_bytes: usize = manual.iter().map(|item| item.bytes.len()).sum();

    let mut attachments = load_selected_logs(
        app,
        payload.auto_log_ids.as_deref().unwrap_or_default(),
        MAX_TOTAL_ATTACHMENT_BYTES.saturating_sub(manual_bytes),
        MAX_DISCORD_FILES.saturating_sub(1 + manual.len()),
    );
    attachments.extend(manual);

    let narrative = [
        ("Steps", payload.steps_to_reproduce),
        ("Expected", payload.expected_result),
        ("Actual", payload.actual_result),
        ("Contact", payload.contact),
    ]
    .into_iter()
    .filter_map(|(name, value)| {
        let value = truncate(trimmed(value.as_deref()), MAX_FIELD_CHARS);
        (!value.is_empty()).then_some((name, value))
    })
    .collect();

    let route = payload
        .context
        .and_then(|context| context.route)
        .map(|route| truncate(&route, MAX_FIELD_CHARS))
        .filter(|route| !route.is_empty())
        .unwrap_or_else(|| "n/a".to_owned());

    Ok(PreparedSubmission {
        title,
        description,
        severity: payload.severity.unwrap_or_default(),
        screenshot_base64,
        route,
        narrative,
        attachments,
    })
}

/// Validates `data:image/*;base64,...` and returns the raw base64 payload
/// (Imgur consumes base64 directly, so the decoded bytes are never kept).
/// The prefix is removed in place to avoid copying a multi-megabyte string.
fn validate_screenshot_data_url(mut data_url: String) -> Result<String, BugReportError> {
    let Some(comma) = data_url.find(',') else {
        return Err(BugReportError::rejected(400, "Screenshot invalida."));
    };
    {
        let header = &data_url[..comma];
        if !header.starts_with("data:image/") || !header.contains(";base64") {
            return Err(BugReportError::rejected(
                400,
                "The screenshot must be a base64 image data URL.",
            ));
        }
    }
    data_url.drain(..=comma);

    if base64::decoded_len_estimate(data_url.len()) > MAX_SCREENSHOT_BYTES {
        return Err(BugReportError::rejected(
            400,
            "The screenshot exceeds 10 MB.",
        ));
    }
    let decoded_len = BASE64
        .decode(data_url.as_bytes())
        .map_err(|_| BugReportError::rejected(400, "Screenshot base64 invalida."))?
        .len();
    if decoded_len > MAX_SCREENSHOT_BYTES {
        return Err(BugReportError::rejected(
            400,
            "The screenshot exceeds 10 MB.",
        ));
    }
    Ok(data_url)
}

fn decode_manual_attachments(
    items: Vec<ManualAttachmentInput>,
) -> Result<Vec<Attachment>, BugReportError> {
    if items.len() > MAX_MANUAL_ATTACHMENTS {
        return Err(BugReportError::rejected(
            400,
            format!("Maximo de {MAX_MANUAL_ATTACHMENTS} anexos."),
        ));
    }

    let mut total = 0usize;
    let mut attachments = Vec::with_capacity(items.len());
    for item in items {
        let name = safe_file_name(item.name.as_deref().unwrap_or_default());
        let encoded = item.content_base64.unwrap_or_default();
        if base64::decoded_len_estimate(encoded.len()) > MAX_MANUAL_FILE_BYTES {
            return Err(BugReportError::rejected(400, format!("{name} exceeds 8 MB.")));
        }
        let bytes = BASE64
            .decode(encoded.as_bytes())
            .map_err(|_| BugReportError::rejected(400, format!("Invalid attachment: {name}")))?;
        if bytes.len() > MAX_MANUAL_FILE_BYTES {
            return Err(BugReportError::rejected(400, format!("{name} exceeds 8 MB.")));
        }
        total += bytes.len();
        if total > MAX_TOTAL_ATTACHMENT_BYTES {
            return Err(BugReportError::rejected(
                400,
                format!(
                    "Attachments exceed {} MB in total.",
                    MAX_TOTAL_ATTACHMENT_BYTES / (1024 * 1024)
                ),
            ));
        }
        let mime_type = item
            .mime_type
            .as_deref()
            .map(str::trim)
            .filter(|mime| mime.contains('/') && mime.parse::<mime::Mime>().is_ok())
            .map_or(Cow::Borrowed("application/octet-stream"), |mime| {
                Cow::Owned(mime.to_owned())
            });
        attachments.push(Attachment {
            name,
            mime_type,
            bytes,
        });
    }
    Ok(attachments)
}

/// Loads the user-selected auto logs that fit into the remaining byte and
/// file-count budget. Newest first; anything that does not fit is skipped
/// rather than failing the whole report.
fn load_selected_logs<R: Runtime>(
    app: &AppHandle<R>,
    selected_ids: &[String],
    byte_budget: usize,
    file_budget: usize,
) -> Vec<Attachment> {
    if selected_ids.is_empty() || file_budget == 0 {
        return Vec::new();
    }
    let selected: HashSet<&str> = selected_ids.iter().map(String::as_str).collect();
    let mut remaining = byte_budget;
    let mut attachments = Vec::new();

    for log_file in collect_auto_logs(app)
        .into_iter()
        .filter(|entry| selected.contains(entry.id.as_str()))
    {
        if attachments.len() >= file_budget {
            break;
        }
        let bytes = match fs::read(&log_file.path) {
            Ok(bytes) => bytes,
            Err(error) => {
                log::warn!(
                    "bug-report: skipping unreadable log {}: {error}",
                    log_file.path.display()
                );
                continue;
            }
        };
        if bytes.len() > remaining {
            continue;
        }
        remaining -= bytes.len();
        attachments.push(Attachment {
            mime_type: log_mime_type(&log_file.path),
            name: safe_file_name(&log_file.name),
            bytes,
        });
    }
    attachments
}

// ---------------------------------------------------------------------------
// Upstream calls
// ---------------------------------------------------------------------------

async fn upload_screenshot_to_imgur(
    client: &reqwest::Client,
    client_id: &str,
    title: &str,
    image_base64: &str,
) -> Result<String, BugReportError> {
    let response = client
        .post(IMGUR_API_URL)
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Client-ID {client_id}"),
        )
        .form(&[
            ("image", image_base64),
            ("type", "base64"),
            ("title", title),
        ])
        .send()
        .await
        .map_err(|error| BugReportError::rejected(502, error.to_string()))?;

    let status = response.status();
    let body = response
        .json::<Value>()
        .await
        .unwrap_or_else(|_| json!({ "error": "Resposta invalida do Imgur." }));
    if !status.is_success() {
        return Err(BugReportError::rejected(
            502,
            format!(
                "Imgur retornou {}: {}",
                status.as_u16(),
                api_error_message(&body)
            ),
        ));
    }
    body.get("data")
        .and_then(|data| data.get("link"))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|link| !link.is_empty())
        .map(str::to_owned)
        .ok_or_else(|| BugReportError::rejected(502, "Imgur did not return the screenshot URL."))
}

async fn send_discord_report(
    client: &reqwest::Client,
    webhook_url: &str,
    prepared: PreparedSubmission,
    diagnostics: &BugReportDiagnostics,
    screenshot_url: Option<&str>,
) -> Result<u16, BugReportError> {
    let severity = prepared.severity;
    let mut embed = json!({
        "title": format!("[{}] {}", severity.label().to_uppercase(), prepared.title),
        "description": prepared.description,
        "color": severity.color(),
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "fields": report_fields(&prepared.route, &prepared.narrative, diagnostics),
    });
    if let Some(url) = screenshot_url {
        embed["image"] = json!({ "url": url });
    }
    let webhook_payload = json!({
        "username": "KOMA Bug Reporter",
        "embeds": [embed],
    });

    let diagnostics_json =
        serde_json::to_vec_pretty(diagnostics).map_err(BugReportError::internal)?;
    let mut form = Form::new()
        .text(
            "payload_json",
            serde_json::to_string(&webhook_payload).map_err(BugReportError::internal)?,
        )
        .part(
            "files[0]",
            file_part(diagnostics_json, "diagnostics.json".to_owned(), "application/json")?,
        );

    for (offset, attachment) in prepared
        .attachments
        .into_iter()
        .take(MAX_DISCORD_FILES - 1)
        .enumerate()
    {
        form = form.part(
            format!("files[{}]", offset + 1),
            file_part(attachment.bytes, attachment.name, &attachment.mime_type)?,
        );
    }

    let response = client
        .post(webhook_url)
        .multipart(form)
        .send()
        .await
        .map_err(|error| BugReportError::rejected(502, error.to_string()))?;
    let status = response.status();
    if status.is_success() {
        return Ok(status.as_u16());
    }

    let text = response.text().await.unwrap_or_default();
    let detail = truncate(&text, MAX_UPSTREAM_ERROR_CHARS);
    Err(BugReportError::rejected(
        502,
        if detail.is_empty() {
            format!("Discord webhook retornou {}", status.as_u16())
        } else {
            format!("Discord webhook retornou {}: {detail}", status.as_u16())
        },
    ))
}

fn file_part(bytes: Vec<u8>, file_name: String, mime_type: &str) -> Result<Part, BugReportError> {
    Part::bytes(bytes)
        .file_name(file_name)
        .mime_str(mime_type)
        .map_err(BugReportError::internal)
}

fn report_fields(
    route: &str,
    narrative: &[(&'static str, String)],
    diagnostics: &BugReportDiagnostics,
) -> Vec<Value> {
    let mut fields = Vec::with_capacity(3 + narrative.len());
    fields.push(json!({ "name": "App", "value": diagnostics.app_version, "inline": true }));
    fields.push(json!({
        "name": "Platform",
        "value": format!("{}/{}", diagnostics.platform, diagnostics.arch),
        "inline": true,
    }));
    fields.push(json!({ "name": "Route", "value": route, "inline": true }));
    fields.extend(
        narrative
            .iter()
            .map(|(name, value)| json!({ "name": name, "value": value, "inline": false })),
    );
    fields
}

// ---------------------------------------------------------------------------
// Diagnostics & configuration
// ---------------------------------------------------------------------------

async fn diagnostics<R: Runtime>(app: &AppHandle<R>) -> Result<BugReportDiagnostics, String> {
    let config = build_runtime_config(app)?;
    let mini_backend_running = tokio::time::timeout(
        BACKEND_PROBE_TIMEOUT,
        check_local_backend_health(&config.local_api_url),
    )
    .await
    .unwrap_or(false);
    let package = app.package_info();

    Ok(BugReportDiagnostics {
        timestamp: chrono::Utc::now().to_rfc3339(),
        app_name: package.name.clone(),
        app_version: package.version.to_string(),
        tauri_version: tauri::VERSION,
        webview_version: tauri::webview_version().ok(),
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        os_family: std::env::consts::FAMILY,
        app_packaged: !cfg!(debug_assertions),
        env_mode: if cfg!(debug_assertions) {
            "development"
        } else {
            "production"
        },
        update_channel: update_channel_from_version(&package.version.to_string()),
        mini_backend_running,
        auth_api_url: config.auth_api_url,
        local_api_url: config.local_api_url,
        runtime_artifacts_url: config.runtime_artifacts_url,
    })
}

fn resolve_config<R: Runtime>(app: &AppHandle<R>) -> Result<Option<BugReportConfig>, String> {
    let webhook_url = normalize_discord_webhook_url(
        resolve_desktop_env_value(app, DISCORD_WEBHOOK_ENV)?.as_deref(),
    );
    let imgur_client_id = resolve_desktop_env_value(app, IMGUR_CLIENT_ID_ENV)?
        .as_deref()
        .and_then(non_empty)
        .map(str::to_owned);

    Ok(match (webhook_url, imgur_client_id) {
        (Some(webhook_url), Some(imgur_client_id)) => Some(BugReportConfig {
            webhook_url,
            imgur_client_id,
        }),
        _ => None,
    })
}

// ---------------------------------------------------------------------------
// Auto log discovery
// ---------------------------------------------------------------------------

fn collect_auto_logs<R: Runtime>(app: &AppHandle<R>) -> Vec<AutoLogFile> {
    let resolver = app.path();
    let roots = [
        resolver.app_log_dir().ok().map(|dir| (dir, LogSource::App)),
        resolver
            .app_data_dir()
            .ok()
            .map(|dir| (dir.join("logs"), LogSource::Runtime)),
    ];

    let mut files = Vec::new();
    for (root, source) in roots.into_iter().flatten() {
        collect_logs_from_dir(&root, source, &mut files);
    }
    files.sort_by_key(|file| std::cmp::Reverse(file.modified));
    files.truncate(MAX_AUTO_LOG_FILES);
    files
}

fn collect_logs_from_dir(root: &Path, default_source: LogSource, files: &mut Vec<AutoLogFile>) {
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            log::warn!(
                "bug-report: cannot list log directory {}: {error}",
                root.display()
            );
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !is_allowed_log_file(&path) {
            continue;
        }
        // `DirEntry::metadata` does not follow symlinks: a link planted in the
        // log directory is never read and never shipped.
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if !metadata.is_file() || metadata.len() > MAX_AUTO_LOG_FILE_BYTES {
            continue;
        }
        let Some(name) = path.file_name().and_then(OsStr::to_str) else {
            continue;
        };
        let source = if name.to_ascii_lowercase().contains("runtime") {
            LogSource::Runtime
        } else {
            default_source
        };
        files.push(AutoLogFile {
            id: stable_hash("bug-report-log", &path.to_string_lossy()),
            name: name.to_owned(),
            size: metadata.len(),
            source,
            modified: metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH),
            path,
        });
    }
}

fn is_allowed_log_file(path: &Path) -> bool {
    path.extension()
        .and_then(OsStr::to_str)
        .is_some_and(|extension| {
            ALLOWED_LOG_EXTENSIONS
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(extension))
        })
}

fn log_mime_type(path: &Path) -> Cow<'static, str> {
    let extension = path
        .extension()
        .and_then(OsStr::to_str)
        .map(str::to_ascii_lowercase);
    Cow::Borrowed(match extension.as_deref() {
        Some("json") => "application/json",
        Some("ndjson") | Some("jsonl") => "application/x-ndjson",
        _ => "text/plain",
    })
}

// ---------------------------------------------------------------------------
// Screenshot capture
// ---------------------------------------------------------------------------

fn capture_screen_data_url() -> Result<Option<String>, String> {
    let Some(image) = screen_capture::capture_virtual_screen()? else {
        return Ok(None);
    };
    let png = encode_screenshot_within_limit(image)?;
    Ok(Some(format!("data:image/png;base64,{}", BASE64.encode(png))))
}

/// Encodes to PNG; if the result exceeds the upload ceiling the image is
/// box-downsampled by 2x and re-encoded until it fits (or hits the minimum edge).
fn encode_screenshot_within_limit(mut image: RawImage) -> Result<Vec<u8>, String> {
    loop {
        let png = encode_png(&image)?;
        let can_shrink =
            image.width / 2 >= MIN_SCREENSHOT_EDGE && image.height / 2 >= MIN_SCREENSHOT_EDGE;
        if png.len() <= MAX_SCREENSHOT_BYTES || !can_shrink {
            return Ok(png);
        }
        image = image.downsample_half();
    }
}

fn encode_png(image: &RawImage) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::with_capacity(image.rgba.len() / 4);
    let mut encoder = png::Encoder::new(&mut bytes, image.width, image.height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().map_err(|error| error.to_string())?;
    writer
        .write_image_data(&image.rgba)
        .map_err(|error| error.to_string())?;
    writer.finish().map_err(|error| error.to_string())?;
    Ok(bytes)
}

impl RawImage {
    /// 2x2 box filter. Requires `width >= 2 && height >= 2` (guaranteed by the
    /// caller); odd trailing rows/columns are dropped.
    fn downsample_half(&self) -> Self {
        let src_width = self.width as usize;
        let src_stride = src_width * 4;
        let width = self.width / 2;
        let height = self.height / 2;
        let mut rgba = Vec::with_capacity(width as usize * height as usize * 4);

        for y in 0..height as usize {
            let top = &self.rgba[y * 2 * src_stride..(y * 2 + 1) * src_stride];
            let bottom = &self.rgba[(y * 2 + 1) * src_stride..(y * 2 + 2) * src_stride];
            for x in 0..width as usize {
                let left = x * 8;
                let right = left + 4;
                for channel in 0..4 {
                    let sum = u16::from(top[left + channel])
                        + u16::from(top[right + channel])
                        + u16::from(bottom[left + channel])
                        + u16::from(bottom[right + channel]);
                    rgba.push(u8::try_from(sum / 4).unwrap_or(u8::MAX));
                }
            }
        }

        Self {
            width,
            height,
            rgba,
        }
    }
}

#[cfg(not(windows))]
mod screen_capture {
    use super::RawImage;

    /// Non-Windows targets capture through the frontend (`getDisplayMedia`);
    /// the backend reports "no screenshot" and the UI falls back accordingly.
    pub(super) fn capture_virtual_screen() -> Result<Option<RawImage>, String> {
        Ok(None)
    }
}

#[cfg(windows)]
mod screen_capture {
    use std::{mem, ptr};

    use windows_sys::Win32::{
        Graphics::Gdi::{
            BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
            GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT,
            DIB_RGB_COLORS, HBITMAP, HDC, HGDIOBJ, SRCCOPY,
        },
        UI::WindowsAndMessaging::{
            GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
            SM_YVIRTUALSCREEN,
        },
    };

    use super::RawImage;

    /// Hard ceiling for the raw BGRA buffer (e.g. 8 × 4K displays ≈ 265 MiB).
    const MAX_CAPTURE_BYTES: usize = 512 * 1024 * 1024;

    struct ScreenDc(HDC);

    impl ScreenDc {
        fn acquire() -> Result<Self, String> {
            // SAFETY: `GetDC(null)` returns the DC of the entire screen; no
            // preconditions. Released exactly once in `Drop`.
            let dc = unsafe { GetDC(ptr::null_mut()) };
            if dc.is_null() {
                return Err("Failed to access the screen context.".to_owned());
            }
            Ok(Self(dc))
        }
    }

    impl Drop for ScreenDc {
        fn drop(&mut self) {
            // SAFETY: `self.0` was obtained from `GetDC(null)` and is released here only.
            unsafe {
                ReleaseDC(ptr::null_mut(), self.0);
            }
        }
    }

    struct MemoryDc(HDC);

    impl MemoryDc {
        fn compatible_with(screen: &ScreenDc) -> Result<Self, String> {
            // SAFETY: `screen.0` is a live DC for the lifetime of `screen`.
            let dc = unsafe { CreateCompatibleDC(screen.0) };
            if dc.is_null() {
                return Err("Failed to create the capture context.".to_owned());
            }
            Ok(Self(dc))
        }
    }

    impl Drop for MemoryDc {
        fn drop(&mut self) {
            // SAFETY: `self.0` was created by `CreateCompatibleDC` and is owned by us.
            unsafe {
                DeleteDC(self.0);
            }
        }
    }

    struct GdiBitmap(HBITMAP);

    impl GdiBitmap {
        fn compatible_with(screen: &ScreenDc, width: i32, height: i32) -> Result<Self, String> {
            // SAFETY: `screen.0` is a live DC; dimensions were validated as positive.
            let bitmap = unsafe { CreateCompatibleBitmap(screen.0, width, height) };
            if bitmap.is_null() {
                return Err("Failed to create the capture bitmap.".to_owned());
            }
            Ok(Self(bitmap))
        }
    }

    impl Drop for GdiBitmap {
        fn drop(&mut self) {
            // SAFETY: `self.0` was created by `CreateCompatibleBitmap`; by the time
            // this runs any `Selection` borrowing it has already been dropped.
            unsafe {
                DeleteObject(self.0);
            }
        }
    }

    /// Scoped `SelectObject`: restores the previous object on drop. Borrows
    /// both the DC and the bitmap so neither can be destroyed while selected.
    struct Selection<'a> {
        dc: &'a MemoryDc,
        _bitmap: &'a GdiBitmap,
        previous: HGDIOBJ,
    }

    impl<'a> Selection<'a> {
        fn select(dc: &'a MemoryDc, bitmap: &'a GdiBitmap) -> Self {
            // SAFETY: both handles are live for `'a`.
            let previous = unsafe { SelectObject(dc.0, bitmap.0) };
            Self {
                dc,
                _bitmap: bitmap,
                previous,
            }
        }
    }

    impl Drop for Selection<'_> {
        fn drop(&mut self) {
            // SAFETY: restores the object that was selected before us into a live DC.
            unsafe {
                SelectObject(self.dc.0, self.previous);
            }
        }
    }

    pub(super) fn capture_virtual_screen() -> Result<Option<RawImage>, String> {
        // SAFETY: `GetSystemMetrics` has no preconditions.
        let (left, top, width, height) = unsafe {
            (
                GetSystemMetrics(SM_XVIRTUALSCREEN),
                GetSystemMetrics(SM_YVIRTUALSCREEN),
                GetSystemMetrics(SM_CXVIRTUALSCREEN),
                GetSystemMetrics(SM_CYVIRTUALSCREEN),
            )
        };
        if width <= 0 || height <= 0 {
            return Ok(None);
        }
        let width_px = u32::try_from(width).map_err(|error| error.to_string())?;
        let height_px = u32::try_from(height).map_err(|error| error.to_string())?;
        let byte_len = (width_px as usize)
            .checked_mul(height_px as usize)
            .and_then(|pixels| pixels.checked_mul(4))
            .filter(|len| *len <= MAX_CAPTURE_BYTES)
            .ok_or_else(|| "The virtual screen is too large to capture.".to_owned())?;

        let screen = ScreenDc::acquire()?;
        let memory = MemoryDc::compatible_with(&screen)?;
        let bitmap = GdiBitmap::compatible_with(&screen, width, height)?;

        {
            let selection = Selection::select(&memory, &bitmap);
            // SAFETY: source/destination DCs and the selected bitmap are all live;
            // the rectangle lies within the bitmap created with the same size.
            let copied = unsafe {
                BitBlt(
                    selection.dc.0,
                    0,
                    0,
                    width,
                    height,
                    screen.0,
                    left,
                    top,
                    SRCCOPY | CAPTUREBLT,
                )
            };
            if copied == 0 {
                return Err("Failed to copy pixels from the screen.".to_owned());
            }
            // `GetDIBits` requires the bitmap to be deselected from any DC.
        }

        // SAFETY: `BITMAPINFO` is plain-old-data; all-zero is a valid initial state.
        let mut info: BITMAPINFO = unsafe { mem::zeroed() };
        info.bmiHeader = BITMAPINFOHEADER {
            biSize: mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            // Negative height requests a top-down DIB (row 0 = top of screen).
            biHeight: -height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB,
            biSizeImage: 0,
            biXPelsPerMeter: 0,
            biYPelsPerMeter: 0,
            biClrUsed: 0,
            biClrImportant: 0,
        };

        let mut pixels = vec![0u8; byte_len];
        // SAFETY: `pixels` holds exactly width*height*4 bytes, matching the 32-bpp
        // top-down DIB described by `info`; the bitmap is not selected into any DC.
        let rows = unsafe {
            GetDIBits(
                memory.0,
                bitmap.0,
                0,
                height_px,
                pixels.as_mut_ptr().cast(),
                &mut info,
                DIB_RGB_COLORS,
            )
        };
        if rows == 0 {
            return Err("Failed to read pixels from the screen.".to_owned());
        }

        // BGRA → RGBA in place; GDI leaves alpha undefined, force opaque.
        for pixel in pixels.chunks_exact_mut(4) {
            pixel.swap(0, 2);
            pixel[3] = 0xFF;
        }

        Ok(Some(RawImage {
            width: width_px,
            height: height_px,
            rgba: pixels,
        }))
    }
}

// ---------------------------------------------------------------------------
// Generic Discord webhook relay
// ---------------------------------------------------------------------------

/// Generic Discord webhook relay for frontend-driven probes (e.g. testing a
/// user-configured integration). The `ok: false` + `status` shape is the
/// probe contract — the caller decides what a non-2xx means; the main bug
/// report submit never flows through here (it uses typed `Result`).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordWebhookSendPayload {
    pub url: String,
    pub body: Value,
}

/// Probe outcome. `status: 0` means the transport itself failed before an
/// HTTP answer existed (DNS, refused, timeout).
#[derive(Debug, Serialize)]
pub struct DiscordWebhookSendResult {
    pub ok: bool,
    pub status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl DiscordWebhookSendResult {
    fn failure(status: u16, error: impl Into<String>) -> Self {
        Self {
            ok: false,
            status,
            error: Some(error.into()),
        }
    }
}

#[tauri::command(rename = "desktop-api:discord-webhook:send")]
pub async fn discord_webhook_send(
    payload: DiscordWebhookSendPayload,
) -> Result<DiscordWebhookSendResult, String> {
    let Some(webhook_url) = normalize_discord_webhook_url(Some(&payload.url)) else {
        return Ok(DiscordWebhookSendResult::failure(
            400,
            "Invalid Discord webhook URL.",
        ));
    };
    if !payload.body.is_object() {
        return Ok(DiscordWebhookSendResult::failure(
            400,
            "Invalid webhook payload.",
        ));
    }
    let body = serde_json::to_vec(&payload.body).map_err(|error| error.to_string())?;
    if body.len() > MAX_WEBHOOK_BODY_BYTES {
        return Ok(DiscordWebhookSendResult::failure(
            413,
            "Webhook payload exceeds 256 KiB.",
        ));
    }

    let client = http_client()?;
    let response = match client
        .post(webhook_url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(body)
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => return Ok(DiscordWebhookSendResult::failure(0, error.to_string())),
    };

    let status = response.status();
    if status.is_success() {
        return Ok(DiscordWebhookSendResult {
            ok: true,
            status: status.as_u16(),
            error: None,
        });
    }
    let detail = truncate(
        &response.text().await.unwrap_or_default(),
        MAX_UPSTREAM_ERROR_CHARS,
    );
    Ok(DiscordWebhookSendResult {
        ok: false,
        status: status.as_u16(),
        error: (!detail.is_empty()).then_some(detail),
    })
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn normalize_discord_webhook_url(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    DISCORD_WEBHOOK_PREFIXES
        .iter()
        .any(|prefix| trimmed.starts_with(prefix))
        .then(|| trimmed.to_owned())
}

fn api_error_message(value: &Value) -> &str {
    value
        .get("data")
        .and_then(|data| data.get("error"))
        .or_else(|| value.get("error"))
        .or_else(|| value.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("Remote request failed.")
}

/// Strips path separators, reserved characters, control characters and
/// leading/trailing dots so the name can never escape the Discord attachment
/// namespace or collide with `.`/`..`.
fn safe_file_name(value: &str) -> String {
    let cleaned: String = value
        .trim()
        .chars()
        .filter(|ch| {
            !ch.is_control()
                && !matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
        })
        .take(MAX_FILE_NAME_CHARS)
        .collect();
    let cleaned = cleaned.trim_matches(|ch: char| ch == '.' || ch.is_whitespace());
    if cleaned.is_empty() {
        DEFAULT_ATTACHMENT_NAME.to_owned()
    } else {
        cleaned.to_owned()
    }
}

fn truncate(value: &str, max_chars: usize) -> String {
    value.trim().chars().take(max_chars).collect()
}

fn trimmed(value: Option<&str>) -> &str {
    value.map(str::trim).unwrap_or_default()
}

fn non_empty(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then_some(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_discord_webhook_url() {
        assert!(
            normalize_discord_webhook_url(Some(" https://discord.com/api/webhooks/1/token "))
                .is_some()
        );
        assert!(
            normalize_discord_webhook_url(Some("https://discordapp.com/api/webhooks/1/t"))
                .is_some()
        );
        assert!(normalize_discord_webhook_url(Some("https://example.com")).is_none());
        assert!(normalize_discord_webhook_url(None).is_none());
    }

    #[test]
    fn screenshot_data_url_returns_base64_payload() {
        let data = BASE64.encode(b"png");
        let payload =
            validate_screenshot_data_url(format!("data:image/png;base64,{data}")).unwrap();
        assert_eq!(payload, data);
    }

    #[test]
    fn screenshot_data_url_rejects_non_image_and_garbage() {
        let data = BASE64.encode(b"txt");
        assert!(matches!(
            validate_screenshot_data_url(format!("data:text/plain;base64,{data}")),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
        assert!(matches!(
            validate_screenshot_data_url("data:image/png;base64,***".to_owned()),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
        assert!(matches!(
            validate_screenshot_data_url("no-comma".to_owned()),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
    }

    #[test]
    fn severity_deserializes_with_fallback() {
        assert_eq!(
            serde_json::from_str::<Severity>("\"critical\"").unwrap(),
            Severity::Critical
        );
        assert_eq!(
            serde_json::from_str::<Severity>("\"nonsense\"").unwrap(),
            Severity::Medium
        );
    }

    #[test]
    fn manual_attachments_enforce_limits_and_mime_fallback() {
        let attachments = decode_manual_attachments(vec![ManualAttachmentInput {
            name: Some("../../evil.txt".to_owned()),
            mime_type: Some("not a mime".to_owned()),
            content_base64: Some(BASE64.encode(b"hello")),
        }])
        .unwrap();
        assert_eq!(attachments.len(), 1);
        assert_eq!(attachments[0].name, "evil.txt");
        assert_eq!(attachments[0].mime_type, "application/octet-stream");
        assert_eq!(attachments[0].bytes, b"hello");

        let too_many = (0..=MAX_MANUAL_ATTACHMENTS)
            .map(|_| ManualAttachmentInput::default())
            .collect();
        assert!(matches!(
            decode_manual_attachments(too_many),
            Err(BugReportError::Rejected { status: 400, .. })
        ));
    }

    #[test]
    fn safe_file_name_neutralizes_traversal_and_reserved_chars() {
        assert_eq!(safe_file_name("..\\..\\x:y*z?.log"), "xyz.log");
        assert_eq!(safe_file_name(" ... "), DEFAULT_ATTACHMENT_NAME);
        assert_eq!(safe_file_name("a\nb\u{7}.txt"), "ab.txt");
        assert!(safe_file_name(&"x".repeat(500)).chars().count() <= MAX_FILE_NAME_CHARS);
    }

    #[test]
    fn collects_only_allowed_log_files_and_ignores_oversized() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("app.log"), b"ok").unwrap();
        fs::write(temp.path().join("runtime-trace.json"), b"{}").unwrap();
        fs::write(temp.path().join("binary.bin"), b"nope").unwrap();
        fs::create_dir(temp.path().join("nested.log")).unwrap();

        let mut files = Vec::new();
        collect_logs_from_dir(temp.path(), LogSource::App, &mut files);

        assert_eq!(files.len(), 2);
        let runtime = files
            .iter()
            .find(|f| f.name == "runtime-trace.json")
            .unwrap();
        assert_eq!(runtime.source, LogSource::Runtime);
        let app = files.iter().find(|f| f.name == "app.log").unwrap();
        assert_eq!(app.source, LogSource::App);
        assert_eq!(app.size, 2);
    }

    #[test]
    fn missing_log_directory_is_not_an_error() {
        let mut files = Vec::new();
        collect_logs_from_dir(
            Path::new("/definitely/not/here/koma-logs"),
            LogSource::App,
            &mut files,
        );
        assert!(files.is_empty());
    }

    #[test]
    fn downsample_half_averages_2x2_blocks() {
        let image = RawImage {
            width: 4,
            height: 2,
            rgba: vec![
                0, 0, 0, 255, 100, 100, 100, 255, 10, 20, 30, 255, 10, 20, 30, 255, //
                200, 200, 200, 255, 100, 100, 100, 255, 10, 20, 30, 255, 10, 20, 30, 255,
            ],
        };
        let half = image.downsample_half();
        assert_eq!((half.width, half.height), (2, 1));
        assert_eq!(&half.rgba[..4], &[100, 100, 100, 255]);
        assert_eq!(&half.rgba[4..8], &[10, 20, 30, 255]);
    }

    #[test]
    fn png_roundtrip_encodes_valid_image() {
        let image = RawImage {
            width: 2,
            height: 2,
            rgba: vec![255; 16],
        };
        let png = encode_png(&image).unwrap();
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
    }

    #[test]
    fn extracts_upstream_error_messages() {
        assert_eq!(
            api_error_message(&json!({ "data": { "error": "bad image" } })),
            "bad image"
        );
        assert_eq!(api_error_message(&json!({ "message": "rate" })), "rate");
        assert_eq!(api_error_message(&json!({})), "Remote request failed.");
    }
}