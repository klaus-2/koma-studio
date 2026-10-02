//! Hardware identity. The v2 namespace derives identifiers from the machine
//! UID with a file-locked fallback installation id; the MAC fingerprint is a
//! domain-separated surrogate, never a real MAC.
//!
//! NOTE: commands::api::auth keeps the `hardware:v1` namespace for the
//! server-registered device_id — migrating it would invalidate every
//! registered desktop device.

use std::{
    fs::{self, File, OpenOptions},
    path::Path,
};

use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sysinfo::{RefreshKind, System};
use uuid::Uuid;

use crate::{
    error::AppResult,
    models::identity::{HardwareId, MacFingerprint, MachineProfile},
    services::api_client::{now_iso, read_json_file, stable_hash, write_json_file},
};

const IDENTITY_CACHE_FILE: &str = "desktop-identity-cache.json";
const IDENTITY_LOCK_FILE: &str = "desktop-identity-cache.lock";
const HARDWARE_NAMESPACE: &str = "koma-studio:hardware:v2";
const MAC_NAMESPACE: &str = "koma-studio:mac-surrogate:v2";
const MACHINE_PROFILE_SCHEMA_VERSION: u8 = 2;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IdentityCache {
    version: u8,
    fallback_installation_id: String,
}

pub fn resolve_hardware_id(app_data_dir: &Path) -> AppResult<HardwareId> {
    let machine_source = machine_uid::get()
        .ok()
        .map(|source| source.trim().to_string())
        .filter(|source| !source.is_empty());

    // The fallback never yields an empty string (validated existing UUID or a
    // freshly generated one); a real I/O failure propagates with its cause.
    let source = match machine_source {
        Some(source) => source,
        None => load_or_create_fallback_id(app_data_dir)?,
    };

    Ok(HardwareId(format!(
        "hw-{}",
        stable_hash(HARDWARE_NAMESPACE, &source)
    )))
}

pub fn resolve_mac_fingerprint(app_data_dir: &Path) -> AppResult<MacFingerprint> {
    let hardware_id = resolve_hardware_id(app_data_dir)?;

    Ok(MacFingerprint(format!(
        "macf-{}",
        stable_hash(MAC_NAMESPACE, &hardware_id.0)
    )))
}

pub fn collect_machine_profile(app_data_dir: &Path) -> AppResult<MachineProfile> {
    let hardware_id = resolve_hardware_id(app_data_dir)?;
    let mac_fingerprint = resolve_mac_fingerprint(app_data_dir)?;
    // The profile only needs CPU and memory; scanning the whole process
    // table (`new_all`) costs tens of unnecessary milliseconds at startup.
    let system = System::new_with_specifics(RefreshKind::everything().without_processes());

    let processor_model = system
        .cpus()
        .first()
        .map(|cpu| cpu.brand().trim().to_string())
        .filter(|value| !value.is_empty());

    let cpu_frequency_mhz = system
        .cpus()
        .first()
        .map(sysinfo::Cpu::frequency)
        .filter(|frequency| *frequency > 0);

    let total_memory_bytes = (system.total_memory() > 0).then_some(system.total_memory());

    Ok(MachineProfile {
        schema_version: MACHINE_PROFILE_SCHEMA_VERSION,
        desktop_device_id: hardware_id,
        desktop_mac_fingerprint: mac_fingerprint,
        platform: std::env::consts::OS.to_string(),
        os: std::env::consts::OS.to_string(),
        os_version: System::long_os_version(),
        os_release: System::kernel_version(),
        os_machine: std::env::consts::ARCH.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        processor_model,
        cpu_count: std::thread::available_parallelism()
            .map(std::num::NonZeroUsize::get)
            .unwrap_or(1),
        cpu_frequency_mhz,
        total_memory_bytes,
        hyper_v_enabled: None,
        collected_at: now_iso(),
    })
}

fn load_or_create_fallback_id(app_data_dir: &Path) -> AppResult<String> {
    fs::create_dir_all(app_data_dir)?;

    let lock_path = app_data_dir.join(IDENTITY_LOCK_FILE);
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(lock_path)?;
    set_private_permissions(&lock)?;
    FileExt::lock_exclusive(&lock)?;

    let result = load_or_create_fallback_id_locked(app_data_dir);
    if let Err(error) = FileExt::unlock(&lock) {
        tracing::warn!(error_kind = ?error.kind(), "identity cache lock release failed");
    }

    result
}

fn load_or_create_fallback_id_locked(app_data_dir: &Path) -> AppResult<String> {
    let path = app_data_dir.join(IDENTITY_CACHE_FILE);

    if let Some(value) = read_json_file(&path)? {
        let cache: IdentityCache = serde_json::from_value(value)?;
        if cache.version == 1 || cache.version == 2 {
            let value = cache.fallback_installation_id.trim();
            if Uuid::parse_str(value).is_ok() {
                return Ok(value.to_string());
            }
        }
    }

    let fallback_installation_id = Uuid::new_v4().to_string();
    write_json_file(
        &path,
        &IdentityCache {
            version: 2,
            fallback_installation_id: fallback_installation_id.clone(),
        },
    )?;

    Ok(fallback_installation_id)
}

#[cfg(unix)]
fn set_private_permissions(file: &File) -> AppResult<()> {
    use std::os::unix::fs::PermissionsExt;

    file.set_permissions(fs::Permissions::from_mode(0o600))?;
    Ok(())
}

#[cfg(not(unix))]
fn set_private_permissions(_file: &File) -> AppResult<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_identifiers_are_domain_separated() {
        let source = "installation";
        assert_ne!(
            stable_hash(HARDWARE_NAMESPACE, source),
            stable_hash(MAC_NAMESPACE, source)
        );
    }
}
