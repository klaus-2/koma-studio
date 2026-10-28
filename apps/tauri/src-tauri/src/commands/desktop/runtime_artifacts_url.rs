//! Runtime artifacts feed normalization: a base feed URL is either used
//! verbatim (manifest, GitHub release assets) or gets the channel appended.

use super::config_sources::{ConfigSources, UpdateChannel};
use super::url_validation::parse_https_url;
use super::{DEFAULT_RUNTIME_ARTIFACTS_URL, RUNTIME_ARTIFACTS_ENV_KEYS};

pub(super) fn resolve_runtime_artifacts_url(sources: &ConfigSources) -> String {
    RUNTIME_ARTIFACTS_ENV_KEYS
        .iter()
        .find_map(|key| sources.resolve(key))
        .map_or_else(
            || default_runtime_artifacts_url(),
            |raw| normalize_runtime_artifacts_url(&raw, sources.channel),
        )
}

pub(super) fn default_runtime_artifacts_url() -> String {
    DEFAULT_RUNTIME_ARTIFACTS_URL.to_string()
}

pub(super) fn normalize_runtime_artifacts_url(raw_url: &str, channel: UpdateChannel) -> String {
    let trimmed = raw_url.trim();

    let Ok(mut parsed) = parse_https_url(trimmed) else {
        tracing::warn!(
            operation = "resolve_runtime_artifacts_url",
            "invalid artifacts endpoint; using the default feed"
        );

        return default_runtime_artifacts_url();
    };

    // A direct manifest URL is used verbatim.
    if parsed.path().to_ascii_lowercase().ends_with(".json") {
        return trimmed.to_owned();
    }

    // GitHub release assets are flat: appending the release channel would
    // point at a directory that does not exist.
    if parsed.host_str() == Some("github.com") && parsed.path().contains("/releases/") {
        parsed.set_query(None);
        parsed.set_fragment(None);
        if !parsed.path().ends_with('/') {
            let path = format!("{}/", parsed.path());
            parsed.set_path(&path);
        }
        return parsed.to_string();
    }

    let path = normalize_runtime_artifacts_path(parsed.path(), channel);
    parsed.set_path(&path);
    parsed.to_string()
}

fn normalize_runtime_artifacts_path(path: &str, channel: UpdateChannel) -> String {
    // Match the segment itself, with or without a trailing slash: a path
    // ending in "mini-backend-artifacts" must not get a duplicate channel
    // segment appended.
    if path.to_ascii_lowercase().contains("mini-backend-artifacts") {
        return if path.ends_with('/') {
            path.to_owned()
        } else {
            format!("{path}/")
        };
    }

    let mut segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();
    match segments.last_mut() {
        Some(last) if UpdateChannel::from_segment(last).is_some() => *last = channel.as_str(),
        _ => segments.push(channel.as_str()),
    }

    let mut normalized = String::with_capacity(path.len() + 8);
    for segment in segments {
        normalized.push('/');
        normalized.push_str(segment);
    }
    normalized.push('/');
    normalized
}
