//! Desktop-level IPC adapters: runtime configuration discovery, locale
//! preferences, local settings reset, application restart, local backend
//! health probing and hardened external URL opening.
//!
//! Configuration is resolved exactly once per process into a shared
//! [`OnceLock`] cell (see [`resolved_desktop_config`]) and every command
//! afterwards pays only a pointer clone. Only public configuration keys may
//! be resolved; secrets cannot pass through this layer at all.

use std::sync::atomic::{AtomicU64, Ordering};
use std::{collections::HashSet, path::Path, time::Duration};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, State};
use thiserror::Error;
use url::Url;

use crate::runtime::profiles::{
    snapshot_runtime_state, MiniBackendRuntimeState as RuntimeMiniBackendRuntimeState,
    MiniBackendRuntimeStore,
};

mod config_sources;
mod env_document;
mod infrastructure;
mod locale;
mod paths;
mod resolved_config;
mod runtime_artifacts_url;
mod url_validation;

pub(crate) mod updater;

pub(crate) use config_sources::DESKTOP_UPDATE_CHANNEL;
use infrastructure::{app_user_data_dir, loopback_http_client, open_url, run_blocking};
use locale::normalize_locale_tag;
use paths::remove_path_if_present;
use resolved_config::resolved_desktop_config;
use url_validation::{host_matches_suffix, normalize_host, parse_https_url, parse_loopback_url};

const DEFAULT_AUTH_API_URL: &str = "http://127.0.0.1:3001";
const DEFAULT_LOCAL_API_URL: &str = "http://127.0.0.1:8001";
const DEFAULT_APP_LOCALE: &str = "pt-BR";

const DESKTOP_FETCH_TIMEOUT: Duration = Duration::from_secs(12);
const DESKTOP_CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const DESKTOP_FETCH_RETRY_COUNT: usize = 1;
const DESKTOP_FETCH_RETRY_DELAY: Duration = Duration::from_millis(150);
const RESTART_GRACE_PERIOD: Duration = Duration::from_millis(50);

const IDENTITY_CACHE_FILE: &str = "desktop-identity-cache.json";
const RUNTIME_SELECTION_FILE: &str = "mini-backend-runtime-selection.json";
const SECURE_STORE_DIR: &str = "secure-store";
const LOCAL_SETTINGS_ENTRIES: [&str; 4] = [
    SECURE_STORE_DIR,
    IDENTITY_CACHE_FILE,
    RUNTIME_SELECTION_FILE,
    crate::sidecar::mini_backend::MINI_BACKEND_THREAD_OVERRIDE_FILE,
];

const RUNTIME_CONFIG_FILE: &str = "runtime-config.json";
/// Legacy output directory kept for backwards compatibility with existing
/// packaging scripts that still emit the runtime config under this folder.
const LEGACY_RUNTIME_CONFIG_DIR: &str = "dist-electron";

const CURRENT_DIR_ANCESTOR_DEPTH: usize = 6;
const EXE_DIR_ANCESTOR_DEPTH: usize = 8;
const RESOURCE_DIR_ANCESTOR_DEPTH: usize = 6;

const MAX_CONFIG_FILE_BYTES: u64 = 256 * 1024;
const MAX_URL_BYTES: usize = 8 * 1024;

/// The only configuration keys this layer will ever resolve. This is an
/// allowlist on purpose: a denylist means every new secret key needs a
/// matching entry or it leaks.
const PUBLIC_DESKTOP_CONFIG_KEYS: &[&str] = &[
    "VITE_AUTH_API_URL",
    "VITE_LOCAL_API_URL",
    "MINI_BACKEND_ARTIFACTS_URL",
    "VITE_MINI_BACKEND_ARTIFACTS_URL",
    "UPDATE_SERVER_URL",
    "VITE_UPDATE_SERVER_URL",
    "VITE_PROJECT_WEBSITE_URL",
    "VITE_PROJECT_DISCORD_URL",
    "VITE_PROJECT_BUG_URL",
];

const RUNTIME_ARTIFACTS_ENV_KEYS: [&str; 4] = [
    "MINI_BACKEND_ARTIFACTS_URL",
    "VITE_MINI_BACKEND_ARTIFACTS_URL",
    "UPDATE_SERVER_URL",
    "VITE_UPDATE_SERVER_URL",
];
const PROJECT_LINK_ENV_KEYS: [&str; 3] = [
    "VITE_PROJECT_WEBSITE_URL",
    "VITE_PROJECT_DISCORD_URL",
    "VITE_PROJECT_BUG_URL",
];

