use std::{borrow::Cow, path::PathBuf, time::Duration, time::SystemTime};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

pub(super) const DISCORD_WEBHOOK_PREFIXES: &[&str] = &[
    "https://discord.com/api/webhooks/",
    "https://discordapp.com/api/webhooks/",
];
pub(super) const ALLOWED_LOG_EXTENSIONS: &[&str] = &["log", "txt", "json", "ndjson", "jsonl"];
pub(super) const ALLOWED_ENDPOINT_HOST: &str = "koma-studio.site";
pub(super) const ENDPOINT_INVALID_MESSAGE: &str =
    "The bug-report endpoint must be an https URL on koma-studio.site or a subdomain of it.";
pub(super) const BUG_REPORT_SCHEMA: u8 = 1;

pub(super) const MAX_AUTO_LOG_FILES: usize = 12;
pub(super) const MAX_AUTO_LOG_FILE_BYTES: u64 = 8 * 1024 * 1024;
pub(super) const MAX_MANUAL_ATTACHMENTS: usize = 4;
pub(super) const MAX_MANUAL_FILE_BYTES: usize = 5 * 1024 * 1024;
pub(super) const MAX_SCREENSHOT_BYTES: usize = 6 * 1024 * 1024;
pub(super) const MIN_TITLE_CHARS: usize = 5;
pub(super) const MAX_TITLE_CHARS: usize = 180;
pub(super) const MAX_DESCRIPTION_CHARS: usize = 3500;
pub(super) const MAX_FIELD_CHARS: usize = 1024;
pub(super) const MAX_FILE_NAME_CHARS: usize = 120;
pub(super) const MAX_UPSTREAM_ERROR_CHARS: usize = 512;
pub(super) const MAX_LOG_ITEMS: usize = 24;
pub(super) const MAX_LOG_ITEM_BYTES: usize = 512 * 1024;
pub(super) const MAX_LOGS_TOTAL_BYTES: usize = 3 * 1024 * 1024;
pub(super) const WIRE_BUDGET_BYTES: usize = 20 * 1024 * 1024;
pub(super) const MIN_SCREENSHOT_EDGE: u32 = 320;
pub(super) const BACKEND_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
pub(super) const DEFAULT_ATTACHMENT_NAME: &str = "attachment.bin";
pub(super) const MAX_WEBHOOK_BODY_BYTES: usize = 256 * 1024;

#[derive(Debug, Error)]
pub(super) enum BugReportError {
    #[error("{message}")]
    Rejected {
        status: u16,
        message: Cow<'static, str>,
    },
    #[error("{0}")]
    Internal(String),
}

impl From<crate::error::AppError> for BugReportError {
    fn from(error: crate::error::AppError) -> Self {
        Self::Internal(error.to_string())
    }
}

impl BugReportError {
    pub(super) fn rejected(status: u16, message: impl Into<Cow<'static, str>>) -> Self {
        Self::Rejected {
            status,
            message: message.into(),
        }
    }

    pub(super) fn internal(error: impl std::fmt::Display) -> Self {
        Self::Internal(error.to_string())
    }
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BugReportContext {
    pub(super) route: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ManualAttachmentInput {
    pub(super) name: Option<String>,
    pub(super) mime_type: Option<String>,
    pub(super) content_base64: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BugReportSubmitPayload {
    pub(super) title: Option<String>,
    pub(super) description: Option<String>,
    pub(super) screenshot_data_url: Option<String>,
    pub(super) steps_to_reproduce: Option<String>,
    pub(super) expected_result: Option<String>,
    pub(super) actual_result: Option<String>,
    pub(super) contact: Option<String>,
    pub(super) context: Option<BugReportContext>,
    pub(super) auto_log_ids: Option<Vec<String>>,
    pub(super) attachments: Option<Vec<ManualAttachmentInput>>,
    pub(super) endpoint_url: Option<String>,
    pub(super) include_logs: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(super) enum LogSource {
    App,
    Runtime,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportAutoLogEntry {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) size: u64,
    pub(super) source: LogSource,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportDiagnostics {
    pub(super) timestamp: String,
    pub(super) app_name: String,
    pub(super) app_version: String,
    pub(super) tauri_version: &'static str,
    pub(super) webview_version: Option<String>,
    pub(super) platform: &'static str,
    pub(super) arch: &'static str,
    pub(super) os_family: &'static str,
    pub(super) app_packaged: bool,
    pub(super) env_mode: &'static str,
    pub(super) update_channel: String,
    pub(super) mini_backend_running: bool,
    pub(super) auth_api_url: String,
    pub(super) local_api_url: String,
    pub(super) runtime_artifacts_url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportPrepareResponse {
    pub(super) screenshot_data_url: Option<String>,
    pub(super) auto_logs: Vec<BugReportAutoLogEntry>,
    pub(super) diagnostics: BugReportDiagnostics,
    pub(super) ready: bool,
    pub(super) error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BugReportSubmitResponse {
    pub(super) ok: bool,
    pub(super) status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(super) error: Option<Cow<'static, str>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct BugReportClientInfo {
    pub(super) app_version: String,
    pub(super) shell: &'static str,
    pub(super) platform: &'static str,
    pub(super) arch: &'static str,
    pub(super) channel: String,
    pub(super) session_id: String,
}

#[derive(Debug, Serialize)]
pub(super) struct BugReportLogEntry {
    pub(super) name: String,
    pub(super) content: String,
}

#[derive(Debug, Serialize)]
pub(super) struct BugReportApiAttachment {
    pub(super) name: String,
    pub(super) mime: String,
    pub(super) data: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct BugReportApiPayload {
    pub(super) schema: u8,
    pub(super) title: String,
    pub(super) description: String,
    pub(super) include_logs: bool,
    pub(super) client: BugReportClientInfo,
    pub(super) diagnostics: BugReportDiagnostics,
    pub(super) screenshot: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub(super) logs: Vec<BugReportLogEntry>,
    pub(super) attachments: Vec<BugReportApiAttachment>,
    pub(super) dropped_attachments: usize,
}

#[derive(Debug, Clone)]
pub(super) struct AutoLogFile {
    pub(super) id: String,
    pub(super) name: String,
    pub(super) size: u64,
    pub(super) source: LogSource,
    pub(super) path: PathBuf,
    pub(super) modified: SystemTime,
}

#[derive(Debug)]
pub(super) struct RawImage {
    pub(super) width: u32,
    pub(super) height: u32,
    pub(super) rgba: Vec<u8>,
}

#[derive(Debug)]
pub(super) struct PreparedParts {
    pub(super) title: String,
    pub(super) description: String,
    pub(super) include_logs: bool,
    pub(super) screenshot: Option<String>,
    pub(super) attachments: Vec<BugReportApiAttachment>,
    pub(super) auto_log_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordWebhookSendPayload {
    pub url: String,
    pub body: Value,
}

#[derive(Debug, Serialize)]
pub struct DiscordWebhookSendResult {
    pub ok: bool,
    pub status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl DiscordWebhookSendResult {
    pub(super) fn failure(status: u16, error: impl Into<String>) -> Self {
        Self {
            ok: false,
            status,
            error: Some(error.into()),
        }
    }
}
