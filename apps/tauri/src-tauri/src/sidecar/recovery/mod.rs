use std::{
    collections::VecDeque,
    sync::{
        Mutex, MutexGuard,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_shell::process::CommandChild;

use super::failure_report::{RestartDecision, describe_failure};
use super::mini_backend::{process_group::SidecarJobObject, start_mini_backend, stop_mini_backend};
use crate::runtime::profiles::{
    MiniBackendRuntimePatch, MiniBackendRuntimeStore, patch_runtime_state,
};

mod policy;
mod redact;

#[cfg(test)]
mod tests;

pub use policy::StartOutcome;
pub(crate) use policy::{RESTART_MAX_ATTEMPTS, RestartPolicy, RestartTrigger};
use policy::{RESTART_TRANSITION_POLL_INTERVAL, RESTART_TRANSITION_TIMEOUT};
pub(crate) use redact::now_millis;
#[cfg(test)]
pub(crate) use redact::{
    LAST_STDERR_CAPACITY, LAST_STDERR_TAIL_CHARS, LAST_STDERR_TAIL_LINES,
    redact_mini_backend_secrets,
};
use redact::{
    LAST_STDERR_CAPACITY as STDERR_RING_CAP, LAST_STDERR_TAIL_CHARS as STDERR_CHAR_BUDGET,
    LAST_STDERR_TAIL_LINES as STDERR_LINE_BUDGET, redact_mini_backend_secrets as redact_secrets,
    write_crash_log,
};

fn lock_store<'a, T>(mutex: &'a Mutex<T>) -> Result<MutexGuard<'a, T>, String> {
    mutex
        .lock()
        .map_err(|_| "mini-backend sidecar state lock poisoned".to_string())
}

#[derive(Debug, Default)]
pub struct MiniBackendSidecarStore {
    child: Mutex<Option<CommandChild>>,
    pid: Mutex<Option<u32>>,
    job: Mutex<Option<SidecarJobObject>>,
    starting: AtomicBool,
    generation: Mutex<u64>,
    expected_stop: AtomicBool,
    app_exiting: AtomicBool,
    last_stderr: Mutex<VecDeque<String>>,
    restart_policy: Mutex<RestartPolicy>,
    restart_epoch: Mutex<u64>,
    health_confirmed: AtomicBool,
    session_secret: Mutex<Option<String>>,
    active_local_api_url: Mutex<Option<String>>,
}

