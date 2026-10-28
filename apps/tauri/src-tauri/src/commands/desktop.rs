//! Desktop-level IPC adapters: runtime configuration discovery, locale
//! preferences, local settings reset, application restart, local backend
//! health probing and hardened external URL opening.
//!
//! Configuration is resolved exactly once per process into a shared
//! [`OnceLock`] cell (see [`resolved_desktop_config`]) and every command
//! afterwards pays only a pointer clone. Only public configuration keys may
//! be resolved; secrets cannot pass through this layer at all.

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

pub(crate) use config_sources::DESKTOP_UPDATE_CHANNEL;
use infrastructure::{app_user_data_dir, loopback_http_client, open_url, run_blocking};
use locale::normalize_locale_tag;
use paths::remove_path_if_present;
use resolved_config::resolved_desktop_config;
use url_validation::{host_matches_suffix, normalize_host, parse_https_url, parse_loopback_url};

const DEFAULT_AUTH_API_URL: &str = "http://127.0.0.1:3001";
const DEFAULT_LOCAL_API_URL: &str = "http://127.0.0.1:8001";
const DEFAULT_RUNTIME_ARTIFACTS_URL: &str =
    "https://github.com/klaus-2/koma-studio/releases/latest/download/";
const DEFAULT_APP_LOCALE: &str = "pt-BR";

const DESKTOP_FETCH_TIMEOUT: Duration = Duration::from_secs(12);
const DESKTOP_CONNECT_TIMEOUT: Duration = Duration::from_secs(2);
const DESKTOP_FETCH_RETRY_COUNT: usize = 1;
const DESKTOP_FETCH_RETRY_DELAY: Duration = Duration::from_millis(150);
const RESTART_GRACE_PERIOD: Duration = Duration::from_millis(50);

const IDENTITY_CACHE_FILE: &str = "desktop-identity-cache.json";
const RUNTIME_SELECTION_FILE: &str = "mini-backend-runtime-selection.json";
const SECURE_STORE_DIR: &str = "secure-store";
const LOCAL_SETTINGS_ENTRIES: [&str; 3] =
    [SECURE_STORE_DIR, IDENTITY_CACHE_FILE, RUNTIME_SELECTION_FILE];

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

