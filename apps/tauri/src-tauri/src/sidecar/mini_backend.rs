use std::{
    env, fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

use crate::{
    commands::desktop::{build_runtime_config, check_local_backend_health},
    runtime::profiles::{
        ensure_startup_runtime, patch_runtime_state, resolve_runtime_profile,
        resolve_selected_runtime_binary_path,
        sync_runtime_state_from_api, MiniBackendRuntimePatch,
        MiniBackendRuntimeStore,
    },
};

/// Source string emitted by `resolve_mini_backend_command` when a thin release
/// has no embedded sidecar and the downloadable runtime artifact has not been
/// installed yet. `start_mini_backend` matches on this exact string to
/// short-circuit before spawning anything. Keep the two in sync.
const NO_RUNTIME_INSTALLED_SOURCE: &str = "no-runtime-installed";

/// Written by `scripts/mini-venv.mjs` while `pip install` is running and
/// removed when it finishes. Since the dev bootstrap now runs *in parallel*
/// with the Tauri build, the interpreter can exist long before its packages do.
const PROVISIONING_LOCK_FILE: &str = ".koma-provisioning.json";

/// How long to wait for an in-flight `mini:install-deps` before giving up.
/// The install pulls PyTorch, CUDA wheels and builds `llama-cpp-python` from
/// source, which realistically takes tens of minutes on a cold cache.
const PROVISIONING_WAIT: Duration = Duration::from_secs(90 * 60);
const PROVISIONING_POLL_INTERVAL: Duration = Duration::from_secs(2);

// Modules `mini-backend/app.py` imports at module scope. If all of these
/// resolve, the sidecar can boot and serve — optional extras such as
/// `llama_cpp` (imported lazily inside the GGUF translator) may still be
/// installing, and waiting for them would needlessly delay every other
/// feature. Keep in sync with the imports at the top of `app.py`.
const REQUIRED_SIDECAR_MODULES: &str = "import uvicorn, fastapi, PIL";

/// Log fragments the mini-backend prints when it downgrades a GPU profile to
/// CPU. Kept verbatim from `mini-backend/app.py`'s `warmup_text_detection_model`
/// so the desktop UI can surface the downgrade.
const FALLBACK_LOG_MARKERS: [&str; 2] = [
    "Falling back to CPU automatically.",
    "Detector warmup successfully redone on CPU",
];

/// True once the venv can actually run the sidecar, regardless of whether the
/// bootstrap script is still installing optional packages.
fn mini_venv_can_serve(python: &Path) -> bool {
    std::process::Command::new(python)
        .args(["-c", REQUIRED_SIDECAR_MODULES])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

/// True while the project virtualenv is being populated by the bootstrap script.
fn mini_venv_provisioning(python: &Path) -> bool {
    // `python` is `<venv>/Scripts/python.exe` (Windows) or `<venv>/bin/python`,
    // so the venv directory is two levels up.
    python
        .parent()
        .and_then(Path::parent)
        .map(|venv_dir| venv_dir.join(PROVISIONING_LOCK_FILE).exists())
        .unwrap_or(false)
}

#[derive(Debug, Default)]
pub struct MiniBackendSidecarStore {
    child: Mutex<Option<CommandChild>>,
    pid: Mutex<Option<u32>>,
}

#[derive(Debug, Clone)]
struct MiniBackendCommandSpec {
    program: PathBuf,
    args: Vec<String>,
    cwd: PathBuf,
    profile: String,
    source: String,
    install_dir: Option<PathBuf>,
    version: Option<String>,
    use_sidecar: bool,
}

pub async fn restart_mini_backend<R: Runtime + 'static>(app: AppHandle<R>) -> Result<bool, String> {
    stop_mini_backend(&app)?;
    start_mini_backend(app).await?;
    Ok(true)
}

pub async fn start_mini_backend<R: Runtime + 'static>(app: AppHandle<R>) -> Result<(), String> {
    let sidecar_store = app.state::<MiniBackendSidecarStore>();
    if sidecar_store
        .child
        .lock()
        .map_err(|error| error.to_string())?
        .is_some()
    {
        return Ok(());
    }

    // Reuse: if a healthy mini-backend is already listening on the default
    // port (e.g. started by another shell in the monorepo), don't try to bind
    // again — the EADDRINUSE during warmup was killing the sidecar with exit 1.
    let Ok(reuse_config) = build_runtime_config(&app) else {
        return Ok(());
    };
    let runtime_store = app.state::<MiniBackendRuntimeStore>();
    if check_local_backend_health(&reuse_config.local_api_url).await {
        log::info!("mini-backend: healthy instance already on {} — reusing it", reuse_config.local_api_url);
        patch_runtime_state(
            &app,
            &runtime_store,
            MiniBackendRuntimePatch {
                status: Some("ready".to_string()),
                ..Default::default()
            },
        )?;
        return Ok(());
    }

    let runtime_store = app.state::<MiniBackendRuntimeStore>();
    if !cfg!(debug_assertions) && !embedded_mini_backend_enabled() {
        // For thin releases, attempt to provision the runtime artifact at startup.
        // If the artifact manifest cannot be downloaded (e.g. JA3 fingerprinting
        // from Cloudflare, transient network issue), we still want the rest of the
        // app — including login — to work. The runtime can be installed later
        // from the Settings → Runtime panel.
        let startup_result = ensure_startup_runtime(&app, &runtime_store).await;
        if let Ok(false) = startup_result {
            log::warn!(
                "mini-backend-runtime: startup install failed; continuing without local backend. \
                 Login and other cloud-backed features will work; AI/OCR features require \
                 installing a runtime from Settings → Runtime."
            );
        }
    }
    let command_spec = resolve_mini_backend_command(&app, &runtime_store)?;

    // Thin release without a downloaded runtime: no-op. The rest of the app
    // (login, sync) works because it talks to the self-hosted auth server
    // directly. The local mini-backend is only required for AI/OCR features.
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
        return Ok(());
    }

    // The dev bootstrap (`bun run dev:desktop`) provisions the virtualenv in
    // parallel with the Rust build, so on a first run the interpreter is often
    // already on disk while its dependencies are still downloading. Spawning
    // now would guarantee a `ModuleNotFoundError`, so wait the install out and
    // keep the user informed instead of failing with misleading advice.
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

    let config = build_runtime_config(&app)?;
    let port = parse_configured_port(&config.local_api_url).unwrap_or(8001);
    let models_root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("models");
    fs::create_dir_all(&models_root).map_err(|error| error.to_string())?;
    let resources_dir = resolve_resources_dir(&app);
    let reference_images_dir = resources_dir.join("reference_images");

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
    .env("PORT", port.to_string())
    .env("KOMA_MODELS_ROOT", path_to_string(&models_root))
    .env(
        "KOMA_LOCAL_API_SESSION_SECRET",
        env::var("KOMA_LOCAL_API_SESSION_SECRET").unwrap_or_default(),
    )
    .env("KOMA_APP_RESOURCES_DIR", path_to_string(&resources_dir))
    .env(
        "KOMA_REFERENCE_IMAGES_DIR",
        path_to_string(&reference_images_dir),
    )
    .env("PYTHONUTF8", "1")
    .env("PYTHONIOENCODING", "utf-8")
    .env("MINI_BACKEND_ACCELERATION_PROFILE", &command_spec.profile);

    if let Ok(path_value) = env::var("PATH") {
        command = command.env("PATH", path_value);
    }

    let (mut receiver, child) = command.spawn().map_err(|error| error.to_string())?;
    let pid = child.pid();
    *sidecar_store
        .pid
        .lock()
        .map_err(|error| error.to_string())? = Some(pid);
    *sidecar_store
        .child
        .lock()
        .map_err(|error| error.to_string())? = Some(child);

    // Set when the child reports `Terminated`, so the health poll below can
    // give up immediately instead of waiting out the full attempt budget on a
    // process that is already gone (e.g. a missing Python dependency).
    let exited = Arc::new(AtomicBool::new(false));

    let event_app = app.clone();
    let event_exited = Arc::clone(&exited);
    tauri::async_runtime::spawn(async move {
        while let Some(event) = receiver.recv().await {
            if matches!(event, CommandEvent::Terminated(_)) {
                event_exited.store(true, Ordering::SeqCst);
            }
            handle_command_event(&event_app, pid, event).await;
        }
    });

    let healthy = wait_for_mini_backend(
        &config.local_api_url,
        startup_attempts(&command_spec.source),
        &exited,
    )
    .await;
    if !healthy {
        let crashed = exited.load(Ordering::SeqCst);
        let (message, error_code) = if crashed {
            (
                if cfg!(debug_assertions) {
                    "Mini backend process exited during startup. Check the log above for the \
                     Python traceback — the usual cause is a missing dependency; run \
                     `bun run mini:install-deps` to create `.venv-mini` and install them."
                        .to_string()
                } else {
                    "Mini backend process exited during startup.".to_string()
                },
                "mini_backend_startup_crash",
            )
        } else {
            (
                "Mini backend did not become healthy in time.".to_string(),
                "mini_backend_health_timeout",
            )
        };
        patch_runtime_state(
            &app,
            &runtime_store,
            MiniBackendRuntimePatch {
                status: Some("error".to_string()),
status_message: Some(Some(message.clone())),
                last_error: Some(Some(error_code.to_string())),
                ..Default::default()
            },
        )?;
         return Err(message);
    }

    // The /device/info sync is EVENTUAL: the single uvicorn worker stays
    // blocked during ONNX warmup (minutes on slow machines), so the sync runs
    // in its own task with retry until the backend can respond. Boot never
    // waits for it.
    let sync_app = app.clone();
    tauri::async_runtime::spawn(async move {
        let runtime_store = sync_app.state::<MiniBackendRuntimeStore>();
        for attempt in 1..=20u32 {
            match sync_runtime_state_from_api(&sync_app, &runtime_store).await {
                Ok(()) => {
                    log::info!("runtime state synced after {attempt} attempt(s)");
                    return;
                }
                Err(error) if attempt < 20 => {
                    log::warn!(
                        "runtime state sync attempt {attempt} failed: {error}; retrying"
                    );
                    tokio::time::sleep(Duration::from_secs(3)).await;
                }
                Err(error) => {
                    log::warn!("runtime state sync gave up after 20 attempts: {error}");
                }
            }
        }
    });
    Ok(())
}

