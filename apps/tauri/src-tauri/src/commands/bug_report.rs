use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
};

use base64::{engine::general_purpose, Engine as _};
use reqwest::multipart::{Form, Part};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};

use crate::commands::{
    api::client::{http_client, stable_hash, string_field},
    desktop::{build_runtime_config, resolve_desktop_env_value},
};

const DISCORD_WEBHOOK_ENV: &str = "BUG_REPORT_DISCORD_WEBHOOK_URL";
const IMGUR_CLIENT_ID_ENV: &str = "IMGUR_CLIENT_ID";
const IMGUR_API_URL: &str = "https://api.imgur.com/3/image";
const MAX_AUTO_LOG_FILES: usize = 12;
const MAX_AUTO_LOG_FILE_BYTES: u64 = 1_500_000;
const MAX_MANUAL_ATTACHMENTS: usize = 5;
const MAX_MANUAL_FILE_BYTES: usize = 8 * 1024 * 1024;
const MAX_TOTAL_ATTACHMENT_BYTES: usize = 20 * 1024 * 1024;
const MAX_SCREENSHOT_BYTES: usize = 10 * 1024 * 1024;
const ALLOWED_LOG_EXTENSIONS: &[&str] = &["log", "txt", "json", "ndjson", "jsonl"];

#[derive(Debug, Clone)]
struct AutoLogFile {
    id: String,
    name: String,
    size: u64,
    source: &'static str,
    path: PathBuf,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BugReportAutoLogEntry {
    id: String,
    name: String,
    size: u64,
    source: &'static str,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BugReportDiagnostics {
    timestamp: String,
    app_version: String,
    platform: String,
    release: String,
    arch: String,
    node_version: String,
    electron_version: String,
    chrome_version: String,
    app_packaged: bool,
    env_mode: String,
    update_channel: String,
    mini_backend_running: bool,
    mini_backend_runtime_line_count: u32,
    auth_api_url: String,
    local_api_url: String,
    machine_profile_schema_version: u8,
    machine_profile: Option<Value>,
    machine_profile_sync: Value,
}

#[derive(Debug)]
struct DecodedDataUrl {
    mime_type: String,
    base64_payload: String,
    bytes: Vec<u8>,
}

#[derive(Debug)]
struct Attachment {
    name: String,
    mime_type: String,
    bytes: Vec<u8>,
}

#[tauri::command(rename = "desktop-api:bug-report:prepare")]
pub fn prepare<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    let diagnostics = diagnostics(&app)?;
    let auto_logs = collect_auto_logs(&app)?;
    let screenshot_result = capture_screen_data_url();
    let screenshot_data_url = screenshot_result.as_ref().ok().and_then(Clone::clone);
    let configured = bug_report_configured(&app)?;
    let ready = configured && screenshot_data_url.is_some();
    let error = if configured {
        screenshot_result.err()
    } else {
        Some(
            "BUG_REPORT_DISCORD_WEBHOOK_URL e IMGUR_CLIENT_ID devem estar configurados."
                .to_string(),
        )
    };

    Ok(json!({
        "screenshotDataUrl": screenshot_data_url,
        "autoLogs": auto_logs
            .into_iter()
            .map(|entry| BugReportAutoLogEntry {
                id: entry.id,
                name: entry.name,
                size: entry.size,
                source: entry.source,
            })
            .collect::<Vec<_>>(),
        "diagnostics": diagnostics,
        "ready": ready,
        "error": error,
    }))
}

