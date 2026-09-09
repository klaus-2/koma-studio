use std::{
    collections::{HashMap, HashSet},
    env, fs,
    fs::File,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha512};
use tauri::{AppHandle, Emitter, Manager, Runtime, State};
use zip::ZipArchive;

use crate::commands::desktop::build_runtime_config;

use super::gpu::{
    collect_gpu_vendors, has_vendor_match, is_amd_vendor, is_intel_vendor,
    is_legacy_nvidia_descriptor, is_nvidia_vendor, platform_key,
};

mod install;
pub(crate) use install::ensure_startup_runtime;
use install::{install_recommended_runtime, install_runtime_profile, list_runtime_artifacts};

const RUNTIME_DOWNLOAD_DIR: &str = "koma-runtime-downloads";
const RUNTIME_SELECTION_FILE_NAME: &str = "mini-backend-runtime-selection.json";
const RUNTIME_DOWNLOAD_RETRY_COUNT: u32 = 2;
const MIN_RUNTIME_INSTALL_REQUIRED_BYTES: u64 = 512 * 1024 * 1024;
const RUNTIME_EVENT_CHANNEL: &str = "mini-backend-runtime:event";
const RUNTIME_RETRYABLE_HTTP_STATUSES: &[u16] = &[408, 429, 500, 502, 503, 504];

const PROFILES: &[&str] = &[
    "cpu",
    "nvidia-cuda",
    "nvidia-cuda-legacy",
    "nvidia-tensorrt",
    "apple-mps",
    "amd-rocm",
    "intel-openvino",
];

#[derive(Debug)]
pub struct MiniBackendRuntimeStore {
    state: Mutex<MiniBackendRuntimeState>,
    installing: AtomicBool,
}

