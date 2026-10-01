//! Imgur commands. The current frontend contract sends base64 items; each item
//! is decoded to an authorized temp file, then uploaded through the service
//! (streaming multipart, key rotation, keychain credentials, persistent rate
//! ledger). The wire response keeps the legacy shape (directUrl, deleteHash
//! stays out — delete hashes live in the keychain).

use base64::{engine::general_purpose, Engine as _};
use serde_json::{json, Value};
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::imgur::{ImgurConfig, ImgurRateStatus},
    services::imgur::{self, ResolvedUpload},
    state::{api::ApiRuntimeState, AuthorizedWorkspaceAsset, WorkspaceAssetStore},
};

#[tauri::command(rename = "desktop-api:imgur:config:load")]
pub async fn imgur_load_config(
    app: AppHandle,
    runtime: State<'_, ApiRuntimeState>,
) -> AppResult<Value> {
    let _permit = runtime.imgur_permit().await?;
    let result = imgur::load_config(&app).await?;
    Ok(config_to_wire(result.config, result.rate_limit))
}

#[tauri::command(rename = "desktop-api:imgur:config:save")]
pub async fn imgur_save_config(
    app: AppHandle,
    runtime: State<'_, ApiRuntimeState>,
    payload: Value,
) -> AppResult<Value> {
    let _permit = runtime.imgur_permit().await?;
    let request = config_from_wire(&payload)?;
    let result = imgur::save_config(
        &app,
        request,
        payload
            .get("rateLimitPerHour")
            .and_then(Value::as_u64)
            .unwrap_or(50) as u32,
        payload
            .get("batchDelayMs")
            .and_then(Value::as_u64)
            .unwrap_or(1200),
    )
    .await?;
    Ok(config_to_wire(result.config, result.rate_limit))
}

#[tauri::command(rename = "desktop-api:imgur:upload-images")]
pub async fn imgur_upload_images(
    app: AppHandle,
    runtime: State<'_, ApiRuntimeState>,
    assets: State<'_, WorkspaceAssetStore>,
    payload: Value,
) -> AppResult<Value> {
    let _permit = runtime.imgur_permit().await?;

    let items = payload
        .get("items")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| AppError::invalid_input("No image was received for the Imgur upload."))?;

    // Adapter: decode each base64 item to a temp file authorized by the asset
    // store, so the service streams from disk with byte_length revalidation.
    let mut resolved = Vec::with_capacity(items.len());
    for item in items {
        let file_name = string_field(item, "fileName");
        let content_base64 = string_field(item, "contentBase64");
        if file_name.is_empty() || content_base64.is_empty() {
            return Err(AppError::invalid_input("Invalid Imgur upload item."));
        }
        let byte_length = item.get("byteLength").and_then(Value::as_u64).unwrap_or(0);
        if byte_length > 10 * 1024 * 1024 {
            return Err(AppError::invalid_input(format!(
                "Image {file_name} exceeds 10 MB."
            )));
        }

        let bytes = general_purpose::STANDARD
            .decode(content_base64.as_bytes())
            .map_err(|_| AppError::invalid_input("Invalid image content."))?;
        if bytes.is_empty() || bytes.len() as u64 > 10 * 1024 * 1024 {
            return Err(AppError::invalid_input(format!(
                "Image {file_name} must be between 1 byte and 10 MiB."
            )));
        }

        let temp_path = std::env::temp_dir().join(format!(
            "koma-imgur-{}.{}",
            Uuid::new_v4(),
            file_ext(&file_name)
        ));
        std::fs::write(&temp_path, &bytes)?;

        let mime_type = infer::get(&bytes)
            .map(|kind| kind.mime_type().to_string())
            .unwrap_or_else(|| {
                "application/octet-stream".to_string()
            });

        let asset = AuthorizedWorkspaceAsset {
            id: crate::models::workspace::WorkspaceAssetId(Uuid::new_v4().to_string()),
            path: format!("imgur/{file_name}"),
            file_name: file_name.clone(),
            mime_type: mime_type.clone(),
            byte_length: bytes.len() as u64,
            source_path: temp_path.clone(),
        };

        let source = assets
            .authorize(asset)
            .await
            .inspect_err(|_| {
                let _ = std::fs::remove_file(&temp_path);
            })?;

        resolved.push(ResolvedUpload {
            asset: AuthorizedWorkspaceAsset {
                id: source.id,
                path: source.path,
                file_name: source.file_name,
                mime_type: source.mime_type,
                byte_length: source.byte_length,
                source_path: temp_path.clone(),
            },
            alt_text: string_field(item, "altText"),
        });
    }

    let temp_paths: Vec<std::path::PathBuf> = resolved
        .iter()
        .map(|item| item.asset.source_path.clone())
        .collect();
    let upload = imgur::upload(&app, resolved).await;

    // Temp files are disposable either way.
    for path in &temp_paths {
        let _ = std::fs::remove_file(path);
    }

    let (uploaded, rate_limit) = upload?;

    let items_wire: Vec<Value> = uploaded
        .into_iter()
        .map(|image| {
            json!({
                "id": image.id,
                "fileName": image.file_name,
                "mimeType": image.mime_type,
                "altText": image.alt_text,
                "directUrl": image.direct_url,
                "deleteHash": Value::Null,
                "width": image.width,
                "height": image.height,
                "byteLength": image.byte_length,
                "keyLabel": image.key_label,
            })
        })
        .collect();

    Ok(json!({
        "items": items_wire,
        "rateLimit": rate_to_wire(&rate_limit),
    }))
}

