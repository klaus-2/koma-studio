//! Pooled HTTP + JSON file helpers for the desktop API commands.

use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::OnceLock,
    time::Duration,
};

use futures_util::StreamExt;
use reqwest::{Client, Method, Response, redirect::Policy};
use serde::Serialize;
use serde_json::{Value, json};
use tauri::{AppHandle, Manager, Runtime};
use url::Url;
use uuid::Uuid;

use crate::{
    commands::desktop::build_runtime_config,
    error::{AppError, AppResult},
    models::api::ApiEnvelope,
};

pub const AUTH_API_BASE: ApiBase = ApiBase::Auth;

const MAX_JSON_FILE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_RESPONSE_BYTES: usize = 8 * 1024 * 1024;

static PUBLIC_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();
static PINNED_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApiBase {
    Auth,
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
        .chars()
        .take(4096)
        .collect()
}

pub fn raw_string_field(payload: &Value, key: &str) -> String {
    payload
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .chars()
        .take(65_536)
        .collect()
}

pub fn bool_field(payload: &Value, key: &str) -> bool {
    payload.get(key).and_then(Value::as_bool).unwrap_or(false)
}

pub fn number_field(payload: &Value, key: &str) -> Option<f64> {
    payload.get(key).and_then(Value::as_f64)
}

pub fn access_token(payload: &Value) -> AppResult<String> {
    let token = string_field(payload, "accessToken");
    if token.is_empty() {
        Err(AppError::Authentication(
            "Access token is missing.".to_string(),
        ))
    } else {
        Ok(token)
    }
}

pub fn http_client() -> AppResult<Client> {
    cached_client(&PUBLIC_HTTP_CLIENT, || {
        Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .redirect(Policy::limited(5))
            .user_agent(concat!(
                "KOMA-Studio/",
                env!("CARGO_PKG_VERSION")
            ))
            .build()
            .map_err(|error| AppError::network("HTTP client initialization failed.", &error))
    })
}

pub fn http_client_for_app<R: Runtime>(app: &AppHandle<R>) -> AppResult<Client> {
    cached_client(&PINNED_HTTP_CLIENT, || {
        crate::security::cert_pinning::pinned_http_client(app, Duration::from_secs(30)).inspect_err(
            |error| {
                tracing::error!(
                    error_kind = error.kind(),
                    "pinned HTTP client initialization failed"
                );
            },
        )
    })
}

fn cached_client(
    cell: &OnceLock<Client>,
    build: impl FnOnce() -> AppResult<Client>,
) -> AppResult<Client> {
    if let Some(client) = cell.get() {
        return Ok(client.clone());
    }

    let client = build()?;
    if cell.set(client.clone()).is_ok() {
        return Ok(client);
    }

    cell.get()
        .cloned()
        .ok_or_else(|| AppError::Internal("HTTP client cache initialization failed.".to_string()))
}

pub fn api_url<R: Runtime>(
    app: &AppHandle<R>,
    base: ApiBase,
    endpoint_path: &str,
) -> AppResult<String> {
    validate_endpoint_path(endpoint_path)?;

    let config = build_runtime_config(app);
    let raw_base = match base {
        ApiBase::Auth => config.auth_api_url,
    };

    let base_url = Url::parse(&raw_base)?;
    validate_service_base_url(&base_url)?;

    let result = base_url.join(endpoint_path)?;
    if result.scheme() != base_url.scheme()
        || result.host_str() != base_url.host_str()
        || result.port_or_known_default() != base_url.port_or_known_default()
    {
        return Err(AppError::security(
            "API endpoint attempted to leave the configured service origin.",
        ));
    }

    Ok(result.to_string())
}

fn validate_endpoint_path(value: &str) -> AppResult<()> {
    if value.is_empty()
        || !value.starts_with('/')
        || value.starts_with("//")
        || value.contains('\\')
        || value.chars().any(char::is_control)
        || Url::parse(value).is_ok()
    {
        return Err(AppError::invalid_input("Invalid API endpoint path."));
    }
    Ok(())
}

fn validate_service_base_url(url: &Url) -> AppResult<()> {
    let host = url
        .host_str()
        .ok_or_else(|| AppError::invalid_input("API base URL has no host."))?;

    let loopback = host.eq_ignore_ascii_case("localhost")
        || host
            .parse::<std::net::IpAddr>()
            .is_ok_and(|ip| ip.is_loopback());

    if url.scheme() != "https" && !(url.scheme() == "http" && loopback) {
        return Err(AppError::security("Remote API base URLs must use HTTPS."));
    }

    if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
        return Err(AppError::invalid_input(
            "API base URL contains unsupported components.",
        ));
    }

    Ok(())
}

pub async fn parse_response_payload(response: Response) -> AppResult<(u16, Option<Value>)> {
    let status = response.status().as_u16();
    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk =
            chunk.map_err(|error| AppError::network("HTTP response read failed.", &error))?;

        if bytes.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err(AppError::Network(
                "Remote response exceeds the supported size.".to_string(),
            ));
        }

        bytes.extend_from_slice(&chunk);
    }

    if bytes.iter().all(u8::is_ascii_whitespace) {
        return Ok((status, None));
    }

    let payload = match serde_json::from_slice::<Value>(&bytes) {
        Ok(value) => value,
        Err(error) => {
            tracing::warn!(
                status,
                response_bytes = bytes.len(),
                error = %error,
                "remote service returned non-JSON content"
            );
            json!({ "error": "Remote service returned an invalid response." })
        }
    };

    Ok((status, Some(payload)))
}

