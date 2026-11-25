use std::{
    env, fs,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::Duration,
};

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_shell::ShellExt;
use tokio::sync::oneshot;

use super::recovery::{
    MiniBackendSidecarStore, RestartTrigger, StartOutcome, fold_sidecar_failure, now_millis,
    wait_until_start_settles,
};
use crate::{
    commands::desktop::{
        build_runtime_config, check_local_backend_health, check_local_backend_ready,
    },
    runtime::profiles::{
        MiniBackendRuntimePatch, MiniBackendRuntimeStore, ensure_startup_runtime,
        patch_runtime_state, sync_runtime_state_from_api,
    },
    runtime::temp_sweeper::sweep_stale_runtime_temp,
};

mod command_spec;
mod logs;
pub(crate) mod process_group;
mod thread_override;

#[cfg(test)]
mod tests;

use command_spec::{
    NO_RUNTIME_INSTALLED_SOURCE, PROVISIONING_POLL_INTERVAL, PROVISIONING_WAIT,
    embedded_mini_backend_enabled, mini_venv_provisioning, path_to_string,
    resolve_mini_backend_command, resolve_resources_dir,
};
#[cfg(test)]
use command_spec::{REQUIRED_SIDECAR_MODULES, mini_venv_can_serve};
use logs::spawn_event_loop;
#[cfg(test)]
use logs::{
    BackendLogLevel, FALLBACK_LOG_MARKERS, classify_backend_log, parse_listening_port,
    should_ignore_progress_noise,
};

pub(crate) const LOCAL_API_SESSION_HEADER: &str = "x-koma-local-session";
pub(crate) const RUNTIME_CONFIG_UPDATED_EVENT: &str = "desktop:runtime-config:updated";

pub(crate) use thread_override::{
    MINI_BACKEND_THREAD_OVERRIDE_FILE, MiniBackendThreadOverride, mini_backend_thread_env_pairs,
    read_mini_backend_thread_override_at,
};

pub fn local_api_session_secret<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    app.state::<MiniBackendSidecarStore>().session_secret()
}

pub fn with_local_api_session<R: Runtime>(
    app: &AppHandle<R>,
    builder: reqwest::RequestBuilder,
) -> reqwest::RequestBuilder {
    match local_api_session_secret(app) {
        Some(secret) => builder.header(LOCAL_API_SESSION_HEADER, secret),
        None => builder,
    }
}

pub async fn restart_mini_backend<R: Runtime + 'static>(app: AppHandle<R>) -> Result<bool, String> {
    {
        let sidecar_store = app.state::<MiniBackendSidecarStore>();
        sidecar_store.cancel_restart_supervisor()?;
    }
    stop_mini_backend(&app)?;
    let outcome = start_mini_backend(app.clone()).await?;
    if outcome == StartOutcome::AlreadyStarting {
        wait_until_start_settles(&app).await;
    }
    Ok(true)
}

