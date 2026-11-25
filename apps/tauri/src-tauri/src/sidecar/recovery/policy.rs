use std::time::Duration;

use crate::sidecar::failure_report::{RestartDecision, RestartStopReason};

pub(crate) const RESTART_BACKOFF_BASE_MILLIS: u64 = 250;
pub(crate) const RESTART_BACKOFF_MAX_MILLIS: u64 = 30_000;
pub(crate) const RESTART_MAX_ATTEMPTS: u32 = 5;
pub(crate) const RESTART_HEALTHY_RESET_MS: u64 = 60_000;
pub(crate) const CRASH_LOOP_WINDOW_MS: u64 = 120_000;
pub(crate) const CRASH_LOOP_PRE_HEALTH_EXITS: usize = 3;
pub(crate) const RESTART_TRANSITION_TIMEOUT: Duration = Duration::from_secs(300);
pub(crate) const RESTART_TRANSITION_POLL_INTERVAL: Duration = Duration::from_millis(250);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StartOutcome {
    Started,
    AlreadyStarting,
    AlreadyRunning,
    NoRuntime,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RestartTrigger {
    UnexpectedExit {
        code: Option<i32>,
        health_confirmed: bool,
    },
    HealthTimeout,
    SpawnError,
}

impl RestartTrigger {
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

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub(crate) struct RestartPolicy {
    pub(crate) failed_attempts: u32,
    pub(crate) pre_health_failures_ms: std::collections::VecDeque<u64>,
    healthy_since_ms: Option<u64>,
}

impl RestartPolicy {
    pub(crate) fn record_health_confirmed(&mut self, now_ms: u64) {
        self.healthy_since_ms = Some(now_ms);
    }

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