const EXTERNAL_ALLOWED_HOST_SUFFIXES: &[&str] = &[
    "github.com",
    "githubusercontent.com",
    "discord.com",
    "discord.gg",
    "koma-studio.site",
    "cloudflare.com",
    "huggingface.co",
    "openmodeldb.info",
];

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/// Structured, non-sensitive error surface: the frontend receives
/// `{"code": "snake_case"}` and never a message carrying paths or URLs.
#[derive(Debug, Clone, Copy, Error, Serialize, Deserialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum DesktopError {
    #[error("external URL is missing")]
    MissingUrl,
    #[error("external URL is invalid")]
    InvalidUrl,
    #[error("external URL exceeds the supported length")]
    UrlTooLong,
    #[error("only HTTPS links are allowed")]
    InsecureScheme,
    #[error("URLs with embedded credentials are not allowed")]
    EmbeddedCredentials,
    #[error("external URL host is not allowed")]
    HostNotAllowed,
    #[error("external URL port is not allowed")]
    PortNotAllowed,
    #[error("local backend URL must address a loopback interface")]
    InvalidLoopbackUrl,
    #[error("failed to open external URL")]
    Opener,
    #[error("failed to resolve application data directory")]
    AppDataDir,
    #[error("failed to clear local configuration")]
    ClearLocalSettings,
    #[error("background task failed")]
    TaskJoin,
    #[error("failed to obtain runtime state")]
    Runtime,
    #[error("failed to restart local backend")]
    Sidecar,
    #[error("failed to persist the mini-backend thread override")]
    ThreadOverride,
}

// ---------------------------------------------------------------------------
// IPC payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeConfig {
    pub auth_api_url: String,
    pub local_api_url: String,
    pub runtime_artifacts_url: String,
    pub app_packaged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalePreferences {
    pub app_locale: String,
    pub system_locales: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResetLocalSettingsResult {
    pub cleared: bool,
    pub user_data_path: String,
    pub cleared_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RestartAppResult {
    pub restarting: bool,
}

/// Wire payload of `desktop:mini-backend:set-thread-override`. camelCase
/// keys match the renderer; `default` tolerates renderers written before
/// the idle-timeout and working-resolution fields existed.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", default)]
pub struct MiniBackendThreadOverridePayload {
    pub intra_op_threads: Option<i64>,
    pub inter_op_threads: Option<i64>,
    pub engine_idle_timeout_seconds: Option<i64>,
    pub working_resolution_megapixels: Option<f64>,
    pub working_resolution_ocr_clean: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SetMiniBackendThreadOverrideResult {
    pub accepted: bool,
}

/// Wire payload of `desktop:open-logs-folder`. `path` echoes the resolved
/// logs directory even when the reveal fails, so the UI can still offer a
/// copy action; `opened` reports whether the file-manager reveal succeeded.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OpenLogsFolderResult {
    pub opened: bool,
    pub path: Option<String>,
}

// ---------------------------------------------------------------------------
// Commands (thin adapters)
// ---------------------------------------------------------------------------

#[tauri::command(rename = "desktop:get-runtime-config")]
pub async fn get_runtime_config<R: Runtime>(
    app: AppHandle<R>,
) -> Result<RuntimeConfig, DesktopError> {
    run_blocking(move || Ok(build_runtime_config(&app))).await
}

#[tauri::command(rename = "desktop:locale:get-preferences")]
pub fn get_locale_preferences() -> LocalePreferences {
    build_locale_preferences(sys_locale::get_locales())
}

#[tauri::command(rename = "desktop:reset-local-settings")]
pub async fn reset_local_settings<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ResetLocalSettingsResult, DesktopError> {
    let user_data_dir = app_user_data_dir(&app)?;
    run_blocking(move || reset_local_settings_at(&user_data_dir)).await
}

#[tauri::command(rename = "desktop:restart-app")]
pub fn restart_app<R: Runtime>(app: AppHandle<R>) -> RestartAppResult {
    tauri::async_runtime::spawn(async move {
        // Give the IPC layer time to flush this command's response to the
        // webview before the process image is replaced.
        tokio::time::sleep(RESTART_GRACE_PERIOD).await;
        tracing::info!(
            operation = "restart_application",
            "application restart requested"
        );
        app.restart();
    });

    RestartAppResult { restarting: true }
}

#[tauri::command(rename = "desktop:mini-backend:set-thread-override")]
pub async fn set_mini_backend_thread_override<R: Runtime>(
    app: AppHandle<R>,
    payload: MiniBackendThreadOverridePayload,
) -> Result<SetMiniBackendThreadOverrideResult, DesktopError> {
    let user_data_dir = app_user_data_dir(&app)?;
    run_blocking(move || {
        write_mini_backend_thread_override_at(&user_data_dir, &payload)?;
        Ok(SetMiniBackendThreadOverrideResult { accepted: true })
    })
    .await
}

#[tauri::command(rename = "desktop:get-mini-backend-runtime-state")]
pub fn get_mini_backend_runtime_state<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
) -> Result<RuntimeMiniBackendRuntimeState, DesktopError> {
    snapshot_runtime_state(&app, &store).map_err(|_| {
        tracing::error!(
            operation = "snapshot_runtime_state",
            "failed to obtain runtime state"
        );
        DesktopError::Runtime
    })
}

#[tauri::command(rename = "desktop:check-local-backend")]
pub async fn check_local_backend<R: Runtime>(
    app: AppHandle<R>,
) -> Result<bool, DesktopError> {
    let local_api_url = run_blocking(move || {
        Ok(resolved_desktop_config(&app).runtime.local_api_url.clone())
    })
    .await?;

    Ok(check_local_backend_health(&local_api_url).await)
}

#[tauri::command(rename = "desktop:restart-local-backend")]
pub async fn restart_local_backend<R: Runtime + 'static>(
    app: AppHandle<R>,
) -> Result<bool, DesktopError> {
    crate::sidecar::mini_backend::restart_mini_backend(app)
        .await
        .map_err(|_| {
            tracing::error!(
                operation = "restart_local_backend",
                "failed to restart local backend"
            );
            DesktopError::Sidecar
        })
}

