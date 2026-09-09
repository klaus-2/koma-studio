use super::*;

pub(super) async fn install_recommended_runtime<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<MiniBackendRuntimeInstallResult, String> {
    let profile = resolve_runtime_profile(app, store, false, false)?;
    if cfg!(debug_assertions) {
        set_manual_install_blocked(app, store, "dev-only-unavailable", &profile)?;
        return Ok(install_result(
            false,
            &profile,
            "runtime_manual_install_dev_only_unavailable",
        ));
    }
    if profile == "cpu" {
        set_manual_install_blocked(app, store, "cpu-not-required", &profile)?;
        return Ok(install_result(
            false,
            &profile,
            "runtime_manual_install_cpu_not_required",
        ));
    }

    install_and_restart(app, store, &profile, false).await
}

pub(super) async fn install_runtime_profile<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    profile_input: &str,
) -> Result<MiniBackendRuntimeInstallResult, String> {
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
) -> Result<bool, String> {
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
) -> Result<bool, String> {
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
) -> Result<MiniBackendRuntimeInstallResult, String> {
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
    crate::sidecar::mini_backend::restart_mini_backend(app.clone()).await?;
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
) -> Result<Option<InstalledRuntime>, String> {
    if profile == "cpu" && !allow_cpu_download {
        return Ok(None);
    }

    let manifest_url = match resolve_manifest_url(app)? {
        Some(url) => url,
        None => return Ok(None),
    };
    let Some(manifest) = read_runtime_manifest(app, store, false).await? else {
        return Ok(None);
    };
    let Some(record) = manifest.profiles.get(profile).cloned() else {
        let message = format!("Runtime profile not available in manifest: {profile}");
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("fallback".to_string()),
                status_message: Some(Some(message.clone())),
                runtime_manifest_url: Some(Some(manifest_url)),
                last_error: Some(Some(message)),
                ..Default::default()
            },
        )?;
        return Ok(None);
    };

    let install_dir = runtime_install_dir(app, &manifest.version, profile)?;
    let binary_path = install_dir.join(&record.entry);
    let archive_url = resolve_runtime_url(&manifest_url, &record.url)?;
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
    let temp_zip_path = temp_dir.join(&record.file_name);
    let temp_extract_dir = PathBuf::from(format!("{}.tmp", install_dir.to_string_lossy()));

    match async {
        ensure_runtime_disk_space(&temp_zip_path, &install_dir, record.size)?;
        download_runtime_artifact(app, store, profile, &record, &archive_url, &temp_zip_path)
            .await?;
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("verifying".to_string()),
                status_message: Some(Some(format!("Verifying {profile} runtime archive."))),
                ..Default::default()
            },
        )?;
        let actual_sha512 = sha512_base64_file(&temp_zip_path)?;
        if actual_sha512 != record.sha512 {
            return Err("Runtime archive sha512 mismatch.".to_string());
        }
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("extracting".to_string()),
                status_message: Some(Some(format!("Installing {profile} runtime."))),
                ..Default::default()
            },
        )?;
        extract_runtime_archive(&temp_zip_path, &temp_extract_dir)?;
        if install_dir.exists() {
            fs::remove_dir_all(&install_dir).map_err(|error| error.to_string())?;
        }
        fs::rename(&temp_extract_dir, &install_dir).map_err(|error| error.to_string())?;
        Ok::<(), String>(())
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
            if binary_path.exists() {
                let _ = fs::remove_file(&temp_zip_path);
            }
            Ok(Some(InstalledRuntime {
                version: manifest.version,
                entry: record.entry,
            }))
        }
        Err(error) => {
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
                    last_error: Some(Some(error.clone())),
                    status: Some("fallback".to_string()),
                    status_message: Some(Some(format!(
                        "Failed to install {profile} runtime. Falling back to the embedded runtime."
                    ))),
                    progress: Some(None),
                    ..Default::default()
                },
            )?;
            log::warn!("mini-backend-runtime: {error}");
            Ok(None)
        }
    }
}

