//! Desktop-level IPC adapters: runtime configuration discovery, locale
//! preferences, local settings reset, application restart, local backend
//! health probing and hardened external URL opening.
//!
//! Configuration is resolved exactly once per process into a shared
//! [`OnceLock`] cell (see [`resolved_desktop_config`]) and every command
//! afterwards pays only a pointer clone. Only public configuration keys may
//! be resolved; secrets cannot pass through this layer at all.

use std::{
    collections::{HashMap, HashSet},
    env, fs, io,
    io::Read,
    path::{Path, PathBuf},
    sync::{Arc, OnceLock},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_opener::OpenerExt;
use thiserror::Error;
use url::{Host, Url};

use crate::runtime::profiles::{
    snapshot_runtime_state, MiniBackendRuntimeState as RuntimeMiniBackendRuntimeState,
    MiniBackendRuntimeStore,
};

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

// ---------------------------------------------------------------------------
// Resolved configuration (cached in managed state)
// ---------------------------------------------------------------------------

type SharedDesktopConfig = Arc<ResolvedDesktopConfig>;
type DesktopConfigCell = Arc<OnceLock<SharedDesktopConfig>>;

/// Fully resolved, immutable desktop configuration. Intentionally does not
/// derive `Debug`: `sources` may hold developer `.env` contents.
pub(crate) struct ResolvedDesktopConfig {
    runtime: RuntimeConfig,
    allowed_external_hosts: HashSet<String>,
    sources: ConfigSources,
}

impl ResolvedDesktopConfig {
    fn from_sources(sources: ConfigSources) -> Self {
        let auth_api_url = sources
            .resolve("VITE_AUTH_API_URL")
            .unwrap_or_else(|| DEFAULT_AUTH_API_URL.to_owned());
        let local_api_url = normalize_loopback_url(
            &sources
                .resolve("VITE_LOCAL_API_URL")
                .unwrap_or_else(|| DEFAULT_LOCAL_API_URL.to_owned()),
        );
        let runtime_artifacts_url = resolve_runtime_artifacts_url(&sources);

        let mut allowed_external_hosts = HashSet::new();
        for raw_url in [&auth_api_url, &local_api_url, &runtime_artifacts_url] {
            insert_url_host(&mut allowed_external_hosts, raw_url);
        }
        for key in PROJECT_LINK_ENV_KEYS {
            if let Some(raw_url) = sources.resolve(key) {
                insert_url_host(&mut allowed_external_hosts, &raw_url);
            }
        }

        tracing::info!(
            operation = "resolve_desktop_config",
            channel = sources.channel.as_str(),
            allowed_hosts = allowed_external_hosts.len(),
            "desktop runtime configuration resolved"
        );

        Self {
            runtime: RuntimeConfig {
                auth_api_url,
                local_api_url,
                runtime_artifacts_url,
                app_packaged: !cfg!(debug_assertions),
            },
            allowed_external_hosts,
            sources,
        }
    }
}

fn desktop_config_cell<R: Runtime>(app: &AppHandle<R>) -> DesktopConfigCell {
    if let Some(state) = app.try_state::<DesktopConfigCell>() {
        return Arc::clone(state.inner());
    }

    app.manage(DesktopConfigCell::default());

    Arc::clone(app.state::<DesktopConfigCell>().inner())
}

fn resolved_desktop_config<R: Runtime>(app: &AppHandle<R>) -> SharedDesktopConfig {
    let cell = desktop_config_cell(app);

    Arc::clone(cell.get_or_init(|| {
        Arc::new(ResolvedDesktopConfig::from_sources(
            ConfigSources::load(&ConfigLocations::from_app(app), app),
        ))
    }))
}

// ---------------------------------------------------------------------------
// Configuration sources
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UpdateChannel {
    Stable,
    Beta,
}

impl UpdateChannel {
    fn from_version(version: &str) -> Self {
        if version.contains('-') {
            Self::Beta
        } else {
            Self::Stable
        }
    }

    fn from_segment(segment: &str) -> Option<Self> {
        if segment.eq_ignore_ascii_case("beta") {
            Some(Self::Beta)
        } else if segment.eq_ignore_ascii_case("stable") {
            Some(Self::Stable)
        } else {
            None
        }
    }

    const fn as_str(self) -> &'static str {
        match self {
            Self::Stable => "stable",
            Self::Beta => "beta",
        }
    }
}

