use super::policy::RESTART_BACKOFF_MAX_MILLIS;
use super::*;
use crate::sidecar::failure_report::RestartStopReason;

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
    assert_eq!(
        RestartPolicy::backoff_delay(3),
        Duration::from_millis(2_000)
    );
    assert_eq!(
        RestartPolicy::backoff_delay(7),
        Duration::from_millis(RESTART_BACKOFF_MAX_MILLIS)
    );
    assert_eq!(
        RestartPolicy::backoff_delay(64),
        Duration::from_millis(RESTART_BACKOFF_MAX_MILLIS)
    );
}

#[test]
fn five_restart_attempts_then_recovery_stops() {
    let mut policy = RestartPolicy::default();
    let delays: Vec<Duration> = (1..=5)
        .map(
            |_| match policy.evaluate(1_000, healthy_exit(Some(1)), false, false) {
                RestartDecision::Restart { delay, .. } => delay,
                stop => panic!("expected a restart, got {stop:?}"),
            },
        )
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
    for at in [0, 10_000, 20_000] {
        assert!(matches!(
            policy.evaluate(at, exit(Some(0)), false, false),
            RestartDecision::Restart { .. }
        ));
    }
    policy.record_health_confirmed(40_000);
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

    store.mark_expected_stop();
    store.record_spawn().expect("restart");
    assert!(!store.health_confirmed());
    assert!(store.stderr_tail().is_empty());

    let decision = store
        .evaluate_restart(2_000, exit(Some(1)))
        .expect("decision");
    assert!(matches!(
        decision,
        RestartDecision::Restart { attempt: 1, .. }
    ));
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
    assert!(
        store
            .restart_cancelled(epoch)
            .expect("stale supervisor aborts")
    );
    assert!(
        !store
            .restart_cancelled(manual)
            .expect("newest supervisor runs")
    );

    store.mark_expected_stop();
    assert!(
        store
            .restart_cancelled(manual)
            .expect("a stop cancels recovery")
    );
    store.mark_restart_intent();
    assert!(
        !store
            .restart_cancelled(manual)
            .expect("a retry is not a stop")
    );

    store.mark_app_exiting().expect("app exit latch");
    assert!(
        store
            .restart_cancelled(manual)
            .expect("app exit cancels recovery")
    );
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
    assert_eq!(
        redact_mini_backend_secrets("Traceback: cv2.imencode failed with sk-ab"),
        "Traceback: cv2.imencode failed with sk-ab"
    );
}

#[test]
fn startup_guard_releases_the_latch_on_drop() {
    let flag = AtomicBool::new(false);
    assert!(
        flag.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
    );
    {
        let _guard = StartupGuard(&flag);
        assert!(
            flag.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                .is_err()
        );
    }
    assert!(!flag.load(Ordering::SeqCst));
}
