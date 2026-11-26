use std::{
    collections::{HashMap, HashSet},
    env, fs,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};

use futures_util::StreamExt;
use tauri::{AppHandle, Runtime};

use crate::runtime::manifest_trust::{
    PINNED_ARTIFACTS_PUBKEY, ensure_runtime_archive_url, validate_manifest_relative_path,
    verify_artifacts_manifest_signature,
};
use crate::runtime::profiles::{
    MiniBackendRuntimeArtifactOption, MiniBackendRuntimePatch, MiniBackendRuntimeSelection,
    MiniBackendRuntimeStore, RUNTIME_DOWNLOAD_DIR, RUNTIME_DOWNLOAD_RETRY_COUNT, RuntimeError,
    artifact_profile_order, ensure_runtime_disk_space, estimate_runtime_install_required_bytes,
    existing_download_bytes, is_retryable_error, is_retryable_status, node_arch, node_platform,
    now_millis, patch_runtime_state, progress_snapshot, resolve_artifacts_url,
    resolve_runtime_transfer_timeout, sanitize_profile, sha512_base64_file,
    write_runtime_selection,
};

use super::{
    gc::sweep_layered_runtimes,
    manifest::{
        LayeredArtifactPart, LayeredOverlayDescriptor, LayeredRuntimeManifest, LayeredStateLedger,
        engine_install_dir, ensure_manifest_schema_v3, read_layered_state,
        resolve_layered_manifest_url, runtimes_root_dir, validate_safe_subpath,
        write_layered_state,
    },
    overlay::{
        ensure_bundled_overlay_seeded, extract_verified_overlay_atomic, is_overlay_dir_valid,
        read_bundled_overlay_metadata, verify_overlay_download_url,
    },
    tar_zst::{extract_tar_zst_file, sha256_hex_file},
};

const PROGRESS_EMIT_INTERVAL: Duration = Duration::from_millis(100);
const CHUNK_IDLE_TIMEOUT: Duration = Duration::from_secs(30);

pub(crate) enum LayeredManifestFetch {
    Found(String, Box<LayeredRuntimeManifest>),
    NotFound,
}

