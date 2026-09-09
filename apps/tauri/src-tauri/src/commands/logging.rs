use serde::Deserialize;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLogPayload {
    #[serde(default)]
    level: String,
    #[serde(default)]
    source: String,
    #[serde(default)]
    message: String,
}

#[tauri::command(rename = "desktop:session-log")]
pub fn session_log<R: Runtime>(
    app: AppHandle<R>,
    payload: SessionLogPayload,
) -> Result<(), String> {
    let message = payload.message.trim();
    if message.is_empty() {
        return Ok(());
    }

    let source = normalize_source(&payload.source);
    let rendered = format!("[{source}] {message}");
    match normalize_level(&payload.level) {
        "error" => log::error!("{rendered}"),
        "warn" => log::warn!("{rendered}"),
        "info" => log::info!("{rendered}"),
        "debug" => log::debug!("{rendered}"),
        _ => log::trace!("{rendered}"),
    }
    append_session_log(&app, normalize_level(&payload.level), source, message)
}

pub fn normalize_level(level: &str) -> &'static str {
    match level.trim().to_ascii_lowercase().as_str() {
        "error" => "error",
        "warn" | "warning" => "warn",
        "info" => "info",
        "debug" => "debug",
        _ => "log",
    }
}

pub fn normalize_source(source: &str) -> &'static str {
    if source.trim().eq_ignore_ascii_case("main") {
        "main"
    } else {
        "renderer"
    }
}

fn append_session_log<R: Runtime>(
    app: &AppHandle<R>,
    level: &str,
    source: &str,
    message: &str,
) -> Result<(), String> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())?;
    std::fs::create_dir_all(&log_dir).map_err(|error| error.to_string())?;
    let timestamp = chrono::Utc::now().to_rfc3339();
    let line = format!("{timestamp} [{level}] [{source}] {message}\n");
    std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("desktop-session.log"))
        .and_then(|mut file| {
            use std::io::Write;
            file.write_all(line.as_bytes())
        })
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_renderer_log_defaults() {
        assert_eq!(normalize_level("warning"), "warn");
        assert_eq!(normalize_level("verbose"), "log");
        assert_eq!(normalize_source("renderer"), "renderer");
        assert_eq!(normalize_source("unknown"), "renderer");
        assert_eq!(normalize_source("main"), "main");
    }
}