/// Channel reported by desktop diagnostics; runtime artifacts keep using the
/// build-derived channel.
pub(crate) const DESKTOP_UPDATE_CHANNEL: &str = UpdateChannel::Stable.as_str();

/// Filesystem anchors used to discover configuration files.
#[derive(Debug, Clone, Default)]
struct ConfigLocations {
    current_dir: Option<PathBuf>,
    exe_dir: Option<PathBuf>,
    resource_dir: Option<PathBuf>,
}

impl ConfigLocations {
    fn from_app<R: Runtime>(app: &AppHandle<R>) -> Self {
        Self {
            current_dir: env::current_dir().ok(),
            exe_dir: env::current_exe()
                .ok()
                .and_then(|exe| exe.parent().map(Path::to_path_buf)),
            resource_dir: app.path().resource_dir().ok(),
        }
    }

    fn runtime_config_candidates(&self) -> Vec<PathBuf> {
        // Packaged builds only ever read the bundled runtime config; walking
        // ancestor directories of the executable would let a stray file in a
        // user-writable folder override configuration.
        if !cfg!(debug_assertions) {
            return self
                .resource_dir
                .iter()
                .map(|root| root.join(RUNTIME_CONFIG_FILE))
                .collect();
        }

        let roots = self
            .current_dir
            .iter()
            .chain(self.resource_dir.iter());

        dedupe_paths(roots.flat_map(|root| {
            [
                root.join(RUNTIME_CONFIG_FILE),
                root.join(LEGACY_RUNTIME_CONFIG_DIR)
                    .join(RUNTIME_CONFIG_FILE),
            ]
        }))
    }

    fn env_file_candidates(&self, env_file_name: &str) -> Vec<PathBuf> {
        let roots = dedupe_paths(
            self.current_dir
                .iter()
                .flat_map(|dir| ancestor_dirs(dir, CURRENT_DIR_ANCESTOR_DEPTH))
                .chain(
                    self.exe_dir
                        .iter()
                        .flat_map(|dir| ancestor_dirs(dir, EXE_DIR_ANCESTOR_DEPTH)),
                )
                .chain(
                    self.resource_dir
                        .iter()
                        .flat_map(|dir| ancestor_dirs(dir, RESOURCE_DIR_ANCESTOR_DEPTH)),
                ),
        );

        let local_env_file_name = format!("{env_file_name}.local");
        let file_names = [
            local_env_file_name.as_str(),
            ".env.local",
            env_file_name,
            ".env",
        ];

        let mut candidates = Vec::with_capacity(roots.len() * file_names.len() * 2);
        for root in &roots {
            for dir in [root.clone(), root.join("auth-server")] {
                candidates.extend(file_names.iter().map(|name| dir.join(name)));
            }
        }
        candidates
    }
}

/// Pre-parsed configuration documents in precedence order. Only public keys
/// survive parsing, so nothing else can ever be resolved from this structure.
struct ConfigSources {
    process_values: HashMap<String, String>,
    runtime_config_documents: Vec<serde_json::Map<String, serde_json::Value>>,
    env_documents: Vec<HashMap<String, String>>,
    channel: UpdateChannel,
}

impl ConfigSources {
    fn load<R: Runtime>(locations: &ConfigLocations, app: &AppHandle<R>) -> Self {
        let process_values = PUBLIC_DESKTOP_CONFIG_KEYS
            .iter()
            .filter_map(|key| {
                non_empty_env_var(key).map(|value| ((*key).to_owned(), value))
            })
            .collect();

        let runtime_config_documents =
            load_runtime_config_documents(&locations.runtime_config_candidates());

        // Packaged builds must never pick up stray `.env` files from the
        // user's filesystem: configuration comes exclusively from the process
        // environment and the bundled `runtime-config.json`.
        let env_documents = if cfg!(debug_assertions) {
            load_env_documents(&locations.env_file_candidates(desktop_env_file_name()))
        } else {
            Vec::new()
        };

        Self {
            process_values,
            runtime_config_documents,
            env_documents,
            channel: UpdateChannel::from_version(
                &app.package_info().version.to_string(),
            ),
        }
    }

