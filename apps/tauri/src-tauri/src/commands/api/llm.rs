//! LLM profile commands. The frontend contract sends `apiKey` inline inside
//! the profile object; the command forwards it to the keychain-backed service
//! and echoes an empty `apiKey` back, with `hasApiKey` added additively.

use serde_json::{json, Value};
use tauri::{AppHandle, State};
use zeroize::Zeroizing;

use crate::{
    error::{AppError, AppResult},
    models::llm::{LlmProfile, LlmProfileId, LlmStage, LlmUserId},
    services::llm::{self, LlmProfileInput},
    state::api::ApiRuntimeState,
};

#[tauri::command(rename = "desktop-api:llm-profiles:list")]
pub async fn llm_profiles_list(
    app: AppHandle,
    state: State<'_, ApiRuntimeState>,
    payload: Value,
) -> AppResult<Value> {
    let _permit = state.llm_permit().await?;
    let user_id = resolve_user_id(&payload);
    let result = llm::list(&app, user_id).await?;
    Ok(json!({
        "profiles": profiles_to_json(&result.profiles),
        "secureStorage": result.secure_storage,
    }))
}

#[tauri::command(rename = "desktop-api:llm-profiles:save")]
pub async fn llm_profiles_save(
    app: AppHandle,
    state: State<'_, ApiRuntimeState>,
    payload: Value,
) -> AppResult<Value> {
    let _permit = state.llm_permit().await?;
    let user_id = resolve_user_id(payload.get("userId").unwrap_or(&Value::Null));
    let profile_value = payload
        .get("profile")
        .cloned()
        .ok_or_else(|| AppError::invalid_input("Invalid custom LLM profile."))?;

    let input = profile_from_wire(&profile_value)?;
    let (profiles, profile) = llm::save(&app, user_id, &input).await?;

    Ok(json!({
        "profiles": profiles_to_json(&profiles),
        "profile": profile_to_json(&profile),
        "secureStorage": true,
    }))
}

#[tauri::command(rename = "desktop-api:llm-profiles:remove")]
pub async fn llm_profiles_remove(
    app: AppHandle,
    state: State<'_, ApiRuntimeState>,
    payload: Value,
) -> AppResult<Value> {
    let _permit = state.llm_permit().await?;
    let user_id = resolve_user_id(&payload);
    let profile_id = payload
        .get("profileId")
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| AppError::invalid_input("Perfil custom ausente."))?;

    let result = llm::remove(&app, user_id, &LlmProfileId(profile_id.to_string())).await?;
    Ok(json!({
        "profiles": profiles_to_json(&result.profiles),
        "secureStorage": result.secure_storage,
    }))
}

// --- wire adapters -----------------------------------------------------------

fn resolve_user_id(payload: &Value) -> Option<LlmUserId> {
    let value = payload
        .get("userId")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .chars()
        .take(256)
        .collect::<String>();

    if value.is_empty() {
        None
    } else {
        Some(LlmUserId(value))
    }
}

fn profile_from_wire(value: &Value) -> AppResult<LlmProfileInput> {
    let object = value
        .as_object()
        .ok_or_else(|| AppError::invalid_input("Invalid custom LLM profile."))?;

    let stage = match object.get("stage").and_then(Value::as_str) {
        Some("translation") => LlmStage::Translation,
        Some("ocr") => LlmStage::Ocr,
        Some("clean") => LlmStage::Clean,
        _ => return Err(AppError::invalid_input("Invalid LLM stage.")),
    };

    let id = object
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let label = object
        .get("label")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    let model = object
        .get("model")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if id.is_empty() || label.is_empty() || model.is_empty() {
        return Err(AppError::invalid_input("Invalid custom LLM profile."));
    }

    let api_key = object
        .get("apiKey")
        .and_then(Value::as_str)
        .map(|value| Zeroizing::new(value.trim().to_string()));

    Ok(LlmProfileInput {
        id: LlmProfileId(id),
        stage,
        label,
        api_base: object
            .get("apiBase")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .trim()
            .to_string(),
        api_key,
        clear_api_key: object
            .get("clearApiKey")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        model,
    })
}

fn profiles_to_json(profiles: &[LlmProfile]) -> Vec<Value> {
    profiles.iter().map(profile_to_json).collect()
}

fn profile_to_json(profile: &LlmProfile) -> Value {
    json!({
        "id": profile.id.0,
        "stage": profile.stage,
        "label": profile.label,
        "apiBase": profile.api_base,
        "apiKey": profile.api_key,
        "model": profile.model,
        "hasApiKey": profile.has_api_key,
        "createdAt": profile.created_at,
        "updatedAt": profile.updated_at,
    })
}
