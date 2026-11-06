use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::Emitter;
use tauri_plugin_updater::UpdaterExt;
use url::Url;

pub const UPDATER_EVENT_CHANNEL: &str = "updater:event";
const PROGRESS_EVENT_MIN_INTERVAL_MS: u128 = 100;

const BETA_UPDATER_FEED_URL: &str =
    "https://github.com/klaus-2/koma-studio/releases/download/beta/latest.json";

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or_default()
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UpdaterStatusValue {
    #[default]
    Idle,
    Checking,
    Available,
    NotAvailable,
    Downloading,
    Downloaded,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct UpdaterProgressPayload {
    pub percent: f64,
    pub transferred: u64,
    pub total: u64,
    pub speed: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdaterState {
    pub status: UpdaterStatusValue,
    pub current_version: String,
    pub new_version: Option<String>,
    pub mandatory: bool,
    pub blocking: bool,
    pub blocking_reason: Option<String>,
    pub release_notes: Option<String>,
    pub channel: String,
    pub provider: String,
    pub auto_install_on_quit: bool,
    pub allow_prerelease: bool,
    pub progress: Option<UpdaterProgressPayload>,
    pub checked_at: Option<u64>,
    pub downloaded_at: Option<u64>,
    pub error: Option<String>,
}

impl UpdaterState {
    pub fn initial(current_version: String) -> Self {
        Self {
            status: UpdaterStatusValue::Idle,
            current_version,
            new_version: None,
            mandatory: false,
            blocking: false,
            blocking_reason: None,
            release_notes: None,
            channel: "stable".to_owned(),
            provider: "github".to_owned(),
            auto_install_on_quit: true,
            allow_prerelease: false,
            progress: None,
            checked_at: None,
            downloaded_at: None,
            error: None,
        }
    }

    pub fn apply(&mut self, transition: &UpdaterTransition, channel: &str) {
        self.status = match transition {
            UpdaterTransition::Checking => UpdaterStatusValue::Checking,
            UpdaterTransition::Available { .. } => UpdaterStatusValue::Available,
            UpdaterTransition::NotAvailable { .. } => UpdaterStatusValue::NotAvailable,
            UpdaterTransition::Progress { .. } => UpdaterStatusValue::Downloading,
            UpdaterTransition::Downloaded { .. } => UpdaterStatusValue::Downloaded,
            UpdaterTransition::Failed { .. } => UpdaterStatusValue::Error,
        };
        match transition {
            UpdaterTransition::Available {
                version,
                release_notes,
                checked_at,
            } => {
                self.new_version = Some(version.clone());
                self.release_notes = release_notes.clone();
                self.checked_at = Some(*checked_at);
                self.progress = None;
                self.error = None;
                self.downloaded_at = None;
            }
            UpdaterTransition::NotAvailable { checked_at } => {
                self.checked_at = Some(*checked_at);
                self.progress = None;
                self.error = None;
                self.downloaded_at = None;
            }
            UpdaterTransition::Progress { progress } => {
                self.progress = Some(*progress);
            }
            UpdaterTransition::Downloaded { downloaded_at } => {
                self.downloaded_at = Some(*downloaded_at);
            }
            UpdaterTransition::Failed { message } => {
                self.error = Some(message.clone());
            }
            UpdaterTransition::Checking => {
                self.progress = None;
                self.error = None;
                self.downloaded_at = None;
            }
        }
        self.channel = channel.to_owned();
        self.allow_prerelease = channel == "beta";
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum UpdaterTransition {
    Checking,
    #[serde(rename_all = "camelCase")]
    Available {
        version: String,
        release_notes: Option<String>,
        checked_at: u64,
    },
    #[serde(rename = "not-available", rename_all = "camelCase")]
    NotAvailable {
        checked_at: u64,
    },
    Progress {
        progress: UpdaterProgressPayload,
    },
    #[serde(rename_all = "camelCase")]
    Downloaded {
        downloaded_at: u64,
    },
    #[serde(rename = "error")]
    Failed {
        message: String,
    },
}

fn updater_transition_event_name(transition: &UpdaterTransition) -> &'static str {
    match transition {
        UpdaterTransition::Checking => "checking",
        UpdaterTransition::Available { .. } => "available",
        UpdaterTransition::NotAvailable { .. } => "not-available",
        UpdaterTransition::Progress { .. } => "progress",
        UpdaterTransition::Downloaded { .. } => "downloaded",
        UpdaterTransition::Failed { .. } => "error",
    }
}

pub fn parse_channel(value: &str) -> Result<&'static str, &'static str> {
    match value {
        "stable" => Ok("stable"),
        "beta" => Ok("beta"),
        _ => Err("Invalid update channel."),
    }
}

pub fn updater_feed_override(channel: &str) -> Result<Option<Url>, String> {
    if channel != "beta" {
        return Ok(None);
    }
    Url::parse(BETA_UPDATER_FEED_URL)
        .map(Some)
        .map_err(|error| error.to_string())
}

pub fn progress_percent(transferred: u64, total: Option<u64>) -> f64 {
    match total {
        Some(total) if total > 0 => (transferred.min(total) as f64 / total as f64) * 100.0,
        _ => 0.0,
    }
}

pub fn is_supported_runtime(is_dev: bool, is_windows: bool) -> bool {
    !is_dev && is_windows
}

pub struct UpdaterSession {
    pub state: UpdaterState,
    pub last_channel: &'static str,
    pub update: Option<tauri_plugin_updater::Update>,
    pub downloaded_bytes: Option<Vec<u8>>,
    pub install_scheduled: bool,
    progress_emitted_at: Option<Instant>,
}

impl UpdaterSession {
    pub fn new(current_version: String) -> Self {
        Self {
            state: UpdaterState::initial(current_version),
            last_channel: "stable",
            update: None,
            downloaded_bytes: None,
            install_scheduled: false,
            progress_emitted_at: None,
        }
    }

    pub fn clear_install_latch(&mut self) {
        self.install_scheduled = false;
    }

    pub fn commit<R: tauri::Runtime>(
        &mut self,
        app: &tauri::AppHandle<R>,
        transition: UpdaterTransition,
    ) {
        self.state.apply(&transition, self.last_channel);
        let payload = serde_json::json!({
            "event": updater_transition_event_name(&transition),
            "state": self.state,
        });
        if let Err(error) = app.emit(UPDATER_EVENT_CHANNEL, payload) {
            tracing::warn!(
                operation = "updater_broadcast",
                "failed to emit updater event: {error}"
            );
        }
    }

    pub fn should_emit_progress(&mut self) -> bool {
        let now = Instant::now();
        let due = self.progress_emitted_at.is_none_or(|instant| {
            now.duration_since(instant).as_millis() >= PROGRESS_EVENT_MIN_INTERVAL_MS
        });
        if due {
            self.progress_emitted_at = Some(now);
        }
        due
    }
}

#[derive(Clone, Default)]
pub struct InstallerUpdaterStore {
    inner: Arc<Mutex<Option<UpdaterSession>>>,
}

impl InstallerUpdaterStore {
    pub fn lock(&self) -> std::sync::MutexGuard<'_, Option<UpdaterSession>> {
        self.inner.lock().expect("updater store mutex poisoned")
    }
}

fn ensure_session<'a, R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    guard: &'a mut Option<UpdaterSession>,
) -> Result<&'a mut UpdaterSession, String> {
    if guard.is_none() {
        let version = app.package_info().version.to_string();
        *guard = Some(UpdaterSession::new(version));
    }
    guard
        .as_mut()
        .ok_or_else(|| "updater session unavailable".to_owned())
}