pub async fn start_mini_backend<R: Runtime + 'static>(
    app: AppHandle<R>,
) -> Result<StartOutcome, String> {
    let sidecar_store = app.state::<MiniBackendSidecarStore>();

    let Some(_start_guard) = sidecar_store.lock_start() else {
        return Ok(StartOutcome::AlreadyStarting);
    };

    if sidecar_store.has_child()? {
        return Ok(StartOutcome::AlreadyRunning);
    }
    sidecar_store.mark_restart_intent();

    let sweep_report = sweep_stale_runtime_temp(&env::temp_dir(), Duration::from_secs(24 * 3600));
    log::info!(
        "mini-backend: runtime temp sweep removed {} stale entries, kept {} (24h floor)",
        sweep_report.removed.len(),
        sweep_report.skipped
    );

    let reuse_config = build_runtime_config(&app);
    let runtime_store = app.state::<MiniBackendRuntimeStore>();
    if cfg!(debug_assertions) && check_local_backend_health(&reuse_config.local_api_url).await {
        sidecar_store.set_active_local_api_url(Some(reuse_config.local_api_url.clone()))?;
        log::info!(
            "mini-backend: healthy instance already on {} — reusing it",
            reuse_config.local_api_url
        );
        patch_runtime_state(
            &app,
            &runtime_store,
            MiniBackendRuntimePatch {
                status: Some("ready".to_string()),
                ..Default::default()
            },
        )?;
        return Ok(StartOutcome::AlreadyRunning);
    }

    if !cfg!(debug_assertions) && !embedded_mini_backend_enabled() {
        let startup_result = ensure_startup_runtime(&app, &runtime_store).await;
        if let Ok(false) = startup_result {
            log::warn!(
                "mini-backend-runtime: startup install failed; continuing without local backend. \
                 Login and other cloud-backed features will work; AI/OCR features require \
                 installing a runtime from Settings -> Runtime."
            );
        }
    }

    let resolve_app = app.clone();
    let command_spec = tauri::async_runtime::spawn_blocking(move || {
        let runtime_store = resolve_app.state::<MiniBackendRuntimeStore>();
        resolve_mini_backend_command(&resolve_app, &runtime_store)
    })
    .await
    .map_err(|error| error.to_string())??;

    if command_spec.source == NO_RUNTIME_INSTALLED_SOURCE {
        patch_runtime_state(
            &app,
            &runtime_store,
            MiniBackendRuntimePatch {
                requested_profile: Some(command_spec.profile.clone()),
                active_profile: Some(command_spec.profile.clone()),
                source: Some("no-runtime-installed".to_string()),
                status: Some("idle".to_string()),
                status_message: Some(Some(
                    "Local AI runtime is not installed. Install it from Settings \u{2192} Runtime to enable AI/OCR features."
                        .to_string(),
                )),
                last_error: Some(None),
                progress: Some(None),
                ..Default::default()
            },
        )?;
        return Ok(StartOutcome::NoRuntime);
    }

    if !command_spec.use_sidecar && mini_venv_provisioning(&command_spec.program) {
        log::info!(
            "mini-backend: dependency install in progress; waiting for it to finish before \
             starting the sidecar"
        );
        patch_runtime_state(
            &app,
            &runtime_store,
            MiniBackendRuntimePatch {
                requested_profile: Some(command_spec.profile.clone()),
                active_profile: Some(command_spec.profile.clone()),
                source: Some(command_spec.source.clone()),
                status: Some("checking".to_string()),
                status_message: Some(Some(
                    "Installing Python dependencies (first run downloads several GB). \
                     AI/OCR features start automatically when it finishes."
                        .to_string(),
                )),
                last_error: Some(None),
                progress: Some(None),
                ..Default::default()
            },
        )?;

        let deadline = std::time::Instant::now() + PROVISIONING_WAIT;
        while mini_venv_provisioning(&command_spec.program) {
            if std::time::Instant::now() >= deadline {
                log::warn!(
                    "mini-backend: dependency install still running after {} minutes; \
                     starting anyway",
                    PROVISIONING_WAIT.as_secs() / 60
                );
                break;
            }
            tokio::time::sleep(PROVISIONING_POLL_INTERVAL).await;
        }
    }

    let config = build_runtime_config(&app);
    let pin_port = env::var("KOMA_PIN_SIDECAR_PORT").as_deref() == Ok("1");
    let configured_port = parse_configured_port(&config.local_api_url).unwrap_or(8001);
    let spawn_port = if pin_port { configured_port } else { 0 };
    let models_root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("models");
    fs::create_dir_all(&models_root).map_err(|error| error.to_string())?;
    let resources_dir = resolve_resources_dir(&app);
    let reference_images_dir = resources_dir.join("reference_images");

    let session_secret = if cfg!(debug_assertions) {
        None
    } else {
        Some(format!(
            "{}{}",
            uuid::Uuid::new_v4().simple(),
            uuid::Uuid::new_v4().simple()
        ))
    };
    sidecar_store.set_session_secret(session_secret.clone())?;

    patch_runtime_state(
        &app,
        &runtime_store,
        MiniBackendRuntimePatch {
            requested_profile: Some(command_spec.profile.clone()),
            active_profile: Some(command_spec.profile.clone()),
            source: Some(command_spec.source.clone()),
            install_dir: Some(
                command_spec
                    .install_dir
                    .as_ref()
                    .map(|path| path_to_string(path)),
            ),
            version: Some(command_spec.version.clone()),
            download_cache_dir: Some(Some(
                env::temp_dir()
                    .join("koma-runtime-downloads")
                    .to_string_lossy()
                    .to_string(),
            )),
            status: Some("checking".to_string()),
            status_message: Some(Some(if command_spec.source == "downloaded-runtime" {
                "Starting downloaded runtime.".to_string()
            } else {
                "Starting local runtime.".to_string()
            })),
            last_error: Some(None),
            progress: Some(None),
            ..Default::default()
        },
    )?;

    let mut command = if command_spec.use_sidecar {
        app.shell()
            .sidecar(&command_spec.program)
            .map_err(|error| error.to_string())?
    } else {
        app.shell().command(&command_spec.program)
    }
    .args(command_spec.args.clone())
    .current_dir(&command_spec.cwd)
    .env(
        "NODE_ENV",
        if cfg!(debug_assertions) {
            "development"
        } else {
            "production"
        },
    )
    .env("PORT", spawn_port.to_string())
    .env("KOMA_PARENT_PID", std::process::id().to_string())
    .env("KOMA_MODELS_ROOT", path_to_string(&models_root))
    .env(
        "KOMA_LOCAL_API_SESSION_SECRET",
        session_secret.clone().unwrap_or_default(),
    )
    .env("KOMA_APP_RESOURCES_DIR", path_to_string(&resources_dir))
    .env(
        "KOMA_REFERENCE_IMAGES_DIR",
        path_to_string(&reference_images_dir),
    )
    .env(
        "KOMA_APP_DATA_DIR",
        path_to_string(models_root.parent().unwrap_or(&models_root)),
    )
    .env("PYTHONUTF8", "1")
    .env("PYTHONIOENCODING", "utf-8")
    .env("MINI_BACKEND_ACCELERATION_PROFILE", &command_spec.profile)
    .env("KOMA_APP_VERSION", app.package_info().version.to_string());

    if let Ok(path_value) = env::var("PATH") {
        command = command.env("PATH", path_value);
    }

    let thread_override = app
        .path()
        .app_data_dir()
        .map(|dir| read_mini_backend_thread_override_at(&dir))
        .unwrap_or_default();
    for (key, value) in mini_backend_thread_env_pairs(&thread_override) {
        command = command.env(key, value);
    }

    let (receiver, child) = match command.spawn() {
        Ok(spawned) => spawned,
        Err(error) => {
            let message = error.to_string();
            let _ = fold_sidecar_failure(&app, RestartTrigger::SpawnError);
            return Err(message);
        }
    };
    let (generation, pid) = sidecar_store.register_child(child)?;
    match process_group::SidecarJobObject::create().and_then(|job| {
        job.assign_pid(pid)?;
        Ok(job)
    }) {
        Ok(job) => {
            sidecar_store.set_job(Some(job))?;
        }
        Err(error) => {
            log::warn!("mini-backend: failed to attach process job object: {error}");
        }
    }

    let exited = Arc::new(AtomicBool::new(false));
    let (port_tx, port_rx) = oneshot::channel::<u16>();
    spawn_event_loop(
        app.clone(),
        pid,
        generation,
        Arc::clone(&exited),
        receiver,
        Some(port_tx),
    );

    let attempts = startup_attempts(&command_spec.source);
    let bound_port = if pin_port {
        configured_port
    } else {
        match wait_for_bound_port(port_rx, attempts, &exited).await {
            Some(port) => port,
            None => {
                if exited.load(Ordering::SeqCst) {
                    let _ = sidecar_store.set_active_local_api_url(None);
                    let _ = sidecar_store.set_session_secret(None);
                    if cfg!(debug_assertions) {
                        log::warn!(
                            "mini-backend: process exited during startup. Check the log above for \
                             the Python traceback - run `bun run mini:install-deps` to create \
                             `.venv-mini` and install dependencies."
                        );
                    }
                    return Err("Mini backend process exited during startup.".to_string());
                }
                terminate_unhealthy_child(&sidecar_store);
                let message = "Mini backend did not become healthy in time.".to_string();
                fold_sidecar_failure(&app, RestartTrigger::HealthTimeout)?;
                return Err(message);
            }
        }
    };

    let active_url = format!("http://127.0.0.1:{bound_port}");
    let healthy = wait_for_mini_backend(&active_url, attempts, &exited).await;
    if !healthy {
        if exited.load(Ordering::SeqCst) {
            let _ = sidecar_store.set_active_local_api_url(None);
            let _ = sidecar_store.set_session_secret(None);
            if cfg!(debug_assertions) {
                log::warn!(
                    "mini-backend: process exited during startup. Check the log above for the \
                     Python traceback - the usual cause is a missing dependency; run \
                     `bun run mini:install-deps` to create `.venv-mini` and install them."
                );
            }
            return Err("Mini backend process exited during startup.".to_string());
        }
        terminate_unhealthy_child(&sidecar_store);
        let message = "Mini backend did not become healthy in time.".to_string();
        fold_sidecar_failure(&app, RestartTrigger::HealthTimeout)?;
        return Err(message);
    }
    sidecar_store.set_active_local_api_url(Some(active_url.clone()))?;
    let _ = app.emit_to(
        "main",
        RUNTIME_CONFIG_UPDATED_EVENT,
        build_runtime_config(&app),
    );
    sidecar_store.mark_healthy(now_millis())?;
    patch_runtime_state(
        &app,
        &runtime_store,
        MiniBackendRuntimePatch {
            status: Some("ready".to_string()),
            ..Default::default()
        },
    )?;

    let sync_app = app.clone();
    let sync_exited = Arc::clone(&exited);
    tauri::async_runtime::spawn(async move {
        let is_stale = || {
            sync_exited.load(Ordering::SeqCst)
                || !sync_app
                    .state::<MiniBackendSidecarStore>()
                    .is_current_generation(generation)
        };
        for _ in 0..60u32 {
            if is_stale() {
                return;
            }
            if check_local_backend_ready(&active_url).await {
                break;
            }
            tokio::time::sleep(Duration::from_secs(1)).await;
        }
        let runtime_store = sync_app.state::<MiniBackendRuntimeStore>();
        for attempt in 1..=20u32 {
            if is_stale() {
                return;
            }
            match sync_runtime_state_from_api(&sync_app, &runtime_store).await {
                Ok(()) => {
                    log::info!("runtime state synced after {attempt} attempt(s)");
                    return;
                }
                Err(error) if attempt < 20 => {
                    log::warn!("runtime state sync attempt {attempt} failed: {error}; retrying");
                    tokio::time::sleep(Duration::from_secs(3)).await;
                }
                Err(error) => {
                    log::warn!("runtime state sync gave up after 20 attempts: {error}");
                }
            }
        }
    });
    Ok(StartOutcome::Started)
}

