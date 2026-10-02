//! Model download orchestration: payload normalization, backend job polling
//! with confirmed cancellation and bounded retries, remote update checks, and
//! the transactional ONNX import flow.

pub mod backend;
pub mod checksum;
pub mod storage;
#[cfg(test)]
mod tests;

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

use futures_util::{StreamExt, stream};

use crate::{
    error::{AppError, AppResult},
    models::model_manager::{
        DesktopInstalledModelRecord, DesktopModelDownloadPayload, DesktopModelImportOnnxPayload,
        DesktopRemoteModelUpdateCheckResult,
    },
};

use self::backend::{BackendJobSnapshot, LocalModelBackend};

const MODEL_JOB_POLL_INTERVAL: Duration = Duration::from_millis(500);
const MAX_CONSECUTIVE_POLL_FAILURES: u32 = 120;
const MAX_JOB_DURATION: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_CHECK_MODELS: usize = 1000;
const MAX_MODEL_BYTES: u64 = 2 * 1024 * 1024 * 1024 * 1024;
const MAX_DOWNLOAD_ATTEMPTS: u32 = 3;

/// Wire-stable backend error codes (see `core/download_jobs.py`).
pub const CODE_CHECKSUM_MISMATCH: &str = "checksum_mismatch";
pub const CODE_DISK_FULL: &str = "disk_full";
pub const CODE_CANCELLED: &str = "cancelled";
pub const CODE_NETWORK: &str = "network";
pub const CODE_RATE_LIMITED: &str = "rate_limited";
pub const CODE_UNKNOWN: &str = "unknown";

const BACKEND_MANAGED_MODEL_IDS: &[&str] = &[
    "easyocr",
    "pororo",
    "manga_ocr",
    "paddleocr",
    "paddleocr_en_v5",
    "paddleocr_latin_v5",
    "paddleocr_ch_v5",
    "meiki_ocr",
    "paddleocr_vl_manga",
    "got_ocr2",
    "qwen2_5_vl_3b",
    "mangalmm",
    "rolmocr",
    "glm_ocr_onnx",
    "waifu2x_swin_unet_art_scan_2x",
    "waifu2x_swin_unet_art_scan_4x",
    "waifu2x_swin_unet_art_2x",
    "sugoi_v4_ja_en_ct2",
    "m2m100_1_2b_ct2",
    "aot",
    "lama_manga",
    "opencv_lama",
    "lama_fp32",
    "baka_content_cc",
    "comic_text_detector",
];

pub type TransferObserver = Arc<dyn Fn(crate::models::model_manager::ModelTransferProgress) + Send + Sync + 'static>;

pub type DownloadObserver = Arc<dyn Fn(ModelServiceEvent) + Send + Sync + 'static>;

#[derive(Debug, Clone)]
pub enum ModelServiceEvent {
    Progress {
        bytes_downloaded: u64,
        total_bytes: u64,
        speed_bytes_per_second: u64,
        percent: f64,
    },
    Verifying,
}

#[derive(Debug, Clone)]
pub struct ModelServiceContext {
    pub root: PathBuf,
    pub backend: LocalModelBackend,
}

#[derive(Debug, Clone, thiserror::Error)]
#[error("{message}")]
pub struct DownloadTaskError {
    pub message: String,
    pub code: String,
}

impl DownloadTaskError {
    pub fn cancelled() -> Self {
        Self {
            message: "Model download was cancelled.".to_string(),
            code: CODE_CANCELLED.to_string(),
        }
    }

    pub fn should_retry(&self) -> bool {
        matches!(
            self.code.as_str(),
            CODE_NETWORK | CODE_RATE_LIMITED | "job_lost" | "backend_unavailable"
        )
    }
}

impl ModelServiceContext {
    pub fn new(root: PathBuf, backend_url: &str) -> AppResult<Self> {
        Ok(Self {
            root,
            backend: LocalModelBackend::new(backend_url)?,
        })
    }
}