    fn resolve(&self, key: &str) -> Option<String> {
        if !is_public_desktop_config_key(key) {
            return None;
        }

        self.resolve_any(key)
    }

    /// Same precedence as [`Self::resolve`] but without the public-keys
    /// allowlist: for desktop-internal consumers only (bug report webhook,
    /// imgur client id). Values resolved here must never cross to the
    /// webview.
    fn resolve_any(&self, key: &str) -> Option<String> {
        self.process_values
            .get(key)
            .cloned()
            .or_else(|| self.resolve_from_runtime_config(key))
            .or_else(|| self.resolve_from_env_files(key))
    }

    fn resolve_from_runtime_config(&self, key: &str) -> Option<String> {
        self.runtime_config_documents
            .iter()
            .filter_map(|document| document.get(key)?.as_str())
            .map(str::trim)
            .find(|value| !value.is_empty())
            .map(str::to_owned)
    }

    fn resolve_from_env_files(&self, key: &str) -> Option<String> {
        self.env_documents
            .iter()
            .find_map(|document| document.get(key))
            .cloned()
    }
}

fn is_public_desktop_config_key(key: &str) -> bool {
    PUBLIC_DESKTOP_CONFIG_KEYS.contains(&key)
}

/// Reads a configuration document with a hard size cap; oversized or
/// non-UTF-8 sources are rejected instead of silently truncated.
fn read_config_document(path: &Path) -> io::Result<Option<String>> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(None);
        }
        Err(error) => return Err(error),
    };

    if !file.metadata()?.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "configuration source is not a regular file",
        ));
    }

    let mut bytes = Vec::new();
    file.take(MAX_CONFIG_FILE_BYTES + 1)
        .read_to_end(&mut bytes)?;

    if bytes.len() as u64 > MAX_CONFIG_FILE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "configuration document exceeds the size limit",
        ));
    }

    String::from_utf8(bytes)
        .map(Some)
        .map_err(|_| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                "configuration document is not valid UTF-8",
            )
        })
}

fn load_runtime_config_documents(
    candidates: &[PathBuf],
) -> Vec<serde_json::Map<String, serde_json::Value>> {
    candidates
        .iter()
        .filter_map(|path| {
            let raw = match read_config_document(path) {
                Ok(Some(raw)) => raw,
                Ok(None) => return None,
                Err(error) => {
                    tracing::warn!(
                        target: "desktop_config",
                        operation = "read_runtime_config",
                        error_kind = ?error.kind(),
                        "configuration source rejected"
                    );
                    return None;
                }
            };

            match serde_json::from_str::<
                serde_json::Map<String, serde_json::Value>,
            >(&raw)
            {
                Ok(mut document) => {
                    document.retain(|key, value| {
                        is_public_desktop_config_key(key) && value.is_string()
                    });

                    Some(document)
                }
                Err(error) => {
                    tracing::warn!(
                        target: "desktop_config",
                        operation = "parse_runtime_config",
                        line = error.line(),
                        column = error.column(),
                        "configuration source rejected"
                    );
                    None
                }
            }
        })
        .collect()
}

fn load_env_documents(candidates: &[PathBuf]) -> Vec<HashMap<String, String>> {
    candidates
        .iter()
        .filter_map(|path| match read_config_document(path) {
            Ok(Some(raw)) => Some(parse_env_document(&raw)),
            Ok(None) => None,
            Err(error) => {
                tracing::warn!(
                    target: "desktop_config",
                    operation = "read_env_config",
                    error_kind = ?error.kind(),
                    "configuration source rejected"
                );
                None
            }
        })
        .collect()
}

