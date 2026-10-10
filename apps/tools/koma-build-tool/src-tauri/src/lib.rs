mod commands;

#[cfg(test)]
mod commands_test;

use commands::{AppState, BuildConfig};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let config = BuildConfig::default_from_env();
    let state = AppState {
        current_child: Mutex::new(None),
        config,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::list_profiles,
            commands::build_msi,
            commands::build_update,
            commands::build_artifacts,
            commands::deploy_artifacts,
            commands::deploy_landing,
            commands::get_vps_status,
            commands::cancel_task,
        ])
        .run(tauri::generate_context!())
        .expect("error while running koma-build-tool");
}