impl Default for MiniBackendRuntimeStore {
    fn default() -> Self {
        Self {
            state: Mutex::new(initial_runtime_state()),
            installing: AtomicBool::new(false),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MiniBackendRuntimeProgress {
    pub transferred_bytes: u64,
    pub total_bytes: u64,
    pub percent: f64,
    pub speed_bytes_per_second: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MiniBackendRuntimeState {
    pub status: String,
    pub status_message: Option<String>,
    pub requested_profile: String,
    pub active_profile: String,
    pub source: String,
    pub runtime_artifacts_url: Option<String>,
    pub runtime_manifest_url: Option<String>,
    pub runtime_archive_url: Option<String>,
    pub install_dir: Option<String>,
    pub download_cache_dir: Option<String>,
    pub version: Option<String>,
    pub last_error: Option<String>,
    pub attempt: u32,
    pub max_attempts: u32,
    pub progress: Option<MiniBackendRuntimeProgress>,
    pub updated_at: Option<u64>,
    pub gpu_name: Option<String>,
    pub vram_gb: Option<f64>,
}

#[derive(Debug, Default, Clone)]
pub struct MiniBackendRuntimePatch {
    pub status: Option<String>,
    pub status_message: Option<Option<String>>,
    pub requested_profile: Option<String>,
    pub active_profile: Option<String>,
    pub source: Option<String>,
    pub runtime_artifacts_url: Option<Option<String>>,
    pub runtime_manifest_url: Option<Option<String>>,
    pub runtime_archive_url: Option<Option<String>>,
    pub install_dir: Option<Option<String>>,
    pub download_cache_dir: Option<Option<String>>,
    pub version: Option<Option<String>>,
    pub last_error: Option<Option<String>>,
    pub attempt: Option<u32>,
    pub max_attempts: Option<u32>,
    pub progress: Option<Option<MiniBackendRuntimeProgress>>,
    pub gpu_name: Option<Option<String>>,
    pub vram_gb: Option<Option<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MiniBackendRuntimeInstallResult {
    pub ok: bool,
    pub profile: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MiniBackendRuntimeSelection {
    pub profile: String,
    pub version: String,
    pub entry: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MiniBackendRuntimeArtifactRecord {
    pub profile: String,
    pub version: String,
    pub platform: String,
    pub arch: String,
    pub file_name: String,
    pub url: String,
    pub sha512: String,
    pub size: u64,
    pub entry: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MiniBackendRuntimeArtifactManifest {
    pub schema_version: u8,
    pub version: String,
    pub generated_at: String,
    pub platform: String,
    pub arch: String,
    pub default_profile: String,
    pub profiles: HashMap<String, MiniBackendRuntimeArtifactRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MiniBackendRuntimeArtifactOption {
    pub profile: String,
    pub version: String,
    pub size: u64,
    pub installed: bool,
    pub recommended: bool,
}

#[tauri::command(rename = "desktop:list-mini-backend-runtime-artifacts")]
pub async fn list_mini_backend_runtime_artifacts<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
) -> Result<Vec<MiniBackendRuntimeArtifactOption>, String> {
    list_runtime_artifacts(&app, &store).await
}

#[tauri::command(rename = "desktop:install-recommended-mini-backend-runtime")]
pub async fn install_recommended_mini_backend_runtime<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
) -> Result<MiniBackendRuntimeInstallResult, String> {
    if store.installing.swap(true, Ordering::SeqCst) {
        return Ok(MiniBackendRuntimeInstallResult {
            ok: false,
            profile: "auto".to_string(),
            reason: Some("runtime_manual_install_in_progress".to_string()),
        });
    }

    let result = install_recommended_runtime(&app, &store).await;
    store.installing.store(false, Ordering::SeqCst);
    result
}

#[tauri::command(rename = "desktop:install-mini-backend-runtime-profile")]
pub async fn install_mini_backend_runtime_profile<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, MiniBackendRuntimeStore>,
    profile: String,
) -> Result<MiniBackendRuntimeInstallResult, String> {
    if store.installing.swap(true, Ordering::SeqCst) {
        return Ok(MiniBackendRuntimeInstallResult {
            ok: false,
            profile,
            reason: Some("runtime_manual_install_in_progress".to_string()),
        });
    }

    let result = install_runtime_profile(&app, &store, &profile).await;
    store.installing.store(false, Ordering::SeqCst);
    result
}

pub fn snapshot_runtime_state<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<MiniBackendRuntimeState, String> {
    refresh_runtime_context(app, store)?;
    let guard = store.state.lock().map_err(|error| error.to_string())?;
    Ok(guard.clone())
}

pub fn patch_runtime_state<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    patch: MiniBackendRuntimePatch,
) -> Result<MiniBackendRuntimeState, String> {
    let mut guard = store.state.lock().map_err(|error| error.to_string())?;
    apply_patch(&mut guard, patch);
    guard.updated_at = Some(now_millis());
    let snapshot = guard.clone();
    drop(guard);
    let _ = app.emit_to("main", RUNTIME_EVENT_CHANNEL, snapshot.clone());
    Ok(snapshot)
}

pub fn resolve_runtime_profile<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    silent: bool,
    ignore_manual_selection: bool,
) -> Result<String, String> {
    let env_override =
        normalize_profile_override(env::var("MINI_BACKEND_ACCELERATION_PROFILE").ok());
    let selection = if ignore_manual_selection {
        None
    } else {
        read_runtime_selection(app)
            .ok()
            .flatten()
            .map(|value| value.profile)
    };
    let override_profile = if env_override != "auto" {
        Some(env_override)
    } else {
        selection
    };
    let profile = resolve_acceleration_profile(
        platform_key(),
        env::consts::ARCH,
        override_profile.as_deref(),
        &collect_gpu_vendors(),
    );

    if !silent {
        let _ = patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("resolving".to_string()),
                status_message: Some(Some(
                    "Detecting the best local runtime profile.".to_string(),
                )),
                requested_profile: Some(profile.clone()),
                attempt: Some(0),
                max_attempts: Some(0),
                progress: Some(None),
                ..Default::default()
            },
        );
    }

    Ok(profile)
}

pub fn read_runtime_selection<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<MiniBackendRuntimeSelection>, String> {
    let file_path = runtime_selection_path(app)?;
    if !file_path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&file_path).map_err(|error| error.to_string())?;
    let parsed: MiniBackendRuntimeSelection =
        serde_json::from_str(&raw).map_err(|error| error.to_string())?;
    if normalize_profile_override(Some(parsed.profile.clone())) == "auto"
        || parsed.version.trim().is_empty()
        || parsed.entry.trim().is_empty()
    {
        return Ok(None);
    }
    Ok(Some(parsed))
}

pub fn resolve_selected_runtime_binary_path<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<PathBuf>, String> {
    let Some(selection) = read_runtime_selection(app)? else {
        return Ok(None);
    };
    let binary_path =
        runtime_install_dir(app, &selection.version, &selection.profile)?.join(selection.entry);
    Ok(binary_path.exists().then_some(binary_path))
}

pub async fn sync_runtime_state_from_api<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<(), String> {
    let config = build_runtime_config(app)?;
    let endpoint = format!("{}/device/info", config.local_api_url.trim_end_matches('/'));
    let response = match reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| error.to_string())?
        .get(endpoint)
        .send()
        .await
    {
        Ok(response) if response.status().is_success() => response,
        _ => return Ok(()),
    };

