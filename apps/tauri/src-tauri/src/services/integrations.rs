//! Deep links with a strict route/parameter allowlist. Only known routes with
//! known query keys pass validation; logs never receive query values.

use std::borrow::Cow;

use percent_encoding::percent_decode_str;
use url::{Url, form_urlencoded};

const APP_PROTOCOL: &str = "komastudio";
const PROTOCOL_WITH_COLON: &str = "komastudio:";
const PROTOCOL_WITH_SLASHES: &str = "komastudio://";
const MAX_DEEP_LINK_BYTES: usize = 8192;
const MAX_ARGUMENTS: usize = 64;
/// The widest allowlisted route accepts two keys; anything past this bound is
/// hostile or malformed and gets rejected before per-pair validation runs.
const MAX_QUERY_PAIRS: usize = 8;

#[derive(Debug, Clone, PartialEq, Eq)]
struct ValidatedDeepLink {
    canonical_url: String,
    hash_route: String,
    log_value: String,
}

pub fn extract_deep_link_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter()
        .take(MAX_ARGUMENTS)
        .filter(|argument| argument.len() <= MAX_DEEP_LINK_BYTES)
        .find_map(|argument| normalize_deep_link_argument(&argument))
}

pub fn deep_link_to_hash_route(value: &str) -> Option<String> {
    validate_deep_link(value).map(|link| link.hash_route)
}

pub fn format_deep_link_for_log(value: &str) -> String {
    validate_deep_link(value)
        .map(|link| link.log_value)
        .unwrap_or_else(|| "<invalid-deep-link>".to_string())
}

fn normalize_deep_link_argument(raw: &str) -> Option<String> {
    let raw = raw.trim().trim_matches('"');

    if let Some(candidate) = candidate_from_argument(raw) {
        if let Some(validated) = validate_deep_link(&candidate) {
            return Some(validated.canonical_url);
        }
    }

    let decoded = percent_decode_str(raw).decode_utf8().ok()?;
    let candidate = candidate_from_argument(&decoded)?;
    validate_deep_link(&candidate).map(|link| link.canonical_url)
}

fn candidate_from_argument(raw: &str) -> Option<String> {
    // `to_ascii_lowercase` preserves byte offsets, so the index found in the
    // lowered copy is valid for slicing the original string.
    let lower = raw.to_ascii_lowercase();
    let index = lower.find(PROTOCOL_WITH_COLON)?;
    let mut candidate = raw[index..].trim().to_string();

    if !candidate
        .to_ascii_lowercase()
        .starts_with(PROTOCOL_WITH_SLASHES)
    {
        let suffix = candidate
            .split_once(':')
            .map(|(_, suffix)| suffix)
            .unwrap_or_default()
            .trim_start_matches('/');

        candidate = format!("{PROTOCOL_WITH_SLASHES}{suffix}");
    }

    Some(candidate)
}

fn validate_deep_link(value: &str) -> Option<ValidatedDeepLink> {
    if value.is_empty()
        || value.len() > MAX_DEEP_LINK_BYTES
        || value.chars().any(char::is_control)
    {
        return None;
    }

    let parsed = Url::parse(value).ok()?;
    if parsed.scheme() != APP_PROTOCOL
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.port().is_some()
        || parsed.fragment().is_some()
    {
        return None;
    }

    let route = route_name(&parsed)?;
    let pairs: Vec<(Cow<'_, str>, Cow<'_, str>)> = parsed.query_pairs().collect();
    if pairs.len() > MAX_QUERY_PAIRS {
        return None;
    }

    validate_query(&route, &pairs)?;

    let mut serializer = form_urlencoded::Serializer::new(String::new());
    for (key, value) in &pairs {
        serializer.append_pair(key, value);
    }
    let query = serializer.finish();

    let suffix = if query.is_empty() {
        String::new()
    } else {
        format!("?{query}")
    };

    Some(ValidatedDeepLink {
        canonical_url: format!("{APP_PROTOCOL}://{route}{suffix}"),
        hash_route: format!("/{route}{suffix}"),
        log_value: format!("{APP_PROTOCOL}://{route}"),
    })
}

fn route_name(parsed: &Url) -> Option<String> {
    let host = parsed.host_str().unwrap_or_default().trim();
    let path = parsed.path().trim_matches('/');

    let route = if !host.is_empty() {
        if !path.is_empty() {
            return None;
        }
        host
    } else {
        if path.contains('/') {
            return None;
        }
        path
    }
    .to_ascii_lowercase();

    matches!(
        route.as_str(),
        "settings" | "confirm-email" | "reset-password" | "login" | "travel-token"
    )
    .then_some(route)
}

fn validate_query(route: &str, pairs: &[(Cow<'_, str>, Cow<'_, str>)]) -> Option<()> {
    let mut keys = std::collections::HashSet::new();

    for (key, value) in pairs {
        if !keys.insert(key.as_ref()) {
            return None;
        }

        if value.is_empty() || value.len() > 4096 || value.chars().any(char::is_control) {
            return None;
        }

        let valid = match route {
            "settings" => {
                key == "tab"
                    && matches!(
                        value.as_ref(),
                        "general" | "account" | "appearance" | "integrations" | "updater"
                    )
            }
            "confirm-email" | "reset-password" | "travel-token" => key == "token",
            "login" => key == "token" || key == "travelToken",
            _ => false,
        };

        if !valid {
            return None;
        }
    }

    let required = match route {
        "settings" => true,
        "confirm-email" | "reset-password" | "travel-token" => keys.contains("token"),
        "login" => true,
        _ => false,
    };

    required.then_some(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_allowlisted_deep_link() {
        assert_eq!(
            deep_link_to_hash_route("komastudio://settings?tab=account"),
            Some("/settings?tab=account".to_string())
        );
    }

    #[test]
    fn rejects_unknown_route() {
        assert_eq!(
            deep_link_to_hash_route("komastudio://arbitrary?token=x"),
            None
        );
    }

    #[test]
    fn rejects_unknown_query_keys() {
        assert_eq!(
            deep_link_to_hash_route("komastudio://settings?tab=account&extra=1"),
            None
        );
    }

    #[test]
    fn removes_secrets_from_log_format() {
        assert_eq!(
            format_deep_link_for_log("komastudio://confirm-email?token=secret"),
            "komastudio://confirm-email"
        );
    }

    #[test]
    fn extracts_percent_encoded_argument() {
        let link = extract_deep_link_from_args([String::from(
            "x=komastudio%3Asettings%3Ftab%3Daccount",
        )]);
        assert_eq!(
            link.as_deref(),
            Some("komastudio://settings?tab=account")
        );
    }

    #[test]
    fn protocol_constants_are_consistent() {
        assert_eq!(PROTOCOL_WITH_COLON, format!("{APP_PROTOCOL}:"));
        assert_eq!(PROTOCOL_WITH_SLASHES, format!("{APP_PROTOCOL}://"));
    }

    #[test]
    fn rejects_excessive_query_pairs() {
        let query: String = (0..=MAX_QUERY_PAIRS)
            .map(|index| format!("token=v{index}"))
            .collect::<Vec<_>>()
            .join("&");
        assert_eq!(
            deep_link_to_hash_route(&format!("komastudio://login?{query}")),
            None
        );
    }
}
