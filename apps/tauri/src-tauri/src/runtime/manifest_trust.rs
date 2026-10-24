//! Trust boundary for the runtime-artifacts manifest: path-segment policy,
//! archive-origin policy and detached-signature verification.

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

use super::profiles::RuntimeError;

/// Manifest-controlled path segments (`version`, `entry`, `fileName`) are
/// joined into filesystem paths. They must be single, relative, Win32-safe
/// components: separators, drive markers, dot-segments and trailing dots
/// (which Win32 strips, aliasing a sibling directory) are rejected.
pub fn validate_manifest_relative_path(value: &str) -> Result<(), RuntimeError> {
    let trimmed = value.trim();
    if trimmed.is_empty()
        || trimmed != value
        || value.len() > 200
        || value.starts_with('/')
        || value.starts_with('\\')
        || value.contains("..")
        || value.ends_with('.')
        || value.ends_with(' ')
        || value
            .chars()
            .any(|ch| matches!(ch, '/' | '\\' | ':') || ch.is_control())
    {
        return Err(RuntimeError::Integrity(format!(
            "unsafe path segment in runtime manifest: {value:?}"
        )));
    }
    Ok(())
}

/// The archive URL named by the manifest must stay on the manifest origin over
/// https. Debug builds may use a plain-http loopback feed for local testing.
pub fn ensure_runtime_archive_url(
    manifest_url: &str,
    archive_url: &str,
) -> Result<(), RuntimeError> {
    let base = url::Url::parse(manifest_url)?;
    let target = url::Url::parse(archive_url)?;
    let same_origin = target.host_str() == base.host_str()
        && target.port_or_known_default() == base.port_or_known_default();
    let loopback_http = cfg!(debug_assertions)
        && target.scheme() == "http"
        && matches!(
            target.host_str(),
            Some("127.0.0.1" | "localhost" | "[::1]" | "::1")
        );
    if !same_origin || (target.scheme() != "https" && !loopback_http) {
        return Err(RuntimeError::Integrity(format!(
            "runtime archive URL leaves the manifest origin: {archive_url}"
        )));
    }
    Ok(())
}

/// Ed25519 verifying key for the runtime-artifacts feed, pinned at build time
/// (`KOMA_MINI_BACKEND_ARTIFACTS_PUBKEY`, raw 32-byte key in base64). When
/// unset, the feed is protected by TLS plus the configured certificate pins.
pub const PINNED_ARTIFACTS_PUBKEY: Option<&str> = option_env!("KOMA_MINI_BACKEND_ARTIFACTS_PUBKEY");

pub(crate) fn verify_artifacts_manifest_signature(
    public_key: &str,
    body: &[u8],
    signature: &str,
) -> Result<(), RuntimeError> {
    let decode = |value: &str| -> Result<Vec<u8>, RuntimeError> {
        let trimmed = value.trim();
        let normalized = trimmed.strip_prefix("ed25519-").unwrap_or(trimmed);
        BASE64.decode(normalized.trim()).map_err(|_| {
            RuntimeError::Integrity("invalid base64 in runtime manifest signature.".to_string())
        })
    };

    let key_bytes = decode(public_key)?;
    let key_array: [u8; 32] = key_bytes.as_slice().try_into().map_err(|_| {
        RuntimeError::Integrity("runtime manifest public key must be 32 bytes.".to_string())
    })?;
    let verifying_key = ed25519_dalek::VerifyingKey::from_bytes(&key_array).map_err(|error| {
        RuntimeError::Integrity(format!("invalid runtime manifest public key: {error}"))
    })?;

    let signature_bytes = decode(signature)?;
    let signature = ed25519_dalek::Signature::from_slice(&signature_bytes).map_err(|error| {
        RuntimeError::Integrity(format!("invalid runtime manifest signature: {error}"))
    })?;

    verifying_key
        .verify_strict(body, &signature)
        .map_err(|error| {
            RuntimeError::Integrity(format!(
                "runtime manifest signature verification failed: {error}"
            ))
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unsafe_manifest_path_segments() {
        for safe in [
            "1.1.0",
            "mini-backend.exe",
            "runtime-cpu-1.1.0-win32-x64.zip",
        ] {
            assert!(validate_manifest_relative_path(safe).is_ok(), "{safe}");
        }
        for unsafe_value in [
            "",
            ".",
            "..",
            "../escape",
            "nested/file",
            "nested\\file",
            "C:evil",
            "name.",
            "name ",
            " lead",
        ] {
            assert!(
                validate_manifest_relative_path(unsafe_value).is_err(),
                "{unsafe_value:?} must be rejected"
            );
        }
    }

    #[test]
    fn rejects_archive_urls_off_the_manifest_origin() {
        let manifest = "https://api.example.com/updates/latest.json";
        assert!(ensure_runtime_archive_url(
            manifest,
            "https://api.example.com/updates/runtime.zip"
        )
        .is_ok());
        assert!(
            ensure_runtime_archive_url(manifest, "https://attacker.example/runtime.zip").is_err()
        );
        assert!(
            ensure_runtime_archive_url(manifest, "http://api.example.com/runtime.zip").is_err()
        );
    }

    #[test]
    fn verifies_and_rejects_manifest_signatures() {
        use ed25519_dalek::{Signer, SigningKey};

        let signing = SigningKey::from_bytes(&[7_u8; 32]);
        let body = br#"{"version":"1.0.0"}"#;
        let signature = signing.sign(body);
        let public_key = format!(
            "ed25519-{}",
            BASE64.encode(signing.verifying_key().to_bytes())
        );
        let signature_value = format!("ed25519-{}", BASE64.encode(signature.to_bytes()));

        assert!(verify_artifacts_manifest_signature(&public_key, body, &signature_value).is_ok());
        assert!(
            verify_artifacts_manifest_signature(&public_key, b"tampered", &signature_value)
                .is_err()
        );

        let other = SigningKey::from_bytes(&[8_u8; 32]);
        let other_key = format!(
            "ed25519-{}",
            BASE64.encode(other.verifying_key().to_bytes())
        );
        assert!(verify_artifacts_manifest_signature(&other_key, body, &signature_value).is_err());
    }
}
