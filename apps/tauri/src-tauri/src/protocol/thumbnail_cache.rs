use std::{
    fs::{self, Metadata},
    io::Write,
    path::Path,
    time::UNIX_EPOCH,
};

use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    commands::images::{encode_thumbnail_png, validate_thumbnail_max_dim},
    error::AppError,
};

const CACHE_DIR_NAME: &str = "koma-thumbs";
const THUMB_QUERY_KEY: &str = "thumb";

pub(crate) fn parse_thumb_query(query: Option<&str>) -> Result<Option<u32>, AppError> {
    let Some(query) = query else {
        return Ok(None);
    };
    for pair in query.split('&') {
        let Some((key, value)) = pair.split_once('=') else {
            continue;
        };
        if key != THUMB_QUERY_KEY {
            continue;
        }
        let max_dim = value
            .parse::<u32>()
            .map_err(|_| AppError::InvalidInput("Invalid thumbnail size.".to_owned()))?;
        return validate_thumbnail_max_dim(max_dim).map(Some);
    }
    Ok(None)
}

fn modified_nanos(metadata: &Metadata) -> u128 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0)
}

pub(crate) fn thumbnail_weak_etag(metadata: &Metadata, max_dim: u32) -> String {
    format!(
        "W/\"t-{:x}-{:x}-{:x}\"",
        metadata.len(),
        modified_nanos(metadata),
        max_dim
    )
}

fn cache_key(source_path: &Path, metadata: &Metadata, max_dim: u32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(source_path.to_string_lossy().as_bytes());
    hasher.update(metadata.len().to_le_bytes());
    hasher.update(modified_nanos(metadata).to_le_bytes());
    hasher.update(max_dim.to_le_bytes());
    hex::encode(hasher.finalize())
}

pub(crate) fn load_or_generate_thumbnail(
    source_path: &Path,
    metadata: &Metadata,
    max_dim: u32,
    cache_dir: Option<&Path>,
) -> Result<Vec<u8>, AppError> {
    let Some(root) = cache_dir else {
        return encode_thumbnail_png(source_path, max_dim);
    };
    let directory = root.join(CACHE_DIR_NAME);
    let target = directory.join(format!("{}.png", cache_key(source_path, metadata, max_dim)));
    if let Ok(cached) = fs::read(&target) {
        return Ok(cached);
    }
    let png = encode_thumbnail_png(source_path, max_dim)?;
    if let Err(error) = persist(&directory, &target, &png) {
        tracing::warn!(error_kind = ?error.kind(), "thumbnail cache write failed");
    }
    Ok(png)
}

