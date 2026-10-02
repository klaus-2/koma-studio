//! Managed custom fonts: uuid-named files with a v2 manifest, content-
//! signature validation (extension must match the binary), atomic writes and
//! manifest reconciliation on every read. The legacy v1 manifest (a plain
//! `name -> family` map) is migrated in place.
//!
//! The IPC wire contract keeps `dataUrl` for the frontend font loader; the
//! media URL is converted at the command boundary.

use std::{
    collections::{BTreeMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::fonts::{FontId, FontInstallProgress},
    services::api_client::{app_data_dir, read_json_file, write_json_file},
};

pub const FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "woff", "woff2"];
pub const MAX_FONT_BYTES: u64 = 64 * 1024 * 1024;

/// ~20 emissions/s worst case — inside the 10-30 updates/s window for
/// progress events crossing the IPC boundary.
const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(50);

pub type ProgressObserver = std::sync::Arc<dyn Fn(FontInstallProgress) + Send + Sync + 'static>;

#[derive(Debug, Clone)]
pub struct InstalledFont {
    pub id: FontId,
    pub family: String,
    pub file_name: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct FontManifest {
    version: u8,
    fonts: BTreeMap<FontId, FontRecord>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct FontRecord {
    family: String,
    file_name: String,
}

impl Default for FontManifest {
    fn default() -> Self {
        Self {
            version: 1,
            fonts: BTreeMap::new(),
        }
    }
}

pub fn fonts_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> AppResult<PathBuf> {
    let directory = app_data_dir(app)?.join("fonts");
    fs::create_dir_all(&directory)?;
    Ok(directory)
}

pub fn list<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> AppResult<Vec<InstalledFont>> {
    let directory = fonts_dir(app)?;
    let manifest = reconcile_manifest(&directory)?;

    let mut entries: Vec<InstalledFont> = manifest
        .fonts
        .into_iter()
        .map(|(id, record)| InstalledFont {
            id,
            family: record.family,
            path: directory.join(&record.file_name),
            file_name: record.file_name,
        })
        .collect();

    entries.sort_by(|left, right| {
        left.family
            .to_ascii_lowercase()
            .cmp(&right.family.to_ascii_lowercase())
    });

    Ok(entries)
}

pub fn install_bytes<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    source_name: &str,
    bytes: &[u8],
    requested_family: Option<&str>,
    progress: Option<ProgressObserver>,
) -> AppResult<InstalledFont> {
    if bytes.is_empty() || bytes.len() as u64 > MAX_FONT_BYTES {
        return Err(AppError::invalid_input(
            "Font size must be between 1 byte and 64 MiB.",
        ));
    }

    let extension = font_extension(source_name).ok_or_else(|| {
        AppError::UnsupportedMediaType(
            "Supported font formats are TTF, OTF, WOFF and WOFF2.".to_string(),
        )
    })?;

    // Same guarantee as the path-based import: the declared extension must
    // match the actual binary before any byte touches the disk.
    let signature: [u8; 4] = bytes
        .get(..4)
        .and_then(|header| header.try_into().ok())
        .ok_or_else(signature_mismatch)?;
    if !signature_matches(signature, extension) {
        return Err(signature_mismatch());
    }

    let fallback_family = file_stem(source_name);
    let family = sanitize_family(requested_family.unwrap_or(&fallback_family));

    let directory = fonts_dir(app)?;
    let mut manifest = reconcile_manifest(&directory)?;
    let id = FontId(Uuid::new_v4().to_string());
    let file_name = format!("{}.{}", id.0, extension);
    let final_path = directory.join(&file_name);
    let temp_path = directory.join(format!(".{}.tmp", Uuid::new_v4()));

    let write_result = write_font_bytes(&temp_path, bytes, progress);

    if let Err(error) = write_result {
        remove_if_exists(&temp_path);
        return Err(error);
    }

    if let Err(error) = fs::rename(&temp_path, &final_path) {
        remove_if_exists(&temp_path);
        return Err(error.into());
    }

    manifest.fonts.insert(
        id.clone(),
        FontRecord {
            family: family.clone(),
            file_name: file_name.clone(),
        },
    );

    if let Err(error) = write_manifest(&directory, &manifest) {
        remove_if_exists(&final_path);
        return Err(error);
    }

    Ok(InstalledFont {
        id,
        family,
        file_name,
        path: final_path,
    })
}

pub fn install_from_path<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    source_path: &Path,
    requested_family: Option<&str>,
    progress: Option<ProgressObserver>,
) -> AppResult<InstalledFont> {
    let source_path = fs::canonicalize(source_path)?;
    let metadata = fs::metadata(&source_path)?;

    if !metadata.is_file() {
        return Err(AppError::NotAFile(source_path));
    }
    if metadata.len() == 0 || metadata.len() > MAX_FONT_BYTES {
        return Err(AppError::invalid_input(
            "Font size must be between 1 byte and 64 MiB.",
        ));
    }

    let file_name = source_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::invalid_path("Font file name is not valid UTF-8."))?;

    let extension = font_extension(file_name).ok_or_else(|| {
        AppError::UnsupportedMediaType(
            "Supported font formats are TTF, OTF, WOFF and WOFF2.".to_string(),
        )
    })?;

    validate_font_signature(&source_path, extension)?;

    let fallback_family = file_stem(file_name);
    let family = sanitize_family(requested_family.unwrap_or(&fallback_family));

    let directory = fonts_dir(app)?;
    let mut manifest = reconcile_manifest(&directory)?;
    let id = FontId(Uuid::new_v4().to_string());
    let managed_name = format!("{}.{}", id.0, extension);
    let final_path = directory.join(&managed_name);
    let temp_path = directory.join(format!(".{}.tmp", Uuid::new_v4()));

    let copy_result = copy_font(&source_path, &temp_path, metadata.len(), progress);

    if let Err(error) = copy_result {
        remove_if_exists(&temp_path);
        return Err(error);
    }

    if let Err(error) = fs::rename(&temp_path, &final_path) {
        remove_if_exists(&temp_path);
        return Err(error.into());
    }

    manifest.fonts.insert(
        id.clone(),
        FontRecord {
            family: family.clone(),
            file_name: managed_name.clone(),
        },
    );

    if let Err(error) = write_manifest(&directory, &manifest) {
        remove_if_exists(&final_path);
        return Err(error);
    }

    Ok(InstalledFont {
        id,
        family,
        file_name: managed_name,
        path: final_path,
    })
}

