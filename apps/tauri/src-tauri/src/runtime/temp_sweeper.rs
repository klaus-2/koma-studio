use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

const RUNTIME_TEMP_PREFIXES: [&str; 3] = [
    "koma-launch-",
    "koma-exec-bit-",
    "koma-runtime-downloads",
];

pub struct TempSweepReport {
    pub removed: Vec<PathBuf>,
    pub skipped: usize,
}

pub fn sweep_stale_runtime_temp(temp_root: &Path, min_age: Duration) -> TempSweepReport {
    let mut report = TempSweepReport {
        removed: Vec::new(),
        skipped: 0,
    };
    let Ok(entries) = fs::read_dir(temp_root) else {
        return report;
    };
    let now = SystemTime::now();
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|name| name.to_str()) else {
            continue;
        };
        if !RUNTIME_TEMP_PREFIXES
            .iter()
            .any(|prefix| name.starts_with(prefix))
        {
            continue;
        }
        if !entry_age_at_least(&path, min_age, now) {
            report.skipped += 1;
            continue;
        }
        let is_dir = fs::symlink_metadata(&path)
            .map(|metadata| metadata.is_dir())
            .unwrap_or(false);
        let removed = if is_dir {
            fs::remove_dir_all(&path).is_ok()
        } else {
            fs::remove_file(&path).is_ok()
        };
        if removed {
            report.removed.push(path);
        } else {
            report.skipped += 1;
        }
    }
    report
}

fn entry_age_at_least(path: &Path, min_age: Duration, now: SystemTime) -> bool {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return false;
    };
    match metadata.modified() {
        Ok(modified) => now
            .duration_since(modified)
            .map(|age| age >= min_age)
            .unwrap_or(false),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::SystemTime;

    fn write_file(path: &Path, body: &[u8]) {
        fs::write(path, body).expect("test file must be writable");
    }

    fn backdate_file(path: &Path, age: Duration) {
        let file = fs::OpenOptions::new()
            .append(true)
            .open(path)
            .expect("test file must be openable");
        let modified = SystemTime::now()
            .checked_sub(age)
            .expect("test age must be representable");
        file.set_times(fs::FileTimes::new().set_modified(modified))
            .expect("test file mtime must be settable");
    }

    #[test]
    fn aged_entries_at_the_fixed_24h_floor_are_removed_and_others_survive() {
        let temp = tempfile::tempdir().expect("tempdir must work");
        let root = temp.path();

        let aged_file = root.join("koma-launch-scratch-old.tmp");
        write_file(&aged_file, b"old");
        backdate_file(&aged_file, Duration::from_secs(25 * 3600));
        let fresh_file = root.join("koma-launch-scratch-new.tmp");
        write_file(&fresh_file, b"new");
        backdate_file(&fresh_file, Duration::from_secs(23 * 3600));
        let fresh_launch_dir = root.join("koma-launch-default-4242");
        fs::create_dir(&fresh_launch_dir).expect("dir must be created");
        let fresh_downloads_dir = root.join("koma-runtime-downloads");
        fs::create_dir(&fresh_downloads_dir).expect("dir must be created");
        let fresh_exec_dir = root.join("koma-exec-bit-777");
        fs::create_dir(&fresh_exec_dir).expect("dir must be created");
        let foreign_dir = root.join("other-tool-cache");
        fs::create_dir(&foreign_dir).expect("dir must be created");

        let report = sweep_stale_runtime_temp(root, Duration::from_secs(24 * 3600));

        assert_eq!(report.removed, vec![aged_file]);
        assert_eq!(report.skipped, 4);
        assert!(fresh_file.is_file());
        assert!(fresh_launch_dir.is_dir());
        assert!(fresh_downloads_dir.is_dir());
        assert!(fresh_exec_dir.is_dir());
        assert!(foreign_dir.is_dir());
    }

    #[test]
    fn zero_min_age_removes_every_qualified_entry_including_pid_suffixed_dirs() {
        let temp = tempfile::tempdir().expect("tempdir must work");
        let root = temp.path();

        let launch_dir = root.join("koma-launch-data-123");
        fs::create_dir(&launch_dir).expect("dir must be created");
        write_file(&launch_dir.join("payload.bin"), b"x");
        let exec_dir = root.join("koma-exec-bit-456");
        fs::create_dir(&exec_dir).expect("dir must be created");
        let downloads_dir = root.join("koma-runtime-downloads");
        fs::create_dir(&downloads_dir).expect("dir must be created");
        write_file(&downloads_dir.join("part-0"), b"y");
        let plain_file = root.join("koma-launch-orphan.tmp");
        write_file(&plain_file, b"z");
        let foreign_dir = root.join("unrelated-thing");
        fs::create_dir(&foreign_dir).expect("dir must be created");

        let report = sweep_stale_runtime_temp(root, Duration::ZERO);

        assert_eq!(report.removed.len(), 4);
        assert!(report.removed.contains(&launch_dir));
        assert!(report.removed.contains(&exec_dir));
        assert!(report.removed.contains(&downloads_dir));
        assert!(report.removed.contains(&plain_file));
        assert!(!launch_dir.exists());
        assert!(!exec_dir.exists());
        assert!(!downloads_dir.exists());
        assert!(foreign_dir.is_dir());
    }

    #[test]
    fn future_mtime_entries_are_skipped_even_at_zero_min_age() {
        let temp = tempfile::tempdir().expect("tempdir must work");
        let root = temp.path();

        let future_file = root.join("koma-launch-future.tmp");
        write_file(&future_file, b"future");
        let file = fs::OpenOptions::new()
            .append(true)
            .open(&future_file)
            .expect("test file must be openable");
        let later = SystemTime::now()
            .checked_add(Duration::from_secs(3600))
            .expect("future offset must be representable");
        file.set_times(fs::FileTimes::new().set_modified(later))
            .expect("test file mtime must be settable");

        let report = sweep_stale_runtime_temp(root, Duration::ZERO);

        assert!(report.removed.is_empty());
        assert_eq!(report.skipped, 1);
        assert!(future_file.is_file());
    }

    #[test]
    fn an_unreadable_temp_root_yields_an_empty_report() {
        let missing = std::env::temp_dir().join("koma-sweeper-missing-root-test");

        let report = sweep_stale_runtime_temp(&missing, Duration::ZERO);

        assert!(report.removed.is_empty());
        assert_eq!(report.skipped, 0);
    }
}