pub type UpdaterFlowResult<T> = Result<T, String>;

pub fn get_state_snapshot<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
) -> Option<UpdaterState> {
    if !is_supported_runtime(cfg!(dev), cfg!(windows)) {
        return None;
    }
    let mut guard = store.lock();
    ensure_session(app, &mut guard)
        .ok()
        .map(|session| session.state.clone())
}

pub async fn run_check<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
    channel: &'static str,
) -> UpdaterFlowResult<UpdaterState> {
    {
        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        session.last_channel = channel;
        session.clear_install_latch();
        session.commit(app, UpdaterTransition::Checking);
    }

    let checked: Result<Option<tauri_plugin_updater::Update>, String> =
        match updater_feed_override(channel) {
            Ok(Some(feed)) => match app.updater_builder().endpoints(vec![feed]) {
                Ok(builder) => match builder.build() {
                    Ok(updater) => updater.check().await.map_err(|error| error.to_string()),
                    Err(error) => Err(error.to_string()),
                },
                Err(error) => Err(error.to_string()),
            },
            Ok(None) => match app.updater() {
                Ok(updater) => updater.check().await.map_err(|error| error.to_string()),
                Err(error) => Err(error.to_string()),
            },
            Err(error) => Err(error.to_string()),
        };

    let mut guard = store.lock();
    let session = ensure_session(app, &mut guard)?;
    match checked {
        Ok(Some(update)) => {
            let transition = UpdaterTransition::Available {
                version: update.version.clone(),
                release_notes: update.body.clone(),
                checked_at: now_ms(),
            };
            session.update = Some(update);
            session.commit(app, transition);
            Ok(session.state.clone())
        }
        Ok(None) => {
            session.update = None;
            session.downloaded_bytes = None;
            session.commit(
                app,
                UpdaterTransition::NotAvailable {
                    checked_at: now_ms(),
                },
            );
            Ok(session.state.clone())
        }
        Err(error) => {
            session.update = None;
            session.downloaded_bytes = None;
            session.commit(
                app,
                UpdaterTransition::Failed {
                    message: error.clone(),
                },
            );
            Err(error)
        }
    }
}

