use std::{
    collections::BTreeMap,
    io,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, RecvTimeoutError},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};

use serde::Deserialize;
use serde_json::Value;
use tauri::State;
use thiserror::Error;
use tokio::sync::oneshot;

pub const DEFAULT_DISCORD_CLIENT_ID: &str = "1484952540775977061";
const MAX_TEXT_CHARS: usize = 128;
const MAX_FILE_NAME_CHARS: usize = 48;
/// Discord silently drops presence updates faster than ~1 per 15 s. The
/// worker coalesces bursts so only the latest activity is flushed per window.
const MIN_UPDATE_INTERVAL: Duration = Duration::from_secs(15);
const RECONNECT_BACKOFF: Duration = Duration::from_secs(5);
const ENABLE_REPLY_TIMEOUT: Duration = Duration::from_secs(5);
/// A hung named pipe must not stall the presence worker forever: an attempt
/// that outlives this budget is abandoned (the attempt thread drops its own
/// transport when the pipe eventually errors or returns).
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, Error)]
pub enum PresenceError {
    #[error("Discord presence worker is not running.")]
    WorkerGone,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DiscordActivity {
    details: Option<String>,
    state: Option<String>,
    large_image_key: Option<String>,
    large_image_text: Option<String>,
    small_image_key: Option<String>,
    small_image_text: Option<String>,
    start_timestamp: Option<i64>,
    end_timestamp: Option<i64>,
}

impl DiscordActivity {
    fn merge(self, overrides: Self) -> Self {
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

    fn started_now(mut self) -> Self {
        self.start_timestamp = Some(chrono::Utc::now().timestamp());
        self
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Preset {
    Dashboard,
    CleanerRedraw,
    Translator,
    Typesetter,
    Batch,
    AioPipelineAutomatic,
    ScanlationFeed,
    Settings,
    Idle,
}

impl Preset {
    const ALL: [Self; 9] = [
        Self::Dashboard,
        Self::CleanerRedraw,
        Self::Translator,
        Self::Typesetter,
        Self::Batch,
        Self::AioPipelineAutomatic,
        Self::ScanlationFeed,
        Self::Settings,
        Self::Idle,
    ];

    fn parse(raw: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|preset| preset.key() == raw.trim())
    }

    const fn key(self) -> &'static str {
        match self {
            Self::Dashboard => "dashboard",
            Self::CleanerRedraw => "cleaner_redraw_mode",
            Self::Translator => "translator_mode",
            Self::Typesetter => "typesetter_mode",
            Self::Batch => "batch_mode",
            Self::AioPipelineAutomatic => "aio_pipeline_automatic",
            Self::ScanlationFeed => "scanlation_feed",
            Self::Settings => "settings",
            Self::Idle => "idle",
        }
    }

    /// `(details, state)` as shown in the Discord card.
    const fn labels(self) -> (&'static str, &'static str) {
        match self {
            Self::Dashboard => ("Workspace", "Dashboard"),
            Self::CleanerRedraw => ("Cleaner", "Cleaning and redrawing"),
            Self::Translator => ("Translator", "Translating pages"),
            Self::Typesetter => ("Typesetter", "Lettering pages"),
            Self::Batch => ("Batch Processing", "Processing multiple pages"),
            Self::AioPipelineAutomatic => ("AIO Pipeline", "Automatic processing"),
            Self::ScanlationFeed => ("Scanlation Feed", "Reading community updates"),
            Self::Settings => ("Preferences", "Adjusting app settings"),
            Self::Idle => ("KOMA Studio", "Idle"),
        }
    }

    const fn asset_label(self) -> &'static str {
        match self {
            Self::Dashboard => "Dashboard",
            Self::CleanerRedraw => "Cleaner",
            Self::Translator => "Translator",
            Self::Typesetter => "Typesetter",
            Self::Batch => "Batch Mode",
            Self::AioPipelineAutomatic => "AIO Pipeline",
            Self::ScanlationFeed => "Scanlation Feed",
            Self::Settings => "Settings",
            Self::Idle => "Idle",
        }
    }

