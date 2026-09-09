use super::*;

#[path = "checksum.rs"]
mod checksum;
use checksum::*;

use log;

/// Task error with optional taxonomy (mirrors core/download_jobs.py).
#[derive(Debug, Clone)]
pub(super) struct DownloadTaskError {
    pub message: String,
    pub code: Option<String>,
}

impl DownloadTaskError {
    pub(super) fn plain(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: None,
        }
    }

    pub(super) fn coded(message: impl Into<String>, code: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            code: Some(code.into()),
        }
    }
}

const MODEL_JOB_POLL_INTERVAL_MS: u64 = 500;

/// Client for the local mini-backend: `no_proxy` is mandatory — the system
/// proxy (registry/env) intercepts 127.0.0.1 and the request hangs forever
/// without error (without a timeout, polling would freeze silently).
fn local_http_client() -> &'static reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .no_proxy()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

fn job_error_from_snapshot(snapshot: &serde_json::Value) -> DownloadTaskError {
    let message = snapshot
        .get("errorMessage")
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| "Download failed.".to_string());
    let code = snapshot
        .get("errorCode")
        .and_then(|value| value.as_str())
        .map(ToOwned::to_owned);
    match code {
        Some(code) => DownloadTaskError::coded(message, code),
        None => DownloadTaskError::plain(message),
    }
}

pub(super) async fn download_and_install<R: Runtime>(
    app: &AppHandle<R>,
    model: &DesktopModelDownloadPayload,
    attempt: u32,
    cancelled: &AtomicBool,
) -> Result<(), DownloadTaskError> {
    let root = models_root_dir(app).map_err(DownloadTaskError::plain)?;
    ensure_enough_disk_space(&root, model.required_disk_bytes)
        .map_err(DownloadTaskError::plain)?;

    // Single source of truth: the mini-backend downloads (serial queue + resume +
    // checksum) and this process only translates snapshots into events.
    // Nothing is deleted before the job completes — the preserved .part file allows resuming.
    let checksum = install_via_backend_job(app, model, attempt, cancelled).await?;
    write_installed_manifest(&root, model, &checksum, "download")
        .map_err(DownloadTaskError::plain)?;
    Ok(())
}

