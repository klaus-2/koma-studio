use tauri::{AppHandle, Runtime};

use crate::error::AppResult;
use crate::services::batch_state::{
    self, BatchStateAccepted, BatchStatePayload, WindowDirtyPayload,
};

#[tauri::command(rename = "desktop:batch:set-state")]
pub(crate) async fn set_state<R: Runtime>(
    app: AppHandle<R>,
    payload: BatchStatePayload,
) -> AppResult<BatchStateAccepted> {
    batch_state::apply_batch_state(&app, payload);
    Ok(BatchStateAccepted { accepted: true })
}

#[tauri::command(rename = "desktop:window:set-dirty")]
pub(crate) fn set_dirty<R: Runtime>(
    app: AppHandle<R>,
    payload: WindowDirtyPayload,
) -> AppResult<()> {
    batch_state::set_dirty(&app, payload.dirty);
    Ok(())
}

#[tauri::command(rename = "desktop:window:close-force")]
pub(crate) fn close_force<R: Runtime>(app: AppHandle<R>) -> AppResult<()> {
    batch_state::request_force_close(&app);
    Ok(())
}
