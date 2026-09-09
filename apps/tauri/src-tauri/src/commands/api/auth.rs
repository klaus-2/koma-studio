use std::sync::Mutex;

use reqwest::{
    header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, CONTENT_TYPE},
    Method,
};
use serde::Serialize;
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Runtime, State};
use uuid::Uuid;

use super::{
    client::{
        api_error, api_url, bool_field, http_client_for_app, method, now_iso, number_field,
        raw_string_field, response_envelope, response_json_or_error, string_field, ApiEnvelope,
        AUTH_API_BASE,
    },
    identity::{collect_machine_profile, resolve_hardware_id, resolve_mac_fingerprint},
};

const DESKTOP_CLIENT_TOKEN_HEADER: &str = "x-desktop-client-token";
const DESKTOP_SESSION_ID_HEADER: &str = "x-desktop-session-id";
const DESKTOP_DEVICE_ID_HEADER: &str = "x-desktop-device-id";
const DESKTOP_APP_VERSION_HEADER: &str = "x-desktop-app-version";
const DESKTOP_UPDATE_CHANNEL_HEADER: &str = "x-desktop-update-channel";
const DESKTOP_BOOTSTRAP_SECRET_HEADER: &str = "x-desktop-bootstrap-secret";
const DESKTOP_DEVICE_KEY_HEADER: &str = "x-desktop-device-key";
const DESKTOP_TRAVEL_TOKEN_HEADER: &str = "x-desktop-travel-token";
const DESKTOP_BOOTSTRAP_PATH: &str = "/api/internal/desktop-client/bootstrap";
const DESKTOP_DEVICE_REGISTER_PATH: &str = "/api/internal/desktop-client/register";
const DESKTOP_TRAVEL_TOKEN_PATH: &str = "/api/internal/desktop-client/travel-token";
const DEFAULT_TOKEN_TTL_SECONDS: i64 = 600;
const DEFAULT_REFRESH_SKEW_SECONDS: i64 = 90;

#[derive(Debug)]
pub struct DesktopAuthStore {
    state: Mutex<DesktopAuthState>,
}

#[derive(Debug, Clone)]
struct DesktopAuthState {
    session_id: String,
    device_id: String,
    token: String,
    expires_at_ms: i64,
    device_key: String,
    pending_travel_token: Option<String>,
}

impl Default for DesktopAuthStore {
    fn default() -> Self {
        let source = machine_uid::get().unwrap_or_else(|_| Uuid::new_v4().to_string());
        Self {
            state: Mutex::new(DesktopAuthState {
                session_id: format!("desktop-{}", Uuid::new_v4()),
                device_id: format!(
                    "hw-{}",
                    super::client::stable_hash("koma-studio:hardware:v1", source.trim())
                ),
                token: String::new(),
                expires_at_ms: 0,
                device_key: String::new(),
                pending_travel_token: std::env::var("DESKTOP_TRAVEL_TOKEN")
                    .ok()
                    .map(|value| value.trim().to_string())
                    .filter(|value| !value.is_empty()),
            }),
        }
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RefreshSessionResult {
    pub refreshed: bool,
    pub token_expires_at: Option<String>,
}

#[tauri::command(rename = "desktop-api:auth:config")]
pub async fn config<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
) -> Result<ApiEnvelope, String> {
    session_api_fetch(
        &app,
        &store,
        "/api/auth/config",
        Method::GET,
        None,
        false,
        None,
    )
    .await
}

#[tauri::command(rename = "desktop-api:auth:session")]
pub async fn session<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
) -> Result<ApiEnvelope, String> {
    session_api_fetch(
        &app,
        &store,
        "/api/auth/session",
        Method::GET,
        None,
        true,
        None,
    )
    .await
}

#[tauri::command(rename = "desktop-api:auth:refresh-session")]
pub async fn refresh_session<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
) -> Result<RefreshSessionResult, String> {
    let refreshed = refresh_session_token(&app, &store).await.is_ok();
    let expires_at = store
        .state
        .lock()
        .map_err(|error| error.to_string())?
        .expires_at_ms;
    Ok(RefreshSessionResult {
        refreshed,
        token_expires_at: (expires_at > 0).then(|| millis_to_iso(expires_at)),
    })
}