async fn install_via_backend_job<R: Runtime>(
    app: &AppHandle<R>,
    model: &DesktopModelDownloadPayload,
    attempt: u32,
    cancelled: &AtomicBool,
) -> Result<String, DownloadTaskError> {
    let config = build_runtime_config(app).map_err(DownloadTaskError::plain)?;
    if config.local_api_url.trim().is_empty() {
        return Err(DownloadTaskError::plain(
            "Mini backend is not available to install the local model.",
        ));
    }
    let base = config.local_api_url.trim_end_matches('/').to_string();
    let client = local_http_client();

    let create_response = client
        .post(format!("{base}/models/downloads"))
        .json(&json!({
            "model_id": model.id,
            "source_language": model.source_language,
            "required_disk_bytes": model.required_disk_bytes,
            "download_url": model.download_url,
            "checksum_sha256": model.checksum_sha256,
            "expected_download_bytes": model.expected_download_bytes,
        }))
        .send()
        .await
        .map_err(|error| DownloadTaskError::plain(error.to_string()))?;
    if !create_response.status().is_success() {
        if create_response.status() == reqwest::StatusCode::NOT_FOUND {
            // Local backend without the job routes: legacy code is running
            // (an orphan process was reused) — the app/backend must be restarted.
            return Err(DownloadTaskError::coded(
                "The local model backend is outdated. Restart the app so it can pick up the new backend.",
                "network",
            ));
        }
        let detail = read_backend_error_detail(create_response).await;
        return Err(DownloadTaskError::plain(if detail.is_empty() {
            format!("Failed to queue the model download for {}.", model.name)
        } else {
            detail
        }));
    }
    let created: serde_json::Value = create_response
        .json()
        .await
        .map_err(|error| DownloadTaskError::plain(error.to_string()))?;
    let job_id = created
        .get("jobId")
        .and_then(|value| value.as_str())
        .ok_or_else(|| {
            DownloadTaskError::plain("Mini backend did not return a download job id.")
        })?
        .to_string();

    log::debug!("[models-job] polling job {job_id} at {base}");
    let mut last_state = String::new();
    loop {
        if cancelled.load(Ordering::SeqCst) {
            cancel_model_job(&client, &base, &job_id).await;
            return Err(DownloadTaskError::plain("Download cancelado."));
        }

        tokio::time::sleep(std::time::Duration::from_millis(MODEL_JOB_POLL_INTERVAL_MS)).await;

        let response = match client
            .get(format!("{base}/models/downloads/{job_id}"))
            .send()
            .await
        {
            Ok(response) => response,
            // Backend restarting/unstable: keep polling.
            Err(error) => {
                log::warn!("[models-job] poll send failed: {error}");
                continue;
            }
        };
        if !response.status().is_success() {
            if response.status() == reqwest::StatusCode::NOT_FOUND {
                // Backend restarted and lost the in-memory job. Fail with retry:
                // a new submit resumes from the .part file preserved on disk.
                return Err(DownloadTaskError::coded(
                    "Model download job was lost because the local backend restarted.",
                    "network",
                ));
            }
            continue;
        }
        let snapshot: serde_json::Value = match response.json().await {
            Ok(value) => value,
            Err(error) => {
                log::warn!("[models-job] poll json failed: {error}");
                continue;
            }
        };
        let state = snapshot
            .get("state")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_string();
        if std::env::var("KOMA_DEBUG_MODEL_JOB").as_deref() == Ok("1") {
            eprintln!(
                "[models-job] poll ok: state={state} bytes={} total={:?}",
                snapshot
                    .get("bytesDownloaded")
                    .and_then(|value| value.as_f64())
                    .unwrap_or(0.0),
                snapshot.get("totalBytes").and_then(|value| value.as_f64()),
            );
        }
        if state != last_state {
            log::debug!("[models-job] state -> {state}");
            if state == "verifying" {
                emit_model_event(
                    app,
                    ModelManagerEvent::Verifying {
                        model_id: model.id.clone(),
                    },
                );
            }
            last_state = state.clone();
        }

        match state.as_str() {
            "downloading" => emit_progress_from_snapshot(app, model, attempt, &snapshot),
            "ready" => {
                // Leave "100% Downloading" immediately: hashing the tree +
                // manifest takes a few seconds on large GGUFs.
                emit_model_event(
                    app,
                    ModelManagerEvent::Verifying {
                        model_id: model.id.clone(),
                    },
                );
                let root = models_root_dir(app).map_err(DownloadTaskError::plain)?;
                let dir = model_dir(&root, &model.id);
                if !is_installed_payload_present(&model.id, &dir)
                    .map_err(DownloadTaskError::plain)?
                {
                    return Err(DownloadTaskError::plain(format!(
                        "Installation of {} finished without a valid payload in the local directory.",
                        model.name
                    )));
                }
                return checksum_directory_tree(&dir).map_err(DownloadTaskError::plain);
            }
            "cancelled" => {
                return Err(DownloadTaskError::plain("Download cancelado."));
            }
            "error" => return Err(job_error_from_snapshot(&snapshot)),
            _ => {}
        }
    }
}

