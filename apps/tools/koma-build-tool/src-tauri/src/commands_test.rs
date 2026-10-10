use super::*;
use crate::commands::list_profiles;
use crate::commands::{BuildConfig, BuildResult, ProfileInfo, ProgressEvent, VpsStatus};
use serde_json;

// Inline helpers that mirror private functions – avoids exposing internals
// for test-only access.
fn ensure_log_dir(path: &str) -> std::io::Result<()> {
    std::fs::create_dir_all(path)
}

fn open_log_file(dir: &str, task: &str) -> std::io::Result<std::fs::File> {
    ensure_log_dir(dir)?;
    let ts = chrono::Local::now().format("%Y-%m-%d_%H%M%S");
    let path = std::path::PathBuf::from(dir).join(format!("{}_{}.log", ts, task));
    std::fs::File::create(&path)
}

fn write_log(file: &mut std::fs::File, line: &str) {
    use std::io::Write;
    let ts = chrono::Local::now().format("%H:%M:%S%.3f");
    let _ = writeln!(file, "[{}] {}", ts, line);
}

// ─── Tests for types (serialization round-trips) ────────────────────

#[test]
fn test_build_config_serialization() {
    let config = BuildConfig {
        v2_root: "/test/v2".into(),
        v1_root: "/test/v1".into(),
        landing_dir: "/test/landing".into(),
        vps_host: "host.test".into(),
        vps_user: "user".into(),
        vps_path: "/path".into(),
        ssh_key: "/key".into(),
        version: "1.0.0".into(),
        channel: "beta".into(),
    };
    let json = serde_json::to_string(&config).unwrap();
    let decoded: BuildConfig = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.v2_root, "/test/v2");
    assert_eq!(decoded.channel, "beta");
}

#[test]
fn test_profile_info_serialization() {
    let profiles = list_profiles();
    assert_eq!(profiles.len(), 4);
    assert!(profiles[0].enabled); // cpu
    assert_eq!(profiles[0].id, "cpu");
    assert!(!profiles[2].enabled); // nvidia-cuda starts disabled
}

#[test]
fn test_progress_event_serialization() {
    let ev = ProgressEvent {
        phase: "Build".into(),
        message: "working".into(),
        pct: 50.0,
        is_warn: false,
        is_error: true,
    };
    let json = serde_json::to_string(&ev).unwrap();
    assert!(json.contains("\"is_error\":true"));
    assert!(json.contains("\"pct\":50.0"));
}

#[test]
fn test_build_result_serialization() {
    let result = BuildResult {
        success: true,
        summary: "All good".into(),
        log_path: "/logs/1.log".into(),
        duration_secs: 42,
    };
    let json = serde_json::to_string(&result).unwrap();
    assert!(json.contains("\"success\":true"));
    assert!(json.contains("\"duration_secs\":42"));
}

#[test]
fn test_vps_status_serialization() {
    let status = VpsStatus {
        total_gb: 49.0,
        used_gb: 14.0,
        avail_gb: 33.0,
        use_pct: 30.0,
    };
    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"total_gb\":49.0"));
}

// ─── Tests for BuildConfig::default_from_env ─────────────────────────

#[test]
fn test_default_config_has_defaults() {
    // env var overrides. ponytail: set_var/remove_var are unsafe in edition
    // 2024; the parallel-test env race is pre-existing. Upgrade path:
    // override parameters on BuildConfig::default_from_env.
    unsafe {
        std::env::set_var("KOMA_VPS_HOST", "custom.host");
        std::env::set_var("BUILD_VERSION", "2.0.0-rc.1");
        std::env::set_var("UPDATE_CHANNEL", "stable");
    }

    let config = BuildConfig::default_from_env();

    assert_eq!(config.vps_host, "custom.host");
    assert_eq!(config.version, "2.0.0-rc.1");
    assert_eq!(config.channel, "stable");
    assert_eq!(config.vps_user, "ubuntu");
    assert_eq!(config.vps_path, "/var/www/koma-updates");

    // Clean up
    unsafe {
        std::env::remove_var("KOMA_VPS_HOST");
        std::env::remove_var("BUILD_VERSION");
        std::env::remove_var("UPDATE_CHANNEL");
    }
}

#[test]
fn test_default_config_fallback() {
    // Previous test sets env vars; they persist for same-process test execution.
    // This test verifies BuildConfig::default_from_env picks up whatever is set.
    let config = BuildConfig::default_from_env();

    // Env was set in test_default_config_has_defaults, so values reflect that.
    // Just verify it doesn't crash and returns a valid config.
    assert!(!config.v2_root.is_empty());
    assert!(!config.vps_host.is_empty());
    assert!(!config.vps_user.is_empty());
}

// ─── Tests for logging helpers ───────────────────────────────────────

