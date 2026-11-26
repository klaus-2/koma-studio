use std::{
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    time::Duration,
};

use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use sha2::{Digest, Sha512};
use zip::ZipArchive;

use super::types::{
    MIN_RUNTIME_INSTALL_REQUIRED_BYTES, MiniBackendRuntimeProgress,
    RUNTIME_RETRYABLE_HTTP_STATUSES, RuntimeError,
};

pub(crate) fn progress_snapshot(
    transferred_bytes: u64,
    total_bytes: u64,
    speed_bytes_per_second: f64,
) -> MiniBackendRuntimeProgress {
    let resolved_total = total_bytes.max(transferred_bytes);
    MiniBackendRuntimeProgress {
        transferred_bytes,
        total_bytes: resolved_total,
        percent: if resolved_total > 0 {
            ((transferred_bytes as f64 / resolved_total as f64) * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        },
        speed_bytes_per_second,
    }
}

pub(crate) fn existing_download_bytes(
    output_path: &Path,
    expected_total_bytes: u64,
) -> Result<u64, RuntimeError> {
    if !output_path.exists() {
        return Ok(0);
    }
    let size = output_path.metadata()?.len();
    if expected_total_bytes > 0 && size >= expected_total_bytes {
        fs::remove_file(output_path)?;
        return Ok(0);
    }
    Ok(size)
}

pub(crate) fn ensure_runtime_disk_space(
    targets: &[&Path],
    required_bytes: u64,
) -> Result<(), RuntimeError> {
    for target in targets {
        let stat_path = existing_ancestor(target).ok_or_else(|| {
            RuntimeError::Message(format!(
                "Could not resolve the disk for {}.",
                target.display()
            ))
        })?;
        let free = fs2::available_space(&stat_path)?;
        if free < required_bytes {
            return Err(RuntimeError::Message(format!(
                "Insufficient disk space for the runtime. Required: {:.1} GB | Available: {:.1} GB.",
                required_bytes as f64 / 1024_f64.powi(3),
                free as f64 / 1024_f64.powi(3)
            )));
        }
    }
    Ok(())
}

pub(crate) fn estimate_runtime_install_required_bytes(archive_bytes: u64) -> u64 {
    MIN_RUNTIME_INSTALL_REQUIRED_BYTES.max(archive_bytes.saturating_mul(3))
}

fn existing_ancestor(path: &Path) -> Option<PathBuf> {
    let mut current = path.parent()?.to_path_buf();
    loop {
        if current.exists() {
            return Some(current);
        }
        let parent = current.parent()?.to_path_buf();
        if parent == current {
            return None;
        }
        current = parent;
    }
}

pub(crate) fn sha512_base64_file(path: &Path) -> Result<String, RuntimeError> {
    let mut file = File::open(path)?;
    let mut hasher = Sha512::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(BASE64.encode(hasher.finalize()))
}

pub(super) fn extract_runtime_archive(
    archive_path: &Path,
    destination_dir: &Path,
) -> Result<(), RuntimeError> {
    fs::create_dir_all(destination_dir)?;
    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let Some(enclosed_name) = entry.enclosed_name() else {
            continue;
        };
        let output_path = destination_dir.join(enclosed_name);
        if entry.is_dir() {
            fs::create_dir_all(&output_path)?;
            continue;
        }
        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = File::create(&output_path)?;
        std::io::copy(&mut entry, &mut output)?;
        #[cfg(unix)]
        if let Some(mode) = entry.unix_mode().filter(|mode| *mode & 0o111 != 0) {
            use std::os::unix::fs::PermissionsExt;
            let mut permissions = fs::metadata(&output_path)?.permissions();
            permissions.set_mode(mode);
            fs::set_permissions(&output_path, permissions)?;
        }
    }
    Ok(())
}

pub(crate) fn resolve_runtime_transfer_timeout(expected_total_bytes: u64) -> Duration {
    if expected_total_bytes == 0 {
        return Duration::from_secs(2 * 60 * 60);
    }
    let transfer_seconds = expected_total_bytes.div_ceil(1024 * 1024);
    Duration::from_secs((transfer_seconds + 5 * 60).clamp(30 * 60, 8 * 60 * 60))
}

pub(crate) fn is_retryable_status(status: u16) -> bool {
    RUNTIME_RETRYABLE_HTTP_STATUSES.contains(&status)
}

pub(crate) fn is_retryable_error(error: &RuntimeError) -> bool {
    match error {
        RuntimeError::Integrity(_) => false,
        RuntimeError::Io(_) => false,
        RuntimeError::Http(_) => true,
        RuntimeError::Message(message) => is_retryable_message(message),
        _ => false,
    }
}

fn is_retryable_message(message: &str) -> bool {
    let lower = message.to_ascii_lowercase();
    RUNTIME_RETRYABLE_HTTP_STATUSES
        .iter()
        .any(|status| lower.contains(&format!("http {status}")))
}
