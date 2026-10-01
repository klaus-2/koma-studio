//! Identity commands. The command layer uses the v2 namespace (machine-uid
//! sourced, surrogate MAC); auth.rs keeps its own v1 namespace so the
//! server-registered device_id never changes under a deployed server.

use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};

use crate::{
    error::{AppResult},
    models::identity::{HardwareIdResponse, MachineFingerprintResponse},
    services::{api_client::stable_hash, identity as identity_service},
};

#[tauri::command(rename = "desktop-api:identity:hardware-id")]
pub async fn hardware_id(app: AppHandle) -> AppResult<HardwareIdResponse> {
    let app_data = app.path().app_data_dir()?;

    let hardware_id = tauri::async_runtime::spawn_blocking(move || {
        identity_service::resolve_hardware_id(&app_data)
    })
    .await??;

    Ok(HardwareIdResponse { hardware_id })
}

#[tauri::command(rename = "desktop-api:identity:machine-fingerprint")]
pub async fn machine_fingerprint(app: AppHandle) -> AppResult<MachineFingerprintResponse> {
    let app_data = app.path().app_data_dir()?;

    let profile = tauri::async_runtime::spawn_blocking(move || {
        identity_service::collect_machine_profile(&app_data)
    })
    .await??;

    let profile_json = serde_json::to_string(&profile)?;
    let profile_hash = stable_hash("koma-studio:machine-profile:v2", &profile_json);

    Ok(MachineFingerprintResponse {
        hardware_id: profile.desktop_device_id.clone(),
        mac_fingerprint: profile.desktop_mac_fingerprint.clone(),
        profile_hash,
        profile,
    })
}

/// v1-compat helpers (auth.rs registers device ids under the v1 namespace;
/// migrating them would invalidate every deployed device registration).
pub fn resolve_hardware_id<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
    let cache = read_legacy_identity_cache(app)?;
    if let Some(value) = cache.get("hardwareId").and_then(Value::as_str) {
        if !value.trim().is_empty() {
            return Ok(value.to_string());
        }
    }

    let machine_source = machine_uid::get().unwrap_or_default();
    if machine_source.trim().is_empty() {
        return Err("Hardware identity is unavailable.".to_string());
    }
    Ok(format!(
        "hw-{}",
        stable_hash("koma-studio:hardware:v1", machine_source.trim())
    ))
}

pub fn resolve_mac_fingerprint<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
    let cache = read_legacy_identity_cache(app)?;
    if let Some(cached) = cache.get("macFingerprint").and_then(Value::as_str) {
        if !cached.trim().is_empty() {
            return Ok(cached.to_string());
        }
    }

    let source = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .unwrap_or_else(|_| "no-valid-mac".to_string());
    Ok(format!("macf-{}", stable_hash("koma-studio:mac:v1", &source)))
}

pub fn collect_machine_profile<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
    let hardware_id = resolve_hardware_id(app)?;
    let mac_fingerprint = resolve_mac_fingerprint(app)?;
    let cpu_count = std::thread::available_parallelism()
        .map(|count| count.get())
        .unwrap_or(1);
    let os_version = os_version();
    Ok(json!({
        "schemaVersion": 1_u8,
        "desktopDeviceId": hardware_id,
        "desktopMacFingerprint": mac_fingerprint,
        "platform": std::env::consts::OS,
        "os": std::env::consts::OS,
        "osVersion": os_version,
        "osRelease": os_version,
        "osMachine": std::env::consts::ARCH,
        "arch": std::env::consts::ARCH,
        "processorModel": std::env::var("PROCESSOR_IDENTIFIER").unwrap_or_default(),
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

fn os_version() -> String {
    #[cfg(target_os = "windows")]
    {
        sysinfo::System::long_os_version().unwrap_or_else(|| std::env::consts::OS.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        sysinfo::System::long_os_version().unwrap_or_else(|| std::env::consts::OS.to_string())
    }
}

/// v1 identity cache: a plain JSON object at app_data_dir with optional
/// hardwareId/macFingerprint keys. Kept only so registered device ids remain
/// stable for the auth server.
fn read_legacy_identity_cache<R: Runtime>(app: &AppHandle<R>) -> Result<Value, String> {
    let path = crate::services::api_client::app_data_dir(app)
        .map_err(|error| error.to_string())?
        .join("desktop-identity-cache.json");
    match std::fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str::<Value>(&raw)
            .map_err(|error| format!("Corrupted identity cache: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(json!({})),
        Err(error) => Err(error.to_string()),
    }
}
