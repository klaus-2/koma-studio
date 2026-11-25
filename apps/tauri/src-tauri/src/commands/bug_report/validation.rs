use std::{borrow::Cow, sync::OnceLock};

use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use serde_json::Value;
use tauri::{AppHandle, Runtime};

use super::logs::{collect_log_entries, discovered_logs};
use super::types::{
    ALLOWED_ENDPOINT_HOST, BUG_REPORT_SCHEMA, BugReportApiAttachment, BugReportApiPayload,
    BugReportClientInfo, BugReportDiagnostics, BugReportError, BugReportLogEntry,
    BugReportSubmitPayload, BugReportSubmitResponse, DEFAULT_ATTACHMENT_NAME,
    DISCORD_WEBHOOK_PREFIXES, MAX_DESCRIPTION_CHARS, MAX_FIELD_CHARS, MAX_FILE_NAME_CHARS,
    MAX_MANUAL_ATTACHMENTS, MAX_MANUAL_FILE_BYTES, MAX_SCREENSHOT_BYTES, MAX_TITLE_CHARS,
    MAX_UPSTREAM_ERROR_CHARS, MIN_TITLE_CHARS, ManualAttachmentInput, PreparedParts,
    WIRE_BUDGET_BYTES,
};

pub(super) fn prepare_submission<R: Runtime>(
    app: &AppHandle<R>,
    payload: BugReportSubmitPayload,
    diagnostics: BugReportDiagnostics,
) -> Result<BugReportApiPayload, BugReportError> {
    let parts = prepare_payload_parts(payload)?;
    let discovered = if parts.include_logs {
        discovered_logs(app, parts.auto_log_ids.as_deref())
    } else {
        Vec::new()
    };
    let logs = collect_log_entries(discovered);
    let api_payload = assemble_api_payload(parts, diagnostics, logs);
    enforce_wire_budget(api_payload, WIRE_BUDGET_BYTES)
}

