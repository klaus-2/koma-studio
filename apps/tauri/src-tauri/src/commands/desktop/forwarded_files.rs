use std::{
    collections::HashSet,
    fs, io,
    path::{Path, PathBuf},
    sync::Mutex,
};

use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};
#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
use url::Url;

use crate::error::AppError;

pub(crate) const FORWARDED_FILES_EVENT: &str = "desktop:files:forwarded";

const CONTAINER_FILE_EXTENSIONS: &[&str] = &["zip", "cbz", "cb7", "pdf", "psd"];

static STAGED_FIRST_LAUNCH_PATHS: Mutex<Option<Vec<String>>> = Mutex::new(None);

static SESSION_FORWARDED_PATHS: Mutex<Option<HashSet<String>>> = Mutex::new(None);

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ForwardedFilesPayload {
    paths: Vec<String>,
}

pub(crate) fn stage_first_launch_paths(args: impl IntoIterator<Item = String>) {
    let paths = collect_container_paths(
        args.into_iter()
            .filter_map(|arg| candidate_path_from_launch_arg(&arg)),
    );
    if paths.is_empty() {
        return;
    }
    if let Ok(mut staged) = STAGED_FIRST_LAUNCH_PATHS.lock() {
        if staged.is_none() {
            *staged = Some(paths);
        }
    }
}

pub(crate) fn flush_staged_paths<R: Runtime>(app: &AppHandle<R>) {
    let staged = STAGED_FIRST_LAUNCH_PATHS
        .lock()
        .ok()
        .and_then(|mut staged| staged.take());
    if let Some(paths) = staged {
        forward_paths(app, paths);
    }
}

pub(crate) fn forward_launch_args<R: Runtime>(
    app: &AppHandle<R>,
    args: impl IntoIterator<Item = String>,
) {
    let paths = collect_container_paths(
        args.into_iter()
            .filter_map(|arg| candidate_path_from_launch_arg(&arg)),
    );
    forward_paths(app, paths);
}

#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
pub(crate) fn forward_opened_urls<R: Runtime>(app: &AppHandle<R>, urls: &[Url]) {
    let paths = collect_container_paths(urls.iter().filter_map(candidate_path_from_url));
    forward_paths(app, paths);
}

fn forward_paths<R: Runtime>(app: &AppHandle<R>, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    stage_session_forwarded_paths(&paths);
    let count = paths.len();
    if let Err(error) = app.emit(FORWARDED_FILES_EVENT, ForwardedFilesPayload { paths }) {
        log::warn!("failed to forward file paths to the webview: {error}");
        return;
    }
    tracing::info!(count, "forwarded OS-launched files to the webview");
}

fn normalize_forwarded_path(path: &str) -> String {
    path.trim().to_owned()
}

fn stage_session_forwarded_paths(paths: &[String]) {
    if let Ok(mut staged) = SESSION_FORWARDED_PATHS.lock() {
        staged
            .get_or_insert_with(HashSet::new)
            .extend(paths.iter().map(|path| normalize_forwarded_path(path)));
    }
}

fn is_session_forwarded_path(path: &str) -> bool {
    match SESSION_FORWARDED_PATHS.lock() {
        Ok(staged) => staged
            .as_ref()
            .is_some_and(|paths| paths.contains(&normalize_forwarded_path(path))),
        Err(_) => false,
    }
}

