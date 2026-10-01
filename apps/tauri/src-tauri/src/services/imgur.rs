//! Imgur service: multi-key uploads with key rotation, persistent local rate
//! ledger, keychain-stored Client IDs and delete hashes, transactional config
//! changes with secret rollback.

use std::{
    path::PathBuf,
    time::Duration,
};

use reqwest::{Body, Client, StatusCode, multipart};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tokio::io::AsyncReadExt;
use tokio_util::io::ReaderStream;
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::{
    error::{AppError, AppResult},
    models::imgur::{ImgurConfig, ImgurConfigResult, ImgurKeyConfig, ImgurKeyId, ImgurRateStatus},
    services::{
        api_client::{
            api_error_message, http_client, parse_response_payload, read_json_file_async,
            secure_store_dir, stable_hash, write_json_file_async,
        },
        secret_store,
    },
    state::AuthorizedWorkspaceAsset,
};

const IMGUR_API_URL: &str = "https://api.imgur.com/3/image";
const DEFAULT_RATE_LIMIT_PER_HOUR: u32 = 50;
const DEFAULT_BATCH_DELAY_MS: u64 = 1200;
const MAX_KEYS: usize = 32;
const MAX_BATCH: usize = 100;
const MAX_IMAGE_BYTES: u64 = 10 * 1024 * 1024;
const RATE_WINDOW_MS: i64 = 60 * 60 * 1000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredImgurConfig {
    version: u8,
    keys: Vec<StoredImgurKey>,
    rate_limit_per_hour: u32,
    batch_delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredImgurKey {
    id: ImgurKeyId,
    label: String,
    enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RateLedger {
    version: u8,
    records: Vec<RateRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RateRecord {
    id: String,
    timestamp_ms: i64,
}

struct ActiveKey {
    label: String,
    credential: secret_store::SecretString,
}

pub struct ResolvedUpload {
    pub asset: AuthorizedWorkspaceAsset,
    pub alt_text: String,
}

struct SecretChange {
    account: String,
    before: Option<Zeroizing<String>>,
    after: Option<Zeroizing<String>>,
}

pub struct UploadedImage {
    pub id: String,
    pub file_name: String,
    pub mime_type: String,
    pub alt_text: String,
    pub direct_url: String,
    pub width: Option<u64>,
    pub height: Option<u64>,
    pub byte_length: u64,
    pub key_label: String,
}

pub async fn load_config(app: &AppHandle) -> AppResult<ImgurConfigResult> {
    let stored = load_stored_config(app).await?;
    let mut keys = Vec::with_capacity(stored.keys.len());

    for key in &stored.keys {
        let has_credential = secret_store::get(key_account(&key.id)).await?.is_some();

        keys.push(ImgurKeyConfig {
            id: key.id.clone(),
            label: key.label.clone(),
            enabled: key.enabled,
            has_credential,
        });
    }

    Ok(ImgurConfigResult {
        config: ImgurConfig {
            keys,
            rate_limit_per_hour: stored.rate_limit_per_hour,
            batch_delay_ms: stored.batch_delay_ms,
        },
        secure_storage: true,
        rate_limit: rate_status(app, stored.rate_limit_per_hour).await?,
    })
}

/// Request keys arrive as raw Client IDs (legacy inline contract) or absent
/// (keep the current credential). The service stores only in the keychain.
#[derive(Debug)]
pub struct SaveImgurKeyInput {
    pub id: ImgurKeyId,
    pub label: String,
    pub enabled: bool,
    pub client_id: Option<Zeroizing<String>>,
    pub clear_credential: bool,
}

pub async fn save_config(
    app: &AppHandle,
    request: Vec<SaveImgurKeyInput>,
    rate_limit_per_hour: u32,
    batch_delay_ms: u64,
) -> AppResult<ImgurConfigResult> {
    if request.len() > MAX_KEYS {
        return Err(AppError::invalid_input(
            "Imgur configuration supports at most 32 keys.",
        ));
    }

    let rate_limit = rate_limit_per_hour.clamp(1, 5000);
    let batch_delay = batch_delay_ms.min(60_000);
    let previous = load_stored_config(app).await?;
    let previous_ids: std::collections::HashSet<_> =
        previous.keys.iter().map(|key| key.id.clone()).collect();

    let mut seen = std::collections::HashSet::new();
    let mut next_keys = Vec::with_capacity(request.len());
    let mut changes = Vec::new();

    for input in &request {
        validate_key_id(&input.id)?;
        if !seen.insert(input.id.clone()) {
            return Err(AppError::invalid_input(
                "Imgur key identifiers must be unique.",
            ));
        }

        let label = sanitize_label(&input.label);
        let account = key_account(&input.id);
        let before = secret_store::get(account.clone())
            .await?
            .map(|secret| secret.snapshot());

        let after = if input.clear_credential {
            None
        } else if let Some(client_id) = &input.client_id {
            let value = validate_client_id(client_id.as_str())?;
            Some(Zeroizing::new(value))
        } else {
            before.clone()
        };

        changes.push(SecretChange {
            account,
            before,
            after,
        });

        next_keys.push(StoredImgurKey {
            id: input.id.clone(),
            label,
            enabled: input.enabled,
        });
    }

    for removed in previous_ids.difference(&seen) {
        let account = key_account(removed);
        let before = secret_store::get(account.clone())
            .await?
            .map(|secret| secret.snapshot());

        changes.push(SecretChange {
            account,
            before,
            after: None,
        });
    }

    let stored = StoredImgurConfig {
        version: 2,
        keys: next_keys,
        rate_limit_per_hour: rate_limit,
        batch_delay_ms: batch_delay,
    };

    commit_config(app, &stored, &changes).await?;
    load_config(app).await
}

pub async fn upload(
    app: &AppHandle,
    items: Vec<ResolvedUpload>,
) -> AppResult<(Vec<UploadedImage>, ImgurRateStatus)> {
    if items.is_empty() || items.len() > MAX_BATCH {
        return Err(AppError::invalid_input(
            "Imgur batches must contain between 1 and 100 images.",
        ));
    }

    let config = load_stored_config(app).await?;
    let keys = active_keys(&config).await?;
    if keys.is_empty() {
        return Err(AppError::not_configured(
            "Configure at least one enabled Imgur Client ID.",
        ));
    }

    let client = http_client()?;
    let mut uploaded = Vec::with_capacity(items.len());

    for (index, item) in items.into_iter().enumerate() {
        validate_asset(&item.asset).await?;
        let reservation = reserve_rate_slot(app, config.rate_limit_per_hour).await?;

        match upload_one(&client, &keys, item).await {
            Ok(image) => uploaded.push(image),
            Err(error) => {
                rollback_rate_slot(app, &reservation).await?;
                return Err(error);
            }
        }

        if index + 1 < uploaded.capacity() && config.batch_delay_ms > 0 {
            tokio::time::sleep(Duration::from_millis(config.batch_delay_ms)).await;
        }
    }

    let status = rate_status(app, config.rate_limit_per_hour).await?;
    Ok((uploaded, status))
}

async fn upload_one(
    client: &Client,
    keys: &[ActiveKey],
    item: ResolvedUpload,
) -> AppResult<UploadedImage> {
    let mut rejected_credentials = Vec::new();

    for key in keys {
        let file = tokio::fs::File::open(&item.asset.source_path).await?;
        let body = Body::wrap_stream(ReaderStream::new(file));
        let part = multipart::Part::stream_with_length(body, item.asset.byte_length)
            .file_name(item.asset.file_name.clone())
            .mime_str(&item.asset.mime_type)
            .map_err(|_| AppError::invalid_input("Invalid image MIME type."))?;

        let mut form = multipart::Form::new()
            .part("image", part)
            .text("type", "file")
            .text("name", item.asset.file_name.clone());

        if !item.alt_text.trim().is_empty() {
            let alt_text: String = item.alt_text.trim().chars().take(1000).collect();
            form = form
                .text("title", alt_text.clone())
                .text("description", alt_text);
        }

        let response = client
            .post(IMGUR_API_URL)
            .header(
                reqwest::header::AUTHORIZATION,
                format!("Client-ID {}", key.credential.expose()),
            )
            .multipart(form)
            .send()
            .await
            .map_err(|error| AppError::network("Imgur upload request failed.", &error))?;

        let status = response.status();
        let (_, payload) = parse_response_payload(response).await?;
        let payload = payload.unwrap_or(Value::Null);

        if matches!(
            status,
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN | StatusCode::TOO_MANY_REQUESTS
        ) {
            rejected_credentials.push((key.label.clone(), status.as_u16()));
            continue;
        }

        if !status.is_success() {
            return Err(AppError::Remote {
                status: status.as_u16(),
                message: api_error_message(Some(&payload)),
            });
        }

        let data = payload
            .get("data")
            .ok_or_else(|| {
                AppError::Network("Imgur response does not contain image data.".to_string())
            })?;

        let direct_url = required_https_url(data, "link")?;
        let remote_id = required_string(data, "id")?;
        let delete_hash = data
            .get("deletehash")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty());

        if let Some(delete_hash) = delete_hash {
            let account = format!(
                "imgur-delete:{}",
                stable_hash("imgur-delete", &remote_id)
            );

            if let Err(error) = secret_store::set(account, delete_hash).await {
                cleanup_uploaded_image(client, delete_hash).await;
                return Err(error);
            }
        }

        return Ok(UploadedImage {
            id: item.asset.id.0.clone(),
            file_name: item.asset.file_name.clone(),
            mime_type: item.asset.mime_type.clone(),
            alt_text: item.alt_text.chars().take(1000).collect(),
            direct_url,
            width: data.get("width").and_then(Value::as_u64),
            height: data.get("height").and_then(Value::as_u64),
            byte_length: item.asset.byte_length,
            key_label: key.label.clone(),
        });
    }

    tracing::warn!(
        rejected_key_count = rejected_credentials.len(),
        "all Imgur credentials were rejected"
    );

    Err(AppError::Authentication(
        "All enabled Imgur credentials were rejected or rate-limited.".to_string(),
    ))
}

async fn validate_asset(asset: &AuthorizedWorkspaceAsset) -> AppResult<()> {
    if asset.byte_length == 0 || asset.byte_length > MAX_IMAGE_BYTES {
        return Err(AppError::invalid_input(
            "Imgur images must be between 1 byte and 10 MiB.",
        ));
    }

    let metadata = tokio::fs::metadata(&asset.source_path).await?;
    if !metadata.is_file() || metadata.len() != asset.byte_length {
        return Err(AppError::Conflict(
            "The image changed after authorization.".to_string(),
        ));
    }

    let mut file = tokio::fs::File::open(&asset.source_path).await?;
    let mut header = vec![0_u8; 8192];
    let read = file.read(&mut header).await?;
    header.truncate(read);

    let detected = infer::get(&header).ok_or_else(|| {
        AppError::UnsupportedMediaType("The selected file is not a recognized image.".to_string())
    })?;

    if !detected.mime_type().starts_with("image/") {
        return Err(AppError::UnsupportedMediaType(
            "Only image files may be uploaded to Imgur.".to_string(),
        ));
    }

    Ok(())
}

async fn active_keys(config: &StoredImgurConfig) -> AppResult<Vec<ActiveKey>> {
    let mut keys = Vec::new();

    for key in config.keys.iter().filter(|key| key.enabled) {
        if let Some(credential) = secret_store::get(key_account(&key.id)).await? {
            keys.push(ActiveKey {
                label: key.label.clone(),
                credential,
            });
        }
    }

    Ok(keys)
}

async fn load_stored_config(app: &AppHandle) -> AppResult<StoredImgurConfig> {
    let path = config_path(app)?;
    let Some(raw) = read_json_file_async(path.clone()).await? else {
        return Ok(default_config());
    };

    if let Ok(config) = serde_json::from_value::<StoredImgurConfig>(raw.clone()) {
        if config.version == 2 {
            return Ok(normalize_stored_config(config));
        }
    }

    migrate_legacy_config(app, path, raw).await
}

async fn migrate_legacy_config(
    _app: &AppHandle,
    path: PathBuf,
    raw: Value,
) -> AppResult<StoredImgurConfig> {
    let legacy = if let Some(payload) = raw.get("payload").and_then(Value::as_str) {
        serde_json::from_str::<Value>(payload)?
    } else {
        raw
    };

    let mut keys = Vec::new();
    let mut changes = Vec::new();

    for item in legacy
        .get("keys")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .take(MAX_KEYS)
    {
        let client_id = item
            .get("clientId")
            .and_then(Value::as_str)
            .map(validate_client_id)
            .transpose()?;

        let Some(client_id) = client_id else {
            continue;
        };

        let id = item
            .get("id")
            .and_then(Value::as_str)
            .filter(|id| valid_identifier(id))
            .map(|id| ImgurKeyId(id.to_string()))
            .unwrap_or_else(|| ImgurKeyId(Uuid::new_v4().to_string()));

        let account = key_account(&id);
        let before = secret_store::get(account.clone())
            .await?
            .map(|secret| secret.snapshot());

        changes.push(SecretChange {
            account,
            before,
            after: Some(Zeroizing::new(client_id)),
        });

        keys.push(StoredImgurKey {
            id,
            label: sanitize_label(
                item.get("label")
                    .and_then(Value::as_str)
                    .unwrap_or("Imgur"),
            ),
            enabled: item
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true),
        });
    }

    let config = StoredImgurConfig {
        version: 2,
        keys,
        rate_limit_per_hour: legacy
            .get("rateLimitPerHour")
            .and_then(Value::as_u64)
            .map(|value| value as u32)
            .unwrap_or(DEFAULT_RATE_LIMIT_PER_HOUR)
            .clamp(1, 5000),
        batch_delay_ms: legacy
            .get("batchDelayMs")
            .and_then(Value::as_u64)
            .unwrap_or(DEFAULT_BATCH_DELAY_MS)
            .min(60_000),
    };

    apply_secret_changes(&changes).await?;
    if let Err(error) = write_json_file_async(path, config.clone()).await {
        rollback_secret_changes(&changes).await;
        return Err(error);
    }

    Ok(config)
}

async fn commit_config(
    app: &AppHandle,
    config: &StoredImgurConfig,
    changes: &[SecretChange],
) -> AppResult<()> {
    apply_secret_changes(changes).await?;

    let result = write_json_file_async(config_path(app)?, config.clone()).await;
    if let Err(error) = result {
        rollback_secret_changes(changes).await;
        return Err(error);
    }

    Ok(())
}

async fn apply_secret_changes(changes: &[SecretChange]) -> AppResult<()> {
    for (index, change) in changes.iter().enumerate() {
        let result = match &change.after {
            Some(secret) => {
                secret_store::set(change.account.clone(), secret.as_str()).await
            }
            None => secret_store::delete(change.account.clone()).await,
        };

        if let Err(error) = result {
            rollback_secret_changes(&changes[..index]).await;
            return Err(error);
        }
    }

    Ok(())
}

async fn rollback_secret_changes(changes: &[SecretChange]) {
    for change in changes.iter().rev() {
        let result = match &change.before {
            Some(secret) => {
                secret_store::set(change.account.clone(), secret.as_str()).await
            }
            None => secret_store::delete(change.account.clone()).await,
        };

        if let Err(error) = result {
            tracing::error!(error_kind = error.kind(), "keychain transaction rollback failed");
        }
    }
}

async fn reserve_rate_slot(app: &AppHandle, limit: u32) -> AppResult<String> {
    let now = chrono::Utc::now().timestamp_millis();
    let mut ledger = read_rate_ledger(app).await?;
    prune_rate_ledger(&mut ledger, now);

    if ledger.records.len() >= limit as usize {
        return Err(AppError::RateLimited(
            "The conservative local Imgur hourly limit was reached.".to_string(),
        ));
    }

    let id = Uuid::new_v4().to_string();
    ledger.records.push(RateRecord {
        id: id.clone(),
        timestamp_ms: now,
    });
    write_rate_ledger(app, ledger).await?;
    Ok(id)
}

async fn rollback_rate_slot(app: &AppHandle, reservation: &str) -> AppResult<()> {
    let mut ledger = read_rate_ledger(app).await?;
    ledger.records.retain(|record| record.id != reservation);
    write_rate_ledger(app, ledger).await
}

async fn rate_status(app: &AppHandle, limit: u32) -> AppResult<ImgurRateStatus> {
    let now = chrono::Utc::now().timestamp_millis();
    let mut ledger = read_rate_ledger(app).await?;
    let original_len = ledger.records.len();
    prune_rate_ledger(&mut ledger, now);

    if ledger.records.len() != original_len {
        write_rate_ledger(app, ledger.clone()).await?;
    }

    let used = ledger.records.len().min(u32::MAX as usize) as u32;
    let resets_at = ledger
        .records
        .iter()
        .map(|record| record.timestamp_ms)
        .min()
        .and_then(|timestamp| {
            chrono::DateTime::<chrono::Utc>::from_timestamp_millis(timestamp + RATE_WINDOW_MS)
        })
        .map(|date| date.to_rfc3339_opts(chrono::SecondsFormat::Millis, true));

    Ok(ImgurRateStatus {
        limit_per_hour: limit,
        used_this_hour: used,
        remaining_this_hour: limit.saturating_sub(used),
        resets_at,
    })
}

async fn read_rate_ledger(app: &AppHandle) -> AppResult<RateLedger> {
    let path = rate_path(app)?;
    let Some(value) = read_json_file_async(path).await? else {
        return Ok(RateLedger {
            version: 1,
            records: Vec::new(),
        });
    };

    if let Ok(ledger) = serde_json::from_value::<RateLedger>(value.clone()) {
        if ledger.version == 1 {
            return Ok(ledger);
        }
    }

    let records = value
        .get("uploadTimestamps")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_i64)
        .map(|timestamp_ms| RateRecord {
            id: Uuid::new_v4().to_string(),
            timestamp_ms,
        })
        .collect();

    Ok(RateLedger {
        version: 1,
        records,
    })
}

