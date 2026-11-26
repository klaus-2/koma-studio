use std::{collections::HashSet, env, sync::OnceLock};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GpuAdapter {
    pub vendor_id: Option<u32>,
    pub name: String,
}

static GPU_ADAPTERS: OnceLock<Vec<GpuAdapter>> = OnceLock::new();

#[cfg(windows)]
fn probe_platform_adapters() -> Vec<GpuAdapter> {
    use windows::Win32::Graphics::Dxgi::{
        CreateDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE, DXGI_ERROR_NOT_FOUND, IDXGIFactory1,
    };

    let Ok(factory) = (unsafe { CreateDXGIFactory1::<IDXGIFactory1>() }) else {
        return Vec::new();
    };

    let mut adapters = Vec::new();
    let software_flag = DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32;
    for index in 0..64 {
        let adapter = match unsafe { factory.EnumAdapters1(index) } {
            Ok(adapter) => adapter,
            Err(error) if error.code() == DXGI_ERROR_NOT_FOUND => break,
            Err(_) => break,
        };
        let Ok(desc) = (unsafe { adapter.GetDesc1() }) else {
            continue;
        };
        if (desc.Flags & software_flag) != 0 || desc.VendorId == 0x1414 {
            continue;
        }
        let end = desc
            .Description
            .iter()
            .position(|&ch| ch == 0)
            .unwrap_or(desc.Description.len());
        let name = String::from_utf16_lossy(&desc.Description[..end])
            .trim()
            .to_string();
        if !name.is_empty() || desc.VendorId != 0 {
            adapters.push(GpuAdapter {
                vendor_id: Some(desc.VendorId),
                name,
            });
        }
    }
    adapters
}

#[cfg(target_os = "linux")]
fn probe_platform_adapters() -> Vec<GpuAdapter> {
    use std::{fs, path::Path};

    let drm_root = Path::new("/sys/class/drm");
    let Ok(entries) = fs::read_dir(drm_root) else {
        return Vec::new();
    };

    let mut adapters = Vec::new();
    for entry in entries.flatten() {
        let card_name = entry.file_name();
        let card_str = card_name.to_string_lossy();
        if !card_str.starts_with("card") || card_str.contains('-') {
            continue;
        }
        let device_dir = entry.path().join("device");
        let Ok(raw_vendor) = fs::read_to_string(device_dir.join("vendor")) else {
            continue;
        };
        let parsed_vendor = u32::from_str_radix(raw_vendor.trim().trim_start_matches("0x"), 16).ok();
        let product_name = fs::read_to_string(device_dir.join("product_name"))
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let name = product_name.unwrap_or_else(|| {
            canonical_vendor_token(parsed_vendor)
                .unwrap_or_default()
                .to_string()
        });
        if parsed_vendor.is_some() || !name.is_empty() {
            adapters.push(GpuAdapter {
                vendor_id: parsed_vendor,
                name,
            });
        }
    }
    adapters
}

#[cfg(not(any(windows, target_os = "linux")))]
fn probe_platform_adapters() -> Vec<GpuAdapter> {
    Vec::new()
}

const fn canonical_vendor_token(vendor_id: Option<u32>) -> Option<&'static str> {
    match vendor_id {
        Some(0x10de) => Some("nvidia"),
        Some(0x1002) => Some("amd"),
        Some(0x8086) => Some("intel"),
        _ => None,
    }
}

pub fn detect_gpu_adapters() -> &'static [GpuAdapter] {
    GPU_ADAPTERS.get_or_init(probe_platform_adapters).as_slice()
}

pub(super) fn collect_gpu_vendors() -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for adapter in detect_gpu_adapters() {
        let trimmed = adapter.name.trim();
        let entry = match canonical_vendor_token(adapter.vendor_id) {
            Some(vendor) if !trimmed.to_ascii_lowercase().contains(vendor) => {
                if trimmed.is_empty() {
                    vendor.to_string()
                } else {
                    format!("{vendor} {trimmed}")
                }
            }
            _ => trimmed.to_string(),
        };
        if !entry.is_empty() && seen.insert(entry.clone()) {
            out.push(entry);
        }
    }
    out
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
    if !is_nvidia_vendor(vendor) {
        return false;
    }
    if vendor.contains("ven_") || vendor.contains("dev_") || vendor.contains("subsys_") {
        return false;
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_pascal_matches_adapter_description_only() {
        assert!(is_legacy_nvidia_descriptor("nvidia geforce gtx 1080 ti"));
        assert!(is_legacy_nvidia_descriptor("nvidia geforce gtx 1060 6gb"));
        assert!(!is_legacy_nvidia_descriptor("nvidia geforce rtx 4070"));
        assert!(!is_legacy_nvidia_descriptor(
            "pci\\ven_10de&dev_2684&subsys_106010de"
        ));
        assert!(!is_legacy_nvidia_descriptor("radeon rx 1060m mock"));
        assert!(is_amd_vendor("amd radeon rx 7800 xt"));
    }
}