    fn activity(self) -> DiscordActivity {
        let (details, state) = self.labels();
        DiscordActivity {
            details: Some(details.to_owned()),
            state: Some(state.to_owned()),
            large_image_key: Some("koma_logo".to_owned()),
            large_image_text: Some("KOMA Studio".to_owned()),
            small_image_key: Some(self.key().to_owned()),
            small_image_text: Some(state.to_owned()),
            start_timestamp: None,
            end_timestamp: None,
        }
        .started_now()
    }
}

enum PresenceCommand {
    Enable(oneshot::Sender<bool>),
    Disable,
    SetActivity(Box<DiscordActivity>),
    ClearActivity,
}

/// Managed state. All Discord IPC happens on one dedicated OS thread; commands
/// only enqueue, so they never block the Tauri main thread.
pub struct DiscordPresence {
    enabled: AtomicBool,
    connected: Arc<AtomicBool>,
    sender: mpsc::Sender<PresenceCommand>,
}

impl DiscordPresence {
    pub fn spawn(client_id: String) -> io::Result<Self> {
        let (sender, receiver) = mpsc::channel();
        let connected = Arc::new(AtomicBool::new(false));
        let worker = PresenceWorker::new(client_id, Arc::clone(&connected));
        thread::Builder::new()
            .name("discord-presence".to_owned())
            .spawn(move || worker.run(&receiver))?;
        Ok(Self {
            enabled: AtomicBool::new(false),
            connected,
            sender,
        })
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Acquire)
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::Acquire)
    }

    pub async fn enable(&self) -> Result<bool, PresenceError> {
        self.enabled.store(true, Ordering::Release);
        let (reply, receive) = oneshot::channel();
        if self.send(PresenceCommand::Enable(reply)).is_err() {
            // Worker is gone: never leave the flag claiming we are active.
            self.enabled.store(false, Ordering::Release);
            return Err(PresenceError::WorkerGone);
        }
        // A timeout means Discord's socket is hanging; the worker keeps trying
        // and `is_connected` reflects the eventual outcome.
        Ok(tokio::time::timeout(ENABLE_REPLY_TIMEOUT, receive)
            .await
            .ok()
            .and_then(Result::ok)
            .unwrap_or(false))
    }

    pub fn disable(&self) -> Result<(), PresenceError> {
        self.enabled.store(false, Ordering::Release);
        self.send(PresenceCommand::Disable)
    }

    pub fn set_activity(&self, activity: DiscordActivity) -> Result<(), PresenceError> {
        self.send(PresenceCommand::SetActivity(Box::new(activity)))
    }

    pub fn clear_activity(&self) -> Result<(), PresenceError> {
        self.send(PresenceCommand::ClearActivity)
    }

    fn send(&self, command: PresenceCommand) -> Result<(), PresenceError> {
        self.sender
            .send(command)
            .map_err(|_| PresenceError::WorkerGone)
    }
}

struct PresenceWorker {
    client_id: String,
    connected: Arc<AtomicBool>,
    transport: transport::Transport,
    enabled: bool,
    /// Last activity requested by the UI; re-applied after reconnect/enable.
    current: Option<DiscordActivity>,
    /// Latest activity not yet flushed to Discord (coalesces bursts).
    pending: Option<DiscordActivity>,
    last_flush: Option<Instant>,
    next_connect_attempt: Instant,
    connect_failure_logged: bool,
}

impl PresenceWorker {
    fn new(client_id: String, connected: Arc<AtomicBool>) -> Self {
        Self {
            client_id,
            connected,
            transport: transport::Transport::default(),
            enabled: false,
            current: None,
            pending: None,
            last_flush: None,
            next_connect_attempt: Instant::now(),
            connect_failure_logged: false,
        }
    }

