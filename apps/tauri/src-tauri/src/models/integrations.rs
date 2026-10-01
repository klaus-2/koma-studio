//! Deep-link models. The route allowlist lives in the service; these carry
//! only validated data.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepLinkArgsRequest {
    pub argv: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeepLinkRequest {
    pub url: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeepLinkNavigationResult {
    pub navigated: bool,
    pub route: Option<String>,
}
