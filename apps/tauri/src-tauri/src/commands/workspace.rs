use std::{
    fs,
    path::{Path, PathBuf},
};

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
        WORKSPACE_FILE_EXTENSION, normalize_asset_path, read_workspace_package,
        workspace_autosave_path, write_workspace_package,
    },
    state::{AuthorizedWorkspaceAsset, WorkspaceAssetStore},
};

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
    let workspace_root = workspace_storage_dir(&app)?;
    let cache_root = app.path().app_cache_dir()?;
    let roots = [
        fs::canonicalize(workspace_root)?,
        fs::canonicalize(cache_root)?,
    ];

    let prepared = tauri::async_runtime::spawn_blocking(move || {
        items
            .into_iter()
            .map(|item| {
                let source_path = fs::canonicalize(&item.source_path)?;
                if !roots.iter().any(|root| source_path.starts_with(root)) {
                    return Err(AppError::not_allowed(
                        "Internal asset is outside the application workspace and cache.",
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
    let file_path = workspace_autosave_path(&workspace_storage_dir(&app)?, user_id.as_deref());
    if !file_path.is_file() {
        return Ok(WorkspaceAutosaveLoadResult {
            found: false,
            path: Some(file_path.to_string_lossy().into_owned()),
            payload: None,
        });
    }

    let loaded = tauri::async_runtime::spawn_blocking(move || {
        read_workspace_package(&file_path).map(|loaded| {
            (
                file_path,
                WorkspacePackagePayload {
                    manifest: loaded.manifest,
                    assets: loaded.assets,
                },
            )
        })
    })
    .await??;

    let (file_path, payload) = loaded;
    Ok(WorkspaceAutosaveLoadResult {
        found: true,
        path: Some(file_path.to_string_lossy().into_owned()),
        payload: Some(payload),
    })
}

#[tauri::command(rename = "desktop-workspace:save-autosave")]
pub async fn save_autosave(
    app: AppHandle,
    user_id: Option<String>,
    payload: WorkspacePackagePayload,
) -> AppResult<WorkspaceAutosaveSaveResult> {
    let file_path = workspace_autosave_path(&workspace_storage_dir(&app)?, user_id.as_deref());
    let output_path = file_path.clone();

    tauri::async_runtime::spawn_blocking(move || write_workspace_package(&output_path, &payload))
        .await??;

    Ok(WorkspaceAutosaveSaveResult {
        saved: true,
        path: file_path.to_string_lossy().into_owned(),
    })
}

#[tauri::command(rename = "desktop-workspace:clear-autosave")]
pub async fn clear_autosave(
    app: AppHandle,
    user_id: Option<String>,
) -> AppResult<WorkspaceAutosaveClearResult> {
    let file_path = workspace_autosave_path(&workspace_storage_dir(&app)?, user_id.as_deref());

    let cleared = tauri::async_runtime::spawn_blocking(move || -> AppResult<bool> {
        if file_path.is_file() {
            fs::remove_file(&file_path)?;
            return Ok(true);
        }
        Ok(false)
    })
    .await??;

    Ok(WorkspaceAutosaveClearResult { cleared })
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

pub fn workspace_storage_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
    let workspace_dir = app.path().app_data_dir()?.join("workspace");
    fs::create_dir_all(&workspace_dir)?;
    Ok(workspace_dir)
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
        .ok_or_else(|| AppError::invalid_path("Asset file name is not valid UTF-8."))?
        .to_string();

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
    let name = Path::new(value.trim())
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .unwrap_or("workspace.koma");

    let mut output: String = name
        .chars()
        .filter(|character| {
            !character.is_control()
                && !matches!(character, '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*')
        })
        .take(200)
        .collect();

    if output.is_empty() {
        output = "workspace.koma".to_string();
    }

    if !output
        .to_ascii_lowercase()
        .ends_with(&format!(".{WORKSPACE_FILE_EXTENSION}"))
    {
        output.push('.');
        output.push_str(WORKSPACE_FILE_EXTENSION);
    }

    output
}

fn validate_display_file_name(value: &str) -> AppResult<String> {
    if value.is_empty()
        || value.len() > 255
        || value.contains('/')
        || value.contains('\\')
        || value.contains('\0')
    {
        return Err(AppError::invalid_input("Invalid asset file name."));
    }
    Ok(value.to_string())
}

fn validate_mime(value: &str) -> AppResult<String> {
    value
        .parse::<mime::Mime>()
        .map(|mime| mime.to_string())
        .map_err(|_| AppError::invalid_input("Invalid asset MIME type."))
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
}