pub fn stop_mini_backend<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let store = app.state::<MiniBackendSidecarStore>();
    let pid = *store.pid.lock().map_err(|error| error.to_string())?;
    *store.pid.lock().map_err(|error| error.to_string())? = None;
    let child = store
        .child
        .lock()
        .map_err(|error| error.to_string())?
        .take();
    if let Some(child) = child {
        // TerminateProcess via tauri-plugin-shell only kills the immediate
        // child (python.exe). On Windows the sidecar is spawned without a Job
        // Object, so uvicorn workers and any subprocesses of app.py escape the
        // single-PID kill and keep the listening socket open — which then
        // poisons the next launch with a phantom "healthy" health-check.
        // taskkill /T /F walks the process tree rooted at the python PID.
        if let Err(error) = child.kill() {
            log::warn!("mini-backend: CommandChild::kill failed: {error}");
        }
        if let Some(pid_value) = pid {
            if cfg!(windows) {
                let _ = std::process::Command::new("taskkill")
                    .args(["/pid", &pid_value.to_string(), "/t", "/f"])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .status();
            }
        }
    }
    Ok(())
}

fn resolve_mini_backend_command<R: Runtime>(
    app: &AppHandle<R>,
    runtime_store: &MiniBackendRuntimeStore,
) -> Result<MiniBackendCommandSpec, String> {
    let profile = resolve_runtime_profile(app, runtime_store, false, false)?;
    if cfg!(debug_assertions) {
        // Monorepo: resolve_project_root returns the repo root (which contains
        // packages/); the backend lives in packages/mini-backend and the dev
        // venvs per app live in apps/tauri/.venv-mini[-<profile>].
        let project_root = resolve_project_root()?;
        let backend_root = project_root.join("packages").join("mini-backend");
        let app_root = project_root.join("apps").join("tauri");
        let runtime = resolve_dev_python_runtime(&profile, &app_root);
        let app_path = backend_root.join("app.py");
        return Ok(MiniBackendCommandSpec {
            program: runtime.0,
            args: runtime
                .1
                .into_iter()
                .chain([path_to_string(&app_path)])
                .collect(),
            cwd: backend_root.clone(),
            profile,
            source: "bundled-core".to_string(),
            install_dir: app_path.parent().map(Path::to_path_buf),
            version: Some(env!("CARGO_PKG_VERSION").to_string()),
            use_sidecar: false,
        });
    }

    if let Some(selected_binary) = resolve_selected_runtime_binary_path(app)? {
        return Ok(MiniBackendCommandSpec {
            program: selected_binary.clone(),
            args: Vec::new(),
            cwd: selected_binary
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| PathBuf::from(".")),
            profile,
            source: "downloaded-runtime".to_string(),
            install_dir: selected_binary.parent().map(Path::to_path_buf),
            version: None,
            use_sidecar: false,
        });
    }

    if !embedded_mini_backend_enabled() {
        // For thin releases where the runtime artifact has not been installed yet,
        // return a no-op command spec. The caller (start_mini_backend) detects
        // this and short-circuits before spawning anything.
        return Ok(MiniBackendCommandSpec {
            program: PathBuf::new(),
            args: Vec::new(),
            cwd: env::current_exe()
                .ok()
                .and_then(|path| path.parent().map(Path::to_path_buf))
                .unwrap_or_else(|| PathBuf::from(".")),
            profile,
            source: NO_RUNTIME_INSTALLED_SOURCE.to_string(),
            install_dir: None,
            version: None,
            use_sidecar: false,
        });
    }

    Ok(MiniBackendCommandSpec {
        program: PathBuf::from("bin").join("mini-backend"),
        args: Vec::new(),
        cwd: env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(Path::to_path_buf))
            .unwrap_or_else(|| PathBuf::from(".")),
        profile,
        source: "bundled-core".to_string(),
        install_dir: None,
        version: Some(env!("CARGO_PKG_VERSION").to_string()),
        use_sidecar: true,
    })
}

