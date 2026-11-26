use std::collections::HashSet;

use super::archive::{estimate_runtime_install_required_bytes, is_retryable_error};
use super::selection::{
    ensure_manifest_schema_v2, is_manifest_for_current_platform, list_artifact_options, node_arch,
    node_platform, normalize_profile_override, resolve_acceleration_profile,
    resolve_manifest_url_for_platform,
};
use super::types::{
    MIN_RUNTIME_INSTALL_REQUIRED_BYTES, MiniBackendRuntimeArtifactManifest,
    MiniBackendRuntimeArtifactPart, MiniBackendRuntimeArtifactRecord, RuntimeError,
};

#[cfg(unix)]
use super::archive::extract_runtime_archive;

#[test]
fn normalizes_supported_profiles_only() {
    assert_eq!(
        normalize_profile_override(Some("NVIDIA-CUDA".to_string())),
        "nvidia-cuda"
    );
    assert_eq!(normalize_profile_override(Some("cuda".to_string())), "auto");
}

#[test]
fn resolves_manifest_url_like_electron() {
    assert_eq!(
        resolve_manifest_url_for_platform(
            Some("https://github.com/klaus-2/koma-studio/releases/latest/download"),
            "win32",
            "x64"
        ),
        Some(
            "https://github.com/klaus-2/koma-studio/releases/latest/download/mini-backend-latest-win32-x64.json"
                .to_string()
        )
    );
    assert_eq!(
        resolve_manifest_url_for_platform(
            Some("https://updates.example.com/mini-backend-artifacts/"),
            "linux",
            "arm64"
        ),
        Some(
            "https://updates.example.com/mini-backend-artifacts/mini-backend-latest-linux-arm64.json"
                .to_string()
        )
    );
    assert_eq!(
        resolve_manifest_url_for_platform(
            Some("https://updates.example.com/latest.json"),
            "win32",
            "x64"
        ),
        Some("https://updates.example.com/latest.json".to_string())
    );
}

#[test]
fn golden_manifest_fixture_parses_for_both_shells() {
    let raw = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../electron/scripts/fixtures/mini-backend-manifest-v2.golden.json"
    ));
    let manifest: MiniBackendRuntimeArtifactManifest = serde_json::from_str(raw).unwrap();
    assert_eq!(manifest.schema_version, 2);
    ensure_manifest_schema_v2(&manifest).unwrap();
    assert_eq!(manifest.profiles.len(), 2);
    let cuda = manifest.profiles.get("nvidia-cuda").unwrap();
    assert_eq!(cuda.parts.len(), 2);
    assert_eq!(
        cuda.total_part_bytes(),
        cuda.parts.iter().map(|part| part.size).sum::<u64>()
    );
    assert!(
        cuda.parts.iter().all(|part| part.url.starts_with(
            "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.2.0/"
        ))
    );
}

#[test]
fn rejects_schema_versions_other_than_two() {
    let manifest = MiniBackendRuntimeArtifactManifest {
        schema_version: 1,
        ..sample_manifest()
    };
    assert!(ensure_manifest_schema_v2(&manifest).is_err());
}

#[test]
fn detects_foreign_platform_manifests() {
    let mut manifest = sample_manifest();
    manifest.platform = node_platform().to_string();
    manifest.arch = node_arch().to_string();
    assert!(is_manifest_for_current_platform(&manifest));
    manifest.arch = if node_arch() == "x64" {
        "arm64".to_string()
    } else {
        "x64".to_string()
    };
    assert!(!is_manifest_for_current_platform(&manifest));
}

#[test]
fn lists_artifacts_in_platform_order() {
    let manifest = sample_manifest();

    let options = list_artifact_options(
        &manifest,
        Some("nvidia-cuda"),
        &HashSet::from(["cpu".to_string()]),
    );

    assert_eq!(
        options
            .iter()
            .map(|entry| entry.profile.as_str())
            .collect::<Vec<_>>(),
        vec!["cpu", "nvidia-cuda", "intel-openvino"]
    );
    assert!(options[0].installed);
    assert!(options[1].recommended);
}

#[test]
fn estimates_runtime_disk_need_with_floor() {
    assert_eq!(
        estimate_runtime_install_required_bytes(1),
        MIN_RUNTIME_INSTALL_REQUIRED_BYTES
    );
    assert_eq!(
        estimate_runtime_install_required_bytes(1_000_000_000),
        3_000_000_000
    );
}

