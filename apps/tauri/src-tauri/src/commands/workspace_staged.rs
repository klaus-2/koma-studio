use std::{fs, io, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{
    AppHandle, State,
    ipc::{InvokeBody, Request, Response},
};
use tauri_plugin_dialog::DialogExt;

use crate::{
    commands::{
        desktop_integrations::decode_ipc_header,
        workspace::{
            sanitized_export_file_name, validate_display_file_name, validate_mime,
            workspace_storage_dir,
        },
    },
    error::{AppError, AppResult},
    models::workspace::{
        WorkspaceAssetId, WorkspaceAssetToken, WorkspaceAutosaveSaveResult, WorkspaceExportResult,
        WorkspacePackageManifestV1,
    },
    services::{
        workspace::{
            MAX_ASSET_BYTES, WORKSPACE_FILE_EXTENSION, normalize_asset_path,
            workspace_autosave_path,
        },
        workspace_staging::{
            StagedLoadedWorkspace, read_staged_workspace_package, stage_raw_bytes,
            workspace_staging_dir, write_staged_workspace_package,
        },
    },
    state::{AuthorizedWorkspaceAsset, WorkspaceAssetStore},
};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedWorkspaceAssetRef {
    pub source_token: WorkspaceAssetToken,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedAssetReceipt {
    pub source_token: WorkspaceAssetToken,
    pub sha256: String,
    pub byte_length: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedAssetDescriptor {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub mime_type: String,
    pub byte_length: u64,
    pub source_token: WorkspaceAssetToken,
    pub sha256: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedAutosaveLoadResult {
    pub found: bool,
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest: Option<WorkspacePackageManifestV1>,
    pub assets: Vec<StagedAssetDescriptor>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StagedImportResult {
    pub cancelled: bool,
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub manifest: Option<WorkspacePackageManifestV1>,
    pub assets: Vec<StagedAssetDescriptor>,
}

async fn resolve_staged_paths(
    store: &WorkspaceAssetStore,
    staging_dir: &std::path::Path,
    manifest: &WorkspacePackageManifestV1,
    assets: &[StagedWorkspaceAssetRef],
) -> AppResult<Vec<PathBuf>> {
    if manifest.assets.len() != assets.len() {
        return Err(AppError::invalid_input(
            "Workspace manifest and asset list have different lengths.",
        ));
    }
    let mut paths = Vec::with_capacity(assets.len());
    for (entry, asset) in manifest.assets.iter().zip(assets) {
        paths.push(
            store
                .resolve_staged_path(&asset.source_token, entry.byte_length, staging_dir)
                .await?,
        );
    }
    Ok(paths)
}

async fn authorize_extracted(
    store: &WorkspaceAssetStore,
    loaded: StagedLoadedWorkspace,
) -> AppResult<(WorkspacePackageManifestV1, Vec<StagedAssetDescriptor>)> {
    let mut descriptors = Vec::with_capacity(loaded.assets.len());
    for asset in loaded.assets {
        let source = store
            .authorize(AuthorizedWorkspaceAsset {
                id: WorkspaceAssetId(asset.entry.id.clone()),
                path: asset.entry.path.clone(),
                file_name: asset.entry.file_name.clone(),
                mime_type: asset.entry.mime_type.clone(),
                byte_length: asset.entry.byte_length,
                source_path: asset.path,
            })
            .await?;
        descriptors.push(StagedAssetDescriptor {
            id: asset.entry.id,
            path: asset.entry.path,
            file_name: asset.entry.file_name,
            mime_type: asset.entry.mime_type,
            byte_length: asset.entry.byte_length,
            source_token: source.source_token,
            sha256: asset.sha256,
        });
    }
    Ok((loaded.manifest, descriptors))
}

async fn pick_export_path(app: &AppHandle, default_file_name: &str) -> AppResult<Option<PathBuf>> {
    let file_name = sanitized_export_file_name(default_file_name);
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Export workspace")
            .set_file_name(file_name)
            .add_filter("KOMA Workspace", &[WORKSPACE_FILE_EXTENSION])
            .blocking_save_file()
    })
    .await?;

    let Some(selected) = selected else {
        return Ok(None);
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
    Ok(Some(final_path))
}

#[tauri::command(rename = "desktop-workspace:stage-asset-raw")]
pub async fn stage_asset_raw(
    app: AppHandle,
    store: State<'_, WorkspaceAssetStore>,
    request: Request<'_>,
) -> AppResult<StagedAssetReceipt> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::invalid_input(
            "Staged assets must be sent as raw bytes.",
        ));
    };
    if bytes.len() as u64 > MAX_ASSET_BYTES {
        return Err(AppError::invalid_input(
            "Workspace contains an oversized asset.",
        ));
    }
    let headers = request.headers();
    let id = decode_ipc_header(headers, "x-koma-asset-id")?;
    let path = normalize_asset_path(&decode_ipc_header(headers, "x-koma-asset-path")?)?;
    let file_name = validate_display_file_name(&decode_ipc_header(headers, "x-koma-file-name")?)?;
    let mime_type = validate_mime(&decode_ipc_header(headers, "x-koma-mime-type")?)?;

    let staging_dir = workspace_staging_dir(&app)?;
    let owned = bytes.clone();
    let (source_path, sha256) =
        tauri::async_runtime::spawn_blocking(move || stage_raw_bytes(&staging_dir, &owned))
            .await??;

    let source = store
        .authorize(AuthorizedWorkspaceAsset {
            id: WorkspaceAssetId(id),
            path,
            file_name,
            mime_type,
            byte_length: bytes.len() as u64,
            source_path,
        })
        .await?;

    Ok(StagedAssetReceipt {
        source_token: source.source_token,
        sha256,
        byte_length: source.byte_length,
    })
}

#[tauri::command(rename = "desktop-workspace:commit-staged-autosave")]
pub async fn commit_staged_autosave(
    app: AppHandle,
    store: State<'_, WorkspaceAssetStore>,
    user_id: Option<String>,
    manifest: WorkspacePackageManifestV1,
    assets: Vec<StagedWorkspaceAssetRef>,
) -> AppResult<WorkspaceAutosaveSaveResult> {
    let root = workspace_storage_dir(&app)?;
    let staging_dir = workspace_staging_dir(&app)?;
    let staged = resolve_staged_paths(&store, &staging_dir, &manifest, &assets).await?;

    tauri::async_runtime::spawn_blocking(move || {
        fs::create_dir_all(&root)?;
        let file_path = workspace_autosave_path(&root, user_id.as_deref());
        write_staged_workspace_package(&file_path, &manifest, &staged)?;
        Ok(WorkspaceAutosaveSaveResult {
            saved: true,
            path: file_path.to_string_lossy().into_owned(),
        })
    })
    .await?
}

#[tauri::command(rename = "desktop-workspace:commit-staged-export")]
pub async fn commit_staged_export(
    app: AppHandle,
    store: State<'_, WorkspaceAssetStore>,
    default_file_name: String,
    manifest: WorkspacePackageManifestV1,
    assets: Vec<StagedWorkspaceAssetRef>,
) -> AppResult<WorkspaceExportResult> {
    let staging_dir = workspace_staging_dir(&app)?;
    let staged = resolve_staged_paths(&store, &staging_dir, &manifest, &assets).await?;

    let Some(final_path) = pick_export_path(&app, &default_file_name).await? else {
        return Ok(WorkspaceExportResult {
            cancelled: true,
            file_path: None,
        });
    };

    let output_path = final_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        write_staged_workspace_package(&output_path, &manifest, &staged)
    })
    .await??;

    Ok(WorkspaceExportResult {
        cancelled: false,
        file_path: Some(final_path.to_string_lossy().into_owned()),
    })
}

