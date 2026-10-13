use std::{
    borrow::Cow,
    collections::{BinaryHeap, HashSet},
    fs, io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::{
    error::AppError,
    protocol::media::MediaScopes,
};

pub(crate) const IMAGE_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff", "tif", "svg", "ico", "avif",
];

const MAX_BATCH_PATHS: usize = 256;
const MAX_PATH_BYTES: usize = 32 * 1024;
const MAX_PAGE_SIZE: usize = 200;
const DEFAULT_PAGE_SIZE: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopImageFolderEntry {
    pub file_path: String,
    pub file_name: String,
    pub mime_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopImageAllowedEntry {
    pub file_path: String,
    pub mime_type: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopImageFolderPage {
    pub entries: Vec<DesktopImageFolderEntry>,
    pub next_cursor: Option<String>,
}

#[derive(
    Debug,
    Clone,
    Copy,
    Serialize,
    Deserialize,
    PartialEq,
    Eq,
)]
#[serde(rename_all = "snake_case")]
pub enum ImagePathFailureCode {
    InvalidPath,
    UnsupportedMediaType,
    NotAFile,
    Io,
    AuthorizationFailed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum DesktopImageAllowOutcome {
    Allowed {
        index: u32,
        entry: DesktopImageAllowedEntry,
    },
    Rejected {
        index: u32,
        code: ImagePathFailureCode,
    },
}

#[derive(Debug)]
struct PreparedImage {
    canonical_path: PathBuf,
    entry: DesktopImageAllowedEntry,
}

#[derive(Debug, Eq, PartialEq)]
struct FolderCandidate {
    file_name: String,
    file_path: PathBuf,
    size: u64,
}

impl Ord for FolderCandidate {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.file_name
            .cmp(&other.file_name)
            .then_with(|| self.file_path.cmp(&other.file_path))
            .then_with(|| self.size.cmp(&other.size))
    }
}

impl PartialOrd for FolderCandidate {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

#[tauri::command(rename = "desktop-api:images:list-folder")]
pub async fn desktop_api_list_folder(
    scopes: State<'_, MediaScopes>,
    folder_path: String,
    cursor: Option<String>,
    limit: Option<u32>,
) -> Result<DesktopImageFolderPage, AppError> {
    let folder = validate_non_empty_path(&folder_path)?;
    let limit = validate_page_size(limit)?;

    if !folder.is_absolute() {
        return Err(AppError::InvalidInput(
            "Folder path must be absolute.".to_owned(),
        ));
    }

    if let Some(cursor) = cursor.as_deref() {
        validate_cursor(cursor)?;
    }

    let (folder, page) = tauri::async_runtime::spawn_blocking(move || {
        let canonical = fs::canonicalize(folder)?;

        let page = scan_image_folder_page(
            &canonical,
            cursor.as_deref(),
            limit,
        )?;

        Ok::<_, AppError>((canonical, page))
    })
    .await
    .map_err(blocking_task_error)??;

    // Grant the exact canonical root used by the scan.
    scopes.images.allow_dir(&folder)?;

    Ok(page)
}

#[tauri::command(rename = "desktop-api:images:allow-paths")]
pub async fn desktop_api_allow_paths(
    scopes: State<'_, MediaScopes>,
    paths: Vec<String>,
) -> Result<Vec<DesktopImageAllowOutcome>, AppError> {
    if paths.len() > MAX_BATCH_PATHS {
        return Err(AppError::InvalidInput(
            "Image path batch exceeds the supported size.".to_owned(),
        ));
    }

    let prepared = tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(|raw| prepare_image_path(&raw))
            .collect::<Vec<_>>()
    })
    .await
    .map_err(blocking_task_error)?;

    let mut outcomes = Vec::with_capacity(prepared.len());
    let mut granted = HashSet::new();

    for (index, prepared) in prepared.into_iter().enumerate() {
        let index = u32::try_from(index).map_err(|_| {
            AppError::InvalidInput(
                "Image path batch exceeds the supported size.".to_owned(),
            )
        })?;

        let prepared = match prepared {
            Ok(prepared) => prepared,
            Err(code) => {
                tracing::warn!(
                    operation = "prepare_image_authorization",
                    index,
                    error_code = ?code,
                    "image path rejected"
                );

                outcomes.push(DesktopImageAllowOutcome::Rejected {
                    index,
                    code,
                });

                continue;
            }
        };

        if !granted.contains(&prepared.canonical_path) {
            match scopes.images.allow_file(&prepared.canonical_path) {
                Ok(authorized_path)
                    if authorized_path == prepared.canonical_path =>
                {
                    granted.insert(prepared.canonical_path.clone());
                }
                Ok(_) => {
                    tracing::error!(
                        operation = "authorize_image",
                        index,
                        "canonical path changed during authorization"
                    );

                    outcomes.push(DesktopImageAllowOutcome::Rejected {
                        index,
                        code: ImagePathFailureCode::AuthorizationFailed,
                    });

                    continue;
                }
                Err(_) => {
                    tracing::warn!(
                        operation = "authorize_image",
                        index,
                        "image authorization failed"
                    );

                    outcomes.push(DesktopImageAllowOutcome::Rejected {
                        index,
                        code: ImagePathFailureCode::AuthorizationFailed,
                    });

                    continue;
                }
            }
        }

        outcomes.push(DesktopImageAllowOutcome::Allowed {
            index,
            entry: prepared.entry,
        });
    }

    Ok(outcomes)
}

