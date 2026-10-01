//! Re-export surface: the api command modules consume helpers from
//! `services::api_client` via this module so imports stay short and the
//! service layer stays free of command-specific re-exports.

use serde_json::Value;

pub use crate::services::api_client::{api_error, now_iso, stable_hash, value_object, AUTH_API_BASE};

pub use crate::models::api::ApiEnvelope;

/// Legacy `Result<_, String>` surface for auth.rs (not yet migrated to
/// AppResult). Typed helpers stay exported below for migrated commands.
pub mod string_api {
    use crate::services::api_client as inner;

    pub fn api_url<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
        base: inner::ApiBase,
        endpoint_path: &str,
    ) -> Result<String, String> {
        inner::api_url(app, base, endpoint_path).map_err(|error| error.to_string())
    }

    pub fn method(name: &str) -> Result<reqwest::Method, String> {
        inner::method(name).map_err(|error| error.to_string())
    }

    pub fn access_token(payload: &serde_json::Value) -> Result<String, String> {
        inner::access_token(payload).map_err(|error| error.to_string())
    }

    pub async fn response_json_or_error(
        response: reqwest::Response,
    ) -> Result<serde_json::Value, String> {
        inner::response_json_or_error(response)
            .await
            .map_err(|error| error.to_string())
    }

    pub fn http_client_for_app<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
    ) -> Result<reqwest::Client, String> {
        inner::http_client_for_app(app).map_err(|error| error.to_string())
    }
}

/// Legacy plaintext envelope helpers used by blogger.rs. Kept on the typed
/// surface so the secret-migration path can read/write the legacy format.
pub fn read_plain_envelope(path: &std::path::Path, fallback: Value) -> Value {
    read_legacy_plain_envelope(path, fallback.clone()).unwrap_or(fallback)
}

// Typed surface for the migrated commands.
pub use crate::services::api_client::{
    bool_field, http_client, number_field, raw_string_field, read_legacy_plain_envelope,
    response_envelope, secure_store_dir, string_field, write_json_file_async,
};
