use serde::Serialize;
use tauri::{AppHandle, Runtime, State};

use crate::commands::desktop::updater;
pub use crate::commands::desktop::updater::InstallerUpdaterStore;

#[derive(Debug, thiserror::Error)]
pub enum UpdaterCommandError {
    #[error("{0}")]
    Updater(String),
    #[error("Invalid update channel.")]
    InvalidChannel,
    #[error("Installer updates are not available in this environment.")]
    Unsupported,
}

impl Serialize for UpdaterCommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[tauri::command(rename = "desktop:updater:get-state")]
pub fn get_updater_state<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, InstallerUpdaterStore>,
) -> Option<updater::UpdaterState> {
    updater::get_state_snapshot(&app, &store)
}

#[tauri::command(async, rename = "desktop:updater:download")]
pub async fn download_updater<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, InstallerUpdaterStore>,
    channel: String,
) -> Result<(), UpdaterCommandError> {
    if !updater::is_supported_runtime(cfg!(dev), cfg!(windows)) {
        return Err(UpdaterCommandError::Unsupported);
    }
    let channel =
        updater::parse_channel(&channel).map_err(|_| UpdaterCommandError::InvalidChannel)?;
    updater::run_download(&app, &store, channel)
        .await
        .map_err(UpdaterCommandError::Updater)
}

#[tauri::command(rename = "desktop:updater:install")]
pub fn install_updater<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, InstallerUpdaterStore>,
) -> Result<(), UpdaterCommandError> {
    if !updater::is_supported_runtime(cfg!(dev), cfg!(windows)) {
        return Err(UpdaterCommandError::Unsupported);
    }
    updater::run_install(&app, &store).map_err(UpdaterCommandError::Updater)
}
