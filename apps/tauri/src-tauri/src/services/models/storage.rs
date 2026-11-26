//! Managed model store: directory layout, manifests (atomic writes),
//! transactional ONNX import, uninstall with rollback and stale work-directory
//! cleanup. Model ids are the mini-backend's real ids
//! (`manga_ocr`, `sugoi_v4_ja_en_ct2`, ...) — they name the on-disk
//! directories under `KOMA_MODELS_ROOT` and must never be renamed in lockstep
//! with the registry.

use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{Duration, SystemTime},
};

use serde::Serialize;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::model_manager::{
        DesktopDiskSpaceInfo, DesktopInstalledModelRecord, DesktopModelDownloadPayload,
        DesktopModelImportOnnxPayload, DesktopModelManifest, ModelInstallStatus,
    },
};

use super::{checksum, TransferObserver};

pub(super) const MANIFEST_FILE_NAME: &str = "manifest.json";
pub(super) const ENHANCE_MODEL_FILE_NAME: &str = "model.onnx";
pub(super) const LEGACY_PARTIAL_FILE_NAME: &str = "download.partial";
const MAX_MANIFEST_BYTES: u64 = 64 * 1024;
const MAX_MODEL_DIRECTORIES: usize = 4096;
pub(super) const MAX_DIRECTORY_FILES: usize = 100_000;
pub(super) const MAX_DIRECTORY_DEPTH: usize = 64;
const STALE_WORK_DIRECTORY_AGE: Duration = Duration::from_secs(24 * 60 * 60);

const EASYOCR_MODEL_ID: &str = "easyocr";

pub fn ensure_root(root: &Path) -> AppResult<()> {
    fs::create_dir_all(root)?;
    checksum::reject_symlink(root)?;
    cleanup_stale_work_directories(root)?;
    Ok(())
}

pub fn disk_space_info(root: &Path) -> AppResult<DesktopDiskSpaceInfo> {
    ensure_root(root)?;

    Ok(DesktopDiskSpaceInfo {
        free_bytes: fs2::available_space(root)?,
        total_bytes: fs2::total_space(root)?,
        path: root.to_string_lossy().to_string(),
    })
}

pub fn ensure_enough_disk_space(root: &Path, required_bytes: u64) -> AppResult<()> {
    ensure_root(root)?;

    if required_bytes == 0 {
        return Ok(());
    }

    let reserve = required_bytes / 20;
    let required_with_reserve = required_bytes
        .checked_add(reserve)
        .ok_or_else(|| AppError::invalid_input("Required disk size overflow."))?;
    let free = fs2::available_space(root)?;

    if free < required_with_reserve {
        return Err(AppError::Conflict(format!(
            "Insufficient disk space. Required: {:.1} GiB. Available: {:.1} GiB.",
            required_with_reserve as f64 / 1024_f64.powi(3),
            free as f64 / 1024_f64.powi(3)
        )));
    }

    Ok(())
}

pub fn list_installed_models(root: &Path) -> AppResult<Vec<DesktopInstalledModelRecord>> {
    ensure_root(root)?;

    Ok(collect_model_ids(root)?
        .into_iter()
        .filter_map(|model_id| match installed_record(root, &model_id) {
            Ok(record) => record,
            Err(error) => {
                tracing::error!(
                    model_id = %model_id,
                    error_kind = error.kind(),
                    "failed to inspect installed model"
                );
                None
            }
        })
        .collect())
}

pub fn list_all_installed_models(root: &Path) -> AppResult<Vec<DesktopInstalledModelRecord>> {
    list_installed_models(root)
}

/// Before the download starts: reserve disk space and (re)write an
/// `incomplete` manifest so a crash mid-download is visible in the UI. The
/// previous manifest is returned so a failed attempt can restore it.
pub fn prepare_download(
    root: &Path,
    model: &DesktopModelDownloadPayload,
) -> AppResult<Option<DesktopModelManifest>> {
    ensure_root(root)?;
    ensure_enough_disk_space(root, model.required_disk_bytes)?;

    let directory = model_dir(root, &model.id);
    fs::create_dir_all(&directory)?;
    checksum::reject_symlink(&directory)?;

    let previous = read_manifest(&directory.join(MANIFEST_FILE_NAME))?;

    if previous
        .as_ref()
        .is_some_and(|manifest| manifest.status == ModelInstallStatus::Installed)
    {
        return Ok(previous);
    }

    let manifest = DesktopModelManifest {
        model_id: model.id.clone(),
        version: model.version.clone(),
        installed_at: chrono::Utc::now().to_rfc3339(),
        checksum_sha256: model.checksum_sha256.clone(),
        status: ModelInstallStatus::Incomplete,
        origin: Some("download".to_string()),
        size_bytes: compute_directory_size(&directory)?,
    };

    write_manifest_to_directory(&directory, &manifest)?;
    Ok(None)
}