fn terminate_unhealthy_child(store: &MiniBackendSidecarStore) {
    let _ = store.invalidate_generation();
    let _ = store.set_active_local_api_url(None);
    let _ = store.set_session_secret(None);
    if let Ok(Some(job)) = store.take_job() {
        job.terminate();
        drop(job);
    }
    if let Ok((Some(child), _)) = store.take_child() {
        if let Err(error) = child.kill() {
            log::warn!("mini-backend: failed to kill unhealthy child: {error}");
        }
    }
}

pub fn stop_mini_backend<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let store = app.state::<MiniBackendSidecarStore>();
    store.mark_expected_stop();
    store.set_session_secret(None)?;
    store.set_active_local_api_url(None)?;

    let job = store.take_job()?;
    let (child, _pid) = store.take_child()?;
    if let Some(job_handle) = job {
        job_handle.terminate();
        drop(job_handle);
    }
    if let Some(child) = child {
        if let Err(error) = child.kill() {
            log::warn!("mini-backend: CommandChild::kill failed: {error}");
        }
    }
    Ok(())
}

async fn wait_for_bound_port(
    mut port_rx: oneshot::Receiver<u16>,
    attempts: u32,
    exited: &AtomicBool,
) -> Option<u16> {
    let deadline = tokio::time::Instant::now() + Duration::from_millis(u64::from(attempts) * 500);
    loop {
        if exited.load(Ordering::SeqCst) {
            return None;
        }
        tokio::select! {
            received = &mut port_rx => return received.ok(),
            _ = tokio::time::sleep(Duration::from_millis(50)) => {
                if tokio::time::Instant::now() >= deadline {
                    return None;
                }
            }
        }
    }
}

async fn wait_for_mini_backend(local_api_url: &str, attempts: u32, exited: &AtomicBool) -> bool {
    for _ in 0..attempts {
        if exited.load(Ordering::SeqCst) {
            return false;
        }
        if check_local_backend_health(local_api_url).await {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    false
}

fn startup_attempts(source: &str) -> u32 {
    if cfg!(debug_assertions) {
        240
    } else if source == "downloaded-runtime" {
        600
    } else {
        60
    }
}

fn parse_configured_port(raw_url: &str) -> Option<u16> {
    let parsed = url::Url::parse(raw_url).ok()?;
    let port = parsed.port()?;
    (port > 0).then_some(port)
}