    fn run(mut self, receiver: &mpsc::Receiver<PresenceCommand>) {
        loop {
            let received = match self.next_deadline() {
                Some(deadline) => {
                    match receiver.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
                        Ok(command) => Some(command),
                        Err(RecvTimeoutError::Timeout) => None,
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                }
                None => match receiver.recv() {
                    Ok(command) => Some(command),
                    Err(_) => break,
                },
            };
            if let Some(command) = received {
                self.handle(command);
            }
            self.flush_if_due();
        }
        self.disconnect();
    }

    fn next_deadline(&self) -> Option<Instant> {
        if !self.enabled || self.pending.is_none() {
            return None;
        }
        if !self.transport.is_connected() {
            return Some(self.next_connect_attempt);
        }
        Some(
            self.last_flush
                .map_or_else(Instant::now, |flushed| flushed + MIN_UPDATE_INTERVAL),
        )
    }

    fn handle(&mut self, command: PresenceCommand) {
        match command {
            PresenceCommand::Enable(reply) => {
                self.enabled = true;
                self.connect();
                if self.pending.is_none() {
                    self.pending = self.current.clone();
                }
                let _ = reply.send(self.transport.is_connected());
            }
            PresenceCommand::Disable => {
                self.enabled = false;
                self.pending = None;
                self.current = None;
                self.disconnect();
            }
            PresenceCommand::SetActivity(activity) => {
                self.current = Some((*activity).clone());
                self.pending = Some(*activity);
            }
            PresenceCommand::ClearActivity => {
                self.current = None;
                self.pending = None;
                if self.enabled && self.transport.is_connected() {
                    if let Err(error) = self.transport.clear_activity() {
                        self.on_transport_error("clear activity", &error);
                    }
                }
            }
        }
    }

    fn flush_if_due(&mut self) {
        let Some(deadline) = self.next_deadline() else {
            return;
        };
        if Instant::now() < deadline || !self.ensure_connected() {
            return;
        }
        let Some(activity) = self.pending.take() else {
            return;
        };
        match self.transport.set_activity(&activity) {
            Ok(()) => self.last_flush = Some(Instant::now()),
            Err(error) => {
                self.pending = Some(activity);
                self.on_transport_error("set activity", &error);
            }
        }
    }

    fn ensure_connected(&mut self) -> bool {
        if self.transport.is_connected() {
            return true;
        }
        if Instant::now() < self.next_connect_attempt {
            return false;
        }
        self.connect()
    }

    fn connect(&mut self) -> bool {
        if self.transport.is_connected() {
            return true;
        }
        // Bounded connect: move the transport into an attempt thread and wait
        // with a budget. On timeout the attempt thread keeps ownership and
        // drops the transport whenever the pipe returns; this worker carries
        // on with a fresh one.
        let client_id = self.client_id.clone();
        let mut attempt = std::mem::take(&mut self.transport);
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let result = attempt.connect(&client_id);
            let _ = sender.send((attempt, result));
        });
        let (transport, result) = match receiver.recv_timeout(CONNECT_TIMEOUT) {
            Ok(pair) => pair,
            Err(_) => {
                log::warn!(target: "discord", "rich presence connect timed out");
                self.connected.store(false, Ordering::Release);
                self.next_connect_attempt = Instant::now() + RECONNECT_BACKOFF;
                return false;
            }
        };
        self.transport = transport;
        match result {
            Ok(()) => {
                self.connected.store(true, Ordering::Release);
                self.connect_failure_logged = false;
                self.last_flush = None;
                log::info!(target: "discord", "rich presence connected");
                true
            }
            Err(error) => {
                self.connected.store(false, Ordering::Release);
                self.next_connect_attempt = Instant::now() + RECONNECT_BACKOFF;
                if !self.connect_failure_logged {
                    log::warn!(target: "discord", "rich presence unavailable: {error}");
                    self.connect_failure_logged = true;
                }
                false
            }
        }
    }

    fn on_transport_error(&mut self, operation: &str, error: &str) {
        log::warn!(target: "discord", "rich presence {operation} failed, reconnecting: {error}");
        self.disconnect();
        self.next_connect_attempt = Instant::now() + RECONNECT_BACKOFF;
    }

    fn disconnect(&mut self) {
        self.transport.close();
        self.connected.store(false, Ordering::Release);
        self.last_flush = None;
    }
}

