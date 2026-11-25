use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

use crate::{
    error::{AppError, AppResult},
    models::workspace::{WorkspaceAssetManifestEntry, WorkspacePackageManifestV1},
    services::workspace::{
        MANIFEST_PATH, MAX_ASSET_BYTES, MAX_MANIFEST_BYTES, atomic_replace_with_rotation,
        check_asset_entry_limits, normalized_manifest, open_workspace_archive, sync_directory,
        validate_manifest_entries,
    },
};

const STAGING_DIR_NAME: &str = "workspace-staging";
const COPY_BUFFER_BYTES: usize = 64 * 1024;

#[derive(Debug)]
pub struct StagedExtractedAsset {
    pub entry: WorkspaceAssetManifestEntry,
    pub path: PathBuf,
    pub sha256: String,
}

#[derive(Debug)]
pub struct StagedLoadedWorkspace {
    pub manifest: WorkspacePackageManifestV1,
    pub assets: Vec<StagedExtractedAsset>,
}

pub fn workspace_staging_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    Ok(app.path().app_cache_dir()?.join(STAGING_DIR_NAME))
}

fn staged_file_path(staging_dir: &Path, sha256: &str) -> PathBuf {
    staging_dir.join(format!("{sha256}.bin"))
}

fn write_new_file(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    let mut file = OpenOptions::new().create_new(true).write(true).open(path)?;
    file.write_all(bytes)
}

pub fn stage_raw_bytes(staging_dir: &Path, bytes: &[u8]) -> AppResult<(PathBuf, String)> {
    let length = bytes.len() as u64;
    if length > MAX_ASSET_BYTES {
        return Err(AppError::invalid_input(
            "Workspace contains an oversized asset.",
        ));
    }
    fs::create_dir_all(staging_dir)?;

    let sha256 = hex::encode(Sha256::digest(bytes));
    let target = staged_file_path(staging_dir, &sha256);
    if fs::metadata(&target).is_ok_and(|metadata| metadata.is_file() && metadata.len() == length) {
        return Ok((target, sha256));
    }

    let temp = staging_dir.join(format!(".{sha256}.{}.tmp", Uuid::new_v4()));
    let outcome = write_new_file(&temp, bytes).and_then(|()| match fs::rename(&temp, &target) {
        Ok(()) => Ok(()),
        Err(_)
            if fs::metadata(&target)
                .is_ok_and(|metadata| metadata.is_file() && metadata.len() == length) =>
        {
            let _ = fs::remove_file(&temp);
            Ok(())
        }
        Err(error) => Err(error),
    });
    if let Err(error) = outcome {
        let _ = fs::remove_file(&temp);
        return Err(error.into());
    }
    Ok((target, sha256))
}

pub fn write_staged_workspace_package(
    file_path: &Path,
    manifest: &WorkspacePackageManifestV1,
    staged_paths: &[PathBuf],
) -> AppResult<()> {
    if manifest.package_version != 1 || manifest.document_version != 1 {
        return Err(AppError::Archive(
            "This workspace is not compatible with this application version.".to_owned(),
        ));
    }
    if manifest.assets.len() != staged_paths.len() {
        return Err(AppError::invalid_input(
            "Workspace manifest and asset list have different lengths.",
        ));
    }
    validate_manifest_entries(manifest)?;
    for (entry, path) in manifest.assets.iter().zip(staged_paths) {
        if fs::metadata(path)?.len() != entry.byte_length {
            return Err(AppError::invalid_input(
                "Workspace asset buffer does not match its declared size.",
            ));
        }
    }

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

        let normalized = normalized_manifest(manifest)?;
        let manifest_bytes = serde_json::to_vec_pretty(&normalized)?;
        if manifest_bytes.len() as u64 > MAX_MANIFEST_BYTES {
            return Err(AppError::invalid_input(
                "Workspace manifest exceeds the supported size.",
            ));
        }
        writer.start_file(MANIFEST_PATH, options)?;
        writer.write_all(&manifest_bytes)?;

        for (entry, source) in normalized.assets.iter().zip(staged_paths) {
            writer.start_file(entry.path.as_str(), options)?;
            let mut limited = File::open(source)?.take(entry.byte_length.saturating_add(1));
            let copied = std::io::copy(&mut limited, &mut writer)?;
            if copied != entry.byte_length {
                return Err(AppError::invalid_input(
                    "Workspace asset buffer does not match its declared size.",
                ));
            }
        }

        let file = writer.finish()?;
        file.sync_all()?;
        drop(file);
        atomic_replace_with_rotation(&temp_path, file_path)?;
        sync_directory(parent)?;
        Ok(())
    })();

    if operation.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    operation
}

