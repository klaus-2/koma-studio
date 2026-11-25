use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    time::Duration,
};

use tauri::{AppHandle, Emitter, Manager, Runtime, State, ipc::JavaScriptChannelId};

use crate::commands::desktop::build_runtime_config;

use super::launch_manifest::resolve_spawnable_runtime_binary;

mod archive;
mod install;
mod selection;
mod types;

#[cfg(test)]
mod tests;

pub(crate) use install::ensure_startup_runtime;
use install::{install_recommended_runtime, install_runtime_profile, list_runtime_artifacts};

use archive::{
    ensure_runtime_disk_space, estimate_runtime_install_required_bytes, existing_download_bytes,
    extract_runtime_archive, is_retryable_error, is_retryable_status, progress_snapshot,
    resolve_runtime_transfer_timeout, sha512_base64_file,
};
use selection::{
    ensure_manifest_schema_v2, format_runtime_fallback_reason, is_manifest_for_current_platform,
    list_artifact_options, node_arch, node_platform, normalize_profile_override,
    resolve_artifacts_url, resolve_manifest_url, runtime_install_dir, write_runtime_selection,
};
pub use selection::{resolve_runtime_profile, resolve_selected_runtime_binary_path};
use types::{
    MiniBackendRuntimeArtifactManifest, MiniBackendRuntimeArtifactOption,
    MiniBackendRuntimeArtifactPart, MiniBackendRuntimeInstallResult, MiniBackendRuntimeSelection,
    RUNTIME_DOWNLOAD_DIR, RUNTIME_DOWNLOAD_RETRY_COUNT, RUNTIME_EVENT_CHANNEL, apply_patch,
    install_result, now_millis,
};
pub use types::{
    MiniBackendRuntimePatch, MiniBackendRuntimeState, MiniBackendRuntimeStore, RuntimeError,
};

#[tauri::command(rename = "desktop:list-mini-backend-runtime-artifacts")]
pub async fn list_mini_backend_runtime_artifacts<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
) -> Result<Vec<MiniBackendRuntimeArtifactOption>, RuntimeError> {
    list_runtime_artifacts(&app, &store).await
}

#[tauri::command(rename = "desktop:install-recommended-mini-backend-runtime")]
pub async fn install_recommended_mini_backend_runtime<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
    on_progress: Option<JavaScriptChannelId>,
) -> Result<MiniBackendRuntimeInstallResult, RuntimeError> {
    let channel = on_progress.and_then(|id| {
        app.get_webview_window("main").map(|webview_window| {
            id.channel_on::<_, MiniBackendRuntimeState>(webview_window.as_ref().clone())
        })
    });
    let Some(_guard) = store.try_begin_install(channel) else {
        return Ok(MiniBackendRuntimeInstallResult {
            ok: false,
            profile: "auto".to_string(),
            reason: Some("runtime_manual_install_in_progress".to_string()),
        });
    };

    install_recommended_runtime(&app, &store).await
}

#[tauri::command(rename = "desktop:install-mini-backend-runtime-profile")]
pub async fn install_mini_backend_runtime_profile<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
    profile: String,
    on_progress: Option<JavaScriptChannelId>,
) -> Result<MiniBackendRuntimeInstallResult, RuntimeError> {
    let channel = on_progress.and_then(|id| {
        app.get_webview_window("main").map(|webview_window| {
            id.channel_on::<_, MiniBackendRuntimeState>(webview_window.as_ref().clone())
        })
    });
    let Some(_guard) = store.try_begin_install(channel) else {
        return Ok(MiniBackendRuntimeInstallResult {
            ok: false,
            profile,
            reason: Some("runtime_manual_install_in_progress".to_string()),
        });
    };

    install_runtime_profile(&app, &store, &profile).await
}

pub fn snapshot_runtime_state<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<MiniBackendRuntimeState, RuntimeError> {
    refresh_runtime_context(app, store)?;
    let guard = store
        .state
        .lock()
        .map_err(|_| RuntimeError::StatePoisoned)?;
    Ok(guard.clone())
}