pub fn restore_previous_manifest(
    root: &Path,
    model_id: &str,
    previous: Option<&DesktopModelManifest>,
) -> AppResult<()> {
    let directory = model_dir(root, model_id);
    let Some(previous) = previous else {
        if directory.exists()
            && !super::payload::has_any_payload_file(&directory)?
            && !super::payload::contains_partial_file(&directory)?
        {
            let manifest_path = directory.join(MANIFEST_FILE_NAME);
            if manifest_path.is_file() {
                let _ = fs::remove_file(&manifest_path);
            }
            let _ = fs::remove_dir(&directory);
        }
        return Ok(());
    };

    write_manifest_to_directory(&directory, previous)
}

pub fn complete_download(
    root: &Path,
    model: &DesktopModelDownloadPayload,
) -> AppResult<DesktopInstalledModelRecord> {
    let directory = model_dir(root, &model.id);

    if !is_installed_payload_present(&model.id, &directory)? {
        return Err(AppError::Integrity(format!(
            "Installation of {} completed without the expected model payload.",
            model.name
        )));
    }

    let size_bytes = compute_directory_size(&directory)?;
    let checksum = model.checksum_sha256.clone();
    let installed_at = chrono::Utc::now().to_rfc3339();
    let manifest = DesktopModelManifest {
        model_id: model.id.clone(),
        version: model.version.clone(),
        installed_at: installed_at.clone(),
        checksum_sha256: checksum.clone(),
        status: ModelInstallStatus::Installed,
        origin: Some("download".to_string()),
        size_bytes,
    };

    write_manifest_to_directory(&directory, &manifest)?;

    Ok(DesktopInstalledModelRecord {
        model_id: model.id.clone(),
        version: model.version.clone(),
        installed_at,
        checksum_sha256: checksum,
        status: "installed".to_string(),
        installed_languages: (model.id == EASYOCR_MODEL_ID)
            .then(|| detect_easyocr_installed_languages(&directory)),
        origin: manifest.origin,
        model_dir: directory.to_string_lossy().to_string(),
        manifest_path: directory
            .join(MANIFEST_FILE_NAME)
            .to_string_lossy()
            .to_string(),
        size_bytes,
    })
}

