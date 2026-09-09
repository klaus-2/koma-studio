use std::{fs, path::PathBuf};

use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};

use super::client::{
    read_json_file, read_plain_envelope, secure_store_dir, string_field, write_json_file,
    write_plain_envelope,
};

const IMGUR_API_URL: &str = "https://api.imgur.com/3/image";
const DEFAULT_RATE_LIMIT_PER_HOUR: i64 = 50;
const DEFAULT_BATCH_DELAY_MS: i64 = 1200;

#[tauri::command(rename = "desktop-api:imgur:config:load")]
pub fn imgur_load_config<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    let config = read_config(&app)?;
    Ok(json!({
        "config": config,
        "secureStorage": false,
        "rateLimit": rate_status(&app, &config)?,
    }))
}

#[tauri::command(rename = "desktop-api:imgur:config:save")]
pub fn imgur_save_config<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let config = normalize_config(&payload);
    write_plain_envelope(&config_path(&app)?, &config)?;
    Ok(json!({
        "config": config,
        "secureStorage": false,
        "rateLimit": rate_status(&app, &config)?,
    }))
}

#[tauri::command(rename = "desktop-api:imgur:upload-images")]
pub async fn imgur_upload_images<R: Runtime>(
    app: AppHandle<R>,
    payload: Value,
) -> Result<Value, String> {
    let items = payload
        .get("items")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| "No image was received for the Imgur upload.".to_string())?;
    let config = read_config(&app)?;
    let keys = active_keys(&config);
    if keys.is_empty() {
        return Err("Configure ao menos uma Client ID ativa do Imgur.".to_string());
    }
    ensure_rate_capacity(&app, &config, items.len() as i64)?;

    let client = super::client::http_client()?;
    let mut uploaded = Vec::new();
    for item in items {
        let result = upload_one(&client, &keys, item).await?;
        register_upload(&app)?;
        uploaded.push(result);
    }

    Ok(json!({
        "items": uploaded,
        "rateLimit": rate_status(&app, &config)?,
    }))
}

fn read_config<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
    Ok(normalize_config(&read_plain_envelope(
        &config_path(app)?,
        default_config(),
    )))
}

fn normalize_config(value: &Value) -> Value {
    let keys = value
        .get("keys")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    let id = string_field(item, "id");
                    let label = string_field(item, "label");
                    let client_id = string_field(item, "clientId");
                    if client_id.is_empty() {
                        return None;
                    }
                    Some(json!({
                        "id": if id.is_empty() { format!("imgur-key-{}", uuid::Uuid::new_v4()) } else { id },
                        "label": if label.is_empty() { "Imgur".to_string() } else { label },
                        "clientId": client_id,
                        "enabled": item.get("enabled").and_then(Value::as_bool).unwrap_or(true),
                    }))
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let rate_limit = value
        .get("rateLimitPerHour")
        .and_then(Value::as_i64)
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_RATE_LIMIT_PER_HOUR);
    let batch_delay = value
        .get("batchDelayMs")
        .and_then(Value::as_i64)
        .filter(|value| *value >= 0)
        .unwrap_or(DEFAULT_BATCH_DELAY_MS);
    json!({
        "keys": keys,
        "rateLimitPerHour": rate_limit,
        "batchDelayMs": batch_delay,
    })
}

