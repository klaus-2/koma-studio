use std::{collections::BTreeMap, sync::Mutex};

use serde_json::Value;
use tauri::State;

const DEFAULT_DISCORD_CLIENT_ID: &str = "1484952540775977061";
const MAX_TEXT_LENGTH: usize = 128;

#[derive(Debug, Default)]
pub struct DiscordRpcState {
    inner: Mutex<DiscordRpcInner>,
}

#[derive(Debug, Default)]
struct DiscordRpcInner {
    enabled: bool,
    connected: bool,
    current_activity: Option<DiscordActivityPayload>,
    #[cfg(feature = "discord-rpc")]
    client: Option<discord_rich_presence::DiscordIpcClient>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DiscordActivityPayload {
    details: Option<String>,
    state: Option<String>,
    large_image_key: Option<String>,
    large_image_text: Option<String>,
    small_image_key: Option<String>,
    small_image_text: Option<String>,
    start_timestamp: Option<i64>,
    end_timestamp: Option<i64>,
}

#[tauri::command(rename = "discord-rpc:set-enabled")]
pub fn set_enabled(
    state: State<DiscordRpcState>,
    enabled: Option<bool>,
    payload: Option<Value>,
) -> Result<bool, String> {
    let enabled = enabled
        .or_else(|| payload.as_ref().and_then(Value::as_bool))
        .or_else(|| {
            payload
                .as_ref()
                .and_then(|value| value.get("enabled"))
                .and_then(Value::as_bool)
        })
        .unwrap_or(false);
    let mut inner = state.inner.lock().map_err(|error| error.to_string())?;
    inner.enabled = enabled;
    if !enabled {
        inner.connected = false;
        inner.current_activity = None;
        disconnect_client(&mut inner);
        return Ok(false);
    }
    connect_client(&mut inner)?;
    Ok(inner.connected)
}

#[tauri::command(rename = "discord-rpc:set-activity")]
pub fn set_activity(state: State<DiscordRpcState>, payload: Value) -> Result<(), String> {
    let activity = activity_from_value(&payload);
    set_activity_payload(&state, activity)
}

#[tauri::command(rename = "discord-rpc:set-preset")]
pub fn set_preset(state: State<DiscordRpcState>, payload: Value) -> Result<(), String> {
    let preset = string_field(&payload, "preset");
    let mut activity = preset_activity(&preset).unwrap_or_else(idle_activity);
    if let Some(overrides) = payload.get("overrides") {
        activity = activity.merge(activity_from_value(overrides));
    }
    set_activity_payload(&state, activity)
}

#[tauri::command(rename = "discord-rpc:set-cleaning")]
pub fn set_cleaning(state: State<DiscordRpcState>, payload: Value) -> Result<(), String> {
    let mode = match string_field(&payload, "mode").as_str() {
        "advanced" => "Advanced",
        _ => "Basic",
    };
    set_activity_payload(
        &state,
        preset_activity("cleaner_redraw_mode")
            .unwrap_or_default()
            .merge(DiscordActivityPayload {
                details: Some(format!(
                    "Cleaning image - {}",
                    truncate_file_name(&string_field(&payload, "fileName"))
                )),
                state: Some(format!("Mode: {mode}")),
                start_timestamp: Some(now_unix_seconds()),
                ..Default::default()
            }),
    )
}

#[tauri::command(rename = "discord-rpc:set-translating")]
pub fn set_translating(state: State<DiscordRpcState>, payload: Value) -> Result<(), String> {
    let from = string_field(&payload, "from");
    let to = string_field(&payload, "to");
    set_activity_payload(
        &state,
        preset_activity("translator_mode")
            .unwrap_or_default()
            .merge(DiscordActivityPayload {
                details: Some(format!(
                    "Translating - {}",
                    truncate_file_name(&string_field(&payload, "fileName"))
                )),
                state: Some(format!("{from} -> {to}")),
                start_timestamp: Some(now_unix_seconds()),
                ..Default::default()
            }),
    )
}

#[tauri::command(rename = "discord-rpc:set-typing")]
pub fn set_typing(state: State<DiscordRpcState>, payload: Value) -> Result<(), String> {
    set_activity_payload(
        &state,
        preset_activity("typesetter_mode")
            .unwrap_or_default()
            .merge(DiscordActivityPayload {
                details: Some(format!(
                    "Typesetting - {}",
                    truncate_file_name(&string_field(&payload, "fileName"))
                )),
                start_timestamp: Some(now_unix_seconds()),
                ..Default::default()
            }),
    )
}

#[tauri::command(rename = "discord-rpc:set-redrawing")]
pub fn set_redrawing(state: State<DiscordRpcState>, payload: Value) -> Result<(), String> {
    set_activity_payload(
        &state,
        preset_activity("cleaner_redraw_mode")
            .unwrap_or_default()
            .merge(DiscordActivityPayload {
                details: Some(format!(
                    "Redrawing - {}",
                    truncate_file_name(&string_field(&payload, "fileName"))
                )),
                start_timestamp: Some(now_unix_seconds()),
                ..Default::default()
            }),
    )
}

#[tauri::command(rename = "discord-rpc:set-dashboard")]
pub fn set_dashboard(state: State<DiscordRpcState>, payload: Value) -> Result<(), String> {
    set_activity_payload(
        &state,
        preset_activity("dashboard")
            .unwrap_or_default()
            .merge(DiscordActivityPayload {
                details: Some("Workspace".to_string()),
                state: Some(
                    non_empty(&string_field(&payload, "userName"))
                        .unwrap_or("User")
                        .to_string(),
                ),
                start_timestamp: Some(now_unix_seconds()),
                ..Default::default()
            }),
    )
}

#[tauri::command(rename = "discord-rpc:set-batch")]
pub fn set_batch_processing(state: State<DiscordRpcState>, payload: Value) -> Result<(), String> {
    let file_count = number_field(&payload, "fileCount").unwrap_or(0);
    let current_index = number_field(&payload, "currentIndex").unwrap_or(0);
    set_activity_payload(
        &state,
        preset_activity("batch_mode")
            .unwrap_or_default()
            .merge(DiscordActivityPayload {
                details: Some(format!(
                    "Batch {}/{} - {}",
                    current_index,
                    file_count,
                    truncate_file_name(&string_field(&payload, "fileName"))
                )),
                start_timestamp: Some(now_unix_seconds()),
                ..Default::default()
            }),
    )
}

#[tauri::command(rename = "discord-rpc:set-idle")]
pub fn set_idle(state: State<DiscordRpcState>) -> Result<(), String> {
    set_activity_payload(&state, idle_activity())
}

#[tauri::command(rename = "discord-rpc:clear-activity")]
pub fn clear_activity(state: State<DiscordRpcState>) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|error| error.to_string())?;
    inner.current_activity = None;
    clear_client_activity(&mut inner)
}