pub(crate) async fn fetch_layered_manifest<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    silent: bool,
) -> Result<LayeredManifestFetch, RuntimeError> {
    let raw_url = resolve_artifacts_url(app)?;
    let Some(manifest_url) =
        resolve_layered_manifest_url(raw_url.as_deref(), node_platform(), node_arch())
    else {
        return Ok(LayeredManifestFetch::NotFound);
    };

    if !silent {
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("checking".to_string()),
                status_message: Some(Some("Checking layered runtime manifest.".to_string())),
                runtime_manifest_url: Some(Some(manifest_url.clone())),
                ..Default::default()
            },
        )?;
    }

    let client = crate::security::cert_pinning::pinned_http_client(app, Duration::from_secs(30))
        .map_err(|error| RuntimeError::Message(error.to_string()))?;

    for attempt in 1..=RUNTIME_DOWNLOAD_RETRY_COUNT + 1 {
        match client
            .get(&manifest_url)
            .timeout(Duration::from_secs(30))
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                let body = response.text().await?;
                if let Some(public_key) =
                    PINNED_ARTIFACTS_PUBKEY.filter(|key| !key.trim().is_empty())
                {
                    let signature_url = format!("{manifest_url}.sig");
                    let sig_res = client
                        .get(&signature_url)
                        .timeout(Duration::from_secs(30))
                        .send()
                        .await?;
                    if !sig_res.status().is_success() {
                        return Err(RuntimeError::Integrity(format!(
                            "layered runtime manifest signature unavailable (HTTP {})",
                            sig_res.status()
                        )));
                    }
                    let signature = sig_res.text().await?;
                    verify_artifacts_manifest_signature(public_key, body.as_bytes(), &signature)?;
                }
                let manifest: LayeredRuntimeManifest = serde_json::from_str(&body)?;
                ensure_manifest_schema_v3(&manifest)?;
                return Ok(LayeredManifestFetch::Found(
                    manifest_url,
                    Box::new(manifest),
                ));
            }
            Ok(response) if matches!(response.status().as_u16(), 404 | 410) => {
                return Ok(LayeredManifestFetch::NotFound);
            }
            Ok(response) if is_retryable_status(response.status().as_u16()) => {
                if !silent && attempt <= RUNTIME_DOWNLOAD_RETRY_COUNT {
                    patch_runtime_state(
                        app,
                        store,
                        MiniBackendRuntimePatch {
                            last_error: Some(Some(format!("HTTP {}", response.status()))),
                            attempt: Some(attempt + 1),
                            max_attempts: Some(RUNTIME_DOWNLOAD_RETRY_COUNT + 1),
                            ..Default::default()
                        },
                    )?;
                }
            }
            Ok(response) => {
                let message = format!("HTTP {}", response.status());
                if !silent {
                    patch_runtime_state(
                        app,
                        store,
                        MiniBackendRuntimePatch {
                            last_error: Some(Some(format!(
                                "Failed to read layered runtime manifest: {message}"
                            ))),
                            ..Default::default()
                        },
                    )?;
                }
                return Ok(LayeredManifestFetch::NotFound);
            }
            Err(error) => {
                if attempt > RUNTIME_DOWNLOAD_RETRY_COUNT {
                    if !silent {
                        patch_runtime_state(
                            app,
                            store,
                            MiniBackendRuntimePatch {
                                last_error: Some(Some(format!(
                                    "Failed to read layered runtime manifest: {error}"
                                ))),
                                ..Default::default()
                            },
                        )?;
                    }
                    return Ok(LayeredManifestFetch::NotFound);
                }
            }
        }
        if attempt <= RUNTIME_DOWNLOAD_RETRY_COUNT {
            tokio::time::sleep(Duration::from_millis(1_000 * u64::from(attempt))).await;
        }
    }

    Ok(LayeredManifestFetch::NotFound)
}

#[allow(clippy::too_many_arguments)]
pub(crate) async fn download_file_with_resume<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    profile: &str,
    file_label: &str,
    url: &str,
    output_path: &Path,
    expected_size: u64,
    completed_bytes: u64,
    total_bytes: u64,
) -> Result<(), RuntimeError> {
    let max_attempts = RUNTIME_DOWNLOAD_RETRY_COUNT + 1;
    for attempt in 1..=max_attempts {
        if store.is_cancelled() {
            return Err(RuntimeError::Message(
                "Runtime installation cancelled.".to_string(),
            ));
        }
        let existing = existing_download_bytes(output_path, expected_size)?;
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("downloading".to_string()),
                status_message: Some(Some(if existing > 0 {
                    format!(
                        "Resuming {profile} runtime part {file_label} ({attempt}/{max_attempts})."
                    )
                } else {
                    format!(
                        "Downloading {profile} runtime part {file_label} ({attempt}/{max_attempts})."
                    )
                })),
                last_error: Some(None),
                attempt: Some(attempt),
                max_attempts: Some(max_attempts),
                progress: Some(Some(progress_snapshot(
                    completed_bytes + existing,
                    total_bytes,
                    0.0,
                ))),
                ..Default::default()
            },
        )?;

        match download_once_with_resume(
            app,
            store,
            url,
            output_path,
            expected_size,
            completed_bytes,
            total_bytes,
        )
        .await
        {
            Ok(()) => return Ok(()),
            Err(error) => {
                if attempt >= max_attempts || !is_retryable_error(&error) {
                    return Err(error);
                }
                patch_runtime_state(
                    app,
                    store,
                    MiniBackendRuntimePatch {
                        last_error: Some(Some(error.to_string())),
                        attempt: Some(attempt + 1),
                        max_attempts: Some(max_attempts),
                        ..Default::default()
                    },
                )?;
                tokio::time::sleep(Duration::from_millis(1_000 * u64::from(attempt))).await;
            }
        }
    }
    Err(RuntimeError::Message(
        "Runtime download failed.".to_string(),
    ))
}

