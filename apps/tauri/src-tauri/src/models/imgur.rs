//! Imgur models. The current frontend contract sends `contentBase64` items;
//! the token-based request types ship for the future migration.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct ImgurKeyId(pub String);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImgurKeyConfig {
    pub id: ImgurKeyId,
    pub label: String,
    pub enabled: bool,
    pub has_credential: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImgurConfig {
    pub keys: Vec<ImgurKeyConfig>,
    pub rate_limit_per_hour: u32,
    pub batch_delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImgurRateStatus {
    pub limit_per_hour: u32,
    pub used_this_hour: u32,
    pub remaining_this_hour: u32,
    pub resets_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImgurConfigResult {
    pub config: ImgurConfig,
    pub secure_storage: bool,
    pub rate_limit: ImgurRateStatus,
}
