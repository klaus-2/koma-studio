//! Font commands. The import contract carries base64 bytes (decoded to a temp
//! write so the content signature can be validated); uninstall still targets
//! legacy file names or families. Font bytes are served to the webview via
//! `koma-font://` — no data URLs cross the IPC boundary.

use base64::{engine::general_purpose, Engine as _};
use serde_json::Value;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

use crate::{
    error::{AppError, CommandResult},
    models::fonts::{
        FontEntry, FontInstallProgress, FontInstallResult, FontListResult, FontSource,
        FontUninstallResult,
    },
    protocol::media::media_url,
    services::fonts::{self, FONT_EXTENSIONS, ProgressObserver},
    state::api::ApiRuntimeState,
};

const DEFAULT_SYSTEM_FONTS: &[&str] = &[
    "Arial",
    "Calibri",
    "Comic Sans MS",
    "Georgia",
    "Segoe UI",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana",
];

struct ThrottledFontProgress {
    channel: tauri::ipc::Channel<FontInstallProgress>,
    last_emit_ms: std::sync::atomic::AtomicU64,
}

impl ThrottledFontProgress {
    fn emit(&self, progress: FontInstallProgress) {
        use std::sync::atomic::Ordering;

        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);

        let previous = self.last_emit_ms.load(Ordering::Relaxed);
        let complete = progress.transferred >= progress.total;

        if !complete && now.saturating_sub(previous) < 50 {
            return;
        }

        self.last_emit_ms.store(now, Ordering::Relaxed);
        if let Err(error) = self.channel.send(progress) {
            tracing::warn!(error = %error, "font progress receiver disconnected");
        }
    }
}

fn media_entry(
    id: Option<fonts::InstalledFont>,
    family: String,
) -> FontEntry {
    match id {
        Some(installed) => FontEntry {
            id: Some(installed.id),
            family: installed.family,
            source: FontSource::Custom,
            file_name: Some(installed.file_name),
            media_url: Some(media_url(
                crate::protocol::media::FONT_SCHEME,
                &installed.path,
            )),
        },
        None => FontEntry {
            id: None,
            family,
            source: FontSource::Custom,
            file_name: None,
            media_url: None,
        },
    }
}

#[tauri::command(rename = "desktop-api:fonts:list")]
pub async fn fonts_list(
    app: AppHandle,
    state: State<'_, ApiRuntimeState>,
) -> CommandResult<FontListResult> {
    let _permit = state.fonts_permit().await?;
    let worker_app = app.clone();

    let custom = tauri::async_runtime::spawn_blocking(move || fonts::list(&worker_app)).await??;

    let mut system: Vec<String> = DEFAULT_SYSTEM_FONTS
        .iter()
        .map(|font| (*font).to_string())
        .collect();
    system.sort_by_key(|font| font.to_ascii_lowercase());

    Ok(FontListResult {
        system,
        custom: custom
            .into_iter()
            .map(|font| FontEntry {
                id: Some(font.id),
                family: font.family,
                source: FontSource::Custom,
                file_name: Some(font.file_name),
                media_url: Some(media_url(
                    crate::protocol::media::FONT_SCHEME,
                    &font.path,
                )),
            })
            .collect(),
    })
}

#[tauri::command(rename = "desktop-api:fonts:import")]
pub async fn fonts_import(
    app: AppHandle,
    state: State<'_, ApiRuntimeState>,
    payload: Value,
    on_progress: Option<tauri::ipc::JavaScriptChannelId>,
) -> CommandResult<FontInstallResult> {
    fonts_install(app, state, payload, on_progress).await
}

