use futures_util::future::try_join_all;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager, Runtime};

use super::binary_delta;
use super::cas::{extension_from_name, CasStore, CasWriteReport};
use super::manifest::{
    parse_manifest, validate_manifest, verify_chunk_proof, verify_hash, BinaryDelta,
    IncrementalUpdateManifest, ManifestValidationReport,
};
use super::vcdiff;

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IncrementalUpdateRequest {
    pub manifest_url: Option<String>,
    pub public_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncrementalCheckReport {
    pub available: bool,
    pub current_version: String,
    pub manifest_version: String,
    pub manifest_url: Option<String>,
    pub validation: ManifestValidationReport,
    pub chunk_count: usize,
    pub missing_chunk_count: usize,
    pub binary_delta_count: usize,
    pub model_delta_count: usize,
    pub model_delta_status: vcdiff::VcdiffApplyReport,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncrementalDownloadReport {
    pub manifest_version: String,
    pub downloaded_chunks: usize,
    pub reused_chunks: usize,
    pub bytes_downloaded: u64,
    pub downloaded_binary_deltas: usize,
    pub binary_delta_bytes: u64,
    pub staged_manifest_path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncrementalApplyReport {
    pub active_version: String,
    pub previous_version: Option<String>,
    pub manifest_path: String,
    pub reloaded_webviews: usize,
    pub binary_deltas_applied: usize,
    pub binary_deltas_skipped: usize,
    pub gc_removed_chunks: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BinaryDeltaApplyReport {
    applied: usize,
    skipped: usize,
}

pub async fn check<R: Runtime>(
    app: &AppHandle<R>,
    request: IncrementalUpdateRequest,
) -> Result<(IncrementalUpdateManifest, IncrementalCheckReport), String> {
    let current_version = app.package_info().version.to_string();
    let manifest_url = resolve_manifest_url(request.manifest_url.as_deref())?;
    let mut manifest = fetch_manifest(&manifest_url).await?;
    if manifest
        .base_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        manifest.base_url = Some(base_url_from_manifest_url(&manifest_url)?);
    }
    let validation = validate_manifest(&manifest, request.public_key.as_deref())?;
    let store = CasStore::from_app(app)?;
    let missing_chunk_count = manifest
        .chunks
        .iter()
        .filter(|(name, chunk)| {
            store
                .chunk_path(&chunk.hash, extension_from_name(name))
                .map(|path| !path.exists())
                .unwrap_or(true)
        })
        .count();
    let report = IncrementalCheckReport {
        available: normalize_version(&manifest.version) != normalize_version(&current_version),
        current_version,
        manifest_version: manifest.version.clone(),
        manifest_url: Some(manifest_url),
        chunk_count: manifest.chunks.len(),
        missing_chunk_count,
        binary_delta_count: manifest.binary_deltas.len(),
        model_delta_count: manifest.model_deltas.len(),
        model_delta_status: vcdiff::apply_vcdiff_placeholder(),
        validation,
    };
    Ok((manifest, report))
}

pub async fn download<R: Runtime>(
    app: &AppHandle<R>,
    manifest: &IncrementalUpdateManifest,
    public_key: Option<&str>,
) -> Result<IncrementalDownloadReport, String> {
    validate_manifest(manifest, public_key)?;
    let store = CasStore::from_app(app)?;
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|error| error.to_string())?;
    let base_url = manifest.base_url.clone();
    let merkle_root = manifest.merkle_root.clone();

    let futures = manifest.chunks.iter().map(|(name, chunk)| {
        let client = client.clone();
        let store = store.clone();
        let base_url = base_url.clone();
        let merkle_root = merkle_root.clone();
        let name = name.clone();
        let chunk = chunk.clone();
        async move {
            verify_chunk_proof(&chunk, &merkle_root)?;
            let extension = extension_from_name(&name);
            let final_path = store.chunk_path(&chunk.hash, extension)?;
            if final_path.exists() {
                return Ok(CasWriteReport {
                    hash: super::manifest::normalize_hash_hex(&chunk.hash)?,
                    path: final_path.to_string_lossy().to_string(),
                    bytes: chunk.size,
                    already_present: true,
                });
            }
            let url = resolve_chunk_url(base_url.as_deref(), &name, chunk.url.as_deref())?;
            let bytes = client
                .get(url)
                .send()
                .await
                .map_err(|error| error.to_string())?
                .error_for_status()
                .map_err(|error| error.to_string())?
                .bytes()
                .await
                .map_err(|error| error.to_string())?;
            verify_hash(&bytes, &chunk.hash)?;
            store.put_verified(&chunk.hash, extension, &bytes)
        }
    });

    let reports = try_join_all(futures).await?;
    let delta_reports = download_binary_deltas(&client, &store, manifest).await?;
    let bytes_downloaded = reports
        .iter()
        .filter(|report| !report.already_present)
        .map(|report| report.bytes)
        .sum();
    let binary_delta_bytes = delta_reports
        .iter()
        .filter(|report| !report.already_present)
        .map(|report| report.bytes)
        .sum();
    let downloaded_chunks = reports
        .iter()
        .filter(|report| !report.already_present)
        .count();
    let downloaded_binary_deltas = delta_reports
        .iter()
        .filter(|report| !report.already_present)
        .count();
    let reused_chunks = reports
        .iter()
        .filter(|report| report.already_present)
        .count();
    let staged_manifest_path = store.write_staged_manifest(manifest)?;

    Ok(IncrementalDownloadReport {
        manifest_version: manifest.version.clone(),
        downloaded_chunks,
        reused_chunks,
        bytes_downloaded,
        downloaded_binary_deltas,
        binary_delta_bytes,
        staged_manifest_path: staged_manifest_path.to_string_lossy().to_string(),
    })
}

pub fn apply<R: Runtime>(app: &AppHandle<R>) -> Result<IncrementalApplyReport, String> {
    let store = CasStore::from_app(app)?;
    let previous_manifest = store.read_manifest()?;
    let manifest = store.apply_staged_manifest()?;
    let delta_report = apply_binary_deltas(app, &store, &manifest)?;
    let retain_hashes = retain_hashes(&manifest, previous_manifest.as_ref());
    let gc_removed_chunks = store.gc_unreferenced(&retain_hashes)?;
    let reloaded_webviews = reload_webviews(app);
    Ok(IncrementalApplyReport {
        active_version: manifest.version,
        previous_version: previous_manifest.map(|manifest| manifest.version),
        manifest_path: store.manifest_path().to_string_lossy().to_string(),
        reloaded_webviews,
        binary_deltas_applied: delta_report.applied,
        binary_deltas_skipped: delta_report.skipped,
        gc_removed_chunks,
    })
}

pub fn rollback<R: Runtime>(app: &AppHandle<R>) -> Result<IncrementalApplyReport, String> {
    let store = CasStore::from_app(app)?;
    let previous_version = store.read_manifest()?.map(|manifest| manifest.version);
    let manifest = store.rollback_manifest()?;
    let reloaded_webviews = reload_webviews(app);
    Ok(IncrementalApplyReport {
        active_version: manifest.version,
        previous_version,
        manifest_path: store.manifest_path().to_string_lossy().to_string(),
        reloaded_webviews,
        binary_deltas_applied: 0,
        binary_deltas_skipped: 0,
        gc_removed_chunks: 0,
    })
}

pub fn request_from_parts(
    manifest_url: Option<String>,
    payload: Option<Value>,
) -> IncrementalUpdateRequest {
    let from_payload = payload
        .as_ref()
        .and_then(|value| serde_json::from_value::<IncrementalUpdateRequest>(value.clone()).ok());
    IncrementalUpdateRequest {
        manifest_url: manifest_url
            .filter(|value| !value.trim().is_empty())
            .or_else(|| {
                from_payload
                    .as_ref()
                    .and_then(|value| value.manifest_url.clone())
            }),
        public_key: from_payload.and_then(|value| value.public_key),
    }
}

async fn fetch_manifest(url: &str) -> Result<IncrementalUpdateManifest, String> {
    let text = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| error.to_string())?
        .get(url)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .text()
        .await
        .map_err(|error| error.to_string())?;
    parse_manifest(&text)
}

fn resolve_manifest_url(input: Option<&str>) -> Result<String, String> {
    let candidate = input
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| std::env::var("KOMA_UPDATE_MANIFEST_URL").ok())
        .ok_or_else(|| "KOMA_UPDATE_MANIFEST_URL is not configured".to_string())?;
    let parsed = url::Url::parse(&candidate).map_err(|error| error.to_string())?;
    if !matches!(parsed.scheme(), "https" | "http") {
        return Err("manifestUrl precisa usar http(s)".to_string());
    }
    Ok(candidate)
}

