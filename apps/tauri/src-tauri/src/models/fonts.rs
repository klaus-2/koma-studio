//! Font models. Wire-compatible with the frontend contract: custom entries
//! carry `id`/`family`/`fileName` plus a `dataUrl` field that now holds the
//! `koma-font://` media URL (no base64 crosses IPC).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialOrd, Ord, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct FontId(pub String);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FontSource {
    System,
    Custom,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FontEntry {
    pub id: Option<FontId>,
    pub family: String,
    pub source: FontSource,
    pub file_name: Option<String>,
    /// Field kept for the frontend font loader; contains the koma-font://
    /// media URL, not an inline base64 payload.
    #[serde(rename = "dataUrl")]
    pub media_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FontListResult {
    pub system: Vec<String>,
    pub custom: Vec<FontEntry>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FontInstallResult {
    pub cancelled: bool,
    pub entry: Option<FontEntry>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FontUninstallResult {
    pub removed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FontInstallProgress {
    pub transferred: u64,
    pub total: u64,
    pub percent: f64,
}