impl MiniBackendSidecarStore {
    pub(crate) fn lock_start(&self) -> Option<StartupGuard<'_>> {
        self.starting
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .ok()
            .map(|_| StartupGuard(&self.starting))
    }

    pub(crate) fn is_starting(&self) -> bool {
        self.starting.load(Ordering::SeqCst)
    }

    pub(crate) fn register_child(&self, child: CommandChild) -> Result<(u64, u32), String> {
        let pid = child.pid();
        *lock_store(&self.pid)? = Some(pid);
        *lock_store(&self.child)? = Some(child);
        Ok((self.record_spawn()?, pid))
    }

    pub(crate) fn set_job(&self, job: Option<SidecarJobObject>) -> Result<(), String> {
        *lock_store(&self.job)? = job;
        Ok(())
    }

    pub(crate) fn take_job(&self) -> Result<Option<SidecarJobObject>, String> {
        Ok(lock_store(&self.job)?.take())
    }

    pub(crate) fn take_child(&self) -> Result<(Option<CommandChild>, Option<u32>), String> {
        let pid = lock_store(&self.pid)?.take();
        let child = lock_store(&self.child)?.take();
        Ok((child, pid))
    }

    pub(crate) fn clear_child_for_pid(&self, pid: u32) {
        let matched = self
            .pid
            .lock()
            .ok()
            .map(|mut stored| {
                if stored.as_ref() == Some(&pid) {
                    *stored = None;
                    true
                } else {
                    false
                }
            })
            .unwrap_or(false);
        if matched {
            if let Ok(mut child) = self.child.lock() {
                *child = None;
            }
        }
    }

    pub(crate) fn has_child(&self) -> Result<bool, String> {
        Ok(lock_store(&self.child)?.is_some())
    }

    pub(crate) fn set_session_secret(&self, secret: Option<String>) -> Result<(), String> {
        *lock_store(&self.session_secret)? = secret;
        Ok(())
    }

    pub(crate) fn session_secret(&self) -> Option<String> {
        self.session_secret
            .lock()
            .ok()
            .and_then(|guard| guard.clone())
    }

    pub(crate) fn set_active_local_api_url(&self, url: Option<String>) -> Result<(), String> {
        *lock_store(&self.active_local_api_url)? = url;
        Ok(())
    }

    pub(crate) fn active_local_api_url(&self) -> Option<String> {
        self.active_local_api_url
            .lock()
            .ok()
            .and_then(|guard| guard.clone())
    }

    pub(crate) fn current_generation(&self) -> Result<u64, String> {
        Ok(*lock_store(&self.generation)?)
    }

    pub(crate) fn is_current_generation(&self, generation: u64) -> bool {
        self.current_generation().unwrap_or(u64::MIN) == generation
    }

    pub(crate) fn record_spawn(&self) -> Result<u64, String> {
        self.expected_stop.store(false, Ordering::SeqCst);
        self.health_confirmed.store(false, Ordering::SeqCst);
        lock_store(&self.last_stderr)?.clear();
        let mut generation = lock_store(&self.generation)?;
        *generation = generation.saturating_add(1);
        Ok(*generation)
    }

    pub(crate) fn invalidate_generation(&self) -> Result<u64, String> {
        let mut generation = lock_store(&self.generation)?;
        *generation = generation.saturating_add(1);
        Ok(*generation)
    }

    pub(crate) fn mark_expected_stop(&self) {
        self.expected_stop.store(true, Ordering::SeqCst);
    }

    pub(crate) fn mark_restart_intent(&self) {
        self.expected_stop.store(false, Ordering::SeqCst);
    }

    pub(crate) fn mark_app_exiting(&self) -> Result<(), String> {
        self.app_exiting.store(true, Ordering::SeqCst);
        self.cancel_restart_supervisor()?;
        Ok(())
    }

    pub(crate) fn mark_healthy(&self, now_ms: u64) -> Result<(), String> {
        self.health_confirmed.store(true, Ordering::SeqCst);
        lock_store(&self.restart_policy)?.record_health_confirmed(now_ms);
        Ok(())
    }

    pub(crate) fn health_confirmed(&self) -> bool {
        self.health_confirmed.load(Ordering::SeqCst)
    }

    pub(crate) fn push_stderr(&self, line: &str) {
        match self.last_stderr.lock() {
            Ok(mut buffer) => {
                if buffer.len() == STDERR_RING_CAP {
                    buffer.pop_front();
                }
                buffer.push_back(line.to_string());
            }
            Err(_) => log::warn!("mini-backend: stderr buffer lock poisoned; dropping line"),
        }
    }

    pub(crate) fn stderr_tail(&self) -> String {
        let tail = match self.last_stderr.lock() {
            Ok(buffer) => {
                let start = buffer.len().saturating_sub(STDERR_LINE_BUDGET);
                buffer
                    .iter()
                    .skip(start)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join("\n")
            }
            Err(_) => String::new(),
        };
        let redacted = redact_secrets(&tail);
        if redacted.len() <= STDERR_CHAR_BUDGET {
            return redacted;
        }
        let mut start = redacted.len() - STDERR_CHAR_BUDGET;
        while !redacted.is_char_boundary(start) {
            start += 1;
        }
        redacted[start..].to_string()
    }

    pub(crate) fn evaluate_restart(
        &self,
        now_ms: u64,
        trigger: RestartTrigger,
    ) -> Result<RestartDecision, String> {
        let mut policy = lock_store(&self.restart_policy)?;
        Ok(policy.evaluate(
            now_ms,
            trigger,
            self.expected_stop.load(Ordering::SeqCst),
            self.app_exiting.load(Ordering::SeqCst),
        ))
    }

    pub(crate) fn restart_epoch(&self) -> Result<u64, String> {
        Ok(*lock_store(&self.restart_epoch)?)
    }

    pub(crate) fn cancel_restart_supervisor(&self) -> Result<u64, String> {
        let mut epoch = lock_store(&self.restart_epoch)?;
        *epoch = epoch.saturating_add(1);
        Ok(*epoch)
    }

    pub(crate) fn restart_cancelled(&self, epoch: u64) -> Result<bool, String> {
        if self.app_exiting.load(Ordering::SeqCst) || self.expected_stop.load(Ordering::SeqCst) {
            return Ok(true);
        }
        Ok(self.restart_epoch()? != epoch)
    }
}

pub(crate) struct StartupGuard<'a>(pub(crate) &'a AtomicBool);

impl Drop for StartupGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

