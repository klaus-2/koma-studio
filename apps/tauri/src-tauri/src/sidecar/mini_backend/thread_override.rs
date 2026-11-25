//! Thread-override file contract shared by both desktop shells.
//! Extracted from mini_backend.rs to respect the 1000-line audit limit.

use std::{fs, io::ErrorKind, path::Path};

use serde::{Deserialize, Serialize};

/// JSON override file the renderer's thread setting lands in; both shells
/// read it at every sidecar spawn. A missing or malformed file means the
/// sidecar keeps its defaults.
pub(crate) const MINI_BACKEND_THREAD_OVERRIDE_FILE: &str =
    "mini-backend-thread-override.json";

/// Schema of ``mini-backend-thread-override.json``. camelCase keys are the
/// wire format shared with the Electron shell; ``default`` tolerates files
/// written before ``interOpThreads`` and the runtime-tunable fields existed.
/// An absent tunable field means the sidecar keeps its own default.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub(crate) struct MiniBackendThreadOverride {
    pub intra_op_threads: Option<u32>,
    pub inter_op_threads: Option<u32>,
    pub engine_idle_timeout_seconds: Option<u32>,
    pub working_resolution_megapixels: Option<f64>,
    pub working_resolution_ocr_clean: Option<bool>,
}

fn sanitize_thread_value(value: &serde_json::Value) -> Option<u32> {
    let raw = value.as_f64()?;
    if !raw.is_finite() {
        return None;
    }
    let rounded = raw.round();
    if rounded < 1.0 {
        return None;
    }
    Some((rounded.min(64.0)) as u32)
}

fn sanitize_seconds_value(value: &serde_json::Value) -> Option<u32> {
    let raw = value.as_f64()?;
    if !raw.is_finite() {
        return None;
    }
    let clamped = raw.round().clamp(0.0, 86_400.0);
    Some(clamped as u32)
}

fn sanitize_megapixels_value(value: &serde_json::Value) -> Option<f64> {
    let raw = value.as_f64()?;
    if !raw.is_finite() {
        return None;
    }
    Some(raw.clamp(4.0, 64.0))
}

fn sanitize_thread_override_value(
    value: &serde_json::Value,
) -> MiniBackendThreadOverride {
    let Some(map) = value.as_object() else {
        return MiniBackendThreadOverride::default();
    };
    MiniBackendThreadOverride {
        intra_op_threads: map.get("intraOpThreads").and_then(sanitize_thread_value),
        inter_op_threads: map.get("interOpThreads").and_then(sanitize_thread_value),
        engine_idle_timeout_seconds: map
            .get("engineIdleTimeoutSeconds")
            .and_then(sanitize_seconds_value),
        working_resolution_megapixels: map
            .get("workingResolutionMegapixels")
            .and_then(sanitize_megapixels_value),
        working_resolution_ocr_clean: map
            .get("workingResolutionOcrClean")
            .and_then(serde_json::Value::as_bool),
    }
}

pub(crate) fn read_mini_backend_thread_override_at(
    user_data_dir: &Path,
) -> MiniBackendThreadOverride {
    let path = user_data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE);
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(error) if error.kind() == ErrorKind::NotFound => {
            return MiniBackendThreadOverride::default();
        }
        Err(error) => {
            log::warn!("thread_override.read_failed: {error}");
            return MiniBackendThreadOverride::default();
        }
    };
    match serde_json::from_str::<serde_json::Value>(&raw) {
        Ok(parsed) => sanitize_thread_override_value(&parsed),
        Err(error) => {
            log::warn!("thread_override.parse_failed: {error}");
            MiniBackendThreadOverride::default()
        }
    }
}

