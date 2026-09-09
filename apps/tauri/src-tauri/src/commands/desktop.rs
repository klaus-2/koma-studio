use std::{
    collections::HashSet,
    env, fs,
    path::{Path, PathBuf},
    thread,
    time::Duration,
};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_shell::ShellExt;
use url::Url;

use crate::runtime::profiles::{
    snapshot_runtime_state, MiniBackendRuntimeState as RuntimeMiniBackendRuntimeState,
    MiniBackendRuntimeStore,
};

const DEFAULT_AUTH_API_URL: &str = "http://127.0.0.1:3001";
const DEFAULT_LOCAL_API_URL: &str = "http://127.0.0.1:8001";
const DEFAULT_UPDATE_SERVER_URL: &str = "https://api.koma-studio.site/updates/";
const DESKTOP_FETCH_TIMEOUT: Duration = Duration::from_secs(12);
const DESKTOP_FETCH_RETRY_COUNT: usize = 1;
const IDENTITY_CACHE_FILE: &str = "desktop-identity-cache.json";
const RUNTIME_SELECTION_FILE: &str = "mini-backend-runtime-selection.json";

const FORBIDDEN_RUNTIME_CONFIG_KEYS: &[&str] = &[
    "DESKTOP_BOOTSTRAP_SECRET",
    "JWT_SECRET",
    "BETTER_AUTH_SECRET",
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

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeConfig {
    pub auth_api_url: String,
    pub local_api_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_artifacts_url: Option<String>,
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

#[tauri::command(rename = "desktop:get-runtime-config")]
pub fn get_runtime_config<R: Runtime>(app: AppHandle<R>) -> Result<RuntimeConfig, String> {
    build_runtime_config(&app)
}

#[tauri::command(rename = "desktop:locale:get-preferences")]
pub fn get_locale_preferences() -> LocalePreferences {
    let app_locale = resolve_system_locale();
    LocalePreferences {
        app_locale: app_locale.clone(),
        system_locales: vec![app_locale],
    }
}

#[tauri::command(rename = "desktop:reset-local-settings")]
pub fn reset_local_settings<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ResetLocalSettingsResult, String> {
    let user_data_dir = app_user_data_dir(&app)?;
    reset_local_settings_at(&user_data_dir)
}

#[tauri::command(rename = "desktop:restart-app")]
pub fn restart_app<R: Runtime>(app: AppHandle<R>) -> RestartAppResult {
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(50));
        app.restart();
    });

    RestartAppResult { restarting: true }
}

#[tauri::command(rename = "desktop:get-mini-backend-runtime-state")]
pub fn get_mini_backend_runtime_state<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
) -> Result<RuntimeMiniBackendRuntimeState, String> {
    snapshot_runtime_state(&app, &store)
}

#[tauri::command(rename = "desktop:check-local-backend")]
pub async fn check_local_backend<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    let config = build_runtime_config(&app)?;
    Ok(check_local_backend_health(&config.local_api_url).await)
}

#[tauri::command(rename = "desktop:restart-local-backend")]
pub async fn restart_local_backend<R: Runtime + 'static>(
    app: AppHandle<R>,
) -> Result<bool, String> {
    crate::sidecar::mini_backend::restart_mini_backend(app).await
}

#[tauri::command(rename = "desktop:open-external")]
pub fn open_external<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
    let target_url = url.trim();
    if target_url.is_empty() {
        return Err("URL externa ausente.".to_string());
    }
    if !is_allowed_external_url(target_url, &build_allowed_external_hosts(&app)?) {
        return Err("External URL is not allowed.".to_string());
    }

    open_url(&app, target_url)
}

#[tauri::command(rename = "desktop:open-community-link")]
pub fn open_community_link<R: Runtime>(app: AppHandle<R>, url: String) -> Result<(), String> {
    let parsed = validate_community_url(&url)?;
    open_url(&app, parsed.as_str())
}