fn embedded_mini_backend_enabled() -> bool {
    !matches!(
        option_env!("KOMA_EMBEDDED_MINI_BACKEND"),
        Some("0") | Some("false") | Some("FALSE")
    )
}

async fn handle_command_event<R: Runtime + 'static>(
    app: &AppHandle<R>,
    pid: u32,
    event: CommandEvent,
) {
    match event {
        CommandEvent::Stdout(line) => {
            let text = decode_output(&line);
            if !should_ignore_progress_noise(&text) {
                sync_runtime_state_from_log(app, &text);
                log::info!("mini-backend: {}", text.trim());
            }
        }
        CommandEvent::Stderr(line) => {
            let text = decode_output(&line);
            if !should_ignore_progress_noise(&text) {
                sync_runtime_state_from_log(app, &text);
                // Python's logging and uvicorn both write *everything* to
                // stderr, including routine INFO lines, so the stream alone
                // says nothing about severity. Read the level the backend
                // already printed instead of tagging healthy startup output as
                // an error.
                match classify_backend_log(&text) {
                    BackendLogLevel::Info => log::info!("mini-backend: {}", text.trim()),
                    BackendLogLevel::Warn => log::warn!("mini-backend: {}", text.trim()),
                    BackendLogLevel::Error => log::error!("mini-backend: {}", text.trim()),
                }
            }
        }
        CommandEvent::Terminated(payload) => {
            let store = app.state::<MiniBackendSidecarStore>();
            let mut stored_pid = match store.pid.lock() {
                Ok(guard) => guard,
                Err(_) => return,
            };
            if stored_pid.as_ref() == Some(&pid) {
                *stored_pid = None;
                if let Ok(mut child) = store.child.lock() {
                    *child = None;
                }
            }
            log::warn!(
                "mini-backend exited with code {}",
                payload
                    .code
                    .map_or_else(|| "unknown".to_string(), |code| code.to_string())
            );
        }
        CommandEvent::Error(error) => {
            let runtime_store = app.state::<MiniBackendRuntimeStore>();
            let _ = patch_runtime_state(
                app,
                &runtime_store,
                MiniBackendRuntimePatch {
                    status: Some("error".to_string()),
                    status_message: Some(Some(
                        "Mini backend process emitted an error.".to_string(),
                    )),
                    last_error: Some(Some(error.clone())),
                    ..Default::default()
                },
            );
            log::error!("mini-backend process error: {error}");
        }
        _ => {}
    }
}

