//! Checksum helpers: streaming file hashing, deterministic directory-tree
//! hashing (portable paths, symlink-free), and remote checksum resolution
//! restricted to the approved model provider (Hugging Face).

use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::Path,
    sync::OnceLock,
    time::Duration,
};

use base64::{engine::general_purpose::STANDARD, Engine as _};
use futures_util::StreamExt;
use reqwest::{
    header::HeaderMap,
    redirect::{Attempt, Policy},
    Client, StatusCode,
};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use url::Url;

use crate::error::{AppError, AppResult};

const HASH_BUFFER_BYTES: usize = 256 * 1024;
const MAX_HUGGING_FACE_RESPONSE_BYTES: usize = 4 * 1024 * 1024;

static MODEL_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HuggingFaceResolveUrlParts {
    pub owner: String,
    pub repo: String,
    pub revision: String,
    pub file_path: String,
}

#[derive(Debug, Deserialize)]
struct HuggingFaceRevision {
    #[serde(default)]
    siblings: Vec<HuggingFaceSibling>,
}

#[derive(Debug, Deserialize)]
struct HuggingFaceSibling {
    rfilename: String,
    lfs: Option<HuggingFaceLfs>,
}

#[derive(Debug, Deserialize)]
struct HuggingFaceLfs {
    sha256: Option<String>,
    oid: Option<String>,
}



pub fn copy_and_checksum(
    source: &Path,
    destination: &Path,
    mut progress: impl FnMut(u64, u64),
) -> AppResult<String> {
    reject_symlink(source)?;

    let mut input = File::open(source)?;
    let initial_metadata = input.metadata()?;

    if !initial_metadata.is_file() {
        return Err(AppError::NotAFile(source.to_path_buf()));
    }

    let mut output = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)?;
    set_private_permissions(&output)?;

    let total = initial_metadata.len();
    let initial_modified = initial_metadata.modified().ok();
    let mut transferred = 0_u64;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; HASH_BUFFER_BYTES];

    loop {
        let read = input.read(&mut buffer)?;
        if read == 0 {
            break;
        }

        hasher.update(&buffer[..read]);
        output.write_all(&buffer[..read])?;
        transferred = transferred
            .checked_add(read as u64)
            .ok_or_else(|| AppError::Integrity("File size overflow.".to_string()))?;

        progress(transferred, total);
    }

    output.sync_all()?;

    let final_metadata = input.metadata()?;
    if transferred != total
        || final_metadata.len() != initial_metadata.len()
        || final_metadata.modified().ok() != initial_modified
    {
        return Err(AppError::Conflict(
            "The source file changed while it was being copied.".to_string(),
        ));
    }

    Ok(hex::encode(hasher.finalize()))
}

pub fn is_valid_checksum(value: &str) -> bool {
    let value = value.trim();
    value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

pub fn normalize_checksum(value: &str) -> AppResult<String> {
    let normalized = value.trim().to_ascii_lowercase();

    if !is_valid_checksum(&normalized) {
        return Err(AppError::invalid_input("Invalid SHA-256 checksum."));
    }

    Ok(normalized)
}

pub fn validate_remote_download_url(value: &str) -> AppResult<Url> {
    let url = Url::parse(value.trim())?;
    let host = url
        .host_str()
        .ok_or_else(|| AppError::invalid_input("Model download URL has no host."))?
        .to_ascii_lowercase();

    let allowed_host = host == "huggingface.co"
        || host.ends_with(".huggingface.co")
        || host == "hf.co"
        || host.ends_with(".hf.co");

    if url.scheme() != "https"
        || !allowed_host
        || !url.username().is_empty()
        || url.password().is_some()
        || url.fragment().is_some()
        || url.port_or_known_default() != Some(443)
    {
        return Err(AppError::security(
            "Model downloads are restricted to approved HTTPS model providers.",
        ));
    }

    Ok(url)
}

pub async fn resolve_checksum_from_head(download_url: &str) -> AppResult<Option<String>> {
    let url = validate_remote_download_url(download_url)?;
    let response = model_http_client()?
        .head(url)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|error| AppError::network("Model checksum HEAD request failed.", &error))?;

    if matches!(
        response.status(),
        StatusCode::METHOD_NOT_ALLOWED | StatusCode::NOT_IMPLEMENTED
    ) {
        return Ok(None);
    }

    if !response.status().is_success() {
        return Err(AppError::Remote {
            status: response.status().as_u16(),
            message: "Model provider rejected the checksum request.".to_string(),
        });
    }

    Ok(extract_checksum_from_headers(response.headers()))
}

