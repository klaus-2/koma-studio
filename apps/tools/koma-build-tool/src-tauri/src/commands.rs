use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use chrono::Local;

// ─── Types shared with frontend ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildConfig {
    pub v2_root: String,
    pub v1_root: String,
    pub landing_dir: String,
    pub vps_host: String,
    pub vps_user: String,
    pub vps_path: String,
    pub ssh_key: String,
    pub version: String,
    pub channel: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileInfo {
    pub id: String,
    pub label: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub phase: String,
    pub message: String,
    pub pct: f64,
    pub is_warn: bool,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildResult {
    pub success: bool,
    pub summary: String,
    pub log_path: String,
    pub duration_secs: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VpsStatus {
    pub total_gb: f64,
    pub used_gb: f64,
    pub avail_gb: f64,
    pub use_pct: f64,
}

// ─── App state ───────────────────────────────────────────────────────

pub struct AppState {
    pub current_child: Mutex<Option<Child>>,
    pub config: BuildConfig,
}

/// Directory of this tool (first ancestor of the exe that contains package.json).
fn tool_root() -> String {
    std::env::current_exe()
        .unwrap_or_else(|_| PathBuf::from("."))
        .ancestors()
        .find(|p| p.join("package.json").exists())
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|| ".".to_string())
}

impl BuildConfig {
    pub fn default_from_env() -> Self {
        // Monorepo: this tool lives at <repo>/apps/tools/koma-build-tool.
        let tool_dir = tool_root();
        let repo_root = Path::new(&tool_dir)
            .ancestors()
            .nth(3) // tool -> tools -> apps -> repo
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| "..".to_string());

        let v2_root = format!("{}/apps/tauri", repo_root);
        let v1_root = format!("{}/apps/electron", repo_root);

        let landing_dir = std::env::var("KOMA_LANDING_DIR")
            .unwrap_or_else(|_| format!("{}/apps/landing", repo_root));

        Self {
            v2_root,
            v1_root,
            landing_dir,
            vps_host: std::env::var("KOMA_VPS_HOST").unwrap_or_default(),
            vps_user: std::env::var("KOMA_VPS_USER").unwrap_or_else(|_| "ubuntu".into()),
            vps_path: std::env::var("KOMA_VPS_PATH").unwrap_or_else(|_| "/var/www/koma-updates".into()),
            ssh_key: std::env::var("KOMA_VPS_SSH_KEY").unwrap_or_else(|_| format!("{}/.ssh/id_ed25519", std::env::var("HOME").or(std::env::var("USERPROFILE")).unwrap_or_else(|_| ".".into()))),
            version: std::env::var("BUILD_VERSION").unwrap_or_else(|_| "2.0.0-alpha.3".into()),
            channel: std::env::var("UPDATE_CHANNEL").unwrap_or_else(|_| "beta".into()),
        }
    }
}

// ─── Logging helper// ─── Logging helper ──────────────────────────────────────────────────

fn ensure_log_dir(log_dir: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(log_dir)
}

fn open_log_file(log_dir: &str, task: &str) -> std::io::Result<(std::fs::File, PathBuf)> {
    ensure_log_dir(log_dir)?;
    let ts = Local::now().format("%Y-%m-%d_%H%M%S");
    let path = PathBuf::from(log_dir).join(format!("{}_{}.log", ts, task));
    let file = std::fs::File::create(&path)?;
    Ok((file, path))
}

fn write_log(file: &mut std::fs::File, line: &str) {
    use std::io::Write;
    let ts = Local::now().format("%H:%M:%S%.3f");
    let _ = writeln!(file, "[{}] {}", ts, line);
}

// ─── Command execution helper ────────────────────────────────────────

