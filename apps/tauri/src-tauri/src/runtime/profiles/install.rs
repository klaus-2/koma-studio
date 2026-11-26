use super::*;
use crate::runtime::layered::{
    install::{
        LayeredManifestFetch, download_file_with_resume, fetch_layered_manifest,
        install_layered_runtime_from_manifest, list_layered_artifact_options,
        reconcile_startup_overlay,
    },
    manifest::runtimes_root_dir,
    resolve_active_layered_runtime,
};
use crate::runtime::manifest_trust::{
    PINNED_ARTIFACTS_PUBKEY, ensure_runtime_archive_url, validate_manifest_relative_path,
    verify_artifacts_manifest_signature,
};

pub(super) async fn install_recommended_runtime<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<MiniBackendRuntimeInstallResult, RuntimeError> {
    let profile = resolve_runtime_profile(app, store, false, false)?;
    if cfg!(debug_assertions) {
        set_manual_install_blocked(app, store, "dev-only-unavailable", &profile)?;
        return Ok(install_result(
            false,
            &profile,
            "runtime_manual_install_dev_only_unavailable",
        ));
    }
    if profile == "cpu" && crate::sidecar::mini_backend::embedded_mini_backend_enabled() {
        set_manual_install_blocked(app, store, "cpu-not-required", &profile)?;
        return Ok(install_result(
            false,
            &profile,
            "runtime_manual_install_cpu_not_required",
        ));
    }

    install_and_restart(app, store, &profile, true).await
}

pub(super) async fn install_runtime_profile<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    profile_input: &str,
) -> Result<MiniBackendRuntimeInstallResult, RuntimeError> {
    let profile = normalize_profile_override(Some(profile_input.to_string()));
    if profile == "auto" {
        return Ok(install_result(
            false,
            profile_input,
            "runtime_manual_install_invalid_profile",
        ));
    }
    if cfg!(debug_assertions) {
        set_manual_install_blocked(app, store, "dev-only-unavailable", &profile)?;
        return Ok(install_result(
            false,
            &profile,
            "runtime_manual_install_dev_only_unavailable",
        ));
    }

    install_and_restart(app, store, &profile, true).await
}

pub(crate) async fn ensure_startup_runtime<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<bool, RuntimeError> {
    if resolve_active_layered_runtime(app, None)?.is_some() {
        if let Err(error) = reconcile_startup_overlay(app, store).await {
            log::warn!("mini-backend-runtime: startup overlay reconcile skipped: {error}");
        }
        return Ok(true);
    }

    if resolve_selected_runtime_binary_path(app)?.is_some() {
        return Ok(true);
    }

    let profile = resolve_runtime_profile(app, store, false, false)?;
    if install_startup_runtime_selection(app, store, &profile).await? {
        return Ok(true);
    }

    if profile != "cpu" && install_startup_runtime_selection(app, store, "cpu").await? {
        return Ok(true);
    }

    let snapshot = snapshot_runtime_state(app, store)?;
    let message = if snapshot.runtime_artifacts_url.is_none() {
        "Thin release has no embedded mini-backend and no runtime artifact URL is configured."
    } else {
        "Thin release has no embedded mini-backend and no downloadable runtime could be installed."
    };
    patch_runtime_state(
        app,
        store,
        MiniBackendRuntimePatch {
            status: Some("error".to_string()),
            status_message: Some(Some(message.to_string())),
            requested_profile: Some(profile),
            active_profile: Some("cpu".to_string()),
            source: Some("downloaded-runtime".to_string()),
            last_error: Some(Some(message.to_string())),
            progress: Some(None),
            ..Default::default()
        },
    )?;
    Ok(false)
}

async fn install_startup_runtime_selection<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    profile: &str,
) -> Result<bool, RuntimeError> {
    let Some(installed) = ensure_downloaded_runtime(app, store, profile, true).await? else {
        return Ok(false);
    };

    write_runtime_selection(
        app,
        &MiniBackendRuntimeSelection {
            profile: profile.to_string(),
            version: installed.version,
            entry: installed.entry,
        },
    )?;
    Ok(true)
}