pub async fn resolve_checksum_from_hugging_face_api(
    download_url: &str,
) -> AppResult<Option<String>> {
    let parts = match parse_hugging_face_resolve_url(download_url) {
        Some(parts) => parts,
        None => return Ok(None),
    };

    let mut api_url = Url::parse("https://huggingface.co/api/models/")?;
    {
        let mut segments = api_url
            .path_segments_mut()
            .map_err(|_| AppError::invalid_input("Invalid Hugging Face API base URL."))?;
        segments
            .push(&parts.owner)
            .push(&parts.repo)
            .push("revision")
            .push(&parts.revision);
    }

    let response = model_http_client()?
        .get(api_url)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|error| AppError::network("Hugging Face metadata request failed.", &error))?;

    if !response.status().is_success() {
        return Err(AppError::Remote {
            status: response.status().as_u16(),
            message: "Hugging Face rejected the model metadata request.".to_string(),
        });
    }

    let payload: HuggingFaceRevision =
        read_json_limited(response, MAX_HUGGING_FACE_RESPONSE_BYTES).await?;

    for sibling in payload.siblings {
        if sibling.rfilename != parts.file_path {
            continue;
        }

        let Some(lfs) = sibling.lfs else {
            return Ok(None);
        };

        for candidate in [lfs.sha256.as_deref(), lfs.oid.as_deref()]
            .into_iter()
            .flatten()
        {
            if let Some(checksum) = parse_checksum_from_header_value(candidate) {
                return Ok(Some(checksum));
            }
        }
    }

    Ok(None)
}

pub fn parse_hugging_face_resolve_url(download_url: &str) -> Option<HuggingFaceResolveUrlParts> {
    let parsed = validate_remote_download_url(download_url).ok()?;

    if parsed.host_str()? != "huggingface.co" {
        return None;
    }

    let segments = parsed
        .path_segments()?
        .map(|segment| {
            percent_encoding::percent_decode_str(segment)
                .decode_utf8()
                .ok()
                .map(|value| value.into_owned())
        })
        .collect::<Option<Vec<_>>>()?;

    let resolve_index = segments
        .iter()
        .position(|segment| segment.eq_ignore_ascii_case("resolve"))?;

    if resolve_index != 2 || resolve_index + 2 >= segments.len() {
        return None;
    }

    let owner = validate_provider_segment(&segments[0])?;
    let repo = validate_provider_segment(&segments[1])?;
    let revision = validate_provider_segment(&segments[resolve_index + 1])?;
    let file_segments = &segments[resolve_index + 2..];

    if file_segments.is_empty()
        || file_segments.iter().any(|segment| {
            segment.is_empty()
                || segment == "."
                || segment == ".."
                || segment.contains('\\')
                || segment.contains('\0')
        })
    {
        return None;
    }

    Some(HuggingFaceResolveUrlParts {
        owner,
        repo,
        revision,
        file_path: file_segments.join("/"),
    })
}

pub fn extract_checksum_from_headers(headers: &HeaderMap) -> Option<String> {
    for key in [
        "x-linked-etag",
        "x-checksum-sha256",
        "x-amz-meta-checksum-sha256",
        "x-amz-meta-sha256",
        "content-digest",
        "digest",
        "etag",
    ] {
        if let Some(checksum) = headers
            .get(key)
            .and_then(|value| value.to_str().ok())
            .and_then(parse_checksum_from_header_value)
        {
            return Some(checksum);
        }
    }

    None
}