/// Normalizes a frontend download payload: validates the id, checksum, size
/// bounds, and restricts download origins to the approved HTTPS model hosts.
pub fn normalize_download_payload(
    mut model: DesktopModelDownloadPayload,
) -> AppResult<DesktopModelDownloadPayload> {
    model.id = validate_model_id(&model.id)?;
    model.name = sanitize_required_text(&model.name, 256, "model name")?;
    model.version = validate_model_version(&model.version)?;
    model.checksum_sha256 = checksum::normalize_checksum(&model.checksum_sha256)?;
    model.download_url = checksum::validate_remote_download_url(&model.download_url)?.to_string();

    if model.expected_download_bytes == 0
        || model.expected_download_bytes > MAX_MODEL_BYTES
        || model.required_disk_bytes == 0
        || model.required_disk_bytes > MAX_MODEL_BYTES
    {
        return Err(AppError::invalid_input("Invalid model download or disk size."));
    }

    model.source_language = model
        .source_language
        .map(|language| language.trim().to_ascii_lowercase())
        .filter(|language| !language.is_empty())
        .map(|language| {
            if language.len() > 32
                || !language
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
            {
                return Err(AppError::invalid_input("Invalid model source language."));
            }
            Ok(language)
        })
        .transpose()?;

    if BACKEND_MANAGED_MODEL_IDS.contains(&model.id.as_str()) {
        model.install_strategy = Some("backend_managed".to_string());
        model.backend_install_endpoint = Some("/models/install".to_string());
    } else {
        model.install_strategy =
            normalize_optional_identifier(model.install_strategy, 64, "install strategy")?;
        model.backend_install_endpoint = match model.backend_install_endpoint {
            Some(endpoint) if endpoint == "/models/install" => Some(endpoint),
            Some(_) => {
                return Err(AppError::invalid_input(
                    "Invalid model backend installation endpoint.",
                ));
            }
            None => None,
        };
    }

    model.runtime_family = normalize_optional_identifier(model.runtime_family, 64, "runtime family")?;

    Ok(model)
}

pub fn normalize_import_payload(
    mut model: DesktopModelImportOnnxPayload,
) -> AppResult<DesktopModelImportOnnxPayload> {
    model.id = validate_model_id(&model.id)?;
    model.name = sanitize_required_text(&model.name, 256, "model name")?;
    model.version = validate_model_version(&model.version)?;
    Ok(model)
}

/// Trims to lowercase and validates the mini-backend id charset; the same
/// value names the on-disk directory, so path components are rejected.
pub fn validate_model_id(model_id: &str) -> AppResult<String> {
    let normalized = model_id.trim().to_ascii_lowercase();
    let valid = !normalized.is_empty()
        && normalized.len() <= 128
        && normalized.chars().all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || matches!(character, '.' | '_' | '-')
        });

    if valid {
        Ok(normalized)
    } else {
        Err(AppError::invalid_input("Invalid model ID."))
    }
}

pub async fn download_and_install(
    context: &ModelServiceContext,
    model: &DesktopModelDownloadPayload,
    cancelled: &AtomicBool,
    observer: DownloadObserver,
) -> Result<DesktopInstalledModelRecord, DownloadTaskError> {
    let root = context.root.clone();
    let required = model.required_disk_bytes;

    tokio::task::spawn_blocking(move || storage::ensure_enough_disk_space(&root, required))
        .await
        .map_err(|error| DownloadTaskError::from(AppError::from(error)))?
        .map_err(DownloadTaskError::from)?;

    let job_id = context
        .backend
        .create_job(model)
        .await
        .map_err(DownloadTaskError::from)?;

    let mut interval = tokio::time::interval(MODEL_JOB_POLL_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    let started_at = Instant::now();
    let mut consecutive_failures = 0_u32;
    let mut cancellation_accepted = false;
    let mut cancellation_started = None::<Instant>;
    let mut last_state = String::new();

    loop {
        interval.tick().await;

        if started_at.elapsed() > MAX_JOB_DURATION {
            return Err(DownloadTaskError {
                message: "Model download exceeded the maximum execution time.".to_string(),
                code: CODE_NETWORK.to_string(),
            });
        }

        if cancelled.load(Ordering::Acquire) && !cancellation_accepted {
            match context.backend.cancel(&job_id).await {
                Ok(()) => {
                    cancellation_accepted = true;
                    cancellation_started = Some(Instant::now());
                }
                Err(error) => {
                    tracing::warn!(
                        error_kind = error.kind(),
                        "model cancellation confirmation failed"
                    );
                }
            }
        }

        if cancellation_accepted
            && cancellation_started
                .is_some_and(|started| started.elapsed() >= Duration::from_secs(30))
        {
            return Err(DownloadTaskError::cancelled());
        }

        let snapshot = match context.backend.snapshot(&job_id).await {
            Ok(snapshot) => {
                consecutive_failures = 0;
                snapshot
            }
            Err(AppError::NotFound(_)) => {
                return Err(DownloadTaskError {
                    message: "The model download job was lost after a backend restart.".to_string(),
                    code: "job_lost".to_string(),
                });
            }
            Err(error) => {
                consecutive_failures += 1;
                tracing::warn!(
                    failures = consecutive_failures,
                    error_kind = error.kind(),
                    "model job polling failed"
                );

                if consecutive_failures >= MAX_CONSECUTIVE_POLL_FAILURES {
                    return Err(DownloadTaskError::from(error));
                }

                continue;
            }
        };

        if snapshot.state != last_state {
            tracing::debug!(state = %snapshot.state, "model job state changed");
            last_state.clone_from(&snapshot.state);
        }

        match snapshot.state.as_str() {
            "queued" => {}
            "downloading" => emit_progress(model, &snapshot, &observer),
            "verifying" => observer(ModelServiceEvent::Verifying),
            "ready" => {
                observer(ModelServiceEvent::Verifying);

                let root = context.root.clone();
                let model = model.clone();
                return tokio::task::spawn_blocking(move || storage::complete_download(&root, &model))
                    .await
                    .map_err(|error| DownloadTaskError::from(AppError::from(error)))?
                    .map_err(DownloadTaskError::from);
            }
            "cancelled" => return Err(DownloadTaskError::cancelled()),
            "error" => return Err(task_error_from_snapshot(&snapshot)),
            unknown => {
                tracing::warn!(state = unknown, "mini-backend returned unknown job state");
            }
        }
    }
}

pub async fn import_onnx_model(
    context: &ModelServiceContext,
    model: DesktopModelImportOnnxPayload,
    source_path: PathBuf,
    observer: Option<TransferObserver>,
) -> AppResult<DesktopInstalledModelRecord> {
    let source_metadata = tokio::fs::symlink_metadata(&source_path).await?;

    if source_metadata.file_type().is_symlink() || !source_metadata.is_file() {
        return Err(AppError::NotAFile(source_path));
    }

    let valid_extension = source_path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("onnx"));

    if !valid_extension {
        return Err(AppError::UnsupportedMediaType(
            "Manual model import accepts only ONNX files.".to_string(),
        ));
    }

    context
        .backend
        .validate_onnx(&source_path, observer.clone())
        .await?;

    let root = context.root.clone();

    tokio::task::spawn_blocking(move || {
        storage::import_onnx_model(&root, &model, &source_path, observer)
    })
    .await?
}

