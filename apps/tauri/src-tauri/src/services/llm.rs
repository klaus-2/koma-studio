//! Per-user LLM profiles with API keys in the OS keychain. Profiles are
//! scoped (guest/shared/user) and merged with newest-wins semantics; keys are
//! addressed by (scope, profile id) pairs, never stored on disk.

use std::{
    collections::{BTreeMap, HashSet},
    net::IpAddr,
    path::PathBuf,
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use url::Url;
use zeroize::Zeroizing;

use crate::{
    error::{AppError, AppResult},
    models::llm::{
        LlmProfile, LlmProfileId, LlmProfilesResult, LlmStage, LlmUserId,
    },
    services::{
        api_client::{now_iso, read_json_file_async, secure_store_dir, stable_hash, write_json_file_async},
        secret_store,
    },
};

const GUEST_SCOPE: &str = "__guest__";
const SHARED_SCOPE: &str = "__shared__";
const MAX_PROFILES_PER_SCOPE: usize = 256;

static PROFILE_STORE_GUARD: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

#[derive(Debug, Clone)]
enum ProfileScope {
    Guest,
    Shared,
    User(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredProfiles {
    version: u8,
    profiles: Vec<LlmProfile>,
}

#[derive(Debug)]
struct ScopedProfile {
    profile: LlmProfile,
    scope: ProfileScope,
    priority: u8,
}

pub async fn list(app: &AppHandle, user_id: Option<LlmUserId>) -> AppResult<LlmProfilesResult> {
    let _guard = PROFILE_STORE_GUARD.lock().await;
    let profiles = merged_profiles(app, resolve_scope(user_id)).await?;

    Ok(LlmProfilesResult {
        profiles,
        secure_storage: true,
    })
}

#[derive(Debug)]
pub struct LlmProfileInput {
    pub id: LlmProfileId,
    pub stage: LlmStage,
    pub label: String,
    pub api_base: String,
    pub api_key: Option<Zeroizing<String>>,
    pub clear_api_key: bool,
    pub model: String,
}

pub async fn save(
    app: &AppHandle,
    user_id: Option<LlmUserId>,
    input: &LlmProfileInput,
) -> AppResult<(Vec<LlmProfile>, LlmProfile)> {
    let _guard = PROFILE_STORE_GUARD.lock().await;

    validate_profile_id(&input.id)?;
    let scope = resolve_scope(user_id);
    let mut stored = load_scope(app, &scope).await?;

    if stored.profiles.len() >= MAX_PROFILES_PER_SCOPE
        && !stored.profiles.iter().any(|profile| profile.id == input.id)
    {
        return Err(AppError::Conflict(
            "The profile limit for this user was reached.".to_string(),
        ));
    }

    let api_base = validate_api_base(&input.api_base)?;
    let label = sanitize_required_text(&input.label, 128, "profile label")?;
    let model = sanitize_required_text(&input.model, 256, "model")?;
    let now = now_iso();

    let previous = stored
        .profiles
        .iter()
        .find(|profile| profile.id == input.id)
        .cloned();

    let account = key_account(&scope, &input.id);
    let before = secret_store::get(account.clone())
        .await?
        .map(|secret| secret.snapshot());

    let after = if input.clear_api_key {
        None
    } else if let Some(api_key) = &input.api_key {
        let value = api_key.as_str().trim();
        if value.is_empty() || value.len() > 4096 {
            return Err(AppError::invalid_input("Invalid LLM API key."));
        }
        Some(Zeroizing::new(value.to_string()))
    } else {
        before.clone()
    };

    apply_secret(&account, after.as_ref().map(|secret| secret.as_str())).await?;

    let profile = LlmProfile {
        id: input.id.clone(),
        stage: input.stage,
        label,
        api_base,
        model,
        api_key: String::new(),
        has_api_key: after.is_some(),
        created_at: previous
            .as_ref()
            .map(|profile| profile.created_at.clone())
            .unwrap_or_else(|| now.clone()),
        updated_at: now,
    };

    stored.profiles.retain(|current| current.id != profile.id);
    stored.profiles.push(profile.clone());
    sort_profiles(&mut stored.profiles);

    if let Err(error) = write_scope(app, &scope, stored).await {
        rollback_secret(&account, before.as_ref().map(|secret| secret.as_str())).await;
        return Err(error);
    }

    let profiles = merged_profiles(app, scope).await?;

    Ok((profiles, profile))
}

pub async fn remove(
    app: &AppHandle,
    user_id: Option<LlmUserId>,
    profile_id: &LlmProfileId,
) -> AppResult<LlmProfilesResult> {
    let _guard = PROFILE_STORE_GUARD.lock().await;

    validate_profile_id(profile_id)?;

    let scope = resolve_scope(user_id);
    let mut stored = load_scope(app, &scope).await?;
    let original_len = stored.profiles.len();

    stored.profiles.retain(|profile| &profile.id != profile_id);

    if stored.profiles.len() == original_len {
        return Ok(LlmProfilesResult {
            profiles: merged_profiles(app, scope).await?,
            secure_storage: true,
        });
    }

    let account = key_account(&scope, profile_id);
    let before = secret_store::get(account.clone())
        .await?
        .map(|secret| secret.snapshot());

    secret_store::delete(account.clone()).await?;

    if let Err(error) = write_scope(app, &scope, stored).await {
        rollback_secret(&account, before.as_ref().map(|secret| secret.as_str())).await;
        return Err(error);
    }

    Ok(LlmProfilesResult {
        profiles: merged_profiles(app, scope).await?,
        secure_storage: true,
    })
}

/// Returns the API key stored in the OS keychain for a profile. Empty string
/// when the profile exists but has no key. Used by the resolve-key command so
/// the renderer can hydrate keys at runtime — list/save never carry them.
pub async fn resolve_key(
    app: &AppHandle,
    user_id: Option<LlmUserId>,
    profile_id: &LlmProfileId,
) -> AppResult<String> {
    let _guard = PROFILE_STORE_GUARD.lock().await;

    validate_profile_id(profile_id)?;
    let scope = resolve_scope(user_id);
    let selected = merged_scoped_profiles(app, scope)
        .await?
        .into_iter()
        .find(|entry| &entry.profile.id == profile_id)
        .ok_or_else(|| AppError::NotConfigured("LLM profile was not found.".to_string()))?;

    let secret = secret_store::get(key_account(&selected.scope, profile_id)).await?;
    Ok(secret
        .map(|value| value.expose().to_string())
        .unwrap_or_default())
}

async fn merged_profiles(app: &AppHandle, scope: ProfileScope) -> AppResult<Vec<LlmProfile>> {
    Ok(merged_scoped_profiles(app, scope)
        .await?
        .into_iter()
        .map(|profile| profile.profile)
        .collect())
}

async fn merged_scoped_profiles(
    app: &AppHandle,
    scope: ProfileScope,
) -> AppResult<Vec<ScopedProfile>> {
    let mut sources = vec![(scope.clone(), 3_u8)];

    if !matches!(scope, ProfileScope::Shared) {
        sources.push((ProfileScope::Shared, 2));
    }
    if !matches!(scope, ProfileScope::Guest) {
        sources.push((ProfileScope::Guest, 1));
    }

    let mut merged = BTreeMap::<LlmProfileId, ScopedProfile>::new();

    for (source_scope, priority) in sources {
        for profile in load_scope(app, &source_scope).await?.profiles {
            let replace = merged
                .get(&profile.id)
                .map(|current| {
                    timestamp(&profile.updated_at) > timestamp(&current.profile.updated_at)
                        || (timestamp(&profile.updated_at) == timestamp(&current.profile.updated_at)
                            && priority > current.priority)
                })
                .unwrap_or(true);

            if replace {
                merged.insert(
                    profile.id.clone(),
                    ScopedProfile {
                        profile,
                        scope: source_scope.clone(),
                        priority,
                    },
                );
            }
        }
    }

    let mut profiles: Vec<_> = merged.into_values().collect();
    profiles.sort_by(|left, right| {
        left.profile
            .label
            .to_ascii_lowercase()
            .cmp(&right.profile.label.to_ascii_lowercase())
    });
    Ok(profiles)
}

async fn load_scope(app: &AppHandle, scope: &ProfileScope) -> AppResult<StoredProfiles> {
    let path = profiles_path(app, scope)?;
    let Some(value) = read_json_file_async(path.clone()).await? else {
        return Ok(StoredProfiles {
            version: 2,
            profiles: Vec::new(),
        });
    };

    if let Ok(mut stored) = serde_json::from_value::<StoredProfiles>(value.clone()) {
        if stored.version == 2 {
            sanitize_stored_profiles(&mut stored);
            return Ok(stored);
        }
    }

    migrate_legacy_profiles(scope, path, value).await
}

async fn migrate_legacy_profiles(
    scope: &ProfileScope,
    path: PathBuf,
    value: Value,
) -> AppResult<StoredProfiles> {
    let value = if let Some(payload) = value.get("payload").and_then(Value::as_str) {
        serde_json::from_str::<Value>(payload)?
    } else {
        value
    };

    let items = value.as_array().cloned().unwrap_or_default();
    let mut profiles = Vec::new();
    let mut seen = HashSet::new();
    let mut changed_secrets = Vec::<(String, Option<Zeroizing<String>>)>::new();

    for item in items.into_iter().take(MAX_PROFILES_PER_SCOPE) {
        let Some(profile) = legacy_profile(&item)? else {
            continue;
        };

        if !seen.insert(profile.id.clone()) {
            continue;
        }

        if let Some(api_key) = item
            .get("apiKey")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|key| !key.is_empty())
        {
            let account = key_account(scope, &profile.id);
            let before = secret_store::get(account.clone())
                .await?
                .map(|secret| secret.snapshot());

            secret_store::set(account.clone(), api_key).await?;
            changed_secrets.push((account, before));
        }

        profiles.push(profile);
    }

    sort_profiles(&mut profiles);
    let stored = StoredProfiles {
        version: 2,
        profiles,
    };

    if let Err(error) = write_json_file_async(path, stored.clone()).await {
        for (account, before) in changed_secrets.into_iter().rev() {
            rollback_secret(&account, before.as_ref().map(|secret| secret.as_str())).await;
        }
        return Err(error);
    }

    Ok(stored)
}

fn legacy_profile(value: &Value) -> AppResult<Option<LlmProfile>> {
    let Some(object) = value.as_object() else {
        return Ok(None);
    };

    let id = object
        .get("id")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let id = LlmProfileId(id.to_string());

    if validate_profile_id(&id).is_err() {
        return Ok(None);
    }

    let stage = match object.get("stage").and_then(Value::as_str) {
        Some("translation") => LlmStage::Translation,
        Some("ocr") => LlmStage::Ocr,
        Some("clean") => LlmStage::Clean,
        _ => return Ok(None),
    };

    let label = sanitize_required_text(
        object.get("label").and_then(Value::as_str).unwrap_or_default(),
        128,
        "profile label",
    )?;
    let api_base = validate_api_base(
        object
            .get("apiBase")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )?;
    let model =
        sanitize_required_text(object.get("model").and_then(Value::as_str).unwrap_or_default(), 256, "model")?;

    let created_at = valid_timestamp(
        object
            .get("createdAt")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )
    .unwrap_or_else(now_iso);

    let updated_at = valid_timestamp(
        object
            .get("updatedAt")
            .and_then(Value::as_str)
            .unwrap_or_default(),
    )
    .unwrap_or_else(|| created_at.clone());

    Ok(Some(LlmProfile {
        id,
        stage,
        label,
        api_base,
        model,
        api_key: String::new(),
        has_api_key: object
            .get("apiKey")
            .and_then(Value::as_str)
            .is_some_and(|key| !key.trim().is_empty()),
        created_at,
        updated_at,
    }))
}

fn sanitize_stored_profiles(stored: &mut StoredProfiles) {
    stored.profiles.truncate(MAX_PROFILES_PER_SCOPE);

    let mut kept = BTreeMap::<LlmProfileId, LlmProfile>::new();
    let mut dropped = 0_usize;

    for mut profile in std::mem::take(&mut stored.profiles) {
        let valid = validate_profile_id(&profile.id).is_ok()
            && sanitize_required_text(&profile.label, 128, "profile label")
                .map(|label| profile.label = label)
                .is_ok()
            && sanitize_required_text(&profile.model, 256, "model")
                .map(|model| profile.model = model)
                .is_ok()
            && validate_api_base(&profile.api_base)
                .map(|api_base| profile.api_base = api_base)
                .is_ok();

        if !valid {
            dropped += 1;
            continue;
        }

        match kept.get(&profile.id) {
            Some(current) if timestamp(&current.updated_at) >= timestamp(&profile.updated_at) => {
                dropped += 1;
            }
            _ => {
                kept.insert(profile.id.clone(), profile);
            }
        }
    }

    if dropped > 0 {
        tracing::warn!(dropped, "invalid or duplicated LLM profiles were dropped");
    }

    stored.profiles = kept.into_values().collect();
    sort_profiles(&mut stored.profiles);
}

async fn write_scope(app: &AppHandle, scope: &ProfileScope, stored: StoredProfiles) -> AppResult<()> {
    write_json_file_async(profiles_path(app, scope)?, stored).await
}

async fn apply_secret(account: &str, value: Option<&str>) -> AppResult<()> {
    match value {
        Some(value) => secret_store::set(account.to_string(), value).await,
        None => secret_store::delete(account.to_string()).await,
    }
}

async fn rollback_secret(account: &str, value: Option<&str>) {
    if let Err(error) = apply_secret(account, value).await {
        tracing::error!(error_kind = error.kind(), "LLM keychain rollback failed");
    }
}

fn resolve_scope(user_id: Option<LlmUserId>) -> ProfileScope {
    match user_id.map(|id| id.0.trim().to_string()) {
        None => ProfileScope::Guest,
        Some(value) if value.is_empty() || value == GUEST_SCOPE => ProfileScope::Guest,
        Some(value) if value == SHARED_SCOPE => ProfileScope::Shared,
        Some(value) => ProfileScope::User(value.chars().take(256).collect()),
    }
}

fn profiles_path(app: &AppHandle, scope: &ProfileScope) -> AppResult<PathBuf> {
    let file_name = match scope {
        ProfileScope::Guest => "llm-profiles.json".to_string(),
        ProfileScope::Shared => format!(
            "llm-profiles.{}.json",
            stable_hash("llm-profile-scope", SHARED_SCOPE)
        ),
        ProfileScope::User(user_id) => format!(
            "llm-profiles.{}.json",
            stable_hash("llm-profile-user", user_id)
        ),
    };

    Ok(secure_store_dir(app)?.join(file_name))
}

fn key_account(scope: &ProfileScope, id: &LlmProfileId) -> String {
    let scope_key = match scope {
        ProfileScope::Guest => GUEST_SCOPE.to_string(),
        ProfileScope::Shared => SHARED_SCOPE.to_string(),
        ProfileScope::User(user_id) => stable_hash("llm-profile-user", user_id),
    };

    format!(
        "llm:{}:{}",
        stable_hash("llm-scope", &scope_key),
        stable_hash("llm-profile", &id.0)
    )
}

fn validate_profile_id(id: &LlmProfileId) -> AppResult<()> {
    if id.0.is_empty()
        || id.0.len() > 128
        || !id
            .0
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.'))
    {
        return Err(AppError::invalid_input("Invalid LLM profile identifier."));
    }
    Ok(())
}

fn validate_api_base(value: &str) -> AppResult<String> {
    let value = value.trim();
    if value.is_empty() || value.len() > 512 {
        return Err(AppError::invalid_input("Invalid LLM API base URL."));
    }

    let mut url = Url::parse(value)?;
    let host = url
        .host_str()
        .ok_or_else(|| AppError::invalid_input("LLM API URL has no host."))?;

    let loopback = host.eq_ignore_ascii_case("localhost")
        || host.parse::<IpAddr>().is_ok_and(|ip| ip.is_loopback());

    if url.scheme() != "https" && !(url.scheme() == "http" && loopback) {
        return Err(AppError::Security(
            "LLM API URLs must use HTTPS unless the host is loopback.".to_string(),
        ));
    }

    if !url.username().is_empty() || url.password().is_some() || url.fragment().is_some() {
        return Err(AppError::invalid_input(
            "LLM API URL contains unsupported components.",
        ));
    }

    url.set_fragment(None);
    Ok(url.to_string().trim_end_matches('/').to_string())
}

fn sanitize_required_text(value: &str, max_length: usize, field: &str) -> AppResult<String> {
    let value: String = value
        .trim()
        .chars()
        .filter(|character| !character.is_control())
        .take(max_length)
        .collect();

    if value.is_empty() {
        Err(AppError::invalid_input(format!("Invalid LLM {field}.")))
    } else {
        Ok(value)
    }
}

fn sort_profiles(profiles: &mut [LlmProfile]) {
    profiles.sort_by(|left, right| {
        left.label
            .to_ascii_lowercase()
            .cmp(&right.label.to_ascii_lowercase())
    });
}

fn timestamp(value: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date| date.timestamp_millis())
        .unwrap_or(0)
}

fn valid_timestamp(value: &str) -> Option<String> {
    chrono::DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|date| date.to_utc().to_rfc3339_opts(chrono::SecondsFormat::Millis, true))
}
