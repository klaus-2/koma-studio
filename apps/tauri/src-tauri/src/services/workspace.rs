//! Workspace `.koma` package read/write over in-memory buffers (the wire
//! contract shared with the Electron shell), with archive hardening: entry
//! count, per-asset and total size caps, compression-ratio checks and
//! normalize-then-verify of every path.

use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
};

use sha2::{Digest, Sha256};
use uuid::Uuid;
use zip::{
    CompressionMethod, ZipArchive, ZipWriter,
    write::SimpleFileOptions,
};

use crate::{
    error::{AppError, AppResult},
    models::workspace::{
        WorkspaceAssetManifestEntry, WorkspaceBinaryAssetPayload,
        WorkspacePackageManifestV1, WorkspacePackagePayload,
    },
};

pub const WORKSPACE_FILE_EXTENSION: &str = "koma";
pub const WORKSPACE_AUTOSAVE_FILE_BASENAME: &str = "autosave";

const MANIFEST_PATH: &str = "manifest.json";
const MAX_MANIFEST_BYTES: u64 = 8 * 1024 * 1024;
const MAX_ASSET_BYTES: u64 = 512 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const MAX_ASSETS: usize = 10_000;
const MAX_COMPRESSION_RATIO: u64 = 500;

#[derive(Debug)]
pub struct LoadedWorkspace {
    pub manifest: WorkspacePackageManifestV1,
    pub assets: Vec<WorkspaceBinaryAssetPayload>,
}pub fn sanitize_workspace_user_id(value: Option<&str>) -> String {
    value
        .unwrap_or_default()
        .trim()
        .chars()
        .filter(|character| !character.is_control())
        .take(256)
        .collect()
}

pub fn workspace_autosave_path(storage_dir: &Path, user_id: Option<&str>) -> PathBuf {
    let normalized = sanitize_workspace_user_id(user_id);
    let key = if normalized.is_empty() {
        "guest"
    } else {
        normalized.as_str()
    };
    let digest = Sha256::digest(key.as_bytes());

    storage_dir.join(format!(
        "{WORKSPACE_AUTOSAVE_FILE_BASENAME}.{}.{WORKSPACE_FILE_EXTENSION}",
        hex::encode(digest)
    ))
}

fn validate_manifest_entries(manifest: &WorkspacePackageManifestV1) -> AppResult<()> {
    if manifest.assets.len() > MAX_ASSETS {
        return Err(AppError::invalid_input("Workspace contains too many assets."));
    }

    let mut ids = HashSet::with_capacity(manifest.assets.len());
    let mut paths = HashSet::with_capacity(manifest.assets.len());
    let mut total = 0_u64;

    for entry in &manifest.assets {
        if entry.id.is_empty() || entry.id.len() > 128 {
            return Err(AppError::invalid_input("Invalid workspace asset ID."));
        }
        if !ids.insert(entry.id.as_str()) {
            return Err(AppError::invalid_input(
                "Workspace contains duplicated asset IDs.",
            ));
        }
        let path = normalize_asset_path(&entry.path)?;
        if !paths.insert(path) {
            return Err(AppError::invalid_input(
                "Workspace contains duplicated asset paths.",
            ));
        }
        validate_file_name(&entry.file_name)?;
        validate_mime_type(&entry.mime_type)?;
        if entry.byte_length > MAX_ASSET_BYTES {
            return Err(AppError::invalid_input(
                "Workspace contains an oversized asset.",
            ));
        }
        total = total
            .checked_add(entry.byte_length)
            .ok_or_else(|| AppError::invalid_input("Workspace size overflow."))?;
        if total > MAX_TOTAL_UNCOMPRESSED_BYTES {
            return Err(AppError::invalid_input(
                "Workspace exceeds the supported total size.",
            ));
        }
    }

    Ok(())
}