/// Parses a dotenv document. Within a single file the last non-empty
/// assignment of a key wins; non-public keys are dropped.
fn parse_env_document(raw: &str) -> HashMap<String, String> {
    let mut document = HashMap::new();

    for (key, value) in raw.lines().filter_map(parse_env_line) {
        if value.is_empty() || !is_public_desktop_config_key(key) {
            continue;
        }

        document.insert(key.to_owned(), value.to_owned());
    }

    document
}

fn parse_env_line(line: &str) -> Option<(&str, &str)> {
    let trimmed = line.trim();

    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }

    let trimmed = trimmed
        .strip_prefix("export ")
        .map_or(trimmed, str::trim);

    let (key, value) = trimmed.split_once('=')?;
    let key = key.trim();

    if !is_public_desktop_config_key(key) {
        return None;
    }

    Some((key, parse_env_value(value)?))
}

/// dotenv value semantics: quoted values must close their quote; unquoted
/// values end at the first `#` preceded by whitespace (inline comment).
fn parse_env_value(raw_value: &str) -> Option<&str> {
    let raw_value = raw_value.trim();

    for quote in ['"', '\''] {
        if let Some(inner) = raw_value.strip_prefix(quote) {
            let end = inner.find(quote)?;
            let trailing = inner[end + quote.len_utf8()..].trim();

            if !trailing.is_empty() && !trailing.starts_with('#') {
                return None;
            }

            return Some(&inner[..end]);
        }
    }

    let end = raw_value
        .match_indices('#')
        .find(|(index, _)| {
            *index == 0
                || raw_value[..*index].ends_with(char::is_whitespace)
        })
        .map_or(raw_value.len(), |(index, _)| index);

    Some(raw_value[..end].trim())
}

fn desktop_env_file_name() -> &'static str {
    match env::var("NODE_ENV")
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "production" => ".env.production",
        "development" => ".env.development",
        _ if cfg!(debug_assertions) => ".env.development",
        _ => ".env.production",
    }
}

fn non_empty_env_var(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}

// ---------------------------------------------------------------------------
// Runtime artifacts URL
// ---------------------------------------------------------------------------

fn resolve_runtime_artifacts_url(sources: &ConfigSources) -> String {
    RUNTIME_ARTIFACTS_ENV_KEYS
        .iter()
        .find_map(|key| sources.resolve(key))
        .map_or_else(
            || default_runtime_artifacts_url(),
            |raw| normalize_runtime_artifacts_url(&raw, sources.channel),
        )
}

fn default_runtime_artifacts_url() -> String {
    DEFAULT_RUNTIME_ARTIFACTS_URL.to_string()
}

fn normalize_runtime_artifacts_url(raw_url: &str, channel: UpdateChannel) -> String {
    let trimmed = raw_url.trim();

    let Ok(mut parsed) = parse_https_url(trimmed) else {
        tracing::warn!(
            operation = "resolve_runtime_artifacts_url",
            "invalid artifacts endpoint; using the default feed"
        );

        return default_runtime_artifacts_url();
    };

    // A direct manifest URL is used verbatim.
    if parsed.path().to_ascii_lowercase().ends_with(".json") {
        return trimmed.to_owned();
    }

    // GitHub release assets are flat: appending the release channel would
    // point at a directory that does not exist.
    if parsed.host_str() == Some("github.com") && parsed.path().contains("/releases/") {
        parsed.set_query(None);
        parsed.set_fragment(None);
        if !parsed.path().ends_with('/') {
            let path = format!("{}/", parsed.path());
            parsed.set_path(&path);
        }
        return parsed.to_string();
    }

    let path = normalize_runtime_artifacts_path(parsed.path(), channel);
    parsed.set_path(&path);
    parsed.to_string()
}