#[tauri::command(rename = "desktop-api:bug-report:submit")]
pub async fn submit<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let Some(webhook_url) = normalize_discord_webhook_url(
        resolve_desktop_env_value(&app, DISCORD_WEBHOOK_ENV)?.as_deref(),
    ) else {
        return Ok(report_error(
            412,
            "BUG_REPORT_DISCORD_WEBHOOK_URL e IMGUR_CLIENT_ID devem estar configurados.",
        ));
    };
    let imgur_client_id = resolve_desktop_env_value(&app, IMGUR_CLIENT_ID_ENV)?.unwrap_or_default();
    let Some(imgur_client_id) = non_empty(&imgur_client_id).map(str::to_string) else {
        return Ok(report_error(
            412,
            "BUG_REPORT_DISCORD_WEBHOOK_URL e IMGUR_CLIENT_ID devem estar configurados.",
        ));
    };

    let title = string_field(&payload, "title");
    let description = string_field(&payload, "description");
    let severity = normalize_severity(&string_field(&payload, "severity"));
    if title.is_empty() || description.is_empty() {
        return Ok(report_error(400, "Titulo e descricao sao obrigatorios."));
    }

    let screenshot = match decode_data_url(&string_field(&payload, "screenshotDataUrl")) {
        Ok(value) => value,
        Err(error) => return Ok(report_error(400, &error)),
    };
    if screenshot.bytes.len() > MAX_SCREENSHOT_BYTES {
        return Ok(report_error(400, "The screenshot exceeds 10 MB."));
    }
    if !screenshot.mime_type.starts_with("image/") {
        return Ok(report_error(400, "The screenshot must be an image."));
    }

    let attachments = match manual_attachments(payload.get("attachments")) {
        Ok(value) => value,
        Err(error) => return Ok(report_error(400, &error)),
    };
    let diagnostics = diagnostics(&app)?;
    let selected_logs = selected_auto_logs(&app, payload.get("autoLogIds"))?;
    let client = http_client()?;
    let screenshot_url = match upload_screenshot_to_imgur(
        &client,
        &imgur_client_id,
        &title,
        &screenshot.base64_payload,
    )
    .await
    {
        Ok(value) => value,
        Err(error) => return Ok(report_error(502, &error)),
    };

    let webhook_status = match send_discord_report(
        &client,
        &webhook_url,
        &payload,
        &title,
        &description,
        severity,
        &screenshot_url,
        &diagnostics,
        selected_logs,
        attachments,
    )
    .await
    {
        Ok(status) => status,
        Err(error) => return Ok(report_error(502, &error)),
    };

    Ok(json!({
        "ok": true,
        "status": webhook_status,
        "screenshotUrl": screenshot_url,
    }))
}

async fn upload_screenshot_to_imgur(
    client: &reqwest::Client,
    client_id: &str,
    title: &str,
    image_base64: &str,
) -> Result<String, String> {
    let mut form = std::collections::HashMap::new();
    form.insert("image", image_base64.to_string());
    form.insert("type", "base64".to_string());
    form.insert("title", title.to_string());

    let response = client
        .post(IMGUR_API_URL)
        .header(
            reqwest::header::AUTHORIZATION,
            format!("Client-ID {client_id}"),
        )
        .form(&form)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let value = response
        .json::<Value>()
        .await
        .unwrap_or_else(|_| json!({ "error": "Resposta invalida do Imgur." }));
    if !status.is_success() {
        return Err(format!(
            "Imgur retornou {}: {}",
            status.as_u16(),
            api_error_message(&value)
        ));
    }
    value
        .get("data")
        .and_then(|data| data.get("link"))
        .and_then(Value::as_str)
        .filter(|link| !link.trim().is_empty())
        .map(|link| link.to_string())
        .ok_or_else(|| "Imgur did not return the screenshot URL.".to_string())
}