    let payload: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
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

pub fn runtime_install_dir<R: Runtime>(
    app: &AppHandle<R>,
    version: &str,
    profile: &str,
) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("mini-backend-runtimes")
        .join(version)
        .join(sanitize_profile(profile)))
}

pub fn sanitize_profile(profile: &str) -> String {
    profile
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect()
}

pub fn normalize_profile_override(value: Option<String>) -> String {
    let normalized = value.unwrap_or_default().trim().to_ascii_lowercase();
    if PROFILES.contains(&normalized.as_str()) {
        normalized
    } else {
        "auto".to_string()
    }
}

pub fn resolve_acceleration_profile(
    platform: &str,
    arch: &str,
    override_profile: Option<&str>,
    gpu_vendors: &[String],
) -> String {
    if let Some(profile) = override_profile {
        let normalized = normalize_profile_override(Some(profile.to_string()));
        if normalized != "auto" {
            return normalized;
        }
    }
    if platform == "darwin" && arch == "aarch64" {
        return "apple-mps".to_string();
    }
    if platform == "win32" && has_vendor_match(gpu_vendors, is_legacy_nvidia_descriptor) {
        return "nvidia-cuda-legacy".to_string();
    }
    if has_vendor_match(gpu_vendors, is_nvidia_vendor) {
        return "nvidia-cuda".to_string();
    }
    if platform == "linux" && has_vendor_match(gpu_vendors, is_amd_vendor) {
        return "amd-rocm".to_string();
    }
    if has_vendor_match(gpu_vendors, is_intel_vendor) {
        return "intel-openvino".to_string();
    }
    "cpu".to_string()
}

fn initial_runtime_state() -> MiniBackendRuntimeState {
    MiniBackendRuntimeState {
        status: "idle".to_string(),
        status_message: None,
        requested_profile: "cpu".to_string(),
        active_profile: "cpu".to_string(),
        source: "bundled-core".to_string(),
        runtime_artifacts_url: None,
        runtime_manifest_url: None,
        runtime_archive_url: None,
        install_dir: None,
        download_cache_dir: Some(
            env::temp_dir()
                .join(RUNTIME_DOWNLOAD_DIR)
                .to_string_lossy()
                .to_string(),
        ),
        version: None,
        last_error: None,
        attempt: 0,
        max_attempts: 0,
        progress: None,
        updated_at: Some(now_millis()),
        gpu_name: None,
        vram_gb: None,
    }
}

fn refresh_runtime_context<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<(), String> {
    let runtime_artifacts_url = resolve_artifacts_url(app)?;
    let download_cache_dir = Some(
        env::temp_dir()
            .join(RUNTIME_DOWNLOAD_DIR)
            .to_string_lossy()
            .to_string(),
    );
    let mut guard = store.state.lock().map_err(|error| error.to_string())?;
    guard.runtime_artifacts_url = runtime_artifacts_url;
    guard.download_cache_dir = download_cache_dir;
    Ok(())
}

