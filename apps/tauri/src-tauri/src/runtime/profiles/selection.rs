use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::PathBuf,
};

use tauri::{AppHandle, Manager, Runtime};

use crate::commands::desktop::build_runtime_config;
use crate::runtime::gpu::{
    collect_gpu_vendors, has_vendor_match, is_amd_vendor, is_intel_vendor,
    is_legacy_nvidia_descriptor, is_nvidia_vendor, platform_key,
};
use crate::runtime::launch_manifest::resolve_spawnable_runtime_binary;
use crate::runtime::manifest_trust::validate_manifest_relative_path;

use super::patch_runtime_state;
use super::types::{
    MiniBackendRuntimeArtifactManifest, MiniBackendRuntimeArtifactOption, MiniBackendRuntimePatch,
    MiniBackendRuntimeSelection, MiniBackendRuntimeStore, PROFILES, RUNTIME_SELECTION_FILE_NAME,
    RuntimeError,
};

pub fn resolve_runtime_profile<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    silent: bool,
    ignore_manual_selection: bool,
) -> Result<String, RuntimeError> {
    let env_override =
        normalize_profile_override(env::var("MINI_BACKEND_ACCELERATION_PROFILE").ok());
    let selection = if ignore_manual_selection {
        None
    } else {
        read_runtime_selection(app)
            .ok()
            .flatten()
            .map(|value| value.profile)
    };
    let override_profile = if env_override != "auto" {
        Some(env_override)
    } else {
        selection
    };
    let profile = resolve_acceleration_profile(
        platform_key(),
        env::consts::ARCH,
        override_profile.as_deref(),
        &collect_gpu_vendors(),
    );

    if !silent {
        let _ = patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("resolving".to_string()),
                status_message: Some(Some(
                    "Detecting the best local runtime profile.".to_string(),
                )),
                requested_profile: Some(profile.clone()),
                attempt: Some(0),
                max_attempts: Some(0),
                progress: Some(None),
                ..Default::default()
            },
        );
    }

    Ok(profile)
}

pub fn read_runtime_selection<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<MiniBackendRuntimeSelection>, RuntimeError> {
    let file_path = runtime_selection_path(app)?;
    if !file_path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(&file_path)?;
    let parsed: MiniBackendRuntimeSelection = serde_json::from_str(&raw)?;
    if normalize_profile_override(Some(parsed.profile.clone())) == "auto"
        || parsed.version.trim().is_empty()
        || parsed.entry.trim().is_empty()
    {
        return Ok(None);
    }
    Ok(Some(parsed))
}

pub fn resolve_selected_runtime_binary_path<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<PathBuf>, RuntimeError> {
    let Some(selection) = read_runtime_selection(app)? else {
        return Ok(None);
    };
    crate::runtime::layered::manifest::validate_safe_subpath(&selection.entry)?;
    let install_dir = runtime_install_dir(app, &selection.version, &selection.profile)?;
    Ok(resolve_spawnable_runtime_binary(
        &install_dir,
        &selection.profile,
        &selection.entry,
    ))
}

pub fn runtime_install_dir<R: Runtime>(
    app: &AppHandle<R>,
    version: &str,
    profile: &str,
) -> Result<PathBuf, RuntimeError> {
    validate_manifest_relative_path(version)?;
    validate_manifest_relative_path(profile)?;
    Ok(app
        .path()
        .app_data_dir()?
        .join("mini-backend-runtimes")
        .join(version)
        .join(sanitize_profile(profile)))
}

pub fn sanitize_profile(profile: &str) -> String {
    profile
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect()
}

pub fn normalize_profile_override(value: Option<String>) -> String {
    let normalized = value.unwrap_or_default().trim().to_ascii_lowercase();
    if PROFILES.contains(&normalized.as_str()) {
        normalized
    } else {
        "auto".to_string()
    }
}

pub fn resolve_acceleration_profile(
    platform: &str,
    arch: &str,
    override_profile: Option<&str>,
    gpu_vendors: &[String],
) -> String {
    if let Some(profile) = override_profile {
        let normalized = normalize_profile_override(Some(profile.to_string()));
        if normalized != "auto" {
            return normalized;
        }
    }
    if platform == "darwin" && arch == "aarch64" {
        return "apple-mps".to_string();
    }
    if platform == "win32" && has_vendor_match(gpu_vendors, is_legacy_nvidia_descriptor) {
        return "nvidia-cuda-legacy".to_string();
    }
    if has_vendor_match(gpu_vendors, is_nvidia_vendor) {
        return "nvidia-cuda".to_string();
    }
    if platform == "win32" && has_vendor_match(gpu_vendors, is_amd_vendor) {
        return "windows-directml".to_string();
    }
    if platform == "linux" && has_vendor_match(gpu_vendors, is_amd_vendor) {
        return "amd-rocm".to_string();
    }
    if has_vendor_match(gpu_vendors, is_intel_vendor) {
        return "intel-openvino".to_string();
    }
    "cpu".to_string()
}

fn runtime_selection_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, RuntimeError> {
    Ok(app.path().app_data_dir()?.join(RUNTIME_SELECTION_FILE_NAME))
}

pub(crate) fn write_runtime_selection<R: Runtime>(
    app: &AppHandle<R>,
    selection: &MiniBackendRuntimeSelection,
) -> Result<(), RuntimeError> {
    let file_path = runtime_selection_path(app)?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = serde_json::to_string_pretty(selection)?;
    fs::write(file_path, format!("{raw}\n"))?;
    Ok(())
}