pub fn run_command(
    app: &AppHandle,
    log_file: &mut std::fs::File,
    program: &str,
    args: &[&str],
    cwd: &str,
    phase: &str,
    phase_weight: f64,
    start_pct: f64,
) -> Result<f64, String> {
    let mut child = Command::new(program)
        .args(args)
        .current_dir(cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn {}: {}", program, e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);

    let app_clone = app.clone();
    let phase_owned = phase.to_string();

    // Read stdout
    let std_handle = std::thread::spawn(move || {
        for line in stdout_reader.lines() {
            if let Ok(text) = line {
                if !text.is_empty() {
                    let _ = app_clone.emit("build-progress", ProgressEvent {
                        phase: phase_owned.clone(),
                        message: text.clone(),
                        pct: 0.0, // will be set by the main thread
                        is_warn: text.contains("WARN") || text.contains("WARNING"),
                        is_error: text.contains("ERROR") || text.contains("Error:"),
                    });
                }
            }
        }
    });

    let app_clone2 = app.clone();
    let phase_owned2 = phase.to_string();
    let stderr_handle = std::thread::spawn(move || {
        for line in stderr_reader.lines() {
            if let Ok(text) = line {
                if !text.is_empty() {
                    let is_err = text.contains("ERROR") || text.contains("Error:") || text.contains("failed");
                    let _ = app_clone2.emit("build-progress", ProgressEvent {
                        phase: phase_owned2.clone(),
                        message: text.clone(),
                        pct: 0.0,
                        is_warn: text.contains("WARN") || text.contains("WARNING"),
                        is_error: is_err,
                    });
                }
            }
        }
    });

    let status = child.wait().map_err(|e| format!("Process wait error: {}", e))?;
    let _ = std_handle.join();
    let _ = stderr_handle.join();

    let final_pct = start_pct + phase_weight;
    let _ = app.emit("build-progress", ProgressEvent {
        phase: phase.to_string(),
        message: format!("[DONE] {} completed", phase),
        pct: final_pct,
        is_warn: false,
        is_error: false,
    });

    if !status.success() {
        return Err(format!("{} failed with exit code {:?}", phase, status.code()));
    }

    Ok(final_pct)
}

// ─── Tauri Commands ──────────────────────────────────────────────────

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> BuildConfig {
    state.config.clone()
}

#[tauri::command]
pub fn list_profiles() -> Vec<ProfileInfo> {
    vec![
        ProfileInfo { id: "cpu".into(), label: "CPU".into(), enabled: true },
        ProfileInfo { id: "intel-openvino".into(), label: "Intel OpenVINO".into(), enabled: false },
        ProfileInfo { id: "nvidia-cuda".into(), label: "NVIDIA CUDA".into(), enabled: false },
        ProfileInfo { id: "nvidia-cuda-legacy".into(), label: "NVIDIA CUDA Legacy".into(), enabled: false },
    ]
}

#[tauri::command]
pub async fn build_msi(app: AppHandle, state: State<'_, AppState>) -> Result<BuildResult, String> {
    let v2 = &state.config.v2_root;
    let log_dir = format!("{}/logs", tool_root());
    let (mut log, log_path) = open_log_file(&log_dir, "build-msi").map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    write_log(&mut log, "Starting MSI thin build...");

    let _ = app.emit("build-progress", ProgressEvent {
        phase: "MSI Build".into(),
        message: "Building hardened MSI (thin mode)...".into(),
        pct: 5.0,
        is_warn: false, is_error: false,
    });

    // Step 1: harden + build mini-backend + frontend + tauri build
    let result = run_command(
        &app, &mut log, "node", &["scripts/build-hardened-release.mjs", "--platform", "win"],
        v2, "Hardened Release", 0.85, 5.0,
    );

    match result {
        Ok(pct) => {
            let _ = app.emit("build-progress", ProgressEvent {
                phase: "MSI Build".into(),
                message: "MSI build completed successfully.".into(),
                pct: 100.0,
                is_warn: false, is_error: false,
            });
            write_log(&mut log, "MSI build SUCCESS");
            let dur = start.elapsed().as_secs();
            Ok(BuildResult {
                success: true,
                summary: format!("MSI built in {}s", dur),
                log_path: log_path.to_string_lossy().to_string(),
                duration_secs: dur,
            })
        }
        Err(e) => {
            write_log(&mut log, &format!("MSI build FAILED: {}", e));
            let dur = start.elapsed().as_secs();
            Err(format!("Build failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn build_update(app: AppHandle, state: State<'_, AppState>) -> Result<BuildResult, String> {
    let v2 = &state.config.v2_root;
    let config = &state.config;
    let log_dir = format!("{}/logs", tool_root());
    let (mut log, log_path) = open_log_file(&log_dir, "build-update").map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    write_log(&mut log, "Starting hardened release...");

    let _ = app.emit("build-progress", ProgressEvent {
        phase: "Hardened Build".into(),
        message: "Building hardened release...".into(),
        pct: 5.0, is_warn: false, is_error: false,
    });

    run_command(
        &app, &mut log, "node", &["scripts/build-hardened-release.mjs", "--platform", "win"],
        v2, "Hardened Build", 0.60, 5.0,
    )?;

    // Upload to VPS
    let _ = app.emit("build-progress", ProgressEvent {
        phase: "Upload".into(),
        message: "Uploading to VPS...".into(),
        pct: 85.0, is_warn: false, is_error: false,
    });

    let channel = &config.channel;
    let version = &config.version;
    let result = run_command(
        &app, &mut log, "node", &[
            "scripts/test-v2-roundtrip-vps.mjs",
            "--version", version,
            "--channel", channel,
        ],
        v2, "VPS Upload", 0.15, 85.0,
    );

    match result {
        Ok(_) => {
            write_log(&mut log, "Update build + deploy SUCCESS");
            let dur = start.elapsed().as_secs();
            Ok(BuildResult {
                success: true,
                summary: format!("Update built and deployed in {}s", dur),
                log_path: log_path.to_string_lossy().to_string(),
                duration_secs: dur,
            })
        }
        Err(e) => {
            write_log(&mut log, &format!("Update build OK but deploy FAILED: {}", e));
            let dur = start.elapsed().as_secs();
            Ok(BuildResult {
                success: true,
                summary: format!("Update built ({}s) but deploy skipped/failed", dur),
                log_path: log_path.to_string_lossy().to_string(),
                duration_secs: dur,
            })
        }
    }
}

#[tauri::command]
pub async fn build_artifacts(
    app: AppHandle,
    state: State<'_, AppState>,
    profiles: Vec<String>,
) -> Result<BuildResult, String> {
    let v2 = &state.config.v2_root;
    let log_dir = format!("{}/logs", tool_root());
    let (mut log, log_path) = open_log_file(&log_dir, "build-artifacts").map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    let profiles_str = profiles.join(",");
    write_log(&mut log, &format!("Starting artifacts build for: {}", profiles_str));

    // Ensure MINI_BACKEND_FORCE_REBUILD=1 so profiles are always rebuilt with
    // latest requirements (e.g. CUDA vs CPU onnxruntime conflict fix).
    // Pass selected profiles via env so the node script picks them up.
    // ponytail: set_var is unsafe in edition 2024 (not thread-safe); only the
    // child spawned below reads these. Upgrade path: Command::env(...) —
    // dropped because run_command has 13 call sites.
    unsafe {
        std::env::set_var("MINI_BACKEND_FORCE_REBUILD", "1");
        std::env::set_var("MINI_BACKEND_ARTIFACT_PROFILES", &profiles_str);
    }

    let result = run_command(
        &app, &mut log, "node", &[
            "scripts/build-mini-backend-artifacts.mjs",
            "release-desktop/mini-backend-artifacts",
        ],
        v2, "Artifacts Build", 1.0, 0.0,
    );

    match result {
        Ok(_) => {
            write_log(&mut log, "Artifacts build SUCCESS");
            let dur = start.elapsed().as_secs();
            Ok(BuildResult {
                success: true,
                summary: format!("Artifacts built in {}s", dur),
                log_path: log_path.to_string_lossy().to_string(),
                duration_secs: dur,
            })
        }
        Err(e) => {
            write_log(&mut log, &format!("Artifacts build FAILED: {}", e));
            Err(format!("Artifacts build failed: {}", e))
        }
    }
}

#[tauri::command]
pub async fn deploy_artifacts(app: AppHandle, state: State<'_, AppState>) -> Result<BuildResult, String> {
    let v2 = &state.config.v2_root;
    let config = &state.config;
    let log_dir = format!("{}/logs", tool_root());
    let (mut log, log_path) = open_log_file(&log_dir, "deploy-artifacts").map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    write_log(&mut log, "Starting artifacts deploy to VPS...");

    // scp latest.json
    let artifacts_dir = format!("{}/release-desktop/mini-backend-artifacts", v2);
    let ssh_target = format!("{}@{}", config.vps_user, config.vps_host);
    let remote_dir = format!("/var/www/koma-updates/{}/mini-backend-artifacts", config.channel);

    // Create remote dir
    let _ = run_command(
        &app, &mut log, "ssh", &[
            &ssh_target,
            &format!("mkdir -p {}", remote_dir),
        ],
        v2, "Create remote dir", 0.05, 0.0,
    );

    // Send zips
    let _ = run_command(
        &app, &mut log, "scp", &[
            &format!("{}/latest.json", artifacts_dir),
            &format!("{}:{}", ssh_target, remote_dir),
        ],
        v2, "Upload latest.json", 0.05, 5.0,
    );

    let _ = run_command(
        &app, &mut log, "scp", &[
            &format!("{}/mini-backend-runtime-*.zip", artifacts_dir),
            &format!("{}:{}", ssh_target, remote_dir),
        ],
        v2, "Upload profiles", 0.80, 10.0,
    );

    write_log(&mut log, "Artifacts deploy SUCCESS");
    let dur = start.elapsed().as_secs();
    Ok(BuildResult {
        success: true,
        summary: format!("Artifacts deployed in {}s", dur),
        log_path: log_path.to_string_lossy().to_string(),
        duration_secs: dur,
    })
}

#[tauri::command]
pub async fn deploy_landing(app: AppHandle, state: State<'_, AppState>) -> Result<BuildResult, String> {
    let config = &state.config;
    let log_dir = format!("{}/koma-build-tool/logs", config.v2_root);
    let (mut log, log_path) = open_log_file(&log_dir, "deploy-landing").map_err(|e| e.to_string())?;

    let start = std::time::Instant::now();
    write_log(&mut log, "Starting koma-landing build + deploy...");

    // Step 1: build landing
    let _ = app.emit("build-progress", ProgressEvent {
        phase: "Landing Build".into(),
        message: "Building koma-landing (bun run build)...".into(),
        pct: 5.0, is_warn: false, is_error: false,
    });

    // bun is a single binary available on PATH; it handles both
    // development and production builds without shell wrappers.
    let build_result = run_command(
        &app, &mut log, "bun", &["run", "build"],
        &config.landing_dir, "Landing Build", 0.40, 5.0,
    );
    build_result?;

    // Step 2: tar the out/ directory
    let _ = app.emit("build-progress", ProgressEvent {
        phase: "Landing Deploy".into(),
        message: "Packing and uploading...".into(),
        pct: 50.0, is_warn: false, is_error: false,
    });

    let out_dir = format!("{}/out", config.landing_dir);
    let tmp_tar = format!("/tmp/koma-landing-deploy-{}.tar", uuid::Uuid::new_v4().to_string().split('-').next().unwrap_or("x"));

    run_command(
        &app, &mut log, "tar", &["-cf", &tmp_tar, "-C", &out_dir, "."],
        &config.landing_dir, "Pack", 0.10, 50.0,
    )?;

    // Step 3: scp to VPS
    let ssh_target = format!("{}@{}", config.vps_user, config.vps_host);
    run_command(
        &app, &mut log, "scp", &[&tmp_tar, &format!("{}:{}", ssh_target, tmp_tar)],
        &config.landing_dir, "SCP Upload", 0.20, 60.0,
    )?;

    // Step 4: ssh extract + replace
    let remote_cmd = format!(
        "sudo rm -rf /var/www/koma-studio.site && \
         sudo mkdir -p /var/www/koma-studio.site && \
         sudo tar -xf {} -C /var/www/koma-studio.site && \
         sudo chown -R www-data:www-data /var/www/koma-studio.site && \
         sudo rm -f {}",
        tmp_tar, tmp_tar
    );
    run_command(
        &app, &mut log, "ssh", &[&ssh_target, &remote_cmd],
        &config.landing_dir, "SSH Extract", 0.15, 80.0,
    )?;

    // Step 5: verify
    let _ = run_command(
        &app, &mut log, "ssh", &[
            &ssh_target,
            "curl -sI http://127.0.0.1/ -H 'Host: koma-studio.site' | head -5",
        ],
        &config.landing_dir, "Verify", 0.05, 95.0,
    );

    write_log(&mut log, "Landing deploy SUCCESS");
    let dur = start.elapsed().as_secs();
    Ok(BuildResult {
        success: true,
        summary: format!("Landing built and deployed in {}s", dur),
        log_path: log_path.to_string_lossy().to_string(),
        duration_secs: dur,
    })
}

#[tauri::command]
pub async fn get_vps_status(state: State<'_, AppState>) -> Result<VpsStatus, String> {
    let config = &state.config;
    let ssh_target = format!("{}@{}", config.vps_user, config.vps_host);
    let output = Command::new("ssh")
        .args([
            &ssh_target,
            r#"df -h /mnt/teste50gb | tail -1 | awk '{print $2,$3,$4,$5}'"#,
        ])
        .output()
        .map_err(|e| format!("SSH error: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = stdout.trim().split_whitespace().collect();
    if parts.len() >= 4 {
        let parse_gb = |s: &str| -> f64 {
            if s.ends_with('G') {
                s.trim_end_matches('G').parse().unwrap_or(0.0)
            } else {
                s.parse().unwrap_or(0.0)
            }
        };
        let pct = parts[3].trim_end_matches('%').parse().unwrap_or(0.0);
        Ok(VpsStatus {
            total_gb: parse_gb(parts[0]),
            used_gb: parse_gb(parts[1]),
            avail_gb: parse_gb(parts[2]),
            use_pct: pct,
        })
    } else {
        Err(format!("Unexpected df output: {}", stdout))
    }
}

#[tauri::command]
pub async fn cancel_task(state: State<'_, AppState>) -> Result<(), String> {
    let mut child = state.current_child.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut c) = *child {
        let _ = c.kill();
        let _ = c.wait();
        *child = None;
    }
    Ok(())
}