async fn download_once_with_resume<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    archive_url: &str,
    output_path: &Path,
    expected_size: u64,
    completed_bytes: u64,
    total_bytes: u64,
) -> Result<(), RuntimeError> {
    use std::io::Write;

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let client = crate::security::cert_pinning::pinned_http_client(
        app,
        resolve_runtime_transfer_timeout(expected_size),
    )
    .map_err(|error| RuntimeError::Message(error.to_string()))?;
    let mut request = client
        .get(archive_url)
        .timeout(resolve_runtime_transfer_timeout(expected_size));
    let existing = existing_download_bytes(output_path, expected_size)?;
    if existing > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={existing}-"));
    }
    let response = request.send().await?;
    if !response.status().is_success() {
        return Err(RuntimeError::Message(format!("HTTP {}", response.status())));
    }
    let can_append = existing > 0 && response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    if existing > 0 && !can_append {
        fs::remove_file(output_path)?;
    }
    let file = fs::OpenOptions::new()
        .create(true)
        .append(can_append)
        .write(true)
        .truncate(!can_append)
        .open(output_path)?;
    let mut writer = std::io::BufWriter::with_capacity(256 * 1024, file);

    let started_at = now_millis();
    let mut transferred = if can_append { existing } else { 0 };
    let mut session_bytes: u64 = 0;
    let mut last_emit = Instant::now();
    let mut stream = response.bytes_stream();

    while let Some(chunk_res) = tokio::time::timeout(CHUNK_IDLE_TIMEOUT, stream.next())
        .await
        .map_err(|_| RuntimeError::Message("HTTP 408 download chunk timed out after 30s.".into()))?
    {
        if store.is_cancelled() {
            writer.flush()?;
            return Err(RuntimeError::Message(
                "Runtime installation cancelled.".to_string(),
            ));
        }
        let chunk = chunk_res?;
        writer.write_all(&chunk)?;
        let len = chunk.len() as u64;
        transferred += len;
        session_bytes += len;

        if last_emit.elapsed() >= PROGRESS_EMIT_INTERVAL {
            last_emit = Instant::now();
            let elapsed = ((now_millis().saturating_sub(started_at)).max(1) as f64) / 1000.0;
            let speed = (session_bytes as f64 / elapsed).round();
            patch_runtime_state(
                app,
                store,
                MiniBackendRuntimePatch {
                    status: Some("downloading".to_string()),
                    progress: Some(Some(progress_snapshot(
                        completed_bytes + transferred,
                        total_bytes,
                        speed,
                    ))),
                    last_error: Some(None),
                    ..Default::default()
                },
            )?;
        }
    }
    writer.flush()?;
    let elapsed = ((now_millis().saturating_sub(started_at)).max(1) as f64) / 1000.0;
    let speed = (session_bytes as f64 / elapsed).round();
    patch_runtime_state(
        app,
        store,
        MiniBackendRuntimePatch {
            status: Some("downloading".to_string()),
            progress: Some(Some(progress_snapshot(
                completed_bytes + transferred,
                total_bytes,
                speed,
            ))),
            last_error: Some(None),
            ..Default::default()
        },
    )?;
    Ok(())
}

fn verify_part_checksum(path: &Path, part: &LayeredArtifactPart) -> Result<(), RuntimeError> {
    if !part.sha512.trim().is_empty() && sha512_base64_file(path)? != part.sha512.trim() {
        return Err(RuntimeError::Integrity(format!(
            "Runtime part sha512 mismatch: {}",
            part.file
        )));
    }
    if !part.sha256.trim().is_empty()
        && !sha256_hex_file(path)?.eq_ignore_ascii_case(part.sha256.trim())
    {
        return Err(RuntimeError::Integrity(format!(
            "Runtime part sha256 mismatch: {}",
            part.file
        )));
    }
    Ok(())
}