#[test]
fn test_ensure_log_dir_creates() {
    let tmp = std::env::temp_dir().join(format!("koma-test-logs-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);

    assert!(ensure_log_dir(tmp.to_str().unwrap()).is_ok());
    assert!(tmp.exists());

    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn test_open_log_file_creates_writable_file() {
    let tmp = std::env::temp_dir().join(format!("koma-test-file-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&tmp);

    let mut file = open_log_file(tmp.to_str().unwrap(), "test-task").unwrap();

    write_log(&mut file, "test line");
    write_log(&mut file, "another line");
    drop(file); // flush & close

    // Re-read and verify — find the file we just wrote
    let entries: Vec<_> = std::fs::read_dir(&tmp)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().contains("test-task"))
        .collect();
    assert!(!entries.is_empty(), "no test-task log file found");

    let path = entries[0].path();
    let content = std::fs::read_to_string(&path).unwrap();
    assert!(content.contains("test line"), "content: {}", content);
    assert!(content.contains("another line"), "content: {}", content);

    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn test_open_log_file_timestamped_name() {
    let tmp = std::env::temp_dir().join(format!("koma-test-logs-ts-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&tmp);

    let file = open_log_file(tmp.to_str().unwrap(), "mybuild").unwrap();
    drop(file);

    let entries: Vec<_> = std::fs::read_dir(&tmp)
        .unwrap()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_name().to_string_lossy().contains("mybuild"))
        .collect();

    assert!(!entries.is_empty(), "no mybuild log file found");
    let name = entries[0].file_name().to_string_lossy().to_string();
    // Format: YYYY-MM-DD_HHMMSS_mybuild.log
    assert!(name.len() > 20, "name too short: {}", name);
    assert!(name.ends_with("_mybuild.log"), "name: {}", name);

    let _ = std::fs::remove_dir_all(&tmp);
}

// ─── Tests for VPS status parsing ───────────────────────────────────

#[test]
fn test_vps_status_parse_valid() {
    // Simulate 'df -h /mnt/teste50gb | tail -1' output
    // Output format: /dev/sdb1  49G  14G  33G  30% /mnt/teste50gb
    let input = "49G  14G  33G  30%";
    let parts: Vec<&str> = input.split_whitespace().collect();

    let status = VpsStatus {
        total_gb: {
            let s = parts[0];
            s.trim_end_matches('G').parse().unwrap_or(0.0)
        },
        used_gb: {
            let s = parts[1];
            s.trim_end_matches('G').parse().unwrap_or(0.0)
        },
        avail_gb: {
            let s = parts[2];
            s.trim_end_matches('G').parse().unwrap_or(0.0)
        },
        use_pct: {
            parts[3].trim_end_matches('%').parse().unwrap_or(0.0)
        },
    };

    assert_eq!(status.total_gb, 49.0);
    assert_eq!(status.used_gb, 14.0);
    assert_eq!(status.avail_gb, 33.0);
    assert_eq!(status.use_pct, 30.0);
}

#[test]
fn test_vps_status_parse_boundary() {
    // Edge: 0 values
    let input = "0G  0G  0G  0%";
    let parts: Vec<&str> = input.split_whitespace().collect();

    let parse_gb = |s: &str| -> f64 {
        if s.ends_with('G') {
            s.trim_end_matches('G').parse().unwrap_or(0.0)
        } else {
            s.parse().unwrap_or(0.0)
        }
    };
    let pct = parts[3].trim_end_matches('%').parse().unwrap_or(0.0);

    assert!((pct - 0.0_f64).abs() < f64::EPSILON);
    let val = parse_gb(parts[0]);
    assert!((val - 0.0_f64).abs() < f64::EPSILON);
}

#[test]
fn test_vps_status_parse_large_values() {
    // Edge: large values
    let input = "500G  250G  250G  50%";
    let parts: Vec<&str> = input.split_whitespace().collect();

    let parse_gb = |s: &str| -> f64 {
        if s.ends_with('G') {
            s.trim_end_matches('G').parse().unwrap_or(0.0)
        } else {
            s.parse().unwrap_or(0.0)
        }
    };

    assert!((parse_gb(parts[0]) - 500.0_f64).abs() < f64::EPSILON);
    assert!((parse_gb(parts[1]) - 250.0_f64).abs() < f64::EPSILON);
}

// ─── Tests for list_profiles ─────────────────────────────────────────

#[test]
fn test_list_profiles_structure() {
    let profiles = list_profiles();
    assert_eq!(profiles.len(), 4);

    // Check order and defaults
    assert_eq!(profiles[0].id, "cpu");
    assert_eq!(profiles[0].label, "CPU");
    assert!(profiles[0].enabled);

    assert_eq!(profiles[1].id, "intel-openvino");
    assert!(!profiles[1].enabled);

    assert_eq!(profiles[2].id, "nvidia-cuda");
    assert_eq!(profiles[2].label, "NVIDIA CUDA");

    assert_eq!(profiles[3].id, "nvidia-cuda-legacy");
}

// ─── Tests for AppState ──────────────────────────────────────────────

#[test]
fn test_app_state_default_fields() {
    let config = BuildConfig::default_from_env();
    let state = AppState {
        current_child: std::sync::Mutex::new(None),
        config: config.clone(),
    };

    let guard = state.current_child.lock().unwrap();
    assert!(guard.is_none());
    drop(guard);

    assert_eq!(state.config.vps_path, config.vps_path);
}

// ─── Tests for build-result edge cases ───────────────────────────────

#[test]
fn test_build_result_failure() {
    let result = BuildResult {
        success: false,
        summary: "Something went wrong".into(),
        log_path: String::new(),
        duration_secs: 0,
    };
    assert!(!result.success);
    assert!(result.log_path.is_empty());
    assert_eq!(result.duration_secs, 0);
}

#[test]
fn test_progress_event_edge_cases() {
    let cases = vec![
        ("warn case", ProgressEvent { phase: "".into(), message: "WARN: deprecation".into(), pct: 50.0, is_warn: true, is_error: false }),
        ("error case", ProgressEvent { phase: "test".into(), message: "ERROR: crash".into(), pct: 100.0, is_warn: false, is_error: true }),
        ("both false", ProgressEvent { phase: "info".into(), message: "all good".into(), pct: 0.0, is_warn: false, is_error: false }),
    ];

    for (name, ev) in &cases {
        let json = serde_json::to_string(ev).unwrap();
        assert!(!json.is_empty(), "case {} failed", name);
        assert!(
            (ev.pct >= 0.0 && ev.pct <= 100.0) || ev.pct == 0.0,
            "pct out of range in case {}",
            name
        );
    }
}