fn prepare_image_path(
    raw: &str,
) -> Result<PreparedImage, ImagePathFailureCode> {
    let path = validate_non_empty_path(raw)
        .map_err(|_| ImagePathFailureCode::InvalidPath)?;

    if !path.is_absolute() {
        return Err(ImagePathFailureCode::InvalidPath);
    }

    if !is_supported_image_path(&path) {
        return Err(ImagePathFailureCode::UnsupportedMediaType);
    }

    let canonical_path = fs::canonicalize(path)
        .map_err(|_| ImagePathFailureCode::Io)?;

    if !is_supported_image_path(&canonical_path) {
        return Err(ImagePathFailureCode::UnsupportedMediaType);
    }

    let metadata = fs::metadata(&canonical_path)
        .map_err(|_| ImagePathFailureCode::Io)?;

    if !metadata.is_file() {
        return Err(ImagePathFailureCode::NotAFile);
    }

    let file_path = canonical_path
        .to_str()
        .ok_or(ImagePathFailureCode::InvalidPath)?
        .to_owned();

    let entry = DesktopImageAllowedEntry {
        file_path,
        mime_type: infer_mime_type_from_path(&canonical_path).to_owned(),
        size: metadata.len(),
    };

    Ok(PreparedImage {
        canonical_path,
        entry,
    })
}

fn scan_image_folder_page(
    folder: &Path,
    cursor: Option<&str>,
    limit: usize,
) -> Result<DesktopImageFolderPage, AppError> {
    if !fs::metadata(folder)?.is_dir() {
        return Err(AppError::NotADirectory(folder.to_path_buf()));
    }

    let capacity = limit + 1;
    let mut candidates = BinaryHeap::with_capacity(capacity);

    for entry in fs::read_dir(folder)? {
        let entry = entry?;
        let file_path = entry.path();

        if !is_supported_image_path(&file_path) {
            continue;
        }

        let file_name = entry
            .file_name()
            .into_string()
            .map_err(|_| {
                AppError::InvalidInput(
                    "Image file name is not valid UTF-8.".to_owned(),
                )
            })?;

        if cursor.is_some_and(|cursor| file_name.as_str() <= cursor) {
            continue;
        }

        let file_type = entry.file_type()?;

        // A directory listing does not authorize targets outside its root.
        if file_type.is_symlink() || !file_type.is_file() {
            continue;
        }

        let metadata = entry.metadata()?;

        candidates.push(FolderCandidate {
            file_name,
            file_path,
            size: metadata.len(),
        });

        if candidates.len() > capacity {
            candidates.pop();
        }
    }

    let mut candidates = candidates.into_sorted_vec();
    let has_more = candidates.len() > limit;

    if has_more {
        candidates.truncate(limit);
    }

    let next_cursor = if has_more {
        candidates.last().map(|entry| entry.file_name.clone())
    } else {
        None
    };

    let entries = candidates
        .into_iter()
        .map(|candidate| {
            let mime_type =
                infer_mime_type_from_path(&candidate.file_path).to_owned();

            let file_path = candidate
                .file_path
                .to_str()
                .ok_or_else(|| {
                    AppError::InvalidInput(
                        "Image path is not valid UTF-8.".to_owned(),
                    )
                })?
                .to_owned();

            Ok(DesktopImageFolderEntry {
                file_path,
                file_name: candidate.file_name,
                mime_type,
                size: candidate.size,
            })
        })
        .collect::<Result<Vec<_>, AppError>>()?;

    Ok(DesktopImageFolderPage {
        entries,
        next_cursor,
    })
}

fn validate_page_size(limit: Option<u32>) -> Result<usize, AppError> {
    let limit = match limit {
        Some(limit) => usize::try_from(limit).map_err(|_| {
            AppError::InvalidInput("Invalid image page size.".to_owned())
        })?,
        None => DEFAULT_PAGE_SIZE,
    };

    if !(1..=MAX_PAGE_SIZE).contains(&limit) {
        return Err(AppError::InvalidInput(
            "Image page size is outside the supported range.".to_owned(),
        ));
    }

    Ok(limit)
}