fn sync_runtime_state_from_log<R: Runtime>(app: &AppHandle<R>, raw_text: &str) {
    let text = raw_text.trim();
    if text.is_empty() {
        return;
    }
    // These must match the log lines `mini-backend/app.py` emits when a GPU
    // profile fails and it retries on CPU. They are a cross-language contract:
    // `sidecar_fallback_markers_match_backend_log_strings` guards the Rust
    // side, and changing either message without the other silently disables
    // the CPU-fallback banner.
    if !FALLBACK_LOG_MARKERS
        .iter()
        .any(|marker| text.contains(marker))
    {
        return;
    }
    let runtime_store = app.state::<MiniBackendRuntimeStore>();
    let message =
        "The selected runtime profile failed warmup and was downgraded to CPU.".to_string();
    let _ = patch_runtime_state(
        app,
        &runtime_store,
        MiniBackendRuntimePatch {
            active_profile: Some("cpu".to_string()),
            last_error: Some(Some(message.clone())),
            status: Some("fallback".to_string()),
            status_message: Some(Some(message)),
            ..Default::default()
        },
    );
}

async fn wait_for_mini_backend(
    local_api_url: &str,
    attempts: u32,
    exited: &AtomicBool,
) -> bool {
    for _ in 0..attempts {
        if check_local_backend_health(local_api_url).await {
            return true;
        }
        if exited.load(Ordering::SeqCst) {
            return false;
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

fn resolve_dev_python_runtime(profile: &str, cwd: &Path) -> (PathBuf, Vec<String>) {
    if let Ok(override_path) = env::var("MINI_BACKEND_PYTHON") {
        let trimmed = override_path.trim();
        if !trimmed.is_empty() {
            return (PathBuf::from(trimmed), Vec::new());
        }
    }
    for candidate in dev_python_candidates(profile, cwd) {
        if candidate.exists() {
            // The venv directory can exist while its packages are broken or
            // half-installed (e.g. a cancelled `mini:install-deps`). Warn up
            // front instead of letting the sidecar crash with a traceback.
            // Skip the probe while provisioning holds the lock: the modules
            // are expected to be missing mid-install.
            if !mini_venv_provisioning(&candidate) && !mini_venv_can_serve(&candidate) {
                log::warn!(
                    "mini-backend: {} exists but cannot run `{}`; the sidecar will likely \
                     fail to start. Run `bun run mini:install-deps` to repair it.",
                    candidate.display(),
                    REQUIRED_SIDECAR_MODULES
                );
            }
            return (candidate, Vec::new());
        }
    }
    log::warn!(
        "mini-backend: no `.venv-mini` virtualenv found under {}; falling back to the system \
         Python. If startup fails with ModuleNotFoundError, run `bun run mini:install-deps` \
         or set MINI_BACKEND_PYTHON.",
        cwd.display()
    );
    if cfg!(windows) {
        (PathBuf::from("py"), vec!["-3.12".to_string()])
    } else {
        (PathBuf::from("python3.12"), Vec::new())
    }
}

/// Optional developer override pointing at a directory that holds the
/// `.venv-mini-*` virtualenvs outside the repository (useful to keep large
/// runtimes off the system drive). Empty or unset means "only look inside the
/// project directory".
fn external_storage_root() -> Option<PathBuf> {
    let value = env::var("KOMA_EXTERNAL_STORAGE_ROOT").ok()?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
}

fn dev_python_candidates(profile: &str, cwd: &Path) -> Vec<PathBuf> {
    let profile_key = profile.replace(|ch: char| !ch.is_ascii_alphanumeric() && ch != '-', "-");
    if cfg!(windows) {
        let mut candidates: Vec<PathBuf> = Vec::new();
        if let Some(root) = external_storage_root() {
            candidates.push(
                root.join(format!(".venv-mini-{profile_key}"))
                    .join("Scripts")
                    .join("python.exe"),
            );
        }
        candidates.push(
            cwd.join(format!(".venv-mini-{profile_key}"))
                .join("Scripts")
                .join("python.exe"),
        );
        candidates.push(cwd.join(".venv-mini").join("Scripts").join("python.exe"));
        return candidates;
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(root) = external_storage_root() {
        candidates.push(
            root.join(format!(".venv-mini-{profile_key}"))
                .join("bin")
                .join("python"),
        );
    }
    candidates.push(
        cwd.join(format!(".venv-mini-{profile_key}"))
            .join("bin")
            .join("python"),
    );
    candidates.push(cwd.join(".venv-mini").join("bin").join("python"));
    candidates
}

fn resolve_project_root() -> Result<PathBuf, String> {
    // Monorepo: the source lives at <repo>/packages/mini-backend. We look for
    // that structure by walking the cwd's ancestors (dev runs from the app dir).
    let start = env::current_dir().map_err(|error| error.to_string())?;
    for ancestor in start.ancestors().take(8) {
        if ancestor.join("packages").join("mini-backend").join("app.py").exists() {
            return Ok(ancestor.to_path_buf());
        }
    }
    Err("Mini backend app.py was not found under packages/mini-backend.".to_string())
}

fn resolve_resources_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    app.path()
        .resource_dir()
        .map(|path| path.join("resources"))
        .or_else(|_| env::current_dir().map(|path| path.join("resources")))
        .unwrap_or_else(|_| PathBuf::from("resources"))
}

fn decode_output(bytes: &[u8]) -> String {
    String::from_utf8(bytes.to_vec()).unwrap_or_else(|_| String::from_utf8_lossy(bytes).to_string())
}

/// Severity of a line the mini-backend wrote to stderr.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum BackendLogLevel {
    Info,
    Warn,
    Error,
}

/// Infer the severity of a backend stderr line from the level it printed.
///
/// Both `logging` and uvicorn send their output to stderr regardless of level,
/// so mirroring the stream onto `log::error!` reported a healthy boot
/// (`INFO: Started server process`) as a failure. Anything we cannot classify
/// stays at error level so genuine tracebacks are never quietly downgraded.
fn classify_backend_log(raw_text: &str) -> BackendLogLevel {
    let text = raw_text.trim();
    // uvicorn writes `INFO:     Started server process [123]`, while the
    // backend's own logger writes `INFO:mini-backend:...`; both start with the
    // level name, so a prefix test covers the two shapes.
    let starts_with_level = |level: &str| {
        text.strip_prefix(level)
            .is_some_and(|rest| rest.starts_with(':') || rest.starts_with(' '))
    };
    if starts_with_level("INFO") || starts_with_level("DEBUG") {
        BackendLogLevel::Info
    } else if starts_with_level("WARNING") || starts_with_level("WARN") {
        BackendLogLevel::Warn
    } else {
        BackendLogLevel::Error
    }
}


fn should_ignore_progress_noise(raw_text: &str) -> bool {
    let text = raw_text.trim();
    text.is_empty()
        || text.contains("Progress: |")
        || text.contains("onnxruntime is not built with CUDA 12.x support")
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_an_in_flight_dependency_install() {
        let temp = tempfile::tempdir().expect("tempdir");
        let venv_dir = temp.path().join(".venv-mini");
        let bin_dir = venv_dir.join(if cfg!(windows) { "Scripts" } else { "bin" });
        fs::create_dir_all(&bin_dir).expect("create venv layout");
        let python = bin_dir.join(if cfg!(windows) { "python.exe" } else { "python" });

        // No lock file: the venv is either finished or absent, never "in progress".
        assert!(!mini_venv_provisioning(&python));

        fs::write(venv_dir.join(PROVISIONING_LOCK_FILE), "{}").expect("write lock");
        assert!(mini_venv_provisioning(&python));

        // Clearing the lock must immediately release the startup wait.
        fs::remove_file(venv_dir.join(PROVISIONING_LOCK_FILE)).expect("remove lock");
        assert!(!mini_venv_provisioning(&python));
    }

    #[test]
    fn provisioning_probe_tolerates_short_paths() {
        // A bare program name (system-Python fallback) has no venv ancestors;
        // the probe must report "not provisioning" instead of panicking.
        assert!(!mini_venv_provisioning(Path::new("python")));
        assert!(!mini_venv_provisioning(Path::new("")));
    }

    #[test]
    fn required_sidecar_modules_exclude_optional_extras() {
        // `llama_cpp` is imported lazily inside the GGUF translator and guarded
        // by its own ImportError handler, so it must never gate startup: it is
        // the slowest package to install (source build) and blocking on it kept
        // the whole backend offline.
        assert!(!REQUIRED_SIDECAR_MODULES.contains("llama_cpp"));
        // The three modules app.py imports at module scope must all be probed.
        for module in ["uvicorn", "fastapi", "PIL"] {
            assert!(
                REQUIRED_SIDECAR_MODULES.contains(module),
                "{module} is imported by app.py but not probed before startup"
            );
        }
    }

    #[test]
    fn serve_probe_rejects_a_missing_interpreter() {
        assert!(!mini_venv_can_serve(Path::new(
            "/nonexistent/koma/python-does-not-exist"
        )));
    }

    #[test]
    fn parses_configured_port_from_loopback_url() {
        assert_eq!(parse_configured_port("http://127.0.0.1:8001"), Some(8001));
        assert_eq!(parse_configured_port("http://127.0.0.1"), None);
    }

    #[test]
    fn startup_attempts_match_electron_policy() {
        if cfg!(debug_assertions) {
            assert_eq!(startup_attempts("bundled-core"), 240);
        } else {
            assert_eq!(startup_attempts("downloaded-runtime"), 600);
            assert_eq!(startup_attempts("bundled-core"), 60);
        }
    }

    #[test]
    fn sidecar_fallback_markers_match_backend_log_strings() {
        // The markers are matched against log output produced by another
        // language, so nothing but reading that file can prove they still
        // line up. A PT->EN translation pass previously changed the Python
        // messages and silently disabled the CPU-fallback banner.
        let app_py = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../../packages/mini-backend/app.py");
        let source = fs::read_to_string(&app_py)
            .unwrap_or_else(|error| panic!("read {}: {error}", app_py.display()));

        for marker in FALLBACK_LOG_MARKERS {
            assert!(
                source.contains(marker),
                "mini-backend/app.py no longer logs {marker:?}; the CPU-fallback banner \
                 would never fire again"
            );
        }
    }

    #[test]
    fn classifies_backend_stderr_by_printed_level() {
        // uvicorn's healthy boot lines must not be reported as errors.
        assert_eq!(
            classify_backend_log("INFO:     Started server process [30708]"),
            BackendLogLevel::Info
        );
        assert_eq!(
            classify_backend_log("INFO:mini-backend:Detector warmup finished"),
            BackendLogLevel::Info
        );
        assert_eq!(
            classify_backend_log("WARNING:mini-backend:DLL verification failed"),
            BackendLogLevel::Warn
        );
        assert_eq!(
            classify_backend_log("ERROR:mini-backend:boom"),
            BackendLogLevel::Error
        );
        // Unlabelled output (tracebacks) keeps the loudest level.
        assert_eq!(
            classify_backend_log("Traceback (most recent call last):"),
            BackendLogLevel::Error
        );
        // A level name must be a prefix, not a substring, or a traceback
        // mentioning INFO would be silently downgraded.
        assert_eq!(
            classify_backend_log("RuntimeError: INFO was not found"),
            BackendLogLevel::Error
        );
    }

    #[test]
    fn filters_known_progress_noise() {
        assert!(should_ignore_progress_noise("Progress: |######"));
        assert!(!should_ignore_progress_noise("backend ready"));
    }

    #[test]
    fn embedded_mini_backend_defaults_to_enabled_for_non_thin_builds() {
        assert!(matches!(
            option_env!("KOMA_EMBEDDED_MINI_BACKEND"),
            Some("0") | Some("1")
        ));
    }
}
