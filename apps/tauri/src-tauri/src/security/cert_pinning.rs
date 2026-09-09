use std::{
    collections::{BTreeMap, BTreeSet},
    sync::Arc,
    time::Duration,
};

use rustls::{
    client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier},
    pki_types::{CertificateDer, ServerName, UnixTime},
    CertificateError, DigitallySignedStruct, Error as TlsError, SignatureScheme,
};
use rustls_platform_verifier::Verifier as PlatformVerifier;
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Runtime};
use url::Url;

use crate::commands::desktop::build_runtime_config;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CertificatePinningSnapshot {
    pub configured: bool,
    pub hosts: BTreeMap<String, Vec<String>>,
}

#[tauri::command(rename = "desktop-api:security:cert-pinning:snapshot")]
pub fn snapshot<R: Runtime>(app: AppHandle<R>) -> Result<CertificatePinningSnapshot, String> {
    let pins = resolve_certificate_pins(&app)?;
    Ok(CertificatePinningSnapshot {
        configured: !pins.is_empty(),
        hosts: pins
            .into_iter()
            .map(|(host, values)| (host, values.into_iter().collect()))
            .collect(),
    })
}

pub fn resolve_certificate_pins<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<BTreeMap<String, BTreeSet<String>>, String> {
    let config = build_runtime_config(app)?;
    let rules = [
        (config.auth_api_url, "AUTH_API_CERT_PINS_SHA256"),
        (
            config.runtime_artifacts_url.unwrap_or_default(),
            "UPDATE_SERVER_CERT_PINS_SHA256",
        ),
    ];
    let mut by_host = BTreeMap::<String, BTreeSet<String>>::new();
    for (target_url, env_key) in rules {
        let Some(host) = parse_host(&target_url) else {
            continue;
        };
        let pins = parse_sha256_pins(std::env::var(env_key).ok().as_deref().unwrap_or(""));
        if pins.is_empty() {
            continue;
        }
        by_host.entry(host).or_default().extend(pins);
    }
    Ok(by_host)
}

pub fn pinned_http_client<R: Runtime>(
    app: &AppHandle<R>,
    timeout: Duration,
) -> Result<reqwest::Client, String> {
    build_http_client(resolve_certificate_pins(app)?, timeout)
}

pub fn build_http_client(
    pins_by_host: BTreeMap<String, BTreeSet<String>>,
    timeout: Duration,
) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder().timeout(timeout);
    if pins_by_host.is_empty() {
        return builder.build().map_err(|error| error.to_string());
    }

    let config_builder = rustls::ClientConfig::builder();
    let crypto_provider = config_builder.crypto_provider().clone();
    let platform_verifier =
        PlatformVerifier::new(crypto_provider).map_err(|error| error.to_string())?;
    let mut tls_config = config_builder
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(PinnedServerCertVerifier {
            inner: platform_verifier,
            pins_by_host,
        }))
        .with_no_client_auth();
    tls_config.alpn_protocols = vec![b"h2".to_vec(), b"http/1.1".to_vec()];
    builder = builder.use_preconfigured_tls(tls_config);
    builder.build().map_err(|error| error.to_string())
}

pub fn parse_sha256_pins(value: &str) -> BTreeSet<String> {
    value
        .split([',', ';', ' ', '\n', '\r', '\t'])
        .map(|item| {
            item.trim()
                .trim_start_matches("sha256/")
                .trim_start_matches("sha256-")
                .replace(':', "")
                .to_ascii_uppercase()
        })
        .filter(|item| item.len() == 64 && item.chars().all(|ch| ch.is_ascii_hexdigit()))
        .collect()
}

pub fn parse_host(value: &str) -> Option<String> {
    Url::parse(value)
        .ok()
        .and_then(|url| url.host_str().map(|host| host.trim().to_ascii_lowercase()))
        .filter(|host| !host.is_empty())
}

#[derive(Debug)]
struct PinnedServerCertVerifier {
    inner: PlatformVerifier,
    pins_by_host: BTreeMap<String, BTreeSet<String>>,
}