fn string_field(payload: &Value, key: &str) -> String {
    payload
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .chars()
        .take(4096)
        .collect()
}

fn file_ext(file_name: &str) -> String {
    file_name
        .rsplit_once('.')
        .map(|(_, extension)| {
            extension
                .chars()
                .take(8)
                .filter(|character| character.is_ascii_alphanumeric())
                .collect::<String>()
        })
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "bin".to_string())
}

fn config_to_wire(config: ImgurConfig, rate_limit: ImgurRateStatus) -> Value {
    let keys: Vec<Value> = config
        .keys
        .iter()
        .map(|key| {
            json!({
                "id": key.id.0,
                "label": key.label,
                "clientId": "",
                "enabled": key.enabled,
                "hasCredential": key.has_credential,
            })
        })
        .collect();

    json!({
        "config": {
            "keys": keys,
            "rateLimitPerHour": config.rate_limit_per_hour,
            "batchDelayMs": config.batch_delay_ms,
        },
        "secureStorage": true,
        "rateLimit": rate_to_wire(&rate_limit),
    })
}

fn rate_to_wire(rate: &ImgurRateStatus) -> Value {
    json!({
        "limitPerHour": rate.limit_per_hour,
        "usedThisHour": rate.used_this_hour,
        "remainingThisHour": rate.remaining_this_hour,
        "resetsAt": rate.resets_at,
    })
}

fn config_from_wire(payload: &Value) -> AppResult<Vec<imgur::SaveImgurKeyInput>> {
    let keys = payload
        .get("keys")
        .and_then(Value::as_array)
        .ok_or_else(|| AppError::invalid_input("Invalid Imgur configuration."))?;

    let mut request = Vec::with_capacity(keys.len());
    for item in keys {
        let id = item
            .get("id")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
            .map(|value| crate::models::imgur::ImgurKeyId(value.trim().to_string()))
            .unwrap_or_else(|| crate::models::imgur::ImgurKeyId(Uuid::new_v4().to_string()));

        let client_id = item
            .get("clientId")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(|value| zeroize::Zeroizing::new(value.to_string()));

        let clear_credential = item
            .get("clearCredential")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        request.push(imgur::SaveImgurKeyInput {
            id,
            label: item
                .get("label")
                .and_then(Value::as_str)
                .unwrap_or("Imgur")
                .to_string(),
            enabled: item
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true),
            client_id,
            clear_credential,
        });
    }

    Ok(request)
}