/// Legacy uninstall: matches by managed file name OR family (both were valid
/// selectors in the v1 contract; the frontend still sends file names).
pub fn uninstall_by_selector<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    file_name: &str,
    family: &str,
) -> AppResult<bool> {
    let directory = fonts_dir(app)?;
    let mut manifest = reconcile_manifest(&directory)?;

    let targets: Vec<FontId> = manifest
        .fonts
        .iter()
        .filter(|(id, record)| {
            (!file_name.is_empty() && record.file_name == file_name)
                || (!file_name.is_empty() && id.0.as_str() == file_name)
                || (!family.is_empty() && record.family.eq_ignore_ascii_case(family))
        })
        .map(|(id, _)| id.clone())
        .collect();

    if targets.is_empty() {
        return Ok(false);
    }

    let mut records = Vec::new();
    for id in &targets {
        if let Some(record) = manifest.fonts.remove(id) {
            records.push((id.clone(), record));
        }
    }

    write_manifest(&directory, &manifest)?;

    let mut removed = false;
    for (id, record) in &records {
        let path = directory.join(&record.file_name);
        match fs::remove_file(&path) {
            Ok(()) => removed = true,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                removed = true;
            }
            Err(error) => {
                // Roll the manifest back so the entry is not lost while the
                // file survives on disk.
                manifest.fonts.insert(id.clone(), record.clone());
                if let Err(rollback_error) = write_manifest(&directory, &manifest) {
                    tracing::error!(error_kind = ?rollback_error.kind(), "font manifest rollback failed");
                }
                return Err(error.into());
            }
        }
    }

    Ok(removed)
}

