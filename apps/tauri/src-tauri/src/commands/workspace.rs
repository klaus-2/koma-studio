use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipArchive, ZipWriter};

const WORKSPACE_FILE_EXTENSION: &str = "koma";
const WORKSPACE_AUTOSAVE_FILE_BASENAME: &str = "autosave";
const MANIFEST_PATH: &str = "manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAssetManifestEntry {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub mime_type: String,
    pub byte_length: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackageManifestV1 {
    pub package_version: u8,
    pub exported_at: String,
    pub app: String,
    pub document_version: u8,
    pub document: Value,
    pub assets: Vec<WorkspaceAssetManifestEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceBinaryAssetPayload {
    pub id: String,
    pub path: String,
    pub file_name: String,
    pub mime_type: String,
    pub buffer: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePackagePayload {
    pub manifest: WorkspacePackageManifestV1,
    pub assets: Vec<WorkspaceBinaryAssetPayload>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAutosaveLoadResult {
    pub found: bool,
    pub path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<WorkspacePackagePayload>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAutosaveSaveResult {
    pub saved: bool,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceAutosaveClearResult {
    pub cleared: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceExportResult {
    pub cancelled: bool,
    pub file_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceImportResult {
    pub cancelled: bool,
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload: Option<WorkspacePackagePayload>,
}

#[tauri::command(rename = "desktop-workspace:load-autosave")]
pub fn load_autosave<R: Runtime>(
    app: AppHandle<R>,
    user_id: Option<String>,
) -> Result<WorkspaceAutosaveLoadResult, String> {
    let file_path = workspace_autosave_path(&workspace_storage_dir(&app)?, user_id.as_deref())?;
    load_autosave_from_path(&file_path)
}

#[tauri::command(rename = "desktop-workspace:save-autosave")]
pub fn save_autosave<R: Runtime>(
    app: AppHandle<R>,
    user_id: Option<String>,
    payload: WorkspacePackagePayload,
) -> Result<WorkspaceAutosaveSaveResult, String> {
    let file_path = workspace_autosave_path(&workspace_storage_dir(&app)?, user_id.as_deref())?;
    write_workspace_package_to_file(&file_path, &payload)?;
    Ok(WorkspaceAutosaveSaveResult {
        saved: true,
        path: file_path.to_string_lossy().to_string(),
    })
}

#[tauri::command(rename = "desktop-workspace:clear-autosave")]
pub fn clear_autosave<R: Runtime>(
    app: AppHandle<R>,
    user_id: Option<String>,
) -> Result<WorkspaceAutosaveClearResult, String> {
    let file_path = workspace_autosave_path(&workspace_storage_dir(&app)?, user_id.as_deref())?;
    if file_path.exists() {
        fs::remove_file(&file_path).map_err(|error| error.to_string())?;
        return Ok(WorkspaceAutosaveClearResult { cleared: true });
    }

    Ok(WorkspaceAutosaveClearResult { cleared: false })
}

#[tauri::command(rename = "desktop-workspace:export-current")]
pub fn export_current<R: Runtime>(
    app: AppHandle<R>,
    default_file_name: String,
    payload: WorkspacePackagePayload,
) -> Result<WorkspaceExportResult, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("Exportar workspace")
        .set_file_name(default_file_name)
        .add_filter("KOMA Workspace", &[WORKSPACE_FILE_EXTENSION])
        .blocking_save_file();

    let Some(selected) = selected else {
        return Ok(WorkspaceExportResult {
            cancelled: true,
            file_path: None,
        });
    };

    let mut final_path = selected
        .into_path()
        .map_err(|_| "Invalid export path.".to_string())?;
    if final_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| !extension.eq_ignore_ascii_case(WORKSPACE_FILE_EXTENSION))
        .unwrap_or(true)
    {
        final_path.set_extension(WORKSPACE_FILE_EXTENSION);
    }

    write_workspace_package_to_file(&final_path, &payload)?;
    Ok(WorkspaceExportResult {
        cancelled: false,
        file_path: Some(final_path.to_string_lossy().to_string()),
    })
}

#[tauri::command(rename = "desktop-workspace:import-file")]
pub fn import_file<R: Runtime>(app: AppHandle<R>) -> Result<WorkspaceImportResult, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("Importar workspace")
        .add_filter("KOMA Workspace", &[WORKSPACE_FILE_EXTENSION])
        .blocking_pick_file();

    let Some(selected) = selected else {
        return Ok(WorkspaceImportResult {
            cancelled: true,
            file_path: None,
            payload: None,
        });
    };

    let file_path = selected
        .into_path()
        .map_err(|_| "Invalid import path.".to_string())?;
    let payload = read_workspace_package_from_file(&file_path)?;
    Ok(WorkspaceImportResult {
        cancelled: false,
        file_path: Some(file_path.to_string_lossy().to_string()),
        payload: Some(payload),
    })
}

pub fn workspace_storage_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let workspace_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("workspace");
    fs::create_dir_all(&workspace_dir).map_err(|error| error.to_string())?;
    Ok(workspace_dir)
}

pub fn sanitize_workspace_user_id(value: Option<&str>) -> String {
    value.unwrap_or_default().trim().chars().take(256).collect()
}

pub fn workspace_autosave_path(
    storage_dir: &Path,
    user_id: Option<&str>,
) -> Result<PathBuf, String> {
    let normalized_user_id = sanitize_workspace_user_id(user_id);
    let user_key = if normalized_user_id.is_empty() {
        "guest".to_string()
    } else {
        normalized_user_id
    };
    let digest = Sha256::digest(user_key.as_bytes());
    Ok(storage_dir.join(format!(
        "{WORKSPACE_AUTOSAVE_FILE_BASENAME}.{}.{WORKSPACE_FILE_EXTENSION}",
        hex::encode(digest)
    )))
}

pub fn load_autosave_from_path(file_path: &Path) -> Result<WorkspaceAutosaveLoadResult, String> {
    if !file_path.exists() {
        return Ok(WorkspaceAutosaveLoadResult {
            found: false,
            path: Some(file_path.to_string_lossy().to_string()),
            payload: None,
        });
    }

    Ok(WorkspaceAutosaveLoadResult {
        found: true,
        path: Some(file_path.to_string_lossy().to_string()),
        payload: Some(read_workspace_package_from_file(file_path)?),
    })
}

pub fn write_workspace_package_to_file(
    file_path: &Path,
    payload: &WorkspacePackagePayload,
) -> Result<(), String> {
    let zip_bytes = build_workspace_package_zip(payload)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let temp_path = file_path.with_extension(format!(
        "{}.{}.tmp",
        file_path
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or(WORKSPACE_FILE_EXTENSION),
        Uuid::new_v4()
    ));
    fs::write(&temp_path, zip_bytes).map_err(|error| error.to_string())?;
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|error| error.to_string())?;
    }
    fs::rename(&temp_path, file_path).map_err(|error| error.to_string())
}

pub fn read_workspace_package_from_file(
    file_path: &Path,
) -> Result<WorkspacePackagePayload, String> {
    let raw = fs::read(file_path).map_err(|_| "Could not read the workspace.".to_string())?;
    parse_workspace_package_zip(&raw)
}

pub fn build_workspace_package_zip(payload: &WorkspacePackagePayload) -> Result<Vec<u8>, String> {
    let cursor = std::io::Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(cursor);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Deflated)
        .compression_level(Some(6));

    let mut manifest = payload.manifest.clone();
    manifest.assets = manifest
        .assets
        .iter()
        .map(normalize_asset_manifest_entry)
        .collect();
    let manifest_bytes = serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?;
    zip.start_file(MANIFEST_PATH, options)
        .map_err(|error| error.to_string())?;
    zip.write_all(&manifest_bytes)
        .map_err(|error| error.to_string())?;

    for asset in &payload.assets {
        let normalized_path = normalize_asset_path(&asset.path);
        zip.start_file(normalized_path, options)
            .map_err(|error| error.to_string())?;
        zip.write_all(&asset.buffer)
            .map_err(|error| error.to_string())?;
    }

    zip.finish()
        .map(|cursor| cursor.into_inner())
        .map_err(|error| error.to_string())
}

