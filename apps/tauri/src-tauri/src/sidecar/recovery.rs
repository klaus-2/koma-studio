//! Recovery supervisor for the mini-backend sidecar.
//!
//! Owns what keeps the local backend alive: the bounded restart budget, the
//! generation token that makes a superseded process inert, the crash
//! post-mortem, and the retry loop. `super::mini_backend` owns starting,
//! stopping and command resolution, and reports each failure it observes to
//! [`fold_sidecar_failure`].
//!
//! The budget and predicates are a cross-shell contract: `apps/electron`
//! mirrors them in `electron/modules/mini-backend-restart-policy.ts`, so a
//! change here has to be made there too.

use std::{
    collections::VecDeque,
    fs,
    io::Write,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, MutexGuard,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_shell::process::CommandChild;

use super::mini_backend::{start_mini_backend, stop_mini_backend};
use crate::runtime::profiles::{
    patch_runtime_state, MiniBackendRuntimePatch, MiniBackendRuntimeStore,
};

/// Bounded restart budget and health/reset timing for the supervisor.
const RESTART_BACKOFF_BASE_MILLIS: u64 = 250;
const RESTART_BACKOFF_MAX_MILLIS: u64 = 30_000;
const RESTART_MAX_ATTEMPTS: u32 = 5;
const RESTART_HEALTHY_RESET_MS: u64 = 60_000;
const CRASH_LOOP_WINDOW_MS: u64 = 120_000;
const CRASH_LOOP_PRE_HEALTH_EXITS: usize = 3;
const RESTART_TRANSITION_TIMEOUT: Duration = Duration::from_secs(300);
const RESTART_TRANSITION_POLL_INTERVAL: Duration = Duration::from_millis(250);

/// Stderr post-mortem sizing. The ring keeps the tail in memory for the crash
/// patch and the crash file; both use the same 50-line / 2000-char budget as
/// `formatMiniBackendCrashStderr` in `apps/electron`.
const LAST_STDERR_CAPACITY: usize = 50;
const LAST_STDERR_TAIL_LINES: usize = 50;
const LAST_STDERR_TAIL_CHARS: usize = 2_000;
const CRASH_LOG_FILE_NAME: &str = "mini-backend-crash.log";
const REDACTED_VALUE: &str = "[redacted]";

/// Result of a start request. `AlreadyStarting` is not success: a caller that
/// obtains it must wait for the in-flight transition instead of reporting a
/// healthy backend.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StartOutcome {
    Started,
    AlreadyStarting,
    AlreadyRunning,
    NoRuntime,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RestartTrigger {
    /// A running child exited. `health_confirmed` says whether this start ever
    /// answered `/health`; only pre-health non-zero exits count toward the
    /// rolling crash-loop window.
    UnexpectedExit {
        code: Option<i32>,
        health_confirmed: bool,
    },
    /// A spawn succeeded but the child never answered `/health` in budget.
    HealthTimeout,
    /// The child process could not be created at all. One-shot stop.
    SpawnError,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum RestartDecision {
    Restart { attempt: u32, delay: Duration },
    /// `attempt` is the number of failed attempts already consumed, so a
    /// stopped recovery reports the same budget the UI saw while retrying.
    Stop { reason: RestartStopReason, attempt: u32 },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RestartStopReason {
    ExpectedStop,
    AppExiting,
    SpawnError,
    CrashLoop,
    AttemptsExhausted,
}

/// Pure, clock-injected restart policy. Keeping every wait out of this struct
/// makes the stop predicate testable without sleeping.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub(crate) struct RestartPolicy {
    /// Failed restart attempts in the current generation. Reset only after a
    /// confirmed `/health` plus 60 s of healthy runtime.
    failed_attempts: u32,
    /// Timestamps (ms) of non-zero exits that happened before `/health`.
    pre_health_failures_ms: VecDeque<u64>,
    /// Time of the most recent confirmed `/health`, used for the 60 s reset.
    healthy_since_ms: Option<u64>,
}

impl RestartPolicy {
    pub(crate) fn record_health_confirmed(&mut self, now_ms: u64) {
        self.healthy_since_ms = Some(now_ms);
    }

    /// Backoff for the n-th completed failure: 250 ms * 2^n, capped at 30 s.
    pub(crate) fn backoff_delay(completed_failures: u32) -> Duration {
        let exponent = completed_failures.min(20);
        let millis = RESTART_BACKOFF_BASE_MILLIS
            .saturating_mul(1_u64 << exponent)
            .min(RESTART_BACKOFF_MAX_MILLIS);
        Duration::from_millis(millis)
    }

    pub(crate) fn evaluate(
        &mut self,
        now_ms: u64,
        trigger: RestartTrigger,
        expected_stop: bool,
        app_exiting: bool,
    ) -> RestartDecision {
        if app_exiting {
            return self.stop(RestartStopReason::AppExiting);
        }
        if expected_stop {
            return self.stop(RestartStopReason::ExpectedStop);
        }
        self.reset_after_healthy_runtime(now_ms);

        let pre_health_crash = match trigger {
            RestartTrigger::UnexpectedExit {
                code,
                health_confirmed,
            } => !health_confirmed && is_non_zero_exit(code),
            _ => false,
        };
        if pre_health_crash {
            self.record_pre_health_failure(now_ms);
        }
        // The crash-loop predicate is checked before the budget is consumed, so
        // the attempt count it reports matches the Electron supervisor for the
        // same sequence of failures.
        if self.crash_loop_detected() {
            return self.stop(RestartStopReason::CrashLoop);
        }
        self.failed_attempts = self.failed_attempts.saturating_add(1);
        if trigger == RestartTrigger::SpawnError {
            return self.stop(RestartStopReason::SpawnError);
        }
        if self.failed_attempts > RESTART_MAX_ATTEMPTS {
            return self.stop(RestartStopReason::AttemptsExhausted);
        }
        RestartDecision::Restart {
            attempt: self.failed_attempts,
            delay: Self::backoff_delay(self.failed_attempts.saturating_sub(1)),
        }
    }

    pub(crate) fn stop(&self, reason: RestartStopReason) -> RestartDecision {
        RestartDecision::Stop {
            reason,
            attempt: self.failed_attempts,
        }
    }

    pub(crate) fn record_pre_health_failure(&mut self, now_ms: u64) {
        self.pre_health_failures_ms.push_back(now_ms);
        while let Some(oldest) = self.pre_health_failures_ms.front() {
            if now_ms.saturating_sub(*oldest) > CRASH_LOOP_WINDOW_MS {
                self.pre_health_failures_ms.pop_front();
            } else {
                break;
            }
        }
    }

    pub(crate) fn crash_loop_detected(&self) -> bool {
        self.pre_health_failures_ms.len() >= CRASH_LOOP_PRE_HEALTH_EXITS
    }

    pub(crate) fn reset_after_healthy_runtime(&mut self, now_ms: u64) {
        let Some(healthy_since) = self.healthy_since_ms else {
            return;
        };
        if now_ms.saturating_sub(healthy_since) < RESTART_HEALTHY_RESET_MS {
            return;
        }
        self.failed_attempts = 0;
        self.pre_health_failures_ms.clear();
        self.healthy_since_ms = None;
    }
}

fn is_non_zero_exit(code: Option<i32>) -> bool {
    matches!(code, Some(value) if value != 0)
}

fn lock_store<'a, T>(mutex: &'a Mutex<T>) -> Result<MutexGuard<'a, T>, String> {
    mutex
        .lock()
        .map_err(|_| "mini-backend sidecar state lock poisoned".to_string())
}