fn serve_forwarded_file_bytes(path: &str) -> Result<Vec<u8>, AppError> {
    if !is_session_forwarded_path(path) {
        return Err(AppError::NotAllowed(
            "only paths forwarded by the OS during this session can be read".to_owned(),
        ));
    }
    if !fs::metadata(path)?.is_file() {
        return Err(AppError::NotAFile(PathBuf::from(path)));
    }
    fs::read(path).map_err(AppError::from)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReadForwardedFileResult {
    data: String,
}

#[tauri::command(rename = "desktop:files:read-forwarded")]
pub(crate) async fn read_forwarded(path: String) -> Result<ReadForwardedFileResult, AppError> {
    let bytes = tauri::async_runtime::spawn_blocking(move || serve_forwarded_file_bytes(&path))
        .await
        .map_err(|error| AppError::from(io::Error::other(error)))??;
    Ok(ReadForwardedFileResult {
        data: general_purpose::STANDARD.encode(bytes),
    })
}

fn candidate_path_from_launch_arg(arg: &str) -> Option<PathBuf> {
    let path = Path::new(arg.trim());
    if path.is_absolute() {
        Some(path.to_path_buf())
    } else {
        None
    }
}

#[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
fn candidate_path_from_url(url: &Url) -> Option<PathBuf> {
    if url.scheme() != "file" {
        return None;
    }
    url.to_file_path().ok()
}

fn collect_container_paths<I>(candidates: I) -> Vec<String>
where
    I: IntoIterator<Item = PathBuf>,
{
    let mut seen = HashSet::new();
    candidates
        .into_iter()
        .filter_map(|path| {
            let extension = path.extension()?.to_str()?.to_ascii_lowercase();
            if !CONTAINER_FILE_EXTENSIONS.contains(&extension.as_str()) {
                return None;
            }
            if !path.is_file() {
                return None;
            }
            Some(path.to_string_lossy().into_owned())
        })
        .filter(|path| seen.insert(path.clone()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_container_file(dir: &Path, name: &str) -> PathBuf {
        let path = dir.join(name);
        std::fs::write(&path, b"koma").expect("failed to create the fixture file");
        path
    }

    #[test]
    fn collects_existing_container_files_case_insensitively() {
        let dir = tempfile::tempdir().expect("failed to create the temp dir");
        let zip = temp_container_file(dir.path(), "a.ZIP");
        let cbz = temp_container_file(dir.path(), "b.cbz");
        let psd = temp_container_file(dir.path(), "c.PsD");

        let collected = collect_container_paths([zip.clone(), cbz.clone(), psd.clone()]);
        let expected: Vec<String> = vec![zip, cbz, psd]
            .into_iter()
            .map(|path| path.to_string_lossy().into_owned())
            .collect();
        assert_eq!(collected, expected);
    }

    #[test]
    fn rejects_missing_files_and_unknown_extensions() {
        let dir = tempfile::tempdir().expect("failed to create the temp dir");
        let ghost = dir.path().join("ghost.cbz");
        let txt = temp_container_file(dir.path(), "notes.txt");
        let exe = temp_container_file(dir.path(), "tool.exe");

        let collected = collect_container_paths([ghost, txt, exe]);
        assert!(collected.is_empty());
    }

    #[test]
    fn rejects_relative_arguments() {
        assert!(candidate_path_from_launch_arg("chapter.cbz").is_none());
        assert!(candidate_path_from_launch_arg("./chapter.cbz").is_none());
        assert!(candidate_path_from_launch_arg("komastudio://confirm-email?token=x").is_none());
        assert!(candidate_path_from_launch_arg("--flag").is_none());
    }

    #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
    #[test]
    fn accepts_file_urls_and_rejects_other_schemes() {
        let file_url = Url::parse("file:///comics/x.cbz").expect("valid file URL");
        assert!(candidate_path_from_url(&file_url).is_some());
        let https_url = Url::parse("https://example.com/x.cbz").expect("valid https URL");
        assert!(candidate_path_from_url(&https_url).is_none());
    }

    #[test]
    fn deduplicates_repeated_paths() {
        let dir = tempfile::tempdir().expect("failed to create the temp dir");
        let zip = temp_container_file(dir.path(), "a.zip");

        let collected = collect_container_paths([zip.clone(), zip]);
        assert_eq!(collected.len(), 1);
    }

    #[test]
    fn stage_ignores_arguments_without_eligible_paths() {
        stage_first_launch_paths(["--flag".to_owned(), "ghost.cbz".to_owned()]);
        let staged = STAGED_FIRST_LAUNCH_PATHS
            .lock()
            .expect("unpoisoned lock")
            .take();
        assert!(staged.is_none());
    }

    #[test]
    fn read_rejects_paths_outside_the_staged_set() {
        let dir = tempfile::tempdir().expect("failed to create the temp dir");
        let zip = temp_container_file(dir.path(), "a.cbz");

        assert!(matches!(
            serve_forwarded_file_bytes(zip.to_string_lossy().as_ref()),
            Err(AppError::NotAllowed(_))
        ));
    }

    #[test]
    fn read_serves_bytes_for_a_forwarded_path() {
        let dir = tempfile::tempdir().expect("failed to create the temp dir");
        let zip = temp_container_file(dir.path(), "a.cbz");

        stage_session_forwarded_paths(&[zip.to_string_lossy().into_owned()]);

        let bytes = serve_forwarded_file_bytes(zip.to_string_lossy().as_ref())
            .expect("a staged path must be served");
        assert_eq!(bytes, b"koma");
    }

    #[test]
    fn read_is_normalization_stable_for_padded_requests() {
        let dir = tempfile::tempdir().expect("failed to create the temp dir");
        let zip = temp_container_file(dir.path(), "a.cbz");
        let staged = zip.to_string_lossy().into_owned();

        stage_session_forwarded_paths(&[staged.clone()]);

        assert!(is_session_forwarded_path(&format!("  {staged}  ")));
    }

    #[test]
    fn read_rejects_siblings_parents_and_traversal_variants() {
        let dir = tempfile::tempdir().expect("failed to create the temp dir");
        let zip = temp_container_file(dir.path(), "a.cbz");
        let staged = zip.to_string_lossy().into_owned();

        stage_session_forwarded_paths(&[staged]);

        let sibling = dir.path().join("b.cbz").to_string_lossy().into_owned();
        assert!(!is_session_forwarded_path(&sibling));
        assert!(!is_session_forwarded_path(dir.path().to_string_lossy().as_ref()));

        let traversal = format!("{}/../b.cbz", dir.path().join("a.cbz").to_string_lossy());
        assert!(!is_session_forwarded_path(&traversal));
        assert!(matches!(
            serve_forwarded_file_bytes(&traversal),
            Err(AppError::NotAllowed(_))
        ));
    }
}
