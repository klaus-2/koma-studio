use std::{
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::runtime::manifest_trust::{ensure_runtime_archive_url, validate_manifest_relative_path};
use crate::runtime::profiles::RuntimeError;

use super::manifest::{LayeredOverlayDescriptor, overlay_install_dir, validate_safe_subpath};
use super::tar_zst::{extract_tar_zst_file, sha256_hex_file};

pub const BUNDLED_OVERLAY_ARCHIVE_NAME: &str = "koma-backend-overlay.tar.zst";
pub const BUNDLED_OVERLAY_META_NAME: &str = "koma-backend-overlay.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BundledOverlayMetadata {
    pub schema_version: u8,
    pub overlay_hash: String,
    #[serde(default)]
    pub content_sha256: String,
    #[serde(default)]
    pub app_version: String,
    #[serde(default)]
    pub engine_abi: String,
    #[serde(default)]
    pub file: String,
    pub sha256: String,
    #[serde(default)]
    pub size: u64,
    pub entry: String,
    #[serde(default)]
    pub required_files: Vec<String>,
}

pub fn find_bundled_overlay_pair<R: Runtime>(app: &AppHandle<R>) -> Option<(PathBuf, PathBuf)> {
    let mut candidates = Vec::new();
    if let Ok(res_dir) = app.path().resource_dir() {
        candidates.push(res_dir.join("resources"));
        candidates.push(res_dir);
    }
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("resources"));
        candidates.push(cwd.join("src-tauri").join("resources"));
    }
    for dir in candidates {
        let meta = dir.join(BUNDLED_OVERLAY_META_NAME);
        let archive = dir.join(BUNDLED_OVERLAY_ARCHIVE_NAME);
        if meta.is_file() && archive.is_file() {
            return Some((meta, archive));
        }
    }
    None
}

pub fn read_bundled_overlay_metadata<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<(BundledOverlayMetadata, PathBuf)>, RuntimeError> {
    let Some((meta_path, archive_path)) = find_bundled_overlay_pair(app) else {
        return Ok(None);
    };
    let raw = fs::read_to_string(&meta_path)?;
    let metadata: BundledOverlayMetadata = serde_json::from_str(&raw)?;
    validate_manifest_relative_path(&metadata.overlay_hash)?;
    validate_safe_subpath(&metadata.entry)?;
    Ok(Some((metadata, archive_path)))
}

pub fn is_overlay_dir_valid(overlay_dir: &Path, entry: &str, required_files: &[String]) -> bool {
    let Ok(entry_rel) = validate_safe_subpath(entry) else {
        return false;
    };
    if !overlay_dir.join(entry_rel).is_file()
        || !overlay_dir.join("overlay-manifest.json").is_file()
    {
        return false;
    }
    if required_files.is_empty() {
        return overlay_dir
            .join("models/manifests/model-assets.json")
            .is_file();
    }
    required_files.iter().all(|rel| {
        validate_safe_subpath(rel)
            .map(|clean| overlay_dir.join(clean).is_file())
            .unwrap_or(false)
    })
}

pub fn extract_verified_overlay_atomic(
    archive_path: &Path,
    expected_sha256: &str,
    runtimes_root: &Path,
    overlay_hash: &str,
    entry: &str,
    required_files: &[String],
) -> Result<PathBuf, RuntimeError> {
    validate_manifest_relative_path(overlay_hash)?;
    validate_safe_subpath(entry)?;
    let target_dir = overlay_install_dir(runtimes_root, overlay_hash)?;
    if is_overlay_dir_valid(&target_dir, entry, required_files) {
        return Ok(target_dir);
    }

    if !expected_sha256.trim().is_empty() {
        let actual_sha256 = sha256_hex_file(archive_path)?;
        if !actual_sha256.eq_ignore_ascii_case(expected_sha256.trim()) {
            return Err(RuntimeError::Integrity(format!(
                "backend overlay sha256 mismatch: expected {expected_sha256}, got {actual_sha256}"
            )));
        }
    }

    let tmp_dir = PathBuf::from(format!("{}.tmp", target_dir.to_string_lossy()));
    if tmp_dir.exists() {
        let _ = fs::remove_dir_all(&tmp_dir);
    }
    extract_tar_zst_file(archive_path, &tmp_dir)?;
    if !is_overlay_dir_valid(&tmp_dir, entry, required_files) {
        let _ = fs::remove_dir_all(&tmp_dir);
        return Err(RuntimeError::Integrity(format!(
            "extracted backend overlay {overlay_hash} is missing required runtime files"
        )));
    }
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir)?;
    }
    fs::rename(&tmp_dir, &target_dir)?;
    Ok(target_dir)
}

pub fn ensure_bundled_overlay_seeded<R: Runtime>(
    app: &AppHandle<R>,
    runtimes_root: &Path,
) -> Result<Option<String>, RuntimeError> {
    let Some((metadata, archive_path)) = read_bundled_overlay_metadata(app)? else {
        return Ok(None);
    };
    extract_verified_overlay_atomic(
        &archive_path,
        &metadata.sha256,
        runtimes_root,
        &metadata.overlay_hash,
        &metadata.entry,
        &metadata.required_files,
    )?;
    Ok(Some(metadata.overlay_hash))
}

pub fn verify_overlay_download_url(
    manifest_url: &str,
    overlay: &LayeredOverlayDescriptor,
) -> Result<(), RuntimeError> {
    validate_manifest_relative_path(&overlay.overlay_hash)?;
    validate_manifest_relative_path(&overlay.file)?;
    validate_safe_subpath(&overlay.entry)?;
    ensure_runtime_archive_url(manifest_url, &overlay.url)
}
