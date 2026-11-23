use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::SystemTime,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

use crate::{
    commands::desktop_integrations::{IpcBytes, sanitized_dialog_file_name, truncate_utf8},
    error::{AppError, AppResult},
    services::workspace::atomic_replace,
};

const MAX_ARCHIVE_ENTRY_NAME_BYTES: usize = 200;
const MAX_ACTIVE_EXPORT_SESSIONS: usize = 8;
const MAX_ENTRY_NAME_INPUT_BYTES: usize = 1024;
const BUNDLE_SESSION_TTL_MS: u64 = 10 * 60 * 1000;

fn unix_millis() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum BundleExtension {
    Zip,
    Cbz,
}

impl BundleExtension {
    fn as_str(self) -> &'static str {
        match self {
            Self::Zip => "zip",
            Self::Cbz => "cbz",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleBeginPayload {
    pub extension: BundleExtension,
    pub default_file_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleBeginResult {
    pub cancelled: bool,
    pub session_id: Option<String>,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleAppendPayload {
    pub session_id: String,
    pub name: String,
    pub data: IpcBytes,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleFinalizePayload {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BundleFinalizeResult {
    pub file_path: Option<String>,
}

struct BundleSession {
    writer: ZipWriter<File>,
    temp_path: PathBuf,
    target_path: PathBuf,
    used_names: HashSet<String>,
    created_at_ms: u64,
}

impl BundleSession {
    fn abort(self) {
        let BundleSession {
            writer,
            temp_path,
            target_path: _,
            used_names: _,
            created_at_ms: _,
        } = self;
        drop(writer);
        let _ = fs::remove_file(temp_path);
    }
}

#[derive(Default)]
pub(crate) struct BundleSessionStore {
    sessions: Arc<Mutex<HashMap<String, BundleSession>>>,
}

fn store_poisoned() -> AppError {
    AppError::internal("bundle_session_store", "mutex poisoned")
}

#[tauri::command(rename = "desktop:export:begin-bundle")]
pub(crate) async fn begin_bundle<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, BundleSessionStore>,
    payload: BundleBeginPayload,
) -> AppResult<BundleBeginResult> {
    let selected_extension = payload.extension.as_str();
    let file_name = match payload.default_file_name.as_deref() {
        Some(raw) => Some(dialog_file_name_for_extension(raw, payload.extension)),
        None => None,
    };

    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let builder = dialog_app.dialog().file();
        let builder = match file_name {
            Some(file_name) => builder.set_file_name(file_name),
            None => builder,
        };
        let builder = match payload.extension {
            BundleExtension::Cbz => builder
                .add_filter("Comic book archive", &["cbz"])
                .add_filter("ZIP archive", &["zip"]),
            BundleExtension::Zip => builder
                .add_filter("ZIP archive", &["zip"])
                .add_filter("Comic book archive", &["cbz"]),
        };
        builder.blocking_save_file()
    })
    .await?;

    let Some(selected) = selected else {
        return Ok(BundleBeginResult {
            cancelled: true,
            session_id: None,
            file_path: None,
        });
    };

    let mut target = selected
        .into_path()
        .map_err(|_| AppError::invalid_path("Invalid export path."))?;
    if !target
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(selected_extension))
    {
        target.set_extension(selected_extension);
    }

    let file_path = target.to_string_lossy().into_owned();
    let sessions = Arc::clone(&store.sessions);
    let session_id =
        tauri::async_runtime::spawn_blocking(move || {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            begin_session(&sessions, &target)
        })
        .await??;

    Ok(BundleBeginResult {
        cancelled: false,
        session_id: Some(session_id),
        file_path: Some(file_path),
    })
}

#[tauri::command(rename = "desktop:export:append-entry")]
pub(crate) async fn append_entry(
    store: State<'_, BundleSessionStore>,
    payload: BundleAppendPayload,
) -> AppResult<()> {
    let sessions = Arc::clone(&store.sessions);
    tauri::async_runtime::spawn_blocking(move || {
        append_session_entry(&sessions, &payload.session_id, &payload.name, payload.data.as_slice())
    })
    .await?
}

#[tauri::command(rename = "desktop:export:finalize-bundle")]
pub(crate) async fn finalize_bundle(
    store: State<'_, BundleSessionStore>,
    payload: BundleFinalizePayload,
) -> AppResult<BundleFinalizeResult> {
    let sessions = Arc::clone(&store.sessions);
    let file_path =
        tauri::async_runtime::spawn_blocking(move || finalize_session(&sessions, &payload.session_id))
            .await??;

    Ok(BundleFinalizeResult {
        file_path: Some(file_path.to_string_lossy().into_owned()),
    })
}

fn dialog_file_name_for_extension(raw: &str, extension: BundleExtension) -> String {
    let sanitized = sanitized_dialog_file_name(raw);
    let stem = Path::new(&sanitized)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("export");
    format!("{stem}.{}", extension.as_str())
}

fn begin_session(
    sessions: &Mutex<HashMap<String, BundleSession>>,
    target: &Path,
) -> AppResult<String> {
    let mut map = sessions.lock().map_err(|_| store_poisoned())?;
    sweep_expired_sessions(&mut map);
    if map.len() >= MAX_ACTIVE_EXPORT_SESSIONS {
        return Err(AppError::conflict("Too many active export sessions."));
    }

    let file_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::invalid_path("Invalid export file name."))?;
    let parent = target
        .parent()
        .ok_or_else(|| AppError::invalid_path("Invalid export path."))?;

    let temp_path = parent.join(format!(".{file_name}.{}.tmp", Uuid::new_v4()));
    let file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temp_path)?;