fn emit_progress_from_snapshot<R: Runtime>(
    app: &AppHandle<R>,
    model: &DesktopModelDownloadPayload,
    attempt: u32,
    snapshot: &serde_json::Value,
) {
    let bytes_downloaded = snapshot
        .get("bytesDownloaded")
        .and_then(|value| value.as_f64())
        .unwrap_or(0.0)
        .max(0.0) as u64;
    let backend_total = snapshot
        .get("totalBytes")
        .and_then(|value| value.as_f64())
        .unwrap_or(0.0)
        .max(0.0) as u64;
    // Until the backend has seen every Content-Length, use the registry's
    // expected total only for display — percent stays capped at 98.
    let has_real_total = backend_total > 0;
    let display_total = if has_real_total {
        backend_total
    } else {
        bytes_downloaded.max(model.expected_download_bytes)
    };
    let percent = if has_real_total {
        snapshot
            .get("percent")
            .and_then(|value| value.as_f64())
            .unwrap_or(0.0)
    } else if display_total > 0 {
        ((bytes_downloaded as f64 / display_total as f64) * 100.0).min(98.0)
    } else {
        0.0
    };

    emit_download_progress(
        app,
        model,
        attempt,
        bytes_downloaded,
        display_total,
        snapshot
            .get("speedBytesPerSecond")
            .and_then(|value| value.as_f64())
            .unwrap_or(0.0)
            .max(0.0) as u64,
        percent.clamp(0.0, if has_real_total { 100.0 } else { 98.0 }),
    );
}

async fn cancel_model_job(client: &reqwest::Client, base: &str, job_id: &str) {
    // Best effort: the job will also fail on its own when the network errors.
    let _ = client
        .post(format!("{base}/models/downloads/{job_id}/cancel"))
        .send()
        .await;
}