fn apply_patch(state: &mut MiniBackendRuntimeState, patch: MiniBackendRuntimePatch) {
    if let Some(value) = patch.status {
        state.status = value;
    }
    if let Some(value) = patch.status_message {
        state.status_message = value;
    }
    if let Some(value) = patch.requested_profile {
        state.requested_profile = value;
    }
    if let Some(value) = patch.active_profile {
        state.active_profile = value;
    }
    if let Some(value) = patch.source {
        state.source = value;
    }
    if let Some(value) = patch.runtime_artifacts_url {
        state.runtime_artifacts_url = value;
    }
    if let Some(value) = patch.runtime_manifest_url {
        state.runtime_manifest_url = value;
    }
    if let Some(value) = patch.runtime_archive_url {
        state.runtime_archive_url = value;
    }
    if let Some(value) = patch.install_dir {
        state.install_dir = value;
    }
    if let Some(value) = patch.download_cache_dir {
        state.download_cache_dir = value;
    }
    if let Some(value) = patch.version {
        state.version = value;
    }
    if let Some(value) = patch.last_error {
        state.last_error = value;
    }
    if let Some(value) = patch.attempt {
        state.attempt = value;
    }
    if let Some(value) = patch.max_attempts {
        state.max_attempts = value;
    }
    if let Some(value) = patch.progress {
        state.progress = value;
    }
    if let Some(value) = patch.gpu_name {
        state.gpu_name = value;
    }
    if let Some(value) = patch.vram_gb {
        state.vram_gb = value;
    }
}

fn set_manual_install_blocked<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    reason: &str,
    requested_profile: &str,
) -> Result<(), String> {
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

fn install_result(ok: bool, profile: &str, reason: &str) -> MiniBackendRuntimeInstallResult {
    MiniBackendRuntimeInstallResult {
        ok,
        profile: profile.to_string(),
        reason: Some(reason.to_string()),
    }
}

fn runtime_selection_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join(RUNTIME_SELECTION_FILE_NAME))
}

fn write_runtime_selection<R: Runtime>(
    app: &AppHandle<R>,
    selection: &MiniBackendRuntimeSelection,
) -> Result<(), String> {
    let file_path = runtime_selection_path(app)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let raw = serde_json::to_string_pretty(selection).map_err(|error| error.to_string())?;
    fs::write(file_path, format!("{raw}\n")).map_err(|error| error.to_string())
}

fn resolve_artifacts_url<R: Runtime>(app: &AppHandle<R>) -> Result<Option<String>, String> {
    Ok(build_runtime_config(app)?.runtime_artifacts_url)
}

fn resolve_manifest_url<R: Runtime>(app: &AppHandle<R>) -> Result<Option<String>, String> {
    Ok(resolve_manifest_url_from_base(
        resolve_artifacts_url(app)?.as_deref(),
    ))
}

fn resolve_manifest_url_from_base(raw_url: Option<&str>) -> Option<String> {
    let trimmed = raw_url?.trim();
    if trimmed.is_empty() {
        return None;
    }
    let base = if trimmed.ends_with('/') {
        trimmed.to_string()
    } else {
        format!("{trimmed}/")
    };
    if base.to_ascii_lowercase().ends_with(".json/") {
        return Some(trimmed.to_string());
    }
    if base
        .to_ascii_lowercase()
        .contains("/mini-backend-artifacts/")
    {
        return Some(format!("{base}latest.json"));
    }
    Some(format!("{base}mini-backend-artifacts/latest.json"))
}

fn resolve_runtime_url(manifest_url: &str, relative_url: &str) -> Result<String, String> {
    url::Url::parse(manifest_url)
        .and_then(|base| base.join(relative_url))
        .map(|url| url.to_string())
        .map_err(|error| error.to_string())
}

fn list_artifact_options(
    manifest: &MiniBackendRuntimeArtifactManifest,
    recommended_profile: Option<&str>,
    installed_profiles: &HashSet<String>,
) -> Vec<MiniBackendRuntimeArtifactOption> {
    let order = artifact_profile_order(
        &manifest.platform,
        manifest.profiles.contains_key("nvidia-tensorrt"),
    );
    let order_index = order
        .iter()
        .enumerate()
        .map(|(index, profile)| ((*profile).to_string(), index))
        .collect::<HashMap<_, _>>();
    let mut records = manifest.profiles.values().collect::<Vec<_>>();
    records.sort_by(|left, right| {
        let left_index = order_index
            .get(&left.profile)
            .copied()
            .unwrap_or(usize::MAX);
        let right_index = order_index
            .get(&right.profile)
            .copied()
            .unwrap_or(usize::MAX);
        left_index
            .cmp(&right_index)
            .then_with(|| left.profile.cmp(&right.profile))
    });
    records
        .into_iter()
        .map(|entry| MiniBackendRuntimeArtifactOption {
            profile: entry.profile.clone(),
            version: entry.version.clone(),
            size: entry.size,
            installed: installed_profiles.contains(&entry.profile),
            recommended: recommended_profile == Some(entry.profile.as_str()),
        })
        .collect()
}

