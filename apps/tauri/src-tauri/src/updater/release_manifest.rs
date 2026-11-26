use std::{collections::HashMap, time::Duration};

use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use minisign_verify::{PublicKey, Signature};
use semver::Version;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};

pub const UPDATER_MINISIGN_PUBKEY: &str = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEI1NjcwODIxODU5MzkwNDIKUldSQ2tKT0ZJUWhudGRIcW1qd3ZmaVVTWEk0aE1QZzZmQ1FMU0dJTC9ReGwxTHlwblRpbG5EdmsK";

const STABLE_MANIFEST_URL: &str =
    "https://github.com/klaus-2/koma-studio/releases/latest/download/koma-release-manifest.json";
const BETA_MANIFEST_URL: &str =
    "https://github.com/klaus-2/koma-studio/releases/download/beta/koma-release-manifest.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UiBundleDescriptor {
    pub file: String,
    pub url: String,
    #[serde(default)]
    pub sha256: String,
    pub size: u64,
    #[serde(default)]
    pub signature: String,
    pub native_abi_version: u32,
    pub min_native_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackendOverlayUpdateDescriptor {
    pub overlay_hash: String,
    pub app_version: String,
    pub engine_abi: String,
    pub file: String,
    pub url: String,
    pub sha256: String,
    #[serde(default)]
    pub sha512: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeDeltaDescriptor {
    pub from_version: String,
    pub url: String,
    pub patch_sha256: String,
    pub target_sha256: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct KomaReleaseManifest {
    pub schema_version: u8,
    pub version: String,
    pub channel: String,
    pub pub_date: String,
    pub release_notes: Option<String>,
    #[serde(default)]
    pub mandatory: bool,
    pub native_abi_version: u32,
    pub min_native_version: String,
    pub ui_bundle: Option<UiBundleDescriptor>,
    pub backend_overlay: Option<BackendOverlayUpdateDescriptor>,
    #[serde(default)]
    pub native_deltas: HashMap<String, NativeDeltaDescriptor>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UpdateStrategy {
    UpToDate,
    UiHotswap(UiBundleDescriptor),
    NativeInstaller,
}

pub enum ReleaseManifestFetch {
    Found {
        manifest: Box<KomaReleaseManifest>,
        etag: Option<String>,
        url: String,
    },
    NotModified,
    NotFound,
}

pub fn current_native_abi_version() -> u32 {
    env!("KOMA_NATIVE_ABI_VERSION").parse::<u32>().unwrap_or(1)
}

pub fn parse_semver_lenient(raw: &str) -> Option<Version> {
    let trimmed = raw.trim().trim_start_matches(['v', 'V']);
    Version::parse(trimmed).ok()
}

pub fn effective_version(native_version: &str, active_ui_version: Option<&str>) -> String {
    let Some(ui_raw) = active_ui_version else {
        return native_version.to_string();
    };
    match (
        parse_semver_lenient(native_version),
        parse_semver_lenient(ui_raw),
    ) {
        (Some(native_v), Some(ui_v)) if ui_v > native_v => ui_raw.trim().to_string(),
        _ => native_version.to_string(),
    }
}

pub fn decide_update_strategy(
    manifest: &KomaReleaseManifest,
    current_effective_version: &str,
    native_binary_version: &str,
    current_native_abi: u32,
    allow_hotswap: bool,
) -> UpdateStrategy {
    let Some(remote_ver) = parse_semver_lenient(&manifest.version) else {
        return UpdateStrategy::NativeInstaller;
    };
    let Some(current_ver) = parse_semver_lenient(current_effective_version) else {
        return UpdateStrategy::NativeInstaller;
    };
    if remote_ver <= current_ver {
        return UpdateStrategy::UpToDate;
    }

    if allow_hotswap {
        if let Some(ui_bundle) = &manifest.ui_bundle {
            let abi_ok = manifest.native_abi_version == current_native_abi
                && ui_bundle.native_abi_version == current_native_abi;
            let min_native_ok = match (
                parse_semver_lenient(native_binary_version),
                parse_semver_lenient(&manifest.min_native_version),
                parse_semver_lenient(&ui_bundle.min_native_version),
            ) {
                (Some(native_v), Some(m_min), Some(ui_min)) => {
                    native_v >= m_min && native_v >= ui_min
                }
                _ => false,
            };
            if abi_ok && min_native_ok {
                return UpdateStrategy::UiHotswap(ui_bundle.clone());
            }
        }
    }

    UpdateStrategy::NativeInstaller
}

fn decode_minisign_pubkey(raw: &str) -> Result<PublicKey, String> {
    let trimmed = raw.trim();
    if trimmed.contains("untrusted comment:") {
        return PublicKey::decode(trimmed).map_err(|error| format!("invalid public key: {error}"));
    }
    if let Ok(bytes) = BASE64.decode(trimmed) {
        if let Ok(text) = String::from_utf8(bytes) {
            if let Ok(pk) = PublicKey::decode(&text) {
                return Ok(pk);
            }
        }
    }
    PublicKey::from_base64(trimmed).map_err(|error| format!("invalid public key: {error}"))
}

fn decode_minisign_signature(raw: &str) -> Result<Signature, String> {
    let trimmed = raw.trim();
    if trimmed.contains("trusted comment:") {
        return Signature::decode(trimmed)
            .map_err(|error| format!("invalid minisign signature: {error}"));
    }
    let decoded = BASE64
        .decode(trimmed)
        .map_err(|error| format!("invalid base64 signature: {error}"))?;
    let text = String::from_utf8(decoded)
        .map_err(|error| format!("non-utf8 minisign signature: {error}"))?;
    Signature::decode(&text).map_err(|error| format!("invalid minisign signature: {error}"))
}

pub fn verify_minisign_bytes(
    pubkey_str: &str,
    data: &[u8],
    sig_str: &str,
) -> Result<String, String> {
    let public_key = decode_minisign_pubkey(pubkey_str)?;
    let signature = decode_minisign_signature(sig_str)?;
    public_key
        .verify(data, &signature, true)
        .map_err(|error| format!("minisign signature verification failed: {error}"))?;
    Ok(signature.trusted_comment().to_string())
}

pub fn verify_minisign_trusted_version(
    trusted_comment: &str,
    expected_version: &str,
    require_version: bool,
) -> Result<(), String> {
    let signed = trusted_comment
        .split('\t')
        .find_map(|field| field.strip_prefix("version:"));
    let Some(signed_ver) = signed else {
        if require_version {
            return Err("minisign signature missing required signed version comment".to_string());
        }
        return Ok(());
    };
    let matches = match (
        parse_semver_lenient(signed_ver),
        parse_semver_lenient(expected_version),
    ) {
        (Some(left), Some(right)) => left == right,
        _ => signed_ver.trim() == expected_version.trim(),
    };
    if matches {
        Ok(())
    } else {
        Err(format!(
            "minisign signed version {signed_ver} does not match expected {expected_version}"
        ))
    }
}

pub fn release_manifest_url_for_channel(channel: &str) -> &'static str {
    if channel == "beta" {
        BETA_MANIFEST_URL
    } else {
        STABLE_MANIFEST_URL
    }
}

pub async fn fetch_release_manifest<R: Runtime>(
    app: &AppHandle<R>,
    channel: &str,
    cached_etag: Option<&str>,
) -> Result<ReleaseManifestFetch, String> {
    let url = release_manifest_url_for_channel(channel).to_string();
    let client = crate::security::cert_pinning::pinned_http_client(app, Duration::from_secs(15))
        .map_err(|error| error.to_string())?;

    let mut req = client.get(&url).timeout(Duration::from_secs(15));
    if let Some(etag) = cached_etag {
        req = req.header(reqwest::header::IF_NONE_MATCH, etag);
    }
    let response = req.send().await.map_err(|error| error.to_string())?;
    if response.status() == reqwest::StatusCode::NOT_MODIFIED {
        return Ok(ReleaseManifestFetch::NotModified);
    }
    if matches!(response.status().as_u16(), 404 | 410) {
        return Ok(ReleaseManifestFetch::NotFound);
    }
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let etag = response
        .headers()
        .get(reqwest::header::ETAG)
        .and_then(|v| v.to_str().ok())
        .map(ToOwned::to_owned);
    let body = response.text().await.map_err(|error| error.to_string())?;

    let sig_url = format!("{url}.sig");
    let sig_res = client
        .get(&sig_url)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !sig_res.status().is_success() {
        return Err(format!(
            "Release manifest signature unavailable (HTTP {})",
            sig_res.status()
        ));
    }
    let signature = sig_res.text().await.map_err(|error| error.to_string())?;
    verify_minisign_bytes(UPDATER_MINISIGN_PUBKEY, body.as_bytes(), &signature)?;

    let manifest: KomaReleaseManifest = serde_json::from_str(&body)
        .map_err(|error| format!("invalid release manifest: {error}"))?;
    if manifest.schema_version != 1 {
        return Err(format!(
            "unsupported release manifest schemaVersion {}",
            manifest.schema_version
        ));
    }

    Ok(ReleaseManifestFetch::Found {
        manifest: Box::new(manifest),
        etag,
        url,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_manifest(version: &str, native_abi: u32, min_native: &str) -> KomaReleaseManifest {
        KomaReleaseManifest {
            schema_version: 1,
            version: version.to_string(),
            channel: "stable".to_string(),
            pub_date: "2026-11-25T00:00:00Z".to_string(),
            release_notes: Some("Fixes".to_string()),
            mandatory: false,
            native_abi_version: native_abi,
            min_native_version: min_native.to_string(),
            ui_bundle: Some(UiBundleDescriptor {
                file: format!("koma-ui-{version}.tar.zst"),
                url: format!(
                    "https://github.com/klaus-2/koma-studio/releases/download/v{version}/koma-ui-{version}.tar.zst"
                ),
                sha256: "abc".to_string(),
                size: 1_500_000,
                signature: "sig".to_string(),
                native_abi_version: native_abi,
                min_native_version: min_native.to_string(),
            }),
            backend_overlay: None,
            native_deltas: HashMap::new(),
        }
    }

    #[test]
    fn picks_ui_hotswap_when_abi_matches_and_falls_back_on_abi_bump() {
        let same_abi = sample_manifest("1.4.2", 1, "1.4.0");
        assert!(matches!(
            decide_update_strategy(&same_abi, "1.4.0", "1.4.0", 1, true),
            UpdateStrategy::UiHotswap(_)
        ));
        assert_eq!(
            decide_update_strategy(&same_abi, "1.4.2", "1.4.0", 1, true),
            UpdateStrategy::UpToDate
        );

        let bumped_abi = sample_manifest("1.5.0", 2, "1.5.0");
        assert_eq!(
            decide_update_strategy(&bumped_abi, "1.4.2", "1.4.0", 1, true),
            UpdateStrategy::NativeInstaller
        );
    }

    #[test]
    fn effective_version_prefers_newer_hotswap_version() {
        assert_eq!(effective_version("1.4.0", Some("1.4.3")), "1.4.3");
        assert_eq!(effective_version("1.5.0", Some("1.4.3")), "1.5.0");
        assert_eq!(effective_version("1.4.0", None), "1.4.0");
    }

    #[test]
    fn rejects_invalid_minisign_payloads() {
        assert!(verify_minisign_bytes(UPDATER_MINISIGN_PUBKEY, b"hello", "not-valid").is_err());
    }
}
