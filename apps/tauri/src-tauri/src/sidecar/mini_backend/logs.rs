use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_shell::process::CommandEvent;
use tokio::sync::oneshot;

use crate::runtime::profiles::{
    MiniBackendRuntimePatch, MiniBackendRuntimeStore, patch_runtime_state,
};
use crate::sidecar::recovery::{MiniBackendSidecarStore, RestartTrigger, fold_sidecar_failure};

pub(crate) const FALLBACK_LOG_MARKERS: [&str; 1] = ["runtime.falling_back_to_cpu"];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BackendLogLevel {
    Info,
    Warn,
    Error,
}

pub(crate) fn parse_listening_port(raw_text: &str) -> Option<u16> {
    let trimmed = raw_text.trim();
    if !trimmed.starts_with('{') {
        return None;
    }
    let parsed: serde_json::Value = serde_json::from_str(trimmed).ok()?;
    if parsed.get("event")?.as_str()? != "listening" {
        return None;
    }
    let port = parsed.get("port")?.as_u64()?;
    u16::try_from(port).ok().filter(|value| *value > 0)
}

pub(crate) fn decode_output(bytes: &[u8]) -> String {
    String::from_utf8(bytes.to_vec()).unwrap_or_else(|_| String::from_utf8_lossy(bytes).to_string())
}

pub(crate) fn classify_backend_log(raw_text: &str) -> BackendLogLevel {
    let text = raw_text.trim();
    if let Ok(serde_json::Value::Object(record)) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(level) = record.get("level").and_then(serde_json::Value::as_str) {
            return match level.trim().to_ascii_uppercase().as_str() {
                "DEBUG" | "INFO" => BackendLogLevel::Info,
                "WARNING" | "WARN" => BackendLogLevel::Warn,
                _ => BackendLogLevel::Error,
            };
        }
    }
    let starts_with_level = |level: &str| {
        text.strip_prefix(level)
            .is_some_and(|rest| rest.starts_with(':') || rest.starts_with(' '))
    };
    if starts_with_level("INFO") || starts_with_level("DEBUG") {
        BackendLogLevel::Info
    } else if starts_with_level("WARNING") || starts_with_level("WARN") {
        BackendLogLevel::Warn
    } else {
        BackendLogLevel::Error
    }
}

pub(crate) fn should_ignore_progress_noise(raw_text: &str) -> bool {
    let text = raw_text.trim();
    text.is_empty()
        || text.contains("Progress: |")
        || text.contains("onnxruntime is not built with CUDA 12.x support")
}

fn sync_runtime_state_from_log<R: Runtime>(app: &AppHandle<R>, raw_text: &str) {
    let text = raw_text.trim();
    if text.is_empty() {
        return;
    }
    if !FALLBACK_LOG_MARKERS
        .iter()
        .any(|marker| text.contains(marker))
    {
        return;
    }
    let runtime_store = app.state::<MiniBackendRuntimeStore>();
    let message =
        "The selected runtime profile failed warmup and was downgraded to CPU.".to_string();
    let _ = patch_runtime_state(
        app,
        &runtime_store,
        MiniBackendRuntimePatch {
            active_profile: Some("cpu".to_string()),
            last_error: Some(Some(message.clone())),
            status: Some("fallback".to_string()),
            status_message: Some(Some(message)),
            ..Default::default()
        },
    );
}

pub(crate) async fn handle_command_event<R: Runtime + 'static>(
    app: &AppHandle<R>,
    pid: u32,
    generation: u64,
    event: CommandEvent,
    port_tx: &mut Option<oneshot::Sender<u16>>,
) {
    match event {
        CommandEvent::Stdout(line) => {
            let text = decode_output(&line);
            if let Some(port) = parse_listening_port(&text) {
                if let Some(sender) = port_tx.take() {
                    let _ = sender.send(port);
                }
            }
            if !should_ignore_progress_noise(&text) {
                sync_runtime_state_from_log(app, &text);
                log::info!("mini-backend: {}", text.trim());
            }
        }
        CommandEvent::Stderr(line) => {
            let text = decode_output(&line);
            if !should_ignore_progress_noise(&text) {
                sync_runtime_state_from_log(app, &text);
                {
                    let store = app.state::<MiniBackendSidecarStore>();
                    store.push_stderr(text.trim_end());
                }
                match classify_backend_log(&text) {
                    BackendLogLevel::Info => log::info!("mini-backend: {}", text.trim()),
                    BackendLogLevel::Warn => log::warn!("mini-backend: {}", text.trim()),
                    BackendLogLevel::Error => log::error!("mini-backend: {}", text.trim()),
                }
            }
        }
        CommandEvent::Terminated(payload) => {
            let exit_code = payload.code;
            let (is_current, health_confirmed) = {
                let store = app.state::<MiniBackendSidecarStore>();
                let is_current = store.is_current_generation(generation);
                if is_current {
                    store.clear_child_for_pid(pid);
                    let _ = store.set_job(None);
                    let _ = store.set_active_local_api_url(None);
                }
                (is_current, store.health_confirmed())
            };
            if !is_current {
                log::info!(
                    "mini-backend: ignored exit (code {}) from a superseded process",
                    exit_code.map_or_else(|| "unknown".to_string(), |code| code.to_string())
                );
                return;
            }
            if let Err(error) = fold_sidecar_failure(
                app,
                RestartTrigger::UnexpectedExit {
                    code: exit_code,
                    health_confirmed,
                },
            ) {
                log::error!("mini-backend: crash post-mortem failed: {error}");
            }
        }
        CommandEvent::Error(error) => {
            let runtime_store = app.state::<MiniBackendRuntimeStore>();
            let _ = patch_runtime_state(
                app,
                &runtime_store,
                MiniBackendRuntimePatch {
                    status: Some("error".to_string()),
                    status_message: Some(Some(
                        "Mini backend process emitted an error.".to_string(),
                    )),
                    last_error: Some(Some(error.clone())),
                    ..Default::default()
                },
            );
            log::error!("mini-backend process error: {error}");
        }
        _ => {}
    }
}

pub(crate) fn spawn_event_loop<R: Runtime + 'static>(
    app: AppHandle<R>,
    pid: u32,
    generation: u64,
    exited: Arc<AtomicBool>,
    mut receiver: tauri::async_runtime::Receiver<CommandEvent>,
    mut port_tx: Option<oneshot::Sender<u16>>,
) {
    tauri::async_runtime::spawn(async move {
        while let Some(event) = receiver.recv().await {
            if matches!(event, CommandEvent::Terminated(_)) {
                exited.store(true, Ordering::SeqCst);
            }
            handle_command_event(&app, pid, generation, event, &mut port_tx).await;
        }
    });
}