fn chars_match_ci(chars: &[char], at: usize, needle: &str) -> bool {
    needle.chars().enumerate().all(|(offset, c)| {
        chars
            .get(at + offset)
            .is_some_and(|found| found.eq_ignore_ascii_case(&c))
    })
}

fn find_ci(chars: &[char], from: usize, needle: &str) -> Option<usize> {
    (from..chars.len()).find(|&at| chars_match_ci(chars, at, needle))
}

fn run_end(chars: &[char], from: usize, accept: impl Fn(char) -> bool) -> usize {
    let mut i = from;
    while i < chars.len() && accept(chars[i]) {
        i += 1;
    }
    i
}

fn replace_run(chars: &mut Vec<char>, from: usize, to: usize, replacement: &str) {
    chars.splice(from..to, replacement.chars());
}

/// Credential shapes the local backend can echo into stderr: an `sk-` API key,
/// a `Bearer` token, and `api_key=` / `token=` pairs. Mirrors
/// `SECRET_REDACTION_RULES` in
/// `apps/electron/electron/modules/mini-backend-restart-policy.ts`, hand-rolled
/// because a regex engine is not worth adding for three literal shapes.
fn redact_mini_backend_secrets(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut chars = redact_prefixed_key(&chars, "sk-");
    chars = redact_after_keyword(&chars, "bearer");
    for name in ["api_key", "api-key", "apikey", "token"] {
        chars = redact_assigned_value(&chars, name);
    }
    chars.into_iter().collect()
}

