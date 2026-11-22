use std::{
    fs, io,
    path::{Path, PathBuf},
    time::SystemTime,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, Runtime, State};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::workspace::{
        InternalAssetRegistration, WorkspaceAssetId, WorkspaceAssetSelectionResult,
        WorkspaceAssetSource, WorkspaceAutosaveClearResult, WorkspaceAutosaveLoadResult,
        WorkspaceAutosaveSaveResult, WorkspaceExportResult, WorkspaceImportResult,
        WorkspacePackagePayload,
    },
    services::workspace::{
        WORKSPACE_BACKUP_DIR_NAME, WORKSPACE_FILE_EXTENSION, atomic_replace, normalize_asset_path,
        parse_backup_live_name, read_workspace_package, workspace_autosave_path,
        write_workspace_package,
    },
    state::{AuthorizedWorkspaceAsset, WorkspaceAssetStore},
};

const MAX_ASSET_REGISTRATION_BATCH: usize = 256;
const MAX_DISPLAY_FILE_NAME_BYTES: usize = 255;
const MAX_EXPORT_FILE_NAME_BYTES: usize = 200;
const MAX_MIME_BYTES: usize = 255;
const MAX_BACKUP_FILE_NAME_BYTES: usize = 255;

#[tauri::command(rename = "desktop-workspace:select-assets")]
pub async fn select_asset_files(
    app: AppHandle,
    store: State<'_, WorkspaceAssetStore>,
) -> AppResult<WorkspaceAssetSelectionResult> {
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Selecionar assets")
            .blocking_pick_files()
    })
    .await?;

    let Some(selected) = selected else {
        return Ok(WorkspaceAssetSelectionResult {
            cancelled: true,
            assets: Vec::new(),
        });
    };

    if selected.len() > MAX_ASSET_REGISTRATION_BATCH {
        return Err(AppError::invalid_input(
            "Selected asset batch exceeds the supported size.",
        ));
    }

    let paths = selected
        .into_iter()
        .map(|path| {
            path.into_path()
                .map_err(|_| AppError::invalid_path("Invalid selected asset path."))
        })
        .collect::<AppResult<Vec<_>>>()?;

    let prepared = tauri::async_runtime::spawn_blocking(move || {
        paths
            .into_iter()
            .map(prepare_selected_asset)
            .collect::<AppResult<Vec<_>>>()
    })
    .await??;

    let mut assets = Vec::with_capacity(prepared.len());
    for asset in prepared {
        assets.push(store.authorize(asset).await?);
    }

    Ok(WorkspaceAssetSelectionResult {
        cancelled: false,
        assets,
    })
}

#[tauri::command(rename = "desktop-workspace:register-internal-assets")]
pub async fn register_internal_assets(
    app: AppHandle,
    store: State<'_, WorkspaceAssetStore>,
    items: Vec<InternalAssetRegistration>,
) -> AppResult<Vec<WorkspaceAssetSource>> {
    if items.len() > MAX_ASSET_REGISTRATION_BATCH {
        return Err(AppError::invalid_input(
            "Internal asset batch exceeds the supported size.",
        ));
    }

    let workspace_root = workspace_storage_dir(&app)?;
    let cache_root = app.path().app_cache_dir()?;

    let prepared = tauri::async_runtime::spawn_blocking(move || {
        fs::create_dir_all(&workspace_root)?;
        fs::create_dir_all(&cache_root)?;

        let roots = [
            fs::canonicalize(workspace_root)?,
            fs::canonicalize(cache_root)?,
        ];

        items
            .into_iter()
            .map(|item| {
                let source_path = fs::canonicalize(&item.source_path)?;

                if !roots.iter().any(|root| source_path.starts_with(root)) {
                    tracing::warn!(
                        operation = "register_internal_workspace_asset",
                        "internal asset is outside authorized roots"
                    );

                    return Err(AppError::not_allowed(
                        "Internal asset is outside application storage.",
                    ));
                }

                let metadata = fs::metadata(&source_path)?;

                if !metadata.is_file() {
                    return Err(AppError::invalid_path(
                        "Internal asset is not a regular file.",
                    ));
                }

                Ok(AuthorizedWorkspaceAsset {
                    id: item.id,
                    path: normalize_asset_path(&item.path)?,
                    file_name: validate_display_file_name(&item.file_name)?,
                    mime_type: validate_mime(&item.mime_type)?,
                    byte_length: metadata.len(),
                    source_path,
                })
            })
            .collect::<AppResult<Vec<_>>>()
    })
    .await??;

    let mut output = Vec::with_capacity(prepared.len());

    for asset in prepared {
        output.push(store.authorize(asset).await?);
    }

    Ok(output)
}