pub fn parse_checksum_from_header_value(raw: &str) -> Option<String> {
    let normalized = raw
        .trim()
        .trim_start_matches("W/")
        .trim_matches('"')
        .trim_matches('\'');

    for token in normalized.split(|character: char| {
        !(character.is_ascii_alphanumeric() || matches!(character, '+' | '/' | '=' | '-' | '_'))
    }) {
        let hex_candidate = token
            .strip_prefix("sha256")
            .or_else(|| token.strip_prefix("SHA256"))
            .unwrap_or(token)
            .trim_start_matches(['-', '=', ':']);

        if is_valid_checksum(hex_candidate) {
            return Some(hex_candidate.to_ascii_lowercase());
        }

        let base64_candidate = token
            .strip_prefix("sha256-")
            .or_else(|| token.strip_prefix("SHA256-"))
            .or_else(|| token.strip_prefix("sha-256="))
            .unwrap_or_default()
            .trim_matches(':');

        if !base64_candidate.is_empty() {
            if let Ok(decoded) = STANDARD.decode(base64_candidate) {
                if decoded.len() == 32 {
                    return Some(hex::encode(decoded));
                }
            }
        }    }

    let lower = normalized.to_ascii_lowercase();
    let bytes = lower.as_bytes();

    for (index, window) in bytes.windows(64).enumerate() {
        if !window.iter().all(u8::is_ascii_hexdigit) {
            continue;
        }

        let left_boundary = index == 0 || !bytes[index - 1].is_ascii_hexdigit();
        let right_index = index + 64;
        let right_boundary = right_index == bytes.len() || !bytes[right_index].is_ascii_hexdigit();

        if left_boundary && right_boundary {
            return std::str::from_utf8(window).ok().map(ToString::to_string);
        }
    }

    None
}




pub(super) fn reject_symlink(path: &Path) -> AppResult<()> {
    if fs::symlink_metadata(path)?.file_type().is_symlink() {
        return Err(AppError::security(
            "Symbolic links are not allowed for managed model files.",
        ));
    }

    Ok(())
}

fn validate_provider_segment(value: &str) -> Option<String> {
    if !value.is_empty()
        && value.len() <= 256
        && !matches!(value, "." | "..")
        && !value.contains(['/', '\\', '\0'])
        && !value.chars().any(char::is_control)
    {
        Some(value.to_string())
    } else {
        None
    }
}

fn model_http_client() -> AppResult<Client> {
    if let Some(client) = MODEL_HTTP_CLIENT.get() {
        return Ok(client.clone());
    }

    let client = Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .redirect(Policy::custom(validate_redirect))
        .user_agent(concat!("KOMA-Studio/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| AppError::network("Model HTTP client initialization failed.", &error))?;

    if MODEL_HTTP_CLIENT.set(client.clone()).is_ok() {
        return Ok(client);
    }

    MODEL_HTTP_CLIENT
        .get()
        .cloned()
        .ok_or_else(|| AppError::Internal("Model HTTP client cache failed.".to_string()))
}

fn validate_redirect(attempt: Attempt<'_>) -> reqwest::redirect::Action {
    if attempt.previous().len() >= 5 {
        return attempt.error("model download exceeded the redirect limit");
    }

    if validate_remote_download_url(attempt.url().as_str()).is_err() {
        return attempt.error("model download redirect left the approved origins");
    }

    attempt.follow()
}

async fn read_json_limited<T>(response: reqwest::Response, limit: usize) -> AppResult<T>
where
    T: serde::de::DeserializeOwned,
{
    if response
        .content_length()
        .is_some_and(|content_length| content_length > limit as u64)
    {
        return Err(AppError::Network(
            "Remote metadata response exceeds the supported size.".to_string(),
        ));
    }

    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk =
            chunk.map_err(|error| AppError::network("Remote metadata read failed.", &error))?;

        if bytes.len().saturating_add(chunk.len()) > limit {
            return Err(AppError::Network(
                "Remote metadata response exceeds the supported size.".to_string(),
            ));
        }

        bytes.extend_from_slice(&chunk);
    }

    Ok(serde_json::from_slice(&bytes)?)
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