fn validate_cursor(cursor: &str) -> Result<(), AppError> {
    if cursor.is_empty()
        || cursor.len() > MAX_PATH_BYTES
        || cursor.contains('/')
        || cursor.contains('\\')
        || cursor.contains('\0')
    {
        return Err(AppError::InvalidInput(
            "Invalid image pagination cursor.".to_owned(),
        ));
    }

    Ok(())
}

fn validate_non_empty_path(raw_path: &str) -> Result<PathBuf, AppError> {
    if raw_path.trim().is_empty()
        || raw_path.len() > MAX_PATH_BYTES
        || raw_path.contains('\0')
    {
        return Err(AppError::InvalidInput(
            "Invalid image path.".to_owned(),
        ));
    }

    // Leading and trailing spaces can be part of a valid filesystem name.
    Ok(PathBuf::from(raw_path))
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

fn is_supported_image_path(path: &Path) -> bool {
    extension(path).is_some_and(|extension| {
        IMAGE_EXTENSIONS.contains(&extension.as_ref())
    })
}

fn extension(path: &Path) -> Option<Cow<'_, str>> {
    let extension = path.extension()?.to_str()?;

    if extension.bytes().any(|byte| byte.is_ascii_uppercase()) {
        Some(Cow::Owned(extension.to_ascii_lowercase()))
    } else {
        Some(Cow::Borrowed(extension))
    }
}

fn blocking_task_error(error: tauri::Error) -> AppError {
    tracing::error!(
        operation = "image_background_task",
        "image background task failed"
    );

    AppError::from(io::Error::other(error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn folder_page_is_sorted_and_has_a_cursor() {
        let temp = tempfile::tempdir().unwrap();

        for name in ["d.png", "b.png", "a.png", "c.png"] {
            fs::write(temp.path().join(name), [1_u8]).unwrap();
        }

        let first =
            scan_image_folder_page(temp.path(), None, 2).unwrap();

        assert_eq!(first.entries.len(), 2);
        assert_eq!(first.entries[0].file_name, "a.png");
        assert_eq!(first.entries[1].file_name, "b.png");
        assert_eq!(first.next_cursor.as_deref(), Some("b.png"));

        let second = scan_image_folder_page(
            temp.path(),
            first.next_cursor.as_deref(),
            2,
        )
        .unwrap();

        assert_eq!(second.entries.len(), 2);
        assert_eq!(second.entries[0].file_name, "c.png");
        assert_eq!(second.entries[1].file_name, "d.png");
        assert_eq!(second.next_cursor, None);
    }

    #[test]
    fn folder_page_ignores_unsupported_files_and_directories() {
        let temp = tempfile::tempdir().unwrap();

        fs::write(temp.path().join("image.PNG"), [1_u8, 2]).unwrap();
        fs::write(temp.path().join("notes.txt"), [1_u8]).unwrap();
        fs::create_dir(temp.path().join("nested.jpg")).unwrap();

        let page =
            scan_image_folder_page(temp.path(), None, 100).unwrap();

        assert_eq!(page.entries.len(), 1);
        assert_eq!(page.entries[0].file_name, "image.PNG");
        assert_eq!(page.entries[0].mime_type, "image/png");
        assert_eq!(page.entries[0].size, 2);
    }

    #[test]
    fn paths_are_not_trimmed() {
        assert_eq!(
            validate_non_empty_path(" image.png ").unwrap(),
            PathBuf::from(" image.png ")
        );
    }

    #[test]
    fn invalid_paths_are_rejected() {
        assert!(validate_non_empty_path("").is_err());
        assert!(validate_non_empty_path("   ").is_err());
        assert!(validate_non_empty_path("image\0.png").is_err());
    }

    #[test]
    fn pagination_limits_are_validated() {
        assert!(validate_page_size(Some(0)).is_err());
        assert!(validate_page_size(Some(201)).is_err());
        assert_eq!(validate_page_size(Some(200)).unwrap(), 200);
        assert_eq!(validate_page_size(None).unwrap(), 100);
    }

    #[test]
    fn extension_borrows_lowercase_values() {
        assert!(matches!(
            extension(Path::new("image.png")),
            Some(Cow::Borrowed("png"))
        ));

        assert!(matches!(
            extension(Path::new("image.PNG")),
            Some(Cow::Owned(ref value)) if value == "png"
        ));
    }

    #[test]
    fn preparing_a_directory_as_an_image_is_rejected() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("directory.png");
        fs::create_dir(&path).unwrap();

        assert!(matches!(
            prepare_image_path(path.to_str().unwrap()),
            Err(ImagePathFailureCode::NotAFile)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn folder_page_does_not_follow_symlinks() {
        use std::os::unix::fs::symlink;

        let folder = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();

        let target = outside.path().join("outside.png");
        fs::write(&target, [1_u8]).unwrap();

        symlink(&target, folder.path().join("linked.png")).unwrap();

        let page =
            scan_image_folder_page(folder.path(), None, 100).unwrap();

        assert!(page.entries.is_empty());
    }
}
