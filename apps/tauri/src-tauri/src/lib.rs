mod commands;
mod error;
mod models;
mod protocol;
mod runtime;
mod security;
mod services;
mod sidecar;
mod state;
mod updater;
#[cfg(windows)]
mod win32;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    use tauri::Manager;

    let _ = rustls::crypto::ring::default_provider().install_default();

    let hotswap_handle = updater::ui_hotswap::HotswapHandle::default();
    let mut context: tauri::Context<tauri::Wry> = tauri::generate_context!();
    let embedded_assets = context.set_assets(Box::new(updater::ui_hotswap::NoopAssets));
    context.set_assets(Box::new(updater::ui_hotswap::HotswapAssets::new(
        embedded_assets,
        hotswap_handle.clone(),
    )));

    protocol::media::register(tauri::Builder::default())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
                log::info!("single-instance: focusing existing window");
                if let Some(url) =
                    commands::api::integrations::extract_deep_link_from_args(argv.iter().cloned())
                {
                    tracing::info!(
                        scheme = url.split(':').next().unwrap_or("unknown"),
                        "single-instance deep link received"
                    );
                    match commands::api::integrations::deep_link_to_hash_route(&url) {
                    Some(route) => {
                        if let Some(window) = app.webview_windows().values().next() {
                            let hash = format!("#{route}");
                            match serde_json::to_string(&hash) {
                                Ok(script) => {
                                    if let Err(error) =
                                        window.eval(format!("window.location.hash = {script}"))
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
                        tracing::warn!("single-instance deep link contained no route");
                    }
                }
            }
            if let Some(window) = app.webview_windows().values().next() {
                let _ = window.set_focus();
            }
            commands::desktop::forwarded_files::forward_launch_args(app, argv);
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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(runtime::profiles::MiniBackendRuntimeStore::default())
        .manage(sidecar::recovery::MiniBackendSidecarStore::default())
        .manage(state::ModelDownloadStore::default())
        .manage(commands::api::auth::DesktopAuthStore::default())
        .manage(commands::logging::SessionLogSink::default())
        .manage(commands::desktop_updater::InstallerUpdaterStore::default())
        .manage(hotswap_handle)
        .manage(
            commands::discord::DiscordPresence::spawn(commands::discord::resolve_client_id())
            .unwrap_or_else(|error| {
                log::warn!(
                    "failed to spawn the Discord presence worker; continuing with Discord RPC disabled: {error}"
                );
                commands::discord::DiscordPresence::disabled()
            }),
        )
        .manage(state::WorkspaceAssetStore::default())
        .manage(state::api::ApiRuntimeState::default())
        .manage(services::batch_state::BatchStateStore::<tauri::Wry>::default())
        .manage(commands::desktop::bundle::BundleSessionStore::default())
        .manage(commands::desktop::watch::WatchStore::default())
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Finished {
                commands::desktop::forwarded_files::flush_staged_paths(webview.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::desktop::get_runtime_config,
            commands::desktop::get_locale_preferences,
            commands::desktop::reset_local_settings,
            commands::desktop::restart_app,
            commands::desktop::set_mini_backend_thread_override,
            commands::desktop::get_mini_backend_runtime_state,
            commands::desktop::check_local_backend,
            commands::desktop::restart_local_backend,
            commands::desktop::get_local_api_session,
            commands::desktop::open_external,
            commands::desktop::open_community_link,
            commands::desktop::open_logs_folder,
            commands::desktop::forwarded_files::read_forwarded,
            commands::desktop_updater::get_updater_state,
            commands::desktop_updater::check_updater,
            commands::desktop_updater::download_updater,
            commands::desktop_updater::install_updater,
            commands::desktop_updater::set_updater_auto_install,
            commands::desktop_updater::ack_updater_ui_ready,
            commands::desktop_integrations::show_notification,
            commands::desktop_integrations::save_blob,
            commands::desktop_integrations::reveal_path,
            commands::desktop_integrations::write_clipboard_image,
            commands::desktop::batch::set_state,
            commands::desktop::batch::set_dirty,
            commands::desktop::batch::close_force,
            commands::desktop::bundle::begin_bundle,
            commands::desktop::bundle::append_entry,
            commands::desktop::bundle::finalize_bundle,
            commands::desktop::watch::start_watch,
            commands::desktop::watch::stop_watch,
            commands::logging::session_log,            runtime::profiles::list_mini_backend_runtime_artifacts,
            runtime::profiles::install_recommended_mini_backend_runtime,
            runtime::profiles::install_mini_backend_runtime_profile,
            runtime::profiles::cancel_mini_backend_runtime_install,
            commands::models::list_installed,
            commands::models::get_disk_space,
            commands::models::check_updates,
            commands::models::download,
            commands::models::import_onnx,
            commands::models::cancel,
            commands::models::cancel_all,
            commands::models::uninstall,
            commands::models::list_active,
            commands::workspace::load_autosave,
            commands::workspace::save_autosave,
            commands::workspace::clear_autosave,
            commands::workspace::export_current,
            commands::workspace::import_file,
            commands::workspace::list_backups,
            commands::workspace::restore_backup,
            commands::workspace::select_asset_files,
            commands::workspace::register_internal_assets,
            commands::workspace_staged::stage_asset_raw,
            commands::workspace_staged::commit_staged_autosave,
            commands::workspace_staged::commit_staged_export,
            commands::workspace_staged::load_autosave_staged,
            commands::workspace_staged::import_file_staged,
            commands::workspace_staged::read_staged_asset,
            commands::images::desktop_api_list_folder,
            commands::images::desktop_api_allow_paths,
            commands::images::desktop_api_thumbnail,
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
            commands::api::llm::llm_profiles_resolve_key,
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
            services::panic_log::install(app.handle());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(error) = sidecar::mini_backend::start_mini_backend(handle).await {
                    log::warn!("mini-backend startup failed: {error}");
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            protocol::media::on_window_event(window, event);
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if services::batch_state::handle_close_requested(window.app_handle(), api) {
                        let _ = sidecar::mini_backend::stop_mini_backend(window.app_handle());
                    }
                }
                tauri::WindowEvent::Destroyed => {
                    let _ = sidecar::mini_backend::stop_mini_backend(window.app_handle());
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building KŌMA Studio")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                    let _ = app_handle
                        .state::<commands::discord::DiscordPresence>()
                        .disable();
                    let updater_store =
                        app_handle.state::<commands::desktop_updater::InstallerUpdaterStore>();
                    commands::desktop::updater::install_on_quit_if_staged(
                        app_handle,
                        &updater_store,
                    );
                    services::batch_state::release_keep_awake(app_handle);
                    let _ = sidecar::recovery::mark_app_exiting(app_handle);
                    let _ = sidecar::mini_backend::stop_mini_backend(app_handle);
                }
                tauri::RunEvent::Ready => {
                    commands::desktop::forwarded_files::stage_first_launch_paths(
                        std::env::args().skip(1),
                    );
                }
                #[cfg(any(target_os = "macos", target_os = "ios", target_os = "android"))]
                tauri::RunEvent::Opened { urls } => {
                    commands::desktop::forwarded_files::forward_opened_urls(app_handle, &urls);
                }
                _ => {}
            }
        });
}
