use std::{fs, path::PathBuf};

use base64::{engine::general_purpose, Engine as _};
use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};

use super::client::{
    read_plain_envelope, secure_store_dir, string_field, value_object, write_plain_envelope,
};
use crate::error::{AppError, AppResult};

const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const BLOGGER_API_BASE: &str = "https://www.googleapis.com/blogger/v3";
const DRIVE_UPLOAD_URL: &str =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webContentLink,webViewLink,thumbnailLink,size,imageMediaMetadata";
const KEYCHAIN_SERVICE: &str = "com.komastudio.desktop";
const KEYCHAIN_ACCOUNT: &str = "blogger-oauth-v1";
const MAX_IMAGE_BYTES: usize = 100 * 1024 * 1024;

#[tauri::command(rename = "desktop-api:blogger:config:load")]
pub async fn blogger_load_config<R: Runtime>(app: AppHandle<R>) -> AppResult<Value> {
    let path = config_path(&app)?;
    let raw = tauri::async_runtime::spawn_blocking(move || {
        read_plain_envelope(&path, default_config())
    })
    .await?;

    let mut config = normalize_config(&raw);
    let secrets = read_secrets().await?;
    config["hasClientSecret"] = json!(
        secrets
            .as_ref()
            .is_some_and(|value| !value.client_secret.is_empty())
    );
    config["hasRefreshToken"] = json!(
        secrets
            .as_ref()
            .is_some_and(|value| !value.refresh_token.is_empty())
    );

    Ok(json!({ "config": config, "secureStorage": true }))
}

#[tauri::command(rename = "desktop-api:blogger:config:save")]
pub async fn blogger_save_config<R: Runtime>(
    app: AppHandle<R>,
    payload: Value,
) -> AppResult<Value> {
    let mut config = normalize_config(&payload);

    // Secrets live in the OS keychain only. Writes replace them; the public
    // JSON never receives them (the legacy plaintext file is consumed once
    // and its secret fields dropped).
    let legacy = migrate_legacy_secrets(&app).await?;
    let mut secrets = read_secrets().await?.unwrap_or(BloggerSecrets::default());

    if let Some(value) = string_or_empty(&payload, "clientSecret") {
        secrets.client_secret = value;
    }
    if let Some(value) = string_or_empty(&payload, "refreshToken") {
        secrets.refresh_token = value;
    }
    if legacy.is_some() && secrets.is_empty() {
        if let Some(legacy_secrets) = legacy {
            secrets = legacy_secrets;
        }
    }

    write_secrets(secrets.clone()).await?;

    config["clientSecret"] = json!("");
    config["refreshToken"] = json!("");
    config["hasClientSecret"] = json!(!secrets.client_secret.is_empty());
    config["hasRefreshToken"] = json!(!secrets.refresh_token.is_empty());

    let path = config_path(&app)?;
    let config_for_disk = config.clone();
    tauri::async_runtime::spawn_blocking(move || {
        write_plain_envelope(&path, &config_for_disk)
    })
    .await??;

    Ok(json!({ "config": config, "secureStorage": true }))
}

#[tauri::command(rename = "desktop-api:blogger:test-connection")]
pub async fn blogger_test_connection<R: Runtime>(
    app: AppHandle<R>,
    payload: Value,
) -> AppResult<Value> {
    let raw_config = if payload.is_null()
        || payload.as_object().map(|v| v.is_empty()).unwrap_or(false)
    {
        load_public_config(&app).await?
    } else {
        normalize_config(&payload)
    };
    let secrets = required_secrets().await?;
    let config = merged_with_secrets(raw_config, &secrets);
    validate_runtime_config(&config, &secrets)?;

    let token = google_access_token(&config, &secrets).await?;
    let client = super::client::http_client()?;
    let response = client
        .get(format!(
            "{BLOGGER_API_BASE}/blogs/{}",
            encode_component(&string_field(&config, "blogId"))
        ))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| AppError::network("Google Blogger request failed.", &error))?;
    let payload = response_json(response).await?;
    Ok(json!({
        "ok": true,
        "blogTitle": string_field(&payload, "name"),
        "blogId": string_field(&config, "blogId"),
        "message": "Conexao com Blogger validada.",
    }))
}

#[tauri::command(rename = "desktop-api:blogger:upload-images")]
pub async fn blogger_upload_images<R: Runtime>(
    app: AppHandle<R>,
    payload: Value,
) -> AppResult<Value> {
    let items = payload
        .get("items")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| AppError::invalid_input("No image was received for the Blogger upload."))?;
    if items.len() > 100 {
        return Err(AppError::invalid_input(
            "Select between 1 and 100 images.",
        ));
    }

    let raw_config = load_public_config(&app).await?;
    let secrets = required_secrets().await?;
    let config = merged_with_secrets(raw_config, &secrets);
    validate_runtime_config(&config, &secrets)?;

    let token = google_access_token(&config, &secrets).await?;
    let client = super::client::http_client()?;
    let mut uploaded = Vec::new();

    for item in items {
        uploaded.push(upload_drive_image(&client, &token, item).await?);
    }

    Ok(json!({ "items": uploaded }))
}