#[tauri::command(rename = "desktop:get-local-api-session")]
pub fn get_local_api_session<R: Runtime>(app: AppHandle<R>) -> Option<String> {
    crate::sidecar::mini_backend::local_api_session_secret(&app)
}

#[tauri::command(rename = "desktop:open-external")]
pub async fn open_external<R: Runtime>(
    app: AppHandle<R>,
    url: String,
) -> Result<(), DesktopError> {
    run_blocking(move || {
        let config = resolved_desktop_config(&app);
        let target = validate_external_url(&url, &config.allowed_external_hosts)
            .inspect_err(|error| {
                tracing::warn!(
                    operation = "validate_external_url",
                    error_code = ?error,
                    "external URL request rejected"
                );
            })?;
        open_url(&app, &target)
    })
    .await
}

/// Opens the mini-backend logs directory in the OS file manager.
///
/// Uses `open_path` (not `reveal_item_in_dir`) to match the Electron shell's
/// `shell.openPath`: the user gets the logs folder opened with its files
/// visible, not the folder selected inside its parent. Resolves the SAME
/// base as the sidecar env (`KOMA_APP_DATA_DIR` = `app_data_dir`, logs under
/// `app_data_dir/logs` — the folder the bug report auto-collector also
/// scans). Fail-open: a failed create or open answers `{opened: false}`
/// instead of surfacing a hard error, so a broken shell integration can
/// never block diagnostics.
#[tauri::command(rename = "desktop:open-logs-folder")]
pub async fn open_logs_folder<R: Runtime>(
    app: AppHandle<R>,
) -> Result<OpenLogsFolderResult, DesktopError> {
    use tauri_plugin_opener::OpenerExt;

    run_blocking(move || {
        let logs_dir = app_user_data_dir(&app)?.join("logs");
        let path_string = logs_dir.to_string_lossy().to_string();
        if let Err(create_error) = std::fs::create_dir_all(&logs_dir) {
            tracing::warn!(
                operation = "open_logs_folder",
                error = %create_error,
                "logs directory could not be created"
            );
            return Ok(OpenLogsFolderResult { opened: false, path: Some(path_string) });
        }
        let opened = app
            .opener()
            .open_path(path_string.clone(), None::<&str>)
            .inspect_err(|open_error| {
                tracing::warn!(
                    operation = "open_logs_folder",
                    error = %open_error,
                    "logs directory could not be opened"
                );
            })
            .is_ok();
        Ok(OpenLogsFolderResult { opened, path: Some(path_string) })
    })
    .await
}

