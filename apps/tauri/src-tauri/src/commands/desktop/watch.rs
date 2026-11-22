use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use notify::{
    Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher, recommended_watcher,
};
use notify::event::ModifyKind;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime, State};

use crate::{
    commands::images::IMAGE_EXTENSIONS,
    error::{AppError, AppResult},
};

pub(crate) const WATCH_FILE_EVENT: &str = "desktop:watch:file";

const MAX_WATCH_PATH_BYTES: usize = 32 * 1024;
const WATCH_DEDUPE_WINDOW_MS: u64 = 400;
const MAX_DEDUPE_ENTRIES: usize = 4096;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WatchStartPayload {
    pub folder_path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WatchStartResult {
    pub watching: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WatchFileEventPayload {
    pub file_path: String,
    pub file_name: String,
}

struct WatchSession {
    _watcher: RecommendedWatcher,
}

#[derive(Default)]
pub(crate) struct WatchStore {
    session: Mutex<Option<WatchSession>>,
}

#[tauri::command(rename = "desktop:watch:start")]
pub(crate) async fn start_watch<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, WatchStore>,
    payload: WatchStartPayload,
) -> AppResult<WatchStartResult> {
    let validated =
        tauri::async_runtime::spawn_blocking(move || validate_watch_folder(&payload.folder_path))
            .await
            .map_err(|error| AppError::internal("watch_start", error))?;

    let folder = match validated {
        Ok(folder) => folder,
        Err(message) => {
            return Ok(WatchStartResult {
                watching: false,
                error: Some(message),
            });
        }
    };

    let dedupe = Arc::new(Mutex::new(WatchDedupe::new(WATCH_DEDUPE_WINDOW_MS)));
    let handler_app = app.clone();
    let handler_folder = folder.clone();
    let handler_dedupe = Arc::clone(&dedupe);

    let mut watcher = recommended_watcher(
        move |result: Result<Event, notify::Error>| {
            handle_watch_event(&handler_app, &handler_folder, &handler_dedupe, result);
        },
    )
    .map_err(|error| AppError::internal("watch_start", error))?;

    watcher
        .watch(&folder, RecursiveMode::NonRecursive)
        .map_err(|error| AppError::internal("watch_start", error))?;

    let mut session = store
        .session
        .lock()
        .map_err(|_| AppError::internal("watch_store", "mutex poisoned"))?;
    *session = Some(WatchSession { _watcher: watcher });

    Ok(WatchStartResult {
        watching: true,
        error: None,
    })
}

#[tauri::command(rename = "desktop:watch:stop")]
pub(crate) async fn stop_watch(store: State<'_, WatchStore>) -> AppResult<()> {
    let mut session = store
        .session
        .lock()
        .map_err(|_| AppError::internal("watch_store", "mutex poisoned"))?;
    if let Some(current) = session.take() {
        drop(current);
    }
    Ok(())
}

fn validate_watch_folder(raw: &str) -> Result<PathBuf, String> {
    if raw.trim().is_empty() || raw.len() > MAX_WATCH_PATH_BYTES || raw.contains('\0') {
        return Err("The watch folder path is invalid.".to_owned());
    }

    let canonical = fs::canonicalize(raw.trim())
        .map_err(|_| "The watch folder does not exist.".to_owned())?;

    let metadata = fs::metadata(&canonical)
        .map_err(|_| "The watch folder could not be inspected.".to_owned())?;

    if !metadata.is_dir() {
        return Err("The watch path is not a folder.".to_owned());
    }

    if canonical.parent().is_none() {
        return Err("The watch path cannot be a filesystem root.".to_owned());
    }

    Ok(canonical)
}

fn handle_watch_event<R: Runtime>(
    app: &AppHandle<R>,
    folder: &Path,
    dedupe: &Mutex<WatchDedupe>,
    result: Result<Event, notify::Error>,
) {
    let Ok(event) = result else {
        return;
    };

    let candidates = collect_watch_candidates(&event.kind, &event.paths);
    if candidates.is_empty() {
        return;
    }

    let now_ms = unix_millis();
    for path in candidates {
        let staged_path = match verify_watch_candidate(&path, folder) {
            Some(path) => path,
            None => continue,
        };
        let file_path = staged_path.to_string_lossy().into_owned();
        let should_emit = match dedupe.lock() {
            Ok(mut state) => state.should_emit(&file_path, now_ms),
            Err(_) => {
                tracing::warn!("watch dedupe state poisoned; event dropped");
                false
            }
        };
        if !should_emit {
            continue;
        }

        let file_name = staged_path
            .file_name()
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_else(|| file_path.clone());

        super::forwarded_files::stage_session_forwarded_paths(std::slice::from_ref(
            &file_path,
        ));

        if let Err(error) = app.emit(
            WATCH_FILE_EVENT,
            WatchFileEventPayload { file_path, file_name },
        ) {
            tracing::warn!(error = %error, "failed to emit the watch file event");
        }
    }
}

fn verify_watch_candidate(path: &Path, folder: &Path) -> Option<PathBuf> {
    let link_metadata = fs::symlink_metadata(path).ok()?;
    if link_metadata.file_type().is_symlink() || !link_metadata.is_file() {
        return None;
    }
    let canonical = fs::canonicalize(path).ok()?;
    if !canonical.starts_with(folder) || !is_watched_image_path(&canonical) {
        return None;
    }
    Some(canonical)
}

fn collect_watch_candidates(kind: &EventKind, paths: &[PathBuf]) -> Vec<PathBuf> {
    if !matches!(
        kind,
        EventKind::Create(_) | EventKind::Modify(ModifyKind::Name(_))
    ) {
        return Vec::new();
    }

    paths
        .iter()
        .filter(|path| is_watched_image_path(path))
        .cloned()
        .collect()
}

fn is_watched_image_path(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return false;
    };
    IMAGE_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
}