pub async fn check_remote_updates(
    models: Vec<DesktopModelDownloadPayload>,
    installed: Vec<DesktopInstalledModelRecord>,
) -> AppResult<Vec<DesktopRemoteModelUpdateCheckResult>> {
    if models.len() > MAX_CHECK_MODELS {
        return Err(AppError::invalid_input(
            "At most 1,000 models may be checked in one operation.",
        ));
    }

    let installed = Arc::new(
        installed
            .into_iter()
            .filter(|record| record.status == "installed")
            .map(|record| (record.model_id.clone(), record))
            .collect::<HashMap<_, _>>(),
    );

    let checks = stream::iter(models)
        .map(|model| {
            let installed = Arc::clone(&installed);

            async move {
                let model_id = validate_model_id(&model.id)?;

                let Some(record) = installed.get(&model_id) else {
                    return Ok(None);
                };

                let remote_checksum = if checksum::is_valid_checksum(&model.checksum_sha256) {
                    Some(checksum::normalize_checksum(&model.checksum_sha256)?)
                } else {
                    resolve_remote_checksum(&model.download_url).await?
                };

                let checksum_differs = match remote_checksum.as_ref() {
                    Some(remote) => *remote != record.checksum_sha256,
                    None => false,
                };
                let update_available = checksum_differs || record.version != model.version;

                Ok(Some(DesktopRemoteModelUpdateCheckResult {
                    model_id,
                    installed_checksum_sha256: (!record.checksum_sha256.is_empty())
                        .then(|| record.checksum_sha256.clone()),
                    remote_checksum_sha256: remote_checksum.clone(),
                    registry_version: model.version,
                    checked: remote_checksum.is_some(),
                    update_available,
                }))
            }
        })
        .buffer_unordered(4)
        .collect::<Vec<AppResult<Option<DesktopRemoteModelUpdateCheckResult>>>>()
        .await;

    let mut results = Vec::new();
    for result in checks {
        if let Some(result) = result? {
            results.push(result);
        }
    }

    results.sort_by(|left, right| left.model_id.cmp(&right.model_id));
    Ok(results)
}

pub fn max_download_attempts() -> u32 {
    MAX_DOWNLOAD_ATTEMPTS
}

