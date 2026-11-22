use std::path::Path;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

use crate::error::{AppError, AppResult};

const MAX_SAVE_BLOB_FILE_NAME_BYTES: usize = 200;
const FALLBACK_SAVE_BLOB_FILE_NAME: &str = "export";
const PNG_MIME_TYPE: &str = "image/png";

#[derive(Debug, Clone)]
pub struct IpcBytes(Vec<u8>);

impl IpcBytes {
    pub fn as_slice(&self) -> &[u8] {
        &self.0
    }
}

impl<'de> Deserialize<'de> for IpcBytes {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct IpcBytesVisitor;

        impl<'de> serde::de::Visitor<'de> for IpcBytesVisitor {
            type Value = IpcBytes;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("a byte array or a base64 string")
            }

            fn visit_seq<A>(self, mut seq: A) -> Result<Self::Value, A::Error>
            where
                A: serde::de::SeqAccess<'de>,
            {
                let mut bytes = Vec::with_capacity(seq.size_hint().unwrap_or_default());
                while let Some(byte) = seq.next_element::<u8>()? {
                    bytes.push(byte);
                }
                Ok(IpcBytes(bytes))
            }

            fn visit_str<E>(self, value: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                BASE64
                    .decode(value.trim())
                    .map(IpcBytes)
                    .map_err(|_| E::invalid_value(serde::de::Unexpected::Str(value), &self))
            }
        }

        deserializer.deserialize_any(IpcBytesVisitor)
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShowNotificationPayload {
    pub title: String,
    pub body: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBlobPayload {
    pub default_file_name: String,
    pub data: IpcBytes,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SaveBlobResult {
    pub cancelled: bool,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteClipboardImagePayload {
    pub data: IpcBytes,
    pub mime_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RevealPathResult {
    pub opened: bool,
    pub path: Option<String>,
}

#[tauri::command(rename = "desktop:notification:show")]
pub async fn show_notification<R: Runtime>(
    app: AppHandle<R>,
    payload: ShowNotificationPayload,
) -> AppResult<()> {
    let title = payload.title.trim().to_owned();
    if title.is_empty() {
        return Err(AppError::invalid_input("Notification title is empty."));
    }
    let body = payload
        .body
        .map(|body| body.trim().to_owned())
        .filter(|body| !body.is_empty());

    tauri::async_runtime::spawn_blocking(move || {
        let mut builder = app.notification().builder().title(title);
        if let Some(body) = body {
            builder = builder.body(body);
        }
        builder
            .show()
            .map_err(|error| AppError::internal("show_notification", error))
    })
    .await?
}

#[tauri::command(rename = "desktop:files:save-blob")]
pub async fn save_blob<R: Runtime>(
    app: AppHandle<R>,
    payload: SaveBlobPayload,
) -> AppResult<SaveBlobResult> {
    let file_name = sanitized_dialog_file_name(&payload.default_file_name);
    let bytes = payload.data;

    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_file_name(file_name)
            .blocking_save_file()
    })
    .await?;

    let Some(selected) = selected else {
        return Ok(SaveBlobResult {
            cancelled: true,
            file_path: None,
        });
    };

    let target = selected
        .into_path()
        .map_err(|_| AppError::invalid_path("Invalid save path."))?;
    let file_path = target.to_string_lossy().into_owned();

    tauri::async_runtime::spawn_blocking(move || std::fs::write(&target, bytes.as_slice()))
        .await??;

    Ok(SaveBlobResult {
        cancelled: false,
        file_path: Some(file_path),
    })
}

#[tauri::command(rename = "desktop:system:reveal-path")]
pub async fn reveal_path<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> AppResult<RevealPathResult> {
    tauri::async_runtime::spawn_blocking(move || reveal_path_at(&app, &path)).await?
}

#[tauri::command(rename = "desktop:clipboard:write-image")]
pub async fn write_clipboard_image<R: Runtime>(
    app: AppHandle<R>,
    payload: WriteClipboardImagePayload,
) -> AppResult<()> {
    if !payload.mime_type.eq_ignore_ascii_case(PNG_MIME_TYPE) {
        return Err(AppError::invalid_input(
            "Clipboard image payloads must be PNG.",
        ));
    }
    let png_bytes = payload.data;

    let clipboard_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let decoded = image::load_from_memory(png_bytes.as_slice()).map_err(|error| {
            AppError::invalid_input(format!("Clipboard payload is not a decodable image: {error}"))
        })?;
        let rgba = decoded.to_rgba8();
        let (width, height) = (rgba.width(), rgba.height());
        let image = tauri::image::Image::new_owned(rgba.into_raw(), width, height);
        clipboard_app
            .clipboard()
            .write_image(&image)
            .map_err(|error| AppError::internal("write_clipboard_image", error))
    })
    .await?
}

