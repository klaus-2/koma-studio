use std::{fs, path::PathBuf, time::Duration};

use reqwest::{Method, Response};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};
use url::Url;

use crate::commands::desktop::build_runtime_config;

pub const AUTH_API_BASE: ApiBase = ApiBase::Auth;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiBase {
    Auth,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ApiEnvelope {
    pub ok: bool,
    pub status: u16,
    pub payload: Option<Value>,
}

pub fn api_error(status: u16, message: &str) -> ApiEnvelope {
    ApiEnvelope {
        ok: false,
        status,
        payload: Some(json!({ "error": message })),
    }
}

pub fn string_field(payload: &Value, key: &str) -> String {
    payload
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

pub fn raw_string_field(payload: &Value, key: &str) -> String {
    payload
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

pub fn bool_field(payload: &Value, key: &str) -> bool {
    payload.get(key).and_then(Value::as_bool).unwrap_or(false)
}

pub fn number_field(payload: &Value, key: &str) -> Option<f64> {
    payload.get(key).and_then(Value::as_f64)
}

pub fn access_token(payload: &Value) -> Result<String, String> {
    let token = string_field(payload, "accessToken");
    if token.is_empty() {
        Err("Token de acesso ausente.".to_string())
    } else {
        Ok(token)
    }
}

pub fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())
}

pub fn http_client_for_app<R: Runtime>(app: &AppHandle<R>) -> Result<reqwest::Client, String> {
    crate::security::cert_pinning::pinned_http_client(app, Duration::from_secs(30))
}

pub fn api_url<R: Runtime>(
    app: &AppHandle<R>,
    base: ApiBase,
    endpoint_path: &str,
) -> Result<String, String> {
    let config = build_runtime_config(app)?;
    let raw_base = match base {
        ApiBase::Auth => config.auth_api_url,
    };
    Url::parse(endpoint_path)
        .or_else(|_| Url::parse(&raw_base).and_then(|base_url| base_url.join(endpoint_path)))
        .map(|url| url.to_string())
        .map_err(|error| error.to_string())
}

pub async fn parse_response_payload(response: Response) -> (u16, Option<Value>) {
    let status = response.status().as_u16();
    let text = response.text().await.unwrap_or_default();
    if text.trim().is_empty() {
        return (status, None);
    }
    let payload = serde_json::from_str::<Value>(&text).unwrap_or_else(|_| json!({ "error": text }));
    (status, Some(payload))
}

pub async fn response_envelope(response: Response) -> ApiEnvelope {
    let ok = response.status().is_success();
    let (status, payload) = parse_response_payload(response).await;
    ApiEnvelope {
        ok,
        status,
        payload,
    }
}

pub async fn response_json_or_error(response: Response) -> Result<Value, String> {
    let ok = response.status().is_success();
    let (_status, payload) = parse_response_payload(response).await;
    if ok {
        return Ok(payload.unwrap_or(Value::Null));
    }

    Err(api_error_message(payload.as_ref()))
}

pub fn api_error_message(payload: Option<&Value>) -> String {
    payload
        .and_then(|value| {
            value
                .get("error")
                .or_else(|| value.get("message"))
                .and_then(Value::as_str)
        })
        .filter(|message| !message.trim().is_empty())
        .unwrap_or("Desktop API request failed.")
        .to_string()
}

pub fn method(name: &str) -> Result<Method, String> {
    Method::from_bytes(name.as_bytes()).map_err(|error| error.to_string())
}

pub fn app_data_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

pub fn secure_store_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("secure-store");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

pub fn read_json_file(path: &PathBuf) -> Option<Value> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&raw).ok()
}

pub fn write_json_file(path: &PathBuf, value: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let raw = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    fs::write(path, raw).map_err(|error| error.to_string())
}

pub fn read_plain_envelope(path: &PathBuf, fallback: Value) -> Value {
    let Some(value) = read_json_file(path) else {
        return fallback;
    };
    if let Some(payload) = value.get("payload").and_then(Value::as_str) {
        return serde_json::from_str::<Value>(payload).unwrap_or(fallback);
    }
    value
}

pub fn write_plain_envelope(path: &PathBuf, payload: &Value) -> Result<bool, String> {
    let envelope = json!({
        "encrypted": false,
        "payload": serde_json::to_string(payload).map_err(|error| error.to_string())?,
    });
    write_json_file(path, &envelope)?;
    Ok(false)
}

pub fn value_object(payload: Value) -> serde_json::Map<String, Value> {
    payload.as_object().cloned().unwrap_or_default()
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn stable_hash(namespace: &str, source: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(namespace.as_bytes());
    hasher.update(b":");
    hasher.update(source.as_bytes());
    hex::encode(hasher.finalize())
}
