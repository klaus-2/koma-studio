use std::{
    collections::HashMap,
    env, fmt,
    sync::{
        Mutex,
        atomic::{AtomicBool, Ordering},
    },
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;

pub(super) const RUNTIME_DOWNLOAD_DIR: &str = "koma-runtime-downloads";
pub(super) const RUNTIME_SELECTION_FILE_NAME: &str = "mini-backend-runtime-selection.json";
pub(super) const RUNTIME_DOWNLOAD_RETRY_COUNT: u32 = 2;
pub(super) const MIN_RUNTIME_INSTALL_REQUIRED_BYTES: u64 = 512 * 1024 * 1024;
pub(super) const RUNTIME_EVENT_CHANNEL: &str = "mini-backend-runtime:event";
pub(super) const RUNTIME_RETRYABLE_HTTP_STATUSES: &[u16] = &[408, 429, 500, 502, 503, 504];

pub(super) const PROFILES: &[&str] = &[
    "cpu",
    "nvidia-cuda",
    "nvidia-cuda-legacy",
    "nvidia-tensorrt",
    "apple-mps",
    "amd-rocm",
    "intel-openvino",
];

#[derive(Debug, thiserror::Error)]
pub enum RuntimeError {
    #[error("filesystem error: {0}")]
    Io(#[from] std::io::Error),
    #[error("network error: {0}")]
    Http(#[from] reqwest::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("archive error: {0}")]
    Archive(#[from] zip::result::ZipError),
    #[error("invalid url: {0}")]
    Url(#[from] url::ParseError),
    #[error("platform error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("runtime state lock poisoned")]
    StatePoisoned,
    #[error("integrity check failed: {0}")]
    Integrity(String),
    #[error("{0}")]
    Message(String),
}

impl RuntimeError {
    const fn kind(&self) -> &'static str {
        match self {
            Self::Io(_) => "io",
            Self::Http(_) => "http",
            Self::Serde(_) => "serde",
            Self::Archive(_) => "archive",
            Self::Url(_) => "url",
            Self::Tauri(_) => "platform",
            Self::StatePoisoned => "statePoisoned",
            Self::Integrity(_) => "integrity",
            Self::Message(_) => "message",
        }
    }
}

impl Serialize for RuntimeError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("RuntimeError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

impl From<RuntimeError> for String {
    fn from(error: RuntimeError) -> Self {
        error.to_string()
    }
}

pub struct MiniBackendRuntimeStore {
    pub(super) state: Mutex<MiniBackendRuntimeState>,
    pub(super) installing: AtomicBool,
    pub(super) progress_channel: Mutex<Option<Channel<MiniBackendRuntimeState>>>,
}

impl fmt::Debug for MiniBackendRuntimeStore {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let has_progress_channel = self
            .progress_channel
            .lock()
            .map(|guard| guard.is_some())
            .unwrap_or(false);
        formatter
            .debug_struct("MiniBackendRuntimeStore")
            .field("state", &self.state)
            .field("installing", &self.installing)
            .field("has_progress_channel", &has_progress_channel)
            .finish()
    }
}

impl Default for MiniBackendRuntimeStore {
    fn default() -> Self {
        Self {
            state: Mutex::new(initial_runtime_state()),
            installing: AtomicBool::new(false),
            progress_channel: Mutex::new(None),
        }
    }
}

pub(super) struct InstallSessionGuard<'a> {
    store: &'a MiniBackendRuntimeStore,
}

impl Drop for InstallSessionGuard<'_> {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.store.progress_channel.lock() {
            *guard = None;
        }
        self.store.installing.store(false, Ordering::SeqCst);
    }
}

impl MiniBackendRuntimeStore {
    pub(super) fn try_begin_install(
        &self,
        channel: Option<Channel<MiniBackendRuntimeState>>,
    ) -> Option<InstallSessionGuard<'_>> {
        if self.installing.swap(true, Ordering::SeqCst) {
            return None;
        }
        if let Ok(mut guard) = self.progress_channel.lock() {
            *guard = channel;
        }
        Some(InstallSessionGuard { store: self })
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
    pub exit_code: Option<i32>,
    pub last_stderr: Option<String>,
    pub crash_log_path: Option<String>,
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
    pub exit_code: Option<Option<i32>>,
    pub last_stderr: Option<Option<String>>,
    pub crash_log_path: Option<Option<String>>,
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
pub struct MiniBackendRuntimeArtifactPart {
    pub file: String,
    pub url: String,
    pub sha512: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MiniBackendRuntimeArtifactRecord {
    pub profile: String,
    pub version: String,
    pub platform: String,
    pub arch: String,
    pub entry: String,
    pub parts: Vec<MiniBackendRuntimeArtifactPart>,
}

impl MiniBackendRuntimeArtifactRecord {
    pub fn total_part_bytes(&self) -> u64 {
        self.parts.iter().map(|part| part.size).sum()
    }
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
        exit_code: None,
        last_stderr: None,
        crash_log_path: None,
        attempt: 0,
        max_attempts: 0,
        progress: None,
        updated_at: Some(now_millis()),
        gpu_name: None,
        vram_gb: None,
    }
}

pub(super) fn apply_patch(state: &mut MiniBackendRuntimeState, patch: MiniBackendRuntimePatch) {
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
    if let Some(value) = patch.exit_code {
        state.exit_code = value;
    }
    if let Some(value) = patch.last_stderr {
        state.last_stderr = value;
    }
    if let Some(value) = patch.crash_log_path {
        state.crash_log_path = value;
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

pub(super) fn install_result(
    ok: bool,
    profile: &str,
    reason: &str,
) -> MiniBackendRuntimeInstallResult {
    MiniBackendRuntimeInstallResult {
        ok,
        profile: profile.to_string(),
        reason: Some(reason.to_string()),
    }
}

pub(super) fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
