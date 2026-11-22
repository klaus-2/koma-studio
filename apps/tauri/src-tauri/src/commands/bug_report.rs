use std::{
    borrow::Cow,
    collections::HashSet,
    ffi::OsStr,
    fs,
    path::{Path, PathBuf},
    sync::OnceLock,
    time::{Duration, SystemTime},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};
use thiserror::Error;

use crate::commands::{
    api::client::{http_client, stable_hash},
    desktop::{build_runtime_config, check_local_backend_health, DESKTOP_UPDATE_CHANNEL},
};

const DISCORD_WEBHOOK_PREFIXES: &[&str] = &[
    "https://discord.com/api/webhooks/",
    "https://discordapp.com/api/webhooks/",
];
const ALLOWED_LOG_EXTENSIONS: &[&str] = &["log", "txt", "json", "ndjson", "jsonl"];
const ALLOWED_ENDPOINT_HOST: &str = "koma-studio.site";
const ENDPOINT_INVALID_MESSAGE: &str =
    "The bug-report endpoint must be an https URL on koma-studio.site or a subdomain of it.";
const BUG_REPORT_SCHEMA: u8 = 1;

const MAX_AUTO_LOG_FILES: usize = 12;
const MAX_AUTO_LOG_FILE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_MANUAL_ATTACHMENTS: usize = 4;
const MAX_MANUAL_FILE_BYTES: usize = 5 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES: usize = 6 * 1024 * 1024;
const MIN_TITLE_CHARS: usize = 5;
const MAX_TITLE_CHARS: usize = 180;
const MAX_DESCRIPTION_CHARS: usize = 3500;
const MAX_FIELD_CHARS: usize = 1024;
const MAX_FILE_NAME_CHARS: usize = 120;
const MAX_UPSTREAM_ERROR_CHARS: usize = 512;
const MAX_LOG_ITEMS: usize = 24;
const MAX_LOG_ITEM_BYTES: usize = 512 * 1024;
const MAX_LOGS_TOTAL_BYTES: usize = 3 * 1024 * 1024;
const WIRE_BUDGET_BYTES: usize = 20 * 1024 * 1024;
/// Smallest edge we accept when downscaling an oversized screenshot.
const MIN_SCREENSHOT_EDGE: u32 = 320;
const BACKEND_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const DEFAULT_ATTACHMENT_NAME: &str = "attachment.bin";
const MAX_WEBHOOK_BODY_BYTES: usize = 256 * 1024;


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

impl From<crate::error::AppError> for BugReportError {
    fn from(error: crate::error::AppError) -> Self {
        Self::Internal(error.to_string())
    }
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
    screenshot_data_url: Option<String>,
    steps_to_reproduce: Option<String>,
    expected_result: Option<String>,
    actual_result: Option<String>,
    contact: Option<String>,
    context: Option<BugReportContext>,
    auto_log_ids: Option<Vec<String>>,
    attachments: Option<Vec<ManualAttachmentInput>>,
    endpoint_url: Option<String>,
    include_logs: Option<bool>,
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
    error: Option<Cow<'static, str>>,
}


#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BugReportClientInfo {
    app_version: String,
    shell: &'static str,
    platform: &'static str,
    arch: &'static str,
    channel: String,
    session_id: String,
}