fn normalize_runtime_artifacts_path(path: &str, channel: UpdateChannel) -> String {
    // Match the segment itself, with or without a trailing slash: a path
    // ending in "mini-backend-artifacts" must not get a duplicate channel
    // segment appended.
    if path.to_ascii_lowercase().contains("mini-backend-artifacts") {
        return if path.ends_with('/') {
            path.to_owned()
        } else {
            format!("{path}/")
        };
    }

    let mut segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    match segments.last_mut() {
        Some(last) if UpdateChannel::from_segment(last).is_some() => *last = channel.as_str(),
        _ => segments.push(channel.as_str()),
    }

    let mut normalized = String::with_capacity(path.len() + 8);
    for segment in segments {
        normalized.push('/');
        normalized.push_str(segment);
    }
    normalized.push('/');
    normalized
}

// ---------------------------------------------------------------------------
// URL policy helpers
// ---------------------------------------------------------------------------

/// Strict HTTPS policy for externally opened URLs: standard port only,
/// no credentials, public domains only (static allowlist decides access).
fn parse_https_url(raw_url: &str) -> Result<Url, DesktopError> {
    if raw_url.len() > MAX_URL_BYTES {
        return Err(DesktopError::UrlTooLong);
    }

    let trimmed = raw_url.trim();

    if trimmed.is_empty() {
        return Err(DesktopError::MissingUrl);
    }

    if trimmed.chars().any(char::is_control) || trimmed.contains('\\') {
        return Err(DesktopError::InvalidUrl);
    }

    let parsed =
        Url::parse(trimmed).map_err(|_| DesktopError::InvalidUrl)?;

    if parsed.scheme() != "https" {
        return Err(DesktopError::InsecureScheme);
    }

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(DesktopError::EmbeddedCredentials);
    }

    if parsed.port_or_known_default() != Some(443) {
        return Err(DesktopError::PortNotAllowed);
    }

    match parsed.host() {
        Some(Host::Domain(domain)) if is_public_domain(domain) => Ok(parsed),
        _ => Err(DesktopError::HostNotAllowed),
    }
}

/// Only true loopback targets may be probed: literal IPv4/IPv6 loopback or
/// the `localhost` name (normalised to `127.0.0.1` so no DNS lookup runs).
fn parse_loopback_url(raw_url: &str) -> Result<Url, DesktopError> {
    if raw_url.len() > MAX_URL_BYTES {
        return Err(DesktopError::UrlTooLong);
    }

    let mut parsed =
        Url::parse(raw_url.trim()).map_err(|_| DesktopError::InvalidLoopbackUrl)?;

    if !matches!(parsed.scheme(), "http" | "https")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || parsed.port() == Some(0)
    {
        return Err(DesktopError::InvalidLoopbackUrl);
    }

    match parsed.host() {
        Some(Host::Ipv4(address)) if address.is_loopback() => {}
        Some(Host::Ipv6(address)) if address.is_loopback() => {}
        Some(Host::Domain(domain))
            if domain.eq_ignore_ascii_case("localhost")
                || domain.eq_ignore_ascii_case("localhost.") =>
        {
            parsed
                .set_host(Some("127.0.0.1"))
                .map_err(|_| DesktopError::InvalidLoopbackUrl)?;
        }
        _ => return Err(DesktopError::InvalidLoopbackUrl),
    }

    Ok(parsed)
}

fn host_matches_suffix(host: &str, suffix: &str) -> bool {
    host == suffix
        || host
            .strip_suffix(suffix)
            .is_some_and(|prefix| prefix.ends_with('.'))
}

fn is_public_domain(domain: &str) -> bool {
    let host = normalize_host(domain);

    let reserved_suffixes = [
        "localhost",
        "local",
        "internal",
        "home.arpa",
        "test",
        "invalid",
        "example",
        "onion",
    ];

    host.contains('.')
        && !reserved_suffixes
            .iter()
            .any(|suffix| host_matches_suffix(&host, suffix))
}

fn insert_url_host(hosts: &mut HashSet<String>, raw_url: &str) {
    if let Ok(parsed) = parse_https_url(raw_url) {
        if let Some(host) = parsed.host_str() {
            hosts.insert(normalize_host(host));
        }
    }
}

