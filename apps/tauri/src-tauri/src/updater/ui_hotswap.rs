use std::{
    borrow::Cow,
    env, fs,
    io::Write,
    path::{Component, Path, PathBuf},
    sync::{Arc, RwLock},
    time::{Duration, Instant},
};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{
    App, AppHandle, Manager, Runtime,
    utils::assets::{AssetKey, CspHash},
};

use crate::runtime::{
    layered::{
        manifest::validate_safe_subpath,
        tar_zst::{extract_tar_zst_file, sha256_hex_file},
    },
    manifest_trust::{ensure_runtime_archive_url, validate_manifest_relative_path},
};

use super::release_manifest::{
    UPDATER_MINISIGN_PUBKEY, UiBundleDescriptor, current_native_abi_version, parse_semver_lenient,
    verify_minisign_bytes, verify_minisign_trusted_version,
};

const UI_STATE_FILE_NAME: &str = "ui-state.json";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UiHotswapStateFile {
    pub active_version: Option<String>,
    pub previous_version: Option<String>,
    pub pending_ack: bool,
    pub boot_failures: u32,
    pub native_abi_version: u32,
}

impl Default for UiHotswapStateFile {
    fn default() -> Self {
        Self {
            active_version: None,
            previous_version: None,
            pending_ack: false,
            boot_failures: 0,
            native_abi_version: current_native_abi_version(),
        }
    }
}

#[derive(Debug, Default)]
struct HotswapInner {
    active_bundle_dir: Option<PathBuf>,
    active_version: Option<String>,
    app_data_dir: Option<PathBuf>,
}

#[derive(Clone, Default)]
pub struct HotswapHandle {
    inner: Arc<RwLock<HotswapInner>>,
}

impl HotswapHandle {
    pub fn set_app_data_dir(&self, dir: PathBuf) {
        if let Ok(mut guard) = self.inner.write() {
            guard.app_data_dir = Some(dir);
        }
    }

    pub fn set_active(&self, version: Option<String>, bundle_dir: Option<PathBuf>) {
        if let Ok(mut guard) = self.inner.write() {
            guard.active_version = version;
            guard.active_bundle_dir = bundle_dir;
        }
    }

    pub fn active_version(&self) -> Option<String> {
        self.inner
            .read()
            .ok()
            .and_then(|guard| guard.active_version.clone())
    }

    pub fn active_bundle_dir(&self) -> Option<PathBuf> {
        self.inner
            .read()
            .ok()
            .and_then(|guard| guard.active_bundle_dir.clone())
    }
}

pub struct NoopAssets;

impl<R: Runtime> tauri::Assets<R> for NoopAssets {
    fn get(&self, _key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        None
    }

    fn iter(&self) -> Box<dyn Iterator<Item = (Cow<'_, str>, Cow<'_, [u8]>)> + '_> {
        Box::new(std::iter::empty())
    }

    fn csp_hashes(&self, _html_path: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        Box::new(std::iter::empty())
    }
}

pub struct HotswapAssets<R: Runtime> {
    embedded: Box<dyn tauri::Assets<R>>,
    handle: HotswapHandle,
}

impl<R: Runtime> HotswapAssets<R> {
    pub fn new(embedded: Box<dyn tauri::Assets<R>>, handle: HotswapHandle) -> Self {
        Self { embedded, handle }
    }
}

