//! The runtime's own launch manifest: the contract the shell spawns against.
//!
//! The manifest is the first entry of the runtime payload and declares every
//! profile the build shipped. A tree without it is a partial extraction (an
//! interrupted install, a half-copied directory), and spawning it boots a
//! backend that dies on its first import.
//!
//! The install is atomic (the parts extract into a staging directory that is
//! renamed into place), so a launch manifest in the tree means the whole
//! payload landed with it.

use std::fs;
use std::path::{Path, PathBuf};

fn read_launch_manifest(install_dir: &Path) -> Option<serde_json::Value> {
    let raw = fs::read_to_string(install_dir.join("launch-manifest.json")).ok()?;
    serde_json::from_str(&raw).ok()
}

/// Find a bundled file by its path suffix: the layout differs per platform
/// (`_internal/` on Windows and Linux, a bundle folder on macOS).
fn find_bundled_file(root: &Path, suffix: &str) -> Option<PathBuf> {
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if path.to_string_lossy().replace('\\', "/").ends_with(suffix) {
                return Some(path);
            }
        }
    }
    None
}

/// Whether the manifest declares the profile that was built.
///
/// The manifest lists every profile the build knows, so the map proves
/// nothing: the profile that was BUILT is the default one.
fn launch_manifest_declares_profile(manifest: &serde_json::Value, profile: &str) -> bool {
    match manifest.get("defaultProfile").and_then(|value| value.as_str()) {
        Some(default_profile) => default_profile == profile,
        None => manifest
            .get("profiles")
            .and_then(|profiles| profiles.get(profile))
            .is_some(),
    }
}

/// Whether the data files the build declared are in the tree.
///
/// A loader that reads one of them at import takes the whole backend down
/// when it is missing, so a runtime without them is not spawnable.
fn launch_manifest_data_files_present(manifest: &serde_json::Value, install_dir: &Path) -> bool {
    let Some(required) = manifest.get("requiredFiles").and_then(|value| value.as_array()) else {
        // A runtime built before the contract existed: nothing to check.
        return true;
    };
    required.iter().all(|entry| match entry.as_str() {
        Some(suffix) => find_bundled_file(install_dir, suffix).is_some(),
        None => false,
    })
}

/// The runtime binary to spawn, or `None` when the tree is not a complete
/// runtime for this profile.
pub(crate) fn resolve_spawnable_runtime_binary(
    install_dir: &Path,
    profile: &str,
    entry: &str,
) -> Option<PathBuf> {
    let binary_path = install_dir.join(entry);
    if !binary_path.is_file() {
        return None;
    }
    let manifest = read_launch_manifest(install_dir)?;
    if !launch_manifest_declares_profile(&manifest, profile) {
        return None;
    }
    if !launch_manifest_data_files_present(&manifest, install_dir) {
        return None;
    }
    Some(binary_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_manifest(dir: &Path, body: &str) {
        fs::write(dir.join("launch-manifest.json"), body).unwrap();
    }

    #[test]
    fn a_missing_or_partial_manifest_never_declares_a_profile() {
        let dir = std::env::temp_dir().join(format!("koma-launch-manifest-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        assert!(resolve_spawnable_runtime_binary(&dir, "cpu", "mini-backend.exe").is_none());

        write_manifest(&dir, "{not json");
        assert!(resolve_spawnable_runtime_binary(&dir, "cpu", "mini-backend.exe").is_none());

        write_manifest(&dir, "{}");
        assert!(resolve_spawnable_runtime_binary(&dir, "cpu", "mini-backend.exe").is_none());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn the_profile_that_was_built_is_the_one_the_manifest_names_as_default() {
        let dir = std::env::temp_dir().join(format!("koma-launch-default-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("mini-backend.exe"), "binary").unwrap();
        write_manifest(
            &dir,
            r#"{"defaultProfile":"cpu","profiles":{"cpu":{},"nvidia-cuda":{}}}"#,
        );

        // The manifest lists every profile the build knows; only the default
        // one proves which payload the tree holds.
        assert!(resolve_spawnable_runtime_binary(&dir, "cpu", "mini-backend.exe").is_some());
        assert!(resolve_spawnable_runtime_binary(&dir, "nvidia-cuda", "mini-backend.exe").is_none());

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_runtime_without_its_declared_data_files_is_not_spawnable() {
        let dir = std::env::temp_dir().join(format!("koma-launch-data-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("mini-backend.exe"), "binary").unwrap();
        write_manifest(
            &dir,
            r#"{"defaultProfile":"cpu","requiredFiles":["models/manifests/model-assets.json"]}"#,
        );

        assert!(resolve_spawnable_runtime_binary(&dir, "cpu", "mini-backend.exe").is_none());

        let data_dir = dir.join("_internal").join("models").join("manifests");
        fs::create_dir_all(&data_dir).unwrap();
        fs::write(data_dir.join("model-assets.json"), "{}").unwrap();
        assert!(resolve_spawnable_runtime_binary(&dir, "cpu", "mini-backend.exe").is_some());

        let _ = fs::remove_dir_all(&dir);
    }
}