#[test]
fn retry_policy_excludes_integrity_and_local_io() {
    assert!(!is_retryable_error(&RuntimeError::Integrity("x".into())));
    assert!(!is_retryable_error(&RuntimeError::Io(
        std::io::Error::other("disk full")
    )));
    assert!(is_retryable_error(&RuntimeError::Message(
        "HTTP 503".into()
    )));
    assert!(!is_retryable_error(&RuntimeError::Message(
        "HTTP 404".into()
    )));
}

#[test]
fn runtime_error_serializes_kind_and_message() {
    let json = serde_json::to_string(&RuntimeError::Integrity("bad hash".into())).unwrap();
    assert_eq!(
        json,
        r#"{"kind":"integrity","message":"integrity check failed: bad hash"}"#
    );
}

fn record(profile: &str, size: u64) -> MiniBackendRuntimeArtifactRecord {
    MiniBackendRuntimeArtifactRecord {
        profile: profile.to_string(),
        version: "1.0.0".to_string(),
        platform: "win32".to_string(),
        arch: "x64".to_string(),
        entry: "mini-backend.exe".to_string(),
        parts: vec![MiniBackendRuntimeArtifactPart {
            file: format!("{profile}.part-1-of-1.zip"),
            url: format!(
                "https://github.com/klaus-2/koma-studio/releases/download/runtime-v1.0.0/{profile}.part-1-of-1.zip"
            ),
            sha512: "sha".to_string(),
            size,
        }],
    }
}

fn sample_manifest() -> MiniBackendRuntimeArtifactManifest {
    MiniBackendRuntimeArtifactManifest {
        schema_version: 2,
        version: "1.0.0".to_string(),
        generated_at: "now".to_string(),
        platform: "win32".to_string(),
        arch: "x64".to_string(),
        default_profile: "cpu".to_string(),
        profiles: [
            record("intel-openvino", 4),
            record("cpu", 1),
            record("nvidia-cuda", 2),
        ]
        .into_iter()
        .map(|record| (record.profile.clone(), record))
        .collect(),
    }
}

#[cfg(unix)]
#[test]
fn extraction_restores_the_executable_bit_from_zip_modes() {
    use std::{fs, fs::File, io::Write as _, os::unix::fs::PermissionsExt};
    use zip::write::SimpleFileOptions;

    let dir = std::env::temp_dir().join(format!("koma-exec-bit-{}", std::process::id()));
    let zip_path = dir.join("part.zip");
    let destination = dir.join("extracted");
    fs::create_dir_all(&dir).unwrap();

    let file = File::create(&zip_path).unwrap();
    let mut writer = zip::ZipWriter::new(file);
    writer
        .start_file(
            "mini-backend",
            SimpleFileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .unix_permissions(0o755),
        )
        .unwrap();
    writer.write_all(b"#!/bin/sh\n").unwrap();
    writer.finish().unwrap();
    drop(writer);

    extract_runtime_archive(&zip_path, &destination).unwrap();
    let mode = fs::metadata(destination.join("mini-backend"))
        .unwrap()
        .permissions()
        .mode();
    assert_eq!(mode & 0o111, 0o111, "the entry must stay executable");

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn resolves_acceleration_profile_across_platforms() {
    assert_eq!(
        resolve_acceleration_profile(
            "win32",
            "x86_64",
            None,
            &["AMD Radeon RX 7800 XT".to_string()]
        ),
        "windows-directml"
    );
    assert_eq!(
        resolve_acceleration_profile(
            "linux",
            "x86_64",
            None,
            &["AMD Radeon RX 7800 XT".to_string()]
        ),
        "amd-rocm"
    );
    assert_eq!(
        resolve_acceleration_profile(
            "win32",
            "x86_64",
            None,
            &["NVIDIA GeForce GTX 1060 6GB".to_string()]
        ),
        "nvidia-cuda-legacy"
    );
    assert_eq!(
        resolve_acceleration_profile(
            "win32",
            "x86_64",
            None,
            &["NVIDIA GeForce RTX 4070".to_string()]
        ),
        "nvidia-cuda"
    );
    assert_eq!(
        resolve_acceleration_profile("darwin", "aarch64", None, &[]),
        "apple-mps"
    );
}
