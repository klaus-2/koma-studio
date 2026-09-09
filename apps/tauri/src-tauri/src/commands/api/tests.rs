use super::client::{api_error, stable_hash};
use super::integrations::{deep_link_to_hash_route, extract_deep_link_from_args};

#[test]
fn api_error_uses_desktop_envelope_shape() {
    let envelope = api_error(400, "bad");
    assert!(!envelope.ok);
    assert_eq!(envelope.status, 400);
    assert_eq!(
        envelope
            .payload
            .as_ref()
            .and_then(|value| value.get("error"))
            .and_then(serde_json::Value::as_str),
        Some("bad")
    );
}

#[test]
fn stable_hash_separates_namespaces() {
    assert_ne!(stable_hash("a", "source"), stable_hash("b", "source"));
}

#[test]
fn deep_link_extract_decodes_protocol_argument() {
    let link =
        extract_deep_link_from_args([String::from("x=komastudio%3Asettings%3Ftab%3Daccount")]);
    assert_eq!(link, Some("komastudio://settings?tab=account".to_string()));
    assert_eq!(
        deep_link_to_hash_route(link.as_deref().unwrap()),
        Some("/settings?tab=account".to_string())
    );
}
