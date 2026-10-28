//! Configuration sources: update channel, discovery locations and the
//! precedence chain over process, runtime-config and `.env` documents.

use std::{
    collections::HashMap,
    env, fs, io,
    io::Read,
    path::{Path, PathBuf},
};

use tauri::{AppHandle, Manager, Runtime};

use super::env_document::parse_env_document;
use super::paths::{ancestor_dirs, dedupe_paths};
use super::{
    CURRENT_DIR_ANCESTOR_DEPTH, EXE_DIR_ANCESTOR_DEPTH, LEGACY_RUNTIME_CONFIG_DIR,
    MAX_CONFIG_FILE_BYTES, PUBLIC_DESKTOP_CONFIG_KEYS, RESOURCE_DIR_ANCESTOR_DEPTH,
    RUNTIME_CONFIG_FILE,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum UpdateChannel {
    Stable,
    Beta,
}

impl UpdateChannel {
    pub(super) fn from_version(version: &str) -> Self {
        if version.contains('-') {
            Self::Beta
        } else {
            Self::Stable
        }
    }

    pub(super) fn from_segment(segment: &str) -> Option<Self> {
        if segment.eq_ignore_ascii_case("beta") {
            Some(Self::Beta)
        } else if segment.eq_ignore_ascii_case("stable") {
            Some(Self::Stable)
        } else {
            None
        }
    }

    pub(super) const fn as_str(self) -> &'static str {
        match self {
            Self::Stable => "stable",
            Self::Beta => "beta",
        }
    }
}

/// Channel reported by desktop diagnostics; runtime artifacts keep using the
/// build-derived channel.
pub(crate) const DESKTOP_UPDATE_CHANNEL: &str = UpdateChannel::Stable.as_str();

/// Filesystem anchors used to discover configuration files.
#[derive(Debug, Clone, Default)]
pub(super) struct ConfigLocations {
    pub(super) current_dir: Option<PathBuf>,
    pub(super) exe_dir: Option<PathBuf>,
    pub(super) resource_dir: Option<PathBuf>,
}

impl ConfigLocations {
    pub(super) fn from_app<R: Runtime>(app: &AppHandle<R>) -> Self {
        Self {
            current_dir: env::current_dir().ok(),
            exe_dir: env::current_exe()
                .ok()
                .and_then(|exe| exe.parent().map(Path::to_path_buf)),
            resource_dir: app.path().resource_dir().ok(),
        }
    }

    pub(super) fn runtime_config_candidates(&self) -> Vec<PathBuf> {
        // Packaged builds only ever read the bundled runtime config; walking
        // ancestor directories of the executable would let a stray file in a
        // user-writable folder override configuration.
        if !cfg!(debug_assertions) {
            return self
                .resource_dir
                .iter()
                .map(|root| root.join(RUNTIME_CONFIG_FILE))
                .collect();
        }

        let roots = self
            .current_dir
            .iter()
            .chain(self.resource_dir.iter());

        dedupe_paths(roots.flat_map(|root| {
            [
                root.join(RUNTIME_CONFIG_FILE),
                root.join(LEGACY_RUNTIME_CONFIG_DIR)
                    .join(RUNTIME_CONFIG_FILE),
            ]
        }))
    }

    fn env_file_candidates(&self, env_file_name: &str) -> Vec<PathBuf> {
        let roots = dedupe_paths(
            self.current_dir
                .iter()
                .flat_map(|dir| ancestor_dirs(dir, CURRENT_DIR_ANCESTOR_DEPTH))
                .chain(
                    self.exe_dir
                        .iter()
                        .flat_map(|dir| ancestor_dirs(dir, EXE_DIR_ANCESTOR_DEPTH)),
                )
                .chain(
                    self.resource_dir
                        .iter()
                        .flat_map(|dir| ancestor_dirs(dir, RESOURCE_DIR_ANCESTOR_DEPTH)),
                ),
        );

        let local_env_file_name = format!("{env_file_name}.local");
        let file_names = [
            local_env_file_name.as_str(),
            ".env.local",
            env_file_name,
            ".env",
        ];

        let mut candidates = Vec::with_capacity(roots.len() * file_names.len() * 2);
        for root in &roots {
            for dir in [root.clone(), root.join("auth-server")] {
                candidates.extend(file_names.iter().map(|name| dir.join(name)));
            }
        }
        candidates
    }
}

/// Pre-parsed configuration documents in precedence order. Only public keys
/// survive parsing, so nothing else can ever be resolved from this structure.
pub(super) struct ConfigSources {
    pub(super) process_values: HashMap<String, String>,
    pub(super) runtime_config_documents: Vec<serde_json::Map<String, serde_json::Value>>,
    pub(super) env_documents: Vec<HashMap<String, String>>,
    pub(super) channel: UpdateChannel,
}