#[cfg(feature = "discord-rpc")]
mod transport {
    use discord_rich_presence::{
        activity::{Activity, Assets, Timestamps},
        DiscordIpc, DiscordIpcClient,
    };

    use super::DiscordActivity;

    #[derive(Default)]
    pub struct Transport {
        client: Option<DiscordIpcClient>,
    }

    impl Transport {
        pub fn is_connected(&self) -> bool {
            self.client.is_some()
        }

        pub fn connect(&mut self, client_id: &str) -> Result<(), String> {
            let mut client = DiscordIpcClient::new(client_id).map_err(|e| e.to_string())?;
            client.connect().map_err(|e| e.to_string())?;
            self.client = Some(client);
            Ok(())
        }

        pub fn set_activity(&mut self, payload: &DiscordActivity) -> Result<(), String> {
            let client = self.client.as_mut().ok_or("not connected")?;
            let mut activity = Activity::new();
            if let Some(value) = payload.details.as_deref() {
                activity = activity.details(value);
            }
            if let Some(value) = payload.state.as_deref() {
                activity = activity.state(value);
            }
            let has_assets = payload.large_image_key.is_some()
                || payload.large_image_text.is_some()
                || payload.small_image_key.is_some()
                || payload.small_image_text.is_some();
            if has_assets {
                let mut assets = Assets::new();
                if let Some(value) = payload.large_image_key.as_deref() {
                    assets = assets.large_image(value);
                }
                if let Some(value) = payload.large_image_text.as_deref() {
                    assets = assets.large_text(value);
                }
                if let Some(value) = payload.small_image_key.as_deref() {
                    assets = assets.small_image(value);
                }
                if let Some(value) = payload.small_image_text.as_deref() {
                    assets = assets.small_text(value);
                }
                activity = activity.assets(assets);
            }
            if payload.start_timestamp.is_some() || payload.end_timestamp.is_some() {
                let mut timestamps = Timestamps::new();
                if let Some(value) = payload.start_timestamp {
                    timestamps = timestamps.start(value);
                }
                if let Some(value) = payload.end_timestamp {
                    timestamps = timestamps.end(value);
                }
                activity = activity.timestamps(timestamps);
            }
            client.set_activity(activity).map_err(|e| e.to_string())
        }

        pub fn clear_activity(&mut self) -> Result<(), String> {
            let client = self.client.as_mut().ok_or("not connected")?;
            client.clear_activity().map_err(|e| e.to_string())
        }

        pub fn close(&mut self) {
            if let Some(mut client) = self.client.take() {
                let _ = client.close();
            }
        }
    }
}

#[cfg(not(feature = "discord-rpc"))]
mod transport {
    use super::DiscordActivity;

    #[derive(Default)]
    pub struct Transport;

    impl Transport {
        pub fn is_connected(&self) -> bool {
            false
        }
        pub fn connect(&mut self, _client_id: &str) -> Result<(), String> {
            Err("Discord RPC support was not compiled into this build.".to_owned())
        }
        pub fn set_activity(&mut self, _payload: &DiscordActivity) -> Result<(), String> {
            Err("Discord RPC support was not compiled into this build.".to_owned())
        }
        pub fn clear_activity(&mut self) -> Result<(), String> {
            Ok(())
        }
        pub fn close(&mut self) {}
    }
}

// ---------------------------------------------------------------- commands

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum EnabledArg {
    Flag(bool),
    Object { enabled: bool },
}

impl EnabledArg {
    const fn value(&self) -> bool {
        match self {
            Self::Flag(value) | Self::Object { enabled: value } => *value,
        }
    }
}