#[tauri::command(rename = "desktop:open-community-link")]
pub async fn open_community_link<R: Runtime>(
    app: AppHandle<R>,
    url: String,
) -> Result<(), DesktopError> {
    run_blocking(move || {
        let target = validate_community_url(&url).inspect_err(|error| {
            tracing::warn!(
                operation = "validate_community_url",
                error_code = ?error,
                "community URL request rejected"
            );
        })?;
        open_url(&app, &target)
    })
    .await
}

// ---------------------------------------------------------------------------
// Public application services (reused by other modules)
// ---------------------------------------------------------------------------

/// Returns the process-wide runtime configuration. Resolution happens once;
/// subsequent calls are a cache hit.
pub fn build_runtime_config<R: Runtime>(app: &AppHandle<R>) -> RuntimeConfig {
    resolved_desktop_config(app).runtime.clone()
}

pub fn reset_local_settings_at(
    user_data_dir: &Path,
) -> Result<ResetLocalSettingsResult, DesktopError> {
    let mut cleared_paths = Vec::with_capacity(LOCAL_SETTINGS_ENTRIES.len());
    for entry in LOCAL_SETTINGS_ENTRIES {
        let target = user_data_dir.join(entry);
        let removed = remove_path_if_present(&target).map_err(|error| {
            tracing::error!(
                operation = "reset_local_settings",
                entry,
                error_kind = ?error.kind(),
                "failed to remove local settings entry"
            );

            DesktopError::ClearLocalSettings
        })?;
        if removed {
            cleared_paths.push(target.to_string_lossy().into_owned());
        }
    }

    tracing::info!(
        operation = "reset_local_settings",
        removed_count = cleared_paths.len(),
        "local settings reset completed"
    );

    Ok(ResetLocalSettingsResult {
        cleared: true,
        user_data_path: user_data_dir.to_string_lossy().into_owned(),
        cleared_paths,
    })
}

fn clamp_thread_value(value: i64) -> Option<u32> {
    if value < 1 {
        None
    } else {
        Some(value.min(64) as u32)
    }
}

fn clamp_idle_timeout_value(value: i64) -> u32 {
    value.clamp(0, 86_400) as u32
}

fn clamp_megapixels_value(value: f64) -> Option<f64> {
    if !value.is_finite() {
        return None;
    }
    Some(value.clamp(4.0, 64.0))
}

/// Per-call sequence number for temp-file names: two concurrent IPC writes
/// must never share one temp path (the process id alone does not separate
/// them), mirroring the Electron writer's `randomUUID()` intent.
static THREAD_OVERRIDE_TEMP_SEQUENCE: AtomicU64 = AtomicU64::new(0);

/// Persists `mini-backend-thread-override.json` atomically (temp file +
/// rename) so a concurrent sidecar spawn never reads a half-written file.
pub(crate) fn write_mini_backend_thread_override_at(
    user_data_dir: &Path,
    payload: &MiniBackendThreadOverridePayload,
) -> Result<(), DesktopError> {
    use crate::sidecar::mini_backend::{
        MiniBackendThreadOverride, MINI_BACKEND_THREAD_OVERRIDE_FILE,
    };

    let override_env = MiniBackendThreadOverride {
        intra_op_threads: payload.intra_op_threads.and_then(clamp_thread_value),
        inter_op_threads: payload.inter_op_threads.and_then(clamp_thread_value),
        engine_idle_timeout_seconds: payload
            .engine_idle_timeout_seconds
            .map(clamp_idle_timeout_value),
        working_resolution_megapixels: payload
            .working_resolution_megapixels
            .and_then(clamp_megapixels_value),
        working_resolution_ocr_clean: payload.working_resolution_ocr_clean,
    };
    let json = serde_json::to_string(&override_env)
        .map_err(|_| DesktopError::ThreadOverride)?;
    let target = user_data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE);
    let temp_sequence = THREAD_OVERRIDE_TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temp = user_data_dir.join(format!(
        "{MINI_BACKEND_THREAD_OVERRIDE_FILE}.{}.{}.tmp",
        std::process::id(),
        temp_sequence,
    ));
    std::fs::write(&temp, json).map_err(|_| DesktopError::ThreadOverride)?;
    // The target is cleared before the rename, mirroring the Electron
    // workspace writer precedent (writeWorkspacePackageToFile,
    // apps/electron/electron/modules/workspace.ts:71-74).
    if target.exists() {
        std::fs::remove_file(&target).map_err(|error| {
            let _ = std::fs::remove_file(&temp);
            tracing::error!(
                operation = "set_mini_backend_thread_override",
                error_kind = ?error.kind(),
                "failed to replace the thread override file"
            );
            DesktopError::ThreadOverride
        })?;
    }
    std::fs::rename(&temp, &target).map_err(|error| {
        let _ = std::fs::remove_file(&temp);
        tracing::error!(
            operation = "set_mini_backend_thread_override",
            error_kind = ?error.kind(),
            "failed to finalize the thread override file"
        );
        DesktopError::ThreadOverride
    })?;
    Ok(())
}