#[tauri::command(rename = "desktop-api:auth:login")]
pub async fn login<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
    payload: Value,
) -> Result<ApiEnvelope, String> {
    let email = string_field(&payload, "email");
    let password = raw_string_field(&payload, "password");
    let captcha_token = raw_string_field(&payload, "captchaToken");
    let remember_me = bool_field(&payload, "rememberMe");
    let travel_token = string_field(&payload, "travelToken");
    if email.is_empty() || password.is_empty() {
        return Ok(api_error(400, "Credenciais invalidas."));
    }

    clear_state(&store, true)?;
    if !travel_token.is_empty() {
        set_pending_travel_token(&store, Some(travel_token.clone()))?;
    }

    let response = session_api_fetch(
        &app,
        &store,
        "/api/auth/login",
        Method::POST,
        Some(json!({
            "email": email,
            "password": password,
            "captchaToken": captcha_token,
            "rememberMe": remember_me,
            "desktopDeviceId": resolve_hardware_id(&app)?,
            "desktopMacFingerprint": resolve_mac_fingerprint(&app)?,
        })),
        false,
        None,
    )
    .await?;

    if response.ok {
        let _ = register_device_key(&app, &store, "login", Some(travel_token)).await;
        let _ = refresh_session_token(&app, &store).await;
        let _ = sync_machine_profile(&app, &store, "login").await;
    }

    Ok(response)
}

#[tauri::command(rename = "desktop-api:auth:register")]
pub async fn register<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
    payload: Value,
) -> Result<ApiEnvelope, String> {
    let email = string_field(&payload, "email");
    let password = raw_string_field(&payload, "password");
    let name = raw_string_field(&payload, "name");
    let captcha_token = raw_string_field(&payload, "captchaToken");
    let travel_token = string_field(&payload, "travelToken");
    if email.is_empty() || password.is_empty() {
        return Ok(api_error(400, "Dados de registro invalidos."));
    }

    let mut body = Map::new();
    body.insert("email".to_string(), Value::String(email));
    body.insert("password".to_string(), Value::String(password));
    body.insert("name".to_string(), Value::String(name));
    body.insert("captchaToken".to_string(), Value::String(captcha_token));
    if let Some(legal) = payload
        .get("legalAcceptance")
        .filter(|value| value.is_object())
    {
        body.insert("legalAcceptance".to_string(), legal.clone());
    }
    body.insert(
        "desktopDeviceId".to_string(),
        Value::String(resolve_hardware_id(&app)?),
    );
    body.insert(
        "desktopMacFingerprint".to_string(),
        Value::String(resolve_mac_fingerprint(&app)?),
    );

    let response = session_api_fetch(
        &app,
        &store,
        "/api/auth/register",
        Method::POST,
        Some(Value::Object(body)),
        false,
        None,
    )
    .await?;

    if response.ok {
        if !travel_token.is_empty() {
            set_pending_travel_token(&store, Some(travel_token.clone()))?;
        }
        let _ = register_device_key(&app, &store, "register", Some(travel_token)).await;
        let _ = refresh_session_token(&app, &store).await;
        let _ = sync_machine_profile(&app, &store, "register").await;
    }

    Ok(response)
}

#[tauri::command(rename = "desktop-api:auth:travel-token:set")]
pub fn set_travel_token(
    store: State<'_, DesktopAuthStore>,
    payload: Value,
) -> Result<ApiEnvelope, String> {
    let token = string_field(&payload, "token");
    set_pending_travel_token(&store, (!token.is_empty()).then_some(token))?;
    Ok(ApiEnvelope {
        ok: true,
        status: 200,
        payload: Some(json!({ "success": true })),
    })
}

#[tauri::command(rename = "desktop-api:auth:travel-token:create")]
pub async fn create_travel_token<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
    payload: Value,
) -> Result<ApiEnvelope, String> {
    let mut body = Map::new();
    if let Some(value) = positive_int_field(&payload, "ttlMinutes") {
        body.insert("ttlMinutes".to_string(), json!(value));
    }
    if let Some(value) = positive_int_field(&payload, "travelDays") {
        body.insert("travelDays".to_string(), json!(value));
    }
    let delivery = string_field(&payload, "deliveryMode");
    if delivery == "copy" || delivery == "email" {
        body.insert("deliveryMode".to_string(), json!(delivery));
    }

    session_api_fetch(
        &app,
        &store,
        DESKTOP_TRAVEL_TOKEN_PATH,
        Method::POST,
        Some(Value::Object(body)),
        true,
        None,
    )
    .await
}