pub fn parse_workspace_package_zip(zip_bytes: &[u8]) -> Result<WorkspacePackagePayload, String> {
    let cursor = std::io::Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|_| "Invalid workspace.".to_string())?;
    let mut manifest_file = archive
        .by_name(MANIFEST_PATH)
        .map_err(|_| "Invalid workspace: manifest.json is missing.".to_string())?;
    let mut manifest_bytes = Vec::new();
    manifest_file
        .read_to_end(&mut manifest_bytes)
        .map_err(|_| "Invalid workspace: manifest.json is corrupted.".to_string())?;
    drop(manifest_file);

    let manifest: WorkspacePackageManifestV1 = serde_json::from_slice(&manifest_bytes)
        .map_err(|_| "Invalid workspace: manifest.json is corrupted.".to_string())?;
    if manifest.package_version != 1 || manifest.document_version != 1 {
        return Err("This workspace is not compatible with this version of the app.".to_string());
    }

    let mut assets = Vec::with_capacity(manifest.assets.len());
    for entry in &manifest.assets {
        let normalized_path = normalize_asset_path(&entry.path);
        let mut file = archive
            .by_name(&normalized_path)
            .map_err(|_| format!("Invalid workspace: missing asset ({normalized_path})."))?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)
            .map_err(|_| format!("Invalid workspace: corrupted asset ({normalized_path})."))?;
        assets.push(WorkspaceBinaryAssetPayload {
            id: entry.id.clone(),
            path: normalized_path,
            file_name: entry.file_name.clone(),
            mime_type: entry.mime_type.clone(),
            buffer,
        });
    }

    Ok(WorkspacePackagePayload { manifest, assets })
}