async fn read_backend_error_detail(response: reqwest::Response) -> String {
    response
        .json::<serde_json::Value>()
        .await
        .ok()
        .and_then(|value| {
            value
                .get("detail")
                .and_then(|detail| detail.as_str())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_default()
}

pub(super) async fn import_onnx_model<R: Runtime>(
    app: &AppHandle<R>,
    model: DesktopModelImportOnnxPayload,
    source_path: &Path,
) -> Result<DesktopInstalledModelRecord, String> {
    let model_id = sanitize_model_id(&model.id)?;
    if !source_path.exists() {
        return Err("The selected ONNX file was not found.".to_string());
    }
    if source_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("onnx"))
        != Some(true)
    {
        return Err("Manual import only accepts .onnx files.".to_string());
    }
    validate_enhance_onnx_file(app, source_path).await?;
    let root = models_root_dir(app)?;
    let dir = model_dir(&root, &model_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let target_path = dir.join(ENHANCE_MODEL_FILE_NAME);
    fs::copy(source_path, &target_path).map_err(|error| error.to_string())?;
    let checksum = checksum_file(&target_path)?;
    let size = target_path
        .metadata()
        .map_err(|error| error.to_string())?
        .len();
    let payload = DesktopModelDownloadPayload {
        id: model_id.clone(),
        name: model.name.trim().to_string(),
        version: model.version.trim().to_string(),
        download_url: source_path.to_string_lossy().to_string(),
        checksum_sha256: checksum.clone(),
        expected_download_bytes: size,
        required_disk_bytes: size,
        source_language: None,
        install_strategy: Some("manual_import".to_string()),
        runtime_family: Some("onnx".to_string()),
        backend_install_endpoint: None,
    };
    write_installed_manifest(&root, &payload, &checksum, "local_import")?;
    Ok(DesktopInstalledModelRecord {
        model_id,
        version: model.version.trim().to_string(),
        installed_at: read_manifest(&dir.join(MANIFEST_FILE_NAME))?
            .map(|manifest| manifest.installed_at)
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339()),
        checksum_sha256: checksum,
        status: "installed".to_string(),
        installed_languages: None,
        origin: Some("local_import".to_string()),
        model_dir: dir.to_string_lossy().to_string(),
        manifest_path: dir.join(MANIFEST_FILE_NAME).to_string_lossy().to_string(),
        size_bytes: size,
    })
}

async fn validate_enhance_onnx_file<R: Runtime>(
    app: &AppHandle<R>,
    source_path: &Path,
) -> Result<(), String> {
    let config = build_runtime_config(app)?;
    if config.local_api_url.trim().is_empty() {
        return Err("Mini backend is not available to validate the ONNX file.".to_string());
    }
    let bytes = fs::read(source_path).map_err(|error| error.to_string())?;
    let file_name = source_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("model.onnx")
        .to_string();
    let form = reqwest::multipart::Form::new().part(
        "file",
        reqwest::multipart::Part::bytes(bytes)
            .file_name(file_name)
            .mime_str("application/octet-stream")
            .map_err(|error| error.to_string())?,
    );
    let response = local_http_client()
        .post(format!(
            "{}/enhance/validate-model",
            config.local_api_url.trim_end_matches('/')
        ))
        .multipart(form)
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if response.status().is_success() {
        return Ok(());
    }
    let status = response.status();
    let detail = response
        .json::<serde_json::Value>()
        .await
        .ok()
        .and_then(|value| {
            value
                .get("detail")
                .and_then(|detail| detail.as_str())
                .map(ToOwned::to_owned)
        })
        .unwrap_or_default();
    Err(if detail.is_empty() {
        format!("Failed to validate ONNX (HTTP {status}).")
    } else {
        detail
    })
}

pub(super) async fn check_remote_updates<R: Runtime>(
    app: &AppHandle<R>,
    models: Vec<DesktopModelDownloadPayload>,
) -> Result<Vec<DesktopRemoteModelUpdateCheckResult>, String> {
    let installed = list_installed_models(&models_root_dir(app)?)?
        .into_iter()
        .filter(|record| record.status == "installed")
        .map(|record| (record.model_id.clone(), record))
        .collect::<HashMap<_, _>>();
    let mut results = Vec::new();
    for model in models {
        let model_id = sanitize_model_id(&model.id)?;
        let Some(record) = installed.get(&model_id) else {
            continue;
        };
        let remote_checksum = resolve_checksum_from_head(&model.download_url)
            .await
            .or(resolve_checksum_from_hugging_face_api(&model.download_url).await);
        let installed_checksum = normalize_checksum(&record.checksum_sha256);
        let update_available = remote_checksum
            .as_ref()
            .map(|checksum| checksum != &installed_checksum)
            .unwrap_or(false);
        results.push(DesktopRemoteModelUpdateCheckResult {
            model_id,
            installed_checksum_sha256: (!record.checksum_sha256.is_empty())
                .then_some(record.checksum_sha256.clone()),
            remote_checksum_sha256: remote_checksum.clone(),
            registry_version: model.version,
            checked: remote_checksum.is_some(),
            update_available,
        });
    }
    Ok(results)
}

pub(super) fn normalize_download_payload(
    mut model: DesktopModelDownloadPayload,
) -> Result<DesktopModelDownloadPayload, String> {
    model.id = sanitize_model_id(&model.id)?;
    model.checksum_sha256 = normalize_checksum(&model.checksum_sha256);
    model.source_language = model.source_language.and_then(|value| {
        let normalized = value.trim().to_ascii_lowercase();
        (!normalized.is_empty()).then_some(normalized)
    });
    if model.install_strategy.is_none() && BACKEND_MANAGED_MODEL_IDS.contains(&model.id.as_str()) {
        model.install_strategy = Some("backend_managed".to_string());
    }
    if model.backend_install_endpoint.is_none()
        && BACKEND_MANAGED_MODEL_IDS.contains(&model.id.as_str())
    {
        model.backend_install_endpoint = Some("/models/install".to_string());
    }
    if !model.download_url.starts_with("http://") && !model.download_url.starts_with("https://") {
        return Err("URL de download invalida.".to_string());
    }
    if !is_valid_checksum(&model.checksum_sha256) {
        return Err("Invalid SHA256 checksum.".to_string());
    }
    Ok(model)
}

pub(super) fn list_installed_models(
    root: &Path,
) -> Result<Vec<DesktopInstalledModelRecord>, String> {
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    let mut records = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry
            .file_type()
            .map_err(|error| error.to_string())?
            .is_dir()
        {
            continue;
        }
        let model_id = entry.file_name().to_string_lossy().to_string();
        let dir = root.join(&model_id);
        let manifest_path = dir.join(MANIFEST_FILE_NAME);
        let partial_path = dir.join(PARTIAL_FILE_NAME);
        let manifest = read_manifest(&manifest_path)?;
        let has_partial = partial_path.exists();
        let size_bytes = compute_directory_size(&dir)?;
        if manifest.as_ref().map(|value| value.status.as_str()) == Some("installed") {
            let manifest = manifest.unwrap();
            let has_payload = is_installed_payload_present(&model_id, &dir)?;
            records.push(DesktopInstalledModelRecord {
                model_id: model_id.clone(),
                version: manifest.version,
                installed_at: manifest.installed_at,
                checksum_sha256: manifest.checksum_sha256,
                status: if has_payload {
                    "installed"
                } else {
                    "incomplete"
                }
                .to_string(),
                installed_languages: (model_id == EASYOCR_MODEL_ID)
                    .then(|| detect_easyocr_installed_languages(&dir)),
                origin: manifest.origin,
                model_dir: dir.to_string_lossy().to_string(),
                manifest_path: manifest_path.to_string_lossy().to_string(),
                size_bytes,
            });
        } else if manifest.as_ref().map(|value| value.status.as_str()) == Some("incomplete")
            || has_partial
        {
            records.push(DesktopInstalledModelRecord {
                model_id: model_id.clone(),
                version: manifest
                    .as_ref()
                    .map(|value| value.version.clone())
                    .unwrap_or_else(|| "0.0.0".to_string()),
                installed_at: manifest
                    .as_ref()
                    .map(|value| value.installed_at.clone())
                    .unwrap_or_else(|| chrono::DateTime::<chrono::Utc>::UNIX_EPOCH.to_rfc3339()),
                checksum_sha256: manifest
                    .as_ref()
                    .map(|value| value.checksum_sha256.clone())
                    .unwrap_or_default(),
                status: "incomplete".to_string(),
                installed_languages: (model_id == EASYOCR_MODEL_ID)
                    .then(|| detect_easyocr_installed_languages(&dir)),
                origin: manifest.and_then(|value| value.origin),
                model_dir: dir.to_string_lossy().to_string(),
                manifest_path: manifest_path.to_string_lossy().to_string(),
                size_bytes,
            });
        }
    }
    Ok(records)
}