async fn write_rate_ledger(app: &AppHandle, ledger: RateLedger) -> AppResult<()> {
    write_json_file_async(rate_path(app)?, ledger).await
}

fn prune_rate_ledger(ledger: &mut RateLedger, now: i64) {
    let cutoff = now - RATE_WINDOW_MS;
    ledger
        .records
        .retain(|record| record.timestamp_ms >= cutoff);
}

async fn cleanup_uploaded_image(client: &Client, delete_hash: &str) {
    let response = client
        .delete(format!(
            "https://api.imgur.com/3/image/{}",
            url::form_urlencoded::byte_serialize(delete_hash.as_bytes()).collect::<String>()
        ))
        .send()
        .await;

    match response {
        Ok(response) if response.status().is_success() => {}
        Ok(response) => {
            tracing::error!(
                status = response.status().as_u16(),
                "Imgur transactional cleanup was rejected"
            );
        }
        Err(error) => {
            tracing::error!(
                timeout = error.is_timeout(),
                "Imgur transactional cleanup failed"
            );
        }
    }
}

fn default_config() -> StoredImgurConfig {
    StoredImgurConfig {
        version: 2,
        keys: Vec::new(),
        rate_limit_per_hour: DEFAULT_RATE_LIMIT_PER_HOUR,
        batch_delay_ms: DEFAULT_BATCH_DELAY_MS,
    }
}

