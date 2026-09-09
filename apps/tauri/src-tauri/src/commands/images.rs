use std::{
    fs,
    path::{Path, PathBuf},
};

use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;

const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif", "svg", "ico", "avif",
];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopImageReadResult {
    pub data_url: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopImageFolderEntry {
    pub file_path: String,
    pub file_name: String,
    pub mime_type: String,
    pub size: u64,
}

#[tauri::command(rename = "desktop-api:images:read-file")]
pub fn read_file_as_data_url(file_path: String) -> Result<DesktopImageReadResult, String> {
    read_image_file(&file_path)
}

#[tauri::command(rename = "desktop-api:images:read-buffer")]
pub fn read_file_buffer(file_path: String) -> Result<DesktopImageReadResult, String> {
    read_image_file(&file_path)
}

#[tauri::command(rename = "desktop-api:images:list-folder")]
pub fn desktop_api_list_folder(
    folder_path: String,
) -> Result<Vec<DesktopImageFolderEntry>, String> {
    list_image_folder(&folder_path)
}

pub fn read_image_file(file_path: &str) -> Result<DesktopImageReadResult, String> {
    let path = validate_non_empty_path(file_path, "File path was not provided.")?;
    let buffer = fs::read(&path).map_err(|_| "Could not read the file.".to_string())?;
    let mime = infer_mime_type_from_path(&path);
    Ok(DesktopImageReadResult {
        data_url: format!("data:{mime};base64,{}", STANDARD.encode(&buffer)),
        size: buffer.len() as u64,
    })
}

pub fn list_image_folder(folder_path: &str) -> Result<Vec<DesktopImageFolderEntry>, String> {
    let path = validate_non_empty_path(folder_path, "Folder path was not provided.")?;
    let metadata =
        fs::metadata(&path).map_err(|_| "Could not access the folder.".to_string())?;
    if !metadata.is_dir() {
        return Err("The provided path is not a folder.".to_string());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&path).map_err(|_| "Could not list the folder.".to_string())? {
        let entry = entry.map_err(|_| "Could not list the folder.".to_string())?;
        let file_path = entry.path();
        if !file_path.is_file() || !is_supported_image_path(&file_path) {
            continue;
        }
        let metadata = entry
            .metadata()
            .map_err(|_| "Could not read the image metadata.".to_string())?;
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

pub fn infer_mime_type_from_path(path: &Path) -> String {
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

fn validate_non_empty_path(raw_path: &str, message: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err(message.to_string());
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
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_image_file_returns_data_url_and_size() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("page.png");
        fs::write(&file_path, [1_u8, 2, 3]).unwrap();

        let result = read_image_file(&file_path.to_string_lossy()).unwrap();

        assert_eq!(result.size, 3);
        assert_eq!(result.data_url, "data:image/png;base64,AQID");
    }

    #[test]
    fn read_image_file_rejects_missing_path() {
        assert_eq!(
            read_image_file(" ").unwrap_err(),
            "File path was not provided."
        );
    }

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

        assert_eq!(
            list_image_folder(&file_path.to_string_lossy()).unwrap_err(),
            "The provided path is not a folder."
        );
    }
}
