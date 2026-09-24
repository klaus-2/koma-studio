use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::Serialize;
use tauri::State;

use crate::{error::AppError, protocol::media::MediaScopes};

pub(crate) const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif", "svg", "ico", "avif",
];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopImageFolderEntry {
    pub file_path: String,
    pub file_name: String,
    pub mime_type: String,
    pub size: u64,
}

/// Metadata returned by `allow-paths`. Never bytes.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopImageAllowedEntry {
    pub file_path: String,
    pub mime_type: String,
    pub size: u64,
}

/// Output is unchanged (metadata only, sorted). Side effect: the folder the
/// user just browsed becomes servable through `koma-image://`.
#[tauri::command(rename = "desktop-api:images:list-folder")]
pub fn desktop_api_list_folder(
    scopes: State<'_, MediaScopes>,
    folder_path: String,
) -> Result<Vec<DesktopImageFolderEntry>, AppError> {
    let entries = list_image_folder(&folder_path)?;
    scopes.images.allow_dir(folder_path.trim())?;
    Ok(entries)
}

/// Registers individual image files (file picker / restored autosave) so the
/// protocol will serve them. Restricted to absolute paths with image
/// extensions; returns metadata so the frontend needs no second IPC call.
#[tauri::command(rename = "desktop-api:images:allow-paths")]
pub fn desktop_api_allow_paths(
    scopes: State<'_, MediaScopes>,
    paths: Vec<String>,
) -> Result<Vec<DesktopImageAllowedEntry>, AppError> {
    paths
        .iter()
        .map(|raw| {
            let path = validate_non_empty_path(raw, "File path was not provided.")?;
            if !path.is_absolute() {
                return Err(AppError::InvalidPath(format!("not absolute: {raw}")));
            }
            if !is_supported_image_path(&path) {
                return Err(AppError::UnsupportedMediaType(
                    extension(&path).unwrap_or_default(),
                ));
            }
            let canonical = scopes.images.allow_file(&path)?;
            let metadata = fs::metadata(&canonical)?;
            Ok(DesktopImageAllowedEntry {
                file_path: raw.trim().to_string(),
                mime_type: infer_mime_type_from_path(&canonical),
                size: metadata.len(),
            })
        })
        .collect()
}

pub fn list_image_folder(folder_path: &str) -> Result<Vec<DesktopImageFolderEntry>, AppError> {
    let path = validate_non_empty_path(folder_path, "File path was not provided.")?;
    let metadata = fs::metadata(&path)?;
    if !metadata.is_dir() {
        return Err(AppError::NotADirectory(path));
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&path)? {
        let entry = entry?;
        let file_path = entry.path();
        if !file_path.is_file() || !is_supported_image_path(&file_path) {
            continue;
        }
        let metadata = entry.metadata()?;
        let file_name = file_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string();
        entries.push(DesktopImageFolderEntry {
            file_path: file_path.to_string_lossy().to_string(),
            file_name,
            mime_type: infer_mime_type_from_path(&file_path),
            size: metadata.len(),
        });
    }

    entries.sort_by(|left, right| left.file_name.cmp(&right.file_name));
    Ok(entries)
}

pub(crate) fn infer_mime_type_from_path(path: &Path) -> String {
    match extension(path).as_deref() {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("tiff") | Some("tif") => "image/tiff",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    }
    .to_string()
}

fn validate_non_empty_path(raw_path: &str, message: &str) -> Result<PathBuf, AppError> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput(message.to_string()));
    }

    Ok(PathBuf::from(trimmed))
}

fn is_supported_image_path(path: &Path) -> bool {
    extension(path)
        .map(|ext| IMAGE_EXTENSIONS.contains(&ext.as_str()))
        .unwrap_or(false)
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_folder_returns_supported_images_sorted() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("b.jpg"), [1_u8]).unwrap();
        fs::write(temp.path().join("a.png"), [1_u8, 2]).unwrap();
        fs::write(temp.path().join("note.txt"), [1_u8]).unwrap();

        let result = list_image_folder(&temp.path().to_string_lossy()).unwrap();

        assert_eq!(result.len(), 2);
        assert_eq!(result[0].file_name, "a.png");
        assert_eq!(result[0].mime_type, "image/png");
        assert_eq!(result[1].file_name, "b.jpg");
    }

    #[test]
    fn list_folder_rejects_file_path() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("page.png");
        fs::write(&file_path, [1_u8]).unwrap();

        assert!(matches!(
            list_image_folder(&file_path.to_string_lossy()).unwrap_err(),
            AppError::NotADirectory(_)
        ));
    }

    #[test]
    fn list_folder_rejects_empty_path() {
        assert!(matches!(
            list_image_folder("  ").unwrap_err(),
            AppError::InvalidInput(_)
        ));
    }
}