fn normalize_stored_config(mut config: StoredImgurConfig) -> StoredImgurConfig {
    config.keys.truncate(MAX_KEYS);
    config.rate_limit_per_hour = config.rate_limit_per_hour.clamp(1, 5000);
    config.batch_delay_ms = config.batch_delay_ms.min(60_000);
    config
}

fn validate_key_id(id: &ImgurKeyId) -> AppResult<()> {
    if valid_identifier(&id.0) {
        Ok(())
    } else {
        Err(AppError::invalid_input("Invalid Imgur key identifier."))
    }
}

fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
}

fn validate_client_id(value: &str) -> AppResult<String> {
    let value = value.trim();

    if value.is_empty()
        || value.len() > 256
        || !value.is_ascii()
        || value.chars().any(char::is_control)
    {
        return Err(AppError::invalid_input("Invalid Imgur Client ID."));
    }

    Ok(value.to_string())
}

fn sanitize_label(value: &str) -> String {
    let value: String = value
        .trim()
        .chars()
        .filter(|character| !character.is_control())
        .take(128)
        .collect();

    if value.is_empty() {
        "Imgur".to_string()
    } else {
        value
    }
}

fn key_account(id: &ImgurKeyId) -> String {
    format!("imgur-client:{}", stable_hash("imgur-key-account", &id.0))
}

fn required_string(value: &Value, key: &str) -> AppResult<String> {
    value
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .ok_or_else(|| AppError::Network(format!("Imgur response is missing {key}.")))
}

fn required_https_url(value: &Value, key: &str) -> AppResult<String> {
    let raw = required_string(value, key)?;
    let parsed = url::Url::parse(&raw)?;

    if parsed.scheme() != "https" || parsed.host_str().is_none() {
        return Err(AppError::Security(
            "Imgur returned an unsafe image URL.".to_string(),
        ));
    }

    Ok(parsed.to_string())
}

fn config_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(secure_store_dir(app)?.join("imgur-config.json"))
}

fn rate_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(secure_store_dir(app)?.join("imgur-rate-state.json"))
}