pub(crate) struct OverlayProgressWindow {
    pub completed_bytes: u64,
    pub total_bytes: u64,
}

pub(crate) async fn ensure_remote_overlay_installed<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    runtimes_root: &Path,
    manifest_url: &str,
    overlay: &LayeredOverlayDescriptor,
    profile: &str,
    progress: OverlayProgressWindow,
) -> Result<String, RuntimeError> {
    verify_overlay_download_url(manifest_url, overlay)?;
    let target_dir = super::manifest::overlay_install_dir(runtimes_root, &overlay.overlay_hash)?;
    if is_overlay_dir_valid(&target_dir, &overlay.entry, &overlay.required_files) {
        return Ok(overlay.overlay_hash.clone());
    }

    let temp_dir = env::temp_dir().join(RUNTIME_DOWNLOAD_DIR);
    let archive_path = temp_dir.join(&overlay.file);
    let cached_valid = fs::metadata(&archive_path).map(|meta| meta.len()).ok()
        == Some(overlay.size)
        && !overlay.sha256.trim().is_empty()
        && sha256_hex_file(&archive_path)?.eq_ignore_ascii_case(overlay.sha256.trim());

    if !cached_valid {
        download_file_with_resume(
            app,
            store,
            profile,
            &overlay.file,
            &overlay.url,
            &archive_path,
            overlay.size,
            progress.completed_bytes,
            progress.total_bytes,
        )
        .await?;
    }

    let archive_clone = archive_path.clone();
    let expected_sha256 = overlay.sha256.clone();
    let expected_sha512 = overlay.sha512.clone();
    let root_clone = runtimes_root.to_path_buf();
    let hash_clone = overlay.overlay_hash.clone();
    let entry_clone = overlay.entry.clone();
    let req_clone = overlay.required_files.clone();
    let file_clone = overlay.file.clone();

    tokio::task::spawn_blocking(move || {
        if !expected_sha512.trim().is_empty()
            && sha512_base64_file(&archive_clone)? != expected_sha512.trim()
        {
            return Err(RuntimeError::Integrity(format!(
                "Backend overlay sha512 mismatch: {file_clone}"
            )));
        }
        extract_verified_overlay_atomic(
            &archive_clone,
            &expected_sha256,
            &root_clone,
            &hash_clone,
            &entry_clone,
            &req_clone,
        )?;
        let _ = fs::remove_file(&archive_clone);
        Ok::<(), RuntimeError>(())
    })
    .await
    .map_err(|error| RuntimeError::Message(error.to_string()))??;

    Ok(overlay.overlay_hash.clone())
}