/// `sk-abc123` → `sk-[redacted]`. Runs shorter than three characters are left
/// alone: `sk-` also appears in ordinary words and paths.
fn redact_prefixed_key(chars: &[char], prefix: &str) -> Vec<char> {
    let mut out = chars.to_vec();
    let mut from = 0;
    while let Some(at) = find_ci(&out, from, prefix) {
        let value = at + prefix.chars().count();
        let end = run_end(&out, value, |c| {
            c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '~')
        });
        if end - value >= 3 {
            replace_run(&mut out, value, end, REDACTED_VALUE);
            from = value + REDACTED_VALUE.chars().count();
        } else {
            from = value;
        }
    }
    out
}

/// `Bearer <token>` → `Bearer [redacted]`, keeping the original spacing.
fn redact_after_keyword(chars: &[char], keyword: &str) -> Vec<char> {
    let mut out = chars.to_vec();
    let mut from = 0;
    while let Some(at) = find_ci(&out, from, keyword) {
        let after_keyword = at + keyword.chars().count();
        let value = run_end(&out, after_keyword, char::is_whitespace);
        let end = run_end(&out, value, |c| {
            c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '+' | '/' | '~')
        });
        if end > value {
            replace_run(&mut out, value, end, REDACTED_VALUE);
            from = value + REDACTED_VALUE.chars().count();
        } else {
            from = after_keyword;
        }
    }
    out
}

/// `api_key=secret` and `token: "secret"` → `name=[redacted]`. An unquoted value
/// ends at whitespace or a query separator, a quoted one at its closing quote.
fn redact_assigned_value(chars: &[char], name: &str) -> Vec<char> {
    let mut out = chars.to_vec();
    let mut from = 0;
    while let Some(at) = find_ci(&out, from, name) {
        let after_name = at + name.chars().count();
        let separator = run_end(&out, after_name, char::is_whitespace);
        let value = run_end(&out, separator + 1, char::is_whitespace);
        let quoted = matches!(out.get(value), Some('"') | Some('\''));
        let end = if quoted {
            (run_end(&out, value + 1, |c| c != '"' && c != '\'') + 1).min(out.len())
        } else {
            run_end(&out, value, |c| !c.is_whitespace() && !matches!(c, ',' | ';' | '&'))
        };
        if !out.get(separator).is_some_and(|c| matches!(c, '=' | ':')) || end <= value {
            from = after_name;
            continue;
        }
        replace_run(&mut out, value, end, REDACTED_VALUE);
        from = value + REDACTED_VALUE.chars().count();
    }
    out
}

pub(crate) fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or_default()
}

#[derive(Debug, Default)]
pub struct MiniBackendSidecarStore {
    child: Mutex<Option<CommandChild>>,
    pid: Mutex<Option<u32>>,
    starting: AtomicBool,
    /// Incremented on every successful spawn and captured by that spawn's
    /// monitor loop; `Terminated` from any other generation is ignored.
    generation: Mutex<u64>,
    /// Set immediately before a deliberate kill, cleared by the next start.
    expected_stop: AtomicBool,
    /// Latched by the app-exit hooks; once set, no restart may run.
    app_exiting: AtomicBool,
    last_stderr: Mutex<VecDeque<String>>,
    restart_policy: Mutex<RestartPolicy>,
    /// Cancellation epoch; a manual restart bumps it so an in-flight
    /// supervisor aborts instead of racing the manual start.
    restart_epoch: Mutex<u64>,
    /// Whether the current generation answered `/health` at least once.
    health_confirmed: AtomicBool,
}