fn artifact_profile_order(platform: &str, include_tensorrt: bool) -> Vec<&'static str> {
    match platform {
        "win32" => {
            let mut profiles = vec!["cpu", "nvidia-cuda", "nvidia-cuda-legacy", "intel-openvino"];
            if include_tensorrt {
                profiles.push("nvidia-tensorrt");
            }
            profiles
        }
        "linux" => {
            let mut profiles = vec!["cpu", "nvidia-cuda", "amd-rocm", "intel-openvino"];
            if include_tensorrt {
                profiles.push("nvidia-tensorrt");
            }
            profiles
        }
        "darwin" => vec!["cpu", "apple-mps"],
        _ => vec!["cpu"],
    }
}

fn progress_snapshot(
    transferred_bytes: u64,
    total_bytes: u64,
    speed_bytes_per_second: f64,
) -> MiniBackendRuntimeProgress {
    let resolved_total = total_bytes.max(transferred_bytes);
    MiniBackendRuntimeProgress {
        transferred_bytes,
        total_bytes: resolved_total,
        percent: if resolved_total > 0 {
            ((transferred_bytes as f64 / resolved_total as f64) * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        },
        speed_bytes_per_second,
    }
}

fn existing_download_bytes(output_path: &Path, expected_total_bytes: u64) -> Result<u64, String> {
    if !output_path.exists() {
        return Ok(0);
    }
    let size = output_path
        .metadata()
        .map_err(|error| error.to_string())?
        .len();
    if expected_total_bytes > 0 && size >= expected_total_bytes {
        fs::remove_file(output_path).map_err(|error| error.to_string())?;
        return Ok(0);
    }
    Ok(size)
}

fn ensure_runtime_disk_space(
    archive_path: &Path,
    install_dir: &Path,
    archive_bytes: u64,
) -> Result<(), String> {
    let required = estimate_runtime_install_required_bytes(archive_bytes);
    for target in [archive_path, install_dir] {
        let stat_path = existing_ancestor(target)
            .ok_or_else(|| format!("Could not resolve the disk for {}.", target.display()))?;
        let free = fs2::available_space(&stat_path).map_err(|error| error.to_string())?;
        if free < required {
            return Err(format!(
                "Insufficient disk space for the runtime. Required: {:.1} GB | Available: {:.1} GB.",
                required as f64 / 1024_f64.powi(3),
                free as f64 / 1024_f64.powi(3)
            ));
        }
    }
    Ok(())
}

fn estimate_runtime_install_required_bytes(archive_bytes: u64) -> u64 {
    MIN_RUNTIME_INSTALL_REQUIRED_BYTES.max(archive_bytes.saturating_mul(3))
}

fn existing_ancestor(path: &Path) -> Option<PathBuf> {
    let mut current = path.parent()?.to_path_buf();
    loop {
        if current.exists() {
            return Some(current);
        }
        let parent = current.parent()?.to_path_buf();
        if parent == current {
            return None;
        }
        current = parent;
    }
}

fn sha512_base64_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha512::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(BASE64.encode(hasher.finalize()))
}

