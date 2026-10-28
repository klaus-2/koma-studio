//! URL policy primitives: strict HTTPS parsing for external links and
//! loopback-only parsing for the local backend probe.

use std::collections::HashSet;

use url::{Host, Url};

use super::{DesktopError, DEFAULT_LOCAL_API_URL, MAX_URL_BYTES};

/// Strict HTTPS policy for externally opened URLs: standard port only,
/// no credentials, public domains only (static allowlist decides access).
pub(super) fn parse_https_url(raw_url: &str) -> Result<Url, DesktopError> {
    if raw_url.len() > MAX_URL_BYTES {
        return Err(DesktopError::UrlTooLong);
    }

    let trimmed = raw_url.trim();

    if trimmed.is_empty() {
        return Err(DesktopError::MissingUrl);
    }

    if trimmed.chars().any(char::is_control) || trimmed.contains('\\') {
        return Err(DesktopError::InvalidUrl);
    }

    let parsed =
        Url::parse(trimmed).map_err(|_| DesktopError::InvalidUrl)?;

    if parsed.scheme() != "https" {
        return Err(DesktopError::InsecureScheme);
    }

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(DesktopError::EmbeddedCredentials);
    }

    if parsed.port_or_known_default() != Some(443) {
        return Err(DesktopError::PortNotAllowed);
    }

    match parsed.host() {
        Some(Host::Domain(domain)) if is_public_domain(domain) => Ok(parsed),
        _ => Err(DesktopError::HostNotAllowed),
    }
}

/// Only true loopback targets may be probed: literal IPv4/IPv6 loopback or
/// the `localhost` name (normalised to `127.0.0.1` so no DNS lookup runs).
pub(super) fn parse_loopback_url(raw_url: &str) -> Result<Url, DesktopError> {
    if raw_url.len() > MAX_URL_BYTES {
        return Err(DesktopError::UrlTooLong);
    }

    let mut parsed =
        Url::parse(raw_url.trim()).map_err(|_| DesktopError::InvalidLoopbackUrl)?;

    if !matches!(parsed.scheme(), "http" | "https")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || parsed.port() == Some(0)
    {
        return Err(DesktopError::InvalidLoopbackUrl);
    }

    match parsed.host() {
        Some(Host::Ipv4(address)) if address.is_loopback() => {}
        Some(Host::Ipv6(address)) if address.is_loopback() => {}
        Some(Host::Domain(domain))
            if domain.eq_ignore_ascii_case("localhost")
                || domain.eq_ignore_ascii_case("localhost.") =>
        {
            parsed
                .set_host(Some("127.0.0.1"))
                .map_err(|_| DesktopError::InvalidLoopbackUrl)?;
        }
        _ => return Err(DesktopError::InvalidLoopbackUrl),
    }

    Ok(parsed)
}

pub(super) fn host_matches_suffix(host: &str, suffix: &str) -> bool {
    host == suffix
        || host
            .strip_suffix(suffix)
            .is_some_and(|prefix| prefix.ends_with('.'))
}

fn is_public_domain(domain: &str) -> bool {
    let host = normalize_host(domain);

    let reserved_suffixes = [
        "localhost",
        "local",
        "internal",
        "home.arpa",
        "test",
        "invalid",
        "example",
        "onion",
    ];

    host.contains('.')
        && !reserved_suffixes
            .iter()
            .any(|suffix| host_matches_suffix(&host, suffix))
}

pub(super) fn insert_url_host(hosts: &mut HashSet<String>, raw_url: &str) {
    if let Ok(parsed) = parse_https_url(raw_url) {
        if let Some(host) = parsed.host_str() {
            hosts.insert(normalize_host(host));
        }
    }
}

pub(super) fn normalize_loopback_url(raw_url: &str) -> String {
    match parse_loopback_url(raw_url) {
        Ok(parsed) => parsed
            .to_string()
            .trim_end_matches('/')
            .to_owned(),
        Err(error) => {
            tracing::warn!(
                operation = "resolve_local_backend_url",
                error_code = ?error,
                "invalid local backend configuration; using default"
            );

            DEFAULT_LOCAL_API_URL.to_owned()
        }
    }
}

pub(super) fn normalize_host(host: &str) -> String {
    host.trim().trim_end_matches('.').to_ascii_lowercase()
}