pub(crate) fn fold_sidecar_failure<R: Runtime + 'static>(
    app: &AppHandle<R>,
    trigger: RestartTrigger,
) -> Result<(), String> {
    let sidecar_store = app.state::<MiniBackendSidecarStore>();
    let decision = sidecar_store.evaluate_restart(now_millis(), trigger)?;
    let epoch = sidecar_store.restart_epoch()?;
    let tail = sidecar_store.stderr_tail();

    let cause = trigger.label();
    let report = describe_failure(&decision, &cause, RESTART_MAX_ATTEMPTS);
    let attempt = match &decision {
        RestartDecision::Restart { attempt, .. } | RestartDecision::Stop { attempt, .. } => {
            *attempt
        }
    };
    let crash_log_path = if report.expected_stop {
        None
    } else {
        write_crash_log(app, trigger, &tail)
    };
    let (status, message, retry_after) = (report.status, report.message, report.retry_after);

    log::error!(
        "mini-backend {cause}; recovery attempt {attempt}/{RESTART_MAX_ATTEMPTS}{}",
        crash_log_path
            .as_ref()
            .map(|path| format!("; post-mortem written to {path}"))
            .unwrap_or_default()
    );

    let runtime_store = app.state::<MiniBackendRuntimeStore>();
    patch_runtime_state(
        app,
        &runtime_store,
        MiniBackendRuntimePatch {
            status: Some(status.as_str().to_string()),
            status_message: Some(Some(message)),
            last_error: Some(if report.expected_stop {
                None
            } else {
                Some(trigger.error_code())
            }),
            attempt: Some(attempt),
            max_attempts: Some(RESTART_MAX_ATTEMPTS),
            exit_code: Some(if report.expected_stop {
                None
            } else {
                trigger.exit_code()
            }),
            last_stderr: Some(if tail.is_empty() { None } else { Some(tail) }),
            crash_log_path: Some(crash_log_path),
            progress: Some(None),
            ..Default::default()
        },
    )
    .map_err(|error| error.to_string())?;

    if let Some(delay) = retry_after {
        schedule_restart(app.clone(), epoch, attempt, delay);
    }
    Ok(())
}

fn schedule_restart<R: Runtime + 'static>(
    app: AppHandle<R>,
    epoch: u64,
    attempt: u32,
    delay: Duration,
) {
    log::warn!(
        "mini-backend: restarting in {} ms (attempt {attempt}/{RESTART_MAX_ATTEMPTS})",
        delay.as_millis()
    );
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(delay).await;
        let sidecar_store = app.state::<MiniBackendSidecarStore>();
        let cancelled = sidecar_store.restart_cancelled(epoch);
        if cancelled.unwrap_or(true) {
            log::info!("mini-backend: pending restart cancelled by a newer request");
            return;
        }
        if let Err(error) = run_restart_attempt(app.clone(), attempt).await {
            log::warn!("mini-backend: recovery attempt {attempt} failed: {error}");
        }
    });
}

async fn run_restart_attempt<R: Runtime + 'static>(
    app: AppHandle<R>,
    attempt: u32,
) -> Result<(), String> {
    if !wait_until_start_settles(&app).await {
        log::info!("mini-backend: recovery stood down; another start owns the transition");
        return Ok(());
    }

    let sidecar_store = app.state::<MiniBackendSidecarStore>();
    sidecar_store.invalidate_generation()?;
    sidecar_store.mark_restart_intent();
    stop_mini_backend(&app)?;

    let runtime_store = app.state::<MiniBackendRuntimeStore>();
    patch_runtime_state(
        &app,
        &runtime_store,
        MiniBackendRuntimePatch {
            status: Some("starting".to_string()),
            status_message: Some(Some(format!(
                "Restarting local backend (attempt {attempt}/{RESTART_MAX_ATTEMPTS})."
            ))),
            attempt: Some(attempt),
            max_attempts: Some(RESTART_MAX_ATTEMPTS),
            exit_code: Some(None),
            crash_log_path: Some(None),
            progress: Some(None),
            ..Default::default()
        },
    )
    .map_err(|error| error.to_string())?;

    start_mini_backend(app).await.map(|_| ())
}

pub(crate) async fn wait_until_start_settles<R: Runtime>(app: &AppHandle<R>) -> bool {
    let deadline = tokio::time::Instant::now() + RESTART_TRANSITION_TIMEOUT;
    loop {
        let starting = {
            let sidecar_store = app.state::<MiniBackendSidecarStore>();
            sidecar_store.is_starting()
        };
        if !starting {
            return true;
        }
        if tokio::time::Instant::now() >= deadline {
            return false;
        }
        tokio::time::sleep(RESTART_TRANSITION_POLL_INTERVAL).await;
    }
}

pub fn mark_app_exiting<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    app.state::<MiniBackendSidecarStore>().mark_app_exiting()
}