pub async fn check_local_backend_health(local_api_url: &str) -> bool {
    let mut endpoint = match parse_loopback_url(local_api_url) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            tracing::warn!(
                operation = "check_local_backend_health",
                error_code = ?error,
                "health check target rejected"
            );
            return false;
        }
    };

    let path = format!("{}/health", endpoint.path().trim_end_matches('/'));
    endpoint.set_path(&path);

    let Some(client) = loopback_http_client() else {
        return false;
    };

    for attempt in 0..=DESKTOP_FETCH_RETRY_COUNT {
        match client.get(endpoint.clone()).send().await {
            Ok(response) if response.status().is_success() => return true,
            Ok(response) => {
                tracing::debug!(
                    operation = "check_local_backend_health",
                    attempt,
                    status = response.status().as_u16(),
                    "backend health check returned a non-success status"
                );
            }
            Err(error) => {
                tracing::debug!(
                    operation = "check_local_backend_health",
                    attempt,
                    timeout = error.is_timeout(),
                    connect = error.is_connect(),
                    "backend health check request failed"
                );
            }
        }

        if attempt < DESKTOP_FETCH_RETRY_COUNT {
            tokio::time::sleep(DESKTOP_FETCH_RETRY_DELAY).await;
        }
    }

    false
}

/// Validates an arbitrary URL against the strict external policy:
/// HTTPS, standard port, no embedded credentials, host in the dynamic
/// allowlist or under an allowed public suffix.
pub fn validate_external_url(
    raw_url: &str,
    allowed_hosts: &HashSet<String>,
) -> Result<Url, DesktopError> {
    let parsed = parse_https_url(raw_url)?;
    let host = parsed
        .host_str()
        .map(normalize_host)
        .ok_or(DesktopError::InvalidUrl)?;

    let allowed = allowed_hosts.contains(&host)
        || EXTERNAL_ALLOWED_HOST_SUFFIXES
            .iter()
            .any(|suffix| host_matches_suffix(&host, suffix));

    if allowed {
        Ok(parsed)
    } else {
        Err(DesktopError::HostNotAllowed)
    }
}

/// Community links use the same static allowlist as every other external
/// URL: "any hostname with a dot" is not a security boundary.
pub fn validate_community_url(raw_url: &str) -> Result<Url, DesktopError> {
    validate_external_url(raw_url, &HashSet::new())
}

/// Builds locale preferences from an ordered list of system locale tags.
/// Tags are normalised to BCP-47 style (`pt_BR.UTF-8` → `pt-BR`), de-duplicated
/// and stripped of the POSIX `C`/`POSIX` pseudo-locales.
pub fn build_locale_preferences<I, S>(system_locales: I) -> LocalePreferences
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut seen = HashSet::new();
    let mut system_locales: Vec<String> = system_locales
        .into_iter()
        .filter_map(|locale| normalize_locale_tag(locale.as_ref()))
        .filter(|locale| seen.insert(locale.clone()))
        .collect();

    let app_locale = system_locales
        .first()
        .cloned()
        .unwrap_or_else(|| DEFAULT_APP_LOCALE.to_owned());

    // The frontend contract guarantees a non-empty list.
    if system_locales.is_empty() {
        system_locales.push(app_locale.clone());
    }

    LocalePreferences {
        app_locale,
        system_locales,
    }
}


#[cfg(test)]
#[path = "desktop_tests.rs"]
mod tests;