async fn install_and_restart<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    profile: &str,
    allow_cpu_download: bool,
) -> Result<MiniBackendRuntimeInstallResult, RuntimeError> {
    let Some(installed) =
        ensure_downloaded_runtime(app, store, profile, allow_cpu_download).await?
    else {
        let reason = snapshot_runtime_state(app, store)?
            .last_error
            .unwrap_or_else(|| "runtime_manual_install_failed".to_string());
        return Ok(MiniBackendRuntimeInstallResult {
            ok: false,
            profile: profile.to_string(),
            reason: Some(reason),
        });
    };

    write_runtime_selection(
        app,
        &MiniBackendRuntimeSelection {
            profile: profile.to_string(),
            version: installed.version,
            entry: installed.entry,
        },
    )?;
    crate::sidecar::mini_backend::restart_mini_backend(app.clone())
        .await
        .map_err(RuntimeError::Message)?;
    Ok(MiniBackendRuntimeInstallResult {
        ok: true,
        profile: profile.to_string(),
        reason: None,
    })
}

#[derive(Debug, Clone)]
struct InstalledRuntime {
    version: String,
    entry: String,
}

async fn ensure_downloaded_runtime<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    profile: &str,
    allow_cpu_download: bool,
) -> Result<Option<InstalledRuntime>, RuntimeError> {
    if profile == "cpu" && !allow_cpu_download {
        return Ok(None);
    }

    match fetch_layered_manifest(app, store, false).await? {
        LayeredManifestFetch::Found(manifest_url, manifest) => {
            return Ok(
                install_layered_runtime_from_manifest(app, store, &manifest_url, &manifest, profile)
                    .await?
                    .map(|(version, entry)| InstalledRuntime { version, entry }),
            );
        }
        LayeredManifestFetch::NotFound => {}
    }

    let manifest_url = match resolve_manifest_url(app)? {
        Some(url) => url,
        None => return Ok(None),
    };
    let Some(manifest) = read_runtime_manifest(app, store, false).await? else {
        return Ok(None);
    };

    let fail_to_fallback = |message: String| -> Result<Option<InstalledRuntime>, RuntimeError> {
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("fallback".to_string()),
                status_message: Some(Some(message.clone())),
                runtime_manifest_url: Some(Some(manifest_url.clone())),
                last_error: Some(Some(message)),
                ..Default::default()
            },
        )?;
        Ok(None)
    };

    if !is_manifest_for_current_platform(&manifest) {
        return fail_to_fallback(format!(
            "Runtime manifest platform mismatch: manifest is {}/{}, build is {}/{}.",
            manifest.platform,
            manifest.arch,
            node_platform(),
            node_arch()
        ));
    }

    let Some(record) = manifest.profiles.get(profile).cloned() else {
        return fail_to_fallback(format!("Runtime profile not available in manifest: {profile}"));
    };

    validate_manifest_relative_path(&manifest.version)?;
    validate_manifest_relative_path(&record.entry)?;
    for part in &record.parts {
        validate_manifest_relative_path(&part.file)?;
        ensure_runtime_archive_url(&manifest_url, &part.url)?;
    }
    let install_dir = runtime_install_dir(app, &manifest.version, profile)?;
    let binary_path = install_dir.join(&record.entry);
    let archive_url = record
        .parts
        .first()
        .map(|part| part.url.clone())
        .unwrap_or_default();
    if binary_path.exists() {
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                requested_profile: Some(profile.to_string()),
                active_profile: Some(profile.to_string()),
                source: Some("downloaded-runtime".to_string()),
                runtime_manifest_url: Some(Some(manifest_url)),
                runtime_archive_url: Some(Some(archive_url)),
                install_dir: Some(Some(install_dir.to_string_lossy().to_string())),
                version: Some(Some(manifest.version.clone())),
                last_error: Some(None),
                status: Some("ready".to_string()),
                status_message: Some(Some(format!("{profile} runtime ready."))),
                attempt: Some(0),
                max_attempts: Some(0),
                progress: Some(None),
                ..Default::default()
            },
        )?;
        return Ok(Some(InstalledRuntime {
            version: manifest.version,
            entry: record.entry,
        }));
    }

    let temp_dir = env::temp_dir().join(RUNTIME_DOWNLOAD_DIR);
    let temp_extract_dir = PathBuf::from(format!("{}.tmp", install_dir.to_string_lossy()));
    let part_paths: Vec<PathBuf> = record
        .parts
        .iter()
        .map(|part| temp_dir.join(&part.file))
        .collect();
    let total_bytes = record.total_part_bytes();
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
        .max(total_bytes.saturating_mul(3))
        .saturating_sub(existing_part_bytes);
    let disk_targets: Vec<&Path> = part_paths
        .iter()
        .map(PathBuf::as_path)
        .chain(std::iter::once(install_dir.as_path()))
        .collect();

    match async {
        ensure_runtime_disk_space(&disk_targets, required_bytes)?;
        let mut completed_bytes: u64 = 0;
        for (part, part_path) in record.parts.iter().zip(&part_paths) {
            if fs::metadata(part_path).map(|meta| meta.len()).ok() == Some(part.size)
                && sha512_base64_file(part_path)? == part.sha512
            {
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
            let check_path = part_path.clone();
            let actual_sha512 = tokio::task::spawn_blocking(move || sha512_base64_file(&check_path))
                .await
                .map_err(|error| RuntimeError::Message(error.to_string()))??;
            if actual_sha512 != part.sha512 {
                return Err(RuntimeError::Integrity(format!(
                    "Runtime part sha512 mismatch: {}",
                    part.file
                )));
            }
            completed_bytes += part.size;
        }

        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("extracting".to_string()),
                status_message: Some(Some(format!(
                    "Installing {profile} runtime ({} part{}).",
                    record.parts.len(),
                    if record.parts.len() == 1 { "" } else { "s" }
                ))),
                ..Default::default()
            },
        )?;
        let tmp_extract_clone = temp_extract_dir.clone();
        let parts_clone = part_paths.clone();
        let entry_clone = record.entry.clone();
        let install_clone = install_dir.clone();
        tokio::task::spawn_blocking(move || {
            if tmp_extract_clone.exists() {
                fs::remove_dir_all(&tmp_extract_clone)?;
            }
            for part_path in &parts_clone {
                extract_runtime_archive(part_path, &tmp_extract_clone)?;
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let entry_path = tmp_extract_clone.join(&entry_clone);
                let mut permissions = fs::metadata(&entry_path)?.permissions();
                if permissions.mode() & 0o111 == 0 {
                    permissions.set_mode(permissions.mode() | 0o755);
                    fs::set_permissions(&entry_path, permissions)?;
                }
            }
            #[cfg(not(unix))]
            let _ = entry_clone;
            if install_clone.exists() {
                fs::remove_dir_all(&install_clone)?;
            }
            fs::rename(&tmp_extract_clone, &install_clone)?;
            Ok::<(), RuntimeError>(())
        })
        .await
        .map_err(|error| RuntimeError::Message(error.to_string()))??;
        Ok::<(), RuntimeError>(())
    }
    .await
    {
        Ok(()) => {
            patch_runtime_state(
                app,
                store,
                MiniBackendRuntimePatch {
                    requested_profile: Some(profile.to_string()),
                    active_profile: Some(profile.to_string()),
                    source: Some("downloaded-runtime".to_string()),
                    runtime_manifest_url: Some(Some(manifest_url)),
                    runtime_archive_url: Some(Some(archive_url)),
                    install_dir: Some(Some(install_dir.to_string_lossy().to_string())),
                    version: Some(Some(manifest.version.clone())),
                    last_error: Some(None),
                    status: Some("ready".to_string()),
                    status_message: Some(Some(format!(
                        "{profile} runtime installed successfully."
                    ))),
                    progress: Some(None),
                    attempt: Some(0),
                    max_attempts: Some(0),
                    ..Default::default()
                },
            )?;
            for part_path in &part_paths {
                let _ = fs::remove_file(part_path);
            }
            Ok(Some(InstalledRuntime {
                version: manifest.version,
                entry: record.entry,
            }))
        }
        Err(error) => {
            let message = error.to_string();
            let _ = fs::remove_dir_all(&temp_extract_dir);
            patch_runtime_state(
                app,
                store,
                MiniBackendRuntimePatch {
                    requested_profile: Some(profile.to_string()),
                    active_profile: Some("cpu".to_string()),
                    source: Some("bundled-core".to_string()),
                    runtime_manifest_url: Some(Some(manifest_url)),
                    runtime_archive_url: Some(Some(archive_url)),
                    install_dir: Some(None),
                    version: Some(Some(manifest.version)),
                    last_error: Some(Some(message.clone())),
                    status: Some("fallback".to_string()),
                    status_message: Some(Some(format!(
                        "Failed to install {profile} runtime. Falling back to the embedded runtime."
                    ))),
                    progress: Some(None),
                    ..Default::default()
                },
            )?;
            log::warn!("mini-backend-runtime: {message}");
            Ok(None)
        }
    }
}

