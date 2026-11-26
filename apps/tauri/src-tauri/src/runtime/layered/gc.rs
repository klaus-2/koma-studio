use std::{collections::HashSet, fs, path::Path};

use crate::runtime::profiles::RuntimeError;

#[derive(Debug, Default)]
pub struct LayeredGcReport {
    pub removed_dirs: Vec<String>,
}

fn remove_tmp_dirs(parent: &Path, report: &mut LayeredGcReport) {
    let Ok(entries) = fs::read_dir(parent) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if path.is_dir() && name_str.ends_with(".tmp") && fs::remove_dir_all(&path).is_ok() {
            report
                .removed_dirs
                .push(path.to_string_lossy().into_owned());
        }
    }
}

pub fn sweep_layered_runtimes(
    runtimes_root: &Path,
    keep_engine: Option<(&str, &str, &str)>,
    keep_overlays: &[String],
) -> Result<LayeredGcReport, RuntimeError> {
    let mut report = LayeredGcReport::default();

    let engines_root = runtimes_root.join("engines");
    remove_tmp_dirs(&engines_root, &mut report);
    if let Some((keep_abi, keep_version, keep_profile)) = keep_engine {
        let keep_version_dir = format!("{keep_abi}-{keep_version}");
        if let Ok(version_entries) = fs::read_dir(&engines_root) {
            for version_entry in version_entries.flatten() {
                let version_path = version_entry.path();
                if !version_path.is_dir() {
                    continue;
                }
                let version_name = version_entry.file_name().to_string_lossy().into_owned();
                if version_name != keep_version_dir {
                    if fs::remove_dir_all(&version_path).is_ok() {
                        report
                            .removed_dirs
                            .push(version_path.to_string_lossy().into_owned());
                    }
                    continue;
                }
                remove_tmp_dirs(&version_path, &mut report);
                if let Ok(profile_entries) = fs::read_dir(&version_path) {
                    for profile_entry in profile_entries.flatten() {
                        let profile_path = profile_entry.path();
                        let profile_name = profile_entry.file_name().to_string_lossy().into_owned();
                        if profile_path.is_dir()
                            && profile_name != keep_profile
                            && fs::remove_dir_all(&profile_path).is_ok()
                        {
                            report
                                .removed_dirs
                                .push(profile_path.to_string_lossy().into_owned());
                        }
                    }
                }
            }
        }

        if let Ok(root_entries) = fs::read_dir(runtimes_root) {
            for entry in root_entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().into_owned();
                if path.is_dir()
                    && name != "engines"
                    && name != "overlays"
                    && (name.starts_with("1.") || name.ends_with(".tmp"))
                    && fs::remove_dir_all(&path).is_ok()
                {
                    report
                        .removed_dirs
                        .push(path.to_string_lossy().into_owned());
                }
            }
        }
    }

    let overlays_root = runtimes_root.join("overlays");
    remove_tmp_dirs(&overlays_root, &mut report);
    let keep_set: HashSet<&str> = keep_overlays
        .iter()
        .map(String::as_str)
        .filter(|value| !value.trim().is_empty())
        .collect();
    if !keep_set.is_empty() {
        if let Ok(overlay_entries) = fs::read_dir(&overlays_root) {
            for entry in overlay_entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().into_owned();
                if path.is_dir()
                    && !keep_set.contains(name.as_str())
                    && fs::remove_dir_all(&path).is_ok()
                {
                    report
                        .removed_dirs
                        .push(path.to_string_lossy().into_owned());
                }
            }
        }
    }

    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sweeps_stale_tmp_old_overlays_and_legacy_dirs_preserving_active() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();

        let active_engine = root.join("engines/v1-1.0.0/nvidia-cuda");
        let old_engine = root.join("engines/v1-0.9.0/cpu");
        let stale_engine_tmp = root.join("engines/v1-1.0.0/nvidia-cuda.tmp");
        let active_overlay = root.join("overlays/aaaa1111");
        let bundled_overlay = root.join("overlays/bbbb2222");
        let old_overlay = root.join("overlays/cccc3333");
        let legacy_pyinstaller = root.join("1.3.1/nvidia-cuda");

        for dir in [
            &active_engine,
            &old_engine,
            &stale_engine_tmp,
            &active_overlay,
            &bundled_overlay,
            &old_overlay,
            &legacy_pyinstaller,
        ] {
            fs::create_dir_all(dir).unwrap();
        }

        let report = sweep_layered_runtimes(
            root,
            Some(("v1", "1.0.0", "nvidia-cuda")),
            &["aaaa1111".to_string(), "bbbb2222".to_string()],
        )
        .unwrap();

        assert!(active_engine.exists());
        assert!(active_overlay.exists());
        assert!(bundled_overlay.exists());
        assert!(!old_engine.exists());
        assert!(!stale_engine_tmp.exists());
        assert!(!old_overlay.exists());
        assert!(!root.join("1.3.1").exists());
        assert!(!report.removed_dirs.is_empty());
    }
}
