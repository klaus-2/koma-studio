//! Desktop-level IPC adapters: runtime configuration discovery, locale
//! preferences, local settings reset, application restart, local backend
//! health probing and hardened external URL opening.
//!
//! Configuration is resolved exactly once per process (see
//! [`resolved_desktop_config`]) and cached in Tauri managed state; every
//! command after the first pays only a pointer clone.

use std::{
    collections::{HashMap, HashSet},
    env, fs, io,
    path::{Path, PathBuf},
    sync::{Arc, OnceLock},
    time::Duration,
};

use serde::{Serialize, Serializer};
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
const DEFAULT_UPDATE_SERVER_URL: &str = "https://api.koma-studio.site/updates/";
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

const FORBIDDEN_RUNTIME_CONFIG_KEYS: &[&str] = &[
    "DESKTOP_BOOTSTRAP_SECRET",
    "JWT_SECRET",
    "BETTER_AUTH_SECRET",
];
const FORBIDDEN_RUNTIME_CONFIG_KEY_MARKERS: &[&str] =
    &["SECRET", "PASSWORD", "PRIVATE_KEY", "API_KEY"];

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

#[derive(Debug, Error)]
pub enum DesktopError {
    #[error("external URL is missing")]
    MissingUrl,
    #[error("external URL is invalid")]
    InvalidUrl,
    #[error("only HTTPS links are allowed")]
    InsecureScheme,
    #[error("URLs with embedded credentials are not allowed")]
    EmbeddedCredentials,
    #[error("external URL host is not allowed")]
    HostNotAllowed,
    #[error("failed to open URL: {0}")]
    Opener(#[from] tauri_plugin_opener::Error),
    #[error("failed to resolve application data directory: {0}")]
    AppDataDir(#[source] tauri::Error),
    #[error("failed to clear local configuration at {path}: {source}")]
    ClearLocalSettings {
        path: PathBuf,
        #[source]
        source: io::Error,
    },
    #[error("background task failed: {0}")]
    TaskJoin(#[source] tauri::Error),
    #[error("{0}")]
    Runtime(String),
    #[error("{0}")]
    Sidecar(String),
}

/// The frontend contract is a plain error string; keep it stable while the
/// Rust side gets a real error hierarchy.
impl Serialize for DesktopError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

// ---------------------------------------------------------------------------
// IPC payloads
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeConfig {
    pub auth_api_url: String,
    pub local_api_url: String,
    pub runtime_artifacts_url: String,
    pub app_packaged: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LocalePreferences {
    pub app_locale: String,
    pub system_locales: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResetLocalSettingsResult {
    pub cleared: bool,
    pub user_data_path: String,
    pub cleared_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
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
        log::info!("restarting application by user request");
        app.restart();
    });

    RestartAppResult { restarting: true }
}

#[tauri::command(rename = "desktop:get-mini-backend-runtime-state")]
pub fn get_mini_backend_runtime_state<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
) -> Result<RuntimeMiniBackendRuntimeState, DesktopError> {
    snapshot_runtime_state(&app, &store).map_err(|error| DesktopError::Runtime(error.to_string()))
}

#[tauri::command(rename = "desktop:check-local-backend")]
pub async fn check_local_backend<R: Runtime>(app: AppHandle<R>) -> Result<bool, DesktopError> {
    let local_api_url = resolved_desktop_config(&app).runtime.local_api_url.clone();
    Ok(check_local_backend_health(&local_api_url).await)
}

#[tauri::command(rename = "desktop:restart-local-backend")]
pub async fn restart_local_backend<R: Runtime + 'static>(
    app: AppHandle<R>,
) -> Result<bool, DesktopError> {
    crate::sidecar::mini_backend::restart_mini_backend(app)
        .await
        .map_err(DesktopError::Sidecar)
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
                log::warn!("blocked external URL open request: {error}");
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
            log::warn!("blocked community URL open request: {error}");
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

/// Resolves a non-secret configuration value using the precedence
/// process env → `runtime-config.json` → `.env` files (dev builds only).
pub(crate) fn resolve_desktop_env_value<R: Runtime>(
    app: &AppHandle<R>,
    key: &str,
) -> Option<String> {
    resolved_desktop_config(app).sources.resolve(key)
}

pub fn reset_local_settings_at(
    user_data_dir: &Path,
) -> Result<ResetLocalSettingsResult, DesktopError> {
    let mut cleared_paths = Vec::with_capacity(LOCAL_SETTINGS_ENTRIES.len());
    for entry in LOCAL_SETTINGS_ENTRIES {
        let target = user_data_dir.join(entry);
        let removed = remove_path_if_present(&target).map_err(|source| {
            DesktopError::ClearLocalSettings {
                path: target.clone(),
                source,
            }
        })?;
        if removed {
            cleared_paths.push(target.to_string_lossy().into_owned());
        }
    }

    log::info!("local desktop settings cleared (count={})", cleared_paths.len());

    Ok(ResetLocalSettingsResult {
        cleared: true,
        user_data_path: user_data_dir.to_string_lossy().into_owned(),
        cleared_paths,
    })
}

pub async fn check_local_backend_health(local_api_url: &str) -> bool {
    let Some(client) = loopback_http_client() else {
        return false;
    };
    let endpoint = format!("{}/health", local_api_url.trim_end_matches('/'));

    for attempt in 0..=DESKTOP_FETCH_RETRY_COUNT {
        match client.get(&endpoint).send().await {
            Ok(response) if response.status().is_success() => return true,
            Ok(response) => log::debug!(
                "local backend health check attempt {} returned non-success status {}",
                attempt,
                response.status()
            ),
            Err(error) => log::debug!(
                "local backend health check attempt {} failed: {}",
                attempt,
                error
            ),
        }
        if attempt < DESKTOP_FETCH_RETRY_COUNT {
            tokio::time::sleep(DESKTOP_FETCH_RETRY_DELAY).await;
        }
    }

    false
}

/// Validates an arbitrary URL against the strict external policy:
/// HTTPS, no embedded credentials, host in the dynamic allowlist or under an
/// allowed suffix.
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

/// Community links may point at any *public* HTTPS origin, but never at
/// loopback, link-local names, IP literals or single-label intranet hosts.
pub fn validate_community_url(raw_url: &str) -> Result<Url, DesktopError> {
    let parsed = parse_https_url(raw_url)?;
    match parsed.host() {
        Some(Host::Domain(domain)) if is_public_domain(domain) => Ok(parsed),
        _ => Err(DesktopError::HostNotAllowed),
    }
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

        log::info!(
            "desktop runtime configuration resolved (channel={}, auth_api_url={local_api_url}, local_api_url={auth_api_url}, runtime_artifacts_url={runtime_artifacts_url}, allowed_hosts={})",
            sources.channel.as_str(),
            allowed_external_hosts.len()
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

fn resolved_desktop_config<R: Runtime>(app: &AppHandle<R>) -> SharedDesktopConfig {
    if let Some(cached) = app.try_state::<SharedDesktopConfig>() {
        return Arc::clone(cached.inner());
    }

    let resolved: SharedDesktopConfig = Arc::new(ResolvedDesktopConfig::from_sources(
        ConfigSources::load(&ConfigLocations::from_app(app), app),
    ));
    // `manage` is first-writer-wins under concurrent first calls; re-reading
    // guarantees every caller observes the single canonical instance.
    app.manage(resolved);
    Arc::clone(app.state::<SharedDesktopConfig>().inner())
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

/// Legacy free-function name still imported by `commands::bug_report`.
pub(crate) fn update_channel_from_version(version: &str) -> String {
    UpdateChannel::from_version(version).as_str().to_owned()
}

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
        let roots = self.current_dir.iter().chain(self.resource_dir.iter());
        dedupe_paths(roots.flat_map(|root| {
            [
                root.join(RUNTIME_CONFIG_FILE),
                root.join(LEGACY_RUNTIME_CONFIG_DIR).join(RUNTIME_CONFIG_FILE),
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

/// Pre-parsed configuration documents in precedence order. Secrets are
/// filtered out at parse time so they never reside in this structure.
struct ConfigSources {
    runtime_config_documents: Vec<serde_json::Map<String, serde_json::Value>>,
    env_documents: Vec<HashMap<String, String>>,
    channel: UpdateChannel,
}

impl ConfigSources {
    fn load<R: Runtime>(locations: &ConfigLocations, app: &AppHandle<R>) -> Self {
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
            runtime_config_documents,
            env_documents,
            channel: UpdateChannel::from_version(&app.package_info().version.to_string()),
        }
    }

    fn resolve(&self, key: &str) -> Option<String> {
        if is_forbidden_runtime_config_key(key) {
            return None;
        }

        non_empty_env_var(key)
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

fn load_runtime_config_documents(
    candidates: &[PathBuf],
) -> Vec<serde_json::Map<String, serde_json::Value>> {
    candidates
        .iter()
        .filter_map(|path| {
            let raw = match fs::read_to_string(path) {
                Ok(raw) => raw,
                Err(error) if error.kind() == io::ErrorKind::NotFound => return None,
                Err(error) => {
                    log::warn!(target: "desktop_config", "unable to read runtime config {}: {}", path.display(), error);
                    return None;
                }
            };
            match serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&raw) {
                Ok(mut document) => {
                    document.retain(|key, _| !is_forbidden_runtime_config_key(key));
                    log::debug!(target: "desktop_config", "loaded runtime config {}", path.display());
                    Some(document)
                }
                Err(error) => {
                    log::warn!(target: "desktop_config", "runtime config {} is not valid JSON: {}", path.display(), error);
                    None
                }
            }
        })
        .collect()
}

fn load_env_documents(candidates: &[PathBuf]) -> Vec<HashMap<String, String>> {
    candidates
        .iter()
        .filter_map(|path| {
            let raw = fs::read_to_string(path).ok()?;
            log::debug!(target: "desktop_config", "loaded env file {}", path.display());
            Some(parse_env_document(&raw))
        })
        .collect()
}

/// Parses a dotenv document. Within a single file the last non-empty
/// assignment of a key wins; secret keys are dropped.
fn parse_env_document(raw: &str) -> HashMap<String, String> {
    let mut document = HashMap::new();
    for (key, value) in raw.lines().filter_map(parse_env_line) {
        if value.is_empty() || is_forbidden_runtime_config_key(key) {
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
    let trimmed = trimmed.strip_prefix("export ").map_or(trimmed, str::trim);
    let (key, value) = trimmed.split_once('=')?;
    Some((key.trim(), parse_env_value(value)))
}

/// dotenv value semantics: quoted values end at the matching quote; unquoted
/// values end at the first `#` preceded by whitespace (inline comment).
fn parse_env_value(raw_value: &str) -> &str {
    let raw_value = raw_value.trim();
    for quote in ['"', '\''] {
        if let Some(inner) = raw_value.strip_prefix(quote) {
            return inner.find(quote).map_or(inner, |end| &inner[..end]);
        }
    }

    let end = raw_value
        .match_indices('#')
        .find(|(index, _)| raw_value[..*index].ends_with(char::is_whitespace))
        .map_or(raw_value.len(), |(index, _)| index);
    raw_value[..end].trim()
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

fn is_forbidden_runtime_config_key(key: &str) -> bool {
    let upper = key.trim().to_ascii_uppercase();
    FORBIDDEN_RUNTIME_CONFIG_KEYS.contains(&upper.as_str())
        || FORBIDDEN_RUNTIME_CONFIG_KEY_MARKERS
            .iter()
            .any(|marker| upper.contains(marker))
}

// ---------------------------------------------------------------------------
// Runtime artifacts URL
// ---------------------------------------------------------------------------

fn resolve_runtime_artifacts_url(sources: &ConfigSources) -> String {
    RUNTIME_ARTIFACTS_ENV_KEYS
        .iter()
        .find_map(|key| sources.resolve(key))
        .map_or_else(
            || default_runtime_artifacts_url(sources.channel),
            |raw| normalize_runtime_artifacts_url(&raw, sources.channel),
        )
}

fn default_runtime_artifacts_url(channel: UpdateChannel) -> String {
    format!(
        "{}/{}/",
        DEFAULT_UPDATE_SERVER_URL.trim_end_matches('/'),
        channel.as_str()
    )
}

fn normalize_runtime_artifacts_url(raw_url: &str, channel: UpdateChannel) -> String {
    let trimmed = raw_url.trim();
    let Ok(mut parsed) = Url::parse(trimmed) else {
        log::warn!(
            "configured runtime artifacts URL is not an absolute URL; using channel default"
        );
        return default_runtime_artifacts_url(channel);
    };

    // A direct manifest URL is used verbatim.
    if parsed.path().to_ascii_lowercase().ends_with(".json") {
        return trimmed.to_owned();
    }

    let path = normalize_runtime_artifacts_path(parsed.path(), channel);
    parsed.set_path(&path);
    parsed.to_string()
}

fn normalize_runtime_artifacts_path(path: &str, channel: UpdateChannel) -> String {
    if path
        .to_ascii_lowercase()
        .contains("/mini-backend-artifacts/")
    {
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

fn parse_https_url(raw_url: &str) -> Result<Url, DesktopError> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return Err(DesktopError::MissingUrl);
    }
    let parsed = Url::parse(trimmed).map_err(|_| DesktopError::InvalidUrl)?;
    if parsed.scheme() != "https" {
        return Err(DesktopError::InsecureScheme);
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(DesktopError::EmbeddedCredentials);
    }
    if parsed.host_str().is_none() {
        return Err(DesktopError::InvalidUrl);
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
    host.contains('.')
        && host != "localhost"
        && !host.ends_with(".localhost")
        && !host.ends_with(".local")
}

fn insert_url_host(hosts: &mut HashSet<String>, raw_url: &str) {
    if let Some(host) = Url::parse(raw_url)
        .ok()
        .and_then(|parsed| parsed.host_str().map(normalize_host))
    {
        hosts.insert(host);
    }
}

fn normalize_loopback_url(raw_url: &str) -> String {
    let Ok(mut parsed) = Url::parse(raw_url) else {
        return raw_url.to_owned();
    };
    if parsed.host_str().map(normalize_host).as_deref() != Some("localhost") {
        return raw_url.to_owned();
    }
    if parsed.set_host(Some("127.0.0.1")).is_ok() {
        parsed.to_string().trim_end_matches('/').to_owned()
    } else {
        raw_url.to_owned()
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
                .inspect_err(|error| {
                    log::error!("failed to build loopback HTTP client: {error}");
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
        .map_err(DesktopError::TaskJoin)?
}

fn app_user_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, DesktopError> {
    app.path()
        .app_data_dir()
        .map_err(DesktopError::AppDataDir)
}

fn open_url<R: Runtime>(app: &AppHandle<R>, target: &Url) -> Result<(), DesktopError> {
    log::debug!("opening external URL (host={:?})", target.host_str());
    app.opener().open_url(target.as_str(), None::<&str>)?;
    Ok(())
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

#[cfg(windows)]
fn remove_symlink(path: &Path) -> io::Result<()> {
    // Directory symlinks and junctions on Windows are removed with
    // `remove_dir`; `remove_file` fails on them with ACCESS_DENIED.
    match fs::metadata(path) {
        Ok(target) if target.is_dir() => fs::remove_dir(path),
        _ => fs::remove_file(path),
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
    fn external_url_requires_https_and_allowed_host() {
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
    fn community_url_requires_https_and_public_domain() {
        assert!(validate_community_url("https://discord.gg/koma").is_ok());
        assert!(validate_community_url("https://any-public-site.example/x").is_ok());
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
        assert!(matches!(
            validate_community_url("https://intranet/"),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_community_url("https://printer.local/"),
            Err(DesktopError::HostNotAllowed)
        ));
        assert!(matches!(
            validate_community_url("https://a:b@discord.gg/"),
            Err(DesktopError::EmbeddedCredentials)
        ));
        assert_eq!(
            validate_community_url("http://discord.gg/koma")
                .unwrap_err()
                .to_string(),
            "only HTTPS links are allowed"
        );
    }

    #[test]
    fn error_serializes_as_plain_string() {
        let json = serde_json::to_string(&DesktopError::HostNotAllowed).unwrap();
        assert_eq!(json, "\"external URL host is not allowed\"");
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
    fn normalize_loopback_rewrites_localhost_only() {
        assert_eq!(
            normalize_loopback_url("http://localhost:8001/"),
            "http://127.0.0.1:8001"
        );
        assert_eq!(
            normalize_loopback_url("https://example.com/"),
            "https://example.com/"
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
        assert_eq!(
            normalize_runtime_artifacts_url("https://cdn.example.com", UpdateChannel::Stable),
            "https://cdn.example.com/stable/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url("not a url", UpdateChannel::Beta),
            default_runtime_artifacts_url(UpdateChannel::Beta)
        );
    }

    #[test]
    fn resolves_default_runtime_artifacts_url_by_channel() {
        assert_eq!(
            default_runtime_artifacts_url(UpdateChannel::Beta),
            "https://api.koma-studio.site/updates/beta/"
        );
        assert_eq!(
            default_runtime_artifacts_url(UpdateChannel::Stable),
            "https://api.koma-studio.site/updates/stable/"
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
            "SINGLE='https://single.example.test' # trailing\n",
            "UNQUOTED=https://plain.example.test # inline comment\n",
            "HASH_INSIDE=abc#def\n",
            "EMPTY=\n",
            "JWT_SECRET=should-never-be-loaded\n",
        ));

        assert_eq!(
            document.get("VITE_AUTH_API_URL").map(String::as_str),
            Some("https://auth.example.test")
        );
        assert_eq!(
            document.get("SINGLE").map(String::as_str),
            Some("https://single.example.test")
        );
        assert_eq!(
            document.get("UNQUOTED").map(String::as_str),
            Some("https://plain.example.test")
        );
        assert_eq!(
            document.get("HASH_INSIDE").map(String::as_str),
            Some("abc#def")
        );
        assert!(!document.contains_key("EMPTY"));
        assert!(!document.contains_key("JWT_SECRET"));
    }

    #[test]
    fn env_documents_are_loaded_from_disk_in_candidate_order() {
        let temp = tempfile::tempdir().unwrap();
        let first = temp.path().join(".env.local");
        let second = temp.path().join(".env");
        fs::write(&first, "KOMA_TEST_ORDER=first\n").unwrap();
        fs::write(&second, "KOMA_TEST_ORDER=second\nKOMA_TEST_ONLY_SECOND=yes\n").unwrap();

        let documents = load_env_documents(&[first, temp.path().join("missing"), second]);
        let resolved = sources(Vec::new(), documents, UpdateChannel::Stable);

        assert_eq!(resolved.resolve("KOMA_TEST_ORDER").as_deref(), Some("first"));
        assert_eq!(
            resolved.resolve("KOMA_TEST_ONLY_SECOND").as_deref(),
            Some("yes")
        );
    }

    #[test]
    fn runtime_config_takes_precedence_over_env_files_and_filters_secrets() {
        let temp = tempfile::tempdir().unwrap();
        let config_path = temp.path().join(RUNTIME_CONFIG_FILE);
        fs::write(
            &config_path,
            r#"{"KOMA_TEST_PRECEDENCE":"from-json","JWT_SECRET":"nope","KOMA_TEST_BLANK":"  "}"#,
        )
        .unwrap();

        let resolved = sources(
            load_runtime_config_documents(&[config_path, temp.path().join("absent.json")]),
            vec![env_doc(&[
                ("KOMA_TEST_PRECEDENCE", "from-env"),
                ("KOMA_TEST_BLANK", "from-env"),
            ])],
            UpdateChannel::Stable,
        );

        assert_eq!(
            resolved.resolve("KOMA_TEST_PRECEDENCE").as_deref(),
            Some("from-json")
        );
        assert_eq!(resolved.resolve("KOMA_TEST_BLANK").as_deref(), Some("from-env"));
        assert_eq!(resolved.resolve("JWT_SECRET"), None);
        assert_eq!(resolved.resolve("SOME_API_KEY"), None);
        assert!(resolved.runtime_config_documents[0].get("JWT_SECRET").is_none());
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
                ("VITE_AUTH_API_URL", "https://auth.koma-test.example"),
                ("VITE_LOCAL_API_URL", "http://localhost:8001/"),
                ("VITE_PROJECT_WEBSITE_URL", "https://www.koma-test.example/"),
            ])],
            Vec::new(),
            UpdateChannel::Beta,
        ));

        assert_eq!(resolved.runtime.local_api_url, "http://127.0.0.1:8001");
        assert_eq!(
            resolved.runtime.runtime_artifacts_url,
            "https://api.koma-studio.site/updates/beta/"
        );
        assert!(resolved
            .allowed_external_hosts
            .contains("auth.koma-test.example"));
        assert!(resolved
            .allowed_external_hosts
            .contains("www.koma-test.example"));
        assert!(validate_external_url(
            "https://www.koma-test.example/docs",
            &resolved.allowed_external_hosts
        )
        .is_ok());
    }

    #[test]
    fn runtime_config_candidates_include_root_and_legacy_dir() {
        let locations = ConfigLocations {
            current_dir: Some(PathBuf::from("/app")),
            exe_dir: None,
            resource_dir: Some(PathBuf::from("/app")),
        };
        let candidates = locations.runtime_config_candidates();

        assert_eq!(
            candidates,
            vec![
                PathBuf::from("/app").join(RUNTIME_CONFIG_FILE),
                PathBuf::from("/app")
                    .join(LEGACY_RUNTIME_CONFIG_DIR)
                    .join(RUNTIME_CONFIG_FILE),
            ]
        );
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