pub async fn run_download<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
    channel: &'static str,
) -> UpdaterFlowResult<()> {
    {
        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        if session.state.status == UpdaterStatusValue::Downloading {
            return Ok(());
        }
        session.last_channel = channel;
    }

    run_check(app, store, channel).await?;
    let update = {
        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        session.update.clone()
    }
    .ok_or_else(|| "No update is available for this platform.".to_owned())?;

    {
        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        session.commit(
            app,
            UpdaterTransition::Progress {
                progress: UpdaterProgressPayload {
                    percent: 0.0,
                    transferred: 0,
                    total: 0,
                    speed: 0.0,
                },
            },
        );
    }

    let callback_app = app.clone();
    let callback_store = store.clone();
    let mut transferred: u64 = 0;
    let mut speed_base: Option<(Instant, u64)> = None;
    let download_result = update
        .download(
            move |chunk: usize, total: Option<u64>| {
                transferred += chunk as u64;
                let mut guard = callback_store.lock();
                let Some(session) = guard.as_mut() else {
                    return;
                };
                if !session.should_emit_progress() {
                    return;
                }
                let speed = match speed_base {
                    Some((instant, base_bytes)) => {
                        let elapsed = instant.elapsed().as_secs_f64();
                        if elapsed > 0.0 {
                            (transferred - base_bytes) as f64 / elapsed
                        } else {
                            0.0
                        }
                    }
                    None => 0.0,
                };
                speed_base = Some((Instant::now(), transferred));
                session.commit(
                    &callback_app,
                    UpdaterTransition::Progress {
                        progress: UpdaterProgressPayload {
                            percent: progress_percent(transferred, total),
                            transferred,
                            total: total.unwrap_or_default(),
                            speed,
                        },
                    },
                );
            },
            || {},
        )
        .await;

    let mut guard = store.lock();
    let session = ensure_session(app, &mut guard)?;
    match download_result {
        Ok(bytes) => {
            if let Some(progress) = session.state.progress {
                if progress.total > 0 {
                    session.commit(
                        app,
                        UpdaterTransition::Progress {
                            progress: UpdaterProgressPayload {
                                percent: 100.0,
                                transferred: progress.total,
                                total: progress.total,
                                speed: 0.0,
                            },
                        },
                    );
                }
            }
            session.downloaded_bytes = Some(bytes);
            session.commit(
                app,
                UpdaterTransition::Downloaded {
                    downloaded_at: now_ms(),
                },
            );
            Ok(())
        }
        Err(error) => {
            session.commit(
                app,
                UpdaterTransition::Failed {
                    message: error.to_string(),
                },
            );
            Err(error.to_string())
        }
    }
}

