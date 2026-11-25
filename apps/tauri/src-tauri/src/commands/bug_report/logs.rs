use std::{collections::HashSet, ffi::OsStr, fs, path::Path, time::SystemTime};

use tauri::{AppHandle, Manager, Runtime};

use crate::commands::api::client::stable_hash;

use super::types::{
    ALLOWED_LOG_EXTENSIONS, AutoLogFile, BugReportLogEntry, LogSource, MAX_AUTO_LOG_FILE_BYTES,
    MAX_AUTO_LOG_FILES, MAX_LOG_ITEM_BYTES, MAX_LOG_ITEMS, MAX_LOGS_TOTAL_BYTES,
};

pub(super) fn discovered_logs<R: Runtime>(
    app: &AppHandle<R>,
    selected_ids: Option<&[String]>,
) -> Vec<AutoLogFile> {
    let files = collect_auto_logs(app);
    match selected_ids {
        None | Some(&[]) => files,
        Some(ids) => {
            let selected: HashSet<&str> = ids.iter().map(String::as_str).collect();
            files
                .into_iter()
                .filter(|file| selected.contains(file.id.as_str()))
                .collect()
        }
    }
}

pub(super) fn collect_log_entries(files: Vec<AutoLogFile>) -> Vec<BugReportLogEntry> {
    build_log_entries(
        files,
        MAX_LOG_ITEMS,
        MAX_LOG_ITEM_BYTES,
        MAX_LOGS_TOTAL_BYTES,
    )
}

pub(super) fn build_log_entries(
    files: Vec<AutoLogFile>,
    max_items: usize,
    item_cap: usize,
    total_cap: usize,
) -> Vec<BugReportLogEntry> {
    let mut entries = Vec::new();
    let mut total = 0usize;
    for file in files {
        if entries.len() >= max_items || total >= total_cap {
            break;
        }
        let bytes = match fs::read(&file.path) {
            Ok(bytes) => bytes,
            Err(error) => {
                log::warn!(
                    "bug-report: skipping unreadable log {}: {error}",
                    file.path.display()
                );
                continue;
            }
        };
        let cap = item_cap.min(total_cap - total);
        let content = tail_truncate_lossy(&bytes, cap);
        total += content.len();
        entries.push(BugReportLogEntry {
            name: file.name,
            content,
        });
    }
    entries
}

pub(super) fn collect_auto_logs<R: Runtime>(app: &AppHandle<R>) -> Vec<AutoLogFile> {
    let resolver = app.path();
    let roots = [
        resolver.app_log_dir().ok().map(|dir| (dir, LogSource::App)),
        resolver
            .app_data_dir()
            .ok()
            .map(|dir| (dir.join("logs"), LogSource::Runtime)),
    ];

    let mut files = Vec::new();
    for (root, source) in roots.into_iter().flatten() {
        collect_logs_from_dir(&root, source, &mut files);
    }
    files.sort_by_key(|file| std::cmp::Reverse(file.modified));
    files.truncate(MAX_AUTO_LOG_FILES);
    files
}

pub(super) fn collect_logs_from_dir(
    root: &Path,
    default_source: LogSource,
    files: &mut Vec<AutoLogFile>,
) {
    let entries = match fs::read_dir(root) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => {
            log::warn!(
                "bug-report: cannot list log directory {}: {error}",
                root.display()
            );
            return;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !is_allowed_log_file(&path) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if !metadata.is_file() || metadata.len() > MAX_AUTO_LOG_FILE_BYTES {
            continue;
        }
        let Some(name) = path.file_name().and_then(OsStr::to_str) else {
            continue;
        };
        let source = if name.to_ascii_lowercase().contains("runtime") {
            LogSource::Runtime
        } else {
            default_source
        };
        files.push(AutoLogFile {
            id: stable_hash("bug-report-log", &path.to_string_lossy()),
            name: name.to_owned(),
            size: metadata.len(),
            source,
            modified: metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH),
            path,
        });
    }
}

fn is_allowed_log_file(path: &Path) -> bool {
    path.extension()
        .and_then(OsStr::to_str)
        .is_some_and(|extension| {
            ALLOWED_LOG_EXTENSIONS
                .iter()
                .any(|allowed| allowed.eq_ignore_ascii_case(extension))
        })
}

pub(super) fn tail_truncate_lossy(bytes: &[u8], max_bytes: usize) -> String {
    if bytes.len() <= max_bytes {
        return String::from_utf8_lossy(bytes).into_owned();
    }
    let start = bytes.len() - max_bytes;
    let start = (start..bytes.len())
        .find(|&index| bytes[index] & 0xC0 != 0x80)
        .unwrap_or(bytes.len());
    String::from_utf8_lossy(&bytes[start..]).into_owned()
}