    let session_id = Uuid::new_v4().to_string();
    map.insert(
        session_id.clone(),
        BundleSession {
            writer: ZipWriter::new(file),
            temp_path,
            target_path: target.to_path_buf(),
            used_names: HashSet::new(),
            created_at_ms: unix_millis(),
        },
    );
    Ok(session_id)
}

fn sweep_expired_sessions(map: &mut HashMap<String, BundleSession>) {
    let now_ms = unix_millis();
    let expired: Vec<String> = map
        .iter()
        .filter(|(_, session)| {
            now_ms.saturating_sub(session.created_at_ms) > BUNDLE_SESSION_TTL_MS
        })
        .map(|(session_id, _)| session_id.clone())
        .collect();
    for session_id in expired {
        if let Some(session) = map.remove(&session_id) {
            session.abort();
        }
    }
}

fn append_session_entry(
    sessions: &Mutex<HashMap<String, BundleSession>>,
    session_id: &str,
    raw_name: &str,
    bytes: &[u8],
) -> AppResult<()> {
    let outcome = write_session_entry(sessions, session_id, raw_name, bytes);
    if outcome.is_err() {
        abort_session(sessions, session_id);
    }
    outcome
}

fn write_session_entry(
    sessions: &Mutex<HashMap<String, BundleSession>>,
    session_id: &str,
    raw_name: &str,
    bytes: &[u8],
) -> AppResult<()> {
    let mut map = sessions.lock().map_err(|_| store_poisoned())?;
    let Some(session) = map.get_mut(session_id) else {
        return Err(AppError::invalid_input("Unknown export session."));
    };

    let name = sanitize_entry_name(raw_name, &mut session.used_names)?;
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .compression_level(Some(6))
        .unix_permissions(0o644);

    session.writer.start_file(name.as_str(), options)?;
    session.writer.write_all(bytes)?;
    Ok(())
}

fn abort_session(sessions: &Mutex<HashMap<String, BundleSession>>, session_id: &str) {
    let session = match sessions.lock() {
        Ok(mut map) => map.remove(session_id),
        Err(_) => None,
    };
    if let Some(session) = session {
        session.abort();
    }
}

fn finalize_session(
    sessions: &Mutex<HashMap<String, BundleSession>>,
    session_id: &str,
) -> AppResult<PathBuf> {
    let session = {
        let mut map = sessions.lock().map_err(|_| store_poisoned())?;
        map.remove(session_id)
            .ok_or_else(|| AppError::invalid_input("Unknown export session."))?
    };

    let BundleSession {
        writer,
        temp_path,
        target_path,
        used_names: _,
        created_at_ms: _,
    } = session;

    let outcome = (|| -> AppResult<PathBuf> {
        let file = writer.finish()?;
        file.sync_all()?;
        atomic_replace(&temp_path, &target_path)?;
        Ok(target_path.clone())
    })();

    if outcome.is_err() {
        let _ = fs::remove_file(&temp_path);
    }

    outcome
}