#[tauri::command(rename = "desktop-api:blogger:publish-post")]
pub async fn blogger_publish_post<R: Runtime>(
    app: AppHandle<R>,
    payload: Value,
) -> AppResult<Value> {
    let raw_config = load_public_config(&app).await?;
    let secrets = required_secrets().await?;
    let config = merged_with_secrets(raw_config, &secrets);
    validate_runtime_config(&config, &secrets)?;

    let title = string_field(&payload, "title");
    let html = string_field(&payload, "html");
    if title.is_empty() {
        return Err(AppError::invalid_input(
            "Defina um titulo para a postagem.",
        ));
    }
    if html.is_empty() {
        return Err(AppError::invalid_input(
            "The post HTML content cannot be empty.",
        ));
    }

    let labels = merged_labels(
        config.get("defaultLabels").and_then(Value::as_array),
        payload.get("labels").and_then(Value::as_array),
    );
    let publish = payload
        .get("publish")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let token = google_access_token(&config, &secrets).await?;
    let blog_id = string_field(&config, "blogId");
    let response = super::client::http_client()?
        .post(format!(
            "{BLOGGER_API_BASE}/blogs/{}/posts/?isDraft={}",
            encode_component(&blog_id),
            if publish { "false" } else { "true" }
        ))
        .bearer_auth(token)
        .json(&json!({ "title": title, "content": html, "labels": labels }))
        .send()
        .await
        .map_err(|error| AppError::network("Blogger publish request failed.", &error))?;
    let response_payload = response_json(response).await?;
    let post_id = string_field(&response_payload, "id");
    if post_id.is_empty() {
        return Err(AppError::Network(
            "Blogger did not return the ID of the new post.".to_string(),
        ));
    }
    Ok(json!({
        "postId": post_id,
        "postUrl": response_payload.get("url").cloned().unwrap_or(Value::Null),
        "blogId": blog_id,
        "isDraft": !publish,
        "uploadedImages": payload.get("uploadedImages").cloned().unwrap_or_else(|| json!([])),
    }))
}

// --- keychain-backed secrets -------------------------------------------------

#[derive(Clone, Default)]
struct BloggerSecrets {
    client_secret: String,
    refresh_token: String,
}

impl BloggerSecrets {
    fn is_empty(&self) -> bool {
        self.client_secret.is_empty() && self.refresh_token.is_empty()
    }
}

fn read_secrets_blocking() -> AppResult<Option<BloggerSecrets>> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)?;
    match entry.get_password() {
        Ok(value) => {
            let parsed: Value = serde_json::from_str(&value)?;
            Ok(Some(BloggerSecrets {
                client_secret: string_field(&parsed, "clientSecret"),
                refresh_token: string_field(&parsed, "refreshToken"),
            }))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.into()),
    }
}

async fn read_secrets() -> AppResult<Option<BloggerSecrets>> {
    tauri::async_runtime::spawn_blocking(read_secrets_blocking).await?
}

async fn write_secrets(secrets: BloggerSecrets) -> AppResult<()> {
    let serialized = serde_json::to_string(&json!({
        "clientSecret": secrets.client_secret,
        "refreshToken": secrets.refresh_token,
    }))?;
    tauri::async_runtime::spawn_blocking(move || {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)?;
        if secrets.is_empty() {
            // Removing a missing entry is an error on some backends; ignore it.
            match entry.delete_credential() {
                Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
                Err(error) => Err(AppError::from(error)),
            }
        } else {
            entry.set_password(&serialized)?;
            Ok(())
        }
    })
    .await?
}

/// One-time migration: consumers of previous versions stored client_secret and
/// refresh_token inside the public JSON. Move them into the keychain and scrub
/// the plaintext copy.
async fn migrate_legacy_secrets<R: Runtime>(app: &AppHandle<R>) -> AppResult<Option<BloggerSecrets>> {
    let path = config_path(app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let raw = read_plain_envelope(&path, Value::Null);
        let client_secret = string_field(&raw, "clientSecret");
        let refresh_token = string_field(&raw, "refreshToken");
        if client_secret.is_empty() && refresh_token.is_empty() {
            return Ok(None);
        }

        let existing = read_secrets_blocking()?.unwrap_or_default();
        let legacy = BloggerSecrets {
            client_secret: if existing.client_secret.is_empty() {
                client_secret
            } else {
                existing.client_secret
            },
            refresh_token: if existing.refresh_token.is_empty() {
                refresh_token
            } else {
                existing.refresh_token
            },
        };

        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)?;
        entry.set_password(
            &serde_json::to_string(&json!({
                "clientSecret": legacy.client_secret,
                "refreshToken": legacy.refresh_token,
            }))?,
        )?;

        let scrubbed = normalize_config(&raw);
        write_plain_envelope(&path, &scrubbed)?;
        Ok(Some(legacy))
    })
    .await?
}