impl<R: Runtime> tauri::Assets<R> for HotswapAssets<R> {
    fn setup(&self, app: &App<R>) {
        self.embedded.setup(app);
        let Ok(app_data_dir) = app.path().app_data_dir() else {
            return;
        };
        self.handle.set_app_data_dir(app_data_dir.clone());
        if cfg!(dev) {
            return;
        }

        let root = app_data_dir.join("ui-bundles");
        let bundles_root = root.join("bundles");
        let mut state = read_ui_state(&root).unwrap_or_default();
        let native_version = app.package_info().version.to_string();
        let abi = current_native_abi_version();

        match resolve_startup_decision(&mut state, &bundles_root, &native_version, abi) {
            StartupDecision::UseBundle {
                version,
                dir,
                state_changed,
            } => {
                if state_changed {
                    let _ = write_ui_state(&root, &state);
                }
                self.handle.set_active(Some(version), Some(dir));
            }
            StartupDecision::UseEmbedded { state_changed } => {
                if state_changed {
                    let _ = write_ui_state(&root, &state);
                }
                self.handle.set_active(None, None);
            }
        }
    }

    fn get(&self, key: &AssetKey) -> Option<Cow<'_, [u8]>> {
        if let Some(bundle_dir) = self.handle.active_bundle_dir() {
            if let Some(rel) = sanitize_asset_key(key.as_ref()) {
                let candidate = bundle_dir.join(rel);
                if candidate.is_file() {
                    if let Ok(bytes) = fs::read(&candidate) {
                        return Some(Cow::Owned(bytes));
                    }
                }
            }
        }
        self.embedded.get(key)
    }

    fn iter(&self) -> Box<dyn Iterator<Item = (Cow<'_, str>, Cow<'_, [u8]>)> + '_> {
        self.embedded.iter()
    }

    fn csp_hashes(&self, html_path: &AssetKey) -> Box<dyn Iterator<Item = CspHash<'_>> + '_> {
        if self.handle.active_bundle_dir().is_some() {
            Box::new(std::iter::empty())
        } else {
            self.embedded.csp_hashes(html_path)
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum StartupDecision {
    UseBundle {
        version: String,
        dir: PathBuf,
        state_changed: bool,
    },
    UseEmbedded {
        state_changed: bool,
    },
}

pub fn sanitize_asset_key(raw: &str) -> Option<PathBuf> {
    let trimmed = raw.trim().trim_start_matches('/');
    let rel = if trimmed.is_empty() {
        "index.html"
    } else {
        trimmed
    };
    if rel.contains('\\') || rel.contains(':') || rel.chars().any(char::is_control) {
        return None;
    }
    let mut clean = PathBuf::new();
    for component in Path::new(rel).components() {
        match component {
            Component::Normal(part) => {
                let s = part.to_string_lossy();
                if s == ".." || s.is_empty() {
                    return None;
                }
                clean.push(part);
            }
            _ => return None,
        }
    }
    if clean.as_os_str().is_empty() {
        None
    } else {
        Some(clean)
    }
}

pub fn resolve_startup_decision(
    state: &mut UiHotswapStateFile,
    bundles_root: &Path,
    native_pkg_version: &str,
    current_native_abi: u32,
) -> StartupDecision {
    if state.native_abi_version != current_native_abi {
        *state = UiHotswapStateFile {
            native_abi_version: current_native_abi,
            ..Default::default()
        };
        return StartupDecision::UseEmbedded {
            state_changed: true,
        };
    }

    let Some(active) = state.active_version.clone() else {
        return StartupDecision::UseEmbedded {
            state_changed: false,
        };
    };

    if let (Some(native_v), Some(active_v)) = (
        parse_semver_lenient(native_pkg_version),
        parse_semver_lenient(&active),
    ) {
        if native_v >= active_v {
            state.active_version = None;
            state.previous_version = None;
            state.pending_ack = false;
            state.boot_failures = 0;
            return StartupDecision::UseEmbedded {
                state_changed: true,
            };
        }
    }

    let mut changed = false;
    if state.pending_ack {
        state.boot_failures = state.boot_failures.saturating_add(1);
        changed = true;
        if state.boot_failures >= 2 {
            log::warn!(
                "ui-hotswap: bundle {active} crashed/unacked {} times; rolling back",
                state.boot_failures
            );
            state.active_version = state.previous_version.take();
            state.pending_ack = false;
            state.boot_failures = 0;
            if let Some(ref fallback) = state.active_version {
                if let Some(dir) = valid_bundle_dir(bundles_root, fallback, native_pkg_version) {
                    return StartupDecision::UseBundle {
                        version: fallback.clone(),
                        dir,
                        state_changed: true,
                    };
                }
            }
            state.active_version = None;
            return StartupDecision::UseEmbedded {
                state_changed: true,
            };
        }
    }

    if let Some(dir) = valid_bundle_dir(bundles_root, &active, native_pkg_version) {
        return StartupDecision::UseBundle {
            version: active,
            dir,
            state_changed: changed,
        };
    }

    state.active_version = None;
    state.pending_ack = false;
    state.boot_failures = 0;
    if let Some(fallback) = state.previous_version.take() {
        if let Some(dir) = valid_bundle_dir(bundles_root, &fallback, native_pkg_version) {
            state.active_version = Some(fallback.clone());
            return StartupDecision::UseBundle {
                version: fallback,
                dir,
                state_changed: true,
            };
        }
    }

    StartupDecision::UseEmbedded {
        state_changed: true,
    }
}

fn valid_bundle_dir(
    bundles_root: &Path,
    version: &str,
    native_pkg_version: &str,
) -> Option<PathBuf> {
    if validate_manifest_relative_path(version).is_err() {
        return None;
    }
    if let (Some(native_v), Some(ver)) = (
        parse_semver_lenient(native_pkg_version),
        parse_semver_lenient(version),
    ) {
        if native_v >= ver {
            return None;
        }
    }
    let dir = bundles_root.join(version);
    if dir.join("index.html").is_file() {
        Some(dir)
    } else {
        None
    }
}

pub fn ui_bundles_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join("ui-bundles"))
        .map_err(|error| error.to_string())
}