pub(super) async fn list_runtime_artifacts<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<Vec<MiniBackendRuntimeArtifactOption>, RuntimeError> {
    if let LayeredManifestFetch::Found(_url, manifest) =
        fetch_layered_manifest(app, store, true).await?
    {
        if manifest.platform != node_platform() || manifest.arch != node_arch() {
            return Ok(Vec::new());
        }
        let recommended = resolve_runtime_profile(app, store, true, true)?;
        let root = runtimes_root_dir(app)?;
        return Ok(list_layered_artifact_options(
            &root,
            &manifest,
            Some(&recommended),
        ));
    }

    let Some(manifest) = read_runtime_manifest(app, store, true).await? else {
        return Ok(Vec::new());
    };
    if !is_manifest_for_current_platform(&manifest) {
        return Ok(Vec::new());
    }
    let recommended = resolve_runtime_profile(app, store, true, true)?;
    let installed_profiles = manifest
        .profiles
        .values()
        .filter(|record| {
            runtime_install_dir(app, &manifest.version, &record.profile)
                .map(|dir| {
                    resolve_spawnable_runtime_binary(&dir, &record.profile, &record.entry).is_some()
                })
                .unwrap_or(false)
        })
        .map(|record| record.profile.clone())
        .collect::<HashSet<_>>();

    Ok(list_artifact_options(
        &manifest,
        Some(&recommended),
        &installed_profiles,
    ))
}