fn persist(directory: &Path, target: &Path, png: &[u8]) -> std::io::Result<()> {
    fs::create_dir_all(directory)?;
    let temp = directory.join(format!(".{}.tmp", Uuid::new_v4()));
    let outcome = fs::File::create(&temp)
        .and_then(|mut file| file.write_all(png))
        .and_then(|()| match fs::rename(&temp, target) {
            Ok(()) => Ok(()),
            Err(_) if target.is_file() => {
                let _ = fs::remove_file(&temp);
                Ok(())
            }
            Err(error) => Err(error),
        });
    if outcome.is_err() {
        let _ = fs::remove_file(&temp);
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::media::{MediaKind, MediaScope, serve_with_cache};
    use percent_encoding::{NON_ALPHANUMERIC, utf8_percent_encode};
    use tauri::http::{Method, Request, StatusCode, header};

    fn thumb_request(
        method: Method,
        path: &Path,
        query: &str,
        headers: &[(&str, &str)],
    ) -> Request<Vec<u8>> {
        let encoded = utf8_percent_encode(&path.to_string_lossy(), NON_ALPHANUMERIC).to_string();
        let mut builder = Request::builder()
            .method(method)
            .uri(format!("koma-image://localhost/{encoded}{query}"));
        for (name, value) in headers {
            builder = builder.header(*name, *value);
        }
        builder.body(Vec::new()).unwrap()
    }

    fn write_png(path: &Path) {
        image::RgbaImage::from_fn(64, 32, |x, _| image::Rgba([x as u8, 0, 0, 255]))
            .save(path)
            .unwrap();
    }

    #[test]
    fn parses_thumb_query_values() {
        assert_eq!(parse_thumb_query(None).unwrap(), None);
        assert_eq!(parse_thumb_query(Some("other=1")).unwrap(), None);
        assert_eq!(parse_thumb_query(Some("a=b&thumb=256")).unwrap(), Some(256));
        assert!(parse_thumb_query(Some("thumb=abc")).is_err());
        assert!(parse_thumb_query(Some("thumb=0")).is_err());
        assert!(parse_thumb_query(Some("thumb=999999")).is_err());
    }

    #[test]
    fn etag_changes_with_max_dim() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("a.png");
        write_png(&path);
        let metadata = fs::metadata(&path).unwrap();
        assert_ne!(
            thumbnail_weak_etag(&metadata, 16),
            thumbnail_weak_etag(&metadata, 32)
        );
    }

    #[test]
    fn second_call_is_served_from_the_disk_cache() {
        let temp = tempfile::tempdir().unwrap();
        let cache = tempfile::tempdir().unwrap();
        let path = temp.path().join("a.png");
        write_png(&path);
        let metadata = fs::metadata(&path).unwrap();

        let first = load_or_generate_thumbnail(&path, &metadata, 16, Some(cache.path())).unwrap();
        fs::remove_file(&path).unwrap();
        let second = load_or_generate_thumbnail(&path, &metadata, 16, Some(cache.path())).unwrap();

        assert_eq!(first, second);
        let cached_files = fs::read_dir(cache.path().join(CACHE_DIR_NAME))
            .unwrap()
            .count();
        assert_eq!(cached_files, 1);
    }

    #[test]
    fn without_a_cache_directory_the_png_is_generated_each_time() {
        let temp = tempfile::tempdir().unwrap();
        let path = temp.path().join("a.png");
        write_png(&path);
        let metadata = fs::metadata(&path).unwrap();

        let png = load_or_generate_thumbnail(&path, &metadata, 16, None).unwrap();
        let decoded = image::load_from_memory(&png).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (16, 8));
    }

    #[test]
    fn protocol_serves_thumb_cached_and_supports_head_and_304() {
        let root = tempfile::tempdir().unwrap();
        let cache = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let page = root.path().join("page.png");
        let outside_page = outside.path().join("secret.png");
        write_png(&page);
        write_png(&outside_page);

        let scope = MediaScope::default();
        scope.allow_dir(root.path()).unwrap();

        let response = serve_with_cache(
            &scope,
            MediaKind::Image,
            &thumb_request(Method::GET, &page, "?thumb=16", &[]),
            Some(cache.path()),
        )
        .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CONTENT_TYPE], "image/png");
        let decoded = image::load_from_memory(response.body()).unwrap();
        assert_eq!((decoded.width(), decoded.height()), (16, 8));
        let etag = response.headers()[header::ETAG]
            .to_str()
            .unwrap()
            .to_owned();

        let not_modified = serve_with_cache(
            &scope,
            MediaKind::Image,
            &thumb_request(Method::GET, &page, "?thumb=16", &[("if-none-match", &etag)]),
            Some(cache.path()),
        )
        .unwrap();
        assert_eq!(not_modified.status(), StatusCode::NOT_MODIFIED);
        assert!(not_modified.body().is_empty());

        let head = serve_with_cache(
            &scope,
            MediaKind::Image,
            &thumb_request(Method::HEAD, &page, "?thumb=16", &[]),
            Some(cache.path()),
        )
        .unwrap();
        assert_eq!(head.status(), StatusCode::OK);
        assert_eq!(
            head.headers()[header::CONTENT_LENGTH],
            response.body().len().to_string()
        );
        assert!(head.body().is_empty());

        let forbidden = serve_with_cache(
            &scope,
            MediaKind::Image,
            &thumb_request(Method::GET, &outside_page, "?thumb=16", &[]),
            Some(cache.path()),
        )
        .unwrap_err();
        assert!(matches!(forbidden, AppError::PathNotAllowed(_)));
    }
}