impl MiniBackendSidecarStore {
    pub(crate) fn lock_start(&self) -> Option<StartupGuard<'_>> {
        self.starting
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .ok()
            .map(|_| StartupGuard(&self.starting))
    }

    /// Whether a start currently owns the spawn/health transition.
    pub(crate) fn is_starting(&self) -> bool {
        self.starting.load(Ordering::SeqCst)
    }

    /// Registers the spawned child and returns its generation token and pid.
    pub(crate) fn register_child(&self, child: CommandChild) -> Result<(u64, u32), String> {
        let pid = child.pid();
        *lock_store(&self.pid)? = Some(pid);
        *lock_store(&self.child)? = Some(child);
        Ok((self.record_spawn()?, pid))
    }

    /// Takes ownership of the child and its pid for a deliberate stop.
    pub(crate) fn take_child(&self) -> Result<(Option<CommandChild>, Option<u32>), String> {
        let pid = lock_store(&self.pid)?.take();
        let child = lock_store(&self.child)?.take();
        Ok((child, pid))
    }

    /// Releases the tracked process once its monitor reports the exit, so a
    /// later start does not see an already-dead child and report success.
    pub(crate) fn clear_child_for_pid(&self, pid: u32) {
        if let Ok(mut stored) = self.pid.lock() {
            if stored.as_ref() == Some(&pid) {
                *stored = None;
            }
        }
        if let Ok(mut child) = self.child.lock() {
            *child = None;
        }
    }

    pub(crate) fn has_child(&self) -> Result<bool, String> {
        Ok(lock_store(&self.child)?.is_some())
    }

    pub(crate) fn current_generation(&self) -> Result<u64, String> {
        Ok(*lock_store(&self.generation)?)
    }

    /// Whether an event from `generation` still describes the live child. A
    /// restart, a kill-before-retry, or a manual start all move the token, so
    /// the superseded monitor's `Terminated` must not fold a second failure for
    /// a death that was already reported.
    pub(crate) fn is_current_generation(&self, generation: u64) -> bool {
        self.current_generation().unwrap_or(u64::MIN) == generation
    }

    /// Registers a successful spawn: clears the expected-stop latch (so it can
    /// never survive across restarts), resets the per-generation health and
    /// stderr markers, and returns the new generation token.
    fn record_spawn(&self) -> Result<u64, String> {
        self.expected_stop.store(false, Ordering::SeqCst);
        self.health_confirmed.store(false, Ordering::SeqCst);
        lock_store(&self.last_stderr)?.clear();
        let mut generation = lock_store(&self.generation)?;
        *generation = generation.saturating_add(1);
        Ok(*generation)
    }

    /// Makes the current monitor stale without registering a new spawn (used
    /// when the supervisor kills an unhealthy child before retrying).
    pub(crate) fn invalidate_generation(&self) -> Result<u64, String> {
        let mut generation = lock_store(&self.generation)?;
        *generation = generation.saturating_add(1);
        Ok(*generation)
    }

    pub(crate) fn mark_expected_stop(&self) {
        self.expected_stop.store(true, Ordering::SeqCst);
    }

    /// The next start is deliberate (a retry), so a failure of that start is a
    /// real failure and must not be read as the stop that preceded it.
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
                if buffer.len() == LAST_STDERR_CAPACITY {
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
                let start = buffer.len().saturating_sub(LAST_STDERR_TAIL_LINES);
                buffer
                    .iter()
                    .skip(start)
                    .cloned()
                    .collect::<Vec<_>>()
                    .join("\n")
            }
            Err(_) => String::new(),
        };
        let redacted = redact_mini_backend_secrets(&tail);
        if redacted.len() <= LAST_STDERR_TAIL_CHARS {
            return redacted;
        }
        // Slice on a char boundary: a Python traceback tail is UTF-8 and may
        // split a box-drawing glyph at exactly this offset.
        let mut start = redacted.len() - LAST_STDERR_TAIL_CHARS;
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
        if self.app_exiting.load(Ordering::SeqCst)
            || self.expected_stop.load(Ordering::SeqCst)
        {
            return Ok(true);
        }
        Ok(self.restart_epoch()? != epoch)
    }
}

pub(crate) struct StartupGuard<'a>(&'a AtomicBool);

impl RestartStopReason {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::ExpectedStop => "expected stop",
            Self::AppExiting => "app is exiting",
            Self::SpawnError => "spawn error",
            Self::CrashLoop => "crash loop",
            Self::AttemptsExhausted => "attempt limit",
        }
    }
}

impl RestartTrigger {
    /// Human-readable cause, used verbatim in the runtime panel message.
    pub(crate) fn label(self) -> String {
        match self {
            Self::UnexpectedExit { code, .. } => format!(
                "exited unexpectedly (code {})",
                code.map_or_else(|| "unknown".to_string(), |value| value.to_string())
            ),
            Self::HealthTimeout => "did not become healthy in time".to_string(),
            Self::SpawnError => "could not be started".to_string(),
        }
    }