#[tauri::command(rename = "discord-rpc:is-connected")]
pub fn is_connected(state: State<DiscordRpcState>) -> Result<bool, String> {
    Ok(state
        .inner
        .lock()
        .map_err(|error| error.to_string())?
        .connected)
}

#[tauri::command(rename = "discord-rpc:is-enabled")]
pub fn is_enabled(state: State<DiscordRpcState>) -> Result<bool, String> {
    Ok(state
        .inner
        .lock()
        .map_err(|error| error.to_string())?
        .enabled)
}

#[tauri::command(rename = "discord-rpc:get-preset-assets")]
pub fn get_preset_assets() -> BTreeMap<String, String> {
    preset_assets()
}

fn set_activity_payload(
    state: &State<DiscordRpcState>,
    activity: DiscordActivityPayload,
) -> Result<(), String> {
    let mut inner = state.inner.lock().map_err(|error| error.to_string())?;
    inner.current_activity = Some(activity.clone());
    if !inner.enabled {
        return Ok(());
    }
    connect_client(&mut inner)?;
    set_client_activity(&mut inner, &activity)
}

#[cfg(feature = "discord-rpc")]
fn connect_client(inner: &mut DiscordRpcInner) -> Result<(), String> {
    use discord_rich_presence::{DiscordIpc, DiscordIpcClient};

    if inner.connected && inner.client.is_some() {
        return Ok(());
    }
    let client_id = std::env::var("DISCORD_CLIENT_ID")
        .or_else(|_| std::env::var("VITE_DISCORD_CLIENT_ID"))
        .unwrap_or_else(|_| DEFAULT_DISCORD_CLIENT_ID.to_string());
    let mut client = DiscordIpcClient::new(&client_id).map_err(|error| error.to_string())?;
    client.connect().map_err(|error| error.to_string())?;
    inner.connected = true;
    inner.client = Some(client);
    Ok(())
}