#[tauri::command(rename = "desktop-workspace:load-autosave")]
pub async fn load_autosave(
    app: AppHandle,
    user_id: Option<String>,
) -> AppResult<WorkspaceAutosaveLoadResult> {
    let root = workspace_storage_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        let file_path = workspace_autosave_path(&root, user_id.as_deref());

        let metadata = match fs::metadata(&file_path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                return Ok(WorkspaceAutosaveLoadResult {
                    found: false,
                    path: Some(file_path.to_string_lossy().into_owned()),
                    payload: None,
                });
            }
            Err(error) => {
                tracing::error!(
                    operation = "load_workspace_autosave",
                    error_kind = ?error.kind(),
                    "failed to inspect autosave"
                );

                return Err(error.into());
            }
        };

        if !metadata.is_file() {
            return Err(AppError::invalid_path(
                "Autosave path is not a regular file.",
            ));
        }

        let loaded = read_workspace_package(&file_path)?;

        Ok(WorkspaceAutosaveLoadResult {
            found: true,
            path: Some(file_path.to_string_lossy().into_owned()),
            payload: Some(WorkspacePackagePayload {
                manifest: loaded.manifest,
                assets: loaded.assets,
            }),
        })
    })
    .await?
}

#[tauri::command(rename = "desktop-workspace:save-autosave")]
pub async fn save_autosave(
    app: AppHandle,
    user_id: Option<String>,
    payload: WorkspacePackagePayload,
) -> AppResult<WorkspaceAutosaveSaveResult> {
    let root = workspace_storage_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        fs::create_dir_all(&root)?;

        let file_path =
            workspace_autosave_path(&root, user_id.as_deref());

        write_workspace_package(&file_path, &payload)?;

        Ok(WorkspaceAutosaveSaveResult {
            saved: true,
            path: file_path.to_string_lossy().into_owned(),
        })
    })
    .await?
}

#[tauri::command(rename = "desktop-workspace:clear-autosave")]
pub async fn clear_autosave(
    app: AppHandle,
    user_id: Option<String>,
) -> AppResult<WorkspaceAutosaveClearResult> {
    let root = workspace_storage_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        let file_path =
            workspace_autosave_path(&root, user_id.as_deref());

        match fs::remove_file(file_path) {
            Ok(()) => Ok(WorkspaceAutosaveClearResult {
                cleared: true,
            }),
            Err(error) if error.kind() == io::ErrorKind::NotFound => {
                Ok(WorkspaceAutosaveClearResult {
                    cleared: false,
                })
            }
            Err(error) => {
                tracing::error!(
                    operation = "clear_workspace_autosave",
                    error_kind = ?error.kind(),
                    "failed to remove autosave"
                );

                Err(error.into())
            }
        }
    })
    .await?
}

