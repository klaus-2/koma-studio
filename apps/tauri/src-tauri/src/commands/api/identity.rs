use std::{env, fs, path::PathBuf};

use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};

use super::client::{app_data_dir, read_json_file, stable_hash, write_json_file};

const IDENTITY_CACHE_FILE: &str = "desktop-identity-cache.json";
const HARDWARE_NAMESPACE: &str = "koma-studio:hardware:v1";
const MAC_NAMESPACE: &str = "koma-studio:mac:v1";
const MACHINE_PROFILE_SCHEMA_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareIdResponse {
    pub hardware_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MachineFingerprintResponse {
    pub hardware_id: String,
    pub mac_fingerprint: String,
    pub profile_hash: String,
    pub profile: Value,
}

#[tauri::command(rename = "desktop-api:identity:hardware-id")]
pub fn hardware_id<R: Runtime>(app: AppHandle<R>) -> Result<HardwareIdResponse, String> {
    Ok(HardwareIdResponse {
        hardware_id: resolve_hardware_id(&app)?,
    })
}

#[tauri::command(rename = "desktop-api:identity:machine-fingerprint")]
pub fn machine_fingerprint<R: Runtime>(
    app: AppHandle<R>,
) -> Result<MachineFingerprintResponse, String> {
    let profile = collect_machine_profile(&app)?;
    let profile_hash = stable_hash(
        "koma-studio:machine-profile:v1",
        &serde_json::to_string(&profile).map_err(|error| error.to_string())?,
    );
    Ok(MachineFingerprintResponse {
        hardware_id: profile
            .get("desktopDeviceId")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        mac_fingerprint: profile
            .get("desktopMacFingerprint")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        profile_hash,
        profile,
    })
}

pub fn resolve_hardware_id<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
    let cache = read_identity_cache(app)?;
    let cached = cache
        .get("hardwareId")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToString::to_string);

    let machine_source = machine_uid::get().unwrap_or_default();
    let hardware_id = if machine_source.trim().is_empty() {
        cached.unwrap_or_else(|| {
            let fallback = format!(
                "{}:{}:{}",
                env::consts::OS,
                env::consts::ARCH,
                env::var("COMPUTERNAME")
                    .or_else(|_| env::var("HOSTNAME"))
                    .unwrap_or_default()
            );
            format!("hw-{}", stable_hash(HARDWARE_NAMESPACE, &fallback))
        })
    } else {
        format!(
            "hw-{}",
            stable_hash(HARDWARE_NAMESPACE, machine_source.trim())
        )
    };

    write_identity_cache_value(app, "hardwareId", &hardware_id)?;
    Ok(hardware_id)
}

pub fn resolve_mac_fingerprint<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
    let cache = read_identity_cache(app)?;
    if let Some(cached) = cache
        .get("macFingerprint")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
    {
        return Ok(cached.to_string());
    }

    let source = env::var("COMPUTERNAME")
        .or_else(|_| env::var("HOSTNAME"))
        .unwrap_or_else(|_| "no-valid-mac".to_string());
    let fingerprint = format!("macf-{}", stable_hash(MAC_NAMESPACE, &source));
    write_identity_cache_value(app, "macFingerprint", &fingerprint)?;
    Ok(fingerprint)
}

pub fn collect_machine_profile<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
    let hardware_id = resolve_hardware_id(app)?;
    let mac_fingerprint = resolve_mac_fingerprint(app)?;
    let cpu_count = std::thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(1);
    let os_version = os_version();
    Ok(json!({
        "schemaVersion": MACHINE_PROFILE_SCHEMA_VERSION,
        "desktopDeviceId": hardware_id,
        "desktopMacFingerprint": mac_fingerprint,
        "platform": env::consts::OS,
        "os": env::consts::OS,
        "osVersion": os_version,
        "osRelease": os_version,
        "osMachine": env::consts::ARCH,
        "arch": env::consts::ARCH,
        "processorModel": env::var("PROCESSOR_IDENTIFIER").unwrap_or_default(),
        "cpuCount": cpu_count,
        "cpuFrequencyMHz": Value::Null,
        "totalMemoryBytes": 0_u64,
        "hyperVEnabled": Value::Null,
        "collectedAt": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        "screenMetrics": {
            "primary": { "x": 0, "y": 0, "width": 0, "height": 0 },
            "displays": [],
        },
    }))
}

fn identity_cache_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app_data_dir(app)?.join(IDENTITY_CACHE_FILE))
}

fn read_identity_cache<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
    let path = identity_cache_path(app)?;
    Ok(read_json_file(&path).unwrap_or_else(|| json!({})))
}

fn write_identity_cache_value<R: Runtime>(
    app: &AppHandle<R>,
    key: &str,
    value: &str,
) -> Result<(), String> {
    let path = identity_cache_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut cache = read_json_file(&path)
        .and_then(|value| value.as_object().cloned())
        .unwrap_or_default();
    cache.insert(key.to_string(), Value::String(value.to_string()));
    write_json_file(&path, &Value::Object(cache))
}

fn os_version() -> String {
    #[cfg(target_os = "windows")]
    {
        env::var("OS").unwrap_or_else(|_| "Windows".to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        env::consts::OS.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_hash_is_namespaced() {
        assert_ne!(
            stable_hash(HARDWARE_NAMESPACE, "abc"),
            stable_hash(MAC_NAMESPACE, "abc")
        );
    }
}