fn sanitize_entry_name(raw: &str, used: &mut HashSet<String>) -> AppResult<String> {
    if raw.is_empty() || raw.len() > MAX_ENTRY_NAME_INPUT_BYTES || raw.contains('\0') {
        return Err(AppError::invalid_input("Invalid archive entry name."));
    }

    let components: Vec<String> = raw
        .split(['/', '\\'])
        .map(sanitize_entry_component)
        .filter(|component| !component.is_empty())
        .collect();
    let Some((file_name, directories)) = components.split_last() else {
        return Err(AppError::invalid_input("Invalid archive entry name."));
    };
    let prefix: String = directories
        .iter()
        .map(|directory| format!("{directory}/"))
        .collect();

    let path = Path::new(file_name.as_str());
    let stem = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or(file_name.as_str());
    let extension = path.extension().and_then(|extension| extension.to_str());

    let mut candidate_name = format!("{prefix}{file_name}");
    let mut counter = 1_u32;
    loop {
        if used.insert(candidate_name.clone()) {
            return Ok(candidate_name);
        }
        counter += 1;
        if counter > 9_999 {
            return Err(AppError::conflict(
                "Archive entry name deduplication overflowed.",
            ));
        }
        candidate_name = match extension {
            Some(extension) => format!("{prefix}{stem} ({counter}).{extension}"),
            None => format!("{prefix}{stem} ({counter})"),
        };
    }
}

