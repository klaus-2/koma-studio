use std::{
    env,
    path::{Path, PathBuf},
    time::Duration,
};

use tauri::{AppHandle, Manager, Runtime};

use crate::runtime::profiles::{
    MiniBackendRuntimeStore, resolve_runtime_profile, resolve_selected_runtime_binary_path,
};

pub(crate) const NO_RUNTIME_INSTALLED_SOURCE: &str = "no-runtime-installed";
pub(crate) const PROVISIONING_LOCK_FILE: &str = ".koma-provisioning.json";
pub(crate) const PROVISIONING_WAIT: Duration = Duration::from_secs(90 * 60);
pub(crate) const PROVISIONING_POLL_INTERVAL: Duration = Duration::from_secs(2);
pub(crate) const REQUIRED_SIDECAR_MODULES: &str = concat!(
    "import uvicorn, fastapi, PIL, cv2; ",
    "assert hasattr(cv2, 'imencode'), 'cv2 has no native module (conflicting opencv distributions?)'",
);

#[derive(Debug, Clone)]
pub(crate) struct MiniBackendCommandSpec {
    pub(crate) program: PathBuf,
    pub(crate) args: Vec<String>,
    pub(crate) cwd: PathBuf,
    pub(crate) profile: String,
    pub(crate) source: String,
    pub(crate) install_dir: Option<PathBuf>,
    pub(crate) version: Option<String>,
    pub(crate) use_sidecar: bool,
    pub(crate) extra_env: Vec<(String, String)>,
}

pub(crate) fn mini_venv_can_serve(python: &Path) -> bool {
    std::process::Command::new(python)
        .args(["-c", REQUIRED_SIDECAR_MODULES])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

pub(crate) fn mini_venv_provisioning(python: &Path) -> bool {
    python
        .parent()
        .and_then(Path::parent)
        .map(|venv_dir| venv_dir.join(PROVISIONING_LOCK_FILE).exists())
        .unwrap_or(false)
}

pub(crate) fn resolve_mini_backend_command<R: Runtime>(
    app: &AppHandle<R>,
    runtime_store: &MiniBackendRuntimeStore,
) -> Result<MiniBackendCommandSpec, String> {
    let profile = resolve_runtime_profile(app, runtime_store, false, false)?;
    if cfg!(debug_assertions) {
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
            extra_env: Vec::new(),
        });
    }

    if let Some(layered) =
        crate::runtime::layered::resolve_active_layered_runtime(app, Some(&profile))?
    {
        let short_hash = &layered.overlay_hash[..layered.overlay_hash.len().min(8)];
        let overlay_str = path_to_string(&layered.overlay_dir);
        return Ok(MiniBackendCommandSpec {
            program: layered.python_bin,
            args: vec![
                "-s".to_string(),
                "-B".to_string(),
                path_to_string(&layered.app_py),
            ],
            cwd: layered.overlay_dir,
            profile,
            source: "downloaded-runtime".to_string(),
            install_dir: Some(layered.engine_dir),
            version: Some(format!(
                "engine-{}-{}@{short_hash}",
                layered.engine_abi, layered.engine_version
            )),
            use_sidecar: false,
            extra_env: vec![
                ("PYTHONNOUSERSITE".to_string(), "1".to_string()),
                ("PYTHONPATH".to_string(), overlay_str),
            ],
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
            extra_env: Vec::new(),
        });
    }

    if !embedded_mini_backend_enabled() {
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
            extra_env: Vec::new(),
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
        extra_env: Vec::new(),
    })
}

pub(crate) fn embedded_mini_backend_enabled() -> bool {
    !matches!(
        option_env!("KOMA_EMBEDDED_MINI_BACKEND"),
        Some("0") | Some("false") | Some("FALSE")
    )
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
            if !mini_venv_provisioning(&candidate) && !mini_venv_can_serve(&candidate) {
                log::warn!(
                    "mini-backend: {} exists but cannot run `{}`; the sidecar will likely \
                     fail to start. Rebuild it with `bun run mini:repair` \
                     (`bun run mini:install-deps` also repairs it, but keeps the venv).",
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
    let start = env::current_dir().map_err(|error| error.to_string())?;
    for ancestor in start.ancestors().take(8) {
        if ancestor
            .join("packages")
            .join("mini-backend")
            .join("app.py")
            .exists()
        {
            return Ok(ancestor.to_path_buf());
        }
    }
    Err("Mini backend app.py was not found under packages/mini-backend.".to_string())
}

pub(crate) fn resolve_resources_dir<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
    app.path()
        .resource_dir()
        .map(|path| path.join("resources"))
        .or_else(|_| env::current_dir().map(|path| path.join("resources")))
        .unwrap_or_else(|_| PathBuf::from("resources"))
}

pub(crate) fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().to_string()
}
