//! Workspace package models.
//!
//! Wire contract (shared with the Electron shell and the frontend):
//! assets travel as `buffer: Vec<u8>` inside `WorkspaceBinaryAssetPayload`.
//! The token-based source types below back the new select/register asset
//! commands; file bytes never cross the IPC boundary for those.

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAssetManifestEntry {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub mime_type: String,
    pub byte_length: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageManifestV1 {
    pub package_version: u8,
    pub exported_at: String,
    pub app: String,
    pub document_version: u8,
    pub document: Value,
    pub assets: Vec<WorkspaceAssetManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceBinaryAssetPayload {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub mime_type: String,
    pub buffer: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackagePayload {
    pub manifest: WorkspacePackageManifestV1,
    pub assets: Vec<WorkspaceBinaryAssetPayload>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAutosaveLoadResult {
    pub found: bool,
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<WorkspacePackagePayload>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAutosaveSaveResult {
    pub saved: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAutosaveClearResult {
    pub cleared: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExportResult {
    pub cancelled: bool,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceImportResult {
    pub cancelled: bool,
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<WorkspacePackagePayload>,
}

// --- Token-based asset authorization (select/register commands) -------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct WorkspaceAssetId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct WorkspaceAssetToken(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAssetSource {
    pub id: WorkspaceAssetId,
    pub path: String,
    pub file_name: String,
    pub mime_type: String,
    pub byte_length: u64,
    pub source_token: WorkspaceAssetToken,
    pub source_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAssetSelectionResult {
    pub cancelled: bool,
    pub assets: Vec<WorkspaceAssetSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InternalAssetRegistration {
    pub id: WorkspaceAssetId,
    pub path: String,
    pub source_path: String,
    pub file_name: String,
    pub mime_type: String,
}