pub(super) fn prepare_payload_parts(
    payload: BugReportSubmitPayload,
) -> Result<PreparedParts, BugReportError> {
    let title = truncate(trimmed(payload.title.as_deref()), MAX_TITLE_CHARS);
    if title.chars().count() < MIN_TITLE_CHARS {
        return Err(BugReportError::rejected(
            400,
            format!("Title must be at least {MIN_TITLE_CHARS} characters."),
        ));
    }
    let description = truncate(
        trimmed(payload.description.as_deref()),
        MAX_DESCRIPTION_CHARS,
    );

    let narrative = [
        ("Route", payload.context.and_then(|context| context.route)),
        ("Steps", payload.steps_to_reproduce),
        ("Expected", payload.expected_result),
        ("Actual", payload.actual_result),
        ("Contact", payload.contact),
    ];
    let sections: Vec<(&'static str, String)> = narrative
        .into_iter()
        .filter_map(|(name, value)| {
            let value = truncate(trimmed(value.as_deref()), MAX_FIELD_CHARS);
            (!value.is_empty()).then_some((name, value))
        })
        .collect();
    let description = assemble_description(&description, &sections);

    let screenshot = payload
        .screenshot_data_url
        .filter(|value| !value.trim().is_empty());
    if let Some(data_url) = &screenshot {
        validate_screenshot_data_url(data_url)?;
    }

    let attachments = validate_manual_attachments(payload.attachments.unwrap_or_default())?;

    Ok(PreparedParts {
        title,
        description,
        include_logs: payload.include_logs.unwrap_or(true),
        screenshot,
        attachments,
        auto_log_ids: payload.auto_log_ids,
    })
}

pub(super) fn assemble_description(
    description: &str,
    sections: &[(&'static str, String)],
) -> String {
    let mut assembled = String::with_capacity(description.len() + 64);
    assembled.push_str(description);
    for (name, value) in sections {
        assembled.push_str("\n\n");
        assembled.push_str(name);
        assembled.push_str(":\n");
        assembled.push_str(value);
    }
    truncate(&assembled, MAX_DESCRIPTION_CHARS)
}

pub(super) fn validate_screenshot_data_url(data_url: &str) -> Result<(), BugReportError> {
    let Some((header, payload)) = data_url.split_once(',') else {
        return Err(BugReportError::rejected(
            400,
            "The screenshot must be a data URL with a ',' separator.",
        ));
    };
    if header != "data:image/png;base64" && header != "data:image/jpeg;base64" {
        return Err(BugReportError::rejected(
            400,
            "The screenshot must be a base64 PNG or JPEG data URL.",
        ));
    }
    if base64::decoded_len_estimate(payload.len()) > MAX_SCREENSHOT_BYTES {
        return Err(BugReportError::rejected(
            400,
            "The screenshot exceeds 6 MB.",
        ));
    }
    let decoded_len = BASE64
        .decode(payload.as_bytes())
        .map_err(|_| BugReportError::rejected(400, "The screenshot must carry valid base64 data."))?
        .len();
    if decoded_len > MAX_SCREENSHOT_BYTES {
        return Err(BugReportError::rejected(
            400,
            "The screenshot exceeds 6 MB.",
        ));
    }
    Ok(())
}

pub(super) fn validate_manual_attachments(
    items: Vec<ManualAttachmentInput>,
) -> Result<Vec<BugReportApiAttachment>, BugReportError> {
    if items.len() > MAX_MANUAL_ATTACHMENTS {
        return Err(BugReportError::rejected(
            400,
            format!("Maximum of {MAX_MANUAL_ATTACHMENTS} attachments."),
        ));
    }

    let mut attachments = Vec::with_capacity(items.len());
    for item in items {
        let name = safe_file_name(item.name.as_deref().unwrap_or_default());
        let mime = item
            .mime_type
            .as_deref()
            .map(str::trim)
            .unwrap_or_default()
            .parse::<mime::Mime>()
            .map_err(|_| {
                BugReportError::rejected(400, format!("Invalid attachment MIME type: {name}"))
            })?;
        if mime.type_() != "image" && mime.type_() != "text" {
            return Err(BugReportError::rejected(
                400,
                format!("Attachment must be an image or text file: {name}"),
            ));
        }
        let data = item.content_base64.unwrap_or_default();
        if base64::decoded_len_estimate(data.len()) > MAX_MANUAL_FILE_BYTES {
            return Err(BugReportError::rejected(
                400,
                format!("{name} exceeds 5 MB."),
            ));
        }
        let decoded_len = BASE64
            .decode(data.as_bytes())
            .map_err(|_| BugReportError::rejected(400, format!("Invalid attachment: {name}")))?
            .len();
        if decoded_len > MAX_MANUAL_FILE_BYTES {
            return Err(BugReportError::rejected(
                400,
                format!("{name} exceeds 5 MB."),
            ));
        }
        attachments.push(BugReportApiAttachment {
            name,
            mime: format!("{}/{}", mime.type_(), mime.subtype()),
            data,
        });
    }
    Ok(attachments)
}

pub(super) fn enforce_wire_budget(
    mut payload: BugReportApiPayload,
    wire_budget: usize,
) -> Result<BugReportApiPayload, BugReportError> {
    let mut dropped = 0usize;
    while serialized_len(&payload)? > wire_budget {
        if let Some(index) = largest_attachment_index(&payload.attachments) {
            payload.attachments.remove(index);
            dropped += 1;
        } else if payload.logs.pop().is_none() {
            return Err(BugReportError::Internal(
                "bug-report payload exceeds the wire budget with nothing left to drop.".to_owned(),
            ));
        }
    }
    payload.dropped_attachments = dropped;
    Ok(payload)
}

fn serialized_len(payload: &BugReportApiPayload) -> Result<usize, BugReportError> {
    serde_json::to_vec(payload)
        .map(|bytes| bytes.len())
        .map_err(|error| BugReportError::Internal(error.to_string()))
}

pub(super) fn largest_attachment_index(attachments: &[BugReportApiAttachment]) -> Option<usize> {
    let mut best: Option<(usize, usize)> = None;
    for (index, attachment) in attachments.iter().enumerate() {
        let size = attachment.data.len();
        match best {
            Some((_, best_size)) if best_size >= size => {}
            _ => best = Some((index, size)),
        }
    }
    best.map(|(index, _)| index)
}

fn assemble_api_payload(
    parts: PreparedParts,
    diagnostics: BugReportDiagnostics,
    logs: Vec<BugReportLogEntry>,
) -> BugReportApiPayload {
    BugReportApiPayload {
        schema: BUG_REPORT_SCHEMA,
        title: parts.title,
        description: parts.description,
        include_logs: parts.include_logs,
        client: BugReportClientInfo {
            app_version: diagnostics.app_version.clone(),
            shell: "tauri",
            platform: diagnostics.platform,
            arch: diagnostics.arch,
            channel: diagnostics.update_channel.clone(),
            session_id: session_id().to_owned(),
        },
        diagnostics,
        screenshot: parts.screenshot,
        logs,
        attachments: parts.attachments,
        dropped_attachments: 0,
    }
}

pub(super) async fn map_bug_report_response(
    response: reqwest::Response,
) -> Result<BugReportSubmitResponse, BugReportError> {
    let status = response.status().as_u16();
    if (200..300).contains(&status) {
        return Ok(BugReportSubmitResponse {
            ok: true,
            status,
            error: None,
        });
    }

    let body = response.text().await.unwrap_or_default();
    let message: Cow<'static, str> = match status {
        300..=399 => {
            format!("The bug-report endpoint answered with a redirect ({status}); reports are never sent elsewhere.").into()
        }
        405 => "The bug-report endpoint rejected the HTTP method (405).".into(),
        413 => "The bug report exceeds the server size limit (413).".into(),
        429 => "Too many bug reports were submitted; try again later (429).".into(),
        400..=499 => {
            let detail = server_error_detail(&body)
                .unwrap_or_else(|| truncate(&body, MAX_UPSTREAM_ERROR_CHARS));
            if detail.is_empty() {
                format!("The bug-report endpoint rejected the report ({status}).").into()
            } else {
                truncate(&detail, MAX_UPSTREAM_ERROR_CHARS).into()
            }
        }
        _ => format!("The bug-report endpoint failed ({status}).").into(),
    };
    let reported_status = if (400..500).contains(&status) {
        status
    } else {
        502
    };
    Err(BugReportError::rejected(reported_status, message))
}

fn server_error_detail(body: &str) -> Option<String> {
    let value: Value = serde_json::from_str(body).ok()?;
    let field = value.get("detail").or_else(|| value.get("error"))?;
    match field {
        Value::String(detail) => Some(detail.clone()),
        other => Some(other.to_string()),
    }
}

pub(super) fn normalize_discord_webhook_url(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    DISCORD_WEBHOOK_PREFIXES
        .iter()
        .any(|prefix| trimmed.starts_with(prefix))
        .then(|| trimmed.to_owned())
}

pub(super) fn is_allowed_bug_report_endpoint(value: &str) -> bool {
    let Ok(url) = url::Url::parse(value.trim()) else {
        return false;
    };
    if url.scheme() != "https" {
        return false;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    let host = host.strip_suffix('.').unwrap_or(host);
    let subdomain_suffix = format!(".{ALLOWED_ENDPOINT_HOST}");
    host == ALLOWED_ENDPOINT_HOST || host.ends_with(&subdomain_suffix)
}

fn session_id() -> &'static str {
    static SESSION_ID: OnceLock<String> = OnceLock::new();
    SESSION_ID.get_or_init(|| uuid::Uuid::new_v4().to_string())
}

pub(super) fn safe_file_name(value: &str) -> String {
    let cleaned: String = value
        .trim()
        .chars()
        .filter(|ch| {
            !ch.is_control() && !matches!(ch, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
        })
        .take(MAX_FILE_NAME_CHARS)
        .collect();
    let cleaned = cleaned.trim_matches(|ch: char| ch == '.' || ch.is_whitespace());
    if cleaned.is_empty() {
        DEFAULT_ATTACHMENT_NAME.to_owned()
    } else {
        cleaned.to_owned()
    }
}

pub(super) fn truncate(value: &str, max_chars: usize) -> String {
    value.trim().chars().take(max_chars).collect()
}

fn trimmed(value: Option<&str>) -> &str {
    value.map(str::trim).unwrap_or_default()
}