/// Transactional local ONNX import: validate → copy into staging → manifest →
/// atomic swap with backup → rollback on failure.
pub fn import_onnx_model(
    root: &Path,
    model: &DesktopModelImportOnnxPayload,
    source_path: &Path,
    observer: Option<TransferObserver>,
) -> AppResult<DesktopInstalledModelRecord> {
    ensure_root(root)?;
    checksum::reject_symlink(source_path)?;

    let metadata = fs::metadata(source_path)?;
    if !metadata.is_file() {
        return Err(AppError::NotAFile(source_path.to_path_buf()));
    }

    ensure_enough_disk_space(root, metadata.len())?;

    let staging = root.join(format!(".staging-{}-{}", model.id, Uuid::new_v4()));
    let target = model_dir(root, &model.id);
    let backup = root.join(format!(".backup-{}-{}", model.id, Uuid::new_v4()));

    fs::create_dir(&staging)?;
    let target_file = staging.join(ENHANCE_MODEL_FILE_NAME);
    let progress_observer = observer.clone();

    let operation = (|| -> AppResult<DesktopInstalledModelRecord> {
        let checksum =
            checksum::copy_and_checksum(source_path, &target_file, move |transferred, total| {
                if let Some(observer) = &progress_observer {
                    observer(crate::models::model_manager::ModelTransferProgress {
                        phase: crate::models::model_manager::ModelTransferPhase::Copying,
                        transferred,
                        total,
                        percent: if total == 0 {
                            100.0
                        } else {
                            (transferred as f64 / total as f64 * 100.0).clamp(0.0, 100.0)
                        },
                    });
                }
            })?;

        let installed_at = chrono::Utc::now().to_rfc3339();
        let manifest = DesktopModelManifest {
            model_id: model.id.clone(),
            version: model.version.clone(),
            installed_at: installed_at.clone(),
            checksum_sha256: checksum.clone(),
            status: ModelInstallStatus::Installed,
            origin: Some("local_import".to_string()),
            size_bytes: metadata.len(),
        };

        write_manifest_to_directory(&staging, &manifest)?;

        if target.exists() {
            checksum::reject_symlink(&target)?;
            fs::rename(&target, &backup)?;
        }

        if let Err(error) = fs::rename(&staging, &target) {
            if backup.exists() {
                if let Err(rollback_error) = fs::rename(&backup, &target) {
                    tracing::error!(
                        error = %rollback_error,
                        "ONNX installation rollback failed"
                    );
                }
            }
            return Err(error.into());
        }

        if backup.exists() {
            if let Err(error) = fs::remove_dir_all(&backup) {
                tracing::warn!(
                    error_kind = ?error.kind(),
                    "old model backup cleanup was deferred"
                );
            }
        }

        Ok(DesktopInstalledModelRecord {
            model_id: model.id.clone(),
            version: model.version.clone(),
            installed_at,
            checksum_sha256: checksum,
            status: "installed".to_string(),
            installed_languages: None,
            origin: Some("local_import".to_string()),
            model_dir: target.to_string_lossy().to_string(),
            manifest_path: target
                .join(MANIFEST_FILE_NAME)
                .to_string_lossy()
                .to_string(),
            size_bytes: metadata.len(),
        })
    })();

    if operation.is_err() {
        remove_directory_if_exists(&staging);

        if backup.exists() && !target.exists() {
            if let Err(error) = fs::rename(&backup, &target) {
                tracing::error!(
                    error_kind = ?error.kind(),
                    "ONNX backup restoration failed"
                );
            }
        }
    }

    operation
}

pub fn uninstall_model(root: &Path, model_id: &str) -> AppResult<bool> {
    ensure_root(root)?;
    let target = model_dir(root, model_id);

    if !target.exists() {
        return Ok(false);
    }

    checksum::reject_symlink(&target)?;
    let trash = root.join(format!(".trash-{}-{}", model_id, Uuid::new_v4()));

    fs::rename(&target, &trash)?;

    if let Err(error) = fs::remove_dir_all(&trash) {
        if let Err(rollback_error) = fs::rename(&trash, &target) {
            tracing::error!(
                error_kind = ?rollback_error.kind(),
                "model uninstall rollback failed"
            );
        }
        return Err(error.into());
    }

    Ok(true)
}

pub use super::payload::is_installed_payload_present;

pub fn model_dir(root: &Path, model_id: &str) -> PathBuf {
    root.join(model_id)
}

fn collect_model_ids(root: &Path) -> AppResult<Vec<String>> {
    ensure_root(root)?;
    let mut model_ids = Vec::new();

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let file_type = entry.file_type()?;

        if file_type.is_symlink() {
            return Err(AppError::security(
                "Symbolic links are not allowed inside the model store.",
            ));
        }

        if !file_type.is_dir() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') {
            continue;
        }

        if super::validate_model_id(&name).is_err() {
            tracing::warn!(model_id = %name, "ignored invalid model directory name");
            continue;
        }

        if model_ids.len() >= MAX_MODEL_DIRECTORIES {
            return Err(AppError::Conflict(
                "The model store contains too many directories.".to_string(),
            ));
        }

        model_ids.push(name);
    }

    model_ids.sort();
    Ok(model_ids)
}

