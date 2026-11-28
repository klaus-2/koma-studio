use super::*;
use serde_json::json;

#[test]
fn parses_activity_payload_aliases_and_buttons() {
    let payload = activity_from_value(&json!({
        "details": "Working",
        "largeImage": "logo",
        "smallText": "Mode",
        "startTimestamp": 10,
        "buttons": [
            { "label": "Site", "url": "https://koma-studio.site" },
            { "label": "Bad", "url": "javascript:alert(1)" },
            { "label": "Second", "url": "https://github.com/klaus-2/koma-studio" },
            { "label": "Third", "url": "https://example.com" }
        ]
    }));
    assert_eq!(payload.details.as_deref(), Some("Working"));
    assert_eq!(payload.large_image_key.as_deref(), Some("logo"));
    assert_eq!(payload.small_image_text.as_deref(), Some("Mode"));
    assert_eq!(payload.start_timestamp, Some(10));
    assert_eq!(payload.buttons.len(), 2);
    assert_eq!(payload.buttons[0].label, "Site");
    assert_eq!(payload.buttons[1].label, "Second");
}

#[test]
fn preset_keys_round_trip() {
    assert_eq!(Preset::ALL.len(), 23);
    for preset in Preset::ALL {
        assert_eq!(Preset::parse(preset.key()), Some(preset));
    }
    assert_eq!(Preset::parse("dashboard"), Some(Preset::WorkspaceIdle));
    assert_eq!(Preset::parse("unknown"), None);
    assert_eq!(preset_assets().len(), Preset::ALL.len() + 1);
}

#[test]
fn deduplicates_identical_activity_content() {
    let a = Preset::Translator.activity();
    let mut b = Preset::Translator.activity();
    b.start_timestamp = Some(999);
    assert!(a.same_content(&b));

    let c = Preset::Batch.activity();
    assert!(!a.same_content(&c));
}

#[test]
fn next_deadline_reconnects_even_without_pending_update() {
    let mut worker = PresenceWorker::new("id".into(), Arc::new(AtomicBool::new(false)));
    assert!(worker.next_deadline().is_none());

    worker.enabled = true;
    assert!(worker.next_deadline().is_some());
}

#[test]
fn resolve_client_id_falls_back_to_default() {
    assert!(!resolve_client_id().is_empty());
}

#[test]
fn disabled_presence_stays_off_and_reports_worker_gone() {
    let presence = DiscordPresence::disabled();
    assert!(!presence.is_enabled());
    assert!(!presence.is_connected());

    let runtime = tokio::runtime::Builder::new_current_thread()
        .build()
        .expect("failed to build the test runtime");
    let result = runtime.block_on(presence.enable());
    assert!(matches!(result, Err(PresenceError::WorkerGone)));
    assert!(!presence.is_enabled());
}

#[test]
fn worker_coalesces_bursts_and_reapplies_on_enable() {
    let mut worker = PresenceWorker::new("id".into(), Arc::new(AtomicBool::new(false)));
    worker.handle(PresenceCommand::SetActivity(Box::new(
        Preset::Idle.activity(),
    )));
    worker.handle(PresenceCommand::SetActivity(Box::new(
        Preset::Batch.activity(),
    )));
    assert_eq!(
        worker.pending.as_ref().and_then(|a| a.details.as_deref()),
        Some("Batch Processing")
    );

    worker.handle(PresenceCommand::Disable);
    assert!(worker.pending.is_none() && worker.current.is_none());

    worker.handle(PresenceCommand::SetActivity(Box::new(
        Preset::Settings.activity(),
    )));
    let (reply, _rx) = oneshot::channel();
    worker.handle(PresenceCommand::Enable(reply));
    assert!(worker.enabled);
    assert_eq!(
        worker.pending.as_ref().and_then(|a| a.details.as_deref()),
        Some("Preferences")
    );
}