pub fn run_install<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
) -> UpdaterFlowResult<()> {
    let (update, bytes) = {
        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        if session.state.status != UpdaterStatusValue::Downloaded {
            return Err("No downloaded update is ready to install.".to_owned());
        }
        if session.install_scheduled {
            return Err("Update installation is already in progress.".to_owned());
        }
        session.install_scheduled = true;
        match (session.update.clone(), session.downloaded_bytes.take()) {
            (Some(update), Some(bytes)) => (update, bytes),
            _ => {
                session.install_scheduled = false;
                return Err("No downloaded update is ready to install.".to_owned());
            }
        }
    };

    let spawn_app = app.clone();
    let spawn_store = store.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = update.install(bytes) {
            tracing::error!(
                operation = "updater_install",
                "failed to launch installer: {error}"
            );
            if let Some(session) = spawn_store.lock().as_mut() {
                session.commit(
                    &spawn_app,
                    UpdaterTransition::Failed {
                        message: error.to_string(),
                    },
                );
            }
        }
    });

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn initial() -> UpdaterState {
        UpdaterState::initial("1.3.1".to_owned())
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase", deny_unknown_fields)]
    struct GoldenScenario {
        name: String,
        initial_version: String,
        channel: String,
        #[serde(default)]
        pre_transitions: Vec<UpdaterTransition>,
        transition: UpdaterTransition,
        expected_state: UpdaterState,
    }

    #[derive(Deserialize)]
    #[serde(deny_unknown_fields)]
    struct GoldenFixture {
        scenarios: Vec<GoldenScenario>,
    }

    #[test]
    fn initial_state_carries_safe_defaults() {
        let state = initial();
        assert_eq!(state.status, UpdaterStatusValue::Idle);
        assert_eq!(state.current_version, "1.3.1");
        assert_eq!(state.channel, "stable");
        assert_eq!(state.provider, "github");
        assert!(state.auto_install_on_quit);
        assert!(!state.allow_prerelease);
        assert_eq!(state.progress, None);
        assert_eq!(state.blocking_reason, None);
    }

    #[test]
    fn golden_fixture_pins_reducer_parity_with_the_electron_shell() {
        let raw = include_str!(
            "../../../../../../apps/electron/scripts/fixtures/updater-transitions.golden.json"
        );
        let golden: GoldenFixture = serde_json::from_str(raw).expect("parse golden fixture");
        assert!(
            !golden.scenarios.is_empty(),
            "the fixture carries scenarios"
        );

        for scenario in &golden.scenarios {
            let mut state = UpdaterState::initial(scenario.initial_version.clone());
            for transition in &scenario.pre_transitions {
                state.apply(transition, &scenario.channel);
            }
            state.apply(&scenario.transition, &scenario.channel);
            assert_eq!(
                state, scenario.expected_state,
                "scenario: {}",
                scenario.name
            );
        }
    }

    #[test]
    fn status_serializes_with_kebab_case_values() {
        let state = initial();
        let json = serde_json::to_value(&state).expect("serialize");
        assert_eq!(json["status"], "idle");

        let mut unavailable = initial();
        unavailable.apply(&UpdaterTransition::NotAvailable { checked_at: 0 }, "stable");
        let json = serde_json::to_value(&unavailable).expect("serialize");
        assert_eq!(json["status"], "not-available");
        assert_eq!(json["currentVersion"], "1.3.1");
        assert_eq!(json["autoInstallOnQuit"], true);
        assert_eq!(json["blockingReason"], serde_json::Value::Null);
    }

    #[test]
    fn transitions_serialize_with_the_golden_wire_tags() {
        let json = serde_json::to_value(UpdaterTransition::Checking).expect("serialize");
        assert_eq!(json["type"], "checking");

        let json = serde_json::to_value(UpdaterTransition::NotAvailable { checked_at: 1 })
            .expect("serialize");
        assert_eq!(json["type"], "not-available");

        let json = serde_json::to_value(UpdaterTransition::Failed {
            message: "x".into(),
        })
        .expect("serialize");
        assert_eq!(json["type"], "error");
        assert_eq!(json["message"], "x");
    }

    #[test]
    fn channel_parsing_is_strict() {
        assert_eq!(parse_channel("stable"), Ok("stable"));
        assert_eq!(parse_channel("beta"), Ok("beta"));
        assert!(parse_channel("canary").is_err());
        assert!(parse_channel("").is_err());
    }

    #[test]
    fn beta_channel_overrides_the_feed_and_stable_keeps_the_configured_endpoint() {
        let feed = updater_feed_override("beta").expect("beta feed parses");
        assert_eq!(
            feed.as_ref().map(url::Url::as_str),
            Some("https://github.com/klaus-2/koma-studio/releases/download/beta/latest.json")
        );
        assert_eq!(updater_feed_override("stable").expect("stable parses"), None);
        assert_eq!(updater_feed_override("canary").expect("unknown parses"), None);
        for channel in ["stable", "beta"] {
            let parsed = parse_channel(channel).expect("channel accepted by parse_channel");
            let overrides = updater_feed_override(parsed)
                .expect("override parses")
                .is_some();
            assert_eq!(
                overrides,
                channel == "beta",
                "channel {channel} must resolve to the beta feed iff it is beta"
            );
        }
    }

    #[test]
    fn progress_percent_handles_unknown_and_zero_totals() {
        assert_eq!(progress_percent(50, Some(100)), 50.0);
        assert_eq!(progress_percent(150, Some(100)), 100.0);
        assert_eq!(progress_percent(50, None), 0.0);
        assert_eq!(progress_percent(50, Some(0)), 0.0);
    }

    #[test]
    fn support_gate_matches_the_electron_rule() {
        assert!(
            !is_supported_runtime(true, true),
            "dev builds are never supported"
        );
        assert!(
            !is_supported_runtime(false, false),
            "non-Windows is out of the feed"
        );
        assert!(is_supported_runtime(false, true));
    }

    #[test]
    fn progress_throttle_requires_an_interval() {
        let mut session = UpdaterSession::new("1.3.1".to_owned());
        assert!(session.should_emit_progress(), "first chunk always emits");
        assert!(
            !session.should_emit_progress(),
            "immediate second chunk is throttled"
        );
    }
}