fn is_installed_payload_present(model_id: &str, dir: &Path) -> Result<bool, String> {
    let model_id = sanitize_model_id(model_id)?;
    let has_files = |files: &[&str]| files.iter().all(|file| dir.join(file).exists());
    let has_one = |file: &str| dir.join(file).exists();
    Ok(match model_id.as_str() {
        EASYOCR_MODEL_ID | PORORO_MODEL_ID => has_any_payload_file(dir)?,
        MANGA_OCR_MODEL_ID => has_files(&["encoder_model.onnx", "decoder_model.onnx", "vocab.txt"]),
        PADDLE_OCR_MODEL_ID => has_files(&[
            "ch_PP-OCRv5_mobile_det.onnx",
            "eslav_PP-OCRv5_rec_mobile_infer.onnx",
            "ppocrv5_eslav_dict.txt",
        ]),
        PADDLE_OCR_EN_MODEL_ID => has_files(&[
            "ch_PP-OCRv5_mobile_det.onnx",
            "en_PP-OCRv5_mobile_rec.onnx",
            "ppocrv5_en_dict.txt",
        ]),
        PADDLE_OCR_LATIN_MODEL_ID => has_files(&[
            "ch_PP-OCRv5_mobile_det.onnx",
            "latin_PP-OCRv5_rec_mobile_infer.onnx",
            "ppocrv5_latin_dict.txt",
        ]),
        PADDLE_OCR_CH_MODEL_ID => has_files(&[
            "ch_PP-OCRv5_mobile_det.onnx",
            "ch_PP-OCRv5_rec_mobile_infer.onnx",
            "ppocrv5_dict.txt",
        ]),
        MEIKI_OCR_MODEL_ID => has_files(&[
            "meiki.text.rec.v0.960x32.onnx",
            "meiki.text.rec.v0.vertical.32x480.onnx",
        ]),
        PADDLE_OCR_VL_MANGA_MODEL_ID => has_files(&[
            "config.json",
            "configuration_paddleocr_vl.py",
            "generation_config.json",
            "image_processing.py",
            "model.safetensors",
            "modeling_paddleocr_vl.py",
            "preprocessor_config.json",
            "processing_paddleocr_vl.py",
            "processor_config.json",
            "tokenizer.json",
            "tokenizer.model",
            "tokenizer_config.json",
        ]),
        GOT_OCR2_MODEL_ID => has_files(&[
            "config.json",
            "generation_config.json",
            "model.safetensors",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ]),
        QWEN2_5_VL_3B_MODEL_ID => has_files(&[
            "config.json",
            "generation_config.json",
            "model-00001-of-00002.safetensors",
            "model-00002-of-00002.safetensors",
            "model.safetensors.index.json",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        ]),
        MANGALMM_MODEL_ID | ROLMOCR_MODEL_ID => has_files(&[
            "config.json",
            "generation_config.json",
            "model-00001-of-00004.safetensors",
            "model-00002-of-00004.safetensors",
            "model-00003-of-00004.safetensors",
            "model-00004-of-00004.safetensors",
            "model.safetensors.index.json",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        ]),
        GLM_OCR_ONNX_MODEL_ID => has_files(&[
            "config.json",
            "generation_config.json",
            "model.safetensors",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ]),
        SUGOI_MODEL_ID => has_files(&[
            "config.json",
            "model.bin",
            "source_vocabulary.json",
            "target_vocabulary.json",
            "spm/spm.ja.nopretok.model",
            "spm/spm.en.nopretok.model",
        ]),
        M2M100_MODEL_ID => has_files(&[
            "config.json",
            "model.bin",
            "sentencepiece.bpe.model",
            "shared_vocabulary.json",
            "vocab.json",
        ]),
        INPAINT_AOT_MODEL_ID => has_one("aot.onnx"),
        INPAINT_LAMA_MODEL_ID => has_one("lama-manga-dynamic.onnx"),
        INPAINT_OPENCV_LAMA_MODEL_ID => has_one("inpainting_lama_2025jan.onnx"),
        INPAINT_LAMA_FP32_MODEL_ID => has_one("lama_fp32.onnx"),
        SEGMENT_BAKA_MODEL_ID => has_one("segmenter.meta"),
        FONT_RTDETR_MODEL_ID => has_one(FONT_RTDETR_FILE_NAME),
        _ => has_any_payload_file(dir)?,
    })
}