pub(crate) async fn install_layered_runtime_from_manifest<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    manifest_url: &str,
    manifest: &LayeredRuntimeManifest,
    profile: &str,
) -> Result<Option<(String, String)>, RuntimeError> {
    if manifest.platform != node_platform() || manifest.arch != node_arch() {
        let message = format!(
            "Runtime manifest platform mismatch: manifest is {}/{}, build is {}/{}.",
            manifest.platform,
            manifest.arch,
            node_platform(),
            node_arch()
        );
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("fallback".to_string()),
                status_message: Some(Some(message.clone())),
                runtime_manifest_url: Some(Some(manifest_url.to_string())),
                last_error: Some(Some(message)),
                ..Default::default()
            },
        )?;
        return Ok(None);
    }

    let Some(record) = manifest.profiles.get(profile).cloned() else {
        let message = format!("Runtime profile not available in manifest: {profile}");
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("fallback".to_string()),
                status_message: Some(Some(message.clone())),
                runtime_manifest_url: Some(Some(manifest_url.to_string())),
                last_error: Some(Some(message)),
                ..Default::default()
            },
        )?;
        return Ok(None);
    };

    validate_manifest_relative_path(&record.engine_abi)?;
    validate_manifest_relative_path(&record.engine_version)?;
    let python_rel = validate_safe_subpath(&record.python_entry)?;
    for part in &record.parts {
        validate_manifest_relative_path(&part.file)?;
        ensure_runtime_archive_url(manifest_url, &part.url)?;
    }
    verify_overlay_download_url(manifest_url, &manifest.overlay)?;

    let runtimes_root = runtimes_root_dir(app)?;
    let engine_dir = engine_install_dir(
        &runtimes_root,
        &record.engine_abi,
        &record.engine_version,
        profile,
    )?;
    let python_bin = engine_dir.join(&python_rel);
    let temp_dir = env::temp_dir().join(RUNTIME_DOWNLOAD_DIR);
    let temp_extract_dir = PathBuf::from(format!("{}.tmp", engine_dir.to_string_lossy()));
    let part_paths: Vec<PathBuf> = record
        .parts
        .iter()
        .map(|part| temp_dir.join(&part.file))
        .collect();
    let total_bytes = record.total_part_bytes() + manifest.overlay.size;
    let first_url = record
        .parts
        .first()
        .map(|part| part.url.clone())
        .unwrap_or_default();

    let result: Result<String, RuntimeError> = async {
        let mut completed_bytes: u64 = 0;
        if !python_bin.is_file() {
            let existing_part_bytes: u64 = record
                .parts
                .iter()
                .zip(&part_paths)
                .map(|(part, path)| {
                    fs::metadata(path)
                        .map(|meta| meta.len().min(part.size))
                        .unwrap_or(0)
                })
                .sum();
            let required_bytes = estimate_runtime_install_required_bytes(0)
                .max(total_bytes.saturating_mul(2))
                .saturating_sub(existing_part_bytes);
            let disk_targets: Vec<&Path> = part_paths
                .iter()
                .map(PathBuf::as_path)
                .chain(std::iter::once(engine_dir.as_path()))
                .collect();
            ensure_runtime_disk_space(&disk_targets, required_bytes)?;

            for (part, part_path) in record.parts.iter().zip(&part_paths) {
                let already_ok = fs::metadata(part_path).map(|m| m.len()).ok() == Some(part.size)
                    && verify_part_checksum(part_path, part).is_ok();
                if already_ok {
                    completed_bytes += part.size;
                    continue;
                }
                download_file_with_resume(
                    app,
                    store,
                    profile,
                    &part.file,
                    &part.url,
                    part_path,
                    part.size,
                    completed_bytes,
                    total_bytes,
                )
                .await?;
                patch_runtime_state(
                    app,
                    store,
                    MiniBackendRuntimePatch {
                        status: Some("verifying".to_string()),
                        status_message: Some(Some(format!(
                            "Verifying {profile} runtime part {}.",
                            part.file
                        ))),
                        ..Default::default()
                    },
                )?;
                let part_check_path = part_path.clone();
                let part_clone = part.clone();
                tokio::task::spawn_blocking(move || {
                    verify_part_checksum(&part_check_path, &part_clone)
                })
                .await
                .map_err(|error| RuntimeError::Message(error.to_string()))??;
                completed_bytes += part.size;
            }

            patch_runtime_state(
                app,
                store,
                MiniBackendRuntimePatch {
                    status: Some("extracting".to_string()),
                    status_message: Some(Some(format!(
                        "Extracting {profile} runtime engine ({} part{}).",
                        record.parts.len(),
                        if record.parts.len() == 1 { "" } else { "s" }
                    ))),
                    ..Default::default()
                },
            )?;

            let tmp_clone = temp_extract_dir.clone();
            let parts_clone = part_paths.clone();
            let py_rel_clone = python_rel.clone();
            let engine_dir_clone = engine_dir.clone();
            tokio::task::spawn_blocking(move || {
                if tmp_clone.exists() {
                    fs::remove_dir_all(&tmp_clone)?;
                }
                for part_path in &parts_clone {
                    extract_tar_zst_file(part_path, &tmp_clone)?;
                }
                let staged_python = tmp_clone.join(&py_rel_clone);
                if !staged_python.is_file() {
                    return Err(RuntimeError::Integrity(format!(
                        "extracted engine missing python entry: {}",
                        py_rel_clone.display()
                    )));
                }
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let mut perms = fs::metadata(&staged_python)?.permissions();
                    if perms.mode() & 0o111 == 0 {
                        perms.set_mode(perms.mode() | 0o755);
                        fs::set_permissions(&staged_python, perms)?;
                    }
                }
                if let Some(parent) = engine_dir_clone.parent() {
                    fs::create_dir_all(parent)?;
                }
                if engine_dir_clone.exists() {
                    fs::remove_dir_all(&engine_dir_clone)?;
                }
                fs::rename(&tmp_clone, &engine_dir_clone)?;
                Ok::<(), RuntimeError>(())
            })
            .await
            .map_err(|error| RuntimeError::Message(error.to_string()))??;

            for part_path in &part_paths {
                let _ = fs::remove_file(part_path);
            }
        } else {
            completed_bytes = record.total_part_bytes();
        }

        let bundled_hash = ensure_bundled_overlay_seeded(app, &runtimes_root)?;
        let active_overlay_hash = match ensure_remote_overlay_installed(
            app,
            store,
            &runtimes_root,
            manifest_url,
            &manifest.overlay,
            profile,
            OverlayProgressWindow {
                completed_bytes,
                total_bytes,
            },
        )
        .await
        {
            Ok(hash) => hash,
            Err(error) => {
                if let Some(fallback_hash) = bundled_hash {
                    log::warn!(
                        "failed to fetch remote overlay ({error}); using bundled offline overlay"
                    );
                    fallback_hash
                } else {
                    return Err(error);
                }
            }
        };

        Ok(active_overlay_hash)
    }
    .await;

    match result {
        Ok(active_overlay_hash) => {
            let ledger = LayeredStateLedger {
                schema_version: 3,
                active_profile: profile.to_string(),
                engine_abi: record.engine_abi.clone(),
                engine_version: record.engine_version.clone(),
                python_entry: record.python_entry.clone(),
                active_overlay_hash: active_overlay_hash.clone(),
                updated_at: now_millis(),
            };
            write_layered_state(&runtimes_root, &ledger)?;

            let composite_version =
                format!("engine-{}-{}", record.engine_abi, record.engine_version);
            write_runtime_selection(
                app,
                &MiniBackendRuntimeSelection {
                    profile: profile.to_string(),
                    version: composite_version.clone(),
                    entry: record.python_entry.clone(),
                },
            )?;

            let bundled_hash = read_bundled_overlay_metadata(app)
                .ok()
                .flatten()
                .map(|(meta, _)| meta.overlay_hash);
            let mut keep_overlays = vec![active_overlay_hash];
            if let Some(bundled) = bundled_hash {
                keep_overlays.push(bundled);
            }
            let gc_root = runtimes_root.clone();
            let gc_abi = record.engine_abi.clone();
            let gc_ver = record.engine_version.clone();
            let gc_prof = sanitize_profile(profile);
            tauri::async_runtime::spawn_blocking(move || {
                let _ = sweep_layered_runtimes(
                    &gc_root,
                    Some((&gc_abi, &gc_ver, &gc_prof)),
                    &keep_overlays,
                );
            });

            patch_runtime_state(
                app,
                store,
                MiniBackendRuntimePatch {
                    requested_profile: Some(profile.to_string()),
                    active_profile: Some(profile.to_string()),
                    source: Some("downloaded-runtime".to_string()),
                    runtime_manifest_url: Some(Some(manifest_url.to_string())),
                    runtime_archive_url: Some(Some(first_url)),
                    install_dir: Some(Some(engine_dir.to_string_lossy().to_string())),
                    version: Some(Some(composite_version.clone())),
                    last_error: Some(None),
                    status: Some("ready".to_string()),
                    status_message: Some(Some(format!(
                        "{profile} layered runtime installed successfully."
                    ))),
                    progress: Some(None),
                    attempt: Some(0),
                    max_attempts: Some(0),
                    ..Default::default()
                },
            )?;

            Ok(Some((composite_version, record.python_entry)))
        }
        Err(error) => {
            let _ = fs::remove_dir_all(&temp_extract_dir);
            let message = error.to_string();
            patch_runtime_state(
                app,
                store,
                MiniBackendRuntimePatch {
                    requested_profile: Some(profile.to_string()),
                    active_profile: Some("cpu".to_string()),
                    source: Some("no-runtime-installed".to_string()),
                    runtime_manifest_url: Some(Some(manifest_url.to_string())),
                    runtime_archive_url: Some(Some(first_url)),
                    install_dir: Some(None),
                    version: Some(None),
                    last_error: Some(Some(message.clone())),
                    status: Some("fallback".to_string()),
                    status_message: Some(Some(message.clone())),
                    progress: Some(None),
                    ..Default::default()
                },
            )?;
            log::warn!("mini-backend-runtime layered install failed: {message}");
            Ok(None)
        }
    }
}