async fn send_discord_report(
    client: &reqwest::Client,
    webhook_url: &str,
    payload: &Value,
    title: &str,
    description: &str,
    severity: &str,
    screenshot_url: &str,
    diagnostics: &BugReportDiagnostics,
    logs: Vec<AutoLogFile>,
    manual: Vec<Attachment>,
) -> Result<u16, String> {
    let webhook_payload = json!({
        "username": "KOMA Bug Reporter",
        "embeds": [{
            "title": format!("[{}] {}", severity.to_uppercase(), title),
            "description": description,
            "color": severity_color(severity),
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "image": { "url": screenshot_url },
            "fields": report_fields(payload, diagnostics),
        }]
    });
    let mut form = Form::new().text(
        "payload_json",
        serde_json::to_string(&webhook_payload).map_err(|error| error.to_string())?,
    );
    let mut file_index = 0usize;
    form = add_json_part(form, file_index, "diagnostics.json", diagnostics)?;
    file_index += 1;

    let mut total = 0usize;
    for log_file in logs {
        let bytes = fs::read(&log_file.path).map_err(|error| error.to_string())?;
        if bytes.len() > MAX_AUTO_LOG_FILE_BYTES as usize {
            continue;
        }
        if total + bytes.len() > MAX_TOTAL_ATTACHMENT_BYTES {
            break;
        }
        total += bytes.len();
        form = form.part(
            format!("files[{file_index}]"),
            Part::bytes(bytes).file_name(safe_file_name(&log_file.name)),
        );
        file_index += 1;
    }
    for attachment in manual {
        if total + attachment.bytes.len() > MAX_TOTAL_ATTACHMENT_BYTES {
            return Err("Anexos excedem 20 MB no total.".to_string());
        }
        total += attachment.bytes.len();
        let file_name = safe_file_name(&attachment.name);
        let part = Part::bytes(attachment.bytes).file_name(file_name);
        let part = if attachment.mime_type.contains('/') {
            part.mime_str(&attachment.mime_type)
                .map_err(|error| error.to_string())?
        } else {
            part
        };
        form = form.part(format!("files[{file_index}]"), part);
        file_index += 1;
    }

    let response = client
        .post(webhook_url)
        .multipart(form)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let status = response.status();
    if status.is_success() {
        return Ok(status.as_u16());
    }
    let text = response.text().await.unwrap_or_default();
    Err(format!(
        "Discord webhook retornou {}{}",
        status.as_u16(),
        if text.trim().is_empty() {
            String::new()
        } else {
            format!(": {}", text.trim())
        }
    ))
}

fn add_json_part<T: Serialize>(
    form: Form,
    index: usize,
    name: &str,
    value: &T,
) -> Result<Form, String> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?;
    Ok(form.part(
        format!("files[{index}]"),
        Part::bytes(bytes)
            .file_name(name.to_string())
            .mime_str("application/json")
            .map_err(|error| error.to_string())?,
    ))
}

fn report_fields(payload: &Value, diagnostics: &BugReportDiagnostics) -> Vec<Value> {
    let mut fields = vec![
        json!({"name": "App", "value": &diagnostics.app_version, "inline": true}),
        json!({"name": "Platform", "value": format!("{}/{}", diagnostics.platform, diagnostics.arch), "inline": true}),
        json!({"name": "Route", "value": context_field(payload, "route"), "inline": true}),
    ];
    for (name, key) in [
        ("Steps", "stepsToReproduce"),
        ("Expected", "expectedResult"),
        ("Actual", "actualResult"),
        ("Contact", "contact"),
    ] {
        let value = string_field(payload, key);
        if !value.is_empty() {
            fields.push(json!({ "name": name, "value": truncate(&value, 1024), "inline": false }));
        }
    }
    fields
}

fn context_field(payload: &Value, key: &str) -> String {
    payload
        .get("context")
        .and_then(|context| context.get(key))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("n/a")
        .to_string()
}

fn diagnostics<R: Runtime>(app: &AppHandle<R>) -> Result<BugReportDiagnostics, String> {
    let config = build_runtime_config(app)?;
    Ok(BugReportDiagnostics {
        timestamp: chrono::Utc::now().to_rfc3339(),
        app_version: app.package_info().version.to_string(),
        platform: std::env::consts::OS.to_string(),
        release: std::env::var("OS").unwrap_or_else(|_| std::env::consts::OS.to_string()),
        arch: std::env::consts::ARCH.to_string(),
        node_version: String::new(),
        electron_version: String::new(),
        chrome_version: String::new(),
        app_packaged: !cfg!(debug_assertions),
        env_mode: if cfg!(debug_assertions) {
            "development"
        } else {
            "production"
        }
        .to_string(),
        update_channel: "stable".to_string(),
        mini_backend_running: false,
        mini_backend_runtime_line_count: 0,
        auth_api_url: config.auth_api_url,
        local_api_url: config.local_api_url,
        machine_profile_schema_version: 1,
        machine_profile: None,
        machine_profile_sync: json!({
            "lastSyncedAt": null,
            "lastChangedAt": null,
            "lastError": null,
            "profileHash": null,
            "changedFields": [],
            "lastReason": null,
        }),
    })
}