#[cfg(not(feature = "discord-rpc"))]
fn connect_client(inner: &mut DiscordRpcInner) -> Result<(), String> {
    inner.connected = false;
    Err("Discord RPC support was not compiled into this build.".to_string())
}

#[cfg(feature = "discord-rpc")]
fn disconnect_client(inner: &mut DiscordRpcInner) {
    use discord_rich_presence::DiscordIpc;

    if let Some(client) = inner.client.as_mut() {
        let _ = client.close();
    }
    inner.client = None;
}

#[cfg(not(feature = "discord-rpc"))]
fn disconnect_client(_inner: &mut DiscordRpcInner) {}

#[cfg(feature = "discord-rpc")]
fn set_client_activity(
    inner: &mut DiscordRpcInner,
    payload: &DiscordActivityPayload,
) -> Result<(), String> {
    use discord_rich_presence::{
        activity::{Activity, Assets, Timestamps},
        DiscordIpc,
    };

    let Some(client) = inner.client.as_mut() else {
        inner.connected = false;
        return Err("Discord RPC is not connected.".to_string());
    };
    let mut activity = Activity::new();
    if let Some(value) = payload.details.as_deref() {
        activity = activity.details(value);
    }
    if let Some(value) = payload.state.as_deref() {
        activity = activity.state(value);
    }
    let mut assets = Assets::new();
    let mut has_assets = false;
    if let Some(value) = payload.large_image_key.as_deref() {
        assets = assets.large_image(value);
        has_assets = true;
    }
    if let Some(value) = payload.large_image_text.as_deref() {
        assets = assets.large_text(value);
        has_assets = true;
    }
    if let Some(value) = payload.small_image_key.as_deref() {
        assets = assets.small_image(value);
        has_assets = true;
    }
    if let Some(value) = payload.small_image_text.as_deref() {
        assets = assets.small_text(value);
        has_assets = true;
    }
    if has_assets {
        activity = activity.assets(assets);
    }
    let mut timestamps = Timestamps::new();
    let mut has_timestamps = false;
    if let Some(value) = payload.start_timestamp {
        timestamps = timestamps.start(value);
        has_timestamps = true;
    }
    if let Some(value) = payload.end_timestamp {
        timestamps = timestamps.end(value);
        has_timestamps = true;
    }
    if has_timestamps {
        activity = activity.timestamps(timestamps);
    }
    client
        .set_activity(activity)
        .map_err(|error| error.to_string())
}

#[cfg(not(feature = "discord-rpc"))]
fn set_client_activity(
    _inner: &mut DiscordRpcInner,
    _payload: &DiscordActivityPayload,
) -> Result<(), String> {
    Err("Discord RPC support was not compiled into this build.".to_string())
}