pub fn read_ui_state(root: &Path) -> Option<UiHotswapStateFile> {
    let raw = fs::read_to_string(root.join(UI_STATE_FILE_NAME)).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn write_ui_state(root: &Path, state: &UiHotswapStateFile) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    let raw = serde_json::to_string_pretty(state).map_err(|error| error.to_string())?;
    let tmp = root.join(format!("{UI_STATE_FILE_NAME}.tmp"));
    fs::write(&tmp, format!("{raw}\n")).map_err(|error| error.to_string())?;
    let dest = root.join(UI_STATE_FILE_NAME);
    if dest.exists() {
        let _ = fs::remove_file(&dest);
    }
    fs::rename(&tmp, &dest).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn stage_ui_bundle<R: Runtime>(
    app: &AppHandle<R>,
    archive_path: &Path,
    expected_sha256: &str,
    version: &str,
    native_abi_version: u32,
) -> Result<PathBuf, String> {
    validate_manifest_relative_path(version).map_err(|error| error.to_string())?;
    if !expected_sha256.trim().is_empty() {
        let actual = sha256_hex_file(archive_path).map_err(|error| error.to_string())?;
        if !actual.eq_ignore_ascii_case(expected_sha256.trim()) {
            return Err(format!(
                "UI bundle sha256 mismatch: expected {expected_sha256}, got {actual}"
            ));
        }
    }

    let root = ui_bundles_root(app)?;
    let bundles_root = root.join("bundles");
    fs::create_dir_all(&bundles_root).map_err(|error| error.to_string())?;

    let target_dir = bundles_root.join(version);
    let tmp_dir = bundles_root.join(format!("{version}.tmp"));
    if tmp_dir.exists() {
        let _ = fs::remove_dir_all(&tmp_dir);
    }
    extract_tar_zst_file(archive_path, &tmp_dir).map_err(|error| error.to_string())?;
    if !tmp_dir.join("index.html").is_file() {
        let _ = fs::remove_dir_all(&tmp_dir);
        return Err("Extracted UI bundle missing index.html".to_string());
    }
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|error| error.to_string())?;
    }
    fs::rename(&tmp_dir, &target_dir).map_err(|error| error.to_string())?;

    let mut state = read_ui_state(&root).unwrap_or_default();
    if state.active_version.as_deref() != Some(version) {
        state.previous_version = state.active_version.take();
    }
    state.active_version = Some(version.to_string());
    state.pending_ack = true;
    state.boot_failures = 0;
    state.native_abi_version = native_abi_version;
    write_ui_state(&root, &state)?;

    if let Ok(entries) = fs::read_dir(&bundles_root) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if entry.path().is_dir()
                && state.active_version.as_deref() != Some(name.as_str())
                && state.previous_version.as_deref() != Some(name.as_str())
            {
                let _ = fs::remove_dir_all(entry.path());
            }
        }
    }

    let _ = validate_safe_subpath("index.html");
    Ok(target_dir)
}