    pub(crate) fn exit_code(self) -> Option<i32> {
        match self {
            Self::UnexpectedExit { code, .. } => code,
            _ => None,
        }
    }

    /// Stable machine-readable code, mirroring the `lastError` values the
    /// Electron supervisor writes for the same failures.
    pub(crate) fn error_code(self) -> String {
        match self {
            Self::UnexpectedExit { code, .. } => format!(
                "mini_backend_exit_{}",
                code.map_or_else(|| "unknown".to_string(), |value| value.to_string())
            ),
            Self::HealthTimeout => "mini_backend_health_timeout".to_string(),
            Self::SpawnError => "mini_backend_spawn_error".to_string(),
        }
    }
}

/// Post-mortem file for one death: exit code plus the redacted stderr tail.
/// It lives in the app log directory, which `commands/bug_report.rs` already
/// archives, so a crash survives log rotation without a second collection
/// path. The file is rewritten per crash: one bounded post-mortem, not an
/// unbounded second copy of the live log.
fn write_crash_log<R: Runtime>(
    app: &AppHandle<R>,
    trigger: RestartTrigger,
    tail: &str,
) -> Option<String> {
    let dir = app.path().app_log_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    let path = dir.join(CRASH_LOG_FILE_NAME);
    let mut file = fs::File::create(&path).ok()?;
    let exit_code = trigger
        .exit_code()
        .map_or_else(|| "unknown".to_string(), |code| code.to_string());
    writeln!(
        file,
        "mini-backend {cause} at {timestamp}ms since epoch\nexit code: {exit_code}\n{tail}",
        cause = trigger.label(),
        timestamp = now_millis(),
        tail = if tail.is_empty() { "<no stderr captured>" } else { tail },
    )
    .ok()?;
    file.flush().ok()?;
    Some(path.to_string_lossy().to_string())
}

/// Record one sidecar death or failed start: publish the post-mortem, then
/// either schedule the next bounded attempt or stop recovering.
///
/// Exactly one owner folds each failure. A process that dies is folded by its
/// monitor (`Terminated`), because that event carries the exit code; a start
/// that times out with a live child, and a spawn that never produced a child,
/// are folded by `start_mini_backend`.
pub(crate) fn fold_sidecar_failure<R: Runtime + 'static>(
    app: &AppHandle<R>,
    trigger: RestartTrigger,
) -> Result<(), String> {
    let sidecar_store = app.state::<MiniBackendSidecarStore>();
    let decision = sidecar_store.evaluate_restart(now_millis(), trigger)?;
    let epoch = sidecar_store.restart_epoch()?;
    let tail = sidecar_store.stderr_tail();
    drop(sidecar_store);

    let crash_log_path = write_crash_log(app, trigger, &tail);
    let cause = trigger.label();
    let (status, attempt, message, retry_after) = match decision {
        RestartDecision::Restart { attempt, delay } => (
            "crashed",
            attempt,
            format!("Local backend {cause}; restart attempt {attempt} of {RESTART_MAX_ATTEMPTS}."),
            Some(delay),
        ),
        RestartDecision::Stop { reason, attempt } => (
            if reason == RestartStopReason::SpawnError {
                "error"
            } else {
                "crashed"
            },
            attempt,
            format!(
                "Local backend {cause}; automatic recovery stopped ({}).",
                reason.as_str()
            ),
            None,
        ),
    };
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
            status: Some(status.to_string()),
            status_message: Some(Some(message)),
            last_error: Some(Some(trigger.error_code())),
            attempt: Some(attempt),
            max_attempts: Some(RESTART_MAX_ATTEMPTS),
            exit_code: Some(trigger.exit_code()),
            last_stderr: Some(if tail.is_empty() { None } else { Some(tail) }),
            crash_log_path: Some(crash_log_path),
            progress: Some(None),
            ..Default::default()
        },
    )
    .map_err(|error| error.to_string())?;
    drop(runtime_store);

    if let Some(delay) = retry_after {
        schedule_restart(app.clone(), epoch, attempt, delay);
    }
    Ok(())
}

/// Sleep out the backoff, then run one recovery attempt on a fresh transition.
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
        drop(sidecar_store);
        if cancelled.unwrap_or(true) {
            log::info!("mini-backend: pending restart cancelled by a newer request");
            return;
        }
        if let Err(error) = run_restart_attempt(app.clone(), attempt).await {
            log::warn!("mini-backend: recovery attempt {attempt} failed: {error}");
        }
    });
}