#[cfg(feature = "discord-rpc")]
fn clear_client_activity(inner: &mut DiscordRpcInner) -> Result<(), String> {
    use discord_rich_presence::DiscordIpc;

    if let Some(client) = inner.client.as_mut() {
        client.clear_activity().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(not(feature = "discord-rpc"))]
fn clear_client_activity(_inner: &mut DiscordRpcInner) -> Result<(), String> {
    Ok(())
}

fn activity_from_value(value: &Value) -> DiscordActivityPayload {
    DiscordActivityPayload {
        details: text_field(value, "details"),
        state: text_field(value, "state"),
        large_image_key: text_field(value, "largeImageKey")
            .or_else(|| text_field(value, "largeImage")),
        large_image_text: text_field(value, "largeImageText")
            .or_else(|| text_field(value, "largeText")),
        small_image_key: text_field(value, "smallImageKey")
            .or_else(|| text_field(value, "smallImage")),
        small_image_text: text_field(value, "smallImageText")
            .or_else(|| text_field(value, "smallText")),
        start_timestamp: integer_field(value, "startTimestamp"),
        end_timestamp: integer_field(value, "endTimestamp"),
    }
}

fn preset_activity(preset: &str) -> Option<DiscordActivityPayload> {
    let (details, state, small) = match preset {
        "dashboard" => ("Workspace", "Dashboard", "dashboard"),
        "cleaner_redraw_mode" => ("Cleaner", "Cleaning and redrawing", "cleaner_redraw_mode"),
        "translator_mode" => ("Translator", "Translating pages", "translator_mode"),
        "typesetter_mode" => ("Typesetter", "Lettering pages", "typesetter_mode"),
        "batch_mode" => (
            "Batch Processing",
            "Processing multiple pages",
            "batch_mode",
        ),
        "aio_pipeline_automatic" => (
            "AIO Pipeline",
            "Automatic processing",
            "aio_pipeline_automatic",
        ),
        "scanlation_feed" => (
            "Scanlation Feed",
            "Reading community updates",
            "scanlation_feed",
        ),
        "settings" => ("Preferences", "Adjusting app settings", "settings"),
        "idle" => ("KOMA Studio", "Idle", "idle"),
        _ => return None,
    };
    Some(DiscordActivityPayload {
        details: Some(details.to_string()),
        state: Some(state.to_string()),
        large_image_key: Some("koma_logo".to_string()),
        large_image_text: Some("KOMA Studio".to_string()),
        small_image_key: Some(small.to_string()),
        small_image_text: Some(state.to_string()),
        start_timestamp: Some(now_unix_seconds()),
        end_timestamp: None,
    })
}

fn idle_activity() -> DiscordActivityPayload {
    preset_activity("idle").unwrap_or_default()
}

fn preset_assets() -> BTreeMap<String, String> {
    [
        ("koma_logo", "KOMA Studio"),
        ("dashboard", "Dashboard"),
        ("cleaner_redraw_mode", "Cleaner"),
        ("translator_mode", "Translator"),
        ("typesetter_mode", "Typesetter"),
        ("batch_mode", "Batch Mode"),
        ("aio_pipeline_automatic", "AIO Pipeline"),
        ("scanlation_feed", "Scanlation Feed"),
        ("settings", "Settings"),
        ("idle", "Idle"),
    ]
    .into_iter()
    .map(|(key, label)| (key.to_string(), label.to_string()))
    .collect()
}

fn string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string()
}

fn text_field(value: &Value, key: &str) -> Option<String> {
    non_empty(&string_field(value, key)).map(|value| safe_text(value, MAX_TEXT_LENGTH))
}

fn integer_field(value: &Value, key: &str) -> Option<i64> {
    value.get(key).and_then(Value::as_i64)
}

fn number_field(value: &Value, key: &str) -> Option<i64> {
    value.get(key).and_then(Value::as_i64).or_else(|| {
        value
            .get(key)
            .and_then(Value::as_f64)
            .map(|value| value.round() as i64)
    })
}

fn non_empty(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn safe_text(value: &str, max_len: usize) -> String {
    value.trim().chars().take(max_len).collect()
}

fn truncate_file_name(value: &str) -> String {
    let safe = safe_text(value, 48);
    if safe.is_empty() {
        "Untitled".to_string()
    } else {
        safe
    }
}

fn now_unix_seconds() -> i64 {
    chrono::Utc::now().timestamp()
}

impl DiscordActivityPayload {
    fn merge(self, overrides: DiscordActivityPayload) -> Self {
        Self {
            details: overrides.details.or(self.details),
            state: overrides.state.or(self.state),
            large_image_key: overrides.large_image_key.or(self.large_image_key),
            large_image_text: overrides.large_image_text.or(self.large_image_text),
            small_image_key: overrides.small_image_key.or(self.small_image_key),
            small_image_text: overrides.small_image_text.or(self.small_image_text),
            start_timestamp: overrides.start_timestamp.or(self.start_timestamp),
            end_timestamp: overrides.end_timestamp.or(self.end_timestamp),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_activity_payload_aliases() {
        let payload = activity_from_value(&json!({
            "details": "Working",
            "largeImage": "logo",
            "smallText": "Mode",
            "startTimestamp": 10
        }));
        assert_eq!(payload.details.as_deref(), Some("Working"));
        assert_eq!(payload.large_image_key.as_deref(), Some("logo"));
        assert_eq!(payload.small_image_text.as_deref(), Some("Mode"));
        assert_eq!(payload.start_timestamp, Some(10));
    }

    #[test]
    fn exposes_known_preset_assets() {
        let assets = preset_assets();
        assert_eq!(assets.get("koma_logo"), Some(&"KOMA Studio".to_string()));
        assert!(preset_activity("translator_mode").is_some());
        assert!(preset_activity("unknown").is_none());
    }
}
