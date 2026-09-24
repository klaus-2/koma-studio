//! KŌMA Studio v2 — Tauri shell library entry.
//!
//! Decomposed by domain:
//!   - `commands::*`   → IPC commands exposed to the renderer
//!   - `sidecar::*`    → mini-backend lifecycle and IPC
//!   - `updater::*`    → incremental updater (CAS + Merkle + bsdiff + Ed25519)
//!   - `security::*`   → cert pinning, integrity validation, hardware identity
//!   - `workspace::*`  → autosave, import/export `.komaproj`

mod commands;
mod error;
mod protocol;
mod runtime;
mod security;
mod sidecar;
mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;

    // rustls 0.23: aws-lc-rs (default) and ring both enter the feature graph
    // through reqwest/rustls-platform-verifier — the auto-select panics when
    // both are present. Pin ring (the same backend reqwest's rustls-tls uses).
    let _ = rustls::crypto::ring::default_provider().install_default();

    // koma-image:// / koma-font:// — serve image/font bytes from disk with
    // scope allowlisting, Range and ETag (see protocol::media docs).
    protocol::media::register(tauri::Builder::default())
        .register_uri_scheme_protocol("app", updater::protocol::serve_chunks_protocol)
        // Must stay the first registered plugin: it exits duplicate processes
        // before any other plugin or window spawns. When the OS protocol
        // handler launched a second instance (e.g. the user clicked
        // komastudio://confirm-email?token=... in their email client), apply
        // the route here in Rust — driving the SPA hash directly via eval is
        // deterministic and observable, unlike hopping through the webview
        // event listener.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            log::info!("single-instance: focusing existing window");
            if let Some(url) =
                commands::api::integrations::extract_deep_link_from_args(argv.iter().cloned())
            {
                log::info!("single-instance: deep link {url}");
                match commands::api::integrations::deep_link_to_hash_route(&url) {
                    Some(route) => {
                        if let Some(window) = app.webview_windows().values().next() {
                            let hash = format!("#{route}");
                            match serde_json::to_string(&hash) {
                                Ok(script) => {
                                    if let Err(error) =
                                        window.eval(&format!("window.location.hash = {script}"))
                                    {
                                        log::warn!(
                                            "single-instance: failed to apply deep link: {error}"
                                        );
                                    }
                                }
                                Err(error) => {
                                    log::warn!(
                                        "single-instance: failed to escape deep link: {error}"
                                    );
                                }
                            }
                        }
                    }
                    None => {
                        log::warn!("single-instance: deep link {url} contains no route");
                    }
                }
            }
            if let Some(window) = app.webview_windows().values().next() {
                let _ = window.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(if cfg!(debug_assertions) {
                    log::LevelFilter::Debug
                } else {
                    log::LevelFilter::Info
                })
                .level_for("rustls", log::LevelFilter::Warn)
                .level_for("reqwest", log::LevelFilter::Warn)
                .level_for("hyper", log::LevelFilter::Warn)
                .level_for("hyper_util", log::LevelFilter::Warn)
                .level_for("h2", log::LevelFilter::Warn)
                .level_for("tungstenite", log::LevelFilter::Warn)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .manage(runtime::profiles::MiniBackendRuntimeStore::default())
        .manage(sidecar::mini_backend::MiniBackendSidecarStore::default())
        .manage(commands::models::ModelDownloadStore::default())
        .manage(commands::api::auth::DesktopAuthStore::default())
        .manage(commands::discord::DiscordRpcState::default())
        .manage(commands::updater::DesktopUpdaterStore::default())
        .invoke_handler(tauri::generate_handler![
            commands::desktop::get_runtime_config,
            commands::desktop::get_locale_preferences,
            commands::desktop::reset_local_settings,
            commands::desktop::restart_app,
            commands::desktop::get_mini_backend_runtime_state,
            commands::desktop::check_local_backend,
            commands::desktop::restart_local_backend,
            commands::desktop::open_external,
            commands::desktop::open_community_link,
            commands::logging::session_log,
            commands::updater::updater_check,
            commands::updater::updater_download_incremental,
            commands::updater::updater_apply,
            commands::updater::updater_rollback,
            commands::updater::updater_postpone,
            commands::updater::get_status,
            commands::updater::set_channel,
            commands::updater::set_auto_install,
            runtime::profiles::list_mini_backend_runtime_artifacts,
            runtime::profiles::install_recommended_mini_backend_runtime,
            runtime::profiles::install_mini_backend_runtime_profile,
            commands::models::list_installed,
            commands::models::get_disk_space,
            commands::models::check_updates,
            commands::models::download,
            commands::models::import_onnx,
            commands::models::cancel,
            commands::models::cancel_all,
            commands::models::uninstall,
            commands::workspace::load_autosave,
            commands::workspace::save_autosave,
            commands::workspace::clear_autosave,
            commands::workspace::export_current,
            commands::workspace::import_file,
            commands::images::desktop_api_list_folder,
            commands::images::desktop_api_allow_paths,
            commands::api::auth::config,
            commands::api::auth::session,
            commands::api::auth::refresh_session,
            commands::api::auth::login,
            commands::api::auth::register,
            commands::api::auth::set_travel_token,
            commands::api::auth::create_travel_token,
            commands::api::auth::verify_email,
            commands::api::auth::confirm_email,
            commands::api::auth::forgot_password,
            commands::api::auth::reset_password,
            commands::api::auth::sign_out,
            commands::api::imgur::imgur_load_config,
            commands::api::imgur::imgur_save_config,
            commands::api::imgur::imgur_upload_images,
            commands::api::blogger::blogger_load_config,
            commands::api::blogger::blogger_save_config,
            commands::api::blogger::blogger_test_connection,
            commands::api::blogger::blogger_upload_images,
            commands::api::blogger::blogger_publish_post,
            commands::api::llm::llm_profiles_list,
            commands::api::llm::llm_profiles_save,
            commands::api::llm::llm_profiles_remove,
            commands::api::fonts::fonts_list,
            commands::api::fonts::fonts_import,
            commands::api::fonts::fonts_install,
            commands::api::fonts::fonts_uninstall,
            commands::api::identity::hardware_id,
            commands::api::identity::machine_fingerprint,
            commands::bug_report::prepare,
            commands::bug_report::submit,
            commands::bug_report::discord_webhook_send,
            commands::api::integrations::extract_deep_link,
            commands::api::integrations::deep_link_route,
            commands::api::integrations::format_deep_link,
            commands::api::integrations::navigate_deep_link,
            commands::discord::set_enabled,
            commands::discord::set_activity,
            commands::discord::set_preset,
            commands::discord::set_cleaning,
            commands::discord::set_translating,
            commands::discord::set_typing,
            commands::discord::set_redrawing,
            commands::discord::set_dashboard,
            commands::discord::set_batch_processing,
            commands::discord::set_idle,
            commands::discord::clear_activity,
            commands::discord::is_connected,
            commands::discord::is_enabled,
            commands::discord::get_preset_assets,
            security::cert_pinning::snapshot
        ])
        .setup(|app| {
            log::info!("KŌMA Studio v2 booting");
            protocol::media::init_static_roots(app.handle())?;
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = sidecar::mini_backend::start_mini_backend(handle).await {
                    log::warn!("mini-backend startup failed: {error}");
                }
            });
            Ok(())
        })
        // Kill the python sidecar when the user closes the window or the app
        // exits through any path (Alt+F4, task manager, tray quit). Without
        // these hooks the spawned python.exe orphans and keeps port 8001 bound,
        // so the next launch sees a healthy health-check and "reuses" the dead
        // process instead of starting a fresh backend.
        .on_window_event(|window, event| {
            protocol::media::on_window_event(window, event);
            if matches!(
                event,
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
            ) {
                let _ = sidecar::mini_backend::stop_mini_backend(window.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building KŌMA Studio")
        .run(|app_handle, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                let _ = sidecar::mini_backend::stop_mini_backend(app_handle);
            }
        });
}
