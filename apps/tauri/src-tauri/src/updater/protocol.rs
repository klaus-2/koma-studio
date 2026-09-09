use tauri::{http, Runtime, UriSchemeContext};

use super::cas::CasStore;

pub fn serve_chunks_protocol<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>> {
    let store = match CasStore::from_app(ctx.app_handle()) {
        Ok(store) => store,
        Err(error) => return text_response(http::StatusCode::INTERNAL_SERVER_ERROR, error),
    };

    let path = request.uri().path();
    let file_path = match store.resolve_chunk_for_request(path) {
        Ok(path) => path,
        Err(error) => return text_response(http::StatusCode::BAD_REQUEST, error),
    };

    match std::fs::read(&file_path) {
        Ok(bytes) => {
            let content_type = content_type_for_path(path);
            http::Response::builder()
                .status(http::StatusCode::OK)
                .header(http::header::CONTENT_TYPE, content_type)
                .header(
                    http::header::CACHE_CONTROL,
                    "public, max-age=31536000, immutable",
                )
                .body(bytes)
                .unwrap_or_else(|error| {
                    text_response(http::StatusCode::INTERNAL_SERVER_ERROR, error.to_string())
                })
        }
        Err(_) => text_response(http::StatusCode::NOT_FOUND, "CAS chunk not found"),
    }
}

fn text_response(status: http::StatusCode, message: impl Into<String>) -> http::Response<Vec<u8>> {
    http::Response::builder()
        .status(status)
        .header(http::header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .body(message.into().into_bytes())
        .expect("static response is valid")
}

fn content_type_for_path(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or_default() {
        "js" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "wasm" => "application/wasm",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
}
