//! How a sidecar failure is reported to the runtime panel.
//!
//! The projection lives outside `recovery.rs` on purpose: it is the decision
//! that decides whether the user sees a crash or a plain stop, and it is pure
//! enough to test without an app handle.

use std::time::Duration;

use super::recovery::{RestartDecision, RestartStopReason, RESTART_MAX_ATTEMPTS};

/// What the runtime panel shows for one folded failure.
pub(crate) struct FailureReport {
    pub(crate) status: &'static str,
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
pub(crate) fn describe_failure(decision: &RestartDecision, cause: &str) -> FailureReport {
    match decision {
        RestartDecision::Restart { attempt, delay } => FailureReport {
            status: "crashed",
            message: format!(
                "Local backend {cause}; restart attempt {attempt} of {RESTART_MAX_ATTEMPTS}."
            ),
            retry_after: Some(*delay),
            expected_stop: false,
        },
        RestartDecision::Stop { reason, attempt: _ } => {
            let expected_stop = matches!(
                reason,
                RestartStopReason::ExpectedStop | RestartStopReason::AppExiting
            );
            let (status, message) = if expected_stop {
                ("stopped", "Local backend stopped.".to_string())
            } else {
                let status = if *reason == RestartStopReason::SpawnError {
                    "error"
                } else {
                    "crashed"
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
            let report = describe_failure(&decision, "exited unexpectedly (code 1)");
            assert!(report.expected_stop, "{reason:?} must count as a deliberate stop");
            assert_eq!(report.status, "stopped");
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
        let report = describe_failure(&decision, "exited unexpectedly (code 1)");
        assert!(!report.expected_stop);
        assert_eq!(report.status, "crashed");
        assert!(report.message.contains("automatic recovery stopped (crash loop)"));

        let decision = RestartDecision::Restart {
            attempt: 1,
            delay: Duration::from_millis(250),
        };
        let report = describe_failure(&decision, "exited unexpectedly (code 1)");
        assert!(!report.expected_stop);
        assert_eq!(report.status, "crashed");
        assert_eq!(report.retry_after, Some(Duration::from_millis(250)));
    }
}