pub fn build_runtime_config<R: Runtime>(app: &AppHandle<R>) -> Result<RuntimeConfig, String> {
    let auth_api_url = resolve_desktop_env_value(app, "VITE_AUTH_API_URL")?
        .unwrap_or_else(|| DEFAULT_AUTH_API_URL.to_string());
    let local_api_url = normalize_loopback_url(
        &resolve_desktop_env_value(app, "VITE_LOCAL_API_URL")?
            .unwrap_or_else(|| DEFAULT_LOCAL_API_URL.to_string()),
    );
    let runtime_artifacts_url = resolve_runtime_artifacts_url(app)?;

    Ok(RuntimeConfig {
        auth_api_url,
        local_api_url,
        runtime_artifacts_url,
        app_packaged: !cfg!(debug_assertions),
    })
}

pub fn reset_local_settings_at(user_data_dir: &Path) -> Result<ResetLocalSettingsResult, String> {
    let targets = [
        user_data_dir.join("secure-store"),
        user_data_dir.join(IDENTITY_CACHE_FILE),
        user_data_dir.join(RUNTIME_SELECTION_FILE),
    ];

    let mut cleared_paths = Vec::with_capacity(targets.len());
    for target in targets {
        remove_path_if_present(&target).map_err(|error| {
            format!(
                "Failed to clear local configuration {}: {error}",
                target.display()
            )
        })?;
        cleared_paths.push(target.to_string_lossy().to_string());
    }

    Ok(ResetLocalSettingsResult {
        cleared: true,
        user_data_path: user_data_dir.to_string_lossy().to_string(),
        cleared_paths,
    })
}

pub async fn check_local_backend_health(local_api_url: &str) -> bool {
    let endpoint = format!("{}/health", local_api_url.trim_end_matches('/'));
    let client = match reqwest::Client::builder()
        .timeout(DESKTOP_FETCH_TIMEOUT)
        .build()
    {
        Ok(client) => client,
        Err(_) => return false,
    };

    for attempt in 0..=DESKTOP_FETCH_RETRY_COUNT {
        match client.get(&endpoint).send().await {
            Ok(response) if response.status().is_success() => return true,
            _ if attempt < DESKTOP_FETCH_RETRY_COUNT => {
                tokio::time::sleep(Duration::from_millis(150)).await;
            }
            _ => return false,
        }
    }

    false
}

pub fn is_allowed_external_url(raw_url: &str, allowed_hosts: &HashSet<String>) -> bool {
    let Ok(parsed) = Url::parse(raw_url) else {
        return false;
    };
    if parsed.scheme() != "https" {
        return false;
    }

    let Some(host) = parsed.host_str().map(normalize_host) else {
        return false;
    };
    allowed_hosts.contains(&host)
        || EXTERNAL_ALLOWED_HOST_SUFFIXES
            .iter()
            .any(|suffix| host == *suffix || host.ends_with(&format!(".{suffix}")))
}

pub fn validate_community_url(raw_url: &str) -> Result<Url, String> {
    let target_url = raw_url.trim();
    if target_url.is_empty() {
        return Err("URL comunitaria ausente.".to_string());
    }

    let parsed = Url::parse(target_url).map_err(|_| "URL comunitaria invalida.".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only HTTPS links are allowed.".to_string());
    }

    Ok(parsed)
}

fn app_user_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

#[allow(deprecated)]
fn open_url<R: Runtime>(app: &AppHandle<R>, target_url: &str) -> Result<(), String> {
    app.shell()
        .open(target_url, None)
        .map_err(|error| error.to_string())
}

fn resolve_system_locale() -> String {
    for key in ["LANGUAGE", "LC_ALL", "LC_MESSAGES", "LANG"] {
        if let Ok(value) = env::var(key) {
            let locale = value
                .split(['.', ':'])
                .next()
                .unwrap_or_default()
                .replace('_', "-");
            if !locale.trim().is_empty() && locale != "C" {
                return locale;
            }
        }
    }

    "pt-BR".to_string()
}

fn build_allowed_external_hosts<R: Runtime>(app: &AppHandle<R>) -> Result<HashSet<String>, String> {
    let config = build_runtime_config(app)?;
    let mut hosts = HashSet::new();
    for raw_url in [
        Some(config.auth_api_url),
        Some(config.local_api_url),
        config.runtime_artifacts_url,
        resolve_desktop_env_value(app, "VITE_PROJECT_WEBSITE_URL")?,
        resolve_desktop_env_value(app, "VITE_PROJECT_DISCORD_URL")?,
        resolve_desktop_env_value(app, "VITE_PROJECT_BUG_URL")?,
    ]
    .into_iter()
    .flatten()
    {
        if let Ok(parsed) = Url::parse(&raw_url) {
            if let Some(host) = parsed.host_str() {
                hosts.insert(normalize_host(host));
            }
        }
    }

    Ok(hosts)
}

