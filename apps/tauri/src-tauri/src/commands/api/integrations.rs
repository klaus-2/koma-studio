//! Integration commands: deep links validated against a strict route/parameter
//! allowlist before anything is logged or navigated.

use tauri::{AppHandle, Manager};

use crate::{
    error::CommandResult,
    models::integrations::{DeepLinkArgsRequest, DeepLinkNavigationResult, DeepLinkRequest},
    services::integrations,
};

#[tauri::command(rename = "desktop-api:integrations:deep-link:extract")]
pub fn extract_deep_link(payload: DeepLinkArgsRequest) -> Option<String> {
    integrations::extract_deep_link_from_args(payload.argv)
}

#[tauri::command(rename = "desktop-api:integrations:deep-link:route")]
pub fn deep_link_route(payload: DeepLinkRequest) -> Option<String> {
    integrations::deep_link_to_hash_route(&payload.url)
}

#[tauri::command(rename = "desktop-api:integrations:deep-link:format")]
pub fn format_deep_link(payload: DeepLinkRequest) -> String {
    integrations::format_deep_link_for_log(&payload.url)
}

#[tauri::command(rename = "desktop-api:integrations:deep-link:navigate")]
pub fn navigate_deep_link(
    app: AppHandle,
    payload: DeepLinkRequest,
) -> CommandResult<DeepLinkNavigationResult> {
    let Some(route) = integrations::deep_link_to_hash_route(&payload.url) else {
        return Ok(DeepLinkNavigationResult {
            navigated: false,
            route: None,
        });
    };

    let Some(window) = app.get_webview_window("main") else {
        return Ok(DeepLinkNavigationResult {
            navigated: false,
            route: Some(route),
        });
    };

    let mut target = window.url()?;
    target.set_fragment(Some(&route));
    window.navigate(target)?;

    Ok(DeepLinkNavigationResult {
        navigated: true,
        route: Some(route),
    })
}

pub use integrations::{deep_link_to_hash_route, extract_deep_link_from_args};