pub async fn response_envelope(response: Response) -> ApiEnvelope {
    let success = response.status().is_success();

    match parse_response_payload(response).await {
        Ok((status, payload)) => ApiEnvelope {
            ok: success,
            status,
            payload,
        },
        Err(error) => {
            tracing::error!(error_kind = error.kind(), "response envelope parsing failed");
            ApiEnvelope {
                ok: false,
                status: 0,
                payload: Some(json!({
                    "error": "The remote response could not be processed."
                })),
            }
        }
    }
}

pub async fn response_json_or_error(response: Response) -> AppResult<Value> {
    let success = response.status().is_success();
    let (status, payload) = parse_response_payload(response).await?;

    if success {
        return Ok(payload.unwrap_or(Value::Null));
    }

    Err(AppError::Remote {
        status,
        message: api_error_message(payload.as_ref()),
    })
}

pub fn api_error_message(payload: Option<&Value>) -> String {
    let message = payload
        .and_then(|value| {
            value
                .get("error")
                .and_then(|error| {
                    error
                        .as_str()
                        .or_else(|| error.get("message").and_then(Value::as_str))
                })
                .or_else(|| value.get("message").and_then(Value::as_str))
        })
        .unwrap_or("Desktop API request failed.");

    sanitize_remote_message(message)
}

fn sanitize_remote_message(value: &str) -> String {
    let normalized: String = value
        .chars()
        .filter(|character| !character.is_control() || *character == ' ')
        .take(512)
        .collect();

    if normalized.trim().is_empty() {
        "Desktop API request failed.".to_string()
    } else {
        normalized
    }
}

/// Explicit allowlist: the frontend never decides which HTTP methods this
/// process emits (blocks TRACE/CONNECT and arbitrary custom methods).
pub fn method(name: &str) -> AppResult<Method> {
    match name.trim().to_ascii_uppercase().as_str() {
        "GET" => Ok(Method::GET),
        "POST" => Ok(Method::POST),
        "PUT" => Ok(Method::PUT),
        "PATCH" => Ok(Method::PATCH),
        "DELETE" => Ok(Method::DELETE),
        "HEAD" => Ok(Method::HEAD),
        "OPTIONS" => Ok(Method::OPTIONS),
        _ => Err(AppError::invalid_input("Invalid HTTP method.")),
    }
}

pub fn app_data_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?)
}

pub fn secure_store_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let directory = app_data_dir(app)?.join("secure-store");
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

pub fn read_json_file(path: &Path) -> AppResult<Option<Value>> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(None);
        }
        Err(error) => return Err(error.into()),
    };

    let metadata = file.metadata()?;
    if !metadata.is_file() {
        return Err(AppError::NotAFile(path.to_path_buf()));
    }
    if metadata.len() > MAX_JSON_FILE_BYTES {
        return Err(AppError::Serialization(
            "JSON metadata file exceeds the supported size.".to_string(),
        ));
    }

    let mut reader = file.take(MAX_JSON_FILE_BYTES + 1);
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    reader.read_to_end(&mut bytes)?;

    if bytes.len() as u64 > MAX_JSON_FILE_BYTES {
        return Err(AppError::Serialization(
            "JSON metadata file exceeds the supported size.".to_string(),
        ));
    }

    Ok(Some(serde_json::from_slice(&bytes)?))
}

pub async fn read_json_file_async(path: PathBuf) -> AppResult<Option<Value>> {
    tokio::task::spawn_blocking(move || read_json_file(&path)).await?
}

pub fn write_json_file<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::invalid_path("Metadata path has no parent directory."))?;
    fs::create_dir_all(parent)?;

    let bytes = serde_json::to_vec(value)?;
    if bytes.len() as u64 > MAX_JSON_FILE_BYTES {
        return Err(AppError::Serialization(
            "JSON metadata exceeds the supported size.".to_string(),
        ));
    }

    let temp_path = parent.join(format!(
        ".{}.{}.tmp",
        path.file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("metadata.json"),
        Uuid::new_v4()
    ));

    let operation = (|| -> AppResult<()> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)?;
        set_private_permissions(&file)?;
        file.write_all(&bytes)?;
        file.sync_all()?;

        replace_file(&temp_path, path)?;
        sync_directory(parent)?;
        Ok(())
    })();

    if operation.is_err() {
        if let Err(error) = fs::remove_file(&temp_path) {
            if error.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!(error_kind = ?error.kind(), "temporary metadata cleanup failed");
            }
        }
    }

    operation
}

pub async fn write_json_file_async<T>(path: PathBuf, value: T) -> AppResult<()>
where
    T: Serialize + Send + 'static,
{
    tokio::task::spawn_blocking(move || write_json_file(&path, &value)).await?
}

/// Legacy envelopes wrapped the payload as a JSON string; reads through both
/// shapes so older installs keep working.
pub fn read_legacy_plain_envelope(path: &Path, fallback: Value) -> AppResult<Value> {
    let Some(value) = read_json_file(path)? else {
        return Ok(fallback);
    };

    if let Some(payload) = value.get("payload").and_then(Value::as_str) {
        return Ok(serde_json::from_str(payload)?);
    }

    Ok(value)
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

#[cfg(unix)]
fn set_private_permissions(file: &File) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;

    file.set_permissions(fs::Permissions::from_mode(0o600))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_permissions(_file: &File) -> AppResult<()> {
    Ok(())
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> AppResult<()> {
    File::open(path)?.sync_all()?;
    Ok(())
}

#[cfg(not(unix))]
fn sync_directory(_path: &Path) -> AppResult<()> {
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn replace_file(source: &Path, destination: &Path) -> AppResult<()> {
    fs::rename(source, destination)?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn replace_file(source: &Path, destination: &Path) -> AppResult<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
    };

    let source: Vec<u16> = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let destination: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };

    if result == 0 {
        return Err(std::io::Error::last_os_error().into());
    }

    Ok(())
}