pub(crate) fn resolve_desktop_env_value<R: Runtime>(
    app: &AppHandle<R>,
    key: &str,
) -> Result<Option<String>, String> {
    if is_forbidden_runtime_config_key(key) {
        return Ok(None);
    }

    if let Ok(value) = env::var(key) {
        let trimmed = value.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(Some(trimmed));
        }
    }

    resolve_runtime_config_value(app, key)
        .or_else(|| resolve_desktop_env_file_value(app, key))
        .transpose()
}

fn resolve_runtime_config_value<R: Runtime>(
    app: &AppHandle<R>,
    key: &str,
) -> Option<Result<String, String>> {
    for candidate in runtime_config_candidates(app) {
        let Some(parsed) = read_runtime_config_file(&candidate) else {
            continue;
        };
        if let Some(value) = parsed.get(key).and_then(|value| value.as_str()) {
            let trimmed = value.trim().to_string();
            if !trimmed.is_empty() {
                return Some(Ok(trimmed));
            }
        }
    }

    None
}

fn resolve_runtime_artifacts_url<R: Runtime>(app: &AppHandle<R>) -> Result<Option<String>, String> {
    let channel = update_channel_from_version(&app.package_info().version.to_string());
    let candidates = [
        resolve_desktop_env_value(app, "MINI_BACKEND_ARTIFACTS_URL")?,
        resolve_desktop_env_value(app, "VITE_MINI_BACKEND_ARTIFACTS_URL")?,
        resolve_desktop_env_value(app, "UPDATE_SERVER_URL")?,
        resolve_desktop_env_value(app, "VITE_UPDATE_SERVER_URL")?,
    ];
    let raw = candidates
        .into_iter()
        .flatten()
        .next()
        .unwrap_or_else(|| default_runtime_artifacts_url(&channel));

    Ok(Some(normalize_runtime_artifacts_url(&raw, &channel)))
}

fn default_runtime_artifacts_url(channel: &str) -> String {
    format!(
        "{}/{}/",
        DEFAULT_UPDATE_SERVER_URL.trim_end_matches('/'),
        normalize_runtime_channel(channel)
    )
}

fn normalize_runtime_channel(channel: &str) -> &str {
    if channel.eq_ignore_ascii_case("beta") {
        "beta"
    } else {
        "stable"
    }
}

fn update_channel_from_version(version: &str) -> String {
    if version.contains('-') {
        "beta".to_string()
    } else {
        "stable".to_string()
    }
}

fn normalize_runtime_artifacts_url(raw_url: &str, channel: &str) -> String {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return default_runtime_artifacts_url(channel);
    }
    if trimmed.to_ascii_lowercase().ends_with(".json") {
        return trimmed.to_string();
    }

    let target_segment = normalize_runtime_channel(channel);
    let normalize_path = |path: &str| -> String {
        let path = path.trim();
        if path
            .to_ascii_lowercase()
            .contains("/mini-backend-artifacts/")
        {
            return if path.ends_with('/') {
                path.to_string()
            } else {
                format!("{path}/")
            };
        }

        let mut segments = path
            .split('/')
            .filter(|segment| !segment.trim().is_empty())
            .map(|segment| segment.to_string())
            .collect::<Vec<_>>();

        match segments.last_mut() {
            Some(last)
                if last.eq_ignore_ascii_case("stable") || last.eq_ignore_ascii_case("beta") =>
            {
                *last = target_segment.to_string();
            }
            Some(_) => segments.push(target_segment.to_string()),
            None => segments.push(target_segment.to_string()),
        }

        format!("/{}{}", segments.join("/"), "/")
    };

    match Url::parse(trimmed) {
        Ok(mut parsed) => {
            parsed.set_path(&normalize_path(parsed.path()));
            parsed.to_string()
        }
        Err(_) => {
            if trimmed.contains("://") {
                let mut parts = trimmed.splitn(4, '/');
                let scheme_and_host = parts.by_ref().take(3).collect::<Vec<_>>().join("/");
                let path = parts.collect::<Vec<_>>().join("/");
                if path.is_empty() {
                    format!("{scheme_and_host}/{target_segment}/")
                } else {
                    format!("{scheme_and_host}{}", normalize_path(&format!("/{path}")))
                }
            } else {
                normalize_path(trimmed)
            }
        }
    }
}