#[tauri::command(rename = "desktop-api:auth:verify-email")]
pub async fn verify_email<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
    payload: Value,
) -> Result<ApiEnvelope, String> {
    let token = super::client::access_token(&payload).map_err(|_| String::new());
    let Ok(access_token) = token else {
        return Ok(api_error(401, "Session expired. Please sign in again."));
    };
    session_api_fetch(
        &app,
        &store,
        "/api/auth/verify-email",
        Method::POST,
        Some(json!({})),
        false,
        Some(access_token),
    )
    .await
}

#[tauri::command(rename = "desktop-api:auth:confirm-email")]
pub async fn confirm_email<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
    payload: Value,
) -> Result<ApiEnvelope, String> {
    let token = string_field(&payload, "token");
    if token.is_empty() {
        return Ok(api_error(400, "Invalid token."));
    }
    session_api_fetch(
        &app,
        &store,
        "/api/auth/confirm-email",
        Method::POST,
        Some(json!({ "token": token })),
        false,
        None,
    )
    .await
}

#[tauri::command(rename = "desktop-api:auth:forgot-password")]
pub async fn forgot_password<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
    payload: Value,
) -> Result<ApiEnvelope, String> {
    let email = string_field(&payload, "email");
    if email.is_empty() {
        return Ok(api_error(400, "Invalid email address."));
    }
    session_api_fetch(
        &app,
        &store,
        "/api/auth/forgot-password",
        Method::POST,
        Some(json!({ "email": email })),
        false,
        None,
    )
    .await
}

#[tauri::command(rename = "desktop-api:auth:reset-password")]
pub async fn reset_password<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
    payload: Value,
) -> Result<ApiEnvelope, String> {
    let token = string_field(&payload, "token");
    let password = raw_string_field(&payload, "password");
    if token.is_empty() || password.is_empty() {
        return Ok(api_error(400, "Invalid token or password."));
    }
    session_api_fetch(
        &app,
        &store,
        "/api/auth/reset-password",
        Method::POST,
        Some(json!({ "token": token, "password": password })),
        false,
        None,
    )
    .await
}

#[tauri::command(rename = "desktop-api:auth:sign-out")]
pub async fn sign_out<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, DesktopAuthStore>,
) -> Result<ApiEnvelope, String> {
    let response = session_api_fetch(
        &app,
        &store,
        "/api/auth/sign-out",
        Method::POST,
        Some(json!({})),
        false,
        None,
    )
    .await?;
    clear_state(&store, true)?;
    Ok(response)
}

pub async fn auth_api_json<R: Runtime>(
    app: &AppHandle<R>,
    store: &DesktopAuthStore,
    endpoint_path: &str,
    method_name: &str,
    body: Option<Value>,
    access_token: &str,
) -> Result<Value, String> {
    ensure_session_token(app, store).await?;
    let target_url = api_url(app, AUTH_API_BASE, endpoint_path)?;
    let client = http_client_for_app(app)?;
    let mut request = client
        .request(method(method_name)?, target_url)
        .headers(build_session_headers(store, Some(access_token))?);
    if let Some(value) = body {
        request = request
            .header(CONTENT_TYPE, "application/json")
            .json(&value);
    }
    let response = request.send().await.map_err(|error| error.to_string())?;
    response_json_or_error(response).await
}

