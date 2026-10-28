//! Dotenv document parsing with the same public-key allowlist as every
//! other configuration source.

use std::collections::HashMap;

use super::config_sources::is_public_desktop_config_key;

/// Parses a dotenv document. Within a single file the last non-empty
/// assignment of a key wins; non-public keys are dropped.
pub(super) fn parse_env_document(raw: &str) -> HashMap<String, String> {
    let mut document = HashMap::new();

    for (key, value) in raw.lines().filter_map(parse_env_line) {
        if value.is_empty() || !is_public_desktop_config_key(key) {
            continue;
        }

        document.insert(key.to_owned(), value.to_owned());
    }

    document
}

pub(super) fn parse_env_line(line: &str) -> Option<(&str, &str)> {
    let trimmed = line.trim();

    if trimmed.is_empty() || trimmed.starts_with('#') {
        return None;
    }

    let trimmed = trimmed
        .strip_prefix("export ")
        .map_or(trimmed, str::trim);

    let (key, value) = trimmed.split_once('=')?;
    let key = key.trim();

    if !is_public_desktop_config_key(key) {
        return None;
    }

    Some((key, parse_env_value(value)?))
}

/// dotenv value semantics: quoted values must close their quote; unquoted
/// values end at the first `#` preceded by whitespace (inline comment).
fn parse_env_value(raw_value: &str) -> Option<&str> {
    let raw_value = raw_value.trim();

    for quote in ['"', '\''] {
        if let Some(inner) = raw_value.strip_prefix(quote) {
            let end = inner.find(quote)?;
            let trailing = inner[end + quote.len_utf8()..].trim();

            if !trailing.is_empty() && !trailing.starts_with('#') {
                return None;
            }

            return Some(&inner[..end]);
        }
    }

    let end = raw_value
        .match_indices('#')
        .find(|(index, _)| {
            *index == 0
                || raw_value[..*index].ends_with(char::is_whitespace)
        })
        .map_or(raw_value.len(), |(index, _)| index);

    Some(raw_value[..end].trim())
}