async fn required_secrets() -> AppResult<BloggerSecrets> {
    let secrets = read_secrets().await?.ok_or_else(|| {
        AppError::not_configured("Blogger credentials are not configured.")
    })?;

    if secrets.client_secret.is_empty() || secrets.refresh_token.is_empty() {
        return Err(AppError::not_configured(
            "Preencha Client Secret e Refresh Token.",
        ));
    }

    Ok(secrets)
}

// --- config helpers ----------------------------------------------------------

async fn load_public_config<R: Runtime>(app: &AppHandle<R>) -> AppResult<Value> {
    let path = config_path(app)?;
    let raw = tauri::async_runtime::spawn_blocking(move || {
        read_plain_envelope(&path, default_config())
    })
    .await?;
    Ok(normalize_config(&raw))
}

fn config_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let path = secure_store_dir(app)?.join("blogger-config.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    Ok(path)
}

/// Owned copy of the public config with the keychain secrets merged in, so
/// downstream helpers read one coherent document.
fn merged_with_secrets(mut config: Value, secrets: &BloggerSecrets) -> Value {
    if let Some(object) = config.as_object_mut() {
        object.insert("clientSecret".to_string(), json!(secrets.client_secret));
        object.insert("refreshToken".to_string(), json!(secrets.refresh_token));
    }
    config
}