pub(super) fn cancel_download<R: Runtime>(
    app: &AppHandle<R>,
    model_id: &str,
) -> Result<(), String> {
    let model_id = sanitize_model_id(model_id)?;
    let store = app.state::<ModelDownloadStore>();
    let cancelled_queued = {
        let mut queue = store.queue.lock().map_err(|error| error.to_string())?;
        let before = queue.len();
        queue.retain(|task| task.model.id != model_id);
        queue.len() != before
    };
    if cancelled_queued {
        emit_model_event(app, ModelManagerEvent::Cancelled { model_id });
        return Ok(());
    }
    if let Some(active) = store
        .active
        .lock()
        .map_err(|error| error.to_string())?
        .as_ref()
    {
        if active.model_id == model_id {
            active.cancelled.store(true, Ordering::SeqCst);
        }
    }
    Ok(())
}

pub(super) fn clear_active_download<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(mut active) = app.state::<ModelDownloadStore>().active.lock() {
        *active = None;
    }
}

fn emit_download_progress<R: Runtime>(
    app: &AppHandle<R>,
    model: &DesktopModelDownloadPayload,
    attempt: u32,
    bytes_downloaded: u64,
    total_bytes: u64,
    speed_bytes_per_second: u64,
    percent_override: f64,
) {
    let resolved_total = total_bytes.max(bytes_downloaded);
    emit_model_event(
        app,
        ModelManagerEvent::Progress {
            model_id: model.id.clone(),
            bytes_downloaded,
            total_bytes: resolved_total,
            speed_bytes_per_second,
            percent: if resolved_total > 0 {
                percent_override.clamp(0.0, 100.0)
            } else {
                0.0
            },
            attempt,
        },
    );
}