fn validate_package(payload: &WorkspacePackagePayload) -> AppResult<()> {
    let manifest = &payload.manifest;
    if manifest.package_version != 1 || manifest.document_version != 1 {
        return Err(AppError::Archive(
            "This workspace is not compatible with this application version.".to_string(),
        ));
    }

    if manifest.assets.len() != payload.assets.len() {
        return Err(AppError::invalid_input(
            "Workspace manifest and asset list have different lengths.",
        ));
    }

    validate_manifest_entries(manifest)?;

    let mut by_id: HashMap<&str, &WorkspaceBinaryAssetPayload> =
        HashMap::with_capacity(payload.assets.len());
    for asset in &payload.assets {
        if by_id.insert(asset.id.as_str(), asset).is_some() {
            return Err(AppError::invalid_input(
                "Workspace contains duplicated asset IDs.",
            ));
        }
    }

    for entry in &manifest.assets {
        let asset = by_id.get(entry.id.as_str()).ok_or_else(|| {
            AppError::invalid_input("Workspace manifest declares an asset that has no payload.")
        })?;

        if asset.buffer.len() as u64 != entry.byte_length {
            return Err(AppError::invalid_input(
                "Workspace asset buffer does not match its declared size.",
            ));
        }
        if normalize_asset_path(&asset.path)? != normalize_asset_path(&entry.path)? {
            return Err(AppError::invalid_input(
                "Workspace asset path does not match its manifest entry.",
            ));
        }
        if asset.file_name != entry.file_name || asset.mime_type != entry.mime_type {
            return Err(AppError::invalid_input(
                "Workspace asset metadata does not match its manifest entry.",
            ));
        }
    }

    Ok(())
}