#[tauri::command(rename = "desktop-workspace:export-current")]
pub async fn export_current(
    app: AppHandle,
    default_file_name: String,
    payload: WorkspacePackagePayload,
) -> AppResult<WorkspaceExportResult> {
    let file_name = sanitized_export_file_name(&default_file_name);
    let dialog_app = app.clone();

    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Exportar workspace")
            .set_file_name(file_name)
            .add_filter("KOMA Workspace", &[WORKSPACE_FILE_EXTENSION])
            .blocking_save_file()
    })
    .await?;

    let Some(selected) = selected else {
        return Ok(WorkspaceExportResult {
            cancelled: true,
            file_path: None,
        });
    };

    let mut final_path = selected
        .into_path()
        .map_err(|_| AppError::invalid_path("Invalid export path."))?;
    if !final_path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case(WORKSPACE_FILE_EXTENSION))
    {
        final_path.set_extension(WORKSPACE_FILE_EXTENSION);
    }

    let output_path = final_path.clone();
    tauri::async_runtime::spawn_blocking(move || write_workspace_package(&output_path, &payload))
        .await??;

    Ok(WorkspaceExportResult {
        cancelled: false,
        file_path: Some(final_path.to_string_lossy().into_owned()),
    })
}

#[tauri::command(rename = "desktop-workspace:import-file")]
pub async fn import_file(app: AppHandle) -> AppResult<WorkspaceImportResult> {
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Importar workspace")
            .add_filter("KOMA Workspace", &[WORKSPACE_FILE_EXTENSION])
            .blocking_pick_file()
    })
    .await?;

    let Some(selected) = selected else {
        return Ok(WorkspaceImportResult {
            cancelled: true,
            file_path: None,
            payload: None,
        });
    };

    let file_path = selected
        .into_path()
        .map_err(|_| AppError::invalid_path("Invalid import path."))?;
    let input_path = file_path.clone();
    let payload =
        tauri::async_runtime::spawn_blocking(move || read_workspace_package(&input_path)).await??;

    Ok(WorkspaceImportResult {
        cancelled: false,
        file_path: Some(file_path.to_string_lossy().into_owned()),
        payload: Some(WorkspacePackagePayload {
            manifest: payload.manifest,
            assets: payload.assets,
        }),
    })
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBackupEntry {
    pub file_name: String,
    pub path: String,
    pub size_bytes: u64,
    pub modified_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBackupListResult {
    pub backups: Vec<DesktopBackupEntry>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBackupRestorePayload {
    pub file_name: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBackupRestoreResult {
    pub ok: bool,
    pub error: Option<String>,
}

#[tauri::command(rename = "desktop-workspace:list-backups")]
pub async fn list_backups(app: AppHandle) -> AppResult<DesktopBackupListResult> {
    let root = workspace_storage_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || list_workspace_backups_at(&root)).await?
}

#[tauri::command(rename = "desktop-workspace:restore-backup")]
pub async fn restore_backup(
    app: AppHandle,
    payload: DesktopBackupRestorePayload,
) -> AppResult<DesktopBackupRestoreResult> {
    let root = workspace_storage_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        Ok(restore_workspace_backup_at(&root, &payload.file_name))
    })
    .await?
}

fn list_workspace_backups_at(storage_dir: &Path) -> AppResult<DesktopBackupListResult> {
    let backups_dir = storage_dir.join(WORKSPACE_BACKUP_DIR_NAME);

    let entries = match fs::read_dir(&backups_dir) {
        Ok(entries) => entries,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(DesktopBackupListResult {
                backups: Vec::new(),
            });
        }
        Err(error) => return Err(error.into()),
    };

    let mut backups: Vec<(SystemTime, DesktopBackupEntry)> = Vec::new();

    for entry in entries {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if !metadata.is_file() {
            continue;
        }
        let file_name = match entry.file_name().into_string() {
            Ok(file_name) => file_name,
            Err(_) => continue,
        };
        if !file_name.ends_with(".backup") {
            continue;
        }
        if parse_backup_live_name(&file_name).is_none() {
            continue;
        }
        let modified = metadata.modified()?;
        backups.push((
            modified,
            DesktopBackupEntry {
                path: entry.path().to_string_lossy().into_owned(),
                file_name,
                size_bytes: metadata.len(),
                modified_at: chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339(),
            },
        ));
    }

    backups.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.file_name.cmp(&b.1.file_name)));

    Ok(DesktopBackupListResult {
        backups: backups.into_iter().map(|(_, entry)| entry).collect(),
    })
}