pub fn font_extension(file_name: &str) -> Option<&'static str> {
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())?;

    FONT_EXTENSIONS
        .iter()
        .copied()
        .find(|allowed| extension.eq_ignore_ascii_case(allowed))
}

fn write_font_bytes(
    destination: &Path,
    bytes: &[u8],
    progress: Option<ProgressObserver>,
) -> AppResult<()> {
    let total = bytes.len() as u64;
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)?;
    set_private_permissions(&file)?;

    let mut written = 0_u64;
    let mut last_emit: Option<Instant> = None;
    for chunk in bytes.chunks(128 * 1024) {
        file.write_all(chunk)?;
        written += chunk.len() as u64;
        emit_progress(progress.as_ref(), &mut last_emit, written, total);
    }

    file.sync_all()?;
    emit_progress(progress.as_ref(), &mut last_emit, total, total);
    Ok(())
}

/// The final event is always emitted; intermediate ones are time-throttled so
/// large files do not flood the IPC channel (10-30 updates/s window).
fn emit_progress(
    progress: Option<&ProgressObserver>,
    last_emit: &mut Option<Instant>,
    transferred: u64,
    total: u64,
) {
    let Some(observer) = progress else {
        return;
    };

    let finished = transferred >= total;
    if !finished && last_emit.is_some_and(|instant| instant.elapsed() < PROGRESS_EMIT_INTERVAL) {
        return;
    }

    *last_emit = Some(Instant::now());
    observer(FontInstallProgress {
        transferred,
        total,
        percent: if total == 0 {
            100.0
        } else {
            (transferred as f64 / total as f64 * 100.0).clamp(0.0, 100.0)
        },
    });
}

fn copy_font(
    source_path: &Path,
    destination: &Path,
    total: u64,
    progress: Option<ProgressObserver>,
) -> AppResult<()> {
    let mut source = File::open(source_path)?;
    let mut destination = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)?;
    set_private_permissions(&destination)?;

    let mut buffer = vec![0_u8; 128 * 1024];
    let mut transferred = 0_u64;
    let mut last_emit: Option<Instant> = None;

    loop {
        let read = source.read(&mut buffer)?;
        if read == 0 {
            break;
        }

        destination.write_all(&buffer[..read])?;
        transferred += read as u64;
        emit_progress(progress.as_ref(), &mut last_emit, transferred, total);
    }

    destination.sync_all()?;
    emit_progress(progress.as_ref(), &mut last_emit, total, total);

    if transferred != total {
        return Err(AppError::Conflict(
            "The font changed while it was being imported.".to_string(),
        ));
    }

    Ok(())
}

fn signature_mismatch() -> AppError {
    AppError::UnsupportedMediaType(
        "The font signature does not match its file extension.".to_string(),
    )
}

fn validate_font_signature(path: &Path, extension: &str) -> AppResult<()> {
    let mut file = File::open(path)?;
    let mut signature = [0_u8; 4];
    file.read_exact(&mut signature)?;
    file.seek(SeekFrom::Start(0))?;

    if signature_matches(signature, extension) {
        Ok(())
    } else {
        Err(signature_mismatch())
    }
}

fn signature_matches(signature: [u8; 4], extension: &str) -> bool {
    match extension {
        "ttf" => {
            signature == [0x00, 0x01, 0x00, 0x00]
                || signature == *b"true"
                || signature == *b"typ1"
        }
        "otf" => signature == *b"OTTO",
        "woff" => signature == *b"wOFF",
        "woff2" => signature == *b"wOF2",
        _ => false,
    }
}

