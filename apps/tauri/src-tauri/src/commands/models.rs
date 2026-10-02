//! Model manager commands: thin typed wrappers over `services::models`.
//! Wire contracts (command names, event channel, payload/record field
//! spellings) are shared with the Electron shell — see
//! `services/models/tests.rs` for the serde pins before renaming anything.

use std::{
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, AtomicU64, Ordering},
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Emitter, Manager, State, ipc::JavaScriptChannelId};
use tauri_plugin_dialog::DialogExt;

use crate::{
    commands::desktop::build_runtime_config,
    error::{AppError, AppResult},
    models::model_manager::{
        DesktopDiskSpaceInfo, DesktopInstalledModelRecord, DesktopModelDownloadPayload,
        DesktopModelImportOnnxPayload, DesktopRemoteModelUpdateCheckResult, ModelManagerEvent,
        ModelQueueResult, ModelTransferProgress,
    },
    services::models::{self, DownloadObserver, ModelServiceContext, ModelServiceEvent, storage},
    state::{CancellationTarget, ModelDownloadStore},
};

const MODEL_EVENT_CHANNEL: &str = "model-manager:event";
/// Exponential backoff base: attempt 1 → 1s, attempt 2 → 2s before retrying.
const RETRY_BASE_DELAY: Duration = Duration::from_secs(1);
/// Granularity at which a cancel request is honoured while waiting to retry.
const RETRY_CANCEL_POLL_INTERVAL: Duration = Duration::from_millis(100);

struct ThrottledTransferChannel {
    channel: tauri::ipc::Channel<ModelTransferProgress>,
    last_emit_ms: AtomicU64,
}

impl ThrottledTransferChannel {
    fn emit(&self, progress: ModelTransferProgress) {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0);
        let previous = self.last_emit_ms.load(Ordering::Relaxed);
        let complete = progress.transferred >= progress.total;

        if !complete && now.saturating_sub(previous) < 50 {
            return;
        }

        self.last_emit_ms.store(now, Ordering::Relaxed);

        if let Err(error) = self.channel.send(progress) {
            tracing::warn!(
                error = %error,
                "model transfer progress receiver disconnected"
            );
        }
    }
}

// Directory walks and manifest parsing are blocking I/O; `#[tauri::command(async)]`
// keeps them off the main thread so the webview never stalls on a slow disk.
#[tauri::command(async, rename = "desktop-models:list-installed")]
pub async fn list_installed(app: AppHandle) -> AppResult<Vec<DesktopInstalledModelRecord>> {
    let root = models_root(&app)?;
    let records = tauri::async_runtime::spawn_blocking(move || storage::list_installed_models(&root)).await??;
    Ok(records)
}

#[tauri::command(async, rename = "desktop-models:get-disk-space")]
pub async fn get_disk_space(app: AppHandle) -> AppResult<DesktopDiskSpaceInfo> {
    let root = models_root(&app)?;
    let info = tauri::async_runtime::spawn_blocking(move || storage::disk_space_info(&root)).await??;
    Ok(info)
}

#[tauri::command(rename = "desktop-models:check-updates")]
pub async fn check_updates(
    app: AppHandle,
    payloads: Vec<DesktopModelDownloadPayload>,
) -> AppResult<Vec<DesktopRemoteModelUpdateCheckResult>> {
    let root = models_root(&app)?;

    let installed = tauri::async_runtime::spawn_blocking(move || {
        storage::list_all_installed_models(&root)
    })
    .await??;

    models::check_remote_updates(payloads, installed).await
}

#[tauri::command(rename = "desktop-models:download")]
pub async fn download(
    app: AppHandle,
    store: State<'_, ModelDownloadStore>,
    payload: DesktopModelDownloadPayload,
) -> AppResult<ModelQueueResult> {
    let model = models::normalize_download_payload(payload)?;
    service_context(&app)?;

    let model_id = model.id.clone();
    let (queue_position, start_worker) = store.enqueue(model).await?;
    let queue_length = queue_position as usize;

    emit_model_event(
        &app,
        ModelManagerEvent::Queued {
            model_id,
            queue_length,
        },
    );

    if start_worker {
        let worker_app = app.clone();
        tauri::async_runtime::spawn(run_download_worker(worker_app));
    }

    Ok(ModelQueueResult {
        queued: true,
        queue_length,
    })
}

#[tauri::command(rename = "desktop-models:import-onnx")]
pub async fn import_onnx(
    app: AppHandle,
    store: State<'_, ModelDownloadStore>,
    payload: DesktopModelImportOnnxPayload,
    on_progress: Option<JavaScriptChannelId>,
) -> AppResult<DesktopInstalledModelRecord> {
    let model = models::normalize_import_payload(payload)?;
    store.reserve(&model.id).await?;

    let result = import_onnx_inner(&app, model.clone(), transfer_observer(&app, on_progress)).await;

    store.release(&model.id).await;
    result
}