impl ServerCertVerifier for PinnedServerCertVerifier {
    fn verify_server_cert(
        &self,
        end_entity: &CertificateDer<'_>,
        intermediates: &[CertificateDer<'_>],
        server_name: &ServerName<'_>,
        ocsp_response: &[u8],
        now: UnixTime,
    ) -> Result<ServerCertVerified, TlsError> {
        let verified = self.inner.verify_server_cert(
            end_entity,
            intermediates,
            server_name,
            ocsp_response,
            now,
        )?;
        let host = server_name.to_str().to_ascii_lowercase();
        let Some(allowed_pins) = self.pins_by_host.get(host.as_str()) else {
            return Ok(verified);
        };
        let presented_pins = certificate_pins(end_entity.as_ref());
        if presented_pins.iter().any(|pin| allowed_pins.contains(pin)) {
            return Ok(verified);
        }

        Err(TlsError::InvalidCertificate(
            CertificateError::ApplicationVerificationFailure,
        ))
    }

    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        self.inner.verify_tls12_signature(message, cert, dss)
    }

    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, TlsError> {
        self.inner.verify_tls13_signature(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.inner.supported_verify_schemes()
    }
}

fn certificate_pins(certificate_der: &[u8]) -> BTreeSet<String> {
    let mut pins = BTreeSet::from([sha256_hex(certificate_der)]);
    if let Some(spki_der) = extract_subject_public_key_info_der(certificate_der) {
        pins.insert(sha256_hex(spki_der));
    }
    pins
}

fn sha256_hex(value: &[u8]) -> String {
    let digest = Sha256::digest(value);
    hex::encode(digest).to_ascii_uppercase()
}

fn extract_subject_public_key_info_der(certificate_der: &[u8]) -> Option<&[u8]> {
    let (_, cert_value_start, _, cert_value_end) = read_der_tlv(certificate_der, 0, 0x30)?;
    let (tbs_start, tbs_value_start, _, tbs_value_end) =
        read_der_tlv(certificate_der, cert_value_start, 0x30)?;
    if tbs_value_end > cert_value_end {
        return None;
    }

    let mut cursor = tbs_value_start;
    if certificate_der.get(cursor) == Some(&0xA0) {
        cursor = read_der_tlv_any(certificate_der, cursor)?.3;
    }
    for expected in [0x02, 0x30, 0x30, 0x30, 0x30] {
        cursor = read_der_tlv(certificate_der, cursor, expected)?.3;
    }
    let (spki_start, _, spki_end, _) = read_der_tlv(certificate_der, cursor, 0x30)?;
    if spki_start < tbs_start || spki_end > tbs_value_end {
        return None;
    }
    Some(&certificate_der[spki_start..spki_end])
}

fn read_der_tlv(
    input: &[u8],
    offset: usize,
    expected_tag: u8,
) -> Option<(usize, usize, usize, usize)> {
    let (tag, value_start, value_end, full_end) = read_der_tlv_any(input, offset)?;
    if tag == expected_tag {
        Some((offset, value_start, value_end, full_end))
    } else {
        None
    }
}

fn read_der_tlv_any(input: &[u8], offset: usize) -> Option<(u8, usize, usize, usize)> {
    let tag = *input.get(offset)?;
    let first_len = *input.get(offset + 1)?;
    if first_len & 0x80 == 0 {
        let value_start = offset + 2;
        let value_end = value_start.checked_add(first_len as usize)?;
        return (value_end <= input.len()).then_some((tag, value_start, value_end, value_end));
    }

    let len_bytes = (first_len & 0x7F) as usize;
    if len_bytes == 0 || len_bytes > 4 {
        return None;
    }
    let mut len = 0usize;
    for byte in input.get(offset + 2..offset + 2 + len_bytes)? {
        len = len.checked_mul(256)?.checked_add(*byte as usize)?;
    }
    let value_start = offset + 2 + len_bytes;
    let value_end = value_start.checked_add(len)?;
    (value_end <= input.len()).then_some((tag, value_start, value_end, value_end))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_hex_and_colon_pins() {
        let pins = parse_sha256_pins(
            "sha256/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa, BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB:BB",
        );
        assert!(pins.contains("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"));
        assert!(pins.contains("BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"));
    }

    #[test]
    fn rejects_non_sha256_length() {
        assert!(parse_sha256_pins("abc").is_empty());
    }

    #[test]
    fn extracts_spki_der_from_certificate_structure() {
        let spki = [0x30, 0x03, 0x03, 0x01, 0x00];
        let mut tbs = vec![
            0xA0, 0x00, 0x02, 0x01, 0x01, 0x30, 0x00, 0x30, 0x00, 0x30, 0x00, 0x30, 0x00,
        ];
        tbs.extend_from_slice(&spki);
        let mut cert = vec![0x30, (tbs.len() + 2) as u8, 0x30, tbs.len() as u8];
        cert.extend_from_slice(&tbs);

        assert_eq!(
            extract_subject_public_key_info_der(&cert),
            Some(spki.as_slice())
        );
    }
}