fn collect_auto_logs<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<AutoLogFile>, String> {
    let mut roots = Vec::new();
    if let Ok(dir) = app.path().app_log_dir() {
        roots.push((dir, "app"));
    }
    if let Ok(dir) = app.path().app_data_dir() {
        roots.push((dir.join("logs"), "runtime"));
    }

    let mut files = Vec::new();
    for (root, default_source) in roots {
        collect_logs_from_dir(&root, default_source, &mut files)?;
    }
    files.sort_by(|left, right| {
        modified_at(&right.path)
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .cmp(&modified_at(&left.path).unwrap_or(std::time::SystemTime::UNIX_EPOCH))
    });
    files.truncate(MAX_AUTO_LOG_FILES);
    Ok(files)
}

fn collect_logs_from_dir(
    root: &Path,
    default_source: &'static str,
    files: &mut Vec<AutoLogFile>,
) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_file() || !is_allowed_log_file(&path) {
            continue;
        }
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        if metadata.len() > MAX_AUTO_LOG_FILE_BYTES {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("log.txt")
            .to_string();
        let source = if name.to_lowercase().contains("runtime") {
            "runtime"
        } else {
            default_source
        };
        files.push(AutoLogFile {
            id: stable_hash("bug-report-log", &path.to_string_lossy()),
            name,
            size: metadata.len(),
            source,
            path,
        });
    }
    Ok(())
}

fn selected_auto_logs<R: Runtime>(
    app: &AppHandle<R>,
    auto_log_ids: Option<&Value>,
) -> Result<Vec<AutoLogFile>, String> {
    let selected = auto_log_ids
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<std::collections::HashSet<_>>()
        })
        .unwrap_or_default();
    if selected.is_empty() {
        return Ok(Vec::new());
    }
    Ok(collect_auto_logs(app)?
        .into_iter()
        .filter(|entry| selected.contains(&entry.id))
        .collect())
}

fn manual_attachments(value: Option<&Value>) -> Result<Vec<Attachment>, String> {
    let Some(items) = value.and_then(Value::as_array) else {
        return Ok(Vec::new());
    };
    if items.len() > MAX_MANUAL_ATTACHMENTS {
        return Err(format!("Maximo de {MAX_MANUAL_ATTACHMENTS} anexos."));
    }
    let mut total = 0usize;
    let mut attachments = Vec::new();
    for item in items {
        let name = safe_file_name(&string_field(item, "name"));
        let mime_type = string_field(item, "mimeType");
        let content_base64 = string_field(item, "contentBase64");
        let bytes = general_purpose::STANDARD
            .decode(content_base64)
            .map_err(|_| format!("Invalid attachment: {name}"))?;
        if bytes.len() > MAX_MANUAL_FILE_BYTES {
            return Err(format!("{name} exceeds 8 MB."));
        }
        total += bytes.len();
        if total > MAX_TOTAL_ATTACHMENT_BYTES {
            return Err("Anexos excedem 20 MB no total.".to_string());
        }
        attachments.push(Attachment {
            name,
            mime_type: if mime_type.is_empty() {
                "application/octet-stream".to_string()
            } else {
                mime_type
            },
            bytes,
        });
    }
    Ok(attachments)
}

fn decode_data_url(value: &str) -> Result<DecodedDataUrl, String> {
    let (metadata, base64_payload) = value
        .split_once(',')
        .ok_or_else(|| "Screenshot invalida.".to_string())?;
    if !metadata.starts_with("data:image/") || !metadata.contains(";base64") {
        return Err("The screenshot must be a base64 image data URL.".to_string());
    }
    let mime_type = metadata
        .trim_start_matches("data:")
        .split(';')
        .next()
        .unwrap_or("image/png")
        .to_string();
    let bytes = general_purpose::STANDARD
        .decode(base64_payload)
        .map_err(|_| "Screenshot base64 invalida.".to_string())?;
    Ok(DecodedDataUrl {
        mime_type,
        base64_payload: base64_payload.to_string(),
        bytes,
    })
}