fn normalize_asset_manifest_entry(
    entry: &WorkspaceAssetManifestEntry,
) -> WorkspaceAssetManifestEntry {
    WorkspaceAssetManifestEntry {
        id: entry.id.clone(),
        path: normalize_asset_path(&entry.path),
        file_name: entry.file_name.clone(),
        mime_type: entry.mime_type.clone(),
        byte_length: entry.byte_length,
    }
}

fn normalize_asset_path(path: &str) -> String {
    path.replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_payload() -> WorkspacePackagePayload {
        WorkspacePackagePayload {
            manifest: WorkspacePackageManifestV1 {
                package_version: 1,
                exported_at: "2026-05-20T00:00:00.000Z".to_string(),
                app: "koma-studio".to_string(),
                document_version: 1,
                document: json!({ "version": 1, "savedAt": "2026-05-20T00:00:00.000Z" }),
                assets: vec![WorkspaceAssetManifestEntry {
                    id: "asset-1".to_string(),
                    path: "assets\\page.png".to_string(),
                    file_name: "page.png".to_string(),
                    mime_type: "image/png".to_string(),
                    byte_length: 4,
                }],
            },
            assets: vec![WorkspaceBinaryAssetPayload {
                id: "asset-1".to_string(),
                path: "assets\\page.png".to_string(),
                file_name: "page.png".to_string(),
                mime_type: "image/png".to_string(),
                buffer: vec![1, 2, 3, 4],
            }],
        }
    }

    #[test]
    fn autosave_path_hashes_sanitized_user_id() {
        let path = workspace_autosave_path(Path::new("workspace"), Some(" user-1 ")).unwrap();
        assert!(path.to_string_lossy().starts_with("workspace"));
        assert!(path.to_string_lossy().ends_with(".koma"));
        assert!(!path.to_string_lossy().contains("user-1"));
    }

    #[test]
    fn load_autosave_reports_missing_path() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("missing.koma");

        let result = load_autosave_from_path(&path).unwrap();

        assert!(!result.found);
        assert_eq!(result.path, Some(path.to_string_lossy().to_string()));
        assert!(result.payload.is_none());
    }

    #[test]
    fn workspace_package_zip_roundtrips() {
        let payload = sample_payload();
        let zip = build_workspace_package_zip(&payload).unwrap();
        let parsed = parse_workspace_package_zip(&zip).unwrap();

        assert_eq!(parsed.assets[0].path, "assets/page.png");
        assert_eq!(parsed.assets[0].buffer, vec![1, 2, 3, 4]);
        assert_eq!(parsed.manifest.assets[0].path, "assets/page.png");
    }

    #[test]
    fn save_load_and_clear_autosave_file() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("autosave.test.koma");
        let payload = sample_payload();

        write_workspace_package_to_file(&path, &payload).unwrap();
        let loaded = load_autosave_from_path(&path).unwrap();
        assert!(loaded.found);
        assert_eq!(loaded.payload.unwrap().assets[0].buffer, vec![1, 2, 3, 4]);

        fs::remove_file(&path).unwrap();
        assert!(!load_autosave_from_path(&path).unwrap().found);
    }

    #[test]
    fn rejects_incompatible_workspace_package() {
        let mut payload = sample_payload();
        payload.manifest.package_version = 2;
        let zip = build_workspace_package_zip(&payload).unwrap();

        assert_eq!(
            parse_workspace_package_zip(&zip).unwrap_err(),
            "This workspace is not compatible with this version of the app."
        );
    }
}