fn normalize_loopback_url(raw_url: &str) -> String {
    match parse_loopback_url(raw_url) {
        Ok(parsed) => parsed
            .to_string()
            .trim_end_matches('/')
            .to_owned(),
        Err(error) => {
            tracing::warn!(
                operation = "resolve_local_backend_url",
                error_code = ?error,
                "invalid local backend configuration; using default"
            );

            DEFAULT_LOCAL_API_URL.to_owned()
        }
    }
}

fn normalize_host(host: &str) -> String {
    host.trim().trim_end_matches('.').to_ascii_lowercase()
}

fn normalize_locale_tag(raw: &str) -> Option<String> {
    let tag = raw
        .trim()
        .split(['.', '@', ':'])
        .next()?
        .replace('_', "-");
    if tag.is_empty() || tag.eq_ignore_ascii_case("c") || tag.eq_ignore_ascii_case("posix") {
        None
    } else {
        Some(tag)
    }
}

// ---------------------------------------------------------------------------
// Infrastructure helpers
// ---------------------------------------------------------------------------

static LOOPBACK_HTTP_CLIENT: OnceLock<Option<reqwest::Client>> = OnceLock::new();

/// Shared client for loopback probes: no system proxy (a corporate proxy
/// must never sit between us and 127.0.0.1), no redirects, tight timeouts.
fn loopback_http_client() -> Option<&'static reqwest::Client> {
    LOOPBACK_HTTP_CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .timeout(DESKTOP_FETCH_TIMEOUT)
                .connect_timeout(DESKTOP_CONNECT_TIMEOUT)
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .pool_max_idle_per_host(1)
                .build()
                .inspect_err(|_| {
                    tracing::error!(
                        operation = "build_loopback_http_client",
                        "failed to construct HTTP client"
                    );
                })
                .ok()
        })
        .as_ref()
}

async fn run_blocking<T, F>(task: F) -> Result<T, DesktopError>
where
    F: FnOnce() -> Result<T, DesktopError> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|_| {
            tracing::error!(
                operation = "desktop_background_task",
                "background task failed"
            );
            DesktopError::TaskJoin
        })?
}

fn app_user_data_dir<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<PathBuf, DesktopError> {
    app.path().app_data_dir().map_err(|_| {
        tracing::error!(
            operation = "resolve_app_data_directory",
            "failed to resolve application data directory"
        );
        DesktopError::AppDataDir
    })
}

fn open_url<R: Runtime>(
    app: &AppHandle<R>,
    target: &Url,
) -> Result<(), DesktopError> {
    app.opener()
        .open_url(target.as_str(), None::<&str>)
        .map_err(|_| {
            tracing::error!(
                operation = "open_external_url",
                "external URL opener failed"
            );
            DesktopError::Opener
        })
}

fn ancestor_dirs(start: &Path, max_depth: usize) -> Vec<PathBuf> {
    start
        .ancestors()
        .take(max_depth)
        .map(Path::to_path_buf)
        .collect()
}

fn dedupe_paths<I: IntoIterator<Item = PathBuf>>(paths: I) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    paths
        .into_iter()
        .filter(|path| seen.insert(path.clone()))
        .collect()
}

/// Removes a file, directory or symlink without following the link.
/// Returns whether anything was removed.
fn remove_path_if_present(path: &Path) -> io::Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => remove_symlink(path).map(|()| true),
        Ok(metadata) if metadata.is_dir() => fs::remove_dir_all(path).map(|()| true),
        Ok(_) => fs::remove_file(path).map(|()| true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

/// Decides how to unlink a symlink from its own metadata, never from the
/// target's: a directory-junction target cannot decide the removal mode.
#[cfg(windows)]
fn remove_symlink(path: &Path) -> io::Result<()> {
    use std::os::windows::fs::FileTypeExt;

    let file_type = fs::symlink_metadata(path)?.file_type();

    if file_type.is_symlink_dir() {
        fs::remove_dir(path)
    } else {
        fs::remove_file(path)
    }
}

#[cfg(not(windows))]
fn remove_symlink(path: &Path) -> io::Result<()> {
    fs::remove_file(path)
}

#[cfg(test)]
mod tests {
    use super::*;

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