fn installed_record(root: &Path, model_id: &str) -> AppResult<Option<DesktopInstalledModelRecord>> {
    let directory = model_dir(root, model_id);
    let manifest_path = directory.join(MANIFEST_FILE_NAME);
    let manifest = read_manifest(&manifest_path)?;
    let has_partial = super::payload::contains_partial_file(&directory)?;
    let size_bytes = manifest
        .as_ref()
        .map(|manifest| manifest.size_bytes)
        .filter(|size| *size > 0)
        .unwrap_or(compute_directory_size(&directory)?);

    match manifest {
        Some(manifest) => {
            let payload_present = is_installed_payload_present(model_id, &directory)?;
            let status = if manifest.status == ModelInstallStatus::Installed
                && payload_present
                && manifest.model_id == model_id
            {
                "installed"
            } else {
                "incomplete"
            };

            Ok(Some(DesktopInstalledModelRecord {
                model_id: model_id.to_string(),
                version: manifest.version,
                installed_at: manifest.installed_at,
                checksum_sha256: manifest.checksum_sha256,
                status: status.to_string(),
                installed_languages: (model_id == EASYOCR_MODEL_ID)
                    .then(|| detect_easyocr_installed_languages(&directory)),
                origin: manifest.origin,
                model_dir: directory.to_string_lossy().to_string(),
                manifest_path: manifest_path.to_string_lossy().to_string(),
                size_bytes,
            }))
        }
        None if has_partial => Ok(Some(DesktopInstalledModelRecord {
            model_id: model_id.to_string(),
            version: "0.0.0".to_string(),
            installed_at: chrono::DateTime::<chrono::Utc>::UNIX_EPOCH.to_rfc3339(),
            checksum_sha256: String::new(),
            status: "incomplete".to_string(),
            installed_languages: (model_id == EASYOCR_MODEL_ID)
                .then(|| detect_easyocr_installed_languages(&directory)),
            origin: None,
            model_dir: directory.to_string_lossy().to_string(),
            manifest_path: manifest_path.to_string_lossy().to_string(),
            size_bytes,
        })),
        None => Ok(None),
    }
}

fn read_manifest(path: &Path) -> AppResult<Option<DesktopModelManifest>> {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };

    checksum::reject_symlink(path)?;
    let metadata = file.metadata()?;

    if metadata.len() > MAX_MANIFEST_BYTES {
        return Err(AppError::Serialization(
            "Model manifest exceeds the supported size.".to_string(),
        ));
    }

    let mut reader = file.take(MAX_MANIFEST_BYTES + 1);
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    reader.read_to_end(&mut bytes)?;

    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(AppError::Serialization(
            "Model manifest exceeds the supported size.".to_string(),
        ));
    }

    Ok(Some(serde_json::from_slice(&bytes)?))
}

fn write_manifest_to_directory(directory: &Path, manifest: &DesktopModelManifest) -> AppResult<()> {
    fs::create_dir_all(directory)?;
    atomic_write_json(&directory.join(MANIFEST_FILE_NAME), manifest)
}

fn atomic_write_json<T: Serialize>(path: &Path, value: &T) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::invalid_path("Manifest path has no parent directory."))?;
    let bytes = serde_json::to_vec(value)?;

    if bytes.len() as u64 > MAX_MANIFEST_BYTES {
        return Err(AppError::Serialization(
            "Model manifest exceeds the supported size.".to_string(),
        ));
    }

    let temporary = parent.join(format!(".manifest-{}.tmp", Uuid::new_v4()));

    let operation = (|| -> AppResult<()> {
        let mut file = OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temporary)?;
        set_private_permissions(&file)?;
        file.write_all(&bytes)?;
        file.sync_all()?;
        replace_file(&temporary, path)?;
        sync_directory(parent)?;
        Ok(())
    })();

    if operation.is_err() {
        if let Err(error) = fs::remove_file(&temporary) {
            if error.kind() != std::io::ErrorKind::NotFound {
                tracing::warn!(
                    error_kind = ?error.kind(),
                    "temporary model manifest cleanup failed"
                );
            }
        }
    }

    operation
}