#[derive(Debug, Serialize)]
struct BugReportLogEntry {
    name: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct BugReportApiAttachment {
    name: String,
    mime: String,
    data: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BugReportApiPayload {
    schema: u8,
    title: String,
    description: String,
    include_logs: bool,
    client: BugReportClientInfo,
    diagnostics: BugReportDiagnostics,
    screenshot: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    logs: Vec<BugReportLogEntry>,
    attachments: Vec<BugReportApiAttachment>,
    dropped_attachments: usize,
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
struct RawImage {
    width: u32,
    height: u32,
    rgba: Vec<u8>,
}

#[derive(Debug)]
struct PreparedParts {
    title: String,
    description: String,
    include_logs: bool,
    screenshot: Option<String>,
    attachments: Vec<BugReportApiAttachment>,
    auto_log_ids: Option<Vec<String>>,
}


#[tauri::command(rename = "desktop-api:bug-report:prepare")]
pub async fn prepare<R: Runtime>(app: AppHandle<R>) -> Result<BugReportPrepareResponse, String> {
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

    Ok(BugReportPrepareResponse {
        ready: true,
        screenshot_data_url: screenshot_result.as_ref().ok().cloned().flatten(),
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
        error: screenshot_result.err(),
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
    let endpoint_url = payload
        .endpoint_url
        .clone()
        .map(|url| url.trim().to_owned())
        .unwrap_or_default();
    if !is_allowed_bug_report_endpoint(&endpoint_url) {
        return Err(BugReportError::rejected(400, ENDPOINT_INVALID_MESSAGE));
    }
    let diagnostics = diagnostics(&app).await.map_err(BugReportError::Internal)?;

    let api_payload = tauri::async_runtime::spawn_blocking(move || {
        prepare_submission(&app, payload, diagnostics)
    })
    .await
    .map_err(BugReportError::internal)??;

    let client = bug_report_http_client()
        .map_err(|error| BugReportError::Internal(error.to_string()))?;
    let response = client
        .post(endpoint_url)
        .json(&api_payload)
        .send()
        .await
        .map_err(|error| {
            BugReportError::rejected(502, format!("Bug-report endpoint unreachable: {error}"))
        })?;
    map_bug_report_response(response).await
}

// Log payloads must never follow a redirect off the allowlisted host, so this
// client disables redirect following entirely (a 3xx surfaces as an error
// instead of replaying the body elsewhere).
fn bug_report_http_client() -> Result<reqwest::Client, String> {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    if let Some(client) = CLIENT.get() {
        return Ok(client.clone());
    }
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(60))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| error.to_string())?;
    if CLIENT.set(client.clone()).is_ok() {
        return Ok(client);
    }
    CLIENT
        .get()
        .cloned()
        .ok_or_else(|| "bug-report http client unavailable".to_string())
}


fn prepare_submission<R: Runtime>(
    app: &AppHandle<R>,
    payload: BugReportSubmitPayload,
    diagnostics: BugReportDiagnostics,
) -> Result<BugReportApiPayload, BugReportError> {
    let parts = prepare_payload_parts(payload)?;
    let discovered = if parts.include_logs {
        discovered_logs(app, parts.auto_log_ids.as_deref())
    } else {
        Vec::new()
    };
    let logs = collect_log_entries(discovered);
    let api_payload = assemble_api_payload(parts, diagnostics, logs);
    enforce_wire_budget(api_payload, WIRE_BUDGET_BYTES)
}

fn prepare_payload_parts(
    payload: BugReportSubmitPayload,
) -> Result<PreparedParts, BugReportError> {
    let title = truncate(trimmed(payload.title.as_deref()), MAX_TITLE_CHARS);
    if title.chars().count() < MIN_TITLE_CHARS {
        return Err(BugReportError::rejected(
            400,
            format!("Title must be at least {MIN_TITLE_CHARS} characters."),
        ));
    }
    let description = truncate(trimmed(payload.description.as_deref()), MAX_DESCRIPTION_CHARS);

    let narrative = [
        ("Route", payload.context.and_then(|context| context.route)),
        ("Steps", payload.steps_to_reproduce),
        ("Expected", payload.expected_result),
        ("Actual", payload.actual_result),
        ("Contact", payload.contact),
    ];
    let sections: Vec<(&'static str, String)> = narrative
        .into_iter()
        .filter_map(|(name, value)| {
            let value = truncate(trimmed(value.as_deref()), MAX_FIELD_CHARS);
            (!value.is_empty()).then_some((name, value))
        })
        .collect();
    let description = assemble_description(&description, &sections);

    let screenshot = payload
        .screenshot_data_url
        .filter(|value| !value.trim().is_empty());
    if let Some(data_url) = &screenshot {
        validate_screenshot_data_url(data_url)?;
    }

    let attachments = validate_manual_attachments(payload.attachments.unwrap_or_default())?;

    Ok(PreparedParts {
        title,
        description,
        include_logs: payload.include_logs.unwrap_or(true),
        screenshot,
        attachments,
        auto_log_ids: payload.auto_log_ids,
    })
}

fn assemble_description(description: &str, sections: &[(&'static str, String)]) -> String {
    let mut assembled = String::with_capacity(description.len() + 64);
    assembled.push_str(description);
    for (name, value) in sections {
        assembled.push_str("\n\n");
        assembled.push_str(name);
        assembled.push_str(":\n");
        assembled.push_str(value);
    }
    truncate(&assembled, MAX_DESCRIPTION_CHARS)
}

/// Validates `data:image/(png|jpeg);base64,...` against the endpoint contract
/// (6 MB decoded ceiling). The data URL is shipped as-is.
fn validate_screenshot_data_url(data_url: &str) -> Result<(), BugReportError> {
    let Some((header, payload)) = data_url.split_once(',') else {
        return Err(BugReportError::rejected(400, "The screenshot must be a data URL with a ',' separator."));
    };
    if header != "data:image/png;base64" && header != "data:image/jpeg;base64" {
        return Err(BugReportError::rejected(
            400,
            "The screenshot must be a base64 PNG or JPEG data URL.",
        ));
    }
    if base64::decoded_len_estimate(payload.len()) > MAX_SCREENSHOT_BYTES {
        return Err(BugReportError::rejected(
            400,
            "The screenshot exceeds 6 MB.",
        ));
    }
    let decoded_len = BASE64
        .decode(payload.as_bytes())
        .map_err(|_| BugReportError::rejected(400, "The screenshot must carry valid base64 data."))?
        .len();
    if decoded_len > MAX_SCREENSHOT_BYTES {
        return Err(BugReportError::rejected(
            400,
            "The screenshot exceeds 6 MB.",
        ));
    }
    Ok(())
}

/// Attachments must be image or text files, at most 4 items of 5 MB decoded
/// each; anything else is rejected locally instead of failing at the server.
fn validate_manual_attachments(
    items: Vec<ManualAttachmentInput>,
) -> Result<Vec<BugReportApiAttachment>, BugReportError> {
    if items.len() > MAX_MANUAL_ATTACHMENTS {
        return Err(BugReportError::rejected(
            400,
            format!("Maximum of {MAX_MANUAL_ATTACHMENTS} attachments."),
        ));
    }

    let mut attachments = Vec::with_capacity(items.len());
    for item in items {
        let name = safe_file_name(item.name.as_deref().unwrap_or_default());
        let mime = item
            .mime_type
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .parse::<mime::Mime>()
            .map_err(|_| {
                BugReportError::rejected(400, format!("Invalid attachment MIME type: {name}"))
            })?;
        if mime.type_() != "image" && mime.type_() != "text" {
            return Err(BugReportError::rejected(
                400,
                format!("Attachment must be an image or text file: {name}"),
            ));
        }
        let data = item.content_base64.unwrap_or_default();
        if base64::decoded_len_estimate(data.len()) > MAX_MANUAL_FILE_BYTES {
            return Err(BugReportError::rejected(400, format!("{name} exceeds 5 MB.")));
        }
        let decoded_len = BASE64
            .decode(data.as_bytes())
            .map_err(|_| BugReportError::rejected(400, format!("Invalid attachment: {name}")))?
            .len();
        if decoded_len > MAX_MANUAL_FILE_BYTES {
            return Err(BugReportError::rejected(400, format!("{name} exceeds 5 MB.")));
        }
        attachments.push(BugReportApiAttachment {
            name,
            mime: format!("{}/{}", mime.type_(), mime.subtype()),
            data,
        });
    }
    Ok(attachments)
}

/// Wire-budget enforcement: the serialized body must fit the budget; over
/// budget it drops attachments largest-first (the screenshot is never an
/// attachment), then removes the oldest log entries until it fits.
fn enforce_wire_budget(
    mut payload: BugReportApiPayload,
    wire_budget: usize,
) -> Result<BugReportApiPayload, BugReportError> {
    let mut dropped = 0usize;
    while serialized_len(&payload)? > wire_budget {
        if let Some(index) = largest_attachment_index(&payload.attachments) {
            payload.attachments.remove(index);
            dropped += 1;
        } else if payload.logs.pop().is_none() {
            return Err(BugReportError::Internal(
                "bug-report payload exceeds the wire budget with nothing left to drop.".to_owned(),
            ));
        }
    }
    payload.dropped_attachments = dropped;
    Ok(payload)
}

fn serialized_len(payload: &BugReportApiPayload) -> Result<usize, BugReportError> {
    serde_json::to_vec(payload)
        .map(|bytes| bytes.len())
        .map_err(|error| BugReportError::Internal(error.to_string()))
}

/// First occurrence wins on ties so trimming is deterministic for a given
/// attachment list order.
fn largest_attachment_index(attachments: &[BugReportApiAttachment]) -> Option<usize> {
    let mut best: Option<(usize, usize)> = None;
    for (index, attachment) in attachments.iter().enumerate() {
        let size = attachment.data.len();
        match best {
            Some((_, best_size)) if best_size >= size => {}
            _ => best = Some((index, size)),
        }
    }
    best.map(|(index, _)| index)
}

fn assemble_api_payload(
    parts: PreparedParts,
    diagnostics: BugReportDiagnostics,
    logs: Vec<BugReportLogEntry>,
) -> BugReportApiPayload {
    BugReportApiPayload {
        schema: BUG_REPORT_SCHEMA,
        title: parts.title,
        description: parts.description,
        include_logs: parts.include_logs,
        client: BugReportClientInfo {
            app_version: diagnostics.app_version.clone(),
            shell: "tauri",
            platform: diagnostics.platform,
            arch: diagnostics.arch,
            channel: diagnostics.update_channel.clone(),
            session_id: session_id().to_owned(),
        },
        diagnostics,
        screenshot: parts.screenshot,
        logs,
        attachments: parts.attachments,
        dropped_attachments: 0,
    }
}


async fn map_bug_report_response(
    response: reqwest::Response,
) -> Result<BugReportSubmitResponse, BugReportError> {
    let status = response.status().as_u16();
    if (200..300).contains(&status) {
        return Ok(BugReportSubmitResponse {
            ok: true,
            status,
            error: None,
        });
    }

    let body = response.text().await.unwrap_or_default();
    let message: Cow<'static, str> = match status {
        300..=399 => {
            format!("The bug-report endpoint answered with a redirect ({status}); reports are never sent elsewhere.").into()
        }
        405 => "The bug-report endpoint rejected the HTTP method (405).".into(),
        413 => "The bug report exceeds the server size limit (413).".into(),
        429 => "Too many bug reports were submitted; try again later (429).".into(),
        400..=499 => {
            let detail = server_error_detail(&body)
                .unwrap_or_else(|| truncate(&body, MAX_UPSTREAM_ERROR_CHARS));
            if detail.is_empty() {
                format!("The bug-report endpoint rejected the report ({status}).").into()
            } else {
                truncate(&detail, MAX_UPSTREAM_ERROR_CHARS).into()
            }
        }
        _ => format!("The bug-report endpoint failed ({status}).").into(),
    };
    let reported_status = if (400..500).contains(&status) { status } else { 502 };
    Err(BugReportError::rejected(reported_status, message))
}

/// Extracts the server's `{"detail": ...}` explanation; non-JSON bodies fall
/// back to the raw truncated text at the call site.
fn server_error_detail(body: &str) -> Option<String> {
    let value: Value = serde_json::from_str(body).ok()?;
    let field = value.get("detail").or_else(|| value.get("error"))?;
    match field {
        Value::String(detail) => Some(detail.clone()),
        other => Some(other.to_string()),
    }
}


async fn diagnostics<R: Runtime>(app: &AppHandle<R>) -> Result<BugReportDiagnostics, String> {
    let config = build_runtime_config(app);
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
        update_channel: DESKTOP_UPDATE_CHANNEL.to_owned(),
        mini_backend_running,
        auth_api_url: config.auth_api_url,
        local_api_url: config.local_api_url,
        runtime_artifacts_url: Some(config.runtime_artifacts_url),
    })
}


fn discovered_logs<R: Runtime>(
    app: &AppHandle<R>,
    selected_ids: Option<&[String]>,
) -> Vec<AutoLogFile> {
    let files = collect_auto_logs(app);
    match selected_ids {
        None | Some(&[]) => files,
        Some(ids) => {
            let selected: HashSet<&str> = ids.iter().map(String::as_str).collect();
            files
                .into_iter()
                .filter(|file| selected.contains(file.id.as_str()))
                .collect()
        }
    }
}

fn collect_log_entries(files: Vec<AutoLogFile>) -> Vec<BugReportLogEntry> {
    build_log_entries(
        files,
        MAX_LOG_ITEMS,
        MAX_LOG_ITEM_BYTES,
        MAX_LOGS_TOTAL_BYTES,
    )
}

/// Newest files first; each file keeps only its tail (the failure lives at
/// the end) and the whole list stops at the total byte cap.
fn build_log_entries(
    files: Vec<AutoLogFile>,
    max_items: usize,
    item_cap: usize,
    total_cap: usize,
) -> Vec<BugReportLogEntry> {
    let mut entries = Vec::new();
    let mut total = 0usize;
    for file in files {
        if entries.len() >= max_items || total >= total_cap {
            break;
        }
        let bytes = match fs::read(&file.path) {
            Ok(bytes) => bytes,
            Err(error) => {
                log::warn!(
                    "bug-report: skipping unreadable log {}: {error}",
                    file.path.display()
                );
                continue;
            }
        };
        let cap = item_cap.min(total_cap - total);
        let content = tail_truncate_lossy(&bytes, cap);
        total += content.len();
        entries.push(BugReportLogEntry {
            name: file.name,
            content,
        });
    }
    entries
}

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

/// Keeps at most `max_bytes` trailing bytes, advancing the cut to the next
/// UTF-8 character boundary so the result is always valid UTF-8.
fn tail_truncate_lossy(bytes: &[u8], max_bytes: usize) -> String {
    if bytes.len() <= max_bytes {
        return String::from_utf8_lossy(bytes).into_owned();
    }
    let start = bytes.len() - max_bytes;
    let start = (start..bytes.len())
        .find(|&index| bytes[index] & 0xC0 != 0x80)
        .unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[start..]).into_owned()
}


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
    use std::mem;

    use windows_sys::Win32::{
        Graphics::Gdi::{
            BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits,
            SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT, DIB_RGB_COLORS, HBITMAP,
            HDC, HGDIOBJ, SRCCOPY,
        },
        UI::WindowsAndMessaging::{
            GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
            SM_YVIRTUALSCREEN,
        },
    };

    use super::RawImage;
    use crate::win32::ScreenDc;

    /// Hard ceiling for the raw BGRA buffer (e.g. 8 × 4K displays ≈ 265 MiB).
    const MAX_CAPTURE_BYTES: usize = 512 * 1024 * 1024;

    struct MemoryDc(HDC);

    impl MemoryDc {
        fn compatible_with(screen: &ScreenDc) -> Result<Self, String> {
            // SAFETY: `screen.handle()` is a live DC for the lifetime of `screen`.
            let dc = unsafe { CreateCompatibleDC(screen.handle()) };
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
            // SAFETY: `screen.handle()` is a live DC; dimensions were validated as positive.
            let bitmap = unsafe { CreateCompatibleBitmap(screen.handle(), width, height) };
            if bitmap.is_null() {
                return Err("Failed to create the capture bitmap.".to_owned());
            }
            Ok(Self(bitmap))
        }
    }

    impl Drop for GdiBitmap {
        fn drop(&mut self) {
            // SAFETY: `self.0` was created by `CreateCompatibleBitmap` and is owned by us.
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

        let screen =
            ScreenDc::acquire().ok_or_else(|| "Failed to access the screen context.".to_owned())?;
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
                    screen.handle(),
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


/// Generic Discord webhook relay for frontend-driven probes (e.g. testing a
/// user-configured integration). The `ok: false` + `status` shape is the
/// probe contract — the caller decides what a non-2xx means; the bug-report
/// submit does not flow through here (it POSTs JSON to the allowlisted
/// endpoint).
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

    let client = http_client().map_err(|error| error.to_string())?;
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


fn normalize_discord_webhook_url(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    DISCORD_WEBHOOK_PREFIXES
        .iter()
        .any(|prefix| trimmed.starts_with(prefix))
        .then(|| trimmed.to_owned())
}

/// Only `https://koma-studio.site` and its subdomains are accepted so a
/// compromised webview cannot redirect bug reports (with their logs) to a
/// third-party host.
fn is_allowed_bug_report_endpoint(value: &str) -> bool {
    let Ok(url) = url::Url::parse(value.trim()) else {
        return false;
    };
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let host = host.strip_suffix('.').unwrap_or(host);
    let subdomain_suffix = format!(".{ALLOWED_ENDPOINT_HOST}");
    host == ALLOWED_ENDPOINT_HOST || host.ends_with(&subdomain_suffix)
}

/// uuid4 generated once per app session, reused by every report of the run.
fn session_id() -> &'static str {
    static SESSION_ID: OnceLock<String> = OnceLock::new();
    SESSION_ID.get_or_init(|| uuid::Uuid::new_v4().to_string())
}

/// Strips path separators, reserved characters, control characters and
/// leading/trailing dots so the name can never escape the attachment name
/// field or collide with `.`/`..`.
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

#[cfg(test)]
#[path = "bug_report_tests.rs"]
mod tests;