#[tauri::command(rename = "discord-rpc:set-enabled")]
pub async fn set_enabled(
    presence: State<'_, DiscordPresence>,
    enabled: Option<bool>,
    payload: Option<EnabledArg>,
) -> Result<bool, String> {
    let enabled = enabled
        .or_else(|| payload.as_ref().map(EnabledArg::value))
        .unwrap_or(false);
    if !enabled {
        presence.disable().map_err(|e| e.to_string())?;
        return Ok(false);
    }
    presence.enable().await.map_err(|e| e.to_string())
}

#[tauri::command(rename = "discord-rpc:set-activity")]
pub fn set_activity(presence: State<'_, DiscordPresence>, payload: Value) -> Result<(), String> {
    presence
        .set_activity(activity_from_value(&payload))
        .map_err(|e| e.to_string())
}

#[tauri::command(rename = "discord-rpc:set-preset")]
pub fn set_preset(presence: State<'_, DiscordPresence>, payload: Value) -> Result<(), String> {
    let base = Preset::parse(&string_field(&payload, "preset"))
        .unwrap_or(Preset::Idle)
        .activity();
    let activity = match payload.get("overrides") {
        Some(overrides) => base.merge(activity_from_value(overrides)),
        None => base,
    };
    presence.set_activity(activity).map_err(|e| e.to_string())
}

#[tauri::command(rename = "discord-rpc:set-cleaning")]
pub fn set_cleaning(presence: State<'_, DiscordPresence>, payload: Value) -> Result<(), String> {
    let mode = match string_field(&payload, "mode").as_str() {
        "advanced" => "Advanced",
        _ => "Basic",
    };
    set_mode_activity(
        &presence,
        Preset::CleanerRedraw,
        format!("Cleaning image - {}", file_label(&payload)),
        Some(format!("Mode: {mode}")),
    )
}

#[tauri::command(rename = "discord-rpc:set-translating")]
pub fn set_translating(
    presence: State<'_, DiscordPresence>,
    payload: Value,
) -> Result<(), String> {
    let from = string_field(&payload, "from");
    let to = string_field(&payload, "to");
    set_mode_activity(
        &presence,
        Preset::Translator,
        format!("Translating - {}", file_label(&payload)),
        Some(format!("{from} -> {to}")),
    )
}

#[tauri::command(rename = "discord-rpc:set-typing")]
pub fn set_typing(presence: State<'_, DiscordPresence>, payload: Value) -> Result<(), String> {
    set_mode_activity(
        &presence,
        Preset::Typesetter,
        format!("Typesetting - {}", file_label(&payload)),
        None,
    )
}

#[tauri::command(rename = "discord-rpc:set-redrawing")]
pub fn set_redrawing(presence: State<'_, DiscordPresence>, payload: Value) -> Result<(), String> {
    set_mode_activity(
        &presence,
        Preset::CleanerRedraw,
        format!("Redrawing - {}", file_label(&payload)),
        None,
    )
}

#[tauri::command(rename = "discord-rpc:set-dashboard")]
pub fn set_dashboard(presence: State<'_, DiscordPresence>, payload: Value) -> Result<(), String> {
    let user = non_empty(&string_field(&payload, "userName"))
        .unwrap_or("User")
        .to_owned();
    set_mode_activity(&presence, Preset::Dashboard, "Workspace".to_owned(), Some(user))
}

#[tauri::command(rename = "discord-rpc:set-batch")]
pub fn set_batch_processing(
    presence: State<'_, DiscordPresence>,
    payload: Value,
) -> Result<(), String> {
    let file_count = number_field(&payload, "fileCount").unwrap_or(0);
    let current_index = number_field(&payload, "currentIndex").unwrap_or(0);
    set_mode_activity(
        &presence,
        Preset::Batch,
        format!("Batch {current_index}/{file_count} - {}", file_label(&payload)),
        None,
    )
}

#[tauri::command(rename = "discord-rpc:set-idle")]
pub fn set_idle(presence: State<'_, DiscordPresence>) -> Result<(), String> {
    presence
        .set_activity(Preset::Idle.activity())
        .map_err(|e| e.to_string())
}