pub fn normalize_asset_path(value: &str) -> AppResult<String> {
    if value.is_empty() || value.len() > 1024 || value.contains('\0') {
        return Err(AppError::invalid_path("Invalid workspace asset path."));
    }

    let normalized = value.replace('\\', "/");
    if normalized.starts_with('/') || normalized.contains(':') || normalized.ends_with('/') {
        return Err(AppError::invalid_path("Invalid workspace asset path."));
    }

    let path = Path::new(&normalized);
    let components: Vec<_> = path.components().collect();

    if components.len() < 2
        || !matches!(components.first(), Some(Component::Normal(root)) if root.to_string_lossy() == "assets")
        || components
            .iter()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(AppError::invalid_path(
            "Workspace assets must use a relative path below assets/.",
        ));
    }

    Ok(components
        .iter()
        .filter_map(|component| match component {
            Component::Normal(part) => part.to_str(),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/"))
}

fn validate_file_name(value: &str) -> AppResult<()> {
    if value.is_empty()
        || value.len() > 255
        || value.contains('/')
        || value.contains('\\')
        || value.contains('\0')
    {
        return Err(AppError::invalid_input("Invalid workspace asset file name."));
    }
    Ok(())
}

fn validate_mime_type(value: &str) -> AppResult<()> {
    value
        .parse::<mime::Mime>()
        .map(|_| ())
        .map_err(|_| AppError::invalid_input("Invalid workspace asset MIME type."))
}

fn atomic_replace(temp_path: &Path, final_path: &Path) -> AppResult<()> {
    if !final_path.exists() {
        fs::rename(temp_path, final_path)?;
        return Ok(());
    }

    let backup_path = final_path.with_extension(format!(
        "{}.{}.backup",
        final_path
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or(WORKSPACE_FILE_EXTENSION),
        Uuid::new_v4()
    ));

    fs::rename(final_path, &backup_path)?;

    if let Err(error) = fs::rename(temp_path, final_path) {
        let rollback = fs::rename(&backup_path, final_path);
        if let Err(rollback_error) = rollback {
            tracing::error!(
                error = %rollback_error,
                "workspace atomic replacement rollback failed"
            );
        }
        return Err(error.into());
    }

    // The replacement already succeeded; a leftover backup is cosmetic and
    // must never turn a completed save into a reported failure.
    if let Err(error) = fs::remove_file(backup_path) {
        tracing::warn!(error_kind = ?error.kind(), "workspace backup cleanup failed");
    }
    Ok(())
}

pub fn write_workspace_package(
    file_path: &Path,
    payload: &WorkspacePackagePayload,
) -> AppResult<()> {
    validate_package(payload)?;

    let parent = file_path
        .parent()
        .ok_or_else(|| AppError::invalid_path("Workspace path has no parent directory."))?;
    fs::create_dir_all(parent)?;

    let temp_path = parent.join(format!(
        ".{}.{}.tmp",
        file_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("workspace.koma"),
        Uuid::new_v4()
    ));

    let operation = (|| -> AppResult<()> {
        let file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp_path)?;

        let mut writer = ZipWriter::new(file);
        let options = SimpleFileOptions::default()
            .compression_method(CompressionMethod::Deflated)
            .compression_level(Some(6))
            .unix_permissions(0o600);

        let normalized_manifest = normalized_manifest(&payload.manifest)?;
        let manifest_bytes = serde_json::to_vec_pretty(&normalized_manifest)?;
        if manifest_bytes.len() as u64 > MAX_MANIFEST_BYTES {
            return Err(AppError::invalid_input(
                "Workspace manifest exceeds the supported size.",
            ));
        }

        writer.start_file(MANIFEST_PATH, options)?;
        writer.write_all(&manifest_bytes)?;

        for asset in &payload.assets {
            let normalized_path = normalize_asset_path(&asset.path)?;
            writer.start_file(normalized_path, options)?;
            writer.write_all(&asset.buffer)?;
        }

        let file = writer.finish()?;
        file.sync_all()?;
        atomic_replace(&temp_path, file_path)?;
        sync_directory(parent)?;

        Ok(())
    })();

    if operation.is_err() {
        let _ = fs::remove_file(&temp_path);
    }

    operation
}

fn normalized_manifest(
    manifest: &WorkspacePackageManifestV1,
) -> AppResult<WorkspacePackageManifestV1> {
    let mut normalized = manifest.clone();
    normalized.assets = manifest
        .assets
        .iter()
        .map(|entry| {
            Ok(WorkspaceAssetManifestEntry {
                id: entry.id.clone(),
                path: normalize_asset_path(&entry.path)?,
                file_name: entry.file_name.clone(),
                mime_type: entry.mime_type.clone(),
                byte_length: entry.byte_length,
            })
        })
        .collect::<AppResult<Vec<_>>>()?;
    Ok(normalized)
}

pub fn read_workspace_package(file_path: &Path) -> AppResult<LoadedWorkspace> {
    let file = File::open(file_path)?;
    if !file.metadata()?.is_file() {
        return Err(AppError::invalid_path(
            "The selected workspace is not a regular file.",
        ));
    }

    let mut archive = ZipArchive::new(file)?;
    if archive.is_empty() || archive.len() > MAX_ASSETS + 1 {
        return Err(AppError::Archive(
            "Workspace archive contains an invalid number of entries.".to_string(),
        ));
    }

    let manifest_bytes = {
        let manifest_file = archive.by_name(MANIFEST_PATH).map_err(|_| {
            AppError::Archive("Workspace manifest is missing.".to_string())
        })?;

        if manifest_file.size() > MAX_MANIFEST_BYTES {
            return Err(AppError::Archive(
                "Workspace manifest exceeds the supported size.".to_string(),
            ));
        }

        // ZIP headers can lie about the uncompressed size; the reader must be
        // hard-capped instead of trusting the declared value.
        let declared = manifest_file.size() as usize;
        let mut limited = manifest_file.take(MAX_MANIFEST_BYTES + 1);
        let mut bytes = Vec::with_capacity(declared);
        limited.read_to_end(&mut bytes)?;
        if bytes.len() as u64 > MAX_MANIFEST_BYTES {
            return Err(AppError::Archive(
                "Workspace manifest exceeds the supported size.".to_string(),
            ));
        }
        bytes
    };

    let manifest: WorkspacePackageManifestV1 = serde_json::from_slice(&manifest_bytes)?;
    if manifest.package_version != 1 || manifest.document_version != 1 {
        return Err(AppError::Archive(
            "This workspace is not compatible with this application version.".to_string(),
        ));
    }

    let manifest = normalized_manifest(&manifest)?;
    validate_manifest_entries(&manifest)?;

    // Every archive entry must be declared by the manifest and vice versa.
    {
        let mut expected: HashSet<String> = std::iter::once(MANIFEST_PATH.to_string())
            .chain(manifest.assets.iter().map(|entry| entry.path.clone()))
            .collect();
        let mut found = HashSet::new();
        for index in 0..archive.len() {
            let file = archive.by_index(index)?;
            if !file.is_file() {
                return Err(AppError::Archive(
                    "Workspace contains unexpected or duplicated entries.".to_string(),
                ));
            }
            let name = if file.name() == MANIFEST_PATH {
                MANIFEST_PATH.to_string()
            } else {
                normalize_asset_path(file.name()).map_err(|_| {
                    AppError::Archive(
                        "Workspace contains unexpected or duplicated entries.".to_string(),
                    )
                })?
            };
            if !expected.remove(&name) || !found.insert(name) {
                return Err(AppError::Archive(
                    "Workspace contains unexpected or duplicated entries.".to_string(),
                ));
            }
        }
        if !expected.is_empty() {
            return Err(AppError::Archive(
                "Workspace is missing one or more declared entries.".to_string(),
            ));
        }
    }

    let mut assets = Vec::with_capacity(manifest.assets.len());
    for entry in &manifest.assets {
        let normalized_path = normalize_asset_path(&entry.path)?;
        let source = archive.by_name(&normalized_path)?;

        if !source.is_file() {
            return Err(AppError::Archive(format!(
                "Workspace asset {} is not a regular file.",
                entry.file_name
            )));
        }
        if source.size() != entry.byte_length {
            return Err(AppError::Archive(format!(
                "Workspace asset {} has an invalid size.",
                entry.file_name
            )));
        }
        if source.size() > MAX_ASSET_BYTES {
            return Err(AppError::Archive(
                "Workspace contains an oversized asset.".to_string(),
            ));
        }
        if source.size() > 1024 * 1024
            && source.compressed_size() > 0
            && source.size() / source.compressed_size() > MAX_COMPRESSION_RATIO
        {
            return Err(AppError::Archive(
                "Workspace contains an unsafe compression ratio.".to_string(),
            ));
        }

        // Same hard cap as the manifest: never read past declared + 1 byte,
        // regardless of what the compressed stream actually inflates to.
        let mut limited = source.take(entry.byte_length.saturating_add(1));
        let mut buffer = Vec::with_capacity(entry.byte_length as usize);
        limited.read_to_end(&mut buffer)?;
        if buffer.len() as u64 != entry.byte_length {
            return Err(AppError::Archive(
                "Workspace asset size does not match its manifest entry.".to_string(),
            ));
        }

        assets.push(WorkspaceBinaryAssetPayload {
            id: entry.id.clone(),
            path: normalized_path,
            file_name: entry.file_name.clone(),
            mime_type: entry.mime_type.clone(),
            buffer,
        });
    }

    Ok(LoadedWorkspace { manifest, assets })
}




#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::workspace::{
        WorkspaceAssetManifestEntry, WorkspaceBinaryAssetPayload, WorkspacePackagePayload,
    };
    use serde_json::json;

    #[test]
    fn autosave_path_hashes_sanitized_user_id() {
        let path = workspace_autosave_path(Path::new("workspace"), Some(" user-1 "));
        let rendered = path.to_string_lossy();
        assert!(rendered.starts_with("workspace"));
        assert!(rendered.ends_with(".koma"));
        assert!(!rendered.contains("user-1"));

        // Guests and empty ids share the same slot.
        assert_eq!(
            workspace_autosave_path(Path::new("w"), None),
            workspace_autosave_path(Path::new("w"), Some("  "))
        );
    }

    #[test]
    fn normalize_asset_path_rejects_traversal_and_requires_assets_root() {
        assert!(normalize_asset_path("assets/x/page.png").is_ok());
        assert!(normalize_asset_path("assets\\\\x\\\\page.png").is_ok());
        assert!(normalize_asset_path("../etc/passwd").is_err());
        assert!(normalize_asset_path("assets/../secret").is_err());
        assert!(normalize_asset_path("/abs/path").is_err());
        assert!(normalize_asset_path("not-assets/x").is_err());
        assert!(normalize_asset_path("").is_err());
    }

    fn sample_payload() -> WorkspacePackagePayload {
        WorkspacePackagePayload {
            manifest: WorkspacePackageManifestV1 {
                package_version: 1,
                exported_at: "2026-05-20T00:00:00.000Z".to_string(),
                app: "koma-studio".to_string(),
                document_version: 1,
                document: json!({ "version": 1 }),
                assets: vec![WorkspaceAssetManifestEntry {
                    id: "asset-1".to_string(),
                    path: "assets\\\\page.png".to_string(),
                    file_name: "page.png".to_string(),
                    mime_type: "image/png".to_string(),
                    byte_length: 4,
                }],
            },
            assets: vec![WorkspaceBinaryAssetPayload {
                id: "asset-1".to_string(),
                path: "assets\\\\page.png".to_string(),
                file_name: "page.png".to_string(),
                mime_type: "image/png".to_string(),
                buffer: vec![1, 2, 3, 4],
            }],
        }
    }

    #[test]
    fn workspace_package_roundtrip_normalizes_paths() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("autosave.test.koma");
        let payload = sample_payload();

        write_workspace_package(&path, &payload).unwrap();
        let loaded = read_workspace_package(&path).unwrap();
        assert_eq!(loaded.assets[0].buffer, vec![1, 2, 3, 4]);
        assert_eq!(loaded.manifest.assets[0].path, "assets/page.png");
    }

    #[test]
    fn rejects_incompatible_workspace_package() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("bad.koma");
        let mut payload = sample_payload();
        payload.manifest.package_version = 2;

        let error = write_workspace_package(&path, &payload).unwrap_err();
        assert!(matches!(error, AppError::Archive(_)));
    }

    #[test]
    fn rejects_oversized_declared_asset() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("bad.koma");
        let mut payload = sample_payload();
        payload.manifest.assets[0].byte_length = (512 * 1024 * 1024) + 1;

        let error = write_workspace_package(&path, &payload).unwrap_err();
        assert!(matches!(error, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_buffer_and_manifest_length_mismatch() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("bad.koma");
        let mut payload = sample_payload();

        payload.assets[0].buffer = vec![1, 2, 3];

        let error = write_workspace_package(&path, &payload).unwrap_err();
        assert!(matches!(error, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_duplicated_asset_ids() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("bad.koma");
        let mut payload = sample_payload();
        let duplicate = payload.manifest.assets[0].clone();
        payload.manifest.assets.push(duplicate.clone());
        payload.assets.push(WorkspaceBinaryAssetPayload {
            id: duplicate.id,
            path: duplicate.path,
            file_name: duplicate.file_name,
            mime_type: duplicate.mime_type,
            buffer: vec![9, 9],
        });

        let error = write_workspace_package(&path, &payload).unwrap_err();
        assert!(matches!(error, AppError::InvalidInput(_)));
    }
}

#[cfg(unix)]
fn sync_directory(path: &Path) -> AppResult<()> {
    File::open(path)?.sync_all()?;
    Ok(())
}

#[cfg(not(unix))]
fn sync_directory(_path: &Path) -> AppResult<()> {
    Ok(())
}
