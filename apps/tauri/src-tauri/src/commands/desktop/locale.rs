//! System locale tag normalization.

pub(super) fn normalize_locale_tag(raw: &str) -> Option<String> {
    let tag = raw
        .trim()
        .split(['.', '@', ':'])
        .next()?
        .replace('_', "-");
    if tag.is_empty() || tag.eq_ignore_ascii_case("c") || tag.eq_ignore_ascii_case("posix") {
        None
    } else {
        Some(tag)
    }
}