/// Legacy contract: base64 bytes + optional family. The bytes are decoded and
/// installed through the validating service (extension/signature checks run on
/// the decoded content).
#[tauri::command(rename = "desktop-api:fonts:install")]
pub async fn fonts_install(
    app: AppHandle,
    state: State<'_, ApiRuntimeState>,
    payload: Value,
    on_progress: Option<tauri::ipc::JavaScriptChannelId>,
) -> CommandResult<FontInstallResult> {
    let _permit = state.fonts_permit().await?;

    let file_name = payload
        .get("fileName")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let content_base64 = payload
        .get("contentBase64")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let family = payload
        .get("family")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);

    if file_name.is_empty() || content_base64.is_empty() {
        return Err(AppError::invalid_input("Invalid font payload.").into());
    }

    let bytes = general_purpose::STANDARD
        .decode(content_base64.as_bytes())
        .or_else(|_| general_purpose::URL_SAFE.decode(content_base64.as_bytes()))
        .map_err(|_| AppError::invalid_input("Invalid font content."))?;

    let observer = progress_observer(&app, on_progress);
    let worker_app = app.clone();

    let installed = tauri::async_runtime::spawn_blocking(move || {
        fonts::install_bytes(
            &worker_app,
            &file_name,
            &bytes,
            family.as_deref(),
            observer.clone(),
        )
    })
    .await??;

    Ok(FontInstallResult {
        cancelled: false,
        entry: Some(FontEntry {
            id: Some(installed.id),
            family: installed.family,
            source: FontSource::Custom,
            file_name: Some(installed.file_name),
            media_url: Some(media_url(
                crate::protocol::media::FONT_SCHEME,
                &installed.path,
            )),
        }),
    })
}

#[tauri::command(rename = "desktop-api:fonts:uninstall")]
pub async fn fonts_uninstall(
    app: AppHandle,
    state: State<'_, ApiRuntimeState>,
    payload: Value,
) -> CommandResult<FontUninstallResult> {
    let _permit = state.fonts_permit().await?;
    let file_name = payload
        .get("fileName")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let family = payload
        .get("family")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if file_name.is_empty() && family.is_empty() {
        return Err(AppError::invalid_input("Fonte custom ausente.").into());
    }

    let worker_app = app.clone();
    let removed = tauri::async_runtime::spawn_blocking(move || {
        fonts::uninstall_by_selector(&worker_app, &file_name, &family)
    })
    .await??;

    Ok(FontUninstallResult { removed })
}

/// Native dialog install path (the batch's forward contract; unused while the
/// frontend sends base64 — registered for parity with the batch).
#[allow(dead_code)]
async fn install_from_dialog(
    app: AppHandle,
    state: State<'_, ApiRuntimeState>,
    on_progress: Option<tauri::ipc::JavaScriptChannelId>,
) -> CommandResult<FontInstallResult> {
    let _permit = state.fonts_permit().await?;
    let dialog_app = app.clone();

    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Importar fonte")
            .add_filter("Fontes", FONT_EXTENSIONS)
            .blocking_pick_file()
    })
    .await?;

    let Some(selected) = selected else {
        return Ok(FontInstallResult {
            cancelled: true,
            entry: None,
        });
    };

    let source_path: std::path::PathBuf = selected
        .into_path()
        .map_err(|_| AppError::invalid_path("Invalid selected font path."))?;
    let observer = progress_observer(&app, on_progress);
    let worker_app = app.clone();

    let installed = tauri::async_runtime::spawn_blocking(move || {
        fonts::install_from_path(&worker_app, &source_path, None, observer.clone())
    })
    .await??;

    let entry = media_entry(Some(installed.clone()), installed.family.clone());
    Ok(FontInstallResult {
        cancelled: false,
        entry: Some(entry),
    })
}

fn progress_observer(
    app: &AppHandle,
    channel: Option<tauri::ipc::JavaScriptChannelId>,
) -> Option<ProgressObserver> {
    let channel = channel.and_then(|id| {
        app.get_webview_window("main")
            .map(|webview_window| id.channel_on::<_, FontInstallProgress>(webview_window.as_ref().clone()))
    });
    channel.map(|channel| {
        let progress = std::sync::Arc::new(ThrottledFontProgress {
            channel,
            last_emit_ms: std::sync::atomic::AtomicU64::new(0),
        });

        std::sync::Arc::new(move |payload| progress.emit(payload)) as ProgressObserver
    })
}
