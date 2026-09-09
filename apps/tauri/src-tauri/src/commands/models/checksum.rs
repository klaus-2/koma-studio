use std::fs::File;
use std::io::Read;

use super::*;

pub(super) fn checksum_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hex::encode(hasher.finalize()))
}

pub(super) fn checksum_directory_tree(dir: &Path) -> Result<String, String> {
    let mut files = collect_files(dir, dir)?;
    files.sort();
    let mut hasher = Sha256::new();
    for relative in files {
        let checksum = checksum_file(&dir.join(&relative))?;
        hasher.update(relative.to_string_lossy().as_bytes());
        hasher.update(b":");
        hasher.update(checksum.as_bytes());
        hasher.update(b"\n");
    }
    Ok(hex::encode(hasher.finalize()))
}

pub(super) fn collect_files(root: &Path, dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    for entry in fs::read_dir(dir).map_err(|error| error.to_string())? {
        let path = entry.map_err(|error| error.to_string())?.path();
        if path.is_dir() {
            files.extend(collect_files(root, &path)?);
        } else if path.is_file() {
            files.push(
                path.strip_prefix(root)
                    .map_err(|error| error.to_string())?
                    .to_path_buf(),
            );
        }
    }
    Ok(files)
}

pub(super) fn is_valid_checksum(value: &str) -> bool {
    value.len() == 64 && value.chars().all(|ch| ch.is_ascii_hexdigit())
}

pub(super) fn normalize_checksum(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

pub(super) async fn resolve_checksum_from_head(download_url: &str) -> Option<String> {
    let response = reqwest::Client::new()
        .head(download_url)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .ok()?;
    extract_checksum_from_headers(response.headers())
}

pub(super) async fn resolve_checksum_from_hugging_face_api(download_url: &str) -> Option<String> {
    let parsed = parse_hugging_face_resolve_url(download_url)?;
    let api_url = format!(
        "https://huggingface.co/api/models/{}/{}/revision/{}",
        parsed.owner, parsed.repo, parsed.revision
    );
    let payload = reqwest::Client::new()
        .get(api_url)
        .timeout(Duration::from_secs(15))
        .send()
        .await
        .ok()?
        .json::<serde_json::Value>()
        .await
        .ok()?;
    let siblings = payload.get("siblings")?.as_array()?;
    for sibling in siblings {
        let candidate = sibling
            .get("rfilename")
            .and_then(|value| value.as_str())
            .unwrap_or_default();
        if candidate.to_ascii_lowercase() != parsed.file_path.to_ascii_lowercase() {
            continue;
        }
        for key in ["sha256", "oid"] {
            if let Some(checksum) = sibling
                .get("lfs")
                .and_then(|lfs| lfs.get(key))
                .and_then(|value| value.as_str())
                .and_then(parse_checksum_from_header_value)
            {
                return Some(checksum);
            }
        }
    }
    None
}

pub(super) struct HuggingFaceResolveUrlParts {
    owner: String,
    repo: String,
    revision: String,
    file_path: String,
}

pub(super) fn parse_hugging_face_resolve_url(
    download_url: &str,
) -> Option<HuggingFaceResolveUrlParts> {
    let parsed = url::Url::parse(download_url).ok()?;
    if parsed.host_str()?.to_ascii_lowercase() != "huggingface.co" {
        return None;
    }
    let segments = parsed.path_segments()?.collect::<Vec<_>>();
    let resolve_index = segments
        .iter()
        .position(|segment| segment.eq_ignore_ascii_case("resolve"))?;
    if resolve_index < 2 || resolve_index + 2 >= segments.len() {
        return None;
    }
    Some(HuggingFaceResolveUrlParts {
        owner: segments[resolve_index - 2].to_string(),
        repo: segments[resolve_index - 1].to_string(),
        revision: segments[resolve_index + 1].to_string(),
        file_path: segments[resolve_index + 2..].join("/"),
    })
}

pub(super) fn extract_checksum_from_headers(
    headers: &reqwest::header::HeaderMap,
) -> Option<String> {
    for key in [
        "x-linked-etag",
        "x-checksum-sha256",
        "x-amz-meta-checksum-sha256",
        "x-amz-meta-sha256",
        "etag",
    ] {
        if let Some(checksum) = headers
            .get(key)
            .and_then(|value| value.to_str().ok())
            .and_then(parse_checksum_from_header_value)
        {
            return Some(checksum);
        }
    }
    None
}

pub(super) fn parse_checksum_from_header_value(raw: &str) -> Option<String> {
    let normalized = raw
        .trim()
        .trim_start_matches("W/")
        .trim_matches('"')
        .trim_matches('\'');
    let lower = normalized.to_ascii_lowercase();
    if let Some(index) = lower.find("sha256") {
        let candidate = lower[index + "sha256".len()..]
            .trim_start_matches([':', '='])
            .chars()
            .take_while(|ch| ch.is_ascii_hexdigit())
            .collect::<String>();
        if is_valid_checksum(&candidate) {
            return Some(candidate);
        }
    }
    for window in lower.as_bytes().windows(64) {
        if window.iter().all(|byte| byte.is_ascii_hexdigit()) {
            return String::from_utf8(window.to_vec()).ok();
        }
    }
    None
}