fn capture_screen_data_url() -> Result<Option<String>, String> {
    let Some(png_bytes) = capture_screen_png()? else {
        return Ok(None);
    };
    let encoded = general_purpose::STANDARD.encode(png_bytes);
    Ok(Some(format!("data:image/png;base64,{encoded}")))
}

#[cfg(not(windows))]
fn capture_screen_png() -> Result<Option<Vec<u8>>, String> {
    Ok(None)
}

#[cfg(windows)]
fn capture_screen_png() -> Result<Option<Vec<u8>>, String> {
    use windows_sys::Win32::{
        Foundation::HWND,
        Graphics::Gdi::{
            BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
            GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT,
            DIB_RGB_COLORS, HGDIOBJ, RGBQUAD, SRCCOPY,
        },
        UI::WindowsAndMessaging::{
            GetSystemMetrics, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
            SM_YVIRTUALSCREEN,
        },
    };

    unsafe {
        let left = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let top = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        if width <= 0 || height <= 0 {
            return Ok(None);
        }

        let hwnd: HWND = std::ptr::null_mut();
        let screen_dc = GetDC(hwnd);
        if screen_dc.is_null() {
            return Err("Failed to access the screen context.".to_string());
        }
        let memory_dc = CreateCompatibleDC(screen_dc);
        if memory_dc.is_null() {
            ReleaseDC(hwnd, screen_dc);
            return Err("Failed to create the capture context.".to_string());
        }
        let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
        if bitmap.is_null() {
            DeleteDC(memory_dc);
            ReleaseDC(hwnd, screen_dc);
            return Err("Failed to create the capture bitmap.".to_string());
        }

        let old = SelectObject(memory_dc, bitmap as HGDIOBJ);
        let copied = BitBlt(
            memory_dc,
            0,
            0,
            width,
            height,
            screen_dc,
            left,
            top,
            SRCCOPY | CAPTUREBLT,
        );
        if copied == 0 {
            SelectObject(memory_dc, old);
            DeleteObject(bitmap as HGDIOBJ);
            DeleteDC(memory_dc);
            ReleaseDC(hwnd, screen_dc);
            return Err("Failed to copy pixels from the screen.".to_string());
        }

        let mut info = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: width,
                biHeight: -height,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB,
                biSizeImage: (width * height * 4) as u32,
                biXPelsPerMeter: 0,
                biYPelsPerMeter: 0,
                biClrUsed: 0,
                biClrImportant: 0,
            },
            bmiColors: [RGBQUAD::default()],
        };
        let mut bgra = vec![0u8; width as usize * height as usize * 4];
        let rows = GetDIBits(
            memory_dc,
            bitmap,
            0,
            height as u32,
            bgra.as_mut_ptr().cast(),
            &mut info,
            DIB_RGB_COLORS,
        );

        SelectObject(memory_dc, old);
        DeleteObject(bitmap as HGDIOBJ);
        DeleteDC(memory_dc);
        ReleaseDC(hwnd, screen_dc);

        if rows == 0 {
            return Err("Failed to read pixels from the screen.".to_string());
        }
        let mut rgba = Vec::with_capacity(bgra.len());
        for pixel in bgra.chunks_exact(4) {
            rgba.extend_from_slice(&[pixel[2], pixel[1], pixel[0], 255]);
        }
        encode_png(width as u32, height as u32, &rgba).map(Some)
    }
}

fn encode_png(width: u32, height: u32, rgba: &[u8]) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    let mut encoder = png::Encoder::new(Cursor::new(&mut bytes), width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header().map_err(|error| error.to_string())?;
    writer
        .write_image_data(rgba)
        .map_err(|error| error.to_string())?;
    drop(writer);
    Ok(bytes)
}

fn normalize_discord_webhook_url(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.starts_with("https://discord.com/api/webhooks/")
        || trimmed.starts_with("https://discordapp.com/api/webhooks/")
    {
        Some(trimmed.to_string())
    } else {
        None
    }
}

