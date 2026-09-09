use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};
use url::Url;

const APP_PROTOCOL: &str = "komastudio";

#[tauri::command(rename = "desktop-api:integrations:deep-link:extract")]
pub fn extract_deep_link(payload: Value) -> Option<String> {
    let args = payload
        .get("argv")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    extract_deep_link_from_args(
        args.iter()
            .filter_map(Value::as_str)
            .map(ToString::to_string),
    )
}

#[tauri::command(rename = "desktop-api:integrations:deep-link:route")]
pub fn deep_link_route(payload: Value) -> Option<String> {
    let url = payload
        .get("url")
        .and_then(Value::as_str)
        .unwrap_or_default();
    deep_link_to_hash_route(url)
}

#[tauri::command(rename = "desktop-api:integrations:deep-link:format")]
pub fn format_deep_link(payload: Value) -> String {
    let url = payload
        .get("url")
        .and_then(Value::as_str)
        .unwrap_or_default();
    format_deep_link_for_log(url)
}

#[tauri::command(rename = "desktop-api:integrations:deep-link:navigate")]
pub fn navigate_deep_link<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let url = payload
        .get("url")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let Some(hash_route) = deep_link_to_hash_route(url) else {
        return Ok(json!({ "navigated": false, "route": Value::Null }));
    };
    let Some(window) = app.webview_windows().values().next().cloned() else {
        return Ok(json!({ "navigated": false, "route": hash_route }));
    };
    let current = window.url().map_err(|error| error.to_string())?;
    let mut next = current;
    next.set_fragment(Some(&hash_route));
    window
        .navigate(next)
        .map_err(|error| format!("Failed to follow deep link: {error}"))?;
    Ok(json!({ "navigated": true, "route": hash_route }))
}

pub fn extract_deep_link_from_args<I>(args: I) -> Option<String>
where
    I: IntoIterator<Item = String>,
{
    for raw in args {
        let normalized = normalize_deep_link_arg(&raw);
        if normalized.is_some() {
            return normalized;
        }
    }
    None
}

pub fn deep_link_to_hash_route(url_value: &str) -> Option<String> {
    let parsed = Url::parse(url_value).ok()?;
    let route = parsed
        .path()
        .trim_start_matches('/')
        .trim()
        .to_string()
        .if_empty(parsed.host_str().unwrap_or_default());
    if route.is_empty() {
        return None;
    }
    let query = parsed.query().unwrap_or_default();
    Some(format!("/{route}{}", if query.is_empty() { "" } else { "?" }) + query)
}

pub fn format_deep_link_for_log(url_value: &str) -> String {
    Url::parse(url_value)
        .map(|parsed| {
            format!(
                "{}://{}{}",
                parsed.scheme(),
                parsed.host_str().unwrap_or_default(),
                parsed.path()
            )
        })
        .unwrap_or_else(|_| "<invalid-deep-link>".to_string())
}

fn normalize_deep_link_arg(raw: &str) -> Option<String> {
    let mut normalized_arg = raw.trim().trim_matches('"').to_string();
    for _ in 0..2 {
        if let Ok(decoded) = percent_decode(&normalized_arg) {
            normalized_arg = decoded;
        }
    }
    let lower = normalized_arg.to_ascii_lowercase();
    let scheme = format!("{APP_PROTOCOL}:");
    let index = lower.find(&scheme)?;
    let mut candidate = normalized_arg[index..].to_string();
    for _ in 0..2 {
        if let Ok(decoded) = percent_decode(&candidate) {
            candidate = decoded;
        }
    }
    if candidate
        .to_ascii_lowercase()
        .starts_with(&format!("{APP_PROTOCOL}:"))
        && !candidate
            .to_ascii_lowercase()
            .starts_with(&format!("{APP_PROTOCOL}://"))
    {
        candidate = candidate.replacen(
            &format!("{APP_PROTOCOL}:"),
            &format!("{APP_PROTOCOL}://"),
            1,
        );
    }
    Some(candidate)
}

fn percent_decode(value: &str) -> Result<String, String> {
    let mut bytes = Vec::with_capacity(value.len());
    let raw = value.as_bytes();
    let mut index = 0;
    while index < raw.len() {
        if raw[index] == b'%' && index + 2 < raw.len() {
            let hex = &value[index + 1..index + 3];
            if let Ok(byte) = u8::from_str_radix(hex, 16) {
                bytes.push(byte);
                index += 3;
                continue;
            }
        }
        bytes.push(raw[index]);
        index += 1;
    }
    String::from_utf8(bytes).map_err(|error| error.to_string())
}

trait EmptyFallback {
    fn if_empty(self, fallback: &str) -> String;
}

impl EmptyFallback for String {
    fn if_empty(self, fallback: &str) -> String {
        if self.is_empty() {
            fallback.to_string()
        } else {
            self
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_deep_link_to_hash_route() {
        assert_eq!(
            deep_link_to_hash_route("komastudio://settings?tab=account"),
            Some("/settings?tab=account".to_string())
        );
    }
}