pub(super) fn emit_model_event<R: Runtime>(app: &AppHandle<R>, event: ModelManagerEvent) {
    if std::env::var("KOMA_DEBUG_MODEL_JOB").as_deref() == Ok("1") {
        let kind = match &event {
            ModelManagerEvent::Queued { .. } => "queued",
            ModelManagerEvent::Started { .. } => "started",
            ModelManagerEvent::Progress { percent, .. } => {
                log::debug!("[models-emit] progress percent={percent:.1}");
                "progress"
            }
            ModelManagerEvent::Verifying { .. } => "verifying",
            ModelManagerEvent::Completed { .. } => "completed",
            ModelManagerEvent::Failed { .. } => "failed",
            ModelManagerEvent::Cancelled { .. } => "cancelled",
        };
        if kind != "progress" {
            log::debug!("[models-emit] {kind}");
        }
    }
    if let Err(error) = app.emit_to("main", MODEL_EVENT_CHANNEL, event) {
        log::error!("[models-emit] EMIT FAILED: {error}");
    }
}


pub(super) fn should_retry_download(error: &DownloadTaskError) -> bool {
    // The new taxonomy takes precedence; string parsing stays as a safety
    // net for errors that didn't come from the job.
    if let Some(code) = &error.code {
        return !matches!(
            code.as_str(),
            "checksum_mismatch" | "disk_full" | "cancelled" | "unknown"
        );
    }
    let lower = error.message.to_ascii_lowercase();
    if lower.contains("invalid sha256 checksum")
        || lower.contains("insufficient disk space")
    {
        return false;
    }
    if let Some(status) = parse_http_status(&lower) {
        if (400..500).contains(&status) && status != 408 && status != 429 {
            return false;
        }
    }
    true
}

fn parse_http_status(message: &str) -> Option<u16> {
    let index = message.find("http")?;
    message[index + 4..]
        .chars()
        .filter(|ch| ch.is_ascii_digit())
        .collect::<String>()
        .parse()
        .ok()
}

pub(super) fn models_root_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("models");
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    Ok(root)
}

pub(super) fn model_dir(root: &Path, model_id: &str) -> PathBuf {
    root.join(model_id)
}

pub(super) fn disk_space_info(root: &Path) -> Result<DesktopDiskSpaceInfo, String> {
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    Ok(DesktopDiskSpaceInfo {
        free_bytes: fs2::available_space(root).map_err(|error| error.to_string())?,
        total_bytes: fs2::total_space(root).map_err(|error| error.to_string())?,
        path: root.to_string_lossy().to_string(),
    })
}

fn ensure_enough_disk_space(root: &Path, required_bytes: u64) -> Result<(), String> {
    if required_bytes == 0 {
        return Ok(());
    }
    let free = fs2::available_space(root).map_err(|error| error.to_string())?;
    if free < required_bytes {
        return Err(format!(
            "Insufficient disk space for the download. Required: {:.1} GB | Available: {:.1} GB.",
            required_bytes as f64 / 1024_f64.powi(3),
            free as f64 / 1024_f64.powi(3)
        ));
    }
    Ok(())
}

pub(super) fn sanitize_model_id(model_id: &str) -> Result<String, String> {
    let normalized = model_id.trim().to_ascii_lowercase();
    if normalized.is_empty()
        || !normalized.chars().all(|ch| {
            ch.is_ascii_lowercase() || ch.is_ascii_digit() || matches!(ch, '.' | '_' | '-')
        })
    {
        return Err("Invalid model ID.".to_string());
    }
    Ok(normalized)
}


