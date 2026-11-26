use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;
use url::Url;

use crate::updater::{
    delta::{cache_verified_installer, try_download_and_reconstruct_delta},
    release_manifest::{
        KomaReleaseManifest, ReleaseManifestFetch, UPDATER_MINISIGN_PUBKEY, UiBundleDescriptor,
        UpdateStrategy, current_native_abi_version, decide_update_strategy, effective_version,
        fetch_release_manifest, verify_minisign_bytes, verify_minisign_trusted_version,
    },
    ui_hotswap::{HotswapHandle, apply_staged_ui_hotswap, download_and_stage_ui_bundle},
};

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

pub fn is_supported_runtime(is_dev: bool, is_supported_os: bool) -> bool {
    !is_dev && is_supported_os
}

const fn is_updater_os() -> bool {
    cfg!(any(
        target_os = "windows",
        target_os = "macos",
        target_os = "linux"
    ))
}

pub struct UpdaterSession {
    pub state: UpdaterState,
    pub last_channel: &'static str,
    pub update: Option<tauri_plugin_updater::Update>,
    pub downloaded_bytes: Option<Vec<u8>>,
    pub install_scheduled: bool,
    pub etag_by_channel: HashMap<&'static str, String>,
    pub pending_manifest_url: Option<String>,
    pub pending_manifest: Option<KomaReleaseManifest>,
    pub pending_ui_bundle: Option<UiBundleDescriptor>,
    pub staged_ui_version: Option<String>,
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
            etag_by_channel: HashMap::new(),
            pending_manifest_url: None,
            pending_manifest: None,
            pending_ui_bundle: None,
            staged_ui_version: None,
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
        self.broadcast(app, updater_transition_event_name(&transition));
    }

    pub fn broadcast<R: tauri::Runtime>(&self, app: &tauri::AppHandle<R>, event_name: &str) {
        let payload = serde_json::json!({
            "event": event_name,
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
    let native_version = app.package_info().version.to_string();
    let ui_version = app
        .try_state::<HotswapHandle>()
        .and_then(|handle| handle.active_version());
    let current = effective_version(&native_version, ui_version.as_deref());
    if guard.is_none() {
        *guard = Some(UpdaterSession::new(current.clone()));
    }
    let session = guard
        .as_mut()
        .ok_or_else(|| "updater session unavailable".to_owned())?;
    session.state.current_version = current;
    Ok(session)
}

pub type UpdaterFlowResult<T> = Result<T, String>;

pub fn get_state_snapshot<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
) -> Option<UpdaterState> {
    if !is_supported_runtime(cfg!(dev), is_updater_os()) {
        return None;
    }
    let mut guard = store.lock();
    ensure_session(app, &mut guard)
        .ok()
        .map(|session| session.state.clone())
}

pub fn set_auto_install<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
    enabled: bool,
) -> Option<UpdaterState> {
    if !is_supported_runtime(cfg!(dev), is_updater_os()) {
        return None;
    }
    let mut guard = store.lock();
    let session = ensure_session(app, &mut guard).ok()?;
    session.state.auto_install_on_quit = enabled;
    Some(session.state.clone())
}

pub fn install_on_quit_if_staged<R: tauri::Runtime>(
    _app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
) {
    let staged = {
        let mut guard = store.lock();
        let Some(session) = guard.as_mut() else {
            return;
        };
        if !session.state.auto_install_on_quit
            || session.state.status != UpdaterStatusValue::Downloaded
            || session.install_scheduled
        {
            return;
        }
        if session.staged_ui_version.is_some() {
            return;
        }
        match (session.update.take(), session.downloaded_bytes.take()) {
            (Some(update), Some(bytes)) => {
                session.install_scheduled = true;
                Some((update, bytes))
            }
            _ => None,
        }
    };

    if let Some((update, bytes)) = staged {
        if let Err(error) = update.install(bytes) {
            tracing::error!(
                operation = "updater_install_on_quit",
                "failed to launch staged installer on exit: {error}"
            );
        }
    }
}