async fn upload_one(
    client: &reqwest::Client,
    keys: &[Value],
    item: &Value,
) -> Result<Value, String> {
    let file_name = string_field(item, "fileName");
    let content_base64 = string_field(item, "contentBase64");
    if file_name.is_empty() || content_base64.is_empty() {
        return Err("Invalid Imgur upload item.".to_string());
    }
    if item.get("byteLength").and_then(Value::as_u64).unwrap_or(0) > 10 * 1024 * 1024 {
        return Err(format!("Image {file_name} exceeds 10 MB."));
    }

    let mut errors = Vec::new();
    for key in keys {
        let client_id = string_field(key, "clientId");
        let label = string_field(key, "label");
        let mut form = std::collections::HashMap::new();
        form.insert("image", content_base64.clone());
        form.insert("type", "base64".to_string());
        form.insert("name", file_name.clone());
        let alt_text = string_field(item, "altText");
        if !alt_text.is_empty() {
            form.insert("title", alt_text.clone());
            form.insert("description", alt_text.clone());
        }

        let response = client
            .post(IMGUR_API_URL)
            .header(
                reqwest::header::AUTHORIZATION,
                format!("Client-ID {client_id}"),
            )
            .form(&form)
            .send()
            .await
            .map_err(|error| error.to_string())?;
        let status = response.status();
        let payload = super::client::response_json_or_error(response).await;
        match payload {
            Ok(value) => {
                let data = value.get("data").unwrap_or(&Value::Null);
                let direct_url = data
                    .get("link")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .trim()
                    .to_string();
                if direct_url.is_empty() {
                    return Err(format!("Imgur did not return a link for {file_name}."));
                }
                return Ok(json!({
                    "id": string_field(item, "id"),
                    "fileName": file_name,
                    "mimeType": string_field(item, "mimeType"),
                    "altText": alt_text,
                    "directUrl": direct_url,
                    "deleteHash": data.get("deletehash").cloned().unwrap_or(Value::Null),
                    "width": data.get("width").cloned().unwrap_or(Value::Null),
                    "height": data.get("height").cloned().unwrap_or(Value::Null),
                    "byteLength": item.get("byteLength").cloned().unwrap_or(Value::Null),
                    "keyLabel": if label.is_empty() { "Imgur" } else { label.as_str() },
                }));
            }
            Err(_) if status.as_u16() == 429 => {
                return Err(format!(
                    "Imgur returned a rate limit/429 while using the key \"{label}\"."
                ));
            }
            Err(error) => errors.push(format!("{label}: {} {error}", status.as_u16())),
        }
    }
    Err(format!(
        "Imgur upload failed. Attempts: {}",
        errors.join(" | ")
    ))
}

fn active_keys(config: &Value) -> Vec<Value> {
    config
        .get("keys")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter(|item| item.get("enabled").and_then(Value::as_bool).unwrap_or(true))
                .filter(|item| !string_field(item, "clientId").is_empty())
                .cloned()
                .collect()
        })
        .unwrap_or_default()
}

fn ensure_rate_capacity<R: Runtime>(
    app: &AppHandle<R>,
    config: &Value,
    count: i64,
) -> Result<(), String> {
    let status = rate_status(app, config)?;
    let remaining = status
        .get("remainingThisHour")
        .and_then(Value::as_i64)
        .unwrap_or(DEFAULT_RATE_LIMIT_PER_HOUR);
    if remaining < count {
        return Err("Limite local conservador do Imgur atingido.".to_string());
    }
    Ok(())
}

fn rate_status<R: Runtime>(app: &AppHandle<R>, config: &Value) -> Result<Value, String> {
    let limit = config
        .get("rateLimitPerHour")
        .and_then(Value::as_i64)
        .unwrap_or(DEFAULT_RATE_LIMIT_PER_HOUR);
    let now = chrono::Utc::now().timestamp_millis();
    let cutoff = now - 60 * 60 * 1_000;
    let timestamps = read_rate_timestamps(app)?
        .into_iter()
        .filter(|value| *value >= cutoff)
        .collect::<Vec<_>>();
    let used = timestamps.len() as i64;
    let resets_at = timestamps
        .iter()
        .min()
        .map(|value| {
            chrono::DateTime::<chrono::Utc>::from_timestamp_millis(*value + 60 * 60 * 1_000)
        })
        .flatten()
        .map(|date| date.to_rfc3339_opts(chrono::SecondsFormat::Millis, true));
    Ok(json!({
        "limitPerHour": limit,
        "usedThisHour": used,
        "remainingThisHour": (limit - used).max(0),
        "resetsAt": resets_at,
    }))
}

fn register_upload<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let cutoff = now - 60 * 60 * 1_000;
    let mut timestamps = read_rate_timestamps(app)?
        .into_iter()
        .filter(|value| *value >= cutoff)
        .collect::<Vec<_>>();
    timestamps.push(now);
    write_json_file(&rate_path(app)?, &json!({ "uploadTimestamps": timestamps }))
}

fn read_rate_timestamps<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<i64>, String> {
    Ok(read_json_file(&rate_path(app)?)
        .and_then(|value| {
            value
                .get("uploadTimestamps")
                .and_then(Value::as_array)
                .cloned()
        })
        .unwrap_or_default()
        .into_iter()
        .filter_map(|value| value.as_i64())
        .collect())
}

fn default_config() -> Value {
    json!({
        "keys": [],
        "rateLimitPerHour": DEFAULT_RATE_LIMIT_PER_HOUR,
        "batchDelayMs": DEFAULT_BATCH_DELAY_MS,
    })
}

fn config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(secure_store_dir(app)?.join("imgur-config.json"))
}

fn rate_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let path = secure_store_dir(app)?.join("imgur-rate-state.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    Ok(path)
}
