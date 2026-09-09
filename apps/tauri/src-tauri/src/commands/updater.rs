use std::sync::Mutex;

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Runtime, State};

use crate::updater::{incremental, manifest::IncrementalUpdateManifest};

#[derive(Debug, Default)]
pub struct DesktopUpdaterStore {
    inner: Mutex<DesktopUpdaterInner>,
}

#[derive(Debug)]
struct DesktopUpdaterInner {
    state: UpdaterStatusPayload,
    incremental_manifest: Option<IncrementalUpdateManifest>,
    incremental_public_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterProgressPayload {
    percent: f64,
    transferred: u64,
    total: u64,
    speed: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterStatusPayload {
    status: String,
    current_version: String,
    new_version: Option<String>,
    mandatory: bool,
    blocking: bool,
    blocking_reason: Option<String>,
    release_notes: Option<String>,
    channel: String,
    provider: String,
    auto_install_on_quit: bool,
    allow_prerelease: bool,
    progress: Option<UpdaterProgressPayload>,
    checked_at: Option<i64>,
    downloaded_at: Option<i64>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UpdaterEventPayload {
    event: String,
    state: UpdaterStatusPayload,
}

impl Default for DesktopUpdaterInner {
    fn default() -> Self {
        Self {
            state: UpdaterStatusPayload::new("unknown"),
            incremental_manifest: None,
            incremental_public_key: None,
        }
    }
}

impl UpdaterStatusPayload {
    fn new(current_version: &str) -> Self {
        let channel = infer_channel_from_version(current_version);
        Self {
            status: "idle".to_string(),
            current_version: current_version.to_string(),
            new_version: None,
            mandatory: false,
            blocking: false,
            blocking_reason: None,
            release_notes: None,
            channel: channel.to_string(),
            provider: "generic".to_string(),
            auto_install_on_quit: false,
            allow_prerelease: channel == "beta",
            progress: None,
            checked_at: None,
            downloaded_at: None,
            error: None,
        }
    }
}

#[tauri::command(rename = "updater:get-status")]
pub fn get_status<R: Runtime>(
    app: AppHandle<R>,
    store: State<DesktopUpdaterStore>,
) -> Result<UpdaterStatusPayload, String> {
    with_state(&app, &store, None, |state| {
        let current_version = app.package_info().version.to_string();
        state.current_version = current_version.clone();
        if state.checked_at.is_none()
            && state.downloaded_at.is_none()
            && state.new_version.is_none()
        {
            apply_channel(state, infer_channel_from_version(&current_version));
        }
    })
}

#[tauri::command(rename = "updater_check")]
pub async fn updater_check<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopUpdaterStore>,
    manifest_url: Option<String>,
    payload: Option<Value>,
) -> Result<UpdaterStatusPayload, String> {
    with_state(&app, &store, Some("checking"), |state| {
        state.status = "checking".to_string();
        state.current_version = app.package_info().version.to_string();
        state.provider = "generic".to_string();
        state.progress = None;
        state.error = None;
    })?;

    let request = incremental::request_from_parts(manifest_url, payload);
    let incremental_public_key = request.public_key.clone();
    match incremental::check(&app, request).await {
        Ok((manifest, report)) => {
            {
                let mut inner = store.inner.lock().map_err(|error| error.to_string())?;
                inner.incremental_manifest = Some(manifest);
                inner.incremental_public_key = incremental_public_key;
            }
            with_state(
                &app,
                &store,
                Some(if report.available {
                    "available"
                } else {
                    "not-available"
                }),
                |state| {
                    state.status = if report.available {
                        "available".to_string()
                    } else {
                        "not-available".to_string()
                    };
                    state.current_version = report.current_version;
                    state.new_version = report.available.then_some(report.manifest_version);
                    state.provider = "generic".to_string();
                    state.release_notes = Some(format!(
                        "Manifest incremental validado: {} chunks, {} ausentes, {} deltas binarios.",
                        report.chunk_count, report.missing_chunk_count, report.binary_delta_count
                    ));
                    state.checked_at = Some(now_millis());
                    state.downloaded_at = None;
                    state.progress = None;
                    state.error = None;
                },
            )
        }
        Err(error) if error.contains("KOMA_UPDATE_MANIFEST_URL") => {
            with_state(&app, &store, Some("not-available"), |state| {
                state.status = "not-available".to_string();
                state.current_version = app.package_info().version.to_string();
                state.new_version = None;
                state.provider = "generic".to_string();
                state.release_notes = None;
                state.checked_at = Some(now_millis());
                state.progress = None;
                state.error = None;
            })
        }
        Err(error) => set_error(&app, &store, error),
    }
}

#[tauri::command(rename = "updater_download_incremental")]
pub async fn updater_download_incremental<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopUpdaterStore>,
    manifest_url: Option<String>,
    payload: Option<Value>,
) -> Result<UpdaterStatusPayload, String> {
    let request = incremental::request_from_parts(manifest_url, payload);
    let (manifest, public_key) = {
        let inner = store.inner.lock().map_err(|error| error.to_string())?;
        (
            inner.incremental_manifest.clone(),
            inner.incremental_public_key.clone(),
        )
    };
    let public_key = public_key.or_else(|| request.public_key.clone());
    let manifest = match manifest {
        Some(manifest) => manifest,
        None => {
            let (manifest, _) = incremental::check(&app, request.clone()).await?;
            let mut inner = store.inner.lock().map_err(|error| error.to_string())?;
            inner.incremental_manifest = Some(manifest.clone());
            inner.incremental_public_key = request.public_key.clone();
            manifest
        }
    };

    with_state(&app, &store, Some("progress"), |state| {
        state.status = "downloading".to_string();
        state.new_version = Some(manifest.version.clone());
        state.provider = "generic".to_string();
        state.progress = Some(UpdaterProgressPayload {
            percent: 0.0,
            transferred: 0,
            total: manifest.chunks.values().map(|chunk| chunk.size).sum(),
            speed: 0.0,
        });
        state.error = None;
    })?;

    match incremental::download(&app, &manifest, public_key.as_deref()).await {
        Ok(report) => with_state(&app, &store, Some("downloaded"), |state| {
            state.status = "downloaded".to_string();
            state.new_version = Some(report.manifest_version);
            state.downloaded_at = Some(now_millis());
            state.progress = Some(UpdaterProgressPayload {
                percent: 100.0,
                transferred: report.bytes_downloaded + report.binary_delta_bytes,
                total: report.bytes_downloaded + report.binary_delta_bytes,
                speed: 0.0,
            });
            state.release_notes = Some(format!(
                "Download incremental preparado: {} chunks baixados, {} reutilizados, {} deltas binarios.",
                report.downloaded_chunks, report.reused_chunks, report.downloaded_binary_deltas
            ));
            state.error = None;
        }),
        Err(error) => set_error(&app, &store, error),
    }
}

#[tauri::command(rename = "updater_apply")]
pub fn updater_apply<R: Runtime>(
    app: AppHandle<R>,
    store: State<DesktopUpdaterStore>,
) -> Result<UpdaterStatusPayload, String> {
    match incremental::apply(&app) {
        Ok(report) => with_state(&app, &store, Some("downloaded"), |state| {
            state.status = "downloaded".to_string();
            state.current_version = report.active_version.clone();
            state.new_version = Some(report.active_version);
            state.release_notes = Some(format!(
                "Manifest incremental aplicado; {} webviews recarregadas.",
                report.reloaded_webviews
            ));
            state.error = None;
        }),
        Err(error) => set_error(&app, &store, error),
    }
}

#[tauri::command(rename = "updater_rollback")]
pub fn updater_rollback<R: Runtime>(
    app: AppHandle<R>,
    store: State<DesktopUpdaterStore>,
) -> Result<UpdaterStatusPayload, String> {
    match incremental::rollback(&app) {
        Ok(report) => with_state(&app, &store, Some("status"), |state| {
            state.status = "idle".to_string();
            state.current_version = report.active_version.clone();
            state.new_version = None;
            state.release_notes = Some(format!(
                "Rollback incremental aplicado; {} webviews recarregadas.",
                report.reloaded_webviews
            ));
            state.progress = None;
            state.error = None;
        }),
        Err(error) => set_error(&app, &store, error),
    }
}

#[tauri::command(rename = "updater_postpone")]
pub fn updater_postpone<R: Runtime>(
    app: AppHandle<R>,
    store: State<DesktopUpdaterStore>,
) -> Result<UpdaterStatusPayload, String> {
    with_state(&app, &store, Some("status"), |state| {
        state.blocking = false;
        state.blocking_reason = None;
        state.error = None;
    })
}

#[tauri::command(rename = "updater:set-channel")]
pub fn set_channel<R: Runtime>(
    app: AppHandle<R>,
    store: State<DesktopUpdaterStore>,
    channel: Option<String>,
    payload: Option<Value>,
) -> Result<UpdaterStatusPayload, String> {
    let channel = normalize_channel(
        channel
            .as_deref()
            .or_else(|| payload.as_ref().and_then(Value::as_str))
            .or_else(|| {
                payload
                    .as_ref()
                    .and_then(|value| value.get("channel"))
                    .and_then(Value::as_str)
            })
            .unwrap_or("stable"),
    );
    with_state(&app, &store, Some("status"), |state| {
        apply_channel(state, channel);
        state.error = None;
    })
}

#[tauri::command(rename = "updater:set-auto-install")]
pub fn set_auto_install<R: Runtime>(
    app: AppHandle<R>,
    store: State<DesktopUpdaterStore>,
    enabled: Option<bool>,
    payload: Option<Value>,
) -> Result<UpdaterStatusPayload, String> {
    let enabled = enabled
        .or_else(|| payload.as_ref().and_then(Value::as_bool))
        .or_else(|| {
            payload
                .as_ref()
                .and_then(|value| value.get("enabled"))
                .and_then(Value::as_bool)
        })
        .unwrap_or(false);
    with_state(&app, &store, Some("status"), |state| {
        state.auto_install_on_quit = enabled;
        state.error = None;
    })
}

fn with_state<R: Runtime>(
    app: &AppHandle<R>,
    store: &DesktopUpdaterStore,
    event: Option<&str>,
    mutate: impl FnOnce(&mut UpdaterStatusPayload),
) -> Result<UpdaterStatusPayload, String> {
    let state = {
        let mut inner = store.inner.lock().map_err(|error| error.to_string())?;
        mutate(&mut inner.state);
        inner.state.clone()
    };
    if let Some(event) = event {
        emit_event(app, event, &state);
    }
    Ok(state)
}

fn set_error<R: Runtime>(
    app: &AppHandle<R>,
    store: &DesktopUpdaterStore,
    error: String,
) -> Result<UpdaterStatusPayload, String> {
    with_state(app, store, Some("error"), |state| {
        state.status = "error".to_string();
        state.error = Some(error);
        state.progress = None;
    })
}

fn emit_event<R: Runtime>(app: &AppHandle<R>, event: &str, state: &UpdaterStatusPayload) {
    let _ = app.emit(
        "updater:event",
        UpdaterEventPayload {
            event: event.to_string(),
            state: state.clone(),
        },
    );
}

fn normalize_channel(value: &str) -> &'static str {
    match value {
        "beta" => "beta",
        _ => "stable",
    }
}

fn infer_channel_from_version(version: &str) -> &'static str {
    if version.contains('-') {
        "beta"
    } else {
        "stable"
    }
}

fn apply_channel(state: &mut UpdaterStatusPayload, channel: &str) {
    state.channel = normalize_channel(channel).to_string();
    state.allow_prerelease = state.channel == "beta";
}

fn now_millis() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_to_stable_channel() {
        assert_eq!(normalize_channel("beta"), "beta");
        assert_eq!(normalize_channel("canary"), "stable");
        assert_eq!(normalize_channel(""), "stable");
    }

    #[test]
    fn default_status_matches_shared_contract() {
        let state = UpdaterStatusPayload::new("1.0.0");
        assert_eq!(state.status, "idle");
        assert_eq!(state.current_version, "1.0.0");
        assert_eq!(state.channel, "stable");
        assert_eq!(state.provider, "generic");
        assert!(!state.allow_prerelease);
        assert!(!state.blocking);
    }

    #[test]
    fn prerelease_status_defaults_to_beta_channel() {
        let state = UpdaterStatusPayload::new("2.0.0-alpha.0");
        assert_eq!(state.channel, "beta");
        assert!(state.allow_prerelease);
    }
}
