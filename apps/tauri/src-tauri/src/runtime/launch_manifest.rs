//! The runtime's own launch manifest: the contract the shell spawns against.
//!
//! The manifest is the first entry of the runtime payload and declares every
//! profile the build shipped. A tree without it is a partial extraction (an
//! interrupted install, a half-copied directory), and spawning it boots a
//! backend that dies on its first import.

use std::fs;
use std::path::{Path, PathBuf};

fn runtime_launch_manifest_declares_profile(install_dir: &Path, profile: &str) -> bool {
    let raw = match fs::read_to_string(install_dir.join("launch-manifest.json")) {
        Ok(raw) => raw,
        Err(_) => return false,
    };
    let value: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(_) => return false,
    };
    value
        .get("profiles")
        .and_then(|profiles| profiles.get(profile))
        .is_some()
}

/// The runtime binary to spawn, or `None` when the tree is not a complete
/// runtime for this profile.
pub(crate) fn resolve_spawnable_runtime_binary(
    install_dir: &Path,
    profile: &str,
    entry: &str,
) -> Option<PathBuf> {
    let binary_path = install_dir.join(entry);
    let usable = binary_path.is_file()
        && runtime_launch_manifest_declares_profile(install_dir, profile);
    usable.then_some(binary_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_missing_or_partial_manifest_never_declares_a_profile() {
        let dir = std::env::temp_dir().join(format!("koma-launch-manifest-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        assert!(!runtime_launch_manifest_declares_profile(&dir, "cpu"));

        fs::write(
            dir.join("launch-manifest.json"),
            r#"{"profiles":{"cpu":{"entry":"mini-backend.exe"}}}"#,
        )
        .unwrap();
        assert!(runtime_launch_manifest_declares_profile(&dir, "cpu"));
        assert!(!runtime_launch_manifest_declares_profile(&dir, "nvidia-cuda"));

        fs::write(dir.join("launch-manifest.json"), "{not json").unwrap();
        assert!(!runtime_launch_manifest_declares_profile(&dir, "cpu"));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn a_partial_tree_is_not_spawnable() {
        let dir = std::env::temp_dir().join(format!("koma-launch-spawn-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("mini-backend.exe"), "binary").unwrap();

        // The entry exists but the payload never landed.
        assert!(resolve_spawnable_runtime_binary(&dir, "cpu", "mini-backend.exe").is_none());

        fs::write(
            dir.join("launch-manifest.json"),
            r#"{"profiles":{"cpu":{"entry":"mini-backend.exe"}}}"#,
        )
        .unwrap();
        assert!(resolve_spawnable_runtime_binary(&dir, "cpu", "mini-backend.exe").is_some());
        assert!(resolve_spawnable_runtime_binary(&dir, "nvidia-cuda", "mini-backend.exe").is_none());

        let _ = fs::remove_dir_all(&dir);
    }
}
