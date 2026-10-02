//! Local mini-backend boundary for model downloads: HTTP loopback only,
//! no proxy, bounded responses, validated job ids. The job polling protocol
//! mirrors `packages/mini-backend/routers/model_downloads.py`.

use std::{
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, OnceLock,
    },
    time::Duration,
};

use futures_util::{StreamExt, TryStreamExt};
use reqwest::{Body, Client, Response, multipart};
use serde::Deserialize;
use serde::{Serialize, de::DeserializeOwned};
use tokio_util::io::ReaderStream;
use url::Url;

use crate::{
    error::{AppError, AppResult},
    models::model_manager::{
        DesktopModelDownloadPayload, ModelTransferPhase, ModelTransferProgress,
    },
};

use super::TransferObserver;

const MAX_BACKEND_RESPONSE_BYTES: usize = 1024 * 1024;
const MAX_ONNX_BYTES: u64 = 32 * 1024 * 1024 * 1024;

static LOCAL_HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

#[derive(Debug, Clone)]
pub struct LocalModelBackend {
    base_url: Url,
    client: Client,
}

/// Wire shape of `GET /models/downloads/{job_id}` (camelCase, see
/// `core/download_jobs.py::DownloadJobSnapshot`). The backend does not report
/// a checksum here — it validates the SHA-256 itself and fails the job with
/// `errorCode: "checksum_mismatch"`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendJobSnapshot {
    pub state: String,
    #[serde(default)]
    pub bytes_downloaded: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<f64>,
    pub speed_bytes_per_second: Option<u64>,
    pub error_message: Option<String>,
    pub error_code: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateJobResponse {
    job_id: String,
}

#[derive(Serialize)]
struct CreateJobRequest<'a> {
    model_id: &'a str,
    source_language: Option<&'a str>,
    required_disk_bytes: u64,
    download_url: &'a str,
    checksum_sha256: &'a str,
    expected_download_bytes: u64,
}

impl LocalModelBackend {
    pub fn new(base_url: &str) -> AppResult<Self> {
        let mut base_url = Url::parse(base_url.trim())?;
        let host = base_url
            .host_str()
            .ok_or_else(|| AppError::invalid_input("Mini-backend URL has no host."))?;

        let loopback = host.eq_ignore_ascii_case("localhost")
            || host
                .parse::<std::net::IpAddr>()
                .is_ok_and(|address| address.is_loopback());

        if base_url.scheme() != "http"
            || !loopback
            || !base_url.username().is_empty()
            || base_url.password().is_some()
            || base_url.query().is_some()
            || base_url.fragment().is_some()
        {
            return Err(AppError::security(
                "The model mini-backend must use an HTTP loopback URL.",
            ));
        }

        if !base_url.path().ends_with('/') {
            let path = format!("{}/", base_url.path().trim_end_matches('/'));
            base_url.set_path(&path);
        }

        Ok(Self {
            base_url,
            client: local_http_client()?,
        })
    }

    pub async fn create_job(&self, model: &DesktopModelDownloadPayload) -> AppResult<String> {
        let endpoint = self.endpoint(&["models", "downloads"])?;
        let response = self
            .client
            .post(endpoint)
            .timeout(Duration::from_secs(20))
            .json(&CreateJobRequest {
                model_id: &model.id,
                source_language: model.source_language.as_deref(),
                required_disk_bytes: model.required_disk_bytes,
                download_url: &model.download_url,
                checksum_sha256: &model.checksum_sha256,
                expected_download_bytes: model.expected_download_bytes,
            })
            .send()
            .await
            .map_err(|error| AppError::network("Model job submission failed.", &error))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(AppError::Conflict(
                "The local model backend is outdated. Restart the application.".to_string(),
            ));
        }

        if !response.status().is_success() {
            return Err(response_error(response).await);
        }