fn string_or_empty(payload: &Value, key: &str) -> Option<String> {
    payload
        .get(key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

// --- Google helpers ----------------------------------------------------------

fn normalize_config(value: &Value) -> Value {
    let mut config = value_object(default_config());
    let source = value.as_object().cloned().unwrap_or_default();
    for key in [
        "label",
        "clientId",
        "clientSecret",
        "refreshToken",
        "blogId",
    ] {
        if let Some(value) = source.get(key).and_then(Value::as_str) {
            config.insert(key.to_string(), json!(value.trim()));
        }
    }
    if let Some(labels) = source.get("defaultLabels").and_then(Value::as_array) {
        config.insert(
            "defaultLabels".to_string(),
            Value::Array(
                labels
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(|value| json!(value))
                    .collect(),
            ),
        );
    }
    if let Some(optimizer) = source.get("optimizer").filter(|value| value.is_object()) {
        config.insert("optimizer".to_string(), optimizer.clone());
    }
    if let Some(preprocess) = source.get("preprocess").filter(|value| value.is_object()) {
        config.insert("preprocess".to_string(), preprocess.clone());
    }
    Value::Object(config)
}

fn validate_runtime_config(config: &Value, secrets: &BloggerSecrets) -> AppResult<()> {
    if string_field(config, "clientId").is_empty() {
        return Err(AppError::invalid_input("Preencha o Client ID do Google."));
    }
    if string_field(config, "blogId").is_empty() {
        return Err(AppError::invalid_input("Preencha o Blog ID."));
    }
    if secrets.client_secret.is_empty() || secrets.refresh_token.is_empty() {
        return Err(AppError::not_configured(
            "Preencha Client Secret e Refresh Token.",
        ));
    }
    Ok(())
}

async fn google_access_token(config: &Value, secrets: &BloggerSecrets) -> AppResult<String> {
    let mut form = std::collections::HashMap::new();
    form.insert("client_id", string_field(config, "clientId"));
    form.insert("client_secret", secrets.client_secret.clone());
    form.insert("refresh_token", secrets.refresh_token.clone());
    form.insert("grant_type", "refresh_token".to_string());
    let response = super::client::http_client()?
        .post(GOOGLE_TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|error| AppError::network("Google OAuth request failed.", &error))?;
    let payload = response_json(response).await?;
    let token = string_field(&payload, "access_token");
    if token.is_empty() {
        return Err(AppError::Network(
            "Google OAuth did not return an access_token.".to_string(),
        ));
    }
    Ok(token)
}

async fn response_json(response: reqwest::Response) -> AppResult<Value> {
    let status = response.status();
    let payload = response
        .json::<Value>()
        .await
        .map_err(|error| AppError::network("Remote API returned invalid JSON.", &error))?;

    if status.is_success() {
        Ok(payload)
    } else {
        let message = payload
            .get("error")
            .or_else(|| payload.get("message"))
            .and_then(Value::as_str)
            .unwrap_or("Remote API request failed.")
            .to_string();
        Err(AppError::Network(message))
    }
}

async fn upload_drive_image(
    client: &reqwest::Client,
    access_token: &str,
    item: &Value,
) -> AppResult<Value> {
    let file_name = string_field(item, "fileName");
    let mime_type = string_field(item, "mimeType");
    let content = string_field(item, "contentBase64");
    if file_name.is_empty() || mime_type.is_empty() || content.is_empty() {
        return Err(AppError::invalid_input("Invalid Blogger upload item."));
    }
    let bytes = general_purpose::STANDARD
        .decode(content.as_bytes())
        .map_err(|_| AppError::invalid_input("Invalid image content."))?;
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(AppError::invalid_input(
            "Blogger image exceeds 100 MiB.",
        ));
    }
    let boundary = format!("koma-boundary-{}", uuid::Uuid::new_v4());
    let metadata = json!({ "name": file_name, "mimeType": mime_type });
    let mut body = Vec::with_capacity(bytes.len() + 256);
    body.extend_from_slice(
        format!(
            "--{boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n{metadata}\r\n"
        )
        .as_bytes(),
    );
    body.extend_from_slice(format!("--{boundary}\r\nContent-Type: {mime_type}\r\n\r\n").as_bytes());
    body.extend_from_slice(&bytes);
    body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

    let response = client
        .post(DRIVE_UPLOAD_URL)
        .bearer_auth(access_token)
        .header(
            reqwest::header::CONTENT_TYPE,
            format!("multipart/related; boundary={boundary}"),
        )
        .body(body)
        .send()
        .await
        .map_err(|error| AppError::network("Google Drive upload failed.", &error))?;
    let payload = response_json(response).await?;
    let file_id = string_field(&payload, "id");
    if file_id.is_empty() {
        return Err(AppError::Network(format!(
            "Google Drive did not return an ID for {file_name}."
        )));
    }

    if let Err(error) = client
        .post(format!(
            "https://www.googleapis.com/drive/v3/files/{}/permissions",
            encode_component(&file_id)
        ))
        .bearer_auth(access_token)
        .json(&json!({ "role": "reader", "type": "anyone" }))
        .send()
        .await
    {
        tracing::warn!(
            timeout = error.is_timeout(),
            status = ?error.status(),
            "failed to grant public read permission on the Drive file"
        );
    }

    let canonical_url = format!("https://drive.google.com/uc?export=view&id={file_id}");
    let alt_text = string_field(item, "altText");
    Ok(json!({
        "id": string_field(item, "id"),
        "fileName": file_name,
        "filename": file_name,
        "mimeType": mime_type,
        "altText": alt_text,
        "canonicalUrl": canonical_url,
        "imageUrl": canonical_url,
        "fileId": file_id,
        "alternativeUrls": {
            "driveDownload": canonical_url,
            "driveThumbnail": payload.get("thumbnailLink").cloned().unwrap_or(Value::Null),
        },
        "optimizedUrl": Value::Null,
        "imageTag": format!("<img src=\"{}\" alt=\"{}\" loading=\"lazy\" />", canonical_url, html_escape(&alt_text)),
        "width": payload.pointer("/imageMediaMetadata/width").cloned().unwrap_or(Value::Null),
        "height": payload.pointer("/imageMediaMetadata/height").cloned().unwrap_or(Value::Null),
        "byteLength": item.get("byteLength").cloned().unwrap_or_else(|| json!(bytes.len())),
        "draftPostId": Value::Null,
        "draftPostUrl": Value::Null,
    }))
}

fn merged_labels(left: Option<&Vec<Value>>, right: Option<&Vec<Value>>) -> Vec<String> {
    let mut labels = Vec::new();
    for value in left
        .into_iter()
        .flatten()
        .chain(right.into_iter().flatten())
        .filter_map(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        if !labels.iter().any(|item| item == value) {
            labels.push(value.to_string());
        }
    }
    labels
}

fn default_config() -> Value {
    json!({
        "label": "Blogger",
        "clientId": "",
        "clientSecret": "",
        "refreshToken": "",
        "blogId": "",
        "defaultLabels": [],
        "optimizer": {
            "enabled": false,
            "provider": "template",
            "template": "",
            "cloudinary": {
                "cloudName": "",
                "transformation": "f_auto,q_auto",
                "resourceType": "image",
                "deliveryType": "fetch",
                "encodeSourceUrl": true
            }
        },
        "preprocess": {
            "enabled": false,
            "maxWidth": 1600,
            "maxHeight": 2400,
            "outputFormat": "original",
            "quality": 92,
            "stripMetadata": true
        },
        "hasClientSecret": false,
        "hasRefreshToken": false
    })
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn encode_component(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}
