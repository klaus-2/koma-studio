//! Thread-override file contract shared by both desktop shells.
//! Extracted from mini_backend.rs to respect the 1000-line audit limit.

use std::{fs, path::Path};

use serde::{Deserialize, Serialize};

/// JSON override file the renderer's thread setting lands in; both shells
/// read it at every sidecar spawn. A missing or malformed file means the
/// sidecar keeps its defaults.
pub(crate) const MINI_BACKEND_THREAD_OVERRIDE_FILE: &str =
    "mini-backend-thread-override.json";

/// Schema of ``mini-backend-thread-override.json``. camelCase keys are the
/// wire format shared with the Electron shell; ``default`` tolerates files
/// written before ``interOpThreads`` existed.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub(crate) struct MiniBackendThreadOverride {
    pub intra_op_threads: Option<u32>,
    pub inter_op_threads: Option<u32>,
}

fn clamp_thread_override(
    parsed: MiniBackendThreadOverride,
) -> MiniBackendThreadOverride {
    let clamp = |value: Option<u32>| {
        value
            .filter(|threads| *threads >= 1)
            .map(|threads| threads.min(64))
    };
    MiniBackendThreadOverride {
        intra_op_threads: clamp(parsed.intra_op_threads),
        inter_op_threads: clamp(parsed.inter_op_threads),
    }
}

pub(crate) fn read_mini_backend_thread_override_at(
    user_data_dir: &Path,
) -> MiniBackendThreadOverride {
    let path = user_data_dir.join(MINI_BACKEND_THREAD_OVERRIDE_FILE);
    match fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str::<MiniBackendThreadOverride>(&raw)
            .map(clamp_thread_override)
            .unwrap_or_default(),
        Err(_) => MiniBackendThreadOverride::default(),
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
    pairs
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn start_mini_backend_applies_thread_override_env() {
        let source = include_str!("../mini_backend.rs");
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
            r#"{"intraOpThreads":500,"interOpThreads":0}"#,
        )
        .expect("write override");
        assert_eq!(
            read_mini_backend_thread_override_at(data_dir),
            MiniBackendThreadOverride {
                intra_op_threads: Some(64),
                inter_op_threads: None,
            }
        );
    }

    #[test]
    fn thread_env_pairs_mirror_intra_into_omp() {
        assert!(mini_backend_thread_env_pairs(&MiniBackendThreadOverride::default()).is_empty());
        let pairs = mini_backend_thread_env_pairs(&MiniBackendThreadOverride {
            intra_op_threads: Some(4),
            inter_op_threads: Some(2),
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
}
