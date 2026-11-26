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

    let json =
        serde_json::to_value(UpdaterTransition::NotAvailable { checked_at: 1 }).expect("serialize");
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
    assert_eq!(
        updater_feed_override("stable").expect("stable parses"),
        None
    );
    assert_eq!(
        updater_feed_override("canary").expect("unknown parses"),
        None
    );
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
fn support_gate_matches_desktop_updater_policy() {
    assert!(
        !is_supported_runtime(true, true),
        "dev builds are never supported"
    );
    assert!(
        !is_supported_runtime(false, false),
        "unsupported OS stays disabled"
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