#[tauri::command(rename = "desktop-models:cancel")]
pub async fn cancel(
    app: AppHandle,
    store: State<'_, ModelDownloadStore>,
    model_id: String,
) -> AppResult<()> {
    let model_id = models::validate_model_id(&model_id)?;

    if let CancellationTarget::Queued(queued_id) = store.cancel(&model_id).await {
        emit_model_event(&app, ModelManagerEvent::Cancelled { model_id: queued_id });
    }

    Ok(())
}

#[tauri::command(rename = "desktop-models:cancel-all")]
pub async fn cancel_all(app: AppHandle, store: State<'_, ModelDownloadStore>) -> AppResult<()> {
    let (queued, _active) = store.cancel_all().await;

    for model_id in &queued {
        emit_model_event(&app, ModelManagerEvent::Cancelled { model_id: model_id.clone() });
    }

    Ok(())
}

// `remove_dir_all` on a multi-gigabyte model directory must never run on the
// main thread.
#[tauri::command(async, rename = "desktop-models:uninstall")]
pub async fn uninstall(
    app: AppHandle,
    store: State<'_, ModelDownloadStore>,
    model_id: String,
) -> AppResult<()> {
    let model_id = models::validate_model_id(&model_id)?;
    store.reserve(&model_id).await?;

    let root = models_root(&app)?;
    let task_model_id = model_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        storage::uninstall_model(&root, &task_model_id)
    })
    .await;

    store.release(&model_id).await;
    result??;
    Ok(())
}

async fn import_onnx_inner(
    app: &AppHandle,
    model: DesktopModelImportOnnxPayload,
    observer: Option<models::TransferObserver>,
) -> AppResult<DesktopInstalledModelRecord> {
    // `blocking_pick_file` parks the calling thread until the user closes the
    // dialog. Doing that on an async worker starves every other command, so
    // the dialog is driven from the blocking pool.
    let dialog_app = app.clone();
    let selected = tauri::async_runtime::spawn_blocking(move || {
        dialog_app
            .dialog()
            .file()
            .set_title("Importar modelo ONNX")
            .add_filter("ONNX", &["onnx"])
            .blocking_pick_file()
    })
    .await?;

    let selected =
        selected.ok_or_else(|| AppError::Cancelled("ONNX import cancelled.".to_string()))?;
    let source_path = selected
        .into_path()
        .map_err(|_| AppError::invalid_path("Invalid ONNX path."))?;
    let context = service_context(app)?;

    models::import_onnx_model(&context, model, source_path, observer).await
}

async fn run_download_worker(app: AppHandle) {
    loop {
        let store = app.state::<ModelDownloadStore>();
        let Some(task) = store.pop_next().await else {
            break;
        };

        process_download_task(&app, &task.model).await;
        store.clear_active(&task.model.id).await;
    }
}