pub(crate) async fn reconcile_startup_overlay<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<(), RuntimeError> {
    let runtimes_root = runtimes_root_dir(app)?;
    let _ = ensure_bundled_overlay_seeded(app, &runtimes_root);
    let Some(mut state) = read_layered_state(&runtimes_root)? else {
        return Ok(());
    };
    let LayeredManifestFetch::Found(manifest_url, manifest) =
        fetch_layered_manifest(app, store, true).await?
    else {
        return Ok(());
    };
    if manifest.engine_abi != state.engine_abi
        || manifest.overlay.overlay_hash == state.active_overlay_hash
    {
        return Ok(());
    }
    if let Ok(new_hash) = ensure_remote_overlay_installed(
        app,
        store,
        &runtimes_root,
        &manifest_url,
        &manifest.overlay,
        &state.active_profile,
        OverlayProgressWindow {
            completed_bytes: 0,
            total_bytes: manifest.overlay.size,
        },
    )
    .await
    {
        state.active_overlay_hash = new_hash.clone();
        state.updated_at = now_millis();
        let _ = write_layered_state(&runtimes_root, &state);
        let bundled = read_bundled_overlay_metadata(app)
            .ok()
            .flatten()
            .map(|(m, _)| m.overlay_hash);
        let mut keep = vec![new_hash];
        if let Some(b) = bundled {
            keep.push(b);
        }
        let abi = state.engine_abi.clone();
        let ver = state.engine_version.clone();
        let prof = sanitize_profile(&state.active_profile);
        let _ = sweep_layered_runtimes(&runtimes_root, Some((&abi, &ver, &prof)), &keep);
    }
    Ok(())
}

pub(crate) fn list_layered_artifact_options(
    runtimes_root: &Path,
    manifest: &LayeredRuntimeManifest,
    recommended_profile: Option<&str>,
) -> Vec<MiniBackendRuntimeArtifactOption> {
    let installed_profiles: HashSet<String> = manifest
        .profiles
        .values()
        .filter(|record| {
            let Ok(dir) = engine_install_dir(
                runtimes_root,
                &record.engine_abi,
                &record.engine_version,
                &record.profile,
            ) else {
                return false;
            };
            validate_safe_subpath(&record.python_entry)
                .map(|rel| dir.join(rel).is_file())
                .unwrap_or(false)
        })
        .map(|record| record.profile.clone())
        .collect();

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
            version: format!("engine-{}-{}", entry.engine_abi, entry.engine_version),
            size: entry.total_part_bytes() + manifest.overlay.size,
            installed: installed_profiles.contains(&entry.profile),
            recommended: recommended_profile == Some(entry.profile.as_str()),
        })
        .collect()
}