#[tauri::command(rename = "desktop-workspace:load-autosave-staged")]
pub async fn load_autosave_staged(
    app: AppHandle,
    store: State<'_, WorkspaceAssetStore>,
    user_id: Option<String>,
) -> AppResult<StagedAutosaveLoadResult> {
    let root = workspace_storage_dir(&app)?;
    let staging_dir = workspace_staging_dir(&app)?;
    let file_path = workspace_autosave_path(&root, user_id.as_deref());
    let path = file_path.to_string_lossy().into_owned();

    let loaded = tauri::async_runtime::spawn_blocking(move || match fs::metadata(&file_path) {
        Ok(metadata) if metadata.is_file() => {
            read_staged_workspace_package(&file_path, &staging_dir).map(Some)
        }
        Ok(_) => Err(AppError::invalid_path(
            "Autosave path is not a regular file.",
        )),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    })
    .await??;

    let Some(loaded) = loaded else {
        return Ok(StagedAutosaveLoadResult {
            found: false,
            path: Some(path),
            manifest: None,
            assets: Vec::new(),
        });
    };

    let (manifest, assets) = authorize_extracted(&store, loaded).await?;
    Ok(StagedAutosaveLoadResult {
        found: true,
        path: Some(path),
        manifest: Some(manifest),
        assets,
    })
}

#[tauri::command(rename = "desktop-workspace:import-file-staged")]
pub async fn import_file_staged(
    app: AppHandle,
    store: State<'_, WorkspaceAssetStore>,
) -> AppResult<StagedImportResult> {
    let staging_dir = workspace_staging_dir(&app)?;
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Import workspace")
            .add_filter("KOMA Workspace", &[WORKSPACE_FILE_EXTENSION])
            .blocking_pick_file()
    })
    .await?;

    let Some(selected) = selected else {
        return Ok(StagedImportResult {
            cancelled: true,
            file_path: None,
            manifest: None,
            assets: Vec::new(),
        });
    };

    let file_path = selected
        .into_path()
        .map_err(|_| AppError::invalid_path("Invalid import path."))?;
    let input_path = file_path.clone();
    let loaded = tauri::async_runtime::spawn_blocking(move || {
        read_staged_workspace_package(&input_path, &staging_dir)
    })
    .await??;

    let (manifest, assets) = authorize_extracted(&store, loaded).await?;
    Ok(StagedImportResult {
        cancelled: false,
        file_path: Some(file_path.to_string_lossy().into_owned()),
        manifest: Some(manifest),
        assets,
    })
}

#[tauri::command(rename = "desktop-workspace:read-staged-asset")]
pub async fn read_staged_asset(
    app: AppHandle,
    store: State<'_, WorkspaceAssetStore>,
    asset_id: String,
    source_token: String,
) -> AppResult<Response> {
    let token = WorkspaceAssetToken(source_token);
    let asset = store
        .resolve_token(&WorkspaceAssetId(asset_id), &token)
        .await?;
    let staging_dir = workspace_staging_dir(&app)?;
    let path = store
        .resolve_staged_path(&token, asset.byte_length, &staging_dir)
        .await?;
    let bytes = tauri::async_runtime::spawn_blocking(move || fs::read(path)).await??;
    Ok(Response::new(bytes))
}
