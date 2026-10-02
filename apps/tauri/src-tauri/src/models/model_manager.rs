//! Model manager IPC data models. Field spellings are wire-pinned to
//! `shared-models/desktop-api.ts` and the on-disk manifests — see the serde
//! tests in `services/models/tests.rs` before renaming anything.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopModelDownloadPayload {
    pub id: String,
    pub name: String,
    pub version: String,
    pub download_url: String,
    // The TS contract and the on-disk manifest both spell this
    // `checksumSHA256`; plain camelCase here produced `checksumSha256` and
    // rejected every download payload from the frontend.
    #[serde(rename = "checksumSHA256", alias = "checksumSha256")]
    pub checksum_sha256: String,
    pub expected_download_bytes: u64,
    pub required_disk_bytes: u64,
    pub source_language: Option<String>,
    pub install_strategy: Option<String>,
    pub runtime_family: Option<String>,
    pub backend_install_endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopModelImportOnnxPayload {
    pub id: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDiskSpaceInfo {
    pub free_bytes: u64,
    pub total_bytes: u64,
    pub path: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModelInstallStatus {
    Installed,
    Incomplete,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopModelManifest {
    #[serde(rename = "modelId")]
    pub model_id: String,
    pub version: String,
    #[serde(rename = "installedAt")]
    pub installed_at: String,
    #[serde(rename = "checksumSHA256", alias = "checksumSha256")]
    pub checksum_sha256: String,
    pub status: ModelInstallStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    #[serde(default)]
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopInstalledModelRecord {
    pub model_id: String,
    pub version: String,
    pub installed_at: String,
    #[serde(rename = "checksumSHA256", alias = "checksumSha256")]
    pub checksum_sha256: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_languages: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    pub model_dir: String,
    pub manifest_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRemoteModelUpdateCheckResult {
    pub model_id: String,
    #[serde(rename = "installedChecksumSHA256", alias = "installedChecksumSha256")]
    pub installed_checksum_sha256: Option<String>,
    #[serde(rename = "remoteChecksumSHA256", alias = "remoteChecksumSha256")]
    pub remote_checksum_sha256: Option<String>,
    pub registry_version: String,
    pub checked: bool,
    pub update_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelQueueResult {
    pub queued: bool,
    pub queue_length: usize,
}

// rename_all only covers the variant NAMES (the "type" tag); without
// rename_all_fields, fields serialize as snake_case (model_id, bytes_downloaded...)
// and the interface — which expects modelId/bytesDownloaded — ignores the events.
// This was the original cause of "V2 always 0%".
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
pub enum ModelManagerEvent {
    Queued {
        model_id: String,
        queue_length: usize,
    },
    Started {
        model_id: String,
        attempt: u32,
    },
    Progress {
        model_id: String,
        bytes_downloaded: u64,
        total_bytes: u64,
        speed_bytes_per_second: u64,
        percent: f64,
        attempt: u32,
    },
    Verifying {
        model_id: String,
    },
    Completed {
        model_id: String,
        version: String,
        installed_at: String,
    },
    Failed {
        model_id: String,
        message: String,
        attempt: u32,
        will_retry: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
    Cancelled {
        model_id: String,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ModelTransferPhase {
    Validating,
    Copying,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ModelTransferProgress {
    pub phase: ModelTransferPhase,
    pub transferred: u64,
    pub total: u64,
    pub percent: f64,
}