fn base_url_from_manifest_url(manifest_url: &str) -> Result<String, String> {
    let mut url = url::Url::parse(manifest_url).map_err(|error| error.to_string())?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| "manifestUrl cannot be used as baseUrl".to_string())?;
        segments.pop();
    }
    Ok(url.to_string())
}

fn resolve_chunk_url(
    base_url: Option<&str>,
    name: &str,
    override_url: Option<&str>,
) -> Result<String, String> {
    if let Some(url) = override_url.filter(|value| !value.trim().is_empty()) {
        if let Ok(parsed) = url::Url::parse(url) {
            if matches!(parsed.scheme(), "https" | "http") {
                return Ok(url.to_string());
            }
            return Err(format!("url de chunk {name} precisa usar http(s)"));
        }
        let base = base_url.ok_or_else(|| format!("chunk {name} usa url relativa sem baseUrl"))?;
        let base = url::Url::parse(base).map_err(|error| error.to_string())?;
        return base
            .join(url)
            .map(|url| url.to_string())
            .map_err(|error| error.to_string());
    }
    let base = base_url.ok_or_else(|| format!("chunk {name} sem url e manifest sem baseUrl"))?;
    let base = url::Url::parse(base).map_err(|error| error.to_string())?;
    base.join(name)
        .map(|url| url.to_string())
        .map_err(|error| error.to_string())
}

