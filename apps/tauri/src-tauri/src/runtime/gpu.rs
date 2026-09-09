use std::{collections::HashSet, env, process::Command};

pub(super) fn collect_gpu_vendors() -> Vec<String> {
    if platform_key() != "win32" {
        return Vec::new();
    }
    let output = Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterCompatibility,PNPDeviceID,VideoProcessor | ConvertTo-Json -Depth 3 -Compress",
        ])
        .output();
    let Ok(output) = output else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }
    String::from_utf8_lossy(&output.stdout)
        .split(['"', ',', '{', '}', ':'])
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect::<HashSet<_>>()
        .into_iter()
        .collect()
}

pub(super) fn platform_key() -> &'static str {
    match env::consts::OS {
        "windows" => "win32",
        "macos" => "darwin",
        "linux" => "linux",
        other => other,
    }
}

pub(super) fn has_vendor_match(vendors: &[String], matcher: fn(&str) -> bool) -> bool {
    vendors
        .iter()
        .map(|value| value.trim().to_ascii_lowercase())
        .any(|value| matcher(&value))
}

pub(super) fn is_nvidia_vendor(vendor: &str) -> bool {
    vendor.contains("nvidia")
}

pub(super) fn is_legacy_nvidia_descriptor(vendor: &str) -> bool {
    [
        "gtx 10", "1050", "1060", "1070", "1080", "titan x", "p1000", "p2000", "p4000", "p5000",
        "p6000",
    ]
    .iter()
    .any(|needle| vendor.contains(needle))
}

pub(super) fn is_amd_vendor(vendor: &str) -> bool {
    vendor.contains("advanced micro devices") || vendor.contains("amd") || vendor.contains("radeon")
}

pub(super) fn is_intel_vendor(vendor: &str) -> bool {
    vendor.contains("intel")
}