fn unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

struct WatchDedupe {
    window_ms: u64,
    recent: HashMap<String, u64>,
}

impl WatchDedupe {
    fn new(window_ms: u64) -> Self {
        Self {
            window_ms,
            recent: HashMap::new(),
        }
    }

    fn should_emit(&mut self, path: &str, now_ms: u64) -> bool {
        let cutoff = now_ms.saturating_sub(self.window_ms);
        self.recent.retain(|_, seen_at| *seen_at > cutoff);

        if self.recent.contains_key(path) {
            return false;
        }

        if self.recent.len() >= MAX_DEDUPE_ENTRIES {
            self.recent.clear();
        }

        self.recent.insert(path.to_owned(), now_ms);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, DataChange, MetadataKind, RenameMode};

    fn scratch_root() -> &'static str {
        "watch-scratch"
    }

    #[test]
    fn candidates_ignore_non_create_and_rename_kinds() {
        let folder = Path::new(scratch_root()).join("folder");

        assert!(collect_watch_candidates(
            &EventKind::Modify(ModifyKind::Data(DataChange::Any)),
            &[folder.join("a.png")],
        )
        .is_empty());

        assert!(collect_watch_candidates(
            &EventKind::Modify(ModifyKind::Metadata(MetadataKind::Any)),
            &[folder.join("a.png")],
        )
        .is_empty());
    }

    #[test]
    fn candidates_filter_by_extension_only() {
        let folder = Path::new(scratch_root()).join("folder");
        let outside = Path::new(scratch_root()).join("other");

        let candidates = collect_watch_candidates(
            &EventKind::Create(CreateKind::File),
            &[
                folder.join("a.png"),
                folder.join("notes.txt"),
                outside.join("c.png"),
                folder.join("D.PNG"),
            ],
        );

        assert_eq!(
            candidates,
            vec![folder.join("a.png"), outside.join("c.png"), folder.join("D.PNG")]
        );
    }

    #[test]
    fn rename_pair_yields_both_extension_matches_for_verify_to_arbitrate() {
        let folder = Path::new(scratch_root()).join("folder");
        let outside = Path::new(scratch_root()).join("other");

        let candidates = collect_watch_candidates(
            &EventKind::Modify(ModifyKind::Name(RenameMode::Both)),
            &[outside.join("moving.png"), folder.join("arrived.png")],
        );

        assert_eq!(
            candidates,
            vec![outside.join("moving.png"), folder.join("arrived.png")]
        );
    }

    #[test]
    fn dedupe_collapses_repeated_paths_inside_the_window() {
        let mut dedupe = WatchDedupe::new(400);

        assert!(dedupe.should_emit("a.png", 1_000));
        assert!(!dedupe.should_emit("a.png", 1_200));
        assert!(dedupe.should_emit("b.png", 1_200));
        assert!(!dedupe.should_emit("a.png", 1_399));
        assert!(dedupe.should_emit("a.png", 1_400));
    }

    #[test]
    fn verify_watch_candidate_accepts_real_images_inside_the_folder() {
        let root = std::env::temp_dir().join(format!("koma-watch-ok-{}", std::process::id()));
        let folder = root.join("watched");
        fs::create_dir_all(&folder).expect("create watched folder");
        let folder = fs::canonicalize(&folder).expect("canonicalize watched folder");
        let image = folder.join("page.png");
        fs::write(&image, [1u8, 2, 3, 4]).expect("write image");

        let verified = verify_watch_candidate(&image, &folder);

        assert_eq!(
            verified.as_deref(),
            Some(fs::canonicalize(&image).unwrap().as_path())
        );
        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn verify_watch_candidate_rejects_images_outside_the_folder() {
        let root = std::env::temp_dir().join(format!("koma-watch-out-{}", std::process::id()));
        let folder = root.join("watched");
        let outside = root.join("outside");
        fs::create_dir_all(&folder).expect("create watched folder");
        fs::create_dir_all(&outside).expect("create outside folder");
        let folder = fs::canonicalize(&folder).expect("canonicalize watched folder");
        let image = outside.join("page.png");
        fs::write(&image, [1u8, 2, 3, 4]).expect("write image");

        assert!(verify_watch_candidate(&image, &folder).is_none());

        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn verify_watch_candidate_rejects_symlinks_escaping_the_folder() {
        let root = std::env::temp_dir().join(format!("koma-watch-link-{}", std::process::id()));
        let folder = root.join("watched");
        fs::create_dir_all(&folder).expect("create watched folder");
        let folder = fs::canonicalize(&folder).expect("canonicalize watched folder");
        let secret = root.join("secret.txt");
        fs::write(&secret, b"secret").expect("write secret");
        let link = folder.join("leak.png");

        #[cfg(windows)]
        std::os::windows::fs::symlink_file(&secret, &link).expect("create symlink");
        #[cfg(not(windows))]
        std::os::unix::fs::symlink(&secret, &link).expect("create symlink");

        assert!(verify_watch_candidate(&link, &folder).is_none());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn verify_watch_candidate_rejects_non_images_and_missing_files() {
        let root = std::env::temp_dir().join(format!("koma-watch-ext-{}", std::process::id()));
        let folder = root.join("watched");
        fs::create_dir_all(&folder).expect("create watched folder");
        let folder = fs::canonicalize(&folder).expect("canonicalize watched folder");
        let text = folder.join("notes.txt");
        fs::write(&text, b"text").expect("write notes");
        let missing = folder.join("ghost.png");

        assert!(verify_watch_candidate(&text, &folder).is_none());
        assert!(verify_watch_candidate(&missing, &folder).is_none());

        fs::remove_dir_all(&root).expect("cleanup");
    }

    #[test]
    fn dedupe_window_prunes_expired_entries() {
        let mut dedupe = WatchDedupe::new(400);

        for tick in 0..(MAX_DEDUPE_ENTRIES as u64) {
            dedupe.should_emit(&format!("flood-{tick}.png"), 1_000);
        }
        assert!(!dedupe.should_emit("flood-0.png", 1_100));

        for tick in 0..(MAX_DEDUPE_ENTRIES as u64) {
            dedupe.should_emit(&format!("flood2-{tick}.png"), 1_200);
        }
        assert_eq!(dedupe.recent.len(), MAX_DEDUPE_ENTRIES);
        assert!(dedupe.should_emit("fresh.png", 1_300));
        assert!(dedupe.recent.contains_key("fresh.png"));
    }
}