async fn process_download_task(app: &AppHandle, model: &DesktopModelDownloadPayload) {
    let store = app.state::<ModelDownloadStore>();
    let Some(cancelled) = store.active_cancellation(&model.id).await else {
        tracing::error!(
            model_id = %model.id,
            "active model cancellation state is missing"
        );
        return;
    };

    let context = match service_context(app) {
        Ok(context) => context,
        Err(error) => {
            emit_model_event(
                app,
                ModelManagerEvent::Failed {
                    model_id: model.id.clone(),
                    message: error.to_string(),
                    attempt: 0,
                    will_retry: false,
                    code: Some("backend_unavailable".to_string()),
                },
            );
            return;
        }
    };

    let root = context.root.clone();
    let prepared_model = model.clone();
    let previous_manifest = match tauri::async_runtime::spawn_blocking(move || {
        storage::prepare_download(&root, &prepared_model)
    })
    .await
    {
        Ok(Ok(previous)) => previous,
        Ok(Err(error)) => {
            emit_failure(app, model, 0, error.into(), false);
            return;
        }
        Err(error) => {
            emit_failure(app, model, 0, AppError::from(error).into(), false);
            return;
        }
    };

    let mut final_error = None;

    for attempt in 1..=models::max_download_attempts() {
        if cancelled.load(Ordering::Acquire) {
            emit_cancelled(app, model);
            restore_previous_state(&context.root, &model.id, previous_manifest.as_ref()).await;
            return;
        }

        emit_model_event(
            app,
            ModelManagerEvent::Started {
                model_id: model.id.clone(),
                attempt,
            },
        );

        let progress_app = app.clone();
        let progress_model = model.clone();
        let observer: DownloadObserver = Arc::new(move |event| match event {
            ModelServiceEvent::Progress {
                bytes_downloaded,
                total_bytes,
                speed_bytes_per_second,
                percent,
            } => emit_model_event(
                &progress_app,
                ModelManagerEvent::Progress {
                    model_id: progress_model.id.clone(),
                    bytes_downloaded,
                    total_bytes,
                    speed_bytes_per_second,
                    percent,
                    attempt,
                },
            ),
            ModelServiceEvent::Verifying => emit_model_event(
                &progress_app,
                ModelManagerEvent::Verifying {
                    model_id: progress_model.id.clone(),
                },
            ),
        });

        match models::download_and_install(&context, model, cancelled.as_ref(), observer).await {
            Ok(record) => {
                emit_model_event(
                    app,
                    ModelManagerEvent::Completed {
                        model_id: model.id.clone(),
                        version: record.version,
                        installed_at: record.installed_at,
                    },
                );
                return;
            }
            Err(error)
                if error.code == models::CODE_CANCELLED || cancelled.load(Ordering::Acquire) =>
            {
                emit_cancelled(app, model);
                restore_previous_state(&context.root, &model.id, previous_manifest.as_ref()).await;
                return;
            }
            Err(error)
                if error.should_retry() && attempt < models::max_download_attempts() =>
            {
                tracing::warn!(
                    model_id = %model.id,
                    attempt,
                    code = %error.code,
                    "model download will be retried"
                );

                emit_model_event(
                    app,
                    ModelManagerEvent::Failed {
                        model_id: model.id.clone(),
                        message: error.message.clone(),
                        attempt,
                        will_retry: true,
                        code: Some(error.code.clone()),
                    },
                );
                if wait_before_retry(&cancelled, attempt).await {
                    emit_cancelled(app, model);
                    restore_previous_state(&context.root, &model.id, previous_manifest.as_ref())
                        .await;
                    return;
                }
            }
            Err(error) => {
                final_error = Some(error);
                break;
            }
        }
    }

    restore_previous_state(&context.root, &model.id, previous_manifest.as_ref()).await;

    if let Some(error) = final_error {
        emit_failure(app, model, models::max_download_attempts(), error, false);
    }
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

async fn restore_previous_state(root: &std::path::Path, model_id: &str, previous: Option<&crate::models::model_manager::DesktopModelManifest>) {
    let root = root.to_path_buf();
    let model_id = model_id.to_string();
    let previous = previous.cloned();

    match tauri::async_runtime::spawn_blocking(move || {
        storage::restore_previous_manifest(&root, &model_id, previous.as_ref())
    })
    .await
    {
        Ok(Ok(())) => {}
        Ok(Err(error)) => {
            tracing::error!(
                error_kind = error.kind(),
                "previous model manifest restoration failed"
            );
        }
        Err(error) => {
            tracing::error!(
                error = %error,
                "model manifest restoration task failed"
            );
        }
    }
}

fn emit_cancelled(app: &AppHandle, model: &DesktopModelDownloadPayload) {
    emit_model_event(
        app,
        ModelManagerEvent::Cancelled {
            model_id: model.id.clone(),
        },
    );
}

fn emit_failure(
    app: &AppHandle,
    model: &DesktopModelDownloadPayload,
    attempt: u32,
    error: models::DownloadTaskError,
    will_retry: bool,
) {
    emit_model_event(
        app,
        ModelManagerEvent::Failed {
            model_id: model.id.clone(),
            message: error.message,
            attempt,
            will_retry,
            code: Some(error.code),
        },
    );
}

fn emit_model_event(app: &AppHandle, event: ModelManagerEvent) {
    if let Err(error) = app.emit(MODEL_EVENT_CHANNEL, event) {
        tracing::error!(
            error = %error,
            "model manager event emission failed"
        );
    }
}

fn service_context(app: &AppHandle) -> AppResult<ModelServiceContext> {
    let runtime = build_runtime_config(app);

    if runtime.local_api_url.trim().is_empty() {
        return Err(AppError::not_configured(
            "The local mini-backend is not configured.",
        ));
    }

    ModelServiceContext::new(models_root(app)?, &runtime.local_api_url)
}

fn models_root(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join("models"))
}

fn transfer_observer(
    app: &AppHandle,
    channel: Option<JavaScriptChannelId>,
) -> Option<models::TransferObserver> {
    let channel = channel.and_then(|id| {
        // Manager::get_webview is unstable-gated; get_webview_window is the
        // stable route and WebviewWindow derefs to the webview via AsRef.
        app
            .get_webview_window("main")
            .map(|webview_window| id.channel_on::<_, ModelTransferProgress>(webview_window.as_ref().clone()))
    });
    channel.map(|channel| {
        let progress = Arc::new(ThrottledTransferChannel {
            channel,
            last_emit_ms: AtomicU64::new(0),
        });

        Arc::new(move |payload| progress.emit(payload)) as models::TransferObserver
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn retry_wait_honours_cancellation_immediately() {
        let cancelled = AtomicBool::new(true);
        let started = std::time::Instant::now();
        assert!(wait_before_retry(&cancelled, 3).await);
        assert!(started.elapsed() < RETRY_CANCEL_POLL_INTERVAL);
    }
}