pub(super) async fn list_runtime_artifacts<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
) -> Result<Vec<MiniBackendRuntimeArtifactOption>, String> {
    let Some(manifest) = read_runtime_manifest(app, store, true).await? else {
        return Ok(Vec::new());
    };
    let recommended = resolve_runtime_profile(app, store, true, true)?;
    let installed_profiles = manifest
        .profiles
        .values()
        .filter(|record| {
            runtime_install_dir(app, &manifest.version, &record.profile)
                .map(|dir| dir.join(&record.entry).exists())
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
) -> Result<Option<MiniBackendRuntimeArtifactManifest>, String> {
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

    let client = reqwest::Client::new();
    for attempt in 1..=RUNTIME_DOWNLOAD_RETRY_COUNT + 1 {
        match client
            .get(&manifest_url)
            .timeout(Duration::from_secs(30))
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                return response
                    .json::<MiniBackendRuntimeArtifactManifest>()
                    .await
                    .map(Some)
                    .map_err(|error| error.to_string());
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
        tokio::time::sleep(Duration::from_millis(1_000 * u64::from(attempt))).await;
    }

    Ok(None)
}

async fn download_runtime_artifact<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    profile: &str,
    record: &MiniBackendRuntimeArtifactRecord,
    archive_url: &str,
    output_path: &Path,
) -> Result<(), String> {
    let max_attempts = RUNTIME_DOWNLOAD_RETRY_COUNT + 1;
    for attempt in 1..=max_attempts {
        let existing = existing_download_bytes(output_path, record.size)?;
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("downloading".to_string()),
                status_message: Some(Some(if existing > 0 {
                    format!("Resuming {profile} runtime download ({attempt}/{max_attempts}).")
                } else {
                    format!("Downloading {profile} runtime ({attempt}/{max_attempts}).")
                })),
                last_error: Some(None),
                attempt: Some(attempt),
                max_attempts: Some(max_attempts),
                progress: Some(Some(progress_snapshot(existing, record.size, 0.0))),
                ..Default::default()
            },
        )?;

        let result = download_url_to_file_with_resume(
            app,
            store,
            archive_url,
            output_path,
            record,
            existing,
        )
        .await;
        if result.is_ok() {
            return Ok(());
        }
        let error = result.unwrap_err();
        if attempt >= max_attempts || !is_retryable_error(&error) {
            return Err(error);
        }
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                last_error: Some(Some(error)),
                attempt: Some(attempt + 1),
                max_attempts: Some(max_attempts),
                ..Default::default()
            },
        )?;
        tokio::time::sleep(Duration::from_millis(1_000 * u64::from(attempt))).await;
    }
    Err("Runtime download failed.".to_string())
}

async fn download_url_to_file_with_resume<R: Runtime>(
    app: &AppHandle<R>,
    store: &MiniBackendRuntimeStore,
    archive_url: &str,
    output_path: &Path,
    record: &MiniBackendRuntimeArtifactRecord,
    existing: u64,
) -> Result<(), String> {
    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let client = reqwest::Client::new();
    let mut request = client
        .get(archive_url)
        .timeout(resolve_runtime_transfer_timeout(record.size));
    if existing > 0 {
        request = request.header(reqwest::header::RANGE, format!("bytes={existing}-"));
    }
    let response = request.send().await.map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }
    let can_append = existing > 0 && response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    if existing > 0 && !can_append {
        fs::remove_file(output_path).map_err(|error| error.to_string())?;
    }
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(can_append)
        .write(true)
        .truncate(!can_append)
        .open(output_path)
        .map_err(|error| error.to_string())?;
    let started_at = now_millis();
    let mut transferred = if can_append { existing } else { 0 };
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| error.to_string())?;
        file.write_all(&chunk).map_err(|error| error.to_string())?;
        transferred += chunk.len() as u64;
        let elapsed = ((now_millis().saturating_sub(started_at)).max(1) as f64) / 1000.0;
        let speed = (transferred as f64 / elapsed).round();
        patch_runtime_state(
            app,
            store,
            MiniBackendRuntimePatch {
                status: Some("downloading".to_string()),
                progress: Some(Some(progress_snapshot(transferred, record.size, speed))),
                last_error: Some(None),
                ..Default::default()
            },
        )?;
    }
    Ok(())
}