fn compute_directory_size(root: &Path) -> AppResult<u64> {
    if !root.exists() {
        return Ok(0);
    }

    checksum::reject_symlink(root)?;
    let mut pending = vec![(root.to_path_buf(), 0_usize)];
    let mut file_count = 0_usize;
    let mut total = 0_u64;

    while let Some((directory, depth)) = pending.pop() {
        if depth > MAX_DIRECTORY_DEPTH {
            return Err(AppError::Integrity(
                "Model directory exceeds the supported depth.".to_string(),
            ));
        }

        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            let file_type = entry.file_type()?;

            if file_type.is_symlink() {
                return Err(AppError::security(
                    "Symbolic links are not allowed inside model directories.",
                ));
            }

            if file_type.is_dir() {
                pending.push((entry.path(), depth + 1));
            } else if file_type.is_file() {
                file_count += 1;
                if file_count > MAX_DIRECTORY_FILES {
                    return Err(AppError::Integrity(
                        "Model directory contains too many files.".to_string(),
                    ));
                }

                total = total.checked_add(entry.metadata()?.len()).ok_or_else(|| {
                    AppError::Integrity("Model directory size overflow.".to_string())
                })?;
            }
        }
    }

    Ok(total)
}

fn detect_easyocr_installed_languages(directory: &Path) -> Vec<String> {
    let bucket_root = directory.join("easyocr-cache");
    let specs: &[(&str, &str, &[&str])] = &[
        ("en", "english_g2.pth", &["en"]),
        ("ko", "korean_g2.pth", &["ko"]),
        ("ja", "japanese_g2.pth", &["ja"]),
        ("ch_sim", "chinese_sim.pth", &["zh", "zh-cn"]),
        ("ch_tra", "chinese.pth", &["zh-tw"]),
        ("ru", "cyrillic_g2.pth", &["ru"]),
        (
            "latin",
            "latin_g2.pth",
            &[
                "fr", "de", "nl", "es", "it", "pt", "tr", "pl", "vi", "id", "hu",
            ],
        ),
        ("th", "thai_g1.pth", &["th"]),
        ("ar", "arabic_g1.pth", &["ar"]),
    ];

    let mut languages = HashSet::new();

    for (bucket, recognition_file, codes) in specs {
        let legacy_ready = easyocr_bucket_ready(&bucket_root, recognition_file);
        let bucket_ready = easyocr_bucket_ready(&bucket_root.join(bucket), recognition_file);

        if legacy_ready || bucket_ready {
            languages.extend(codes.iter().map(|code| (*code).to_string()));
        }
    }

    let mut languages = languages.into_iter().collect::<Vec<_>>();
    languages.sort();
    languages
}

fn easyocr_bucket_ready(base: &Path, recognition_file: &str) -> bool {
    base.join("craft_mlt_25k.pth").is_file() && base.join(recognition_file).is_file()
}

fn cleanup_stale_work_directories(root: &Path) -> AppResult<()> {
    let now = SystemTime::now();

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let file_type = entry.file_type()?;

        if !file_type.is_dir() || file_type.is_symlink() {
            continue;
        }

        let name = entry.file_name().to_string_lossy().into_owned();
        let managed_temporary = name.starts_with(".staging-")
            || name.starts_with(".backup-")
            || name.starts_with(".trash-");

        if !managed_temporary {
            continue;
        }

        let stale = entry
            .metadata()?
            .modified()
            .ok()
            .and_then(|modified| now.duration_since(modified).ok())
            .is_some_and(|age| age >= STALE_WORK_DIRECTORY_AGE);

        if stale {
            if let Err(error) = fs::remove_dir_all(entry.path()) {
                tracing::warn!(
                    error_kind = ?error.kind(),
                    "stale model work directory cleanup failed"
                );
            }
        }
    }

    Ok(())
}

fn remove_directory_if_exists(path: &Path) {
    if let Err(error) = fs::remove_dir_all(path) {
        if error.kind() != std::io::ErrorKind::NotFound {
            tracing::warn!(
                error_kind = ?error.kind(),
                "temporary model directory cleanup failed"
            );
        }
    }
}

#[cfg(unix)]
fn set_private_permissions(file: &File) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;

    file.set_permissions(fs::Permissions::from_mode(0o600))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_permissions(_file: &File) -> AppResult<()> {
    Ok(())
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

#[cfg(not(target_os = "windows"))]
fn replace_file(source: &Path, destination: &Path) -> AppResult<()> {
    fs::rename(source, destination)?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn replace_file(source: &Path, destination: &Path) -> AppResult<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source = source
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();

    let result = unsafe {
        MoveFileExW(
            source.as_ptr(),
            destination.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };

    if result == 0 {
        return Err(std::io::Error::last_os_error().into());
    }

    Ok(())
}