fn restore_workspace_backup_at(
    storage_dir: &Path,
    backup_file_name: &str,
) -> DesktopBackupRestoreResult {
    match restore_workspace_backup_inner(storage_dir, backup_file_name) {
        Ok(()) => DesktopBackupRestoreResult {
            ok: true,
            error: None,
        },
        Err(message) => DesktopBackupRestoreResult {
            ok: false,
            error: Some(message),
        },
    }
}

fn restore_workspace_backup_inner(
    storage_dir: &Path,
    backup_file_name: &str,
) -> Result<(), String> {
    let trimmed = backup_file_name.trim();
    if trimmed != backup_file_name
        || trimmed.is_empty()
        || trimmed.len() > MAX_BACKUP_FILE_NAME_BYTES
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains(':')
        || trimmed.contains("..")
        || trimmed.contains('\0')
    {
        return Err("Invalid backup file name.".to_owned());
    }

    let Some(live_name) = parse_backup_live_name(trimmed) else {
        return Err("Unknown backup file.".to_owned());
    };

    if live_name == WORKSPACE_BACKUP_DIR_NAME {
        return Err("Invalid backup file name.".to_owned());
    }

    let backup_path = storage_dir.join(WORKSPACE_BACKUP_DIR_NAME).join(trimmed);
    let backup_metadata = match fs::metadata(&backup_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Err("Backup not found.".to_owned());
        }
        Err(error) => {
            tracing::error!(
                error_kind = ?error.kind(),
                "failed to inspect the workspace backup"
            );
            return Err("The backup could not be read.".to_owned());
        }
    };
    if !backup_metadata.is_file() {
        return Err("Backup not found.".to_owned());
    }

    let live_path = storage_dir.join(&live_name);
    let temp_path = storage_dir.join(format!(
        ".{live_name}.{}.restore.tmp",
        Uuid::new_v4()
    ));

    if let Err(error) = fs::copy(&backup_path, &temp_path) {
        tracing::error!(
            error_kind = ?error.kind(),
            "failed to stage the workspace backup copy"
        );
        return Err("The backup could not be staged.".to_owned());
    }

    if let Err(error) = atomic_replace(&temp_path, &live_path) {
        tracing::error!(
            error = %error,
            "failed to restore the workspace backup"
        );
        let _ = fs::remove_file(&temp_path);
        return Err("The workspace file could not be restored.".to_owned());
    }

    Ok(())
}

pub fn workspace_storage_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    // Pure path resolution: directories are created by the blocking workers
    // that actually write, never on the async executor.
    Ok(app.path().app_data_dir()?.join("workspace"))
}

fn prepare_selected_asset(path: PathBuf) -> AppResult<AuthorizedWorkspaceAsset> {
    let source_path = fs::canonicalize(path)?;
    let metadata = fs::metadata(&source_path)?;

    if !metadata.is_file() {
        return Err(AppError::invalid_path(
            "Selected asset is not a regular file.",
        ));
    }

    let file_name = source_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::invalid_path("Asset file name is not valid UTF-8."))?;

    let file_name = validate_display_file_name(file_name)?;

    let inferred = infer::get_from_path(&source_path)
        .map_err(|error| AppError::internal("Asset sniffing failed.", error))?
        .map(|kind| kind.mime_type().to_string())
        .unwrap_or_else(|| {
            mime_guess::from_path(&source_path)
                .first_or_octet_stream()
                .to_string()
        });

    let id = WorkspaceAssetId(Uuid::new_v4().to_string());
    let extension = source_path
        .extension()
        .and_then(|extension| extension.to_str())
        .filter(|extension| {
            !extension.is_empty()
                && extension
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric())
        });

    let archive_name = match extension {
        Some(extension) => format!("{}.{}", id.0, extension.to_ascii_lowercase()),
        None => id.0.clone(),
    };

    Ok(AuthorizedWorkspaceAsset {
        id,
        path: format!("assets/{archive_name}"),
        file_name,
        mime_type: inferred,
        byte_length: metadata.len(),
        source_path,
    })
}

