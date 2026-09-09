use std::{fs, path::PathBuf};

use base64::{engine::general_purpose, Engine as _};
use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};

use super::client::{
    read_plain_envelope, secure_store_dir, string_field, value_object, write_plain_envelope,
};

const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";
const BLOGGER_API_BASE: &str = "https://www.googleapis.com/blogger/v3";
const DRIVE_UPLOAD_URL: &str =
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webContentLink,webViewLink,thumbnailLink,size,imageMediaMetadata";

#[tauri::command(rename = "desktop-api:blogger:config:load")]
pub fn blogger_load_config<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    Ok(json!({
        "config": read_config(&app)?,
        "secureStorage": false,
    }))
}

#[tauri::command(rename = "desktop-api:blogger:config:save")]
pub fn blogger_save_config<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let config = normalize_config(&payload);
    write_plain_envelope(&config_path(&app)?, &config)?;
    Ok(json!({ "config": config, "secureStorage": false }))
}

#[tauri::command(rename = "desktop-api:blogger:test-connection")]
pub async fn blogger_test_connection<R: Runtime>(
    app: AppHandle<R>,
    payload: Value,
) -> Result<Value, String> {
    let config = if payload.is_null() || payload.as_object().map(|v| v.is_empty()).unwrap_or(false)
    {
        read_config(&app)?
    } else {
        normalize_config(&payload)
    };
    validate_config(&config)?;
    let token = google_access_token(&config).await?;
    let client = super::client::http_client()?;
    let response = client
        .get(format!(
            "{BLOGGER_API_BASE}/blogs/{}",
            encode_component(&string_field(&config, "blogId"))
        ))
        .bearer_auth(token)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let payload = super::client::response_json_or_error(response).await?;
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
) -> Result<Value, String> {
    let items = payload
        .get("items")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| "No image was received for the Blogger upload.".to_string())?;
    let config = read_config(&app)?;
    validate_config(&config)?;
    let token = google_access_token(&config).await?;
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
) -> Result<Value, String> {
    let config = read_config(&app)?;
    validate_config(&config)?;
    let title = string_field(&payload, "title");
    let html = string_field(&payload, "html");
    if title.is_empty() {
        return Err("Defina um titulo para a postagem.".to_string());
    }
    if html.is_empty() {
        return Err("The post HTML content cannot be empty.".to_string());
    }

    let labels = merged_labels(
        config.get("defaultLabels").and_then(Value::as_array),
        payload.get("labels").and_then(Value::as_array),
    );
    let publish = payload
        .get("publish")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let token = google_access_token(&config).await?;
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
        .map_err(|error| error.to_string())?;
    let response_payload = super::client::response_json_or_error(response).await?;
    let post_id = string_field(&response_payload, "id");
    if post_id.is_empty() {
        return Err("Blogger did not return the ID of the new post.".to_string());
    }
    Ok(json!({
        "postId": post_id,
        "postUrl": response_payload.get("url").cloned().unwrap_or(Value::Null),
        "blogId": blog_id,
        "isDraft": !publish,
        "uploadedImages": payload.get("uploadedImages").cloned().unwrap_or_else(|| json!([])),
    }))
}

fn read_config<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
    Ok(normalize_config(&read_plain_envelope(
        &config_path(app)?,
        default_config(),
    )))
}

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

fn validate_config(config: &Value) -> Result<(), String> {
    let missing = ["clientId", "clientSecret", "refreshToken", "blogId"]
        .iter()
        .any(|key| string_field(config, key).is_empty());
    if missing {
        Err("Preencha Client ID, Client Secret, Refresh Token e Blog ID.".to_string())
    } else {
        Ok(())
    }
}

async fn google_access_token(config: &Value) -> Result<String, String> {
    let mut form = std::collections::HashMap::new();
    form.insert("client_id", string_field(config, "clientId"));
    form.insert("client_secret", string_field(config, "clientSecret"));
    form.insert("refresh_token", string_field(config, "refreshToken"));
    form.insert("grant_type", "refresh_token".to_string());
    let response = super::client::http_client()?
        .post(GOOGLE_TOKEN_URL)
        .form(&form)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let payload = super::client::response_json_or_error(response).await?;
    let token = string_field(&payload, "access_token");
    if token.is_empty() {
        Err("Google OAuth did not return an access_token.".to_string())
    } else {
        Ok(token)
    }
}

async fn upload_drive_image(
    client: &reqwest::Client,
    access_token: &str,
    item: &Value,
) -> Result<Value, String> {
    let file_name = string_field(item, "fileName");
    let mime_type = string_field(item, "mimeType");
    let content = string_field(item, "contentBase64");
    if file_name.is_empty() || mime_type.is_empty() || content.is_empty() {
        return Err("Invalid Blogger upload item.".to_string());
    }
    let bytes = general_purpose::STANDARD
        .decode(content.as_bytes())
        .map_err(|_| "Invalid image content.".to_string())?;
    let boundary = format!("koma-boundary-{}", uuid::Uuid::new_v4());
    let metadata = json!({ "name": file_name, "mimeType": mime_type });
    let mut body = Vec::new();
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
        .map_err(|error| error.to_string())?;
    let payload = super::client::response_json_or_error(response).await?;
    let file_id = string_field(&payload, "id");
    if file_id.is_empty() {
        return Err(format!("Google Drive did not return an ID for {file_name}."));
    }

    let _ = client
        .post(format!(
            "https://www.googleapis.com/drive/v3/files/{}/permissions",
            encode_component(&file_id)
        ))
        .bearer_auth(access_token)
        .json(&json!({ "role": "reader", "type": "anyone" }))
        .send()
        .await;

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
        }
    })
}

fn config_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let path = secure_store_dir(app)?.join("blogger-config.json");
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    Ok(path)
}

fn html_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn encode_component(value: &str) -> String {
    url::form_urlencoded::byte_serialize(value.as_bytes()).collect()
}
