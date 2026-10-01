use std::{
    borrow::Cow,
    fs, io,
    path::{Path, PathBuf},
};

use serde::Serialize;
use tauri::State;

use crate::{error::AppError, protocol::media::MediaScopes};

pub(crate) const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif", "svg", "ico", "avif",
];

const EMPTY_PATH_MESSAGE: &str = "File path was not provided.";

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

/// Output is metadata only, sorted by file name. Side effect: the folder the
/// user just browsed becomes servable through `koma-image://`.
///
/// Directory scanning is blocking I/O, so it runs on the blocking pool; the
/// main thread (and therefore the webview) never waits on the disk.
#[tauri::command(rename = "desktop-api:images:list-folder")]
pub async fn desktop_api_list_folder(
    scopes: State<'_, MediaScopes>,
    folder_path: String,
) -> Result<Vec<DesktopImageFolderEntry>, AppError> {
    let trimmed = folder_path.trim().to_owned();
    let folder = validate_non_empty_path(&trimmed)?;

    let entries = tauri::async_runtime::spawn_blocking(move || scan_image_folder(&folder))
        .await
        .map_err(blocking_task_error)??;

    scopes.images.allow_dir(&trimmed)?;
    Ok(entries)
}

/// Registers individual image files (file picker / restored autosave) so the
/// protocol will serve them. Restricted to absolute paths with image
/// extensions; returns metadata so the frontend needs no second IPC call.
///
/// Validation is fail-fast on purpose: a single rejected path means the whole
/// batch came from an untrusted or corrupted source and nothing is allowed.
#[tauri::command(rename = "desktop-api:images:allow-paths")]
pub async fn desktop_api_allow_paths(
    scopes: State<'_, MediaScopes>,
    paths: Vec<String>,
) -> Result<Vec<DesktopImageAllowedEntry>, AppError> {
    paths
        .iter()
        .map(|raw| allow_single_path(&scopes, raw))
        .collect()
}

fn allow_single_path(
    scopes: &MediaScopes,
    raw: &str,
) -> Result<DesktopImageAllowedEntry, AppError> {
    let trimmed = raw.trim();
    let path = validate_non_empty_path(trimmed)?;
    if !path.is_absolute() {
        return Err(AppError::InvalidPath(format!("not absolute: {trimmed}")));
    }
    if !is_supported_image_path(&path) {
        return Err(AppError::UnsupportedMediaType(
            extension(&path).map(Cow::into_owned).unwrap_or_default(),
        ));
    }
    let canonical = scopes.images.allow_file(&path)?;
    let metadata = fs::metadata(&canonical)?;
    Ok(DesktopImageAllowedEntry {
        file_path: trimmed.to_owned(),
        mime_type: infer_mime_type_from_path(&canonical).to_owned(),
        size: metadata.len(),
    })
}

fn scan_image_folder(path: &Path) -> Result<Vec<DesktopImageFolderEntry>, AppError> {
    if !fs::metadata(path)?.is_dir() {
        return Err(AppError::NotADirectory(path.to_path_buf()));
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(path)? {
        let file_path = entry?.path();
        // Extension check is a pure string operation; doing it first avoids a
        // stat() for every non-image file in the directory.
        if !is_supported_image_path(&file_path) {
            continue;
        }
        // Symlinks must be followed here, otherwise a linked page would be
        // listed with the link's (zero) size.
        let metadata = fs::metadata(&file_path)?;
        if !metadata.is_file() {
            continue;
        }
        let Some(file_path_str) = file_path.to_str() else {
            log::debug!("skipping non-UTF-8 image path: {}", file_path.display());
            continue;
        };
        let file_name = file_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        entries.push(DesktopImageFolderEntry {
            file_path: file_path_str.to_owned(),
            file_name,
            mime_type: infer_mime_type_from_path(&file_path).to_owned(),
            size: metadata.len(),
        });
    }

    // File names are unique inside one directory, so an unstable sort is safe.
    entries.sort_unstable_by(|left, right| left.file_name.cmp(&right.file_name));
    Ok(entries)
}

pub(crate) fn infer_mime_type_from_path(path: &Path) -> &'static str {
    match extension(path).as_deref() {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("tiff" | "tif") => "image/tiff",
        Some("svg") => "image/svg+xml",
        Some("ico") => "image/x-icon",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    }
}

fn validate_non_empty_path(raw_path: &str) -> Result<PathBuf, AppError> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput(EMPTY_PATH_MESSAGE.to_owned()));
    }
    Ok(PathBuf::from(trimmed))
}

fn is_supported_image_path(path: &Path) -> bool {
    extension(path).is_some_and(|ext| IMAGE_EXTENSIONS.contains(&&*ext))
}

/// Lower-cased extension. Borrows when the extension is already lower-case,
/// which is the overwhelmingly common case on scanned folders.
fn extension(path: &Path) -> Option<Cow<'_, str>> {
    let ext = path.extension()?.to_str()?;
    if ext.bytes().any(|byte| byte.is_ascii_uppercase()) {
        Some(Cow::Owned(ext.to_ascii_lowercase()))
    } else {
        Some(Cow::Borrowed(ext))
    }
}

fn blocking_task_error(error: tauri::Error) -> AppError {
    AppError::from(io::Error::other(error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_folder_returns_supported_images_sorted() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("b.jpg"), [1_u8]).unwrap();
        fs::write(temp.path().join("a.png"), [1_u8, 2]).unwrap();
        fs::write(temp.path().join("C.WEBP"), [1_u8, 2, 3]).unwrap();
        fs::write(temp.path().join("note.txt"), [1_u8]).unwrap();
        fs::create_dir(temp.path().join("nested.png")).unwrap();

        let result = scan_image_folder(&temp.path()).unwrap();

        assert_eq!(result.len(), 3);
        assert_eq!(result[0].file_name, "C.WEBP");
        assert_eq!(result[0].mime_type, "image/webp");
        assert_eq!(result[0].size, 3);
        assert_eq!(result[1].file_name, "a.png");
        assert_eq!(result[1].mime_type, "image/png");
        assert_eq!(result[2].file_name, "b.jpg");
        assert_eq!(result[2].mime_type, "image/jpeg");
    }

    #[test]
    fn list_folder_rejects_file_path() {
        let temp = tempfile::tempdir().unwrap();
        let file_path = temp.path().join("page.png");
        fs::write(&file_path, [1_u8]).unwrap();

        assert!(matches!(
            scan_image_folder(&file_path).unwrap_err(),
            AppError::NotADirectory(_)
        ));
    }

    #[test]
    fn list_folder_rejects_empty_path() {
        assert!(matches!(
            validate_non_empty_path("  ").unwrap_err(),
            AppError::InvalidInput(_)
        ));
    }

    #[test]
    fn extension_borrows_when_already_lowercase() {
        assert!(matches!(
            extension(Path::new("/a/b.png")),
            Some(Cow::Borrowed("png"))
        ));
        assert!(matches!(
            extension(Path::new("/a/b.PNG")),
            Some(Cow::Owned(ref owned)) if owned == "png"
        ));
        assert!(extension(Path::new("/a/noext")).is_none());
    }

    #[test]
    fn mime_type_is_case_insensitive_and_falls_back() {
        assert_eq!(infer_mime_type_from_path(Path::new("x.JPEG")), "image/jpeg");
        assert_eq!(infer_mime_type_from_path(Path::new("x.Tif")), "image/tiff");
        assert_eq!(
            infer_mime_type_from_path(Path::new("x.bin")),
            "application/octet-stream"
        );
    }
}
