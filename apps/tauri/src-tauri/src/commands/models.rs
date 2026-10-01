use std::{
    collections::{HashMap, HashSet, VecDeque},
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex, MutexGuard, PoisonError,
    },
    time::Duration,
};

use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_dialog::DialogExt;

use crate::commands::desktop::build_runtime_config;

mod model_support;
use model_support::*;

const MAX_RETRY_ATTEMPTS: u32 = 3;
/// Exponential backoff base: attempt 1 → 1s, attempt 2 → 2s before retrying.
const RETRY_BASE_DELAY: Duration = Duration::from_secs(1);
/// Granularity at which a cancel request is honoured while waiting to retry.
const RETRY_CANCEL_POLL_INTERVAL: Duration = Duration::from_millis(100);
const PARTIAL_FILE_NAME: &str = "download.partial";
const MANIFEST_FILE_NAME: &str = "manifest.json";
const EASYOCR_MODEL_ID: &str = "easyocr";
const PORORO_MODEL_ID: &str = "pororo";
const MANGA_OCR_MODEL_ID: &str = "manga_ocr";
const PADDLE_OCR_MODEL_ID: &str = "paddleocr";
const PADDLE_OCR_EN_MODEL_ID: &str = "paddleocr_en_v5";
const PADDLE_OCR_LATIN_MODEL_ID: &str = "paddleocr_latin_v5";
const PADDLE_OCR_CH_MODEL_ID: &str = "paddleocr_ch_v5";
const MEIKI_OCR_MODEL_ID: &str = "meiki_ocr";
const PADDLE_OCR_VL_MANGA_MODEL_ID: &str = "paddleocr_vl_manga";
const GOT_OCR2_MODEL_ID: &str = "got_ocr2";
const QWEN2_5_VL_3B_MODEL_ID: &str = "qwen2_5_vl_3b";
const MANGALMM_MODEL_ID: &str = "mangalmm";
const ROLMOCR_MODEL_ID: &str = "rolmocr";
const GLM_OCR_ONNX_MODEL_ID: &str = "glm_ocr_onnx";
const SUGOI_MODEL_ID: &str = "sugoi_v4_ja_en_ct2";
const M2M100_MODEL_ID: &str = "m2m100_1_2b_ct2";
const INPAINT_AOT_MODEL_ID: &str = "aot";
const INPAINT_LAMA_MODEL_ID: &str = "lama_manga";
const INPAINT_OPENCV_LAMA_MODEL_ID: &str = "opencv_lama";
const INPAINT_LAMA_FP32_MODEL_ID: &str = "lama_fp32";
const SEGMENT_BAKA_MODEL_ID: &str = "baka_content_cc";
const FONT_RTDETR_MODEL_ID: &str = "font_rtdetr_v2";
const FONT_RTDETR_FILE_NAME: &str = "detector.onnx";
const ENHANCE_MODEL_FILE_NAME: &str = "model.onnx";
const MODEL_EVENT_CHANNEL: &str = "model-manager:event";

const BACKEND_MANAGED_MODEL_IDS: &[&str] = &[
    EASYOCR_MODEL_ID,
    PORORO_MODEL_ID,
    MANGA_OCR_MODEL_ID,
    PADDLE_OCR_MODEL_ID,
    PADDLE_OCR_EN_MODEL_ID,
    PADDLE_OCR_LATIN_MODEL_ID,
    PADDLE_OCR_CH_MODEL_ID,
    MEIKI_OCR_MODEL_ID,
    PADDLE_OCR_VL_MANGA_MODEL_ID,
    GOT_OCR2_MODEL_ID,
    QWEN2_5_VL_3B_MODEL_ID,
    MANGALMM_MODEL_ID,
    ROLMOCR_MODEL_ID,
    GLM_OCR_ONNX_MODEL_ID,
    "waifu2x_swin_unet_art_scan_2x",
    "waifu2x_swin_unet_art_scan_4x",
    "waifu2x_swin_unet_art_2x",
    SUGOI_MODEL_ID,
    M2M100_MODEL_ID,
    INPAINT_AOT_MODEL_ID,
    INPAINT_LAMA_MODEL_ID,
    INPAINT_OPENCV_LAMA_MODEL_ID,
    INPAINT_LAMA_FP32_MODEL_ID,
    SEGMENT_BAKA_MODEL_ID,
    "comic_text_detector",
];