fn extract_runtime_archive(archive_path: &Path, destination_dir: &Path) -> Result<(), String> {
    if destination_dir.exists() {
        fs::remove_dir_all(destination_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(destination_dir).map_err(|error| error.to_string())?;
    let file = File::open(archive_path).map_err(|error| error.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|error| error.to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let output_path = destination_dir.join(enclosed_name);
        if entry.is_dir() {
            fs::create_dir_all(&output_path).map_err(|error| error.to_string())?;
            continue;
        }
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut output = File::create(&output_path).map_err(|error| error.to_string())?;
        std::io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn resolve_runtime_transfer_timeout(expected_total_bytes: u64) -> Duration {
    if expected_total_bytes == 0 {
        return Duration::from_secs(2 * 60 * 60);
    }
    let transfer_seconds = expected_total_bytes.div_ceil(1024 * 1024);
    Duration::from_secs((transfer_seconds + 5 * 60).clamp(30 * 60, 8 * 60 * 60))
}

fn is_retryable_status(status: u16) -> bool {
    RUNTIME_RETRYABLE_HTTP_STATUSES.contains(&status)
}

fn is_retryable_error(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    RUNTIME_RETRYABLE_HTTP_STATUSES
        .iter()
        .any(|status| lower.contains(&format!("http {status}")))
        || !lower.contains("sha512 mismatch")
}

fn format_runtime_fallback_reason(value: Option<&str>) -> Option<String> {
    let normalized = value?.trim();
    if normalized.is_empty() {
        return None;
    }
    let message = match normalized {
        "onnx_cuda_provider_unavailable" => {
            "The requested CUDA runtime is unavailable, so the app is using CPU execution."
        }
        "onnx_cuda_legacy_provider_unavailable" => {
            "The requested CUDA Legacy runtime is unavailable, so the app is using CPU execution."
        }
        "onnx_tensorrt_provider_unavailable" => {
            "TensorRT is unavailable on this runtime, so the app is using CPU execution."
        }
        "onnx_rocm_provider_unavailable" => {
            "ROCm is unavailable on this runtime, so the app is using CPU execution."
        }
        "openvino_provider_unavailable" => {
            "OpenVINO is unavailable on this runtime, so the app is using CPU execution."
        }
        "coreml_only_for_onnx" => {
            "CoreML acceleration is unavailable for the current ONNX runtime, so the app is using CPU execution."
        }
        "runtime_warmup_fallback_to_cpu" => {
            "The selected runtime profile failed warmup and was downgraded to CPU."
        }
        other => other,
    };
    Some(message.to_string())
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_supported_profiles_only() {
        assert_eq!(
            normalize_profile_override(Some("NVIDIA-CUDA".to_string())),
            "nvidia-cuda"
        );
        assert_eq!(normalize_profile_override(Some("cuda".to_string())), "auto");
    }

    #[test]
    fn resolves_manifest_url_like_electron() {
        assert_eq!(
            resolve_manifest_url_from_base(Some("https://updates.example.com")),
            Some("https://updates.example.com/mini-backend-artifacts/latest.json".to_string())
        );
        assert_eq!(
            resolve_manifest_url_from_base(Some(
                "https://updates.example.com/mini-backend-artifacts/"
            )),
            Some("https://updates.example.com/mini-backend-artifacts/latest.json".to_string())
        );
        assert_eq!(
            resolve_manifest_url_from_base(Some("https://updates.example.com/latest.json")),
            Some("https://updates.example.com/latest.json".to_string())
        );
    }

    #[test]
    fn lists_artifacts_in_platform_order() {
        let manifest = MiniBackendRuntimeArtifactManifest {
            schema_version: 1,
            version: "1.0.0".to_string(),
            generated_at: "now".to_string(),
            platform: "win32".to_string(),
            arch: "x86_64".to_string(),
            default_profile: "cpu".to_string(),
            profiles: [
                record("intel-openvino", 4),
                record("cpu", 1),
                record("nvidia-cuda", 2),
            ]
            .into_iter()
            .map(|record| (record.profile.clone(), record))
            .collect(),
        };

        let options = list_artifact_options(
            &manifest,
            Some("nvidia-cuda"),
            &HashSet::from(["cpu".to_string()]),
        );

        assert_eq!(
            options
                .iter()
                .map(|entry| entry.profile.as_str())
                .collect::<Vec<_>>(),
            vec!["cpu", "nvidia-cuda", "intel-openvino"]
        );
        assert!(options[0].installed);
        assert!(options[1].recommended);
    }

    #[test]
    fn estimates_runtime_disk_need_with_floor() {
        assert_eq!(
            estimate_runtime_install_required_bytes(1),
            MIN_RUNTIME_INSTALL_REQUIRED_BYTES
        );
        assert_eq!(
            estimate_runtime_install_required_bytes(1_000_000_000),
            3_000_000_000
        );
    }

    fn record(profile: &str, size: u64) -> MiniBackendRuntimeArtifactRecord {
        MiniBackendRuntimeArtifactRecord {
            profile: profile.to_string(),
            version: "1.0.0".to_string(),
            platform: "win32".to_string(),
            arch: "x86_64".to_string(),
            file_name: format!("{profile}.zip"),
            url: format!("{profile}.zip"),
            sha512: "sha".to_string(),
            size,
            entry: "mini-backend.exe".to_string(),
        }
    }
}