pub fn read_staged_workspace_package(
    file_path: &Path,
    staging_dir: &Path,
) -> AppResult<StagedLoadedWorkspace> {
    let (mut archive, manifest) = open_workspace_archive(file_path)?;
    fs::create_dir_all(staging_dir)?;

    let mut assets = Vec::with_capacity(manifest.assets.len());
    for entry in &manifest.assets {
        let source = archive.by_name(&entry.path)?;
        check_asset_entry_limits(
            source.is_file(),
            source.size(),
            source.compressed_size(),
            entry,
        )?;
        let limited = source.take(entry.byte_length.saturating_add(1));
        let (path, sha256) = stage_reader(staging_dir, limited, entry.byte_length)?;
        assets.push(StagedExtractedAsset {
            entry: entry.clone(),
            path,
            sha256,
        });
    }

    Ok(StagedLoadedWorkspace { manifest, assets })
}

fn stage_reader(
    staging_dir: &Path,
    mut reader: impl Read,
    expected_length: u64,
) -> AppResult<(PathBuf, String)> {
    let temp = staging_dir.join(format!(".{}.tmp", Uuid::new_v4()));
    let outcome = (|| -> AppResult<(PathBuf, String)> {
        let mut hasher = Sha256::new();
        let mut total = 0_u64;
        {
            let mut file = OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&temp)?;
            let mut buffer = vec![0_u8; COPY_BUFFER_BYTES];
            loop {
                let read = reader.read(&mut buffer)?;
                if read == 0 {
                    break;
                }
                hasher.update(&buffer[..read]);
                file.write_all(&buffer[..read])?;
                total += read as u64;
            }
            file.flush()?;
        }
        if total != expected_length {
            return Err(AppError::Archive(
                "Workspace asset size does not match its manifest entry.".to_owned(),
            ));
        }
        let sha256 = hex::encode(hasher.finalize());
        let target = staged_file_path(staging_dir, &sha256);
        if fs::metadata(&target)
            .is_ok_and(|metadata| metadata.is_file() && metadata.len() == expected_length)
        {
            let _ = fs::remove_file(&temp);
            return Ok((target, sha256));
        }
        match fs::rename(&temp, &target) {
            Ok(()) => Ok((target, sha256)),
            Err(_)
                if fs::metadata(&target).is_ok_and(|metadata| {
                    metadata.is_file() && metadata.len() == expected_length
                }) =>
            {
                let _ = fs::remove_file(&temp);
                Ok((target, sha256))
            }
            Err(error) => Err(error.into()),
        }
    })();
    if outcome.is_err() {
        let _ = fs::remove_file(&temp);
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::workspace::read_workspace_package;

    fn manifest(byte_length: u64) -> WorkspacePackageManifestV1 {
        WorkspacePackageManifestV1 {
            package_version: 1,
            exported_at: "2026-05-20T00:00:00.000Z".to_owned(),
            app: "koma-studio".to_owned(),
            document_version: 1,
            document: serde_json::json!({ "version": 1 }),
            assets: vec![WorkspaceAssetManifestEntry {
                id: "asset-1".to_owned(),
                path: "assets/page.png".to_owned(),
                file_name: "page.png".to_owned(),
                mime_type: "image/png".to_owned(),
                byte_length,
            }],
        }
    }

    #[test]
    fn staging_identical_bytes_reuses_the_content_addressed_file() {
        let temp = tempfile::tempdir().unwrap();
        let (first_path, first_sha) = stage_raw_bytes(temp.path(), b"abcd").unwrap();
        let (second_path, second_sha) = stage_raw_bytes(temp.path(), b"abcd").unwrap();

        assert_eq!(first_path, second_path);
        assert_eq!(first_sha, second_sha);
        assert_eq!(fs::read(&first_path).unwrap(), b"abcd");
        assert_eq!(fs::read_dir(temp.path()).unwrap().count(), 1);
    }

    #[test]
    fn staged_package_roundtrips_and_stays_readable_by_the_buffered_reader() {
        let temp = tempfile::tempdir().unwrap();
        let staging = temp.path().join("staging");
        let reload_staging = temp.path().join("reload");
        let package = temp.path().join("out.koma");

        let (staged_path, sha256) = stage_raw_bytes(&staging, &[1, 2, 3, 4]).unwrap();
        write_staged_workspace_package(&package, &manifest(4), &[staged_path]).unwrap();

        let buffered = read_workspace_package(&package).unwrap();
        assert_eq!(buffered.assets[0].buffer, vec![1, 2, 3, 4]);

        let reloaded = read_staged_workspace_package(&package, &reload_staging).unwrap();
        assert_eq!(reloaded.assets.len(), 1);
        assert_eq!(reloaded.assets[0].sha256, sha256);
        assert_eq!(
            fs::read(&reloaded.assets[0].path).unwrap(),
            vec![1, 2, 3, 4]
        );
        assert_eq!(reloaded.manifest.assets[0].path, "assets/page.png");
    }

    #[test]
    fn length_mismatch_is_rejected_without_creating_the_package() {
        let temp = tempfile::tempdir().unwrap();
        let package = temp.path().join("out.koma");
        let (staged_path, _) =
            stage_raw_bytes(&temp.path().join("staging"), &[1, 2, 3, 4]).unwrap();

        let error =
            write_staged_workspace_package(&package, &manifest(5), &[staged_path]).unwrap_err();

        assert!(matches!(error, AppError::InvalidInput(_)));
        assert!(!package.exists());
    }

    #[test]
    fn incompatible_versions_are_rejected() {
        let temp = tempfile::tempdir().unwrap();
        let package = temp.path().join("out.koma");
        let mut incompatible = manifest(4);
        incompatible.package_version = 2;
        let (staged_path, _) =
            stage_raw_bytes(&temp.path().join("staging"), &[1, 2, 3, 4]).unwrap();

        let error =
            write_staged_workspace_package(&package, &incompatible, &[staged_path]).unwrap_err();

        assert!(matches!(error, AppError::Archive(_)));
    }

    #[test]
    fn reloading_the_same_package_into_the_same_staging_dir_reuses_files() {
        let temp = tempfile::tempdir().unwrap();
        let staging = temp.path().join("staging");
        let package = temp.path().join("out.koma");

        let (staged_path, sha256) = stage_raw_bytes(&staging, &[10, 20, 30, 40]).unwrap();
        write_staged_workspace_package(&package, &manifest(4), &[staged_path]).unwrap();

        let first = read_staged_workspace_package(&package, &staging).unwrap();
        let second = read_staged_workspace_package(&package, &staging).unwrap();

        assert_eq!(first.assets[0].sha256, sha256);
        assert_eq!(second.assets[0].sha256, sha256);
        assert_eq!(first.assets[0].path, second.assets[0].path);
        let entries: Vec<_> = fs::read_dir(&staging)
            .unwrap()
            .map(|entry| entry.unwrap())
            .collect();
        assert_eq!(entries.len(), 1);
    }
}