pub fn ack_ui_ready<R: Runtime>(app: &AppHandle<R>) -> bool {
    let Ok(root) = ui_bundles_root(app) else {
        return false;
    };
    let Some(mut state) = read_ui_state(&root) else {
        return false;
    };
    if !state.pending_ack && state.boot_failures == 0 {
        return true;
    }
    state.pending_ack = false;
    state.boot_failures = 0;
    write_ui_state(&root, &state).is_ok()
}

pub fn apply_staged_ui_hotswap<R: Runtime>(
    app: &AppHandle<R>,
    handle: &HotswapHandle,
    staged_version: &str,
) -> Result<(), String> {
    let root = ui_bundles_root(app)?;
    let bundle_dir = root.join("bundles").join(staged_version);
    if !bundle_dir.join("index.html").is_file() {
        return Err(format!(
            "Staged UI bundle {staged_version} is missing index.html"
        ));
    }
    handle.set_active(Some(staged_version.to_string()), Some(bundle_dir));
    if let Some(window) = app.get_webview_window("main") {
        window
            .eval("window.location.reload()")
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub async fn download_and_stage_ui_bundle<R: Runtime, F>(
    app: &AppHandle<R>,
    manifest_url: &str,
    descriptor: &UiBundleDescriptor,
    version: &str,
    mut on_progress: F,
) -> Result<(), String>
where
    F: FnMut(u64, u64, f64),
{
    validate_manifest_relative_path(&descriptor.file).map_err(|error| error.to_string())?;
    validate_manifest_relative_path(version).map_err(|error| error.to_string())?;
    ensure_runtime_archive_url(manifest_url, &descriptor.url).map_err(|error| error.to_string())?;

    let client = crate::security::cert_pinning::pinned_http_client(app, Duration::from_secs(60))
        .map_err(|error| error.to_string())?;
    let response = client
        .get(&descriptor.url)
        .timeout(Duration::from_secs(60))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("HTTP {} downloading UI bundle", response.status()));
    }
    let total = response.content_length().unwrap_or(descriptor.size).max(1);

    let downloads_dir = env::temp_dir().join("koma-ui-downloads");
    fs::create_dir_all(&downloads_dir).map_err(|error| error.to_string())?;
    let temp_archive = downloads_dir.join(&descriptor.file);
    let mut out = fs::File::create(&temp_archive).map_err(|error| error.to_string())?;

    let started = Instant::now();
    let mut last_emit = Instant::now();
    let mut transferred: u64 = 0;
    let mut all_bytes = Vec::with_capacity(usize::try_from(descriptor.size).unwrap_or(0));
    let mut stream = response.bytes_stream();

    while let Some(chunk_res) = tokio::time::timeout(Duration::from_secs(30), stream.next())
        .await
        .map_err(|_| "UI bundle download timed out".to_string())?
    {
        let chunk = chunk_res.map_err(|error| error.to_string())?;
        out.write_all(&chunk).map_err(|error| error.to_string())?;
        all_bytes.extend_from_slice(&chunk);
        transferred += chunk.len() as u64;
        if last_emit.elapsed() >= Duration::from_millis(100) {
            last_emit = Instant::now();
            let elapsed = started.elapsed().as_secs_f64().max(0.001);
            on_progress(transferred, total, (transferred as f64) / elapsed);
        }
    }
    out.flush().map_err(|error| error.to_string())?;
    drop(out);
    let elapsed = started.elapsed().as_secs_f64().max(0.001);
    on_progress(transferred, total, (transferred as f64) / elapsed);

    let signature_text = if !descriptor.signature.trim().is_empty() {
        descriptor.signature.clone()
    } else {
        let sig_res = client
            .get(format!("{}.sig", descriptor.url))
            .timeout(Duration::from_secs(15))
            .send()
            .await
            .map_err(|error| error.to_string())?;
        if !sig_res.status().is_success() {
            let _ = fs::remove_file(&temp_archive);
            return Err(format!(
                "UI bundle signature unavailable (HTTP {})",
                sig_res.status()
            ));
        }
        sig_res.text().await.map_err(|error| error.to_string())?
    };

    let trusted_comment =
        verify_minisign_bytes(UPDATER_MINISIGN_PUBKEY, &all_bytes, &signature_text)?;
    verify_minisign_trusted_version(&trusted_comment, version, false)?;

    let app_clone = app.clone();
    let temp_clone = temp_archive.clone();
    let expected_sha = descriptor.sha256.clone();
    let version_owned = version.to_string();
    let abi = descriptor.native_abi_version;
    let stage_res = tokio::task::spawn_blocking(move || {
        stage_ui_bundle(&app_clone, &temp_clone, &expected_sha, &version_owned, abi)
    })
    .await
    .map_err(|error| error.to_string())?;

    let _ = fs::remove_file(&temp_archive);
    stage_res.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rolls_back_after_two_unacked_boots_and_clears_when_native_catches_up() {
        let temp = tempfile::tempdir().unwrap();
        let bundles = temp.path().join("bundles");
        fs::create_dir_all(bundles.join("1.4.1")).unwrap();
        fs::write(bundles.join("1.4.1/index.html"), "<html>prev</html>").unwrap();
        fs::create_dir_all(bundles.join("1.4.2")).unwrap();
        fs::write(bundles.join("1.4.2/index.html"), "<html>bad</html>").unwrap();

        let mut state = UiHotswapStateFile {
            active_version: Some("1.4.2".to_string()),
            previous_version: Some("1.4.1".to_string()),
            pending_ack: true,
            boot_failures: 0,
            native_abi_version: 1,
        };

        let first = resolve_startup_decision(&mut state, &bundles, "1.4.0", 1);
        assert!(
            matches!(first, StartupDecision::UseBundle { ref version, .. } if version == "1.4.2")
        );
        assert_eq!(state.boot_failures, 1);

        let second = resolve_startup_decision(&mut state, &bundles, "1.4.0", 1);
        assert!(
            matches!(second, StartupDecision::UseBundle { ref version, .. } if version == "1.4.1")
        );
        assert_eq!(state.active_version.as_deref(), Some("1.4.1"));
        assert!(!state.pending_ack);

        let caught_up = resolve_startup_decision(&mut state, &bundles, "1.4.1", 1);
        assert_eq!(
            caught_up,
            StartupDecision::UseEmbedded {
                state_changed: true
            }
        );
        assert_eq!(state.active_version, None);
    }

    #[test]
    fn sanitizes_asset_keys_against_traversal() {
        assert_eq!(
            sanitize_asset_key("/assets/index.js"),
            Some(PathBuf::from("assets/index.js"))
        );
        assert_eq!(sanitize_asset_key(""), Some(PathBuf::from("index.html")));
        assert_eq!(sanitize_asset_key("/../etc/passwd"), None);
        assert_eq!(sanitize_asset_key("C:\\Windows\\win.ini"), None);
    }
}