async fn read_runtime_manifest<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    silent: bool,
) -> Result<Option<MiniBackendRuntimeArtifactManifest>, RuntimeError> {
    let Some(manifest_url) = resolve_manifest_url(app)? else {
        return Ok(None);
    };
    if !silent {
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("checking".to_string()),
                status_message: Some(Some("Checking runtime artifact manifest.".to_string())),
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
                    let signature_response = client
                        .get(&signature_url)
                        .timeout(Duration::from_secs(30))
                        .send()
                        .await?;
                    if !signature_response.status().is_success() {
                        return Err(RuntimeError::Integrity(format!(
                            "runtime manifest signature unavailable (HTTP {})",
                            signature_response.status()
                        )));
                    }
                    let signature = signature_response.text().await?;
                    verify_artifacts_manifest_signature(public_key, body.as_bytes(), &signature)?;
                }
                let manifest: MiniBackendRuntimeArtifactManifest = serde_json::from_str(&body)?;
                ensure_manifest_schema_v2(&manifest)?;
                return Ok(Some(manifest));
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
                                "Failed to read runtime manifest: {message}"
                            ))),
                            ..Default::default()
                        },
                    )?;
                }
                return Ok(None);
            }
            Err(error) => {
                if attempt > RUNTIME_DOWNLOAD_RETRY_COUNT {
                    if !silent {
                        patch_runtime_state(
                            app,
                            store,
                            MiniBackendRuntimePatch {
                                last_error: Some(Some(format!(
                                    "Failed to read runtime manifest: {error}"
                                ))),
                                ..Default::default()
                            },
                        )?;
                    }
                    return Ok(None);
                }
            }
        }
        if attempt <= RUNTIME_DOWNLOAD_RETRY_COUNT {
            tokio::time::sleep(Duration::from_millis(1_000 * u64::from(attempt))).await;
        }
    }

    Ok(None)
}