pub async fn run_check<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
    channel: &'static str,
) -> UpdaterFlowResult<UpdaterState> {
    let (cached_etag, current_effective, native_version) = {
        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        session.last_channel = channel;
        session.clear_install_latch();
        let etag = session.etag_by_channel.get(channel).cloned();
        let current_eff = session.state.current_version.clone();
        if session.state.status != UpdaterStatusValue::Downloaded
            && session.state.status != UpdaterStatusValue::Downloading
        {
            session.commit(app, UpdaterTransition::Checking);
        }
        (etag, current_eff, app.package_info().version.to_string())
    };

    let manifest_fetch = fetch_release_manifest(app, channel, cached_etag.as_deref()).await;
    match manifest_fetch {
        Ok(ReleaseManifestFetch::NotModified) => {
            let mut guard = store.lock();
            let session = ensure_session(app, &mut guard)?;
            if session.state.status == UpdaterStatusValue::Downloaded {
                return Ok(session.state.clone());
            }
            if let Some(manifest) = session.pending_manifest.clone() {
                match decide_update_strategy(
                    &manifest,
                    &current_effective,
                    &native_version,
                    current_native_abi_version(),
                    !cfg!(dev),
                ) {
                    UpdateStrategy::UpToDate => {
                        session.update = None;
                        session.pending_ui_bundle = None;
                        session.staged_ui_version = None;
                        session.commit(
                            app,
                            UpdaterTransition::NotAvailable {
                                checked_at: now_ms(),
                            },
                        );
                        return Ok(session.state.clone());
                    }
                    UpdateStrategy::UiHotswap(ui_bundle) => {
                        session.pending_ui_bundle = Some(ui_bundle);
                        session.state.mandatory = manifest.mandatory;
                        session.commit(
                            app,
                            UpdaterTransition::Available {
                                version: manifest.version,
                                release_notes: manifest.release_notes,
                                checked_at: now_ms(),
                            },
                        );
                        return Ok(session.state.clone());
                    }
                    UpdateStrategy::NativeInstaller => {}
                }
            }
        }
        Ok(ReleaseManifestFetch::Found {
            manifest,
            etag,
            url,
        }) => {
            let strategy = decide_update_strategy(
                &manifest,
                &current_effective,
                &native_version,
                current_native_abi_version(),
                !cfg!(dev),
            );
            let mut guard = store.lock();
            let session = ensure_session(app, &mut guard)?;
            if let Some(etag) = etag {
                session.etag_by_channel.insert(channel, etag);
            }
            session.pending_manifest_url = Some(url);
            session.pending_manifest = Some(manifest.as_ref().clone());

            match strategy {
                UpdateStrategy::UpToDate => {
                    session.update = None;
                    session.downloaded_bytes = None;
                    session.pending_ui_bundle = None;
                    session.staged_ui_version = None;
                    session.state.mandatory = false;
                    session.commit(
                        app,
                        UpdaterTransition::NotAvailable {
                            checked_at: now_ms(),
                        },
                    );
                    return Ok(session.state.clone());
                }
                UpdateStrategy::UiHotswap(ui_bundle) => {
                    session.update = None;
                    session.downloaded_bytes = None;
                    session.staged_ui_version = None;
                    session.pending_ui_bundle = Some(ui_bundle);
                    session.state.mandatory = manifest.mandatory;
                    session.state.blocking = manifest.mandatory;
                    session.commit(
                        app,
                        UpdaterTransition::Available {
                            version: manifest.version,
                            release_notes: manifest.release_notes,
                            checked_at: now_ms(),
                        },
                    );
                    return Ok(session.state.clone());
                }
                UpdateStrategy::NativeInstaller => {
                    session.pending_ui_bundle = None;
                    session.staged_ui_version = None;
                    session.state.mandatory = manifest.mandatory;
                    session.state.blocking = manifest.mandatory;
                }
            }
        }
        Ok(ReleaseManifestFetch::NotFound) => {
            let mut guard = store.lock();
            let session = ensure_session(app, &mut guard)?;
            session.pending_manifest = None;
            session.pending_manifest_url = None;
            session.pending_ui_bundle = None;
        }
        Err(error) => {
            let mut guard = store.lock();
            let session = ensure_session(app, &mut guard)?;
            session.update = None;
            session.downloaded_bytes = None;
            session.pending_ui_bundle = None;
            session.commit(
                app,
                UpdaterTransition::Failed {
                    message: error.clone(),
                },
            );
            return Err(error);
        }
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

    let (ui_task, native_task) = {
        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        let ui = match (
            session.pending_ui_bundle.clone(),
            session.pending_manifest_url.clone(),
            session.state.new_version.clone(),
        ) {
            (Some(bundle), Some(manifest_url), Some(version)) => {
                Some((bundle, manifest_url, version))
            }
            _ => None,
        };
        let native = session.update.clone().map(|u| {
            (
                u,
                session.pending_manifest.clone(),
                session.pending_manifest_url.clone(),
            )
        });
        (ui, native)
    };

    if let Some((bundle, manifest_url, target_version)) = ui_task {
        {
            let mut guard = store.lock();
            let session = ensure_session(app, &mut guard)?;
            session.commit(
                app,
                UpdaterTransition::Progress {
                    progress: UpdaterProgressPayload {
                        percent: 0.0,
                        transferred: 0,
                        total: bundle.size,
                        speed: 0.0,
                    },
                },
            );
        }

        let callback_app = app.clone();
        let callback_store = store.clone();
        let dl_result = download_and_stage_ui_bundle(
            app,
            &manifest_url,
            &bundle,
            &target_version,
            move |transferred, total, speed| {
                let mut guard = callback_store.lock();
                let Some(session) = guard.as_mut() else {
                    return;
                };
                session.commit(
                    &callback_app,
                    UpdaterTransition::Progress {
                        progress: UpdaterProgressPayload {
                            percent: progress_percent(transferred, Some(total)),
                            transferred,
                            total,
                            speed,
                        },
                    },
                );
            },
        )
        .await;

        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        return match dl_result {
            Ok(()) => {
                session.staged_ui_version = Some(target_version);
                session.downloaded_bytes = None;
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
                        message: error.clone(),
                    },
                );
                Err(error)
            }
        };
    }

    let (update, pending_manifest, pending_manifest_url) =
        native_task.ok_or_else(|| "No update is available for this platform.".to_owned())?;

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

    let native_pkg_version = app.package_info().version.to_string();
    let delta_bytes = if let (Some(manifest), Some(manifest_url)) =
        (pending_manifest.as_ref(), pending_manifest_url.as_deref())
    {
        if let Some(delta) = manifest.native_deltas.get(&update.target) {
            if delta.from_version == native_pkg_version {
                let delta_app = app.clone();
                let delta_store = store.clone();
                let started = Instant::now();
                let candidate = try_download_and_reconstruct_delta(
                    app,
                    manifest_url,
                    delta,
                    &update.target,
                    move |transferred, total| {
                        let mut guard = delta_store.lock();
                        let Some(session) = guard.as_mut() else {
                            return;
                        };
                        let elapsed = started.elapsed().as_secs_f64().max(0.001);
                        session.commit(
                            &delta_app,
                            UpdaterTransition::Progress {
                                progress: UpdaterProgressPayload {
                                    percent: progress_percent(transferred, Some(total)),
                                    transferred,
                                    total,
                                    speed: (transferred as f64) / elapsed,
                                },
                            },
                        );
                    },
                )
                .await;

                candidate.filter(|bytes| {
                    verify_minisign_bytes(UPDATER_MINISIGN_PUBKEY, bytes, &update.signature)
                        .and_then(|comment| {
                            verify_minisign_trusted_version(&comment, &update.version, true)
                        })
                        .is_ok()
                })
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    let download_result = match delta_bytes {
        Some(bytes) => Ok(bytes),
        None => {
            let callback_app = app.clone();
            let callback_store = store.clone();
            let mut transferred: u64 = 0;
            let mut speed_base: Option<(Instant, u64)> = None;
            update
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
                .await
                .map_err(|error| error.to_string())
        }
    };

    if let Ok(ref bytes) = download_result {
        cache_verified_installer(app, &update.version, &update.target, bytes);
    }

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
                    message: error.clone(),
                },
            );
            Err(error)
        }
    }
}

