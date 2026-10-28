//! Process-wide resolved desktop configuration, cached in managed state.

use std::{
    collections::HashSet,
    sync::{Arc, OnceLock},
};

use tauri::{AppHandle, Manager, Runtime};

use super::config_sources::{ConfigLocations, ConfigSources};
use super::runtime_artifacts_url::resolve_runtime_artifacts_url;
use super::url_validation::{insert_url_host, normalize_loopback_url};
use super::{
    DEFAULT_AUTH_API_URL, DEFAULT_LOCAL_API_URL, PROJECT_LINK_ENV_KEYS, RuntimeConfig,
};

type SharedDesktopConfig = Arc<ResolvedDesktopConfig>;
type DesktopConfigCell = Arc<OnceLock<SharedDesktopConfig>>;

/// Fully resolved, immutable desktop configuration. Intentionally does not
/// derive `Debug`: `sources` may hold developer `.env` contents.
pub(crate) struct ResolvedDesktopConfig {
    pub(super) runtime: RuntimeConfig,
    pub(super) allowed_external_hosts: HashSet<String>,
    pub(super) sources: ConfigSources,
}

impl ResolvedDesktopConfig {
    pub(super) fn from_sources(sources: ConfigSources) -> Self {
        let auth_api_url = sources
            .resolve("VITE_AUTH_API_URL")
            .unwrap_or_else(|| DEFAULT_AUTH_API_URL.to_owned());
        let local_api_url = normalize_loopback_url(
            &sources
                .resolve("VITE_LOCAL_API_URL")
                .unwrap_or_else(|| DEFAULT_LOCAL_API_URL.to_owned()),
        );
        let runtime_artifacts_url = resolve_runtime_artifacts_url(&sources);

        let mut allowed_external_hosts = HashSet::new();
        for raw_url in [&auth_api_url, &local_api_url, &runtime_artifacts_url] {
            insert_url_host(&mut allowed_external_hosts, raw_url);
        }
        for key in PROJECT_LINK_ENV_KEYS {
            if let Some(raw_url) = sources.resolve(key) {
                insert_url_host(&mut allowed_external_hosts, &raw_url);
            }
        }

        tracing::info!(
            operation = "resolve_desktop_config",
            channel = sources.channel.as_str(),
            allowed_hosts = allowed_external_hosts.len(),
            "desktop runtime configuration resolved"
        );

        Self {
            runtime: RuntimeConfig {
                auth_api_url,
                local_api_url,
                runtime_artifacts_url,
                app_packaged: !cfg!(debug_assertions),
            },
            allowed_external_hosts,
            sources,
        }
    }
}

fn desktop_config_cell<R: Runtime>(app: &AppHandle<R>) -> DesktopConfigCell {
    if let Some(state) = app.try_state::<DesktopConfigCell>() {
        return Arc::clone(state.inner());
    }

    app.manage(DesktopConfigCell::default());

    Arc::clone(app.state::<DesktopConfigCell>().inner())
}

pub(super) fn resolved_desktop_config<R: Runtime>(app: &AppHandle<R>) -> SharedDesktopConfig {
    let cell = desktop_config_cell(app);

    Arc::clone(cell.get_or_init(|| {
        Arc::new(ResolvedDesktopConfig::from_sources(
            ConfigSources::load(&ConfigLocations::from_app(app), app),
        ))
    }))
}