fn sanitize_entry_component(raw: &str) -> String {
    let cleaned: String = raw
        .chars()
        .filter(|character| {
            !character.is_control()
                && !matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
        .collect();
    let cleaned = truncate_utf8(cleaned.trim_matches([' ', '.']), MAX_ARCHIVE_ENTRY_NAME_BYTES);
    cleaned.trim_matches([' ', '.']).to_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    fn new_store() -> BundleSessionStore {
        BundleSessionStore::default()
    }

    fn begin_at(store: &BundleSessionStore, target: &Path) -> String {
        begin_session(&store.sessions, target).expect("session started")
    }

    #[test]
    fn begin_append_finalize_produces_readable_zip() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("chapter.cbz");
        let store = new_store();

        let session_id = begin_at(&store, &target);
        append_session_entry(&store.sessions, &session_id, "pages/001.png", b"first").unwrap();
        append_session_entry(&store.sessions, &session_id, "002.png", b"second").unwrap();
        let finalized = finalize_session(&store.sessions, &session_id).unwrap();

        assert_eq!(finalized, target);
        assert!(target.is_file());

        let file = File::open(&target).unwrap();
        let mut archive = zip::ZipArchive::new(file).unwrap();
        assert_eq!(archive.len(), 2);

        let mut first_bytes = Vec::new();
        {
            let mut first = archive.by_name("pages/001.png").unwrap();
            first.read_to_end(&mut first_bytes).unwrap();
        }
        assert_eq!(first_bytes, b"first");

        let mut second_bytes = Vec::new();
        {
            let mut second = archive.by_name("002.png").unwrap();
            second.read_to_end(&mut second_bytes).unwrap();
        }
        assert_eq!(second_bytes, b"second");
    }

    #[test]
    fn begin_session_rejects_saturated_store() {
        let temp = tempfile::tempdir().unwrap();
        let store = new_store();

        for index in 0..MAX_ACTIVE_EXPORT_SESSIONS {
            begin_at(&store, &temp.path().join(format!("out-{index}.zip")));
        }

        let error = begin_session(&store.sessions, &temp.path().join("overflow.zip"))
            .expect_err("saturated store rejects a new session");
        assert!(matches!(error, AppError::Conflict(_)));
    }

    #[test]
    fn begin_session_sweeps_expired_sessions_and_frees_capacity() {
        let temp = tempfile::tempdir().unwrap();
        let store = new_store();

        for index in 0..MAX_ACTIVE_EXPORT_SESSIONS {
            begin_at(&store, &temp.path().join(format!("stale-{index}.zip")));
        }

        {
            let mut map = store.sessions.lock().unwrap();
            for (_, session) in map.iter_mut() {
                session.created_at_ms = session
                    .created_at_ms
                    .saturating_sub(BUNDLE_SESSION_TTL_MS + 60_000);
            }
        }

        let fresh = begin_session(&store.sessions, &temp.path().join("fresh.zip"));
        assert!(fresh.is_ok(), "expired sessions are swept before the cap");

        {
            let map = store.sessions.lock().unwrap();
            assert!(map.contains_key(&fresh.unwrap()));
            assert_eq!(map.len(), 1);
        }
    }

    #[test]
    fn unknown_session_errors_cleanly() {
        let store = new_store();

        let error = append_session_entry(&store.sessions, "missing", "a.png", b"x")
            .expect_err("unknown append");
        assert!(matches!(error, AppError::InvalidInput(_)));

        let error = finalize_session(&store.sessions, "missing")
            .expect_err("unknown finalize");
        assert!(matches!(error, AppError::InvalidInput(_)));
    }

    #[test]
    fn append_failure_aborts_session_and_removes_temp_file() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("chapter.zip");
        let store = new_store();

        let session_id = begin_at(&store, &target);
        assert!(append_session_entry(&store.sessions, &session_id, "..", b"x").is_err());

        assert!(finalize_session(&store.sessions, &session_id).is_err());
        assert!(!target.exists());

        let leftovers = fs::read_dir(temp.path()).unwrap().count();
        assert_eq!(leftovers, 0);
    }

    #[test]
    fn sanitize_entry_name_keeps_folders_and_drops_traversal() {
        let mut used = HashSet::new();
        assert_eq!(
            sanitize_entry_name("../x.png", &mut used).unwrap(),
            "x.png"
        );
        assert_eq!(sanitize_entry_name("a/b.png", &mut used).unwrap(), "a/b.png");
        assert_eq!(
            sanitize_entry_name("texts\\raw\\001.txt", &mut used).unwrap(),
            "texts/raw/001.txt"
        );
        assert_eq!(
            sanitize_entry_name("/abs/./../c.png", &mut used).unwrap(),
            "abs/c.png"
        );
        assert_eq!(
            sanitize_entry_name("..\\y.png", &mut used).unwrap(),
            "y.png"
        );
    }

    #[test]
    fn sanitize_entry_name_dedupes_deterministically() {
        let mut used = HashSet::new();
        assert_eq!(sanitize_entry_name("page.png", &mut used).unwrap(), "page.png");
        assert_eq!(
            sanitize_entry_name("page.png", &mut used).unwrap(),
            "page (2).png"
        );
        assert_eq!(
            sanitize_entry_name("page.png", &mut used).unwrap(),
            "page (3).png"
        );
        assert_eq!(sanitize_entry_name("a/page.png", &mut used).unwrap(), "a/page.png");
        assert_eq!(
            sanitize_entry_name("a/page.png", &mut used).unwrap(),
            "a/page (2).png"
        );
    }

    #[test]
    fn sanitize_entry_name_rejects_empty_and_invalid_input() {
        let mut used = HashSet::new();
        assert!(sanitize_entry_name("", &mut used).is_err());
        assert!(sanitize_entry_name("..", &mut used).is_err());
        assert!(sanitize_entry_name("  .  ", &mut used).is_err());
        assert!(sanitize_entry_name("../..", &mut used).is_err());
        assert!(sanitize_entry_name("bad\0name.png", &mut used).is_err());
        assert!(sanitize_entry_name(&"x".repeat(MAX_ENTRY_NAME_INPUT_BYTES + 1), &mut used).is_err());
    }

    #[test]
    fn sanitize_entry_name_truncates_on_utf8_boundary() {
        let mut used = HashSet::new();
        let long = "é".repeat(150);
        let name = sanitize_entry_name(&long, &mut used).unwrap();
        assert!(name.len() <= MAX_ARCHIVE_ENTRY_NAME_BYTES);
        assert_eq!(name.chars().count(), MAX_ARCHIVE_ENTRY_NAME_BYTES / 2);
    }

    #[test]
    fn double_finalize_errors_and_session_is_gone() {
        let temp = tempfile::tempdir().unwrap();
        let target = temp.path().join("chapter.zip");
        let store = new_store();

        let session_id = begin_at(&store, &target);
        assert!(finalize_session(&store.sessions, &session_id).is_ok());
        let error = finalize_session(&store.sessions, &session_id)
            .expect_err("session already consumed");
        assert!(matches!(error, AppError::InvalidInput(_)));
    }

    #[test]
    fn aborted_temp_files_never_leak_between_sessions() {
        let temp = tempfile::tempdir().unwrap();
        let store = new_store();

        let first = begin_at(&store, &temp.path().join("a.zip"));
        let second = begin_at(&store, &temp.path().join("b.zip"));
        abort_session(&store.sessions, &first);

        append_session_entry(&store.sessions, &second, "x.png", b"1").unwrap();
        finalize_session(&store.sessions, &second).unwrap();

        assert!(temp.path().join("b.zip").is_file());
        assert!(!temp.path().join("a.zip").exists());
    }

    #[test]
    fn dialog_file_name_forces_the_selected_extension() {
        assert_eq!(
            dialog_file_name_for_extension("manga.zip", BundleExtension::Cbz),
            "manga.cbz"
        );
        assert_eq!(
            dialog_file_name_for_extension("manga", BundleExtension::Zip),
            "manga.zip"
        );
    }
}
