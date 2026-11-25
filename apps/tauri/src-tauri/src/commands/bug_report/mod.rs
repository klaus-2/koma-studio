use std::{sync::OnceLock, time::Duration};

use tauri::{AppHandle, Runtime};

use crate::commands::desktop::{
    DESKTOP_UPDATE_CHANNEL, build_runtime_config, check_local_backend_health,
};

mod logs;
mod screenshot;
mod types;
mod validation;
mod webhook;

pub use types::{
    BugReportAutoLogEntry, BugReportDiagnostics, BugReportPrepareResponse, BugReportSubmitPayload,
    BugReportSubmitResponse, DiscordWebhookSendPayload, DiscordWebhookSendResult,
};

use logs::collect_auto_logs;
use screenshot::capture_screen_data_url;
use types::{BACKEND_PROBE_TIMEOUT, BugReportError, ENDPOINT_INVALID_MESSAGE};
use validation::{is_allowed_bug_report_endpoint, map_bug_report_response, prepare_submission};

#[tauri::command(rename = "desktop-api:bug-report:prepare")]
pub async fn prepare<R: Runtime>(app: AppHandle<R>) -> Result<BugReportPrepareResponse, String> {
    let diagnostics = diagnostics(&app).await?;

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

#[tauri::command(rename = "desktop-api:discord-webhook:send")]
pub async fn discord_webhook_send(
    payload: DiscordWebhookSendPayload,
) -> Result<DiscordWebhookSendResult, String> {
    webhook::send_discord_webhook(payload).await
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

    let client =
        bug_report_http_client().map_err(|error| BugReportError::Internal(error.to_string()))?;
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

#[cfg(test)]
use crate::commands::api::client::stable_hash;
#[cfg(test)]
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
#[cfg(test)]
use logs::{build_log_entries, collect_logs_from_dir, tail_truncate_lossy};
#[cfg(test)]
use screenshot::encode_png;
#[cfg(test)]
use std::{fs, path::Path, time::SystemTime};
#[cfg(test)]
use types::{
    AutoLogFile, BUG_REPORT_SCHEMA, BugReportApiAttachment, BugReportApiPayload,
    BugReportClientInfo, BugReportLogEntry, DEFAULT_ATTACHMENT_NAME, LogSource,
    MAX_DESCRIPTION_CHARS, MAX_FILE_NAME_CHARS, MAX_MANUAL_ATTACHMENTS, MAX_SCREENSHOT_BYTES,
    ManualAttachmentInput, RawImage,
};
#[cfg(test)]
use validation::{
    assemble_description, enforce_wire_budget, largest_attachment_index,
    normalize_discord_webhook_url, prepare_payload_parts, safe_file_name,
    validate_manual_attachments, validate_screenshot_data_url,
};

#[cfg(test)]
#[path = "../bug_report_tests.rs"]
mod tests;