/// Pure mapping: override → the spawn-env pairs the sidecar reads. The
/// intra-op value is mirrored into ``OMP_NUM_THREADS`` because OpenMP reads
/// it once at process start.
pub(crate) fn mini_backend_thread_env_pairs(
    override_env: &MiniBackendThreadOverride,
) -> Vec<(&'static str, String)> {
    let mut pairs: Vec<(&'static str, String)> = Vec::new();
    if let Some(threads) = override_env.intra_op_threads {
        pairs.push(("MINI_BACKEND_INTRA_OP_THREADS", threads.to_string()));
        pairs.push(("OMP_NUM_THREADS", threads.to_string()));
    }
    if let Some(threads) = override_env.inter_op_threads {
        pairs.push(("MINI_BACKEND_INTER_OP_THREADS", threads.to_string()));
    }
    if let Some(seconds) = override_env.engine_idle_timeout_seconds {
        pairs.push(("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", seconds.to_string()));
    }
    if let Some(megapixels) = override_env.working_resolution_megapixels {
        pairs.push((
            "MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS",
            megapixels.to_string(),
        ));
    }
    if let Some(clean) = override_env.working_resolution_ocr_clean {
        pairs.push((
            "MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN",
            if clean { "1" } else { "0" }.to_string(),
        ));
    }
    pairs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_mini_backend_applies_thread_override_env() {
        let source = include_str!("mod.rs");
        let start_index = source
            .find("pub async fn start_mini_backend")
            .expect("start_mini_backend must exist");
        let body = &source[start_index..];
        let implementation_end = body.find("#[cfg(test)]").unwrap_or(body.len());
        let implementation = &body[..implementation_end];
        assert!(
            implementation.contains("mini_backend_thread_env_pairs(&thread_override)"),
            "start_mini_backend must map the thread override into spawn env pairs"
        );
        assert!(
            implementation.contains("command = command.env(key, value)"),
            "the override pairs must be applied onto the spawned command"
        );
    }

    #[test]
    fn thread_override_parses_camel_case_and_tolerates_missing_file() {
        let temp = tempfile::tempdir().expect("tempdir");
        let data_dir = temp.path();

        // Missing file: defaults.
        assert_eq!(
            read_mini_backend_thread_override_at(data_dir),
            MiniBackendThreadOverride::default()
        );

        fs::write(
            data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE),
            r#"{"intraOpThreads":4,"interOpThreads":2}"#,
        )
        .expect("write override");
        assert_eq!(
            read_mini_backend_thread_override_at(data_dir),
            MiniBackendThreadOverride {
                intra_op_threads: Some(4),
                inter_op_threads: Some(2),
                engine_idle_timeout_seconds: None,
                working_resolution_megapixels: None,
                working_resolution_ocr_clean: None,
            }
        );

        fs::write(
            data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE),
            r#"{"intraOpThreads":6}"#,
        )
        .expect("write legacy override");
        assert_eq!(
            read_mini_backend_thread_override_at(data_dir),
            MiniBackendThreadOverride {
                intra_op_threads: Some(6),
                inter_op_threads: None,
                engine_idle_timeout_seconds: None,
                working_resolution_megapixels: None,
                working_resolution_ocr_clean: None,
            }
        );
    }

    #[test]
    fn thread_override_defaults_on_malformed_file_and_clamps_values() {
        let temp = tempfile::tempdir().expect("tempdir");
        let data_dir = temp.path();

        fs::write(
            data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE),
            "not-json",
        )
        .expect("write garbage");
        assert_eq!(
            read_mini_backend_thread_override_at(data_dir),
            MiniBackendThreadOverride::default()
        );

        fs::write(
            data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE),
            r#"{"intraOpThreads":"four","engineIdleTimeoutSeconds":120}"#,
        )
        .expect("write override with a bad field");
        assert_eq!(
            read_mini_backend_thread_override_at(data_dir),
            MiniBackendThreadOverride {
                intra_op_threads: None,
                inter_op_threads: None,
                engine_idle_timeout_seconds: Some(120),
                working_resolution_megapixels: None,
                working_resolution_ocr_clean: None,
            }
        );

        fs::write(
            data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE),
            r#"{"intraOpThreads":500,"interOpThreads":0}"#,
        )
        .expect("write override");
        assert_eq!(
            read_mini_backend_thread_override_at(data_dir),
            MiniBackendThreadOverride {
                intra_op_threads: Some(64),
                inter_op_threads: None,
                engine_idle_timeout_seconds: None,
                working_resolution_megapixels: None,
                working_resolution_ocr_clean: None,
            }
        );
    }

    #[test]
    fn thread_override_clamps_runtime_tunables() {
        let temp = tempfile::tempdir().expect("tempdir");
        let data_dir = temp.path();

        fs::write(
            data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE),
            r#"{"intraOpThreads":4,"engineIdleTimeoutSeconds":999999,
                "workingResolutionMegapixels":100,"workingResolutionOcrClean":true}"#,
        )
        .expect("write override");
        assert_eq!(
            read_mini_backend_thread_override_at(data_dir),
            MiniBackendThreadOverride {
                intra_op_threads: Some(4),
                inter_op_threads: None,
                engine_idle_timeout_seconds: Some(86_400),
                working_resolution_megapixels: Some(64.0),
                working_resolution_ocr_clean: Some(true),
            }
        );
    }

    #[test]
    fn thread_env_pairs_mirror_intra_into_omp() {
        assert!(mini_backend_thread_env_pairs(&MiniBackendThreadOverride::default()).is_empty());
        let pairs = mini_backend_thread_env_pairs(&MiniBackendThreadOverride {
            intra_op_threads: Some(4),
            inter_op_threads: Some(2),
            engine_idle_timeout_seconds: None,
            working_resolution_megapixels: None,
            working_resolution_ocr_clean: None,
        });
        assert_eq!(
            pairs,
            vec![
                ("MINI_BACKEND_INTRA_OP_THREADS", "4".to_string()),
                ("OMP_NUM_THREADS", "4".to_string()),
                ("MINI_BACKEND_INTER_OP_THREADS", "2".to_string()),
            ]
        );
    }

    #[test]
    fn thread_env_pairs_emit_runtime_tunables() {
        let pairs = mini_backend_thread_env_pairs(&MiniBackendThreadOverride {
            intra_op_threads: None,
            inter_op_threads: None,
            engine_idle_timeout_seconds: Some(600),
            working_resolution_megapixels: Some(24.0),
            working_resolution_ocr_clean: Some(false),
        });
        assert_eq!(
            pairs,
            vec![
                ("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "600".to_string()),
                ("MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS", "24".to_string()),
                ("MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN", "0".to_string()),
            ]
        );
        let pairs = mini_backend_thread_env_pairs(&MiniBackendThreadOverride {
            intra_op_threads: None,
            inter_op_threads: None,
            engine_idle_timeout_seconds: Some(0),
            working_resolution_megapixels: Some(48.5),
            working_resolution_ocr_clean: Some(true),
        });
        assert_eq!(
            pairs,
            vec![
                ("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "0".to_string()),
                ("MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS", "48.5".to_string()),
                ("MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN", "1".to_string()),
            ]
        );
    }
}