impl ConfigSources {
    pub(super) fn load<R: Runtime>(locations: &ConfigLocations, app: &AppHandle<R>) -> Self {
        let process_values = PUBLIC_DESKTOP_CONFIG_KEYS
            .iter()
            .filter_map(|key| {
                non_empty_env_var(key).map(|value| ((*key).to_owned(), value))
            })
            .collect();

        let runtime_config_documents =
            load_runtime_config_documents(&locations.runtime_config_candidates());

        // Packaged builds must never pick up stray `.env` files from the
        // user's filesystem: configuration comes exclusively from the process
        // environment and the bundled `runtime-config.json`.
        let env_documents = if cfg!(debug_assertions) {
            load_env_documents(&locations.env_file_candidates(desktop_env_file_name()))
        } else {
            Vec::new()
        };

        Self {
            process_values,
            runtime_config_documents,
            env_documents,
            channel: UpdateChannel::from_version(
                &app.package_info().version.to_string(),
            ),
        }
    }

    pub(super) fn resolve(&self, key: &str) -> Option<String> {
        if !is_public_desktop_config_key(key) {
            return None;
        }

        self.resolve_any(key)
    }

    /// Same precedence as [`Self::resolve`] but without the public-keys
    /// allowlist: for desktop-internal consumers only (bug report webhook,
    /// imgur client id). Values resolved here must never cross to the
    /// webview.
    pub(super) fn resolve_any(&self, key: &str) -> Option<String> {
        self.process_values
            .get(key)
            .cloned()
            .or_else(|| self.resolve_from_runtime_config(key))
            .or_else(|| self.resolve_from_env_files(key))
    }

    fn resolve_from_runtime_config(&self, key: &str) -> Option<String> {
        self.runtime_config_documents
            .iter()
            .filter_map(|document| document.get(key)?.as_str())
            .map(str::trim)
            .find(|value| !value.is_empty())
            .map(str::to_owned)
    }

    fn resolve_from_env_files(&self, key: &str) -> Option<String> {
        self.env_documents
            .iter()
            .find_map(|document| document.get(key))
            .cloned()
    }
}

pub(super) fn is_public_desktop_config_key(key: &str) -> bool {
    PUBLIC_DESKTOP_CONFIG_KEYS.contains(&key)
}

/// Reads a configuration document with a hard size cap; oversized or
/// non-UTF-8 sources are rejected instead of silently truncated.
pub(super) fn read_config_document(path: &Path) -> io::Result<Option<String>> {
    let file = match fs::File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            return Ok(None);
        }
        Err(error) => return Err(error),
    };

    if !file.metadata()?.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "configuration source is not a regular file",
        ));
    }

    let mut bytes = Vec::new();
    file.take(MAX_CONFIG_FILE_BYTES + 1)
        .read_to_end(&mut bytes)?;

    if bytes.len() as u64 > MAX_CONFIG_FILE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "configuration document exceeds the size limit",
        ));
    }

    String::from_utf8(bytes)
        .map(Some)
        .map_err(|_| {
            io::Error::new(
                io::ErrorKind::InvalidData,
                "configuration document is not valid UTF-8",
            )
        })
}

pub(super) fn load_runtime_config_documents(
    candidates: &[PathBuf],
) -> Vec<serde_json::Map<String, serde_json::Value>> {
    candidates
        .iter()
        .filter_map(|path| {
            let raw = match read_config_document(path) {
                Ok(Some(raw)) => raw,
                Ok(None) => return None,
                Err(error) => {
                    tracing::warn!(
                        target: "desktop_config",
                        operation = "read_runtime_config",
                        error_kind = ?error.kind(),
                        "configuration source rejected"
                    );
                    return None;
                }
            };

            match serde_json::from_str::<
                serde_json::Map<String, serde_json::Value>,
            >(&raw)
            {
                Ok(mut document) => {
                    document.retain(|key, value| {
                        is_public_desktop_config_key(key) && value.is_string()
                    });

                    Some(document)
                }
                Err(error) => {
                    tracing::warn!(
                        target: "desktop_config",
                        operation = "parse_runtime_config",
                        line = error.line(),
                        column = error.column(),
                        "configuration source rejected"
                    );
                    None
                }
            }
        })
        .collect()
}

pub(super) fn load_env_documents(candidates: &[PathBuf]) -> Vec<HashMap<String, String>> {
    candidates
        .iter()
        .filter_map(|path| match read_config_document(path) {
            Ok(Some(raw)) => Some(parse_env_document(&raw)),
            Ok(None) => None,
            Err(error) => {
                tracing::warn!(
                    target: "desktop_config",
                    operation = "read_env_config",
                    error_kind = ?error.kind(),
                    "configuration source rejected"
                );
                None
            }
        })
        .collect()
}

fn desktop_env_file_name() -> &'static str {
    match env::var("NODE_ENV")
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "production" => ".env.production",
        "development" => ".env.development",
        _ if cfg!(debug_assertions) => ".env.development",
        _ => ".env.production",
    }
}

fn non_empty_env_var(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty())
}
