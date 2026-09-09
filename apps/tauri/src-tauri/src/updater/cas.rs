use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime};

use super::manifest::{normalize_hash_hex, verify_hash, IncrementalUpdateManifest};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CasWriteReport {
    pub hash: String,
    pub path: String,
    pub bytes: u64,
    pub already_present: bool,
}

#[derive(Debug, Clone)]
pub struct CasStore {
    root: PathBuf,
}

impl CasStore {
    pub fn from_app<R: Runtime>(app: &AppHandle<R>) -> Result<Self, String> {
        let app_data = app
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?;
        Ok(Self::new(app_data.join("cas")))
    }

    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    pub fn manifest_path(&self) -> PathBuf {
        self.root.join("manifest.json")
    }

    pub fn previous_manifest_path(&self) -> PathBuf {
        self.root.join("manifest.previous.json")
    }

    pub fn staged_manifest_path(&self) -> PathBuf {
        self.root.join(".staging").join("manifest.next.json")
    }

    pub fn chunk_path(&self, hash: &str, extension: Option<&str>) -> Result<PathBuf, String> {
        let hash = normalize_hash_hex(hash)?;
        let extension = extension
            .and_then(|value| value.trim().strip_prefix('.').or(Some(value.trim())))
            .filter(|value| {
                !value.is_empty()
                    && value
                        .chars()
                        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_'))
            })
            .unwrap_or("bin");
        Ok(self.root.join(&hash).join(format!("{hash}.{extension}")))
    }

    pub fn put_verified(
        &self,
        expected_hash: &str,
        extension: Option<&str>,
        bytes: &[u8],
    ) -> Result<CasWriteReport, String> {
        let hash = verify_hash(bytes, expected_hash)?;
        let final_path = self.chunk_path(&hash, extension)?;
        if final_path.exists() {
            return Ok(CasWriteReport {
                hash,
                path: final_path.to_string_lossy().to_string(),
                bytes: bytes.len() as u64,
                already_present: true,
            });
        }

        let parent = final_path
            .parent()
            .ok_or_else(|| "CAS final path sem parent".to_string())?;
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        let staging_dir = self.root.join(".staging");
        fs::create_dir_all(&staging_dir).map_err(|error| error.to_string())?;
        let staging_path = staging_dir.join(format!("{hash}.part"));
        fs::write(&staging_path, bytes).map_err(|error| error.to_string())?;
        fs::rename(&staging_path, &final_path).map_err(|error| error.to_string())?;

        Ok(CasWriteReport {
            hash,
            path: final_path.to_string_lossy().to_string(),
            bytes: bytes.len() as u64,
            already_present: false,
        })
    }

    pub fn write_staged_manifest(
        &self,
        manifest: &IncrementalUpdateManifest,
    ) -> Result<PathBuf, String> {
        let path = self.staged_manifest_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let bytes = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
        fs::write(&path, bytes).map_err(|error| error.to_string())?;
        Ok(path)
    }

    pub fn read_manifest(&self) -> Result<Option<IncrementalUpdateManifest>, String> {
        let path = self.manifest_path();
        if !path.exists() {
            return Ok(None);
        }
        let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw)
            .map(Some)
            .map_err(|error| error.to_string())
    }

    pub fn apply_staged_manifest(&self) -> Result<IncrementalUpdateManifest, String> {
        let staged = self.staged_manifest_path();
        if !staged.exists() {
            return Err("manifest incremental staged inexistente".to_string());
        }
        fs::create_dir_all(&self.root).map_err(|error| error.to_string())?;
        let current = self.manifest_path();
        let previous = self.previous_manifest_path();
        if current.exists() {
            let _ = fs::copy(&current, &previous).map_err(|error| error.to_string())?;
        }
        fs::rename(&staged, &current).map_err(|error| error.to_string())?;
        let raw = fs::read_to_string(current).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    pub fn rollback_manifest(&self) -> Result<IncrementalUpdateManifest, String> {
        let previous = self.previous_manifest_path();
        if !previous.exists() {
            return Err("manifest.previous.json inexistente".to_string());
        }
        let current = self.manifest_path();
        fs::rename(&previous, &current).map_err(|error| error.to_string())?;
        let raw = fs::read_to_string(current).map_err(|error| error.to_string())?;
        serde_json::from_str(&raw).map_err(|error| error.to_string())
    }

    pub fn resolve_chunk_for_request(&self, request_path: &str) -> Result<PathBuf, String> {
        let file = request_path
            .trim_start_matches('/')
            .strip_prefix("chunks/")
            .ok_or_else(|| "rota CAS invalida".to_string())?;
        let (hash, extension) = split_hash_extension(file)?;
        self.chunk_path(hash, extension)
    }

    pub fn gc_unreferenced(&self, retain_hashes: &[String]) -> Result<usize, String> {
        if !self.root.exists() {
            return Ok(0);
        }
        let retain = retain_hashes
            .iter()
            .map(|hash| normalize_hash_hex(hash))
            .collect::<Result<Vec<_>, _>>()?;
        let mut removed = 0usize;
        for entry in fs::read_dir(&self.root).map_err(|error| error.to_string())? {
            let path = entry.map_err(|error| error.to_string())?.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if name.starts_with('.') || retain.iter().any(|hash| hash == name) {
                continue;
            }
            fs::remove_dir_all(path).map_err(|error| error.to_string())?;
            removed += 1;
        }
        Ok(removed)
    }
}

pub fn extension_from_name(name: &str) -> Option<&str> {
    Path::new(name).extension().and_then(|value| value.to_str())
}

fn split_hash_extension(file: &str) -> Result<(&str, Option<&str>), String> {
    let file_name = Path::new(file)
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid chunk name".to_string())?;
    let (hash, ext) = file_name
        .split_once('.')
        .map(|(hash, ext)| (hash, Some(ext)))
        .unwrap_or((file_name, None));
    let _ = normalize_hash_hex(hash)?;
    Ok((hash, ext))
}

#[cfg(test)]
mod tests {
    use super::super::manifest::integrity_for_bytes;
    use super::*;

    #[test]
    fn stores_verified_chunk_under_hash_directory() {
        let temp = tempfile::tempdir().unwrap();
        let store = CasStore::new(temp.path().join("cas"));
        let bytes = b"chunk";
        let report = store
            .put_verified(&integrity_for_bytes(bytes), Some("js"), bytes)
            .unwrap();
        assert!(PathBuf::from(&report.path).exists());
        assert!(PathBuf::from(&report.path)
            .parent()
            .unwrap()
            .ends_with(std::path::Path::new(&report.hash)));
        assert!(!report.already_present);
        let second = store
            .put_verified(&integrity_for_bytes(bytes), Some("js"), bytes)
            .unwrap();
        assert!(second.already_present);
    }
}