fn sanitized_export_file_name(value: &str) -> String {
    let candidate = value
        .trim()
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or_default();

    let mut name: String = candidate
        .chars()
        .filter(|character| {
            !character.is_control()
                && !matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
        .collect();

    name = name.trim_matches([' ', '.']).to_owned();

    let extension = format!(".{WORKSPACE_FILE_EXTENSION}");

    if name
        .get(name.len().saturating_sub(extension.len())..)
        .is_some_and(|suffix| suffix.eq_ignore_ascii_case(&extension))
    {
        name.truncate(name.len() - extension.len());
        name = name.trim_matches([' ', '.']).to_owned();
    }

    if name.is_empty() {
        name.push_str("workspace");
    }

    if is_windows_reserved_file_name(&name) {
        name.insert(0, '_');
    }

    let stem_limit = MAX_EXPORT_FILE_NAME_BYTES
        .saturating_sub(extension.len());

    truncate_utf8(&mut name, stem_limit);

    name = name.trim_end_matches([' ', '.']).to_owned();

    if name.is_empty() {
        name.push_str("workspace");
    }

    name.push_str(&extension);
    name
}

fn truncate_utf8(value: &mut String, max_bytes: usize) {
    if value.len() <= max_bytes {
        return;
    }

    let mut boundary = max_bytes;

    while !value.is_char_boundary(boundary) {
        boundary -= 1;
    }

    value.truncate(boundary);
}

fn is_windows_reserved_file_name(value: &str) -> bool {
    let stem = value
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end_matches(' ')
        .to_ascii_uppercase();

    if matches!(
        stem.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CONIN$" | "CONOUT$"
    ) {
        return true;
    }

    ["COM", "LPT"].iter().any(|prefix| {
        stem.strip_prefix(prefix).is_some_and(|suffix| {
            matches!(
                suffix,
                "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
                    | "¹" | "²" | "³"
            )
        })
    })
}

fn validate_display_file_name(value: &str) -> AppResult<String> {
    if value.is_empty()
        || value.len() > MAX_DISPLAY_FILE_NAME_BYTES
        || value.chars().any(char::is_control)
        || value.contains('/')
        || value.contains('\\')
        || matches!(value, "." | "..")
    {
        return Err(AppError::invalid_input(
            "Invalid asset file name.",
        ));
    }

    Ok(value.to_owned())
}

fn validate_mime(value: &str) -> AppResult<String> {
    if value.is_empty()
        || value.len() > MAX_MIME_BYTES
        || value.chars().any(char::is_control)
    {
        return Err(AppError::invalid_input(
            "Invalid asset MIME type.",
        ));
    }

    value
        .parse::<mime::Mime>()
        .map(|mime| mime.to_string())
        .map_err(|_| {
            AppError::invalid_input("Invalid asset MIME type.")
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn sanitized_export_file_name_strips_path_and_bad_chars() {
        assert_eq!(sanitized_export_file_name(" a<b>.koma "), "ab.koma");
        assert_eq!(sanitized_export_file_name("../../x"), "x.koma");
        assert_eq!(sanitized_export_file_name(""), "workspace.koma");
        assert_eq!(sanitized_export_file_name("page"), "page.koma");
    }

    #[test]
    fn export_file_name_handles_both_path_separators() {
        assert_eq!(
            sanitized_export_file_name(r"C:\folder\page.koma"),
            "page.koma"
        );

        assert_eq!(
            sanitized_export_file_name("/folder/page.koma"),
            "page.koma"
        );
    }

    #[test]
    fn export_file_name_rejects_windows_reserved_names() {
        assert_eq!(sanitized_export_file_name("CON"), "_CON.koma");
        assert_eq!(sanitized_export_file_name("nul.koma"), "_nul.koma");
        assert_eq!(sanitized_export_file_name("COM1"), "_COM1.koma");
        assert_eq!(sanitized_export_file_name("LPT9"), "_LPT9.koma");
    }

    #[test]
    fn export_file_name_removes_trailing_dots_and_spaces() {
        assert_eq!(
            sanitized_export_file_name("page...   "),
            "page.koma"
        );

        assert_eq!(
            sanitized_export_file_name("..."),
            "workspace.koma"
        );
    }

    #[test]
    fn export_file_name_limits_bytes_without_breaking_utf8() {
        let input = "界".repeat(200);
        let output = sanitized_export_file_name(&input);

        assert!(output.len() <= MAX_EXPORT_FILE_NAME_BYTES);
        assert!(output.ends_with(".koma"));
        assert!(std::str::from_utf8(output.as_bytes()).is_ok());
    }

    #[test]
    fn display_file_name_rejects_controls_and_dot_entries() {
        for value in ["", ".", "..", "line\nbreak.png", "tab\tname.png"] {
            assert!(validate_display_file_name(value).is_err());
        }
    }

    #[test]
    fn mime_validation_rejects_controls_and_oversized_input() {
        assert!(validate_mime("image/png\r\nx-header: value").is_err());
        assert!(validate_mime(&"a".repeat(MAX_MIME_BYTES + 1)).is_err());
    }

    #[test]
    fn sample_payload_roundtrips_through_the_service() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("autosave.test.koma");

        let payload = WorkspacePackagePayload {
            manifest: crate::models::workspace::WorkspacePackageManifestV1 {
                package_version: 1,
                exported_at: "2026-05-20T00:00:00.000Z".to_string(),
                app: "koma-studio".to_string(),
                document_version: 1,
                document: json!({ "version": 1 }),
                assets: vec![crate::models::workspace::WorkspaceAssetManifestEntry {
                    id: "asset-1".to_string(),
                    path: "assets\\page.png".to_string(),
                    file_name: "page.png".to_string(),
                    mime_type: "image/png".to_string(),
                    byte_length: 4,
                }],
            },
            assets: vec![crate::models::workspace::WorkspaceBinaryAssetPayload {
                id: "asset-1".to_string(),
                path: "assets\\page.png".to_string(),
                file_name: "page.png".to_string(),
                mime_type: "image/png".to_string(),
                buffer: vec![1, 2, 3, 4],
            }],
        };

        write_workspace_package(&path, &payload).unwrap();
        let loaded = read_workspace_package(&path).unwrap();
        assert_eq!(loaded.assets[0].buffer, vec![1, 2, 3, 4]);
        assert_eq!(loaded.manifest.assets[0].path, "assets/page.png");
    }

    #[test]
    fn service_rejects_oversized_declared_asset() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("bad.koma");

        let payload = WorkspacePackagePayload {
            manifest: crate::models::workspace::WorkspacePackageManifestV1 {
                package_version: 1,
                exported_at: String::new(),
                app: "koma".to_string(),
                document_version: 1,
                document: json!({}),
                assets: vec![crate::models::workspace::WorkspaceAssetManifestEntry {
                    id: "a".to_string(),
                    path: "assets/a.png".to_string(),
                    file_name: "a.png".to_string(),
                    mime_type: "image/png".to_string(),
                    byte_length: (512 * 1024 * 1024) + 1,
                }],
            },
            assets: vec![crate::models::workspace::WorkspaceBinaryAssetPayload {
                id: "a".to_string(),
                path: "assets/a.png".to_string(),
                file_name: "a.png".to_string(),
                mime_type: "image/png".to_string(),
                buffer: vec![0_u8; 8],
            }],
        };

        let error = write_workspace_package(&path, &payload).unwrap_err();
        assert!(matches!(error, AppError::InvalidInput(_)));
    }

    fn write_backup_with_mtime(
        storage_dir: &Path,
        file_name: &str,
        contents: &[u8],
        modified: SystemTime,
    ) -> PathBuf {
        let backups_dir = storage_dir.join(WORKSPACE_BACKUP_DIR_NAME);
        fs::create_dir_all(&backups_dir).unwrap();
        let path = backups_dir.join(file_name);
        fs::write(&path, contents).unwrap();
        let file = fs::File::options().write(true).open(&path).unwrap();
        file.set_modified(modified).unwrap();
        path
    }

    #[test]
    fn list_workspace_backups_sorts_newest_first() {
        let temp = tempfile::tempdir().unwrap();
        let storage = temp.path();
        let base = SystemTime::UNIX_EPOCH + std::time::Duration::from_secs(1_700_000_000);

        let oldest_name = format!("autosave.aaa.koma.{}.backup", Uuid::new_v4());
        let middle_name = format!("autosave.bbb.koma.{}.backup", Uuid::new_v4());
        let newest_name = format!("autosave.ccc.koma.{}.backup", Uuid::new_v4());

        write_backup_with_mtime(storage, &oldest_name, b"a", base);
        write_backup_with_mtime(storage, &middle_name, b"bb", base + std::time::Duration::from_secs(2));
        write_backup_with_mtime(storage, &newest_name, b"ccc", base + std::time::Duration::from_secs(4));

        let result = list_workspace_backups_at(storage).unwrap();

        assert_eq!(
            result
                .backups
                .iter()
                .map(|entry| entry.file_name.as_str())
                .collect::<Vec<_>>(),
            vec![
                newest_name.as_str(),
                middle_name.as_str(),
                oldest_name.as_str()
            ]
        );
        assert_eq!(result.backups[0].size_bytes, 3);
        assert_eq!(
            result.backups[0].path,
            storage
                .join(WORKSPACE_BACKUP_DIR_NAME)
                .join(&newest_name)
                .to_string_lossy()
        );
        let parsed = chrono::DateTime::parse_from_rfc3339(&result.backups[0].modified_at).unwrap();
        assert_eq!(parsed.timestamp_millis(), 1_700_000_004_000);
    }

    #[test]
    fn list_workspace_backups_without_directory_is_empty() {
        let temp = tempfile::tempdir().unwrap();
        let result = list_workspace_backups_at(temp.path()).unwrap();
        assert!(result.backups.is_empty());
    }

    #[test]
    fn restore_backup_overwrites_the_live_file() {
        let temp = tempfile::tempdir().unwrap();
        let storage = temp.path();
        let live = storage.join("autosave.h1.koma");
        fs::write(&live, b"v1").unwrap();

        let backup_name = format!("autosave.h1.koma.{}.backup", Uuid::new_v4());
        write_backup_with_mtime(storage, &backup_name, b"v2", SystemTime::now());

        let result = restore_workspace_backup_at(storage, &backup_name);

        assert_eq!(
            result,
            DesktopBackupRestoreResult {
                ok: true,
                error: None,
            }
        );
        assert_eq!(fs::read(&live).unwrap(), b"v2");

        let leftovers: Vec<_> = fs::read_dir(storage)
            .unwrap()
            .filter_map(|entry| entry.ok())
            .filter(|entry| {
                entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| name.ends_with(".tmp"))
            })
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn restore_backup_rejects_traversal_missing_and_malformed_names() {
        let temp = tempfile::tempdir().unwrap();
        let storage = temp.path();

        for name in [
            "../escape.backup".to_owned(),
            "nested/dir.backup".to_owned(),
            format!("missing.koma.{}.backup", Uuid::new_v4()),
            "garbage.backup".to_owned(),
            format!("{}.{}.backup", WORKSPACE_BACKUP_DIR_NAME, Uuid::new_v4()),
        ] {
            let result = restore_workspace_backup_at(storage, &name);
            assert!(!result.ok, "restore must fail for {name}");
            assert!(result.error.is_some());
        }
    }
}