async fn session_api_fetch<R: Runtime>(
    app: &AppHandle<R>,
    store: &DesktopAuthStore,
    endpoint_path: &str,
    request_method: Method,
    body: Option<Value>,
    require_session: bool,
    access_token: Option<String>,
) -> Result<ApiEnvelope, String> {
    if require_session {
        if let Err(error) = ensure_session_token(app, store).await {
            return Ok(ApiEnvelope {
                ok: false,
                status: 0,
                payload: Some(json!({ "error": error })),
            });
        }
    }

    let target_url = api_url(app, AUTH_API_BASE, endpoint_path)?;
    let client = http_client_for_app(app)?;
    let mut request = client
        .request(request_method, target_url)
        .headers(build_session_headers(store, access_token.as_deref())?);
    if let Some(value) = body {
        request = request
            .header(CONTENT_TYPE, "application/json")
            .json(&value);
    }
    let response = request.send().await.map_err(|error| error.to_string())?;
    let envelope = response_envelope(response).await;
    if !envelope.ok {
        log::warn!(
            "auth api {} failed (status {})",
            endpoint_path,
            envelope.status
        );
    }
    Ok(envelope)
}

async fn ensure_session_token<R: Runtime>(
    app: &AppHandle<R>,
    store: &DesktopAuthStore,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    let has_valid_token = {
        let state = store.state.lock().map_err(|error| error.to_string())?;
        !state.token.is_empty() && state.expires_at_ms - now > DEFAULT_REFRESH_SKEW_SECONDS * 1_000
    };
    if has_valid_token {
        return Ok(());
    }
    refresh_session_token(app, store).await.map(|_| ())
}

async fn refresh_session_token<R: Runtime>(
    app: &AppHandle<R>,
    store: &DesktopAuthStore,
) -> Result<String, String> {
    if enforce_desktop_client() {
        register_device_key(app, store, "session-refresh", None).await?;
    }

    let token = generate_session_token();
    let (session_id, device_id, device_key) = {
        let state = store.state.lock().map_err(|error| error.to_string())?;
        (
            state.session_id.clone(),
            state.device_id.clone(),
            state.device_key.clone(),
        )
    };

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    if !device_key.is_empty() {
        headers.insert(
            HeaderName::from_static(DESKTOP_DEVICE_KEY_HEADER),
            HeaderValue::from_str(&device_key).map_err(|error| error.to_string())?,
        );
    } else if let Ok(secret) = std::env::var("DESKTOP_BOOTSTRAP_SECRET") {
        let trimmed = secret.trim();
        if !trimmed.is_empty() {
            headers.insert(
                HeaderName::from_static(DESKTOP_BOOTSTRAP_SECRET_HEADER),
                HeaderValue::from_str(trimmed).map_err(|error| error.to_string())?,
            );
        }
    }

    let response = http_client_for_app(app)?
        .post(api_url(app, AUTH_API_BASE, DESKTOP_BOOTSTRAP_PATH)?)
        .headers(headers)
        .json(&json!({
            "sessionId": session_id,
            "deviceId": device_id,
            "token": token,
            "ttlSeconds": DEFAULT_TOKEN_TTL_SECONDS,
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let payload = response_json_or_error(response).await?;
    let ttl = payload
        .get("ttlSeconds")
        .and_then(Value::as_i64)
        .unwrap_or(DEFAULT_TOKEN_TTL_SECONDS);
    let expires_at = payload
        .get("expiresAt")
        .and_then(Value::as_str)
        .and_then(parse_iso_millis)
        .unwrap_or_else(|| chrono::Utc::now().timestamp_millis() + ttl * 1_000);

    let mut state = store.state.lock().map_err(|error| error.to_string())?;
    state.token = token.clone();
    state.expires_at_ms = expires_at;
    Ok(token)
}

async fn register_device_key<R: Runtime>(
    app: &AppHandle<R>,
    store: &DesktopAuthStore,
    reason: &str,
    travel_token: Option<String>,
) -> Result<(), String> {
    if !store
        .state
        .lock()
        .map_err(|error| error.to_string())?
        .device_key
        .is_empty()
    {
        return Ok(());
    }

    let pending = {
        let state = store.state.lock().map_err(|error| error.to_string())?;
        state.pending_travel_token.clone()
    };
    let normalized_travel = travel_token
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or(pending);

    let mut headers = HeaderMap::new();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    if let Some(token) = normalized_travel.as_ref() {
        headers.insert(
            HeaderName::from_static(DESKTOP_TRAVEL_TOKEN_HEADER),
            HeaderValue::from_str(token).map_err(|error| error.to_string())?,
        );
    }

    let device_id = resolve_hardware_id(app)?;
    let machine_profile = collect_machine_profile(app)?;
    let response = http_client_for_app(app)?
        .post(api_url(app, AUTH_API_BASE, DESKTOP_DEVICE_REGISTER_PATH)?)
        .headers(headers)
        .json(&json!({
            "deviceId": device_id,
            "machineProfile": machine_profile,
            "syncReason": reason,
            "travelToken": normalized_travel,
        }))
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let payload = response_json_or_error(response).await?;
    let device_key = payload
        .get("deviceKey")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .trim()
        .to_string();
    if device_key.len() < 16 {
        return Err("Desktop device registration returned an invalid key.".to_string());
    }

    let mut state = store.state.lock().map_err(|error| error.to_string())?;
    state.device_key = device_key;
    state.pending_travel_token = None;
    Ok(())
}

async fn sync_machine_profile<R: Runtime>(
    app: &AppHandle<R>,
    store: &DesktopAuthStore,
    reason: &str,
) -> Result<(), String> {
    let profile = collect_machine_profile(app)?;
    let _ = auth_api_json(
        app,
        store,
        "/api/internal/desktop-client/machine-profile/sync",
        "POST",
        Some(json!({ "machineProfile": profile, "syncReason": reason, "collectedAt": now_iso() })),
        "",
    )
    .await;
    Ok(())
}

fn build_session_headers(
    store: &DesktopAuthStore,
    access_token: Option<&str>,
) -> Result<HeaderMap, String> {
    let state = store.state.lock().map_err(|error| error.to_string())?;
    let mut headers = HeaderMap::new();
    headers.insert(
        HeaderName::from_static(DESKTOP_APP_VERSION_HEADER),
        HeaderValue::from_static(env!("CARGO_PKG_VERSION")),
    );
    headers.insert(
        HeaderName::from_static(DESKTOP_UPDATE_CHANNEL_HEADER),
        HeaderValue::from_static("stable"),
    );
    if let Some(token) = access_token.filter(|value| !value.trim().is_empty()) {
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token.trim()))
                .map_err(|error| error.to_string())?,
        );
    }
    if !state.token.is_empty() {
        headers.insert(
            HeaderName::from_static(DESKTOP_CLIENT_TOKEN_HEADER),
            HeaderValue::from_str(&state.token).map_err(|error| error.to_string())?,
        );
        headers.insert(
            HeaderName::from_static(DESKTOP_SESSION_ID_HEADER),
            HeaderValue::from_str(&state.session_id).map_err(|error| error.to_string())?,
        );
        headers.insert(
            HeaderName::from_static(DESKTOP_DEVICE_ID_HEADER),
            HeaderValue::from_str(&state.device_id).map_err(|error| error.to_string())?,
        );
    }
    Ok(headers)
}