async fn download_binary_deltas(
    client: &Client,
    store: &CasStore,
    manifest: &IncrementalUpdateManifest,
) -> Result<Vec<CasWriteReport>, String> {
    let futures = manifest.binary_deltas.iter().map(|delta| {
        let client = client.clone();
        let store = store.clone();
        let base_url = manifest.base_url.clone();
        let delta = delta.clone();
        async move {
            let final_path = store.chunk_path(&delta.patch_hash, Some("bsdiff"))?;
            if final_path.exists() {
                return Ok(CasWriteReport {
                    hash: super::manifest::normalize_hash_hex(&delta.patch_hash)?,
                    path: final_path.to_string_lossy().to_string(),
                    bytes: delta.patch_size,
                    already_present: true,
                });
            }
            let url = resolve_chunk_url(
                base_url.as_deref(),
                &delta.patch_url,
                Some(&delta.patch_url),
            )?;
            let bytes = client
                .get(url)
                .send()
                .await
                .map_err(|error| error.to_string())?
                .error_for_status()
                .map_err(|error| error.to_string())?
                .bytes()
                .await
                .map_err(|error| error.to_string())?;
            if bytes.len() as u64 != delta.patch_size {
                return Err(format!(
                    "binary delta {} has an invalid size: expected {}, got {}",
                    delta.artifact,
                    delta.patch_size,
                    bytes.len()
                ));
            }
            verify_hash(&bytes, &delta.patch_hash)?;
            store.put_verified(&delta.patch_hash, Some("bsdiff"), &bytes)
        }
    });
    try_join_all(futures).await
}

fn apply_binary_deltas<R: Runtime>(
    app: &AppHandle<R>,
    store: &CasStore,
    manifest: &IncrementalUpdateManifest,
) -> Result<BinaryDeltaApplyReport, String> {
    let mut report = BinaryDeltaApplyReport {
        applied: 0,
        skipped: 0,
    };
    for delta in &manifest.binary_deltas {
        let Some(target) = find_binary_delta_target(app, delta) else {
            report.skipped += 1;
            continue;
        };
        let patch = store.chunk_path(&delta.patch_hash, Some("bsdiff"))?;
        if !patch.exists() {
            report.skipped += 1;
            continue;
        }
        binary_delta::apply_bsdiff_patch(&target, &patch, &target, &delta.target_hash)?;
        report.applied += 1;
    }
    Ok(report)
}

fn find_binary_delta_target<R: Runtime>(
    app: &AppHandle<R>,
    delta: &BinaryDelta,
) -> Option<std::path::PathBuf> {
    let artifact = delta.artifact.trim();
    if artifact.is_empty() {
        return None;
    }
    let artifact_path = std::path::Path::new(artifact);
    let mut candidates = Vec::new();
    if let Ok(explicit) = std::env::var("KOMA_MINI_BACKEND_EXE") {
        candidates.push(std::path::PathBuf::from(explicit));
    }
    if let Ok(resources) = app.path().resource_dir() {
        candidates.push(resources.join(artifact_path));
        if artifact_path.extension().is_none() {
            candidates.push(resources.join(format!("{artifact}.exe")));
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join(artifact_path));
            if artifact_path.extension().is_none() {
                candidates.push(parent.join(format!("{artifact}.exe")));
            }
        }
    }
    candidates.into_iter().find(|path| path.is_file())
}

fn retain_hashes(
    current: &IncrementalUpdateManifest,
    previous: Option<&IncrementalUpdateManifest>,
) -> Vec<String> {
    let mut hashes = Vec::new();
    for manifest in previous.into_iter().chain(std::iter::once(current)) {
        hashes.extend(manifest.chunks.values().map(|chunk| chunk.hash.clone()));
        hashes.extend(
            manifest
                .binary_deltas
                .iter()
                .map(|delta| delta.patch_hash.clone()),
        );
        hashes.extend(
            manifest
                .model_deltas
                .iter()
                .map(|delta| delta.patch_hash.clone()),
        );
    }
    hashes
}

fn normalize_version(value: &str) -> String {
    value.trim().trim_start_matches('v').to_ascii_lowercase()
}

fn reload_webviews<R: Runtime>(app: &AppHandle<R>) -> usize {
    let mut count = 0usize;
    for webview in app.webview_windows().values() {
        if webview.eval("window.location.reload()").is_ok() {
            count += 1;
        }
    }
    count
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_accepts_direct_manifest_url_over_payload() {
        let payload = serde_json::json!({
            "manifestUrl": "https://example.test/payload.json",
            "publicKey": "key"
        });
        let request = request_from_parts(
            Some("https://example.test/direct.json".to_string()),
            Some(payload),
        );
        assert_eq!(
            request.manifest_url.as_deref(),
            Some("https://example.test/direct.json")
        );
        assert_eq!(request.public_key.as_deref(), Some("key"));
    }
}
