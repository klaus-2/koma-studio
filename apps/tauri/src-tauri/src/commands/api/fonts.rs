use std::{collections::BTreeMap, fs, path::PathBuf};

use base64::{engine::general_purpose, Engine as _};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Runtime};

use super::client::{app_data_dir, read_json_file, string_field, write_json_file};

const FONT_EXTENSIONS: &[&str] = &["ttf", "otf", "woff", "woff2"];
const DEFAULT_SYSTEM_FONTS: &[&str] = &[
    "Arial",
    "Calibri",
    "Comic Sans MS",
    "Georgia",
    "Segoe UI",
    "Tahoma",
    "Times New Roman",
    "Trebuchet MS",
    "Verdana",
];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FontEntry {
    pub family: String,
    pub source: String,
    pub file_name: Option<String>,
    pub data_url: Option<String>,
}

#[tauri::command(rename = "desktop-api:fonts:list")]
pub fn fonts_list<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    let mut system = DEFAULT_SYSTEM_FONTS
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    system.sort_by_key(|item| item.to_ascii_lowercase());
    let custom = list_custom_fonts(&app)?;
    Ok(json!({ "system": system, "custom": custom }))
}

#[tauri::command(rename = "desktop-api:fonts:import")]
pub fn fonts_import<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    fonts_install(app, payload)
}

#[tauri::command(rename = "desktop-api:fonts:install")]
pub fn fonts_install<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let file_name = string_field(&payload, "fileName");
    let content_base64 = string_field(&payload, "contentBase64");
    if file_name.is_empty() || content_base64.is_empty() {
        return Err("Invalid font payload.".to_string());
    }

    let extension = font_extension(&file_name).ok_or_else(|| {
        "Unsupported font format. Use TTF, OTF, WOFF or WOFF2.".to_string()
    })?;
    let bytes = general_purpose::STANDARD
        .decode(content_base64.as_bytes())
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(content_base64.as_bytes()))
        .map_err(|_| "Invalid font content.".to_string())?;
    let fallback_family = file_stem(&file_name);
    let family = sanitize_family(
        payload
            .get("family")
            .and_then(Value::as_str)
            .unwrap_or(fallback_family.as_str()),
    );
    let unique_file_name = unique_font_file_name(&app, &family, extension)?;
    let final_path = fonts_dir(&app)?.join(&unique_file_name);
    fs::write(&final_path, bytes).map_err(|error| error.to_string())?;

    let mut manifest = read_manifest(&app)?;
    manifest.insert(unique_file_name.clone(), family.clone());
    write_manifest(&app, &manifest)?;

    Ok(json!({
        "entry": FontEntry {
            family,
            source: "custom".to_string(),
            file_name: Some(unique_file_name),
            data_url: Some(font_data_url(&final_path)?),
        }
    }))
}

#[tauri::command(rename = "desktop-api:fonts:uninstall")]
pub fn fonts_uninstall<R: Runtime>(app: AppHandle<R>, payload: Value) -> Result<Value, String> {
    let file_name = string_field(&payload, "fileName");
    let family = string_field(&payload, "family");
    if file_name.is_empty() && family.is_empty() {
        return Err("Fonte custom ausente.".to_string());
    }

    let mut removed = false;
    let mut manifest = read_manifest(&app)?;
    let fonts_dir = fonts_dir(&app)?;
    let targets = manifest
        .iter()
        .filter(|(name, current_family)| {
            (!file_name.is_empty() && *name == &file_name)
                || (!family.is_empty() && current_family == &&family)
        })
        .map(|(name, _)| name.clone())
        .collect::<Vec<_>>();

    for target in targets {
        let path = fonts_dir.join(&target);
        if path.exists() {
            fs::remove_file(&path).map_err(|error| error.to_string())?;
            removed = true;
        }
        manifest.remove(&target);
    }
    write_manifest(&app, &manifest)?;
    Ok(json!({ "removed": removed }))
}

fn list_custom_fonts<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<FontEntry>, String> {
    let dir = fonts_dir(app)?;
    let mut manifest = read_manifest(app)?;
    let mut entries = Vec::new();
    let mut next_manifest = BTreeMap::new();
    for entry in fs::read_dir(&dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy().to_string();
        if font_extension(&file_name).is_none() {
            continue;
        }
        let family = manifest
            .remove(&file_name)
            .unwrap_or_else(|| sanitize_family(file_stem(&file_name).as_str()));
        next_manifest.insert(file_name.clone(), family.clone());
        entries.push(FontEntry {
            family,
            source: "custom".to_string(),
            file_name: Some(file_name),
            data_url: Some(font_data_url(&path)?),
        });
    }
    write_manifest(app, &next_manifest)?;
    entries.sort_by_key(|entry| entry.family.to_ascii_lowercase());
    Ok(entries)
}

fn fonts_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = app_data_dir(app)?.join("fonts");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn manifest_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(fonts_dir(app)?.join("manifest.json"))
}

fn read_manifest<R: Runtime>(app: &AppHandle<R>) -> Result<BTreeMap<String, String>, String> {
    let Some(Value::Object(object)) = read_json_file(&manifest_path(app)?) else {
        return Ok(BTreeMap::new());
    };
    Ok(object
        .into_iter()
        .filter_map(|(key, value)| value.as_str().map(|family| (key, sanitize_family(family))))
        .collect())
}

fn write_manifest<R: Runtime>(
    app: &AppHandle<R>,
    manifest: &BTreeMap<String, String>,
) -> Result<(), String> {
    write_json_file(&manifest_path(app)?, &json!(manifest))
}

fn font_extension(file_name: &str) -> Option<&str> {
    file_name
        .rsplit_once('.')
        .map(|(_, extension)| extension.to_ascii_lowercase())
        .filter(|extension| FONT_EXTENSIONS.contains(&extension.as_str()))
        .map(|extension| match extension.as_str() {
            "ttf" => "ttf",
            "otf" => "otf",
            "woff" => "woff",
            "woff2" => "woff2",
            _ => unreachable!(),
        })
}

fn unique_font_file_name<R: Runtime>(
    app: &AppHandle<R>,
    family: &str,
    extension: &str,
) -> Result<String, String> {
    let base = sanitize_file_component(family);
    let dir = fonts_dir(app)?;
    for index in 0..1000 {
        let candidate = if index == 0 {
            format!("{base}.{extension}")
        } else {
            format!("{base}-{index}.{extension}")
        };
        if !dir.join(&candidate).exists() {
            return Ok(candidate);
        }
    }
    Err("Could not generate a unique font name.".to_string())
}

fn font_data_url(path: &PathBuf) -> Result<String, String> {
    let path_text = path.to_string_lossy().to_string();
    let extension = font_extension(&path_text).unwrap_or("ttf");
    let mime = match extension {
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    };
    let bytes = fs::read(path).map_err(|error| error.to_string())?;
    Ok(format!(
        "data:{mime};base64,{}",
        general_purpose::STANDARD.encode(bytes)
    ))
}

fn sanitize_family(value: &str) -> String {
    let normalized = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, ' ' | '.' | '_' | '-') {
                ch
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    normalized
        .chars()
        .take(96)
        .collect::<String>()
        .if_empty("Custom Font")
}

fn sanitize_file_component(value: &str) -> String {
    let normalized = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-') {
                ch.to_ascii_lowercase()
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('_')
        .to_string();
    normalized
        .chars()
        .take(80)
        .collect::<String>()
        .if_empty("custom-font")
}

fn file_stem(file_name: &str) -> String {
    PathBuf::from(file_name)
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "Custom Font".to_string())
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
