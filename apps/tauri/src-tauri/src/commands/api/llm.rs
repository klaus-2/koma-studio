use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};

use super::client::{
    now_iso, read_plain_envelope, secure_store_dir, stable_hash, string_field, value_object,
    write_plain_envelope,
};

const GUEST_SCOPE: &str = "__guest__";
const SHARED_SCOPE: &str = "__shared__";

#[tauri::command(rename = "desktop-api:llm-profiles:list")]
pub fn llm_profiles_list<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let user_id = resolve_user_id(payload.get("userId").unwrap_or(&Value::Null));
    let mut profiles = read_profiles(&app, &user_id)?;
    sort_profiles(&mut profiles);
    Ok(json!({ "profiles": profiles, "secureStorage": false }))
}

#[tauri::command(rename = "desktop-api:llm-profiles:save")]
pub fn llm_profiles_save<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let user_id = resolve_user_id(payload.get("userId").unwrap_or(&Value::Null));
    let profile = sanitize_profile(payload.get("profile").cloned().unwrap_or(Value::Null))
        .ok_or_else(|| "Invalid custom LLM profile.".to_string())?;
    let current = read_profiles(&app, &user_id)?;
    let previous = current
        .iter()
        .find(|item| item.get("id") == profile.get("id"));
    let now = now_iso();
    let mut next_profile = value_object(profile);
    if previous.is_none() {
        next_profile
            .entry("createdAt".to_string())
            .or_insert(json!(now));
    } else if let Some(created_at) = previous.and_then(|item| item.get("createdAt")).cloned() {
        next_profile.insert("createdAt".to_string(), created_at);
    }
    next_profile.insert("updatedAt".to_string(), json!(now));

    let profile_value = Value::Object(next_profile);
    let mut next_profiles: Vec<Value> = current
        .into_iter()
        .filter(|item| item.get("id") != profile_value.get("id"))
        .collect();
    next_profiles.push(profile_value.clone());
    sort_profiles(&mut next_profiles);
    write_profiles(&app, &user_id, &next_profiles)?;
    Ok(json!({
        "profiles": next_profiles,
        "profile": profile_value,
        "secureStorage": false,
    }))
}

#[tauri::command(rename = "desktop-api:llm-profiles:remove")]
pub fn llm_profiles_remove<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let user_id = resolve_user_id(payload.get("userId").unwrap_or(&Value::Null));
    let profile_id = string_field(&payload, "profileId");
    if profile_id.is_empty() {
        return Err("Perfil custom ausente.".to_string());
    }
    let mut profiles: Vec<Value> = read_profiles(&app, &user_id)?
        .into_iter()
        .filter(|item| item.get("id").and_then(Value::as_str) != Some(profile_id.as_str()))
        .collect();
    sort_profiles(&mut profiles);
    write_profiles(&app, &user_id, &profiles)?;
    Ok(json!({ "profiles": profiles, "secureStorage": false }))
}

fn sanitize_profile(value: Value) -> Option<Value> {
    let object = value.as_object()?;
    let stage = object.get("stage").and_then(Value::as_str)?.trim();
    if !matches!(stage, "translation" | "ocr" | "clean") {
        return None;
    }
    let id = sanitize_text(object.get("id"), 128);
    let label = sanitize_text(object.get("label"), 128);
    let api_base = sanitize_url(object.get("apiBase"))?;
    let api_key = sanitize_text(object.get("apiKey"), 1024);
    let model = sanitize_text(object.get("model"), 256);
    if id.is_empty() || label.is_empty() || model.is_empty() {
        return None;
    }

    Some(json!({
        "id": id,
        "stage": stage,
        "label": label,
        "apiBase": api_base,
        "apiKey": api_key,
        "model": model,
        "createdAt": sanitize_text(object.get("createdAt"), 64),
        "updatedAt": sanitize_text(object.get("updatedAt"), 64),
    }))
}

fn read_profiles<R: Runtime>(app: &AppHandle<R>, user_id: &str) -> Result<Vec<Value>, String> {
    let scoped = read_profiles_from_path(&profiles_path(app, user_id)?);
    let shared = if user_id == SHARED_SCOPE {
        Vec::new()
    } else {
        read_profiles_from_path(&profiles_path(app, SHARED_SCOPE)?)
    };
    let guest = if user_id == GUEST_SCOPE {
        Vec::new()
    } else {
        read_profiles_from_path(&profiles_path(app, GUEST_SCOPE)?)
    };
    Ok(merge_profiles([scoped, shared, guest].concat()))
}

fn write_profiles<R: Runtime>(
    app: &AppHandle<R>,
    user_id: &str,
    profiles: &[Value],
) -> Result<(), String> {
    let path = profiles_path(app, user_id)?;
    write_plain_envelope(&path, &Value::Array(profiles.to_vec()))?;
    Ok(())
}

fn read_profiles_from_path(path: &std::path::PathBuf) -> Vec<Value> {
    match read_plain_envelope(path, json!([])) {
        Value::Array(items) => items.into_iter().filter_map(sanitize_profile).collect(),
        _ => Vec::new(),
    }
}

fn profiles_path<R: Runtime>(
    app: &AppHandle<R>,
    user_id: &str,
) -> Result<std::path::PathBuf, String> {
    let file_name = if user_id == GUEST_SCOPE {
        "llm-profiles.json".to_string()
    } else {
        format!(
            "llm-profiles.{}.json",
            stable_hash("llm-profile-user", user_id)
        )
    };
    Ok(secure_store_dir(app)?.join(file_name))
}

fn merge_profiles(items: Vec<Value>) -> Vec<Value> {
    let mut by_id = std::collections::BTreeMap::<String, Value>::new();
    for item in items {
        let id = item
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        if id.is_empty() {
            continue;
        }
        let replace = by_id
            .get(&id)
            .map(|current| timestamp(item.get("updatedAt")) >= timestamp(current.get("updatedAt")))
            .unwrap_or(true);
        if replace {
            by_id.insert(id, item);
        }
    }
    let mut merged: Vec<Value> = by_id.into_values().collect();
    sort_profiles(&mut merged);
    merged
}

fn sort_profiles(items: &mut [Value]) {
    items.sort_by(|left, right| {
        label(left)
            .to_ascii_lowercase()
            .cmp(&label(right).to_ascii_lowercase())
    });
}

fn label(value: &Value) -> String {
    value
        .get("label")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn timestamp(value: Option<&Value>) -> i64 {
    value
        .and_then(Value::as_str)
        .and_then(|text| chrono::DateTime::parse_from_rfc3339(text).ok())
        .map(|date| date.timestamp_millis())
        .unwrap_or(0)
}

fn resolve_user_id(value: &Value) -> String {
    sanitize_text(Some(value), 256)
        .trim()
        .to_string()
        .chars()
        .take(256)
        .collect::<String>()
        .if_empty(GUEST_SCOPE)
}

fn sanitize_text(value: Option<&Value>, max_len: usize) -> String {
    value
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .chars()
        .take(max_len)
        .collect()
}

fn sanitize_url(value: Option<&Value>) -> Option<String> {
    let text = sanitize_text(value, 512).replace(char::is_whitespace, "");
    let parsed = url::Url::parse(&text).ok()?;
    matches!(parsed.scheme(), "http" | "https").then_some(text)
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
