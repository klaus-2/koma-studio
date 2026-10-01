//! Identity models. The `mac_fingerprint` field is a legacy contract name: it
//! carries a domain-separated surrogate derived from the hardware id, never a
//! real MAC address.

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(transparent)]
pub struct HardwareId(pub String);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(transparent)]
pub struct MacFingerprint(pub String);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct HardwareIdResponse {
    pub hardware_id: HardwareId,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MachineProfile {
    pub schema_version: u8,
    pub desktop_device_id: HardwareId,
    pub desktop_mac_fingerprint: MacFingerprint,
    pub platform: String,
    pub os: String,
    pub os_version: Option<String>,
    pub os_release: Option<String>,
    pub os_machine: String,
    pub arch: String,
    pub processor_model: Option<String>,
    pub cpu_count: usize,
    pub cpu_frequency_mhz: Option<u64>,
    pub total_memory_bytes: Option<u64>,
    pub hyper_v_enabled: Option<bool>,
    pub collected_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MachineFingerprintResponse {
    pub hardware_id: HardwareId,
    pub mac_fingerprint: MacFingerprint,
    pub profile_hash: String,
    pub profile: MachineProfile,
}
