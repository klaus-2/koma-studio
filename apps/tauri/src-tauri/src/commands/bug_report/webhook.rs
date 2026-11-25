use crate::commands::api::client::http_client;

use super::types::{
    DiscordWebhookSendPayload, DiscordWebhookSendResult, MAX_UPSTREAM_ERROR_CHARS,
    MAX_WEBHOOK_BODY_BYTES,
};
use super::validation::{normalize_discord_webhook_url, truncate};

pub(super) async fn send_discord_webhook(
    payload: DiscordWebhookSendPayload,
) -> Result<DiscordWebhookSendResult, String> {
    let Some(webhook_url) = normalize_discord_webhook_url(Some(&payload.url)) else {
        return Ok(DiscordWebhookSendResult::failure(
            400,
            "Invalid Discord webhook URL.",
        ));
    };
    if !payload.body.is_object() {
        return Ok(DiscordWebhookSendResult::failure(
            400,
            "Invalid webhook payload.",
        ));
    }
    let body = serde_json::to_vec(&payload.body).map_err(|error| error.to_string())?;
    if body.len() > MAX_WEBHOOK_BODY_BYTES {
        return Ok(DiscordWebhookSendResult::failure(
            413,
            "Webhook payload exceeds 256 KiB.",
        ));
    }

    let client = http_client().map_err(|error| error.to_string())?;
    let response = match client
        .post(webhook_url)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(body)
        .send()
        .await
    {
        Ok(response) => response,
        Err(error) => return Ok(DiscordWebhookSendResult::failure(0, error.to_string())),
    };

    let status = response.status();
    if status.is_success() {
        return Ok(DiscordWebhookSendResult {
            ok: true,
            status: status.as_u16(),
            error: None,
        });
    }
    let detail = truncate(
        &response.text().await.unwrap_or_default(),
        MAX_UPSTREAM_ERROR_CHARS,
    );
    Ok(DiscordWebhookSendResult {
        ok: false,
        status: status.as_u16(),
        error: (!detail.is_empty()).then_some(detail),
    })
}
