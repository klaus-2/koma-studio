use std::sync::{Mutex, MutexGuard, PoisonError};

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, CloseRequestApi, Emitter, Manager, Runtime};

pub(crate) const BATCH_TRAY_ACTION_EVENT: &str = "desktop:batch:tray-action";
pub(crate) const CLOSE_REQUESTED_EVENT: &str = "desktop:window:close-requested";

const TRAY_ID: &str = "koma-batch-tray";
const TRAY_SHOW_ITEM_ID: &str = "show";
const TRAY_TOGGLE_ITEM_ID: &str = "toggle-batch";
const TRAY_QUIT_ITEM_ID: &str = "quit";
const TRAY_SHOW_ITEM_LABEL: &str = "Show window";
const TRAY_QUIT_ITEM_LABEL: &str = "Quit";
const TRAY_TOOLTIP_BASE: &str = "KŌMA";
const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ICON_PNG: &[u8] = include_bytes!("../../icons/32x32.png");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum BatchPhase {
    Idle,
    Running,
    Paused,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CloseDecision {
    Allow,
    Block {
        has_unsaved_work: bool,
        batch_running: bool,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum KeepAwakeTransition {
    Acquire,
    Release,
    Hold,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum TrayBatchAction {
    Pause,
    Resume,
}

impl TrayBatchAction {
    pub(crate) fn event_value(self) -> &'static str {
        match self {
            TrayBatchAction::Pause => "pause",
            TrayBatchAction::Resume => "resume",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BatchStatePayload {
    pub(crate) phase: BatchPhase,
    pub(crate) done: u32,
    pub(crate) total: u32,
    pub(crate) label: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BatchStateAccepted {
    pub(crate) accepted: bool,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WindowDirtyPayload {
    pub(crate) dirty: bool,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TrayBatchActionPayload {
    pub(crate) action: &'static str,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CloseRequestedPayload {
    pub(crate) has_unsaved_work: bool,
    pub(crate) batch_running: bool,
}

pub(crate) fn close_guard_decision(
    phase: BatchPhase,
    dirty: bool,
    force_close: bool,
) -> CloseDecision {
    if force_close {
        return CloseDecision::Allow;
    }
    if phase != BatchPhase::Idle || dirty {
        return CloseDecision::Block {
            has_unsaved_work: dirty,
            batch_running: phase == BatchPhase::Running,
        };
    }
    CloseDecision::Allow
}

pub(crate) fn keep_awake_transition(before: BatchPhase, after: BatchPhase) -> KeepAwakeTransition {
    match (before == BatchPhase::Running, after == BatchPhase::Running) {
        (false, true) => KeepAwakeTransition::Acquire,
        (true, false) => KeepAwakeTransition::Release,
        _ => KeepAwakeTransition::Hold,
    }
}

pub(crate) fn tray_tooltip(phase: BatchPhase, done: u32, total: u32) -> String {
    match phase {
        BatchPhase::Running | BatchPhase::Paused => {
            let percent = if total == 0 {
                0
            } else {
                ((u64::from(done) * 100) / u64::from(total)).min(100)
            };
            format!("{TRAY_TOOLTIP_BASE} — {done}/{total} ({percent}%)")
        }
        BatchPhase::Idle | BatchPhase::Error => TRAY_TOOLTIP_BASE.to_owned(),
    }
}

pub(crate) fn tray_pause_action(phase: BatchPhase) -> Option<TrayBatchAction> {
    match phase {
        BatchPhase::Running => Some(TrayBatchAction::Pause),
        BatchPhase::Paused => Some(TrayBatchAction::Resume),
        BatchPhase::Idle | BatchPhase::Error => None,
    }
}

pub(crate) fn tray_toggle_label(phase: BatchPhase) -> &'static str {
    match phase {
        BatchPhase::Paused => "Resume batch",
        BatchPhase::Idle | BatchPhase::Running | BatchPhase::Error => "Pause batch",
    }
}

pub(crate) fn tray_toggle_enabled(phase: BatchPhase) -> bool {
    matches!(phase, BatchPhase::Running | BatchPhase::Paused)
}

pub(crate) fn should_build_tray(tray_present: bool, phase: BatchPhase) -> bool {
    !tray_present && phase == BatchPhase::Running
}

struct BatchStateInner<R: Runtime> {
    phase: BatchPhase,
    done: u32,
    total: u32,
    label: Option<String>,
    dirty: bool,
    force_close: bool,
    keep_awake: Option<keepawake::KeepAwake>,
    tray: Option<TrayIcon<R>>,
}

pub(crate) struct BatchStateStore<R: Runtime> {
    inner: Mutex<BatchStateInner<R>>,
}

impl<R: Runtime> Default for BatchStateStore<R> {
    fn default() -> Self {
        Self {
            inner: Mutex::new(BatchStateInner {
                phase: BatchPhase::Idle,
                done: 0,
                total: 0,
                label: None,
                dirty: false,
                force_close: false,
                keep_awake: None,
                tray: None,
            }),
        }
    }
}

impl<R: Runtime> BatchStateStore<R> {
    fn lock(&self) -> MutexGuard<'_, BatchStateInner<R>> {
        self.inner.lock().unwrap_or_else(PoisonError::into_inner)
    }

    fn close_decision(&self) -> CloseDecision {
        match self.inner.lock() {
            Ok(mut state) => {
                let force_close = state.force_close;
                state.force_close = false;
                close_guard_decision(state.phase, state.dirty, force_close)
            }
            Err(_) => close_guard_decision(BatchPhase::Idle, false, false),
        }
    }
}

pub(crate) fn apply_batch_state<R: Runtime>(app: &AppHandle<R>, payload: BatchStatePayload) {
    let store = app.state::<BatchStateStore<R>>();
    let (build_tray, existing_tray) = {
        let mut state = store.lock();
        match keep_awake_transition(state.phase, payload.phase) {
            KeepAwakeTransition::Acquire => match create_keep_awake() {
                Ok(guard) => state.keep_awake = Some(guard),
                Err(error) => log::warn!("failed to acquire the batch keep-awake lock: {error}"),
            },
            KeepAwakeTransition::Release => state.keep_awake = None,
            KeepAwakeTransition::Hold => {}
        }
        state.phase = payload.phase;
        state.done = payload.done;
        state.total = payload.total;
        state.label = payload.label;
        tracing::debug!(
            phase = ?state.phase,
            done = state.done,
            total = state.total,
            label = ?state.label,
            "batch state updated"
        );
        (
            should_build_tray(state.tray.is_some(), state.phase),
            state.tray.clone(),
        )
    };
    if build_tray {
        match build_tray_icon(app, payload.phase, payload.done, payload.total) {
            Ok(tray) => {
                let mut state = store.lock();
                if state.tray.is_none() {
                    state.tray = Some(tray);
                }
            }
            Err(error) => log::warn!("failed to create the batch tray icon: {error}"),
        }
    } else if let Some(tray) = existing_tray {
        refresh_tray(app, &tray, payload.phase, payload.done, payload.total);
    }
}

pub(crate) fn set_dirty<R: Runtime>(app: &AppHandle<R>, dirty: bool) {
    app.state::<BatchStateStore<R>>().lock().dirty = dirty;
}

pub(crate) fn request_force_close<R: Runtime>(app: &AppHandle<R>) {
    app.state::<BatchStateStore<R>>().lock().force_close = true;
    match app.get_webview_window(MAIN_WINDOW_LABEL) {
        Some(window) => {
            if let Err(error) = window.close() {
                log::warn!("failed to close the main window for force close: {error}");
                app.state::<BatchStateStore<R>>().lock().force_close = false;
            }
        }
        None => app.exit(0),
    }
}

pub(crate) fn release_keep_awake<R: Runtime>(app: &AppHandle<R>) {
    app.state::<BatchStateStore<R>>().lock().keep_awake = None;
}

pub(crate) fn handle_close_requested<R: Runtime>(
    app: &AppHandle<R>,
    api: &CloseRequestApi,
) -> bool {
    let decision = app.state::<BatchStateStore<R>>().close_decision();
    match decision {
        CloseDecision::Allow => true,
        CloseDecision::Block {
            has_unsaved_work,
            batch_running,
        } => {
            api.prevent_close();
            if let Err(error) = app.emit(
                CLOSE_REQUESTED_EVENT,
                CloseRequestedPayload {
                    has_unsaved_work,
                    batch_running,
                },
            ) {
                log::warn!("failed to emit the close-requested event: {error}");
            }
            false
        }
    }
}

fn create_keep_awake() -> Result<keepawake::KeepAwake, keepawake::Error> {
    keepawake::Builder::default()
        .display(true)
        .reason("Batch processing".to_owned())
        .app_name("KOMA Studio".to_owned())
        .app_reverse_domain("com.komastudio.desktop".to_owned())
        .create()
}

fn build_tray_icon<R: Runtime>(
    app: &AppHandle<R>,
    phase: BatchPhase,
    done: u32,
    total: u32,
) -> tauri::Result<TrayIcon<R>> {
    let menu = build_tray_menu(app, phase)?;
    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .menu(&menu)
        .tooltip(tray_tooltip(phase, done, total))
        .on_menu_event(|app, event| handle_tray_menu_event(app, event.id().0.as_str()));
    if let Some(icon) = tray_icon_image() {
        builder = builder.icon(icon);
    }
    builder.build(app)
}

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>, phase: BatchPhase) -> tauri::Result<Menu<R>> {
    let show = MenuItemBuilder::with_id(TRAY_SHOW_ITEM_ID, TRAY_SHOW_ITEM_LABEL).build(app)?;
    let toggle = MenuItemBuilder::with_id(TRAY_TOGGLE_ITEM_ID, tray_toggle_label(phase))
        .enabled(tray_toggle_enabled(phase))
        .build(app)?;
    let quit = MenuItemBuilder::with_id(TRAY_QUIT_ITEM_ID, TRAY_QUIT_ITEM_LABEL).build(app)?;
    MenuBuilder::new(app)
        .item(&show)
        .separator()
        .item(&toggle)
        .separator()
        .item(&quit)
        .build()
}

fn refresh_tray<R: Runtime>(
    app: &AppHandle<R>,
    tray: &TrayIcon<R>,
    phase: BatchPhase,
    done: u32,
    total: u32,
) {
    match build_tray_menu(app, phase) {
        Ok(menu) => {
            if let Err(error) = tray.set_menu(Some(menu)) {
                log::warn!("failed to update the batch tray menu: {error}");
            }
        }
        Err(error) => log::warn!("failed to rebuild the batch tray menu: {error}"),
    }
    if let Err(error) = tray.set_tooltip(Some(tray_tooltip(phase, done, total))) {
        log::warn!("failed to update the batch tray tooltip: {error}");
    }
}

fn handle_tray_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    match id {
        TRAY_SHOW_ITEM_ID => show_main_window(app),
        TRAY_TOGGLE_ITEM_ID => emit_tray_batch_action(app),
        TRAY_QUIT_ITEM_ID => app.exit(0),
        _ => {}
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        log::warn!("tray show requested but no main window exists");
        return;
    };
    if let Err(error) = window.unminimize() {
        log::warn!("tray show failed to unminimize the window: {error}");
    }
    if let Err(error) = window.set_focus() {
        log::warn!("tray show failed to focus the window: {error}");
    }
}

fn emit_tray_batch_action<R: Runtime>(app: &AppHandle<R>) {
    let action = tray_pause_action(app.state::<BatchStateStore<R>>().lock().phase);
    let Some(action) = action else {
        return;
    };
    if app.get_webview_window(MAIN_WINDOW_LABEL).is_none() {
        log::warn!("tray batch action skipped: no main webview window is listening");
        return;
    }
    let payload = TrayBatchActionPayload {
        action: action.event_value(),
    };
    if let Err(error) = app.emit(BATCH_TRAY_ACTION_EVENT, payload) {
        log::warn!("failed to emit the tray batch action: {error}");
    }
}

fn tray_icon_image() -> Option<tauri::image::Image<'static>> {
    let decoded = image::load_from_memory(TRAY_ICON_PNG).ok()?;
    let rgba = decoded.to_rgba8();
    let (width, height) = (rgba.width(), rgba.height());
    Some(tauri::image::Image::new_owned(
        rgba.into_raw(),
        width,
        height,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn close_guard_allows_idle_clean_state() {
        assert_eq!(
            close_guard_decision(BatchPhase::Idle, false, false),
            CloseDecision::Allow
        );
    }

    #[test]
    fn close_guard_blocks_any_non_idle_phase() {
        for phase in [BatchPhase::Running, BatchPhase::Paused, BatchPhase::Error] {
            assert_eq!(
                close_guard_decision(phase, false, false),
                CloseDecision::Block {
                    has_unsaved_work: false,
                    batch_running: phase == BatchPhase::Running,
                }
            );
        }
    }

    #[test]
    fn close_guard_blocks_dirty_state_even_when_idle() {
        assert_eq!(
            close_guard_decision(BatchPhase::Idle, true, false),
            CloseDecision::Block {
                has_unsaved_work: true,
                batch_running: false,
            }
        );
    }

    #[test]
    fn close_guard_force_close_overrides_every_guard_condition() {
        for phase in [
            BatchPhase::Idle,
            BatchPhase::Running,
            BatchPhase::Paused,
            BatchPhase::Error,
        ] {
            assert_eq!(close_guard_decision(phase, true, true), CloseDecision::Allow);
        }
    }

    #[test]
    fn tooltip_is_plain_brand_when_not_showing_progress() {
        assert_eq!(tray_tooltip(BatchPhase::Idle, 0, 0), "KŌMA");
        assert_eq!(tray_tooltip(BatchPhase::Error, 4, 8), "KŌMA");
    }

    #[test]
    fn tooltip_reports_progress_for_running_and_paused() {
        assert_eq!(tray_tooltip(BatchPhase::Running, 3, 10), "KŌMA — 3/10 (30%)");
        assert_eq!(tray_tooltip(BatchPhase::Paused, 1, 3), "KŌMA — 1/3 (33%)");
    }

    #[test]
    fn tooltip_guards_zero_total_and_percent_overrun() {
        assert_eq!(tray_tooltip(BatchPhase::Running, 0, 0), "KŌMA — 0/0 (0%)");
        assert_eq!(
            tray_tooltip(BatchPhase::Paused, 11, 10),
            "KŌMA — 11/10 (100%)"
        );
    }

    #[test]
    fn keep_awake_acquires_only_when_entering_running() {
        for phase in [BatchPhase::Idle, BatchPhase::Paused, BatchPhase::Error] {
            assert_eq!(
                keep_awake_transition(phase, BatchPhase::Running),
                KeepAwakeTransition::Acquire
            );
        }
    }

    #[test]
    fn keep_awake_releases_when_leaving_running() {
        for phase in [BatchPhase::Idle, BatchPhase::Paused, BatchPhase::Error] {
            assert_eq!(
                keep_awake_transition(BatchPhase::Running, phase),
                KeepAwakeTransition::Release
            );
        }
    }

    #[test]
    fn keep_awake_holds_when_running_state_does_not_change() {
        assert_eq!(
            keep_awake_transition(BatchPhase::Running, BatchPhase::Running),
            KeepAwakeTransition::Hold
        );
    }

    #[test]
    fn keep_awake_holds_between_non_running_phases() {
        for (before, after) in [
            (BatchPhase::Idle, BatchPhase::Idle),
            (BatchPhase::Idle, BatchPhase::Paused),
            (BatchPhase::Idle, BatchPhase::Error),
            (BatchPhase::Paused, BatchPhase::Idle),
            (BatchPhase::Paused, BatchPhase::Paused),
            (BatchPhase::Paused, BatchPhase::Error),
            (BatchPhase::Error, BatchPhase::Idle),
            (BatchPhase::Error, BatchPhase::Paused),
            (BatchPhase::Error, BatchPhase::Error),
        ] {
            assert_eq!(
                keep_awake_transition(before, after),
                KeepAwakeTransition::Hold
            );
        }
    }

    #[test]
    fn tray_pause_action_matches_the_phase() {
        assert_eq!(tray_pause_action(BatchPhase::Running), Some(TrayBatchAction::Pause));
        assert_eq!(tray_pause_action(BatchPhase::Paused), Some(TrayBatchAction::Resume));
        assert_eq!(tray_pause_action(BatchPhase::Idle), None);
        assert_eq!(tray_pause_action(BatchPhase::Error), None);
    }

    #[test]
    fn tray_action_event_values_match_the_frozen_contract() {
        assert_eq!(TrayBatchAction::Pause.event_value(), "pause");
        assert_eq!(TrayBatchAction::Resume.event_value(), "resume");
    }

    #[test]
    fn tray_toggle_label_reflects_the_phase() {
        assert_eq!(tray_toggle_label(BatchPhase::Running), "Pause batch");
        assert_eq!(tray_toggle_label(BatchPhase::Paused), "Resume batch");
        assert_eq!(tray_toggle_label(BatchPhase::Idle), "Pause batch");
        assert_eq!(tray_toggle_label(BatchPhase::Error), "Pause batch");
    }

    #[test]
    fn tray_toggle_is_enabled_only_while_running_or_paused() {
        assert!(tray_toggle_enabled(BatchPhase::Running));
        assert!(tray_toggle_enabled(BatchPhase::Paused));
        assert!(!tray_toggle_enabled(BatchPhase::Idle));
        assert!(!tray_toggle_enabled(BatchPhase::Error));
    }

    #[test]
    fn tray_builds_once_on_the_first_running_state() {
        assert!(should_build_tray(false, BatchPhase::Running));
        assert!(!should_build_tray(true, BatchPhase::Running));
        assert!(!should_build_tray(false, BatchPhase::Idle));
        assert!(!should_build_tray(false, BatchPhase::Paused));
        assert!(!should_build_tray(false, BatchPhase::Error));
    }

    #[test]
    fn batch_state_payload_deserializes_the_frozen_shape() {
        let payload: BatchStatePayload = serde_json::from_str(
            "{\"phase\":\"running\",\"done\":3,\"total\":10,\"label\":null}",
        )
        .expect("valid payload");
        assert_eq!(payload.phase, BatchPhase::Running);
        assert_eq!(payload.done, 3);
        assert_eq!(payload.total, 10);
        assert_eq!(payload.label, None);
    }

    #[test]
    fn batch_state_payload_rejects_unknown_phases() {
        assert!(serde_json::from_str::<BatchStatePayload>(
            "{\"phase\":\"stopped\",\"done\":0,\"total\":0}"
        )
        .is_err());
    }

    #[test]
    fn accepted_and_event_payloads_serialize_the_frozen_shape() {
        let accepted = serde_json::to_value(BatchStateAccepted { accepted: true })
            .expect("serializable result");
        assert_eq!(accepted, serde_json::json!({ "accepted": true }));

        let close = serde_json::to_value(CloseRequestedPayload {
            has_unsaved_work: true,
            batch_running: false,
        })
        .expect("serializable payload");
        assert_eq!(
            close,
            serde_json::json!({ "hasUnsavedWork": true, "batchRunning": false })
        );

        let action =
            serde_json::to_value(TrayBatchActionPayload { action: "resume" }).expect("serializable payload");
        assert_eq!(action, serde_json::json!({ "action": "resume" }));
    }
}