fn emit_progress(
    model: &DesktopModelDownloadPayload,
    snapshot: &BackendJobSnapshot,
    observer: &DownloadObserver,
) {
    let bytes_downloaded = snapshot.bytes_downloaded;
    let backend_total = snapshot.total_bytes.unwrap_or(0);
    let has_real_total = backend_total > 0;
    let total_bytes = if has_real_total {
        backend_total.max(bytes_downloaded)
    } else {
        model.expected_download_bytes.max(bytes_downloaded)
    };

    let percent = if has_real_total {
        snapshot.percent.unwrap_or_else(|| {
            if total_bytes == 0 {
                0.0
            } else {
                bytes_downloaded as f64 / total_bytes as f64 * 100.0
            }
        })
    } else if total_bytes > 0 {
        (bytes_downloaded as f64 / total_bytes as f64 * 100.0).min(98.0)
    } else {
        0.0
    };

    observer(ModelServiceEvent::Progress {
        bytes_downloaded,
        total_bytes,
        speed_bytes_per_second: snapshot.speed_bytes_per_second.unwrap_or(0),
        percent: percent.clamp(0.0, if has_real_total { 100.0 } else { 98.0 }),
    });
}

fn task_error_from_snapshot(snapshot: &BackendJobSnapshot) -> DownloadTaskError {
    let message = snapshot
        .error_message
        .as_deref()
        .map(sanitize_error_message)
        .unwrap_or_else(|| "Model download failed.".to_string());

    let code = match snapshot.error_code.as_deref() {
        Some(CODE_CHECKSUM_MISMATCH) => CODE_CHECKSUM_MISMATCH,
        Some(CODE_DISK_FULL) => CODE_DISK_FULL,
        Some(CODE_CANCELLED) => CODE_CANCELLED,
        Some(CODE_NETWORK) => CODE_NETWORK,
        Some(CODE_RATE_LIMITED) => CODE_RATE_LIMITED,
        _ => CODE_UNKNOWN,
    };

    DownloadTaskError {
        message,
        code: code.to_string(),
    }
}

async fn resolve_remote_checksum(download_url: &str) -> AppResult<Option<String>> {
    match checksum::resolve_checksum_from_head(download_url).await {
        Ok(Some(checksum)) => return Ok(Some(checksum)),
        Ok(None) => {}
        Err(error) => {
            tracing::warn!(
                error_kind = error.kind(),
                "model checksum HEAD resolution failed"
            );
        }
    }

    checksum::resolve_checksum_from_hugging_face_api(download_url).await
}

fn validate_model_version(version: &str) -> AppResult<String> {
    let normalized: String = version
        .trim()
        .chars()
        .filter(|character| !character.is_control())
        .take(64)
        .collect();

    if normalized.is_empty() {
        return Err(AppError::invalid_input("Invalid model version."));
    }

    Ok(normalized)
}

fn normalize_optional_identifier(
    value: Option<String>,
    max_length: usize,
    field: &str,
) -> AppResult<Option<String>> {
    value
        .map(|value| {
            let normalized = value.trim().to_ascii_lowercase();

            if normalized.is_empty() {
                return Ok(None);
            }

            if normalized.len() > max_length
                || !normalized
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
            {
                return Err(AppError::invalid_input(format!("Invalid model {field}.")));
            }

            Ok(Some(normalized))
        })
        .transpose()
        .map(Option::flatten)
}

fn sanitize_required_text(value: &str, max_length: usize, field: &str) -> AppResult<String> {
    let output: String = value
        .trim()
        .chars()
        .filter(|character| !character.is_control())
        .take(max_length)
        .collect();

    if output.is_empty() {
        Err(AppError::invalid_input(format!("Invalid {field}.")))
    } else {
        Ok(output)
    }
}

fn sanitize_error_message(value: &str) -> String {
    let output: String = value
        .chars()
        .filter(|character| !character.is_control() || *character == ' ')
        .take(512)
        .collect();

    if output.trim().is_empty() {
        "Model download failed.".to_string()
    } else {
        output
    }
}

impl From<AppError> for DownloadTaskError {
    fn from(error: AppError) -> Self {
        let code = match &error {
            AppError::InvalidInput(_) | AppError::UnsupportedMediaType(_) => "invalid_input",
            AppError::Integrity(_) => CODE_CHECKSUM_MISMATCH,
            AppError::Cancelled(_) => CODE_CANCELLED,
            AppError::Network(_) | AppError::Remote { .. } | AppError::RateLimited(_) => CODE_NETWORK,
            AppError::NotFound(_) => "job_lost",
            AppError::Io(_) => "filesystem",
            AppError::Conflict(message) if message.to_ascii_lowercase().contains("disk space") => {
                CODE_DISK_FULL
            }
            _ => CODE_UNKNOWN,
        };

        let message = match &error {
            AppError::Io(_) => "A model filesystem operation failed.".to_string(),
            AppError::Internal(_) | AppError::Serialization(_) => {
                "An internal model operation failed.".to_string()
            }
            other => sanitize_error_message(&other.to_string()),
        };

        Self {
            message,
            code: code.to_string(),
        }
    }
}