/// One bounded recovery attempt. The failed child may still be alive and bound
/// to the port (a health timeout never kills it), so the attempt stops it
/// first; the generation token makes that kill's `Terminated` event inert.
async fn run_restart_attempt<R: Runtime + 'static>(
    app: AppHandle<R>,
    attempt: u32,
) -> Result<(), String> {
    // A start still in flight owns the transition; its own failure folding
    // schedules the next attempt, so this one stands down instead of
    // double-spawning.
    if !wait_until_start_settles(&app).await {
        log::info!("mini-backend: recovery stood down; another start owns the transition");
        return Ok(());
    }

    let sidecar_store = app.state::<MiniBackendSidecarStore>();
    sidecar_store.invalidate_generation()?;
    sidecar_store.mark_restart_intent();
    drop(sidecar_store);
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
    drop(runtime_store);

    start_mini_backend(app).await.map(|_| ())
}

/// Poll until no start holds the transition latch, bounded by
/// `RESTART_TRANSITION_TIMEOUT`. Returns false when the latch is still held at
/// the deadline.
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

impl Drop for StartupGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

/// Latch the app-exit state. Once set, no recovery attempt may be scheduled:
/// a sidecar that outlives the app would hold the port for the next launch.
pub fn mark_app_exiting<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    app.state::<MiniBackendSidecarStore>().mark_app_exiting()
}


#[cfg(test)]
mod tests {
    use super::*;

    fn exit(code: Option<i32>) -> RestartTrigger {
        RestartTrigger::UnexpectedExit {
            code,
            health_confirmed: false,
        }
    }

    fn healthy_exit(code: Option<i32>) -> RestartTrigger {
        RestartTrigger::UnexpectedExit {
            code,
            health_confirmed: true,
        }
    }

    #[test]
    fn expected_stop_and_app_exit_never_consume_the_restart_budget() {
        let mut policy = RestartPolicy::default();
        for (app_exiting, expected_stop, reason) in [
            (true, false, RestartStopReason::AppExiting),
            (false, true, RestartStopReason::ExpectedStop),
            (true, true, RestartStopReason::AppExiting),
        ] {
            let decision = policy.evaluate(1_000, exit(Some(-1)), expected_stop, app_exiting);
            assert_eq!(decision, RestartDecision::Stop { reason, attempt: 0 });
        }
        assert_eq!(policy.failed_attempts, 0);
    }

    #[test]
    fn backoff_doubles_from_250ms_and_is_capped_at_30s() {
        assert_eq!(RestartPolicy::backoff_delay(0), Duration::from_millis(250));
        assert_eq!(RestartPolicy::backoff_delay(3), Duration::from_millis(2_000));
        assert_eq!(RestartPolicy::backoff_delay(7), Duration::from_millis(RESTART_BACKOFF_MAX_MILLIS));
        // 1 << n would overflow long before the cap matters; the shift is
        // clamped so a pathological counter cannot panic.
        assert_eq!(
            RestartPolicy::backoff_delay(64),
            Duration::from_millis(RESTART_BACKOFF_MAX_MILLIS)
        );
    }

    #[test]
    fn five_restart_attempts_then_recovery_stops() {
        let mut policy = RestartPolicy::default();
        let delays: Vec<Duration> = (1..=5)
            .map(|_| match policy.evaluate(1_000, healthy_exit(Some(1)), false, false) {
                RestartDecision::Restart { delay, .. } => delay,
                stop => panic!("expected a restart, got {stop:?}"),
            })
            .collect();
        assert_eq!(
            delays,
            vec![
                Duration::from_millis(250),
                Duration::from_millis(500),
                Duration::from_millis(1_000),
                Duration::from_millis(2_000),
                Duration::from_millis(4_000),
            ]
        );
        // Exits and health timeouts share one budget, so a mixed sequence still
        // stops after five consumed attempts.
        assert_eq!(
            policy.evaluate(1_000, RestartTrigger::HealthTimeout, false, false),
            RestartDecision::Stop {
                reason: RestartStopReason::AttemptsExhausted,
                attempt: 6,
            }
        );
    }