fn bug_report_configured<R: Runtime>(app: &AppHandle<R>) -> Result<bool, String> {
    Ok(normalize_discord_webhook_url(
        resolve_desktop_env_value(app, DISCORD_WEBHOOK_ENV)?.as_deref(),
    )
    .is_some()
        && non_empty(
            resolve_desktop_env_value(app, IMGUR_CLIENT_ID_ENV)?
                .as_deref()
                .unwrap_or_default(),
        )
        .is_some())
}

fn normalize_severity(value: &str) -> &'static str {
    match value {
        "low" => "low",
        "high" => "high",
        "critical" => "critical",
        _ => "medium",
    }
}

fn severity_color(value: &str) -> u32 {
    match value {
        "low" => 0x2ecc71,
        "high" => 0xf39c12,
        "critical" => 0xe74c3c,
        _ => 0x3498db,
    }
}

fn report_error(status: u16, message: &str) -> Value {
    json!({
        "ok": false,
        "status": status,
        "error": message,
    })
}

fn api_error_message(value: &Value) -> String {
    value
        .get("data")
        .and_then(|data| data.get("error"))
        .or_else(|| value.get("error"))
        .or_else(|| value.get("message"))
        .and_then(Value::as_str)
        .unwrap_or("Remote request failed.")
        .to_string()
}

fn is_allowed_log_file(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|extension| ALLOWED_LOG_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn modified_at(path: &Path) -> Option<std::time::SystemTime> {
    path.metadata().ok()?.modified().ok()
}

fn safe_file_name(value: &str) -> String {
    let cleaned = value
        .trim()
        .chars()
        .filter(|ch| !matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .collect::<String>();
    if cleaned.is_empty() {
        "attachment.bin".to_string()
    } else {
        cleaned.chars().take(120).collect()
    }
}

fn truncate(value: &str, max_len: usize) -> String {
    value.trim().chars().take(max_len).collect()
}

fn non_empty(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then_some(trimmed)
}


/// `desktop-api:discord-webhook:send` contract channel — posts an arbitrary
/// payload to a caller-supplied Discord webhook (URL validated).
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordWebhookSendPayload {
    pub url: String,
    pub body: Value,
}

#[derive(Serialize)]
pub struct DiscordWebhookSendResult {
    pub ok: bool,
    pub status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command(rename = "desktop-api:discord-webhook:send")]
pub async fn discord_webhook_send(
    payload: DiscordWebhookSendPayload,
) -> Result<DiscordWebhookSendResult, String> {
    let Some(webhook_url) = normalize_discord_webhook_url(Some(payload.url.as_str())) else {
        return Ok(DiscordWebhookSendResult {
            ok: false,
            status: 400,
            error: Some("Invalid Discord webhook URL.".to_string()),
        });
    };
    if !payload.body.is_object() {
        return Ok(DiscordWebhookSendResult {
            ok: false,
            status: 400,
            error: Some("Invalid webhook payload.".to_string()),
        });
    }

    let client = http_client()?;
    let response = match client.post(webhook_url).json(&payload.body).send().await {
        Ok(response) => response,
        Err(error) => {
            return Ok(DiscordWebhookSendResult {
                ok: false,
                status: 0,
                error: Some(error.to_string()),
            });
        }
    };
    let status = response.status().as_u16();
    Ok(DiscordWebhookSendResult {
        ok: response.status().is_success(),
        status,
        error: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_discord_webhook_url() {
        assert!(
            normalize_discord_webhook_url(Some("https://discord.com/api/webhooks/1/token"))
                .is_some()
        );
        assert!(normalize_discord_webhook_url(Some("https://example.com")).is_none());
    }

    #[test]
    fn decodes_image_data_url() {
        let data = general_purpose::STANDARD.encode(b"png");
        let decoded = decode_data_url(&format!("data:image/png;base64,{data}")).unwrap();
        assert_eq!(decoded.mime_type, "image/png");
        assert_eq!(decoded.bytes, b"png");
    }

    #[test]
    fn normalizes_severity_values() {
        assert_eq!(normalize_severity("critical"), "critical");
        assert_eq!(normalize_severity("nonsense"), "medium");
    }
}