pub(crate) fn resolve_artifacts_url<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<String>, RuntimeError> {
    Ok(Some(build_runtime_config(app).runtime_artifacts_url))
}

pub(super) fn resolve_manifest_url<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<String>, RuntimeError> {
    Ok(resolve_manifest_url_from_base(
        resolve_artifacts_url(app)?.as_deref(),
    ))
}

fn resolve_manifest_url_from_base(raw_url: Option<&str>) -> Option<String> {
    resolve_manifest_url_for_platform(raw_url, node_platform(), node_arch())
}

pub fn node_platform() -> &'static str {
    match env::consts::OS {
        "windows" => "win32",
        "macos" => "darwin",
        other => other,
    }
}

pub fn node_arch() -> &'static str {
    match env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "arm64",
        other => other,
    }
}

fn runtime_manifest_file_name(platform: &str, arch: &str) -> String {
    format!("mini-backend-latest-{platform}-{arch}.json")
}

pub fn is_manifest_for_current_platform(manifest: &MiniBackendRuntimeArtifactManifest) -> bool {
    manifest.platform == node_platform() && manifest.arch == node_arch()
}

pub fn ensure_manifest_schema_v2(
    manifest: &MiniBackendRuntimeArtifactManifest,
) -> Result<(), RuntimeError> {
    if manifest.schema_version == 2 {
        Ok(())
    } else {
        Err(RuntimeError::Integrity(format!(
            "unsupported runtime manifest schemaVersion {}",
            manifest.schema_version
        )))
    }
}

pub(super) fn resolve_manifest_url_for_platform(
    raw_url: Option<&str>,
    platform: &str,
    arch: &str,
) -> Option<String> {
    let trimmed = raw_url?.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.to_ascii_lowercase().ends_with(".json") {
        return Some(trimmed.to_string());
    }
    let base = if trimmed.ends_with('/') {
        trimmed.to_string()
    } else {
        format!("{trimmed}/")
    };
    Some(format!(
        "{base}{}",
        runtime_manifest_file_name(platform, arch)
    ))
}

pub(super) fn list_artifact_options(
    manifest: &MiniBackendRuntimeArtifactManifest,
    recommended_profile: Option<&str>,
    installed_profiles: &HashSet<String>,
) -> Vec<MiniBackendRuntimeArtifactOption> {
    let order = artifact_profile_order(
        &manifest.platform,
        manifest.profiles.contains_key("nvidia-tensorrt"),
    );
    let order_index = order
        .iter()
        .enumerate()
        .map(|(index, profile)| ((*profile).to_string(), index))
        .collect::<HashMap<_, _>>();
    let mut records = manifest.profiles.values().collect::<Vec<_>>();
    records.sort_by(|left, right| {
        let left_index = order_index
            .get(&left.profile)
            .copied()
            .unwrap_or(usize::MAX);
        let right_index = order_index
            .get(&right.profile)
            .copied()
            .unwrap_or(usize::MAX);
        left_index
            .cmp(&right_index)
            .then_with(|| left.profile.cmp(&right.profile))
    });
    records
        .into_iter()
        .map(|entry| MiniBackendRuntimeArtifactOption {
            profile: entry.profile.clone(),
            version: entry.version.clone(),
            size: entry.total_part_bytes(),
            installed: installed_profiles.contains(&entry.profile),
            recommended: recommended_profile == Some(entry.profile.as_str()),
        })
        .collect()
}

pub(crate) fn artifact_profile_order(platform: &str, include_tensorrt: bool) -> Vec<&'static str> {
    match platform {
        "win32" => {
            let mut profiles = vec![
                "cpu",
                "nvidia-cuda",
                "nvidia-cuda-legacy",
                "intel-openvino",
                "windows-directml",
            ];
            if include_tensorrt {
                profiles.push("nvidia-tensorrt");
            }
            profiles
        }
        "linux" => {
            let mut profiles = vec!["cpu", "nvidia-cuda", "amd-rocm", "intel-openvino"];
            if include_tensorrt {
                profiles.push("nvidia-tensorrt");
            }
            profiles
        }
        "darwin" => vec!["cpu", "apple-mps"],
        _ => vec!["cpu"],
    }
}

pub(super) fn format_runtime_fallback_reason(value: Option<&str>) -> Option<String> {
    let normalized = value?.trim();
    if normalized.is_empty() {
        return None;
    }
    let message = match normalized {
        "onnx_cuda_provider_unavailable" => {
            "The requested CUDA runtime is unavailable, so the app is using CPU execution."
        }
        "onnx_cuda_legacy_provider_unavailable" => {
            "The requested CUDA Legacy runtime is unavailable, so the app is using CPU execution."
        }
        "onnx_tensorrt_provider_unavailable" => {
            "TensorRT is unavailable on this runtime, so the app is using CPU execution."
        }
        "onnx_rocm_provider_unavailable" => {
            "ROCm is unavailable on this runtime, so the app is using CPU execution."
        }
        "openvino_provider_unavailable" => {
            "OpenVINO is unavailable on this runtime, so the app is using CPU execution."
        }
        "coreml_only_for_onnx" => {
            "CoreML acceleration is unavailable for the current ONNX runtime, so the app is using CPU execution."
        }
        "onnx_directml_provider_unavailable" => {
            "DirectML / WebGPU acceleration is unavailable on this runtime, so the app is using CPU execution."
        }
        "runtime_warmup_fallback_to_cpu" => {
            "The selected runtime profile failed warmup and was downgraded to CPU."
        }
        other => other,
    };
    Some(message.to_string())
}