    #[test]
    fn three_pre_health_crashes_in_window_stop_recovery_immediately() {
        let mut policy = RestartPolicy::default();
        assert!(matches!(
            policy.evaluate(0, exit(Some(1)), false, false),
            RestartDecision::Restart { attempt: 1, .. }
        ));
        assert!(matches!(
            policy.evaluate(40_000, exit(Some(1)), false, false),
            RestartDecision::Restart { attempt: 2, .. }
        ));
        // Third non-zero exit before `/health`, inside the rolling 120 s window.
        assert_eq!(
            policy.evaluate(80_000, exit(Some(-1)), false, false),
            RestartDecision::Stop {
                reason: RestartStopReason::CrashLoop,
                attempt: 2,
            }
        );
    }

    #[test]
    fn a_clean_exit_and_an_exit_after_health_do_not_build_a_crash_loop() {
        let mut policy = RestartPolicy::default();
        // Exit code 0 is not a crash: it never enters the rolling window.
        for at in [0, 10_000, 20_000] {
            assert!(matches!(
                policy.evaluate(at, exit(Some(0)), false, false),
                RestartDecision::Restart { .. }
            ));
        }
        policy.record_health_confirmed(40_000);
        // Exits from a generation that answered `/health` are not pre-health
        // crashes either; they only spend the attempt budget.
        for at in [41_000, 42_000] {
            assert!(matches!(
                policy.evaluate(at, healthy_exit(Some(-1)), false, false),
                RestartDecision::Restart { .. }
            ));
        }
        assert!(!policy.crash_loop_detected());
    }

    #[test]
    fn pre_health_crash_window_forgets_failures_older_than_120s() {
        let mut policy = RestartPolicy::default();
        assert!(matches!(
            policy.evaluate(0, exit(Some(1)), false, false),
            RestartDecision::Restart { .. }
        ));
        assert!(matches!(
            policy.evaluate(10_000, exit(Some(1)), false, false),
            RestartDecision::Restart { .. }
        ));
        // The two oldest failures have aged out of the rolling window, so this
        // crash is the only one still counted.
        assert!(matches!(
            policy.evaluate(200_000, exit(Some(1)), false, false),
            RestartDecision::Restart { .. }
        ));
        assert_eq!(policy.pre_health_failures_ms.len(), 1);
    }

    #[test]
    fn sixty_seconds_of_healthy_runtime_restores_the_whole_budget() {
        let mut policy = RestartPolicy::default();
        for at in [0, 1_000] {
            assert!(matches!(
                policy.evaluate(at, exit(Some(1)), false, false),
                RestartDecision::Restart { .. }
            ));
        }
        policy.record_health_confirmed(2_000);
        // 60 s of health is what clears the counters; 59 s does not.
        assert!(matches!(
            policy.evaluate(61_999, healthy_exit(Some(1)), false, false),
            RestartDecision::Restart { attempt: 3, .. }
        ));
        assert_eq!(
            policy.evaluate(63_000, healthy_exit(Some(1)), false, false),
            RestartDecision::Restart {
                attempt: 1,
                delay: Duration::from_millis(250),
            }
        );
    }

    #[test]
    fn spawn_error_is_a_one_shot_stop_and_health_timeout_retries() {
        let mut policy = RestartPolicy::default();
        assert_eq!(
            policy.evaluate(0, RestartTrigger::SpawnError, false, false),
            RestartDecision::Stop {
                reason: RestartStopReason::SpawnError,
                attempt: 1,
            }
        );
        let mut retrying = RestartPolicy::default();
        assert!(matches!(
            retrying.evaluate(0, RestartTrigger::HealthTimeout, false, false),
            RestartDecision::Restart { attempt: 1, .. }
        ));
    }

    #[test]
    fn a_restart_supersedes_the_previous_monitors_generation() {
        let store = MiniBackendSidecarStore::default();
        let first = store.record_spawn().expect("spawn registers");
        assert!(store.is_current_generation(first));
        let second = store.record_spawn().expect("restart registers");
        assert_ne!(first, second);
        assert!(
            !store.is_current_generation(first),
            "stale monitor must be inert"
        );
        assert!(store.is_current_generation(second));

        // Killing an unhealthy child before a retry invalidates its monitor
        // without registering a new process.
        let invalidated = store.invalidate_generation().expect("invalidate");
        assert!(!store.is_current_generation(second));
        assert!(store.is_current_generation(invalidated));
    }