pub fn run_install<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    store: &InstallerUpdaterStore,
) -> UpdaterFlowResult<()> {
    let (staged_ui, native) = {
        let mut guard = store.lock();
        let session = ensure_session(app, &mut guard)?;
        if session.state.status != UpdaterStatusValue::Downloaded {
            return Err("No downloaded update is ready to install.".to_owned());
        }
        if session.install_scheduled {
            return Err("Update installation is already in progress.".to_owned());
        }
        if let Some(ui_ver) = session.staged_ui_version.clone() {
            session.install_scheduled = true;
            (Some(ui_ver), None)
        } else {
            session.install_scheduled = true;
            match (session.update.clone(), session.downloaded_bytes.take()) {
                (Some(update), Some(bytes)) => (None, Some((update, bytes))),
                _ => {
                    session.install_scheduled = false;
                    return Err("No downloaded update is ready to install.".to_owned());
                }
            }
        }
    };

    if let Some(staged_version) = staged_ui {
        let handle = app.state::<HotswapHandle>();
        let apply_res = apply_staged_ui_hotswap(app, &handle, &staged_version);
        let mut guard = store.lock();
        if let Some(session) = guard.as_mut() {
            session.install_scheduled = false;
            match apply_res {
                Ok(()) => {
                    session.state.current_version = staged_version;
                    session.state.new_version = None;
                    session.state.progress = None;
                    session.state.downloaded_at = None;
                    session.staged_ui_version = None;
                    session.pending_ui_bundle = None;
                    session.state.status = UpdaterStatusValue::NotAvailable;
                    session.broadcast(app, "not-available");
                }
                Err(ref error) => {
                    session.commit(
                        app,
                        UpdaterTransition::Failed {
                            message: error.clone(),
                        },
                    );
                }
            }
        }
        return apply_res;
    }

    let (update, bytes) = native.ok_or_else(|| "No downloaded update is ready to install.".to_owned())?;
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
#[path = "updater_tests.rs"]
mod tests;