#[derive(Debug, Default)]
pub struct ModelDownloadStore {
    queue: Mutex<VecDeque<DownloadTask>>,
    active: Mutex<Option<ActiveDownload>>,
    processing: AtomicBool,
}

#[derive(Debug, Clone)]
struct DownloadTask {
    model: DesktopModelDownloadPayload,
}

#[derive(Debug, Clone)]
struct ActiveDownload {
    model_id: String,
    cancelled: Arc<AtomicBool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopModelDownloadPayload {
    pub id: String,
    pub name: String,
    pub version: String,
    pub download_url: String,
    // The TS contract (shared-models/desktop-api.ts) and the on-disk manifest
    // both spell this `checksumSHA256`; plain camelCase here produced
    // `checksumSha256` and rejected every download payload from the frontend.
    #[serde(rename = "checksumSHA256", alias = "checksumSha256")]
    pub checksum_sha256: String,
    pub expected_download_bytes: u64,
    pub required_disk_bytes: u64,
    pub source_language: Option<String>,
    pub install_strategy: Option<String>,
    pub runtime_family: Option<String>,
    pub backend_install_endpoint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopModelImportOnnxPayload {
    pub id: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDiskSpaceInfo {
    pub free_bytes: u64,
    pub total_bytes: u64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopInstalledModelRecord {
    pub model_id: String,
    pub version: String,
    pub installed_at: String,
    #[serde(rename = "checksumSHA256", alias = "checksumSha256")]
    pub checksum_sha256: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_languages: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub origin: Option<String>,
    pub model_dir: String,
    pub manifest_path: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRemoteModelUpdateCheckResult {
    pub model_id: String,
    #[serde(rename = "installedChecksumSHA256", alias = "installedChecksumSha256")]
    pub installed_checksum_sha256: Option<String>,
    #[serde(rename = "remoteChecksumSHA256", alias = "remoteChecksumSha256")]
    pub remote_checksum_sha256: Option<String>,
    pub registry_version: String,
    pub checked: bool,
    pub update_available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModelQueueResult {
    pub queued: bool,
    pub queue_length: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
// rename_all only covers the variant NAMES (the "type" tag); without
// rename_all_fields, fields serialize as snake_case (model_id, bytes_downloaded...)
// and the interface — which expects modelId/bytesDownloaded — ignores the events.
// This was the original cause of "V2 always 0%".
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase", tag = "type")]
enum ModelManagerEvent {
    Queued {
        model_id: String,
        queue_length: usize,
    },
    Started {
        model_id: String,
        attempt: u32,
    },
    Progress {
        model_id: String,
        bytes_downloaded: u64,
        total_bytes: u64,
        speed_bytes_per_second: u64,
        percent: f64,
        attempt: u32,
    },
    Verifying {
        model_id: String,
    },
    Completed {
        model_id: String,
        version: String,
        installed_at: String,
    },
    Failed {
        model_id: String,
        message: String,
        attempt: u32,
        will_retry: bool,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
    Cancelled {
        model_id: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DesktopModelManifest {
    #[serde(rename = "modelId")]
    model_id: String,
    version: String,
    #[serde(rename = "installedAt")]
    installed_at: String,
    #[serde(rename = "checksumSHA256")]
    checksum_sha256: String,
    status: String,
    origin: Option<String>,
}

// Directory walks and manifest parsing are blocking I/O; `#[tauri::command(async)]`
// keeps them off the main thread so the webview never stalls on a slow disk.
#[tauri::command(async, rename = "desktop-models:list-installed")]
pub fn list_installed<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<DesktopInstalledModelRecord>, String> {
    list_installed_models(&models_root_dir(&app)?)
}

#[tauri::command(async, rename = "desktop-models:get-disk-space")]
pub fn get_disk_space<R: Runtime>(app: AppHandle<R>) -> Result<DesktopDiskSpaceInfo, String> {
    disk_space_info(&models_root_dir(&app)?)
}

#[tauri::command(rename = "desktop-models:check-updates")]
pub async fn check_updates<R: Runtime>(
    app: AppHandle<R>,
    payloads: Vec<DesktopModelDownloadPayload>,
) -> Result<Vec<DesktopRemoteModelUpdateCheckResult>, String> {
    check_remote_updates(&app, payloads).await
}

#[tauri::command(rename = "desktop-models:download")]
pub fn download<R: Runtime + 'static>(
    app: AppHandle<R>,
    payload: DesktopModelDownloadPayload,
) -> Result<ModelQueueResult, String> {
    enqueue_download(app, payload)
}

#[tauri::command(rename = "desktop-models:import-onnx")]
pub async fn import_onnx<R: Runtime>(
    app: AppHandle<R>,
    payload: DesktopModelImportOnnxPayload,
) -> Result<DesktopInstalledModelRecord, String> {
    // `blocking_pick_file` parks the calling thread until the user closes the
    // dialog. Doing that on an async worker starves every other command, so
    // the dialog is driven from the blocking pool. The builder itself holds a
    // raw window handle and is !Send, hence it is constructed inside the task.
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Importar modelo ONNX")
            .add_filter("ONNX", &["onnx"])
            .blocking_pick_file()
    })
    .await
    .map_err(|error| error.to_string())?;

    let Some(selected) = selected else {
        return Err("ONNX import cancelled.".to_owned());
    };
    let source_path = selected
        .into_path()
        .map_err(|_| "Invalid ONNX path.".to_owned())?;
    import_onnx_model(&app, payload, &source_path).await
}

#[tauri::command(rename = "desktop-models:cancel")]
pub fn cancel<R: Runtime>(app: AppHandle<R>, model_id: String) -> Result<(), String> {
    cancel_download(&app, &model_id)
}

#[tauri::command(rename = "desktop-models:cancel-all")]
pub fn cancel_all<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let store = app.state::<ModelDownloadStore>();
    let queued_ids = lock_unpoisoned(&store.queue)
        .drain(..)
        .map(|task| task.model.id)
        .collect::<Vec<_>>();
    for model_id in queued_ids {
        emit_model_event(&app, ModelManagerEvent::Cancelled { model_id });
    }
    if let Some(active) = lock_unpoisoned(&store.active).as_ref() {
        active.cancelled.store(true, Ordering::Release);
    }
    Ok(())
}

// `remove_dir_all` on a multi-gigabyte model directory must never run on the
// main thread.
#[tauri::command(async, rename = "desktop-models:uninstall")]
pub fn uninstall<R: Runtime>(app: AppHandle<R>, model_id: String) -> Result<(), String> {
    let normalized = sanitize_model_id(&model_id)?;
    cancel_download(&app, &normalized)?;
    let dir = model_dir(&models_root_dir(&app)?, &normalized);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn enqueue_download<R: Runtime + 'static>(
    app: AppHandle<R>,
    payload: DesktopModelDownloadPayload,
) -> Result<ModelQueueResult, String> {
    let store = app.state::<ModelDownloadStore>();
    let model = normalize_download_payload(payload)?;
    let queue_length = {
        // Lock order (active → queue) is shared with the rest of the module;
        // never acquire them in the opposite order.
        let active = lock_unpoisoned(&store.active);
        let mut queue = lock_unpoisoned(&store.queue);
        let already_active = active
            .as_ref()
            .is_some_and(|item| item.model_id == model.id);
        if already_active || queue.iter().any(|task| task.model.id == model.id) {
            return Ok(ModelQueueResult {
                queued: true,
                queue_length: queue.len() + usize::from(active.is_some()),
            });
        }
        queue.push_back(DownloadTask {
            model: model.clone(),
        });
        queue.len()
    };

    emit_model_event(
        &app,
        ModelManagerEvent::Queued {
            model_id: model.id,
            queue_length,
        },
    );

    if !store.processing.swap(true, Ordering::AcqRel) {
        tauri::async_runtime::spawn(process_queue(app));
    }

    Ok(ModelQueueResult {
        queued: true,
        queue_length,
    })
}

async fn process_queue<R: Runtime + 'static>(app: AppHandle<R>) {
    loop {
        let next_task = {
            let store = app.state::<ModelDownloadStore>();
            let mut queue = lock_unpoisoned(&store.queue);
            let task = queue.pop_front();
            drop(queue);
            task
        };
        let Some(task) = next_task else {
            let store = app.state::<ModelDownloadStore>();
            store.processing.store(false, Ordering::Release);
            // Closes the lost-wakeup window: a producer that enqueued between
            // our empty pop and the flag reset saw `processing == true` and did
            // not spawn a worker. If that happened, this worker re-arms itself.
            let has_pending = !lock_unpoisoned(&store.queue).is_empty();
            if has_pending && !store.processing.swap(true, Ordering::AcqRel) {
                continue;
            }
            return;
        };

        if let Err(message) = execute_download_task(&app, &task).await {
            log::error!("model download '{}' aborted: {message}", task.model.id);
            emit_model_event(
                &app,
                ModelManagerEvent::Failed {
                    model_id: task.model.id.clone(),
                    message,
                    attempt: MAX_RETRY_ATTEMPTS,
                    will_retry: false,
                    code: None,
                },
            );
            match models_root_dir(&app) {
                Ok(root) => {
                    if let Err(error) = write_incomplete_manifest(&root, &task.model, "download")
                    {
                        log::warn!(
                            "could not persist incomplete manifest for '{}': {error}",
                            task.model.id
                        );
                    }
                }
                Err(error) => log::warn!(
                    "models root unavailable, skipping incomplete manifest for '{}': {error}",
                    task.model.id
                ),
            }
        }
    }
}

/// Runs every attempt for one task. `active` stays populated for the whole
/// lifetime of the task — including the backoff between attempts — so the user
/// can cancel at any point, not just while bytes are flowing.
async fn execute_download_task<R: Runtime>(
    app: &AppHandle<R>,
    task: &DownloadTask,
) -> Result<(), String> {
    let cancelled = Arc::new(AtomicBool::new(false));
    {
        let store = app.state::<ModelDownloadStore>();
        *lock_unpoisoned(&store.active) = Some(ActiveDownload {
            model_id: task.model.id.clone(),
            cancelled: Arc::clone(&cancelled),
        });
    }

    let outcome = run_download_attempts(app, &task.model, &cancelled).await;
    clear_active_download(app);
    outcome
}

async fn run_download_attempts<R: Runtime>(
    app: &AppHandle<R>,
    model: &DesktopModelDownloadPayload,
    cancelled: &Arc<AtomicBool>,
) -> Result<(), String> {
    let root = models_root_dir(app)?;

    for attempt in 1..=MAX_RETRY_ATTEMPTS {
        if cancelled.load(Ordering::Acquire) {
            write_incomplete_manifest(&root, model, "download")?;
            emit_cancelled(app, model);
            return Ok(());
        }

        emit_model_event(
            app,
            ModelManagerEvent::Started {
                model_id: model.id.clone(),
                attempt,
            },
        );

        match download_and_install(app, model, attempt, cancelled).await {
            Ok(()) => {
                emit_model_event(
                    app,
                    ModelManagerEvent::Completed {
                        model_id: model.id.clone(),
                        version: model.version.clone(),
                        installed_at: chrono::Utc::now().to_rfc3339(),
                    },
                );
                return Ok(());
            }
            Err(_) if cancelled.load(Ordering::Acquire) => {
                write_incomplete_manifest(&root, model, "download")?;
                emit_cancelled(app, model);
                return Ok(());
            }
            Err(error) => {
                let will_retry = attempt < MAX_RETRY_ATTEMPTS && should_retry_download(&error);
                emit_model_event(
                    app,
                    ModelManagerEvent::Failed {
                        model_id: model.id.clone(),
                        message: error.message.clone(),
                        attempt,
                        will_retry,
                        code: error.code,
                    },
                );
                write_incomplete_manifest(&root, model, "download")?;
                if !will_retry {
                    return Ok(());
                }
                if wait_before_retry(cancelled, attempt).await {
                    emit_cancelled(app, model);
                    return Ok(());
                }
            }
        }
    }
    Ok(())
}

/// Exponential backoff that stays responsive to cancellation. Returns `true`
/// when the wait was interrupted by a cancel request.
async fn wait_before_retry(cancelled: &AtomicBool, attempt: u32) -> bool {
    let exponent = attempt.saturating_sub(1).min(8);
    let total = RETRY_BASE_DELAY.saturating_mul(1_u32 << exponent);
    let deadline = tokio::time::Instant::now() + total;

    loop {
        if cancelled.load(Ordering::Acquire) {
            return true;
        }
        let now = tokio::time::Instant::now();
        if now >= deadline {
            return false;
        }
        tokio::time::sleep((deadline - now).min(RETRY_CANCEL_POLL_INTERVAL)).await;
    }
}

fn emit_cancelled<R: Runtime>(app: &AppHandle<R>, model: &DesktopModelDownloadPayload) {
    emit_model_event(
        app,
        ModelManagerEvent::Cancelled {
            model_id: model.id.clone(),
        },
    );
}

/// The store's invariants hold across every critical section (each one is a
/// single queue/option mutation), so a poison caused by a panic elsewhere is
/// safe to recover from instead of taking the whole download pipeline down.
fn lock_unpoisoned<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

#[cfg(test)]
mod tests {
    use super::*;

    // The TS contract (shared-models/desktop-api.ts) spells checksum fields
    // `*SHA256`, matching the on-disk manifest. These tests pin the serde
    // names so a payload from the frontend never fails with
    // "missing field `checksumSha256`" again.
    #[test]
    fn download_payload_accepts_frontend_field_names() {
        let payload = r#"{
            "id": "nllb-200",
            "name": "NLLB 200",
            "version": "1.0.0",
            "downloadUrl": "https://example.com/model.onnx",
            "checksumSHA256": "54e50d7b19c16883541a0f42f2f2be3617c6597457d8a29f86dc6f5d130f8f2d",
            "expectedDownloadBytes": 1234,
            "requiredDiskBytes": 5678
        }"#;
        let parsed: DesktopModelDownloadPayload =
            serde_json::from_str(payload).expect("frontend payload must deserialize");
        assert_eq!(
            parsed.checksum_sha256,
            "54e50d7b19c16883541a0f42f2f2be3617c6597457d8a29f86dc6f5d130f8f2d"
        );

        // The pre-fix plain-camelCase spelling stays accepted on input.
        let legacy = payload.replace("checksumSHA256", "checksumSha256");
        let parsed_legacy: DesktopModelDownloadPayload =
            serde_json::from_str(&legacy).expect("legacy payload spelling must deserialize");
        assert_eq!(parsed_legacy, parsed);
    }

    #[test]
    fn records_serialize_with_frontend_field_names() {
        let record = DesktopInstalledModelRecord {
            model_id: "nllb-200".to_owned(),
            version: "1.0.0".to_owned(),
            installed_at: "2026-08-21T00:00:00Z".to_owned(),
            checksum_sha256: "abc".to_owned(),
            status: "installed".to_owned(),
            installed_languages: None,
            origin: None,
            model_dir: "models/nllb-200".to_owned(),
            manifest_path: "models/nllb-200/manifest.json".to_owned(),
            size_bytes: 1234,
        };
        let json = serde_json::to_value(&record).expect("serialize record");
        assert_eq!(json["checksumSHA256"], "abc");

        let update_check = DesktopRemoteModelUpdateCheckResult {
            model_id: "nllb-200".to_owned(),
            installed_checksum_sha256: Some("abc".to_owned()),
            remote_checksum_sha256: None,
            registry_version: "1.0.0".to_owned(),
            checked: true,
            update_available: false,
        };
        let json = serde_json::to_value(&update_check).expect("serialize update check");
        assert_eq!(json["installedChecksumSHA256"], "abc");
        assert!(json
            .get("remoteChecksumSHA256")
            .is_some_and(serde_json::Value::is_null));
    }

    #[test]
    fn events_serialize_with_camel_case_tag_and_fields() {
        let event = ModelManagerEvent::Progress {
            model_id: "nllb-200".to_owned(),
            bytes_downloaded: 10,
            total_bytes: 100,
            speed_bytes_per_second: 5,
            percent: 10.0,
            attempt: 2,
        };
        let json = serde_json::to_value(&event).expect("serialize event");
        assert_eq!(json["type"], "progress");
        assert_eq!(json["modelId"], "nllb-200");
        assert_eq!(json["bytesDownloaded"], 10);
        assert_eq!(json["speedBytesPerSecond"], 5);

        let failed = ModelManagerEvent::Failed {
            model_id: "x".to_owned(),
            message: "boom".to_owned(),
            attempt: 1,
            will_retry: true,
            code: None,
        };
        let json = serde_json::to_value(&failed).expect("serialize failed event");
        assert_eq!(json["willRetry"], true);
        assert!(json.get("code").is_none());
    }

    #[tokio::test]
    async fn retry_wait_honours_cancellation_immediately() {
        let cancelled = AtomicBool::new(true);
        let started = std::time::Instant::now();
        assert!(wait_before_retry(&cancelled, 3).await);
        assert!(started.elapsed() < RETRY_CANCEL_POLL_INTERVAL);
    }

    #[test]
    fn lock_unpoisoned_recovers_after_panic() {
        let mutex = Arc::new(Mutex::new(VecDeque::<u8>::new()));
        let poisoner = Arc::clone(&mutex);
        let _ = std::thread::spawn(move || {
            let _guard = poisoner.lock().unwrap();
            panic!("poison");
        })
        .join();
        assert!(mutex.is_poisoned());
        lock_unpoisoned(&mutex).push_back(1);
        assert_eq!(lock_unpoisoned(&mutex).len(), 1);
    }
}