fn clear_state(store: &DesktopAuthStore, clear_device_key: bool) -> Result<(), String> {
    let mut state = store.state.lock().map_err(|error| error.to_string())?;
    state.token.clear();
    state.expires_at_ms = 0;
    state.pending_travel_token = None;
    if clear_device_key {
        state.device_key.clear();
    }
    Ok(())
}

fn set_pending_travel_token(store: &DesktopAuthStore, token: Option<String>) -> Result<(), String> {
    store
        .state
        .lock()
        .map_err(|error| error.to_string())?
        .pending_travel_token = token;
    Ok(())
}

fn positive_int_field(payload: &Value, key: &str) -> Option<i64> {
    number_field(payload, key)
        .filter(|value| value.is_finite() && *value > 0.0)
        .map(|value| value.trunc() as i64)
}

fn enforce_desktop_client() -> bool {
    std::env::var("ENFORCE_DESKTOP_CLIENT")
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            )
        })
        .unwrap_or(false)
}

fn generate_session_token() -> String {
    let raw = format!("{}:{}:{}", Uuid::new_v4(), Uuid::new_v4(), now_iso());
    base64::Engine::encode(&base64::engine::general_purpose::URL_SAFE_NO_PAD, raw)
}

fn parse_iso_millis(value: &str) -> Option<i64> {
    chrono::DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|date| date.timestamp_millis())
}

fn millis_to_iso(value: i64) -> String {
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(value)
        .unwrap_or_else(chrono::Utc::now)
        .to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}