fn resolve_desktop_env_file_value<R: Runtime>(
    app: &AppHandle<R>,
    key: &str,
) -> Option<Result<String, String>> {
    let env_file = desktop_env_file_name();
    for root in env_root_candidates(app) {
        let candidates = [
            root.join(format!("{env_file}.local")),
            root.join(".env.local"),
            root.join(env_file),
            root.join(".env"),
            root.join("auth-server").join(format!("{env_file}.local")),
            root.join("auth-server").join(".env.local"),
            root.join("auth-server").join(env_file),
            root.join("auth-server").join(".env"),
        ];

        for candidate in candidates {
            if let Some(value) = read_value_from_env_file(&candidate, key) {
                return Some(Ok(value));
            }
        }
    }

    None
}

fn runtime_config_candidates<R: Runtime>(app: &AppHandle<R>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(current_dir) = env::current_dir() {
        candidates.push(
            current_dir
                .join("dist-electron")
                .join("runtime-config.json"),
        );
        candidates.push(current_dir.join("runtime-config.json"));
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(
            resource_dir
                .join("app.asar")
                .join("dist-electron")
                .join("runtime-config.json"),
        );
        candidates.push(
            resource_dir
                .join("dist-electron")
                .join("runtime-config.json"),
        );
    }

    candidates
}

fn env_root_candidates<R: Runtime>(app: &AppHandle<R>) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(current_dir) = env::current_dir() {
        roots.extend(collect_ancestor_dirs(current_dir, 6));
    }
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            roots.extend(collect_ancestor_dirs(exe_dir.to_path_buf(), 8));
        }
    }
    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.extend(collect_ancestor_dirs(resource_dir, 6));
    }

    dedupe_paths(roots)
}

fn collect_ancestor_dirs(start_dir: PathBuf, max_depth: usize) -> Vec<PathBuf> {
    let mut ancestors = Vec::new();
    let mut current = start_dir;
    for _ in 0..max_depth {
        ancestors.push(current.clone());
        let Some(parent) = current.parent() else {
            break;
        };
        if parent == current {
            break;
        }
        current = parent.to_path_buf();
    }

    ancestors
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for path in paths {
        let key = path.to_string_lossy().to_string();
        if seen.insert(key) {
            unique.push(path);
        }
    }

    unique
}

fn read_runtime_config_file(path: &Path) -> Option<serde_json::Map<String, serde_json::Value>> {
    let raw = fs::read_to_string(path).ok()?;
    let parsed = serde_json::from_str::<serde_json::Value>(&raw).ok()?;
    parsed.as_object().cloned()
}

fn read_value_from_env_file(path: &Path, key: &str) -> Option<String> {
    let raw = fs::read_to_string(path).ok()?;
    let mut resolved = None;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let trimmed = trimmed.strip_prefix("export ").unwrap_or(trimmed).trim();
        let Some((line_key, line_value)) = trimmed.split_once('=') else {
            continue;
        };
        if line_key.trim() != key {
            continue;
        }

        let value = line_value
            .trim()
            .trim_matches('"')
            .trim_matches('\'')
            .to_string();
        if !value.is_empty() {
           resolved = Some(value);
        }
    }

    resolved
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

fn normalize_loopback_url(raw_url: &str) -> String {
    let Ok(mut parsed) = Url::parse(raw_url) else {
        return raw_url.to_string();
    };
    if parsed.host_str().map(normalize_host).as_deref() != Some("localhost") {
        return raw_url.to_string();
    }

    if parsed.set_host(Some("127.0.0.1")).is_ok() {
        parsed.to_string().trim_end_matches('/').to_string()
    } else {
        raw_url.to_string()
    }
}