pub fn patch_runtime_state<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    patch: MiniBackendRuntimePatch,
) -> Result<MiniBackendRuntimeState, RuntimeError> {
    let snapshot = {
        let mut guard = store
            .state
            .lock()
            .map_err(|_| RuntimeError::StatePoisoned)?;
        apply_patch(&mut guard, patch);
        guard.updated_at = Some(now_millis());
        guard.clone()
    };
    let channel = store
        .progress_channel
        .lock()
        .ok()
        .and_then(|guard| guard.clone());
    if let Some(channel) = channel {
        if let Err(error) = channel.send(snapshot.clone()) {
            tracing::warn!(
                error = %error,
                "runtime install progress receiver disconnected"
            );
        }
    }
    let _ = app.emit_to("main", RUNTIME_EVENT_CHANNEL, snapshot.clone());
    Ok(snapshot)
}

pub async fn sync_runtime_state_from_api<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<(), RuntimeError> {
    let config = build_runtime_config(app);
    let endpoint = format!("{}/device/info", config.local_api_url.trim_end_matches('/'));
    let response = match crate::sidecar::mini_backend::with_local_api_session(
        app,
        reqwest::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()?
            .get(endpoint),
    )
    .send()
    .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => return Ok(()),
    };

    let payload: serde_json::Value = response.json().await?;
    let requested = normalize_profile_override(
        payload
            .get("profile")
            .and_then(|value| value.as_str())
            .map(ToOwned::to_owned),
    );
    let current = snapshot_runtime_state(app, store)?;
    let requested_profile = if requested == "auto" {
        current.requested_profile
    } else {
        requested
    };
    let active_override = normalize_profile_override(
        payload
            .get("active_profile")
            .and_then(|value| value.as_str())
            .map(ToOwned::to_owned),
    );
    let active_profile = if active_override == "auto" {
        requested_profile.clone()
    } else {
        active_override
    };
    let fallback_reason = format_runtime_fallback_reason(
        payload
            .get("fallback_reason")
            .and_then(|value| value.as_str()),
    );

    patch_runtime_state(
        app,
        store,
        MiniBackendRuntimePatch {
            requested_profile: Some(requested_profile),
            active_profile: Some(active_profile),
            last_error: Some(fallback_reason.clone()),
            gpu_name: Some(
                payload
                    .get("name")
                    .and_then(|value| value.as_str())
                    .filter(|value| !value.trim().is_empty())
                    .map(|value| value.trim().to_string()),
            ),
            vram_gb: Some(payload.get("vram_gb").and_then(|value| value.as_f64())),
            status: Some(if fallback_reason.is_some() {
                "fallback".to_string()
            } else {
                "ready".to_string()
            }),
            status_message: Some(fallback_reason),
            ..Default::default()
        },
    )?;
    Ok(())
}

fn refresh_runtime_context<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<(), RuntimeError> {
    let runtime_artifacts_url = resolve_artifacts_url(app)?;
    let download_cache_dir = Some(
        env::temp_dir()
            .join(RUNTIME_DOWNLOAD_DIR)
            .to_string_lossy()
            .to_string(),
    );
    let mut guard = store
        .state
        .lock()
        .map_err(|_| RuntimeError::StatePoisoned)?;
    guard.runtime_artifacts_url = runtime_artifacts_url;
    guard.download_cache_dir = download_cache_dir;
    Ok(())
}

fn set_manual_install_blocked<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    reason: &str,
    requested_profile: &str,
) -> Result<(), RuntimeError> {
    let snapshot = snapshot_runtime_state(app, store)?;
    let message = if reason == "cpu-not-required" {
        "This device does not need a downloadable GPU runtime profile."
    } else {
        "Manual runtime artifact install is only available in the packaged app."
    };
    patch_runtime_state(
        app,
        store,
        MiniBackendRuntimePatch {
            status: Some("ready".to_string()),
            status_message: Some(Some(message.to_string())),
            requested_profile: Some(requested_profile.to_string()),
            active_profile: Some(snapshot.active_profile),
            source: Some(snapshot.source),
            last_error: Some(None),
            attempt: Some(0),
            max_attempts: Some(0),
            progress: Some(None),
            ..Default::default()
        },
    )?;
    Ok(())
}
