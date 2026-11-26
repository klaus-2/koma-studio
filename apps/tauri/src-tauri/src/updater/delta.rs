use std::{
    fs,
    io::{Cursor, Read},
    path::PathBuf,
    time::Duration,
};

use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager, Runtime};

use crate::runtime::manifest_trust::ensure_runtime_archive_url;

use super::release_manifest::NativeDeltaDescriptor;

fn sha256_hex_slice(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

pub fn reconstruct_from_zstd_delta(
    base_bytes: &[u8],
    patch_bytes: &[u8],
    expected_target_sha256: &str,
) -> Result<Vec<u8>, String> {
    let mut decoder =
        zstd::stream::read::Decoder::with_dictionary(Cursor::new(patch_bytes), base_bytes)
            .map_err(|error| format!("zstd delta init failed: {error}"))?;
    decoder
        .window_log_max(28)
        .map_err(|error| format!("zstd delta window_log_max failed: {error}"))?;

    let mut target = Vec::new();
    decoder
        .read_to_end(&mut target)
        .map_err(|error| format!("zstd delta decompression failed: {error}"))?;

    let actual_sha256 = sha256_hex_slice(&target);
    if !actual_sha256.eq_ignore_ascii_case(expected_target_sha256.trim()) {
        return Err(format!(
            "reconstructed installer sha256 mismatch: expected {expected_target_sha256}, got {actual_sha256}"
        ));
    }

    Ok(target)
}

fn installer_cache_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    app.path()
        .app_data_dir()
        .ok()
        .map(|dir| dir.join("updater-cache").join("installers"))
}

fn sanitize_cache_token(raw: &str) -> String {
    raw.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

pub fn installer_cache_path<R: Runtime>(
    app: &AppHandle<R>,
    version: &str,
    target_key: &str,
) -> Option<PathBuf> {
    installer_cache_dir(app).map(|dir| {
        dir.join(format!(
            "{}-{}.bin",
            sanitize_cache_token(version),
            sanitize_cache_token(target_key)
        ))
    })
}

pub fn cache_verified_installer<R: Runtime>(
    app: &AppHandle<R>,
    version: &str,
    target_key: &str,
    bytes: &[u8],
) {
    let Some(cache_dir) = installer_cache_dir(app) else {
        return;
    };
    let Some(target_path) = installer_cache_path(app, version, target_key) else {
        return;
    };
    if fs::create_dir_all(&cache_dir).is_err() {
        return;
    }
    if fs::write(&target_path, bytes).is_ok() {
        if let Ok(entries) = fs::read_dir(&cache_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path != target_path && path.is_file() {
                    let _ = fs::remove_file(path);
                }
            }
        }
    }
}

pub fn read_cached_installer<R: Runtime>(
    app: &AppHandle<R>,
    from_version: &str,
    target_key: &str,
) -> Option<Vec<u8>> {
    let path: PathBuf = installer_cache_path(app, from_version, target_key)?;
    if !path.is_file() {
        return None;
    }
    fs::read(path).ok()
}

pub async fn try_download_and_reconstruct_delta<R: Runtime, F>(
    app: &AppHandle<R>,
    manifest_url: &str,
    delta: &NativeDeltaDescriptor,
    target_key: &str,
    mut on_progress: F,
) -> Option<Vec<u8>>
where
    F: FnMut(u64, u64),
{
    let base_bytes = read_cached_installer(app, &delta.from_version, target_key)?;
    if ensure_runtime_archive_url(manifest_url, &delta.url).is_err() {
        return None;
    }
    let client =
        crate::security::cert_pinning::pinned_http_client(app, Duration::from_secs(120)).ok()?;
    let response = client
        .get(&delta.url)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .ok()?;
    if !response.status().is_success() {
        return None;
    }
    let total = response.content_length().unwrap_or(delta.size).max(1);
    on_progress(0, total);
    let patch_bytes = response.bytes().await.ok()?.to_vec();
    on_progress(patch_bytes.len() as u64, total);

    let actual_patch_sha = sha256_hex_slice(&patch_bytes);
    if !delta.patch_sha256.trim().is_empty()
        && !actual_patch_sha.eq_ignore_ascii_case(delta.patch_sha256.trim())
    {
        return None;
    }

    let expected_target = delta.target_sha256.clone();
    tokio::task::spawn_blocking(move || {
        reconstruct_from_zstd_delta(&base_bytes, &patch_bytes, &expected_target).ok()
    })
    .await
    .ok()
    .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn roundtrips_zstd_dictionary_delta_and_rejects_corruption() {
        let base = b"KOMA_NATIVE_BINARY_PREFIX_AAA_BBB_CCC_DDD_EEE_FFF_000111222333";
        let target = b"KOMA_NATIVE_BINARY_PREFIX_AAA_BBB_CCC_PATCHED_EEE_FFF_000111222999";

        let mut encoder =
            zstd::stream::write::Encoder::with_dictionary(Vec::new(), 9, base).unwrap();
        encoder.write_all(target).unwrap();
        let patch = encoder.finish().unwrap();

        let expected_sha = sha256_hex_slice(target);
        let reconstructed = reconstruct_from_zstd_delta(base, &patch, &expected_sha).unwrap();
        assert_eq!(reconstructed, target);

        assert!(reconstruct_from_zstd_delta(base, &patch, "0000").is_err());
        let mut corrupt = patch.clone();
        if let Some(last) = corrupt.last_mut() {
            *last ^= 0xff;
        }
        assert!(reconstruct_from_zstd_delta(base, &corrupt, &expected_sha).is_err());
    }
}