fn reveal_path_at<R: Runtime>(app: &AppHandle<R>, raw_path: &str) -> AppResult<RevealPathResult> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err(AppError::invalid_input("Reveal path is empty."));
    }
    let target = Path::new(trimmed);
    if !target.exists() {
        return Ok(RevealPathResult {
            opened: false,
            path: None,
        });
    }

    if let Err(reveal_error) = app.opener().reveal_item_in_dir(trimmed) {
        tracing::warn!(
            operation = "reveal_path",
            error = %reveal_error,
            "item reveal failed; falling back to the parent folder"
        );
        let opened = match target.parent().filter(|parent| !parent.as_os_str().is_empty()) {
            Some(parent) => app
                .opener()
                .open_path(parent.to_string_lossy(), None::<&str>)
                .is_ok(),
            None => false,
        };
        return Ok(RevealPathResult {
            opened,
            path: Some(trimmed.to_owned()),
        });
    }

    Ok(RevealPathResult {
        opened: true,
        path: Some(trimmed.to_owned()),
    })
}

pub(crate) fn sanitized_dialog_file_name(value: &str) -> String {
    let candidate = value.trim().rsplit(['/', '\\']).next().unwrap_or_default();

    let name: String = candidate
        .chars()
        .filter(|character| {
            !character.is_control()
                && !matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
        .collect();

    let mut name = truncate_utf8(name.trim_matches([' ', '.']), MAX_SAVE_BLOB_FILE_NAME_BYTES);

    if is_windows_reserved_file_name(&name) {
        name.insert(0, '_');
    }

    if name.is_empty() {
        name.push_str(FALLBACK_SAVE_BLOB_FILE_NAME);
    }

    name
}

pub(crate) fn truncate_utf8(value: &str, max_bytes: usize) -> String {
    let mut truncated = String::with_capacity(value.len().min(max_bytes));
    for character in value.chars() {
        if truncated.len() + character.len_utf8() > max_bytes {
            break;
        }
        truncated.push(character);
    }
    truncated
}

fn is_windows_reserved_file_name(value: &str) -> bool {
    let stem = value.split('.').next().unwrap_or_default();
    matches!(
        stem.to_ascii_uppercase().as_str(),
        "CON" | "PRN" | "AUX" | "NUL"
            | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9"
            | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9"
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ipc_bytes_deserializes_from_number_arrays() {
        let bytes: IpcBytes = serde_json::from_str("[72, 105, 255]").expect("valid byte array");
        assert_eq!(bytes.as_slice(), &[0x48u8, 0x69, 0xff]);
    }

    #[test]
    fn ipc_bytes_deserializes_from_base64() {
        let bytes: IpcBytes =
            serde_json::from_str("\"aGVsbG8=\"").expect("valid base64 payload");
        assert_eq!(bytes.as_slice(), b"hello");
    }

    #[test]
    fn ipc_bytes_rejects_other_shapes() {
        assert!(serde_json::from_str::<IpcBytes>("{}").is_err());
        assert!(serde_json::from_str::<IpcBytes>("true").is_err());
        assert!(serde_json::from_str::<IpcBytes>("\"not base64 !!\"").is_err());
    }

    #[test]
    fn sanitize_strips_path_components_and_invalid_characters() {
        assert_eq!(
            sanitized_dialog_file_name("  ..\\comics<>:page?.png  "),
            "comicspage.png"
        );
        assert_eq!(sanitized_dialog_file_name("a/b/c.cbz"), "c.cbz");
    }

    #[test]
    fn sanitize_guards_reserved_names_and_empty_input() {
        assert_eq!(sanitized_dialog_file_name("con.png"), "_con.png");
        assert_eq!(sanitized_dialog_file_name(""), FALLBACK_SAVE_BLOB_FILE_NAME);
        assert_eq!(
            sanitized_dialog_file_name("///"),
            FALLBACK_SAVE_BLOB_FILE_NAME
        );
    }

    #[test]
    fn sanitize_caps_byte_length_on_utf8_boundary() {
        let long = "é".repeat(150);
        let sanitized = sanitized_dialog_file_name(&long);
        assert!(sanitized.len() <= MAX_SAVE_BLOB_FILE_NAME_BYTES);
        assert_eq!(sanitized.chars().count(), MAX_SAVE_BLOB_FILE_NAME_BYTES / 2);
    }
}
