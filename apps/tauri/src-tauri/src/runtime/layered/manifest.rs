use std::{
    collections::HashMap,
    fs,
    path::{Component, Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime};

use crate::runtime::manifest_trust::validate_manifest_relative_path;
use crate::runtime::profiles::{RuntimeError, sanitize_profile};

pub(crate) const LAYERED_STATE_FILE_NAME: &str = "layered-state.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LayeredArtifactPart {
    pub file: String,
    pub url: String,
    #[serde(default)]
    pub sha256: String,
    #[serde(default)]
    pub sha512: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LayeredOverlayDescriptor {
    pub overlay_hash: String,
    pub app_version: String,
    pub file: String,
    pub url: String,
    pub sha256: String,
    #[serde(default)]
    pub sha512: String,
    pub size: u64,
    pub entry: String,
    #[serde(default)]
    pub required_files: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LayeredEngineProfileRecord {
    pub profile: String,
    pub engine_abi: String,
    pub engine_version: String,
    pub platform: String,
    pub arch: String,
    pub python_entry: String,
    pub parts: Vec<LayeredArtifactPart>,
}

impl LayeredEngineProfileRecord {
    pub fn total_part_bytes(&self) -> u64 {
        self.parts.iter().map(|part| part.size).sum()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LayeredRuntimeManifest {
    pub schema_version: u8,
    pub engine_abi: String,
    pub engine_version: String,
    pub generated_at: String,
    pub platform: String,
    pub arch: String,
    pub default_profile: String,
    pub overlay: LayeredOverlayDescriptor,
    pub profiles: HashMap<String, LayeredEngineProfileRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LayeredStateLedger {
    pub schema_version: u8,
    pub active_profile: String,
    pub engine_abi: String,
    pub engine_version: String,
    pub python_entry: String,
    pub active_overlay_hash: String,
    pub updated_at: u64,
}

pub fn runtimes_root_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, RuntimeError> {
    Ok(app.path().app_data_dir()?.join("mini-backend-runtimes"))
}

pub fn layered_state_path(runtimes_root: &Path) -> PathBuf {
    runtimes_root.join(LAYERED_STATE_FILE_NAME)
}

pub fn engine_install_dir(
    runtimes_root: &Path,
    engine_abi: &str,
    engine_version: &str,
    profile: &str,
) -> Result<PathBuf, RuntimeError> {
    validate_manifest_relative_path(engine_abi)?;
    validate_manifest_relative_path(engine_version)?;
    validate_manifest_relative_path(profile)?;
    Ok(runtimes_root
        .join("engines")
        .join(format!("{engine_abi}-{engine_version}"))
        .join(sanitize_profile(profile)))
}

pub fn overlay_install_dir(
    runtimes_root: &Path,
    overlay_hash: &str,
) -> Result<PathBuf, RuntimeError> {
    validate_manifest_relative_path(overlay_hash)?;
    Ok(runtimes_root.join("overlays").join(overlay_hash))
}

pub fn validate_safe_subpath(raw: &str) -> Result<PathBuf, RuntimeError> {
    let trimmed = raw.trim();
    if trimmed.is_empty()
        || trimmed != raw
        || raw.len() > 240
        || raw.starts_with('/')
        || raw.starts_with('\\')
        || raw.contains('\\')
        || raw.contains(':')
        || raw.chars().any(char::is_control)
    {
        return Err(RuntimeError::Integrity(format!(
            "unsafe relative path in runtime manifest: {raw:?}"
        )));
    }
    let mut clean = PathBuf::new();
    for component in Path::new(trimmed).components() {
        match component {
            Component::Normal(part) => {
                let s = part.to_string_lossy();
                if s.ends_with('.') || s.ends_with(' ') || s == ".." {
                    return Err(RuntimeError::Integrity(format!(
                        "unsafe path segment in runtime manifest: {raw:?}"
                    )));
                }
                clean.push(part);
            }
            _ => {
                return Err(RuntimeError::Integrity(format!(
                    "unsafe path component in runtime manifest: {raw:?}"
                )));
            }
        }
    }
    if clean.as_os_str().is_empty() {
        return Err(RuntimeError::Integrity(format!(
            "empty relative path in runtime manifest: {raw:?}"
        )));
    }
    Ok(clean)
}

pub fn resolve_layered_manifest_url(
    raw_url: Option<&str>,
    platform: &str,
    arch: &str,
) -> Option<String> {
    let trimmed = raw_url?.trim();
    if trimmed.is_empty() {
        return None;
    }
    let file_name = format!("koma-runtime-{platform}-{arch}.json");
    if trimmed.to_ascii_lowercase().ends_with(".json") {
        let lower = trimmed.to_ascii_lowercase();
        if lower.contains("koma-runtime-") {
            return Some(trimmed.to_string());
        }
        let v2_name = format!("mini-backend-latest-{platform}-{arch}.json");
        if trimmed.ends_with(&v2_name) {
            return Some(trimmed.replacen(&v2_name, &file_name, 1));
        }
        return None;
    }
    let base = if trimmed.ends_with('/') {
        trimmed.to_string()
    } else {
        format!("{trimmed}/")
    };
    Some(format!("{base}{file_name}"))
}

pub fn ensure_manifest_schema_v3(manifest: &LayeredRuntimeManifest) -> Result<(), RuntimeError> {
    if manifest.schema_version != 3 {
        return Err(RuntimeError::Integrity(format!(
            "unsupported layered runtime manifest schemaVersion {}",
            manifest.schema_version
        )));
    }
    validate_manifest_relative_path(&manifest.engine_abi)?;
    validate_manifest_relative_path(&manifest.engine_version)?;
    validate_manifest_relative_path(&manifest.overlay.overlay_hash)?;
    validate_safe_subpath(&manifest.overlay.entry)?;
    Ok(())
}

pub fn read_layered_state(
    runtimes_root: &Path,
) -> Result<Option<LayeredStateLedger>, RuntimeError> {
    let path = layered_state_path(runtimes_root);
    if !path.is_file() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&path)?;
    let parsed: LayeredStateLedger = match serde_json::from_str(&raw) {
        Ok(value) => value,
        Err(error) => {
            tracing::warn!("layered-state.json unreadable, ignoring: {error}");
            return Ok(None);
        }
    };
    if parsed.schema_version != 3
        || parsed.active_profile.trim().is_empty()
        || parsed.engine_abi.trim().is_empty()
        || parsed.engine_version.trim().is_empty()
        || parsed.python_entry.trim().is_empty()
        || parsed.active_overlay_hash.trim().is_empty()
    {
        return Ok(None);
    }
    Ok(Some(parsed))
}

pub fn write_layered_state(
    runtimes_root: &Path,
    ledger: &LayeredStateLedger,
) -> Result<(), RuntimeError> {
    fs::create_dir_all(runtimes_root)?;
    let path = layered_state_path(runtimes_root);
    let tmp_path = runtimes_root.join(format!("{LAYERED_STATE_FILE_NAME}.tmp"));
    let raw = serde_json::to_string_pretty(ledger)?;
    fs::write(&tmp_path, format!("{raw}\n"))?;
    if path.exists() {
        let _ = fs::remove_file(&path);
    }
    fs::rename(&tmp_path, &path)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_layered_manifest_url_from_directory_or_v2_sibling() {
        assert_eq!(
            resolve_layered_manifest_url(
                Some("https://github.com/klaus-2/koma-studio/releases/latest/download"),
                "win32",
                "x64"
            ),
            Some(
                "https://github.com/klaus-2/koma-studio/releases/latest/download/koma-runtime-win32-x64.json"
                    .to_string()
            )
        );
        assert_eq!(
            resolve_layered_manifest_url(
                Some("https://example.com/mini-backend-latest-linux-x64.json"),
                "linux",
                "x64"
            ),
            Some("https://example.com/koma-runtime-linux-x64.json".to_string())
        );
    }

    #[test]
    fn safe_subpath_allows_nested_python_entry_and_blocks_traversal() {
        assert_eq!(
            validate_safe_subpath("bin/python3.12").unwrap(),
            PathBuf::from("bin/python3.12")
        );
        assert!(validate_safe_subpath("../python.exe").is_err());
        assert!(validate_safe_subpath("/usr/bin/python3").is_err());
        assert!(validate_safe_subpath("C:\\evil.exe").is_err());
    }
}