    #[test]
    fn registering_a_spawn_clears_the_stop_latch_and_the_crash_tail() {
        let store = MiniBackendSidecarStore::default();
        store.record_spawn().expect("first spawn");
        store.push_stderr("RuntimeError: boom");
        store.mark_healthy(1_000).expect("health");
        assert!(store.health_confirmed());
        assert!(!store.stderr_tail().is_empty());

        // A deliberate stop followed by a fresh start must not report the
        // previous generation as healthy, expected, or still leaking stderr.
        store.mark_expected_stop();
        store.record_spawn().expect("restart");
        assert!(!store.health_confirmed());
        assert!(store.stderr_tail().is_empty());

        // The stop latch cleared by that start must not make a later crash look
        // like an expected stop.
        let decision = store
            .evaluate_restart(2_000, exit(Some(1)))
            .expect("decision");
        assert!(matches!(decision, RestartDecision::Restart { attempt: 1, .. }));
    }

    #[test]
    fn only_one_start_owns_the_transition() {
        let store = MiniBackendSidecarStore::default();
        assert!(!store.is_starting());
        let guard = store.lock_start().expect("first start wins the latch");
        assert!(store.is_starting());
        assert!(
            store.lock_start().is_none(),
            "second start must report AlreadyStarting"
        );
        drop(guard);
        assert!(!store.is_starting());
        assert!(store.lock_start().is_some());
    }

    #[test]
    fn a_newer_epoch_or_app_exit_cancels_a_pending_restart() {
        let store = MiniBackendSidecarStore::default();
        let epoch = store.restart_epoch().expect("epoch");
        assert!(!store.restart_cancelled(epoch).expect("cancellation"));
        let manual = store.cancel_restart_supervisor().expect("bump");
        assert!(store.restart_cancelled(epoch).expect("stale supervisor aborts"));
        assert!(!store.restart_cancelled(manual).expect("newest supervisor runs"));

        store.mark_expected_stop();
        assert!(store.restart_cancelled(manual).expect("a stop cancels recovery"));
        store.mark_restart_intent();
        assert!(!store.restart_cancelled(manual).expect("a retry is not a stop"));

        store.mark_app_exiting().expect("app exit latch");
        assert!(store.restart_cancelled(manual).expect("app exit cancels recovery"));
    }

    #[test]
    fn crash_tail_keeps_the_last_lines_and_stays_inside_the_char_budget() {
        let store = MiniBackendSidecarStore::default();
        for line in 0..(LAST_STDERR_CAPACITY + 20) {
            store.push_stderr(&format!("line {line}"));
        }
        let tail = store.stderr_tail();
        let lines: Vec<&str> = tail.lines().collect();
        assert_eq!(lines.len(), LAST_STDERR_TAIL_LINES);
        assert_eq!(
            lines.first().copied(),
            Some("line 20"),
            "the ring must drop the oldest lines, not the newest"
        );
        assert_eq!(lines.last().copied(), Some("line 69"));

        let big = MiniBackendSidecarStore::default();
        big.push_stderr(&"x".repeat(LAST_STDERR_TAIL_CHARS * 2));
        assert_eq!(big.stderr_tail().len(), LAST_STDERR_TAIL_CHARS);
    }

    #[test]
    fn redacts_credentials_from_a_crash_tail() {
        assert_eq!(
            redact_mini_backend_secrets("using sk-AbCdEf123456 for openai"),
            "using sk-[redacted] for openai"
        );
        assert_eq!(
            redact_mini_backend_secrets("Authorization: Bearer AAA.BBB_ccc"),
            "Authorization: Bearer [redacted]"
        );
        assert_eq!(
            redact_mini_backend_secrets("GET /translate?api_key=supersecret&model=x"),
            "GET /translate?api_key=[redacted]&model=x"
        );
        assert_eq!(
            redact_mini_backend_secrets("token: 'quoted secret' done"),
            "token: [redacted] done"
        );
        // Positive controls: unrelated text and a too-short sk- run survive.
        assert_eq!(
            redact_mini_backend_secrets("Traceback: cv2.imencode failed with sk-ab"),
            "Traceback: cv2.imencode failed with sk-ab"
        );
    }

    #[test]
    fn startup_guard_releases_the_latch_on_drop() {
        let flag = AtomicBool::new(false);
        assert!(flag
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok());
        {
            let _guard = StartupGuard(&flag);
            // A second start must be refused while the guard is alive.
            assert!(flag
                .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                .is_err());
        }
        // Any exit path (success, `?`, panic unwind) re-arms the latch.
        assert!(!flag.load(Ordering::SeqCst));
    }

}