/// Desktop-internal variant: same precedence as the public resolve, but
/// without the public-keys allowlist. For Rust-side consumers whose values
/// never cross to the webview.
pub(crate) fn resolve_desktop_internal_value<R: Runtime>(
    app: &AppHandle<R>,
    key: &str,
) -> Option<String> {
    resolved_desktop_config(app).sources.resolve_any(key)
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
mod tests {
    use super::*;
    use std::{collections::HashMap, fs, path::PathBuf};

    use super::config_sources::{
        load_env_documents, load_runtime_config_documents, read_config_document, ConfigLocations,
        ConfigSources, UpdateChannel,
    };
    use super::env_document::{parse_env_document, parse_env_line};
    use super::paths::ancestor_dirs;
    use super::resolved_config::ResolvedDesktopConfig;
    use super::runtime_artifacts_url::{
        default_runtime_artifacts_url, normalize_runtime_artifacts_url,
    };
    use super::url_validation::normalize_loopback_url;

    fn sources(
        runtime: Vec<serde_json::Map<String, serde_json::Value>>,
        envs: Vec<HashMap<String, String>>,
        channel: UpdateChannel,
    ) -> ConfigSources {
        ConfigSources {
            process_values: HashMap::new(),
            runtime_config_documents: runtime,
            env_documents: envs,
            channel,
        }
    }

    fn json_doc(pairs: &[(&str, &str)]) -> serde_json::Map<String, serde_json::Value> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_owned(), serde_json::Value::from(*v)))
            .collect()
    }

    fn env_doc(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_owned(), (*v).to_owned()))
            .collect()
    }

    #[test]
    fn external_url_requires_https_allowed_host_and_standard_port() {
        let hosts = HashSet::from(["api.example.com".to_owned()]);

        assert!(validate_external_url("https://github.com/koma", &hosts).is_ok());
        assert!(validate_external_url("https://sub.github.com/koma", &hosts).is_ok());
        assert!(validate_external_url("https://api.example.com/pay", &hosts).is_ok());
        assert!(matches!(
            validate_external_url("http://github.com/koma", &hosts),
            Err(DesktopError::InsecureScheme)
        ));
        assert!(matches!(
            validate_external_url("https://evil.example.net", &hosts),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_external_url("https://evilgithub.com", &hosts),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_external_url("https://user:pw@github.com", &hosts),
            Err(DesktopError::EmbeddedCredentials)
        ));
        assert!(matches!(
            validate_external_url("   ", &hosts),
            Err(DesktopError::MissingUrl)
        ));
    }

    #[test]
    fn external_url_rejects_nonstandard_ports_and_ip_literals() {
        let hosts = HashSet::new();

        assert!(matches!(
            validate_external_url("https://github.com:8443", &hosts),
            Err(DesktopError::PortNotAllowed)
        ));

        assert!(matches!(
            validate_external_url("https://127.0.0.1", &hosts),
            Err(DesktopError::HostNotAllowed)
        ));
    }

    #[test]
    fn community_url_uses_the_static_allowlist() {
        assert!(validate_community_url("https://discord.gg/koma").is_ok());
        assert!(matches!(
            validate_community_url("https://any-public-site.example/x"),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_community_url("http://discord.gg/koma"),
            Err(DesktopError::InsecureScheme)
        ));
        assert!(matches!(
            validate_community_url("https://localhost/admin"),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_community_url("https://10.0.0.1/"),
            Err(DesktopError::HostNotAllowed)
        ));
    }

    #[test]
    fn error_serializes_as_structured_code() {
        let value = serde_json::to_value(DesktopError::HostNotAllowed).unwrap();

        assert_eq!(
            value,
            serde_json::json!({
                "code": "host_not_allowed"
            })
        );
    }

    #[test]
    fn loopback_url_rejects_remote_hosts_and_credentials() {
        for raw in [
            "http://example.com:8001",
            "http://192.168.1.10:8001",
            "http://user:password@127.0.0.1:8001",
            "file:///tmp/backend",
            "http://127.0.0.1:8001?token=value",
            "http://127.0.0.1:8001#fragment",
        ] {
            assert!(parse_loopback_url(raw).is_err(), "{raw}");
        }
    }

    #[test]
    fn loopback_url_accepts_ipv4_ipv6_and_normalizes_localhost() {
        assert!(parse_loopback_url("http://127.0.0.1:8001").is_ok());
        assert!(parse_loopback_url("http://[::1]:8001").is_ok());

        let localhost = parse_loopback_url("http://localhost:8001").unwrap();
        assert_eq!(localhost.host_str(), Some("127.0.0.1"));
    }

    #[test]
    fn reset_local_settings_removes_known_files() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join(SECURE_STORE_DIR)).unwrap();
        fs::write(temp.path().join(IDENTITY_CACHE_FILE), "{}").unwrap();
        fs::write(temp.path().join(RUNTIME_SELECTION_FILE), "{}").unwrap();

        let result = reset_local_settings_at(temp.path()).unwrap();

        assert!(result.cleared);
        assert_eq!(result.cleared_paths.len(), 3);
        assert!(!temp.path().join(SECURE_STORE_DIR).exists());
        assert!(!temp.path().join(IDENTITY_CACHE_FILE).exists());
        assert!(!temp.path().join(RUNTIME_SELECTION_FILE).exists());
    }

    #[test]
    fn reset_local_settings_reports_only_removed_entries() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join(IDENTITY_CACHE_FILE), "{}").unwrap();

        let result = reset_local_settings_at(temp.path()).unwrap();

        assert!(result.cleared);
        assert_eq!(result.cleared_paths.len(), 1);
        assert!(result.cleared_paths[0].ends_with(IDENTITY_CACHE_FILE));
    }

    #[test]
    fn normalize_loopback_rewrites_localhost_and_defaults_on_invalid() {
        assert_eq!(
            normalize_loopback_url("http://localhost:8001/"),
            "http://127.0.0.1:8001"
        );
        assert_eq!(
            normalize_loopback_url("http://example.com/"),
            DEFAULT_LOCAL_API_URL
        );
    }

    #[test]
    fn resolves_runtime_artifacts_base_url_from_generic_update_server_urls() {
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://api.koma-studio.site/updates/",
                UpdateChannel::Beta
            ),
            "https://api.koma-studio.site/updates/beta/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://api.koma-studio.site/updates/stable/",
                UpdateChannel::Beta
            ),
            "https://api.koma-studio.site/updates/beta/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://api.koma-studio.site/updates/beta/mini-backend-artifacts/latest.json",
                UpdateChannel::Beta
            ),
            "https://api.koma-studio.site/updates/beta/mini-backend-artifacts/latest.json"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://cdn.example.com/x/mini-backend-artifacts/",
                UpdateChannel::Stable
            ),
            "https://cdn.example.com/x/mini-backend-artifacts/"
        );
        // Regression: a path ending in the segment without a trailing slash
        // must not get a duplicate channel segment.
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://cdn.example.com/x/mini-backend-artifacts",
                UpdateChannel::Stable
            ),
            "https://cdn.example.com/x/mini-backend-artifacts/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url("https://cdn.example.com", UpdateChannel::Stable),
            "https://cdn.example.com/stable/"
        );
        // GitHub release assets are flat: the channel must not be appended.
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://github.com/klaus-2/koma-studio/releases/latest/download",
                UpdateChannel::Stable
            ),
            "https://github.com/klaus-2/koma-studio/releases/latest/download/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.0/",
                UpdateChannel::Beta
            ),
            "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.0/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url("not a url", UpdateChannel::Beta),
            default_runtime_artifacts_url()
        );
    }

    #[test]
    fn defaults_to_the_github_runtime_feed() {
        assert_eq!(
            default_runtime_artifacts_url(),
            "https://github.com/klaus-2/koma-studio/releases/latest/download/"
        );
        assert_eq!(UpdateChannel::from_version("1.2.3"), UpdateChannel::Stable);
        assert_eq!(
            UpdateChannel::from_version("1.2.3-beta.4"),
            UpdateChannel::Beta
        );
        assert_eq!(
            UpdateChannel::from_version("1.2.3+build.9"),
            UpdateChannel::Stable
        );
    }

    #[tokio::test]
    async fn local_backend_healthcheck_returns_false_for_closed_port() {
        assert!(!check_local_backend_health("http://127.0.0.1:9").await);
    }

    #[test]
    fn env_document_last_duplicate_key_wins() {
        let document = parse_env_document(
            "# comment\nVITE_AUTH_API_URL=http://localhost:3001\nVITE_AUTH_API_URL=https://auth.koma-studio.site\n",
        );
        assert_eq!(
            document.get("VITE_AUTH_API_URL").map(String::as_str),
            Some("https://auth.koma-studio.site")
        );
    }

    #[test]
    fn env_document_supports_export_prefix_quotes_and_inline_comments() {
        let document = parse_env_document(concat!(
            "export VITE_AUTH_API_URL=\"https://auth.example.test\"\n",
            "VITE_LOCAL_API_URL='https://single.example.test' # trailing\n",
            "UPDATE_SERVER_URL=https://plain.example.test # inline comment\n",
            "VITE_PROJECT_BUG_URL=https://bug.example.test/abc#def\n",
            "JWT_SECRET=should-never-be-loaded\n",
        ));

        assert_eq!(
            document.get("VITE_AUTH_API_URL").map(String::as_str),
            Some("https://auth.example.test")
        );
        assert_eq!(
            document.get("VITE_LOCAL_API_URL").map(String::as_str),
            Some("https://single.example.test")
        );
        assert_eq!(
            document.get("UPDATE_SERVER_URL").map(String::as_str),
            Some("https://plain.example.test")
        );
        assert_eq!(
            document.get("VITE_PROJECT_BUG_URL").map(String::as_str),
            Some("https://bug.example.test/abc#def")
        );
        assert!(!document.contains_key("JWT_SECRET"));
    }

    #[test]
    fn env_parser_rejects_unterminated_quoted_values() {
        assert_eq!(
            parse_env_line("VITE_AUTH_API_URL=\"https://example.com"),
            None
        );
    }

    #[test]
    fn process_configuration_is_a_snapshot() {
        let mut resolved = sources(
            vec![json_doc(&[(
                "VITE_AUTH_API_URL",
                "https://json.example.com",
            )])],
            Vec::new(),
            UpdateChannel::Stable,
        );

        resolved.process_values.insert(
            "VITE_AUTH_API_URL".to_owned(),
            "https://process.example.com".to_owned(),
        );

        assert_eq!(
            resolved.resolve("VITE_AUTH_API_URL").as_deref(),
            Some("https://process.example.com")
        );
    }

    #[test]
    fn non_public_keys_are_never_resolved() {
        let resolved = sources(
            vec![json_doc(&[("JWT_SECRET", "leak")])],
            vec![env_doc(&[("SOME_API_KEY", "leak")])],
            UpdateChannel::Stable,
        );

        assert_eq!(resolved.resolve("JWT_SECRET"), None);
        assert_eq!(resolved.resolve("SOME_API_KEY"), None);
    }

    #[test]
    fn runtime_config_loader_drops_non_public_keys() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(
            &config_path,
            r#"{"JWT_SECRET":"nope","VITE_AUTH_API_URL":"https://auth.example.test"}"#,
        )
        .unwrap();

        let documents = load_runtime_config_documents(&[config_path]);

        assert!(documents[0].get("JWT_SECRET").is_none());
        assert!(documents[0].get("VITE_AUTH_API_URL").is_some());
    }

    #[test]
    fn env_documents_are_loaded_from_disk_in_candidate_order() {
        let temp = tempfile::tempdir().unwrap();
        let first = temp.path().join(".env.local");
        let second = temp.path().join(".env");
        fs::write(&first, "VITE_AUTH_API_URL=http://first.example.test\n").unwrap();
        fs::write(
            &second,
            "VITE_AUTH_API_URL=http://second.example.test\nVITE_LOCAL_API_URL=http://only-second.example.test\n",
        )
        .unwrap();

        let documents = load_env_documents(&[first, temp.path().join("missing"), second]);
        let resolved = sources(Vec::new(), documents, UpdateChannel::Stable);

        assert_eq!(
            resolved.resolve("VITE_AUTH_API_URL").as_deref(),
            Some("http://first.example.test")
        );
        assert_eq!(
            resolved.resolve("VITE_LOCAL_API_URL").as_deref(),
            Some("http://only-second.example.test")
        );
    }

    #[test]
    fn oversized_config_documents_are_rejected() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(&config_path, "x".repeat(MAX_CONFIG_FILE_BYTES as usize + 1)).unwrap();

        assert!(read_config_document(&config_path).is_err());
    }

    #[test]
    fn runtime_config_takes_precedence_over_env_files() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(
            &config_path,
            r#"{"VITE_AUTH_API_URL":"https://from-json.example.test","VITE_LOCAL_API_URL":"  "}"#,
        )
        .unwrap();

        let resolved = sources(
            load_runtime_config_documents(&[config_path, temp.path().join("absent.json")]),
            vec![env_doc(&[
                ("VITE_AUTH_API_URL", "https://from-env.example.test"),
                ("VITE_LOCAL_API_URL", "https://from-env-blank.example.test"),
            ])],
            UpdateChannel::Stable,
        );

        assert_eq!(
            resolved.resolve("VITE_AUTH_API_URL").as_deref(),
            Some("https://from-json.example.test")
        );
        assert_eq!(
            resolved.resolve("VITE_LOCAL_API_URL").as_deref(),
            Some("https://from-env-blank.example.test")
        );
    }

    #[test]
    fn invalid_runtime_config_json_is_ignored() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(&config_path, "{ not json").unwrap();

        assert!(load_runtime_config_documents(&[config_path]).is_empty());
    }

    #[test]
    fn resolved_config_builds_allowlist_and_normalizes_loopback() {
        let resolved = ResolvedDesktopConfig::from_sources(sources(
            vec![json_doc(&[
                ("VITE_AUTH_API_URL", "https://auth.koma-studio.site"),
                ("VITE_LOCAL_API_URL", "http://localhost:8001/"),
                ("VITE_PROJECT_WEBSITE_URL", "https://koma-studio.site/"),
            ])],
            Vec::new(),
            UpdateChannel::Beta,
        ));

        assert_eq!(resolved.runtime.local_api_url, "http://127.0.0.1:8001");
        assert_eq!(
            resolved.runtime.runtime_artifacts_url,
            "https://github.com/klaus-2/koma-studio/releases/latest/download/"
        );
        assert!(resolved
            .allowed_external_hosts
            .contains("auth.koma-studio.site"));
        assert!(resolved
            .allowed_external_hosts
            .contains("koma-studio.site"));
        assert!(validate_external_url(
            "https://koma-studio.site/docs",
            &resolved.allowed_external_hosts
        )
        .is_ok());
    }

    #[test]
    fn runtime_config_candidates_are_resource_only_in_release() {
        let locations = ConfigLocations {
            current_dir: Some(PathBuf::from("/app")),
            exe_dir: Some(PathBuf::from("/app/bin")),
            resource_dir: Some(PathBuf::from("/app/res")),
        };

        // The compile-time mode decides; both branches must stay absolute
        // resource-scoped or include the legacy dev layout respectively.
        let candidates = locations.runtime_config_candidates();
        assert!(!candidates.is_empty());
        if cfg!(debug_assertions) {
            assert!(candidates.contains(&PathBuf::from("/app").join(RUNTIME_CONFIG_FILE)));
        } else {
            assert_eq!(
                candidates,
                vec![PathBuf::from("/app/res").join(RUNTIME_CONFIG_FILE)]
            );
        }
    }

    #[test]
    fn locale_preferences_normalize_dedupe_and_fallback() {
        let prefs = build_locale_preferences(["en_US.UTF-8", "en-US", "pt_BR@latin", "C"]);
        assert_eq!(prefs.app_locale, "en-US");
        assert_eq!(prefs.system_locales, vec!["en-US", "pt-BR"]);

        let empty = build_locale_preferences(["C", "POSIX", ""]);
        assert_eq!(empty.app_locale, DEFAULT_APP_LOCALE);
        assert_eq!(empty.system_locales, vec![DEFAULT_APP_LOCALE]);
    }

    #[test]
    fn host_suffix_matching_is_boundary_aware() {
        assert!(host_matches_suffix("github.com", "github.com"));
        assert!(host_matches_suffix("api.github.com", "github.com"));
        assert!(!host_matches_suffix("evilgithub.com", "github.com"));
        assert!(!host_matches_suffix("github.com.evil", "github.com"));
    }

    #[test]
    fn ancestor_dirs_respects_depth() {
        let dirs = ancestor_dirs(Path::new("/a/b/c/d"), 2);
        assert_eq!(
            dirs,
            vec![PathBuf::from("/a/b/c/d"), PathBuf::from("/a/b/c")]
        );
    }
}
