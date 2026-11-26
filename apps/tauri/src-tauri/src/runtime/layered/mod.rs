pub mod gc;
pub mod install;
pub mod manifest;
pub mod overlay;
pub mod tar_zst;

use std::path::PathBuf;

use tauri::{AppHandle, Runtime};

use crate::runtime::profiles::RuntimeError;

use self::{
    manifest::{
        engine_install_dir, overlay_install_dir, read_layered_state, runtimes_root_dir,
        validate_safe_subpath, write_layered_state,
    },
    overlay::{ensure_bundled_overlay_seeded, is_overlay_dir_valid},
};

#[derive(Debug, Clone)]
pub struct ActiveLayeredRuntime {
    pub engine_abi: String,
    pub engine_version: String,
    pub overlay_hash: String,
    pub python_bin: PathBuf,
    pub app_py: PathBuf,
    pub engine_dir: PathBuf,
    pub overlay_dir: PathBuf,
}

pub fn resolve_active_layered_runtime<R: Runtime>(
    app: &AppHandle<R>,
    expected_profile: Option<&str>,
) -> Result<Option<ActiveLayeredRuntime>, RuntimeError> {
    let runtimes_root = runtimes_root_dir(app)?;
    let Some(mut state) = read_layered_state(&runtimes_root)? else {
        return Ok(None);
    };

    if let Some(profile) = expected_profile {
        if !profile.eq_ignore_ascii_case("auto") && state.active_profile != profile {
            return Ok(None);
        }
    }

    let engine_dir = engine_install_dir(
        &runtimes_root,
        &state.engine_abi,
        &state.engine_version,
        &state.active_profile,
    )?;
    let python_rel = validate_safe_subpath(&state.python_entry)?;
    let python_bin = engine_dir.join(python_rel);
    if !python_bin.is_file() {
        return Ok(None);
    }

    let mut overlay_dir = overlay_install_dir(&runtimes_root, &state.active_overlay_hash)?;
    if !is_overlay_dir_valid(&overlay_dir, "app.py", &[]) {
        if let Some(seeded_hash) = ensure_bundled_overlay_seeded(app, &runtimes_root)? {
            let seeded_dir = overlay_install_dir(&runtimes_root, &seeded_hash)?;
            if is_overlay_dir_valid(&seeded_dir, "app.py", &[]) {
                state.active_overlay_hash = seeded_hash;
                let _ = write_layered_state(&runtimes_root, &state);
                overlay_dir = seeded_dir;
            } else {
                return Ok(None);
            }
        } else {
            return Ok(None);
        }
    }

    let app_py = overlay_dir.join("app.py");
    if !app_py.is_file() {
        return Ok(None);
    }

    Ok(Some(ActiveLayeredRuntime {
        engine_abi: state.engine_abi,
        engine_version: state.engine_version,
        overlay_hash: state.active_overlay_hash,
        python_bin,
        app_py,
        engine_dir,
        overlay_dir,
    }))
}
