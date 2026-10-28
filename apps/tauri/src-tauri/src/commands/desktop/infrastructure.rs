//! Infrastructure helpers: the loopback HTTP client, the blocking-task
//! adapter, the app-data directory and the external URL opener.

use std::{path::PathBuf, sync::OnceLock};

use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_opener::OpenerExt;
use url::Url;

use super::{DesktopError, DESKTOP_CONNECT_TIMEOUT, DESKTOP_FETCH_TIMEOUT};

static LOOPBACK_HTTP_CLIENT: OnceLock<Option<reqwest::Client>> = OnceLock::new();

/// Shared client for loopback probes: no system proxy (a corporate proxy
/// must never sit between us and 127.0.0.1), no redirects, tight timeouts.
pub(super) fn loopback_http_client() -> Option<&'static reqwest::Client> {
    LOOPBACK_HTTP_CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .timeout(DESKTOP_FETCH_TIMEOUT)
                .connect_timeout(DESKTOP_CONNECT_TIMEOUT)
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .pool_max_idle_per_host(1)
                .build()
                .inspect_err(|_| {
                    tracing::error!(
                        operation = "build_loopback_http_client",
                        "failed to construct HTTP client"
                    );
                })
                .ok()
        })
        .as_ref()
}

pub(super) async fn run_blocking<T, F>(task: F) -> Result<T, DesktopError>
where
    F: FnOnce() -> Result<T, DesktopError> + Send + 'static,
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|_| {
            tracing::error!(
                operation = "desktop_background_task",
                "background task failed"
            );
            DesktopError::TaskJoin
        })?
}

pub(super) fn app_user_data_dir<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<PathBuf, DesktopError> {
    app.path().app_data_dir().map_err(|_| {
        tracing::error!(
            operation = "resolve_app_data_directory",
            "failed to resolve application data directory"
        );
        DesktopError::AppDataDir
    })
}

pub(super) fn open_url<R: Runtime>(
    app: &AppHandle<R>,
    target: &Url,
) -> Result<(), DesktopError> {
    app.opener()
        .open_url(target.as_str(), None::<&str>)
        .map_err(|_| {
            tracing::error!(
                operation = "open_external_url",
                "external URL opener failed"
            );
            DesktopError::Opener
        })
}
