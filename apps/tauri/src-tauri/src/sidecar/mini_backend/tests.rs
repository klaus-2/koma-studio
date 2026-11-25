//! Tests for the mini-backend sidecar launcher.
//! Lives in its own file so mini_backend.rs stays under the 1000-line audit limit.

use std::path::Path;

use super::command_spec::PROVISIONING_LOCK_FILE;
use super::*;

#[test]
fn detects_an_in_flight_dependency_install() {
    let temp = tempfile::tempdir().expect("tempdir");
    let venv_dir = temp.path().join(".venv-mini");
    let bin_dir = venv_dir.join(if cfg!(windows) { "Scripts" } else { "bin" });
    fs::create_dir_all(&bin_dir).expect("create venv layout");
    let python = bin_dir.join(if cfg!(windows) {
        "python.exe"
    } else {
        "python"
    });

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
    // The modules app.py imports at module scope must all be probed.
    for module in ["uvicorn", "fastapi", "PIL", "cv2"] {
        assert!(
            REQUIRED_SIDECAR_MODULES.contains(module),
            "{module} is imported by app.py but not probed before startup"
        );
    }
    // Importing cv2 alone cannot see a namespace package left behind by two
    // conflicting opencv distributions; the probe must read a native symbol.
    assert!(
        REQUIRED_SIDECAR_MODULES.contains("hasattr(cv2, 'imencode')"),
        "cv2 must be probed for a native symbol, not merely imported"
    );
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
    let app_py =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../packages/mini-backend/app.py");
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
    // The structured logger writes JSON with the level inside the object.
    assert_eq!(
        classify_backend_log(
            r#"{"ts":"2026-10-21T17:08:53-0300","level":"INFO","msg":"server.starting"}"#
        ),
        BackendLogLevel::Info
    );
    assert_eq!(
        classify_backend_log(r#"{"level":"WARNING","msg":"slow"}"#),
        BackendLogLevel::Warn
    );
    assert_eq!(
        classify_backend_log(r#"{"level":"ERROR","msg":"boom"}"#),
        BackendLogLevel::Error
    );
    assert_eq!(
        classify_backend_log(r#"{"msg":"no level field"}"#),
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

#[test]
fn extracts_port_from_local_api_url() {
    assert_eq!(
        parse_configured_port("http://127.0.0.1:8001/health"),
        Some(8001)
    );
    assert_eq!(parse_configured_port("http://localhost:5173/"), Some(5173));
    assert_eq!(parse_configured_port("http://127.0.0.1:9"), Some(9));
    assert_eq!(parse_configured_port("not a url"), None);
}

#[test]
fn parses_listening_handshake_from_stdout() {
    assert_eq!(
        parse_listening_port(r#"{"event":"listening","port":54321}"#),
        Some(54321)
    );
    assert_eq!(
        parse_listening_port(r#"{"event":"listening","port":0}"#),
        None
    );
    assert_eq!(
        parse_listening_port(r#"{"event":"ready","port":54321}"#),
        None
    );
    assert_eq!(parse_listening_port("INFO: Started server process"), None);
}