        let created: CreateJobResponse =
            read_json_limited(response, MAX_BACKEND_RESPONSE_BYTES).await?;
        validate_job_id(&created.job_id)?;
        Ok(created.job_id)
    }

    pub async fn snapshot(&self, job_id: &str) -> AppResult<BackendJobSnapshot> {
        validate_job_id(job_id)?;
        let endpoint = self.endpoint(&["models", "downloads", job_id])?;

        let response = self
            .client
            .get(endpoint)
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|error| AppError::network("Model job polling failed.", &error))?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Err(AppError::NotFound(std::path::PathBuf::from(
                "model-download-job",
            )));
        }

        if !response.status().is_success() {
            return Err(response_error(response).await);
        }

        read_json_limited(response, MAX_BACKEND_RESPONSE_BYTES).await
    }

    pub async fn cancel(&self, job_id: &str) -> AppResult<()> {
        validate_job_id(job_id)?;
        let endpoint = self.endpoint(&["models", "downloads", job_id, "cancel"])?;

        let response = self
            .client
            .post(endpoint)
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .map_err(|error| AppError::network("Model cancellation request failed.", &error))?;

        if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(());
        }

        Err(response_error(response).await)
    }

    pub async fn validate_onnx(
        &self,
        source_path: &std::path::Path,
        observer: Option<TransferObserver>,
    ) -> AppResult<()> {
        let metadata = tokio::fs::metadata(source_path).await?;

        if !metadata.is_file() {
            return Err(AppError::NotAFile(source_path.to_path_buf()));
        }

        if metadata.len() == 0 || metadata.len() > MAX_ONNX_BYTES {
            return Err(AppError::invalid_input(
                "ONNX models must be between 1 byte and 32 GiB.",
            ));
        }

        let file_name = source_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| AppError::invalid_path("ONNX file name is not valid UTF-8."))?
            .to_string();

        let file = tokio::fs::File::open(source_path).await?;
        let total = metadata.len();
        let transferred = Arc::new(AtomicU64::new(0));
        let progress_counter = Arc::clone(&transferred);
        let progress_observer = observer.clone();

        let stream = ReaderStream::new(file).inspect_ok(move |chunk| {
            let current = progress_counter.fetch_add(chunk.len() as u64, Ordering::Relaxed)
                + chunk.len() as u64;

            if let Some(observer) = &progress_observer {
                observer(ModelTransferProgress {
                    phase: ModelTransferPhase::Validating,
                    transferred: current.min(total),
                    total,
                    percent: (current as f64 / total as f64 * 100.0).clamp(0.0, 100.0),
                });
            }
        });

        let body = Body::wrap_stream(stream);
        let part = multipart::Part::stream_with_length(body, total)
            .file_name(file_name)
            .mime_str("application/octet-stream")
            .map_err(|_| AppError::invalid_input("Invalid ONNX MIME type."))?;
        let form = multipart::Form::new().part("file", part);
        let endpoint = self.endpoint(&["enhance", "validate-model"])?;

        let response = self
            .client
            .post(endpoint)
            .timeout(Duration::from_secs(30 * 60))
            .multipart(form)
            .send()
            .await
            .map_err(|error| AppError::network("ONNX validation request failed.", &error))?;

        if response.status().is_success() {
            return Ok(());
        }

        Err(response_error(response).await)
    }

    fn endpoint(&self, segments: &[&str]) -> AppResult<Url> {
        let mut endpoint = self.base_url.clone();
        let mut path = endpoint
            .path_segments_mut()
            .map_err(|_| AppError::invalid_input("Invalid mini-backend base URL."))?;

        for segment in segments {
            if segment.is_empty()
                || segment == &"."
                || segment == &".."
                || segment.contains(['/', '\\', '\0'])
            {
                return Err(AppError::invalid_input(
                    "Invalid mini-backend endpoint segment.",
                ));
            }

            path.push(segment);
        }

        drop(path);
        Ok(endpoint)
    }
}

fn local_http_client() -> AppResult<Client> {
    if let Some(client) = LOCAL_HTTP_CLIENT.get() {
        return Ok(client.clone());
    }

    let client = Client::builder()
        .no_proxy()
        .connect_timeout(Duration::from_secs(3))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("KOMA-Studio/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|error| {
            AppError::network("Local model HTTP client initialization failed.", &error)
        })?;

    if LOCAL_HTTP_CLIENT.set(client.clone()).is_ok() {
        return Ok(client);
    }

    LOCAL_HTTP_CLIENT
        .get()
        .cloned()
        .ok_or_else(|| AppError::Internal("Local HTTP client cache failed.".to_string()))
}

fn validate_job_id(job_id: &str) -> AppResult<()> {
    // The backend returns `uuid4().hex`; anything else is treated as hostile.
    if job_id.is_empty()
        || job_id.len() > 128
        || !job_id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(AppError::security(
            "The mini-backend returned an invalid model job identifier.",
        ));
    }

    Ok(())
}

async fn response_error(response: Response) -> AppError {
    let status = response.status().as_u16();

    match read_json_limited::<serde_json::Value>(response, MAX_BACKEND_RESPONSE_BYTES).await {
        Ok(payload) => {
            let message = payload
                .get("detail")
                .or_else(|| payload.get("error"))
                .or_else(|| payload.get("message"))
                .and_then(serde_json::Value::as_str)
                .map(sanitize_message)
                .unwrap_or_else(|| "The local model backend rejected the request.".to_string());

            AppError::Remote { status, message }
        }
        Err(error) => {
            tracing::warn!(
                status,
                error_kind = error.kind(),
                "failed to decode mini-backend error response"
            );

            AppError::Remote {
                status,
                message: "The local model backend rejected the request.".to_string(),
            }
        }
    }
}

async fn read_json_limited<T>(response: Response, limit: usize) -> AppResult<T>
where
    T: DeserializeOwned,
{
    if response
        .content_length()
        .is_some_and(|content_length| content_length > limit as u64)
    {
        return Err(AppError::Network(
            "Mini-backend response exceeds the supported size.".to_string(),
        ));
    }

    let mut stream = response.bytes_stream();
    let mut bytes = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk
            .map_err(|error| AppError::network("Mini-backend response read failed.", &error))?;

        if bytes.len().saturating_add(chunk.len()) > limit {
            return Err(AppError::Network(
                "Mini-backend response exceeds the supported size.".to_string(),
            ));
        }

        bytes.extend_from_slice(&chunk);
    }

    Ok(serde_json::from_slice(&bytes)?)
}

fn sanitize_message(value: &str) -> String {
    let output: String = value
        .chars()
        .filter(|character| !character.is_control() || *character == ' ')
        .take(512)
        .collect();

    if output.trim().is_empty() {
        "The local model backend rejected the request.".to_string()
    } else {
        output
    }
}