fn read_manifest(path: &Path) -> Result<Option<DesktopModelManifest>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&raw)
        .map(Some)
        .map_err(|error| error.to_string())
}

pub(super) fn write_incomplete_manifest(
    root: &Path,
    model: &DesktopModelDownloadPayload,
    origin: &str,
) -> Result<(), String> {
    write_manifest(root, model, &model.checksum_sha256, "incomplete", origin)
}

fn write_installed_manifest(
    root: &Path,
    model: &DesktopModelDownloadPayload,
    checksum: &str,
    origin: &str,
) -> Result<(), String> {
    write_manifest(root, model, checksum, "installed", origin)
}

fn write_manifest(
    root: &Path,
    model: &DesktopModelDownloadPayload,
    checksum: &str,
    status: &str,
    origin: &str,
) -> Result<(), String> {
    let dir = model_dir(root, &model.id);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let manifest = DesktopModelManifest {
        model_id: model.id.clone(),
        version: model.version.clone(),
        installed_at: chrono::Utc::now().to_rfc3339(),
        checksum_sha256: checksum.to_string(),
        status: status.to_string(),
        origin: Some(origin.to_string()),
    };
    let raw = serde_json::to_string_pretty(&manifest).map_err(|error| error.to_string())?;
    fs::write(dir.join(MANIFEST_FILE_NAME), raw).map_err(|error| error.to_string())
}

fn compute_directory_size(path: &Path) -> Result<u64, String> {
    if !path.exists() {
        return Ok(0);
    }
    let metadata = path.metadata().map_err(|error| error.to_string())?;
    if metadata.is_file() {
        return Ok(metadata.len());
    }
    if !metadata.is_dir() {
        return Ok(0);
    }
    let mut total = 0;
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        total += compute_directory_size(&entry.map_err(|error| error.to_string())?.path())?;
    }
    Ok(total)
}

fn has_any_payload_file(dir: &Path) -> Result<bool, String> {
    if !dir.exists() {
        return Ok(false);
    }
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() && has_any_payload_file(&path)? {
            return Ok(true);
        }
        if path.is_file() {
            let name = path
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or_default();
            if name != MANIFEST_FILE_NAME && name != PARTIAL_FILE_NAME {
                return Ok(true);
            }
        }
    }
    Ok(false)
}

fn detect_easyocr_installed_languages(dir: &Path) -> Vec<String> {
    let bucket_root = dir.join("easyocr-cache");
    let specs = [
        ("en", "english_g2.pth", &["en"][..]),
        ("ko", "korean_g2.pth", &["ko"][..]),
        ("ja", "japanese_g2.pth", &["ja"][..]),
        ("ch_sim", "chinese_sim.pth", &["zh", "zh-cn"][..]),
        ("ch_tra", "chinese.pth", &["zh-tw"][..]),
        ("ru", "cyrillic_g2.pth", &["ru"][..]),
        (
            "latin",
            "latin_g2.pth",
            &[
                "fr", "de", "nl", "es", "it", "pt", "tr", "pl", "vi", "id", "hu",
            ][..],
        ),
        ("th", "thai_g1.pth", &["th"][..]),
        ("ar", "arabic_g1.pth", &["ar"][..]),
    ];
    let mut languages = HashSet::new();
    for (bucket, recognition_file, codes) in specs {
        let legacy_ready = easyocr_bucket_ready(&bucket_root, recognition_file);
        let bucket_ready = easyocr_bucket_ready(&bucket_root.join(bucket), recognition_file);
        if legacy_ready || bucket_ready {
            for code in codes {
                languages.insert((*code).to_string());
            }
        }
    }
    let mut languages = languages.into_iter().collect::<Vec<_>>();
    languages.sort();
    languages
}

fn easyocr_bucket_ready(base: &Path, recognition_file: &str) -> bool {
    base.join("craft_mlt_25k.pth").exists() && base.join(recognition_file).exists()
}

#[cfg(test)]
#[path = "tests.rs"]
mod tests;