fn reconcile_manifest(directory: &Path) -> AppResult<FontManifest> {
    let manifest_path = directory.join("manifest.json");
    let raw = read_json_file(&manifest_path)?;

    let (mut manifest, legacy) = match raw {
        None => (FontManifest::default(), BTreeMap::new()),
        Some(ref value) => match serde_json::from_value::<FontManifest>(value.clone()) {
            Ok(manifest) if manifest.version == 1 => (manifest, BTreeMap::new()),
            _ => {
                // v1 manifest: a plain { file_name -> family } map.
                let legacy: BTreeMap<String, String> = value.clone()
                    .as_object()
                    .map(|object| {
                        object
                            .iter()
                            .filter_map(|(name, family)| {
                                family.as_str().map(|family| (name.clone(), family.to_string()))
                            })
                            .collect()
                    })
                    .unwrap_or_default();
                (FontManifest::default(), legacy)
            }
        },
    };

    let original = manifest.clone();
    manifest.fonts.retain(|id, record| {
        validate_font_id(id).is_ok()
            && validate_managed_file_name(&record.file_name, id).is_ok()
            && directory.join(&record.file_name).is_file()
    });

    let managed_names: HashSet<String> = manifest
        .fonts
        .values()
        .map(|record| record.file_name.clone())
        .collect();

    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().into_owned();
        if file_name == "manifest.json" || managed_names.contains(&file_name) {
            continue;
        }

        let Some(extension) = font_extension(&file_name) else {
            continue;
        };

        let stem = path.file_stem().and_then(|value| value.to_str());
        if stem.is_some_and(|value| Uuid::parse_str(value).is_ok()) {
            remove_if_exists(&path);
            continue;
        }

        // One corrupt stray file must not take down the whole listing: it is
        // skipped (logged) and left on disk for manual inspection.
        if let Err(error) = validate_font_signature(&path, extension) {
            tracing::warn!(
                error_kind = error.kind(),
                "stray font failed signature validation and was skipped"
            );
            continue;
        }

        let id = FontId(Uuid::new_v4().to_string());
        let managed_name = format!("{}.{}", id.0, extension);
        fs::rename(&path, directory.join(&managed_name))?;

        let family = legacy
            .get(&file_name)
            .cloned()
            .unwrap_or_else(|| {
                sanitize_family(
                    Path::new(&file_name)
                        .file_stem()
                        .and_then(|value| value.to_str())
                        .unwrap_or("Custom Font"),
                )
            });

        manifest
            .fonts
            .insert(id, FontRecord { family, file_name: managed_name });
    }

    if manifest != original || !legacy.is_empty() || raw.is_none() {
        write_manifest(directory, &manifest)?;
    }

    Ok(manifest)
}

fn write_manifest(directory: &Path, manifest: &FontManifest) -> AppResult<()> {
    write_json_file(&directory.join("manifest.json"), manifest)
}

fn validate_font_id(id: &FontId) -> AppResult<()> {
    Uuid::parse_str(&id.0)
        .map(|_| ())
        .map_err(|_| AppError::invalid_input("Invalid font identifier."))
}

fn validate_managed_file_name(file_name: &str, id: &FontId) -> AppResult<()> {
    let path = Path::new(file_name);

    if path.components().count() != 1
        || path.file_stem().and_then(|value| value.to_str()) != Some(id.0.as_str())
        || font_extension(file_name).is_none()
    {
        return Err(AppError::security("Invalid managed font path."));
    }

    Ok(())
}

fn sanitize_family(value: &str) -> String {
    let family = value
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || matches!(character, ' ' | '.' | '_' | '-') {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(96)
        .collect::<String>();

    if family.is_empty() {
        "Custom Font".to_string()
    } else {
        family
    }
}

fn file_stem(name: &str) -> String {
    Path::new(name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("Custom Font")
        .to_string()
}

fn remove_if_exists(path: &Path) {
    if let Err(error) = fs::remove_file(path) {
        if error.kind() != std::io::ErrorKind::NotFound {
            tracing::warn!(error_kind = ?error.kind(), "managed font cleanup failed");
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signature_matching_covers_all_supported_formats() {
        assert!(signature_matches([0x00, 0x01, 0x00, 0x00], "ttf"));
        assert!(signature_matches(*b"true", "ttf"));
        assert!(signature_matches(*b"OTTO", "otf"));
        assert!(signature_matches(*b"wOFF", "woff"));
        assert!(signature_matches(*b"wOF2", "woff2"));
        assert!(!signature_matches(*b"OTTO", "ttf"));
        assert!(!signature_matches([0xFF; 4], "woff2"));
    }
}
