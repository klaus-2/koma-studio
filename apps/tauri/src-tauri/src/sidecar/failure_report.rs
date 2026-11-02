//! How a sidecar failure is reported to the runtime panel.
//!
//! The projection lives outside `recovery.rs` on purpose: it is the decision
//! that decides whether the user sees a crash or a plain stop, and it is pure
//! enough to test without an app handle.

use std::time::Duration;

/// How a restart attempt ended.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum RestartDecision {
    Restart { attempt: u32, delay: Duration },
    /// `attempt` is the number of failed attempts already consumed, so a
    /// stopped recovery reports the same budget the UI saw while retrying.
    Stop { reason: RestartStopReason, attempt: u32 },
}

/// Why recovery stopped instead of trying again.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RestartStopReason {
    ExpectedStop,
    AppExiting,
    SpawnError,
    CrashLoop,
    AttemptsExhausted,
}

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

/// How the runtime panel reads the failure.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum FailureStatus {
    Crashed,
    Stopped,
    Error,
}

impl FailureStatus {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Crashed => "crashed",
            Self::Stopped => "stopped",
            Self::Error => "error",
        }
    }
}

/// What the runtime panel shows for one folded failure.
pub(crate) struct FailureReport {
    pub(crate) status: FailureStatus,
    pub(crate) message: String,
    pub(crate) retry_after: Option<Duration>,
    /// A deliberate stop is not a crash: no post-mortem, no error code.
    pub(crate) expected_stop: bool,
}

/// Project a restart decision into the runtime-panel state.
///
/// A deliberate stop (the app is closing, or the shell asked for a profile
/// switch) must not look like a crash: the panel said "Local backend exited
/// unexpectedly (code 1); automatic recovery stopped (expected stop)" and a
/// post-mortem file was written for every ordinary shutdown.
pub(crate) fn describe_failure(
    decision: &RestartDecision,
    cause: &str,
    max_attempts: u32,
) -> FailureReport {
    match decision {
        RestartDecision::Restart { attempt, delay } => FailureReport {
            status: FailureStatus::Crashed,
            message: format!("Local backend {cause}; restart attempt {attempt} of {max_attempts}."),
            retry_after: Some(*delay),
            expected_stop: false,
        },
        RestartDecision::Stop { reason, attempt: _ } => {
            let expected_stop = matches!(
                reason,
                RestartStopReason::ExpectedStop | RestartStopReason::AppExiting
            );
            let (status, message) = if expected_stop {
                (FailureStatus::Stopped, "Local backend stopped.".to_string())
            } else {
                let status = if *reason == RestartStopReason::SpawnError {
                    FailureStatus::Error
                } else {
                    FailureStatus::Crashed
                };
                (
                    status,
                    format!(
                        "Local backend {cause}; automatic recovery stopped ({}).",
                        reason.as_str()
                    ),
                )
            };
            FailureReport {
                status,
                message,
                retry_after: None,
                expected_stop,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_deliberate_stop_is_not_reported_as_a_crash() {
        for reason in [
            RestartStopReason::ExpectedStop,
            RestartStopReason::AppExiting,
        ] {
            let decision = RestartDecision::Stop { reason, attempt: 0 };
            let report = describe_failure(&decision, "exited unexpectedly (code 1)", 5);
            assert!(report.expected_stop, "{reason:?} must count as a deliberate stop");
            assert_eq!(report.status, FailureStatus::Stopped);
            assert_eq!(report.message, "Local backend stopped.");
            assert!(report.retry_after.is_none());
        }
    }

    #[test]
    fn a_real_crash_keeps_the_crash_report() {
        let decision = RestartDecision::Stop {
            reason: RestartStopReason::CrashLoop,
            attempt: 3,
        };
        let report = describe_failure(&decision, "exited unexpectedly (code 1)", 5);
        assert!(!report.expected_stop);
        assert_eq!(report.status, FailureStatus::Crashed);
        assert!(report.message.contains("automatic recovery stopped (crash loop)"));

        let decision = RestartDecision::Restart {
            attempt: 1,
            delay: Duration::from_millis(250),
        };
        let report = describe_failure(&decision, "exited unexpectedly (code 1)", 5);
        assert!(!report.expected_stop);
        assert_eq!(report.status, FailureStatus::Crashed);
        assert_eq!(report.retry_after, Some(Duration::from_millis(250)));
    }
}
