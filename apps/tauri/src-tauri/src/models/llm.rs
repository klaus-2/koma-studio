//! LLM profile models. `apiKey` is echoed as an empty string to keep the
//! frontend payload shape; the real secret lives in the OS keychain and
//! presence is reported via `hasApiKey` (additive field).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialOrd, Ord, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct LlmProfileId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(transparent)]
pub struct LlmUserId(pub String);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum LlmStage {
    Translation,
    Ocr,
    Clean,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LlmProfile {
    pub id: LlmProfileId,
    pub stage: LlmStage,
    pub label: String,
    pub api_base: String,
    /// Always empty in wire responses; the key lives in the keychain.
    #[serde(rename = "apiKey")]
    pub api_key: String,
    pub model: String,
    pub has_api_key: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LlmProfilesResult {
    pub profiles: Vec<LlmProfile>,
    pub secure_storage: bool,
}