#[tauri::command(rename = "discord-rpc:clear-activity")]
pub fn clear_activity(presence: State<'_, DiscordPresence>) -> Result<(), String> {
    presence.clear_activity().map_err(|e| e.to_string())
}

#[tauri::command(rename = "discord-rpc:is-connected")]
pub fn is_connected(presence: State<'_, DiscordPresence>) -> bool {
    presence.is_connected()
}

#[tauri::command(rename = "discord-rpc:is-enabled")]
pub fn is_enabled(presence: State<'_, DiscordPresence>) -> bool {
    presence.is_enabled()
}

#[tauri::command(rename = "discord-rpc:get-preset-assets")]
pub fn get_preset_assets() -> BTreeMap<String, String> {
    preset_assets()
}

fn set_mode_activity(
    presence: &DiscordPresence,
    preset: Preset,
    details: String,
    state: Option<String>,
) -> Result<(), String> {
    let activity = preset.activity().merge(DiscordActivity {
        details: Some(details),
        state,
        ..Default::default()
    });
    presence.set_activity(activity).map_err(|e| e.to_string())
}

fn preset_assets() -> BTreeMap<String, String> {
    std::iter::once(("koma_logo".to_owned(), "KOMA Studio".to_owned()))
        .chain(
            Preset::ALL
                .into_iter()
                .map(|preset| (preset.key().to_owned(), preset.asset_label().to_owned())),
        )
        .collect()
}

fn activity_from_value(value: &Value) -> DiscordActivity {
    DiscordActivity {
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
        start_timestamp: value.get("startTimestamp").and_then(Value::as_i64),
        end_timestamp: value.get("endTimestamp").and_then(Value::as_i64),
    }
}

fn string_field(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_owned()
}

fn text_field(value: &Value, key: &str) -> Option<String> {
    non_empty(&string_field(value, key)).map(|text| clip(text, MAX_TEXT_CHARS))
}

fn number_field(value: &Value, key: &str) -> Option<i64> {
    let number = value.get(key)?;
    number
        .as_i64()
        .or_else(|| number.as_f64().map(|float| float.round() as i64))
}

fn file_label(payload: &Value) -> String {
    let label = clip(&string_field(payload, "fileName"), MAX_FILE_NAME_CHARS);
    if label.is_empty() {
        "Untitled".to_owned()
    } else {
        label
    }
}

fn non_empty(value: &str) -> Option<&str> {
    let trimmed = value.trim();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn clip(value: &str, max_chars: usize) -> String {
    value.trim().chars().take(max_chars).collect()
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
    fn preset_keys_round_trip() {
        for preset in Preset::ALL {
            assert_eq!(Preset::parse(preset.key()), Some(preset));
        }
        assert_eq!(Preset::parse("unknown"), None);
        assert_eq!(preset_assets().len(), Preset::ALL.len() + 1);
    }

    #[test]
    fn worker_coalesces_bursts_and_reapplies_on_enable() {
        let mut worker = PresenceWorker::new("id".into(), Arc::new(AtomicBool::new(false)));
        worker.handle(PresenceCommand::SetActivity(Box::new(Preset::Idle.activity())));
        worker.handle(PresenceCommand::SetActivity(Box::new(Preset::Batch.activity())));
        assert_eq!(worker.pending.as_ref().and_then(|a| a.details.as_deref()), Some("Batch Processing"));

        worker.handle(PresenceCommand::Disable);
        assert!(worker.pending.is_none() && worker.current.is_none());

        worker.handle(PresenceCommand::SetActivity(Box::new(Preset::Settings.activity())));
        let (reply, _rx) = oneshot::channel();
        worker.handle(PresenceCommand::Enable(reply));
        assert!(worker.enabled);
        assert_eq!(worker.pending.as_ref().and_then(|a| a.details.as_deref()), Some("Preferences"));
    }
}