fn normalize_host(host: &str) -> String {
    host.trim().trim_end_matches('.').to_ascii_lowercase()
}

fn is_forbidden_runtime_config_key(key: &str) -> bool {
    FORBIDDEN_RUNTIME_CONFIG_KEYS.contains(&key)
}

fn remove_path_if_present(path: &Path) -> std::io::Result<()> {
    match fs::metadata(path) {
        Ok(metadata) if metadata.is_dir() => fs::remove_dir_all(path),
        Ok(_) => fs::remove_file(path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn external_url_requires_https_and_allowed_host() {
        let hosts = HashSet::from(["api.example.com".to_string()]);

        assert!(is_allowed_external_url("https://github.com/koma", &hosts));
        assert!(is_allowed_external_url(
            "https://api.example.com/pay",
            &hosts
        ));
        assert!(!is_allowed_external_url("http://github.com/koma", &hosts));
        assert!(!is_allowed_external_url("https://evil.example.net", &hosts));
    }

    #[test]
    fn community_url_requires_https() {
        assert!(validate_community_url("https://discord.gg/koma").is_ok());
        assert_eq!(
            validate_community_url("http://discord.gg/koma").unwrap_err(),
            "Only HTTPS links are allowed."
        );
    }

    #[test]
    fn reset_local_settings_removes_known_files() {
        let temp = tempfile::tempdir().unwrap();
        fs::create_dir_all(temp.path().join("secure-store")).unwrap();
        fs::write(temp.path().join(IDENTITY_CACHE_FILE), "{}").unwrap();
        fs::write(temp.path().join(RUNTIME_SELECTION_FILE), "{}").unwrap();

        let result = reset_local_settings_at(temp.path()).unwrap();

        assert!(result.cleared);
        assert_eq!(result.cleared_paths.len(), 3);
        assert!(!temp.path().join("secure-store").exists());
        assert!(!temp.path().join(IDENTITY_CACHE_FILE).exists());
        assert!(!temp.path().join(RUNTIME_SELECTION_FILE).exists());
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
            normalize_runtime_artifacts_url("https://api.koma-studio.site/updates/", "beta"),
            "https://api.koma-studio.site/updates/beta/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url("https://api.koma-studio.site/updates/stable/", "beta"),
            "https://api.koma-studio.site/updates/beta/"
        );
        assert_eq!(
            normalize_runtime_artifacts_url(
                "https://api.koma-studio.site/updates/beta/mini-backend-artifacts/latest.json",
                "beta"
            ),
            "https://api.koma-studio.site/updates/beta/mini-backend-artifacts/latest.json"
        );
    }

    #[test]
    fn resolves_default_runtime_artifacts_url_by_channel() {
        assert_eq!(
            default_runtime_artifacts_url("beta"),
            "https://api.koma-studio.site/updates/beta/"
        );
        assert_eq!(
            default_runtime_artifacts_url("stable"),
            "https://api.koma-studio.site/updates/stable/"
        );
    }

    #[tokio::test]
    async fn local_backend_healthcheck_returns_false_for_closed_port() {
        assert!(!check_local_backend_health("http://127.0.0.1:9").await);
    }

    #[test]
    fn env_file_last_duplicate_key_wins() {
        let temp = tempfile::tempdir().unwrap();
        let env_path = temp.path().join(".env");
        fs::write(
            &env_path,
            "# comment\nVITE_AUTH_API_URL=http://localhost:3001\nVITE_AUTH_API_URL=https://auth.koma-studio.site\n",
        )
        .unwrap();

        assert_eq!(
            read_value_from_env_file(&env_path, "VITE_AUTH_API_URL").as_deref(),
            Some("https://auth.koma-studio.site")
        );
    }

    #[test]
    fn env_file_supports_export_prefix_and_quotes() {
        let temp = tempfile::tempdir().unwrap();
        let env_path = temp.path().join(".env");
        fs::write(&env_path, "export VITE_AUTH_API_URL=\"https://auth.example.test\"\n").unwrap();

        assert_eq!(
            read_value_from_env_file(&env_path, "VITE_AUTH_API_URL").as_deref(),
            Some("https://auth.example.test")
        );
    }
}
