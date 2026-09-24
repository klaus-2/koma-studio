//! Custom URI schemes that serve image/font bytes straight from disk.
//!
//! Security model (all enforced here, never in JS):
//!   1. path is percent-decoded and must be absolute,
//!   2. `fs::canonicalize` resolves `..`, symlinks and junctions,
//!   3. the canonical path must be inside a `MediaScope` root (component-wise
//!      `Path::starts_with`, so `/a/bc` is not inside `/a/b`),
//!   4. the extension must be in the per-scheme allowlist,
//!   5. cross-origin `fetch` is only honoured for the webview's own origin.
//!
//! Scope roots are canonicalized on insertion so both sides compare equal
//! (on Windows both carry the `\\?\` verbatim prefix).

use std::{
    borrow::Cow,
    collections::{BTreeSet, HashMap},
    fs::{self, File, Metadata},
    io,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::RwLock,
    time::UNIX_EPOCH,
};

use percent_encoding::{percent_decode_str, utf8_percent_encode, NON_ALPHANUMERIC};
use tauri::{
    http::{header, HeaderValue, Method, Request, Response, StatusCode},
    AppHandle, DragDropEvent, Manager, Runtime, UriSchemeContext, UriSchemeResponder, Window,
    WindowEvent,
};

use crate::{
    commands::api::fonts::fonts_dir_for_media,
    error::AppError,
};

pub const IMAGE_SCHEME: &str = "koma-image";
pub const FONT_SCHEME: &str = "koma-font";

/// Max bytes returned for one `Range` response. Larger requests get a valid
/// `206` with a shorter range; browsers keep paging. Bounds per-response RAM.
const MAX_RANGE_BYTES: u64 = 8 * 1024 * 1024;
const CACHE_CONTROL_VALUE: &str = "private, max-age=0, must-revalidate";

type Body = Cow<'static, [u8]>;

/// Build a `koma-image`/`koma-font` URL for a path, matching the webview's
/// scheme form (`http://{scheme}.localhost` on Windows, `{scheme}://localhost`
/// elsewhere — the same rule Tauri's `convertFileSrc` applies).
pub fn media_url(scheme: &str, path: &Path) -> String {
    let encoded = utf8_percent_encode(&path.to_string_lossy(), NON_ALPHANUMERIC).to_string();
    if cfg!(windows) {
        format!("http://{scheme}.localhost/{encoded}")
    } else {
        format!("{scheme}://localhost/{encoded}")
    }
}

// ---------------------------------------------------------------------------
// Media kinds
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MediaKind {
    Image,
    Font,
}

impl MediaKind {
    pub const fn scheme(self) -> &'static str {
        match self {
            Self::Image => IMAGE_SCHEME,
            Self::Font => FONT_SCHEME,
        }
    }

    fn extensions(self) -> &'static [&'static str] {
        match self {
            Self::Image => crate::commands::images::IMAGE_EXTENSIONS,
            Self::Font => crate::commands::api::fonts::FONT_EXTENSIONS,
        }
    }

    fn accepts(self, path: &Path) -> bool {
        lower_extension(path)
            .map(|ext| self.extensions().contains(&ext.as_str()))
            .unwrap_or(false)
    }

    fn mime_for(self, path: &Path) -> String {
        match self {
            Self::Image => crate::commands::images::infer_mime_type_from_path(path),
            Self::Font => match lower_extension(path).as_deref() {
                Some("ttf") => "font/ttf",
                Some("otf") => "font/otf",
                Some("woff") => "font/woff",
                Some("woff2") => "font/woff2",
                _ => "application/octet-stream",
            }
            .to_string(),
        }
    }
}

fn lower_extension(path: &Path) -> Option<String> {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
}

// ---------------------------------------------------------------------------
// Scope (allowlist)
// ---------------------------------------------------------------------------

#[derive(Debug, Default)]
pub struct MediaScope {
    dirs: RwLock<BTreeSet<PathBuf>>,
    files: RwLock<BTreeSet<PathBuf>>,
}

impl MediaScope {
    /// Allow a whole directory tree. Returns the canonical root.
    pub fn allow_dir(&self, dir: impl AsRef<Path>) -> Result<PathBuf, AppError> {
        let canonical = fs::canonicalize(dir.as_ref())?;
        if !canonical.is_dir() {
            return Err(AppError::NotADirectory(canonical));
        }
        // Never allow a filesystem root (`/`, `C:\`) — that would disable the scope.
        if canonical.parent().is_none() {
            return Err(AppError::PathNotAllowed(canonical));
        }
        self.dirs
            .write()
            .map_err(|_| poisoned())?
            .insert(canonical.clone());
        Ok(canonical)
    }

    /// Allow exactly one file. Returns the canonical path.
    pub fn allow_file(&self, file: impl AsRef<Path>) -> Result<PathBuf, AppError> {
        let canonical = fs::canonicalize(file.as_ref())?;
        if !canonical.is_file() {
            return Err(AppError::NotAFile(canonical));
        }
        self.files
            .write()
            .map_err(|_| poisoned())?
            .insert(canonical.clone());
        Ok(canonical)
    }

    /// Directory → `allow_dir`, otherwise `allow_file`.
    pub fn allow_path(&self, path: impl AsRef<Path>) -> Result<PathBuf, AppError> {
        if path.as_ref().is_dir() {
            self.allow_dir(path)
        } else {
            self.allow_file(path)
        }
    }

    /// `canonical` must already be the output of `fs::canonicalize`.
    pub fn is_allowed(&self, canonical: &Path) -> bool {
        let Ok(files) = self.files.read() else { return false };
        if files.contains(canonical) {
            return true;
        }
        drop(files);
        self.contains_dir(canonical)
    }

    /// True if `canonical` is one of the allowed roots or below one of them.
    pub fn contains_dir(&self, canonical: &Path) -> bool {
        let Ok(dirs) = self.dirs.read() else { return false };
        dirs.iter().any(|root| canonical.starts_with(root))
    }
}

fn poisoned() -> AppError {
    AppError::Internal("media scope lock poisoned".to_string())
}

/// Managed state. One instance per app; shared by all windows.
#[derive(Debug, Default)]
pub struct MediaScopes {
    pub images: MediaScope,
    pub fonts: MediaScope,
    /// webview label → origin pinned at first sight (the app's own origin).
    origins: RwLock<HashMap<String, String>>,
}

impl MediaScopes {
    fn for_kind(&self, kind: MediaKind) -> &MediaScope {
        match kind {
            MediaKind::Image => &self.images,
            MediaKind::Font => &self.fonts,
        }
    }
}

// ---------------------------------------------------------------------------
// Registration / lifecycle hooks
// ---------------------------------------------------------------------------

/// Registers both schemes and the managed scope state.
pub fn register<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder
        .manage(MediaScopes::default())
        .register_asynchronous_uri_scheme_protocol(
            MediaKind::Image.scheme(),
            |ctx, request, responder| handle(ctx, request, responder, MediaKind::Image),
        )
        .register_asynchronous_uri_scheme_protocol(
            MediaKind::Font.scheme(),
            |ctx, request, responder| handle(ctx, request, responder, MediaKind::Font),
        )
}

/// Static roots: fonts dir for `koma-font`, app data dir for `koma-image`
/// (autosave thumbnails/exports). User folders are added dynamically.
pub fn init_static_roots<R: Runtime>(app: &AppHandle<R>) -> Result<(), AppError> {
    let scopes = app
        .try_state::<MediaScopes>()
        .ok_or_else(|| AppError::Internal("MediaScopes not managed".to_string()))?;

    scopes.fonts.allow_dir(fonts_dir_for_media(app)?)?;

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Internal(error.to_string()))?;
    fs::create_dir_all(&app_data)?;
    scopes.images.allow_dir(app_data)?;
    Ok(())
}

/// Files/folders dropped onto a window become servable (user gesture observed
/// in Rust, not trusted from JS).
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event else {
        return;
    };
    let Some(scopes) = window.try_state::<MediaScopes>() else {
        return;
    };
    for path in paths {
        if let Err(error) = scopes.images.allow_path(path) {
            log::warn!("koma-image: dropped path not registered: {error}");
        }
    }
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

fn handle<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
    kind: MediaKind,
) {
    let app = ctx.app_handle().clone();
    let label = ctx.webview_label().to_string();

    // File IO off the webview thread; the responder may be called from anywhere.
    let _join = tauri::async_runtime::spawn_blocking(move || {
        let Some(scopes) = app.try_state::<MediaScopes>() else {
            responder.respond(error_response(&AppError::Internal(
                "MediaScopes not managed".to_string(),
            )));
            return;
        };
        let origin = pinned_origin(&app, &scopes, &label);
        let response = check_origin(&request, origin.as_deref())
            .and_then(|()| serve(scopes.for_kind(kind), kind, &request))
            .unwrap_or_else(|error| error_response(&error));
        responder.respond(with_cors(response, origin.as_deref()));
    });
}

/// Pure, testable core: no AppHandle.
pub(crate) fn serve(
    scope: &MediaScope,
    kind: MediaKind,
    request: &Request<Vec<u8>>,
) -> Result<Response<Body>, AppError> {
    match request.method() {
        &Method::OPTIONS => return preflight(),
        &Method::GET | &Method::HEAD => {}
        other => return Err(AppError::MethodNotAllowed(other.to_string())),
    }

    let path = resolve_request_path(scope, kind, request.uri().path())?;
    let mut file = File::open(&path)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() {
        return Err(AppError::NotAFile(path));
    }
    let total = metadata.len();
    let etag = weak_etag(&metadata);

    if etag_matches(request, &etag) {
        return finish(
            Response::builder()
                .status(StatusCode::NOT_MODIFIED)
                .header(header::ETAG, &etag)
                .header(header::CACHE_CONTROL, CACHE_CONTROL_VALUE),
            Vec::new(),
        );
    }

    let range = parse_range(request.headers().get(header::RANGE), total)?;
    let mut builder = Response::builder()
        .header(header::CONTENT_TYPE, kind.mime_for(&path))
        .header(header::ACCEPT_RANGES, "bytes")
        .header(header::ETAG, &etag)
        .header(header::CACHE_CONTROL, CACHE_CONTROL_VALUE)
        .header(header::X_CONTENT_TYPE_OPTIONS, "nosniff");

    let (status, start, len) = match range {
        Some((start, end)) => {
            builder = builder.header(
                header::CONTENT_RANGE,
                format!("bytes {start}-{end}/{total}"),
            );
            (StatusCode::PARTIAL_CONTENT, start, end - start + 1)
        }
        None => (StatusCode::OK, 0, total),
    };
    builder = builder.header(header::CONTENT_LENGTH, len);

    let body = if request.method() == Method::HEAD {
        Vec::new()
    } else {
        read_span(&mut file, start, len)?
    };
    finish(builder.status(status), body)
}

/// Decode → absolute → canonicalize → scope → extension.
fn resolve_request_path(
    scope: &MediaScope,
    kind: MediaKind,
    uri_path: &str,
) -> Result<PathBuf, AppError> {
    let encoded = uri_path.strip_prefix('/').unwrap_or(uri_path);
    let decoded = percent_decode_str(encoded)
        .decode_utf8()
        .map_err(|_| AppError::InvalidPath("request path is not valid UTF-8".to_string()))?;
    if decoded.is_empty() || decoded.contains('\0') {
        return Err(AppError::InvalidPath("empty or NUL-containing path".to_string()));
    }
    let requested = PathBuf::from(decoded.as_ref());
    if !requested.is_absolute() {
        return Err(AppError::InvalidPath("request path must be absolute".to_string()));
    }

    let canonical = match fs::canonicalize(&requested) {
        Ok(canonical) => canonical,
        Err(error) => {
            // Avoid an existence oracle: only report 404 when the *parent*
            // directory canonicalizes into the scope; everything else is 403.
            let parent_allowed = requested
                .parent()
                .and_then(|parent| fs::canonicalize(parent).ok())
                .is_some_and(|parent| scope.contains_dir(&parent));
            return Err(if parent_allowed && error.kind() == io::ErrorKind::NotFound {
                AppError::NotFound(requested)
            } else {
                AppError::PathNotAllowed(requested)
            });
        }
    };

    if !scope.is_allowed(&canonical) {
        return Err(AppError::PathNotAllowed(requested));
    }
    if !kind.accepts(&canonical) {
        return Err(AppError::UnsupportedMediaType(
            lower_extension(&canonical).unwrap_or_default(),
        ));
    }
    Ok(canonical)
}

/// Single-range parser (`bytes=a-b`, `bytes=a-`, `bytes=-n`). Multipart ranges
/// are deliberately unsupported. Returns inclusive `(start, end)`.
fn parse_range(header: Option<&HeaderValue>, total: u64) -> Result<Option<(u64, u64)>, AppError> {
    let Some(header) = header else { return Ok(None) };
    let unsatisfiable = || AppError::RangeNotSatisfiable { size: total };

    let spec = header
        .to_str()
        .ok()
        .and_then(|value| value.trim().strip_prefix("bytes="))
        .ok_or_else(unsatisfiable)?;
    if spec.contains(',') {
        return Err(unsatisfiable());
    }
    let (start, end) = spec.split_once('-').ok_or_else(unsatisfiable)?;
    if total == 0 {
        return Err(unsatisfiable());
    }
    let last = total - 1;

    let (start, end) = match (start.trim(), end.trim()) {
        ("", "") => return Err(unsatisfiable()),
        ("", suffix) => {
            let count: u64 = suffix.parse().map_err(|_| unsatisfiable())?;
            if count == 0 {
                return Err(unsatisfiable());
            }
            (total.saturating_sub(count), last)
        }
        (start, "") => (start.parse().map_err(|_| unsatisfiable())?, last),
        (start, end) => (
            start.parse().map_err(|_| unsatisfiable())?,
            end.parse::<u64>().map_err(|_| unsatisfiable())?.min(last),
        ),
    };
    if start > last || start > end {
        return Err(unsatisfiable());
    }
    let end = end.min(start.saturating_add(MAX_RANGE_BYTES - 1));
    Ok(Some((start, end)))
}

fn read_span(file: &mut File, start: u64, len: u64) -> Result<Vec<u8>, AppError> {
    let capacity = usize::try_from(len)
        .map_err(|_| AppError::Internal("response exceeds addressable memory".to_string()))?;
    if start > 0 {
        file.seek(SeekFrom::Start(start))?;
    }
    let mut buffer = vec![0_u8; capacity];
    file.read_exact(&mut buffer)?;
    Ok(buffer)
}

fn weak_etag(metadata: &Metadata) -> String {
    let modified = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    format!("W/\"{:x}-{:x}\"", metadata.len(), modified)
}

fn etag_matches(request: &Request<Vec<u8>>, etag: &str) -> bool {
    request
        .headers()
        .get(header::IF_NONE_MATCH)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            value.split(',').any(|candidate| {
                let candidate = candidate.trim();
                candidate == "*" || candidate == etag
            })
        })
}

// ---------------------------------------------------------------------------
// Origin pinning / CORS
// ---------------------------------------------------------------------------

fn pinned_origin<R: Runtime>(
    app: &AppHandle<R>,
    scopes: &MediaScopes,
    label: &str,
) -> Option<String> {
    if let Some(origin) = scopes.origins.read().ok()?.get(label).cloned() {
        return Some(origin);
    }
    // First request from a webview: its URL is still the app's own page.
    let url = app.get_webview_window(label)?.url().ok()?;
    let host = url.host_str()?;
    let port = url.port().map(|port| format!(":{port}")).unwrap_or_default();
    let origin = format!("{}://{host}{port}", url.scheme());
    scopes
        .origins
        .write()
        .ok()?
        .entry(label.to_string())
        .or_insert_with(|| origin.clone());
    Some(origin)
}

/// `<img>`/`@font-face` loads carry no `Origin`; `fetch` does. Reject fetches
/// from anything that is not the pinned app origin (e.g. a remote page loaded
/// into the same webview).
fn check_origin(request: &Request<Vec<u8>>, pinned: Option<&str>) -> Result<(), AppError> {
    match request.headers().get(header::ORIGIN).map(HeaderValue::to_str) {
        None => Ok(()),
        Some(Ok(origin)) if pinned == Some(origin) => Ok(()),
        _ => Err(AppError::OriginMismatch),
    }
}

fn with_cors(mut response: Response<Body>, origin: Option<&str>) -> Response<Body> {
    let headers = response.headers_mut();
    if let Some(value) = origin.and_then(|origin| HeaderValue::from_str(origin).ok()) {
        headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, value);
        headers.insert(header::VARY, HeaderValue::from_static("Origin"));
    }
    headers.insert(
        header::ACCESS_CONTROL_EXPOSE_HEADERS,
        HeaderValue::from_static("Content-Length, Content-Range, Accept-Ranges, ETag"),
    );
    response
}

fn preflight() -> Result<Response<Body>, AppError> {
    finish(
        Response::builder()
            .status(StatusCode::NO_CONTENT)
            .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
            .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range, If-None-Match")
            .header(header::ACCESS_CONTROL_MAX_AGE, "86400"),
        Vec::new(),
    )
}

// ---------------------------------------------------------------------------
// Errors → HTTP
// ---------------------------------------------------------------------------

fn status_for(error: &AppError) -> StatusCode {
    match error {
        AppError::InvalidPath(_) | AppError::InvalidInput(_) => StatusCode::BAD_REQUEST,
        AppError::PathNotAllowed(_) | AppError::OriginMismatch => StatusCode::FORBIDDEN,
        AppError::NotFound(_) => StatusCode::NOT_FOUND,
        AppError::NotAFile(_) | AppError::NotADirectory(_) => StatusCode::BAD_REQUEST,
        AppError::UnsupportedMediaType(_) => StatusCode::UNSUPPORTED_MEDIA_TYPE,
        AppError::RangeNotSatisfiable { .. } => StatusCode::RANGE_NOT_SATISFIABLE,
        AppError::MethodNotAllowed(_) => StatusCode::METHOD_NOT_ALLOWED,
        AppError::Io(io) => match io.kind() {
            io::ErrorKind::NotFound => StatusCode::NOT_FOUND,
            io::ErrorKind::PermissionDenied => StatusCode::FORBIDDEN,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        },
        _ => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

fn error_response(error: &AppError) -> Response<Body> {
    let status = status_for(error);
    let mut builder = Response::builder()
        .status(status)
        .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
        .header(header::CACHE_CONTROL, "no-store");
    if let AppError::RangeNotSatisfiable { size } = error {
        builder = builder.header(header::CONTENT_RANGE, format!("bytes */{size}"));
    }
    // Don't leak OS error text on 5xx.
    let text = if status.is_server_error() {
        "internal error".to_string()
    } else {
        error.to_string()
    };
    builder.body(Cow::Owned(text.into_bytes())).unwrap_or_else(|_| {
        let mut fallback = Response::new(Cow::Borrowed(&b"internal error"[..]));
        *fallback.status_mut() = StatusCode::INTERNAL_SERVER_ERROR;
        fallback
    })
}

fn finish(
    builder: tauri::http::response::Builder,
    body: Vec<u8>,
) -> Result<Response<Body>, AppError> {
    builder
        .body(Cow::Owned(body))
        .map_err(|error| AppError::Internal(error.to_string()))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn request(path: &Path, headers: &[(&str, &str)]) -> Request<Vec<u8>> {
        let encoded = utf8_percent_encode(&path.to_string_lossy(), NON_ALPHANUMERIC).to_string();
        let mut builder = Request::builder()
            .method(Method::GET)
            .uri(format!("koma-image://localhost/{encoded}"));
        for (name, value) in headers {
            builder = builder.header(*name, *value);
        }
        builder.body(Vec::new()).unwrap()
    }

    fn fixture() -> (tempfile::TempDir, MediaScope, PathBuf) {
        let temp = tempfile::tempdir().unwrap();
        let chapter = temp.path().join("chapter");
        fs::create_dir_all(&chapter).unwrap();
        let page = chapter.join("page.png");
        fs::write(&page, (0_u8..=255).collect::<Vec<_>>()).unwrap();
        fs::write(temp.path().join("secret.png"), b"nope").unwrap();
        let scope = MediaScope::default();
        scope.allow_dir(&chapter).unwrap();
        (temp, scope, page)
    }

    #[test]
    fn serves_whole_file() {
        let (_temp, scope, page) = fixture();
        let response = serve(&scope, MediaKind::Image, &request(&page, &[])).unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()[header::CONTENT_TYPE], "image/png");
        assert_eq!(response.headers()[header::CONTENT_LENGTH], "256");
        assert_eq!(response.body().len(), 256);
    }

    #[test]
    fn serves_byte_range() {
        let (_temp, scope, page) = fixture();
        let response =
            serve(&scope, MediaKind::Image, &request(&page, &[("range", "bytes=10-19")])).unwrap();
        assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
        assert_eq!(response.headers()[header::CONTENT_RANGE], "bytes 10-19/256");
        assert_eq!(response.body().as_ref(), &(10_u8..=19).collect::<Vec<_>>()[..]);
    }

    #[test]
    fn suffix_and_open_ranges() {
        let (_temp, scope, page) = fixture();
        let tail = serve(&scope, MediaKind::Image, &request(&page, &[("range", "bytes=-4")])).unwrap();
        assert_eq!(tail.body().as_ref(), &[252, 253, 254, 255]);
        let open = serve(&scope, MediaKind::Image, &request(&page, &[("range", "bytes=250-")])).unwrap();
        assert_eq!(open.headers()[header::CONTENT_RANGE], "bytes 250-255/256");
    }

    #[test]
    fn unsatisfiable_range_is_416() {
        let (_temp, scope, page) = fixture();
        let error =
            serve(&scope, MediaKind::Image, &request(&page, &[("range", "bytes=300-400")])).unwrap_err();
        assert!(matches!(error, AppError::RangeNotSatisfiable { size: 256 }));
        assert_eq!(error_response(&error).status(), StatusCode::RANGE_NOT_SATISFIABLE);
    }

    #[test]
    fn etag_roundtrip_returns_304() {
        let (_temp, scope, page) = fixture();
        let first = serve(&scope, MediaKind::Image, &request(&page, &[])).unwrap();
        let etag = first.headers()[header::ETAG].to_str().unwrap().to_string();
        let second =
            serve(&scope, MediaKind::Image, &request(&page, &[("if-none-match", &etag)])).unwrap();
        assert_eq!(second.status(), StatusCode::NOT_MODIFIED);
        assert!(second.body().is_empty());
    }

    #[test]
    fn head_has_headers_but_no_body() {
        let (_temp, scope, page) = fixture();
        let mut request = request(&page, &[]);
        *request.method_mut() = Method::HEAD;
        let response = serve(&scope, MediaKind::Image, &request).unwrap();
        assert_eq!(response.headers()[header::CONTENT_LENGTH], "256");
        assert!(response.body().is_empty());
    }

    #[test]
    fn rejects_lexical_traversal() {
        let (temp, scope, _page) = fixture();
        let evil = temp.path().join("chapter").join("..").join("secret.png");
        let error = serve(&scope, MediaKind::Image, &request(&evil, &[])).unwrap_err();
        assert!(matches!(error, AppError::PathNotAllowed(_)));
    }

    #[test]
    fn rejects_outside_scope_even_if_it_exists() {
        let (temp, scope, _page) = fixture();
        let outside = temp.path().join("secret.png");
        let error = serve(&scope, MediaKind::Image, &request(&outside, &[])).unwrap_err();
        assert!(matches!(error, AppError::PathNotAllowed(_)));
    }

    #[test]
    fn missing_file_inside_scope_is_404_but_outside_is_403() {
        let (temp, scope, _page) = fixture();
        let inside = temp.path().join("chapter").join("nope.png");
        let outside = temp.path().join("elsewhere").join("nope.png");
        assert!(matches!(
            serve(&scope, MediaKind::Image, &request(&inside, &[])).unwrap_err(),
            AppError::NotFound(_)
        ));
        assert!(matches!(
            serve(&scope, MediaKind::Image, &request(&outside, &[])).unwrap_err(),
            AppError::PathNotAllowed(_)
        ));
    }

    #[test]
    fn rejects_disallowed_extension() {
        let (temp, scope, _page) = fixture();
        let notes = temp.path().join("chapter").join("notes.txt");
        fs::write(&notes, b"x").unwrap();
        let error = serve(&scope, MediaKind::Image, &request(&notes, &[])).unwrap_err();
        assert!(matches!(error, AppError::UnsupportedMediaType(_)));
    }

    #[test]
    fn rejects_relative_paths() {
        let scope = MediaScope::default();
        let request = Request::builder()
            .uri("koma-image://localhost/chapter%2Fpage.png")
            .body(Vec::new())
            .unwrap();
        let error = serve(&scope, MediaKind::Image, &request).unwrap_err();
        assert!(matches!(error, AppError::InvalidPath(_)));
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape() {
        let (temp, scope, _page) = fixture();
        let link = temp.path().join("chapter").join("link.png");
        std::os::unix::fs::symlink(temp.path().join("secret.png"), &link).unwrap();
        let error = serve(&scope, MediaKind::Image, &request(&link, &[])).unwrap_err();
        assert!(matches!(error, AppError::PathNotAllowed(_)));
    }

    #[test]
    fn scope_refuses_filesystem_root() {
        let scope = MediaScope::default();
        let root = if cfg!(windows) { PathBuf::from(r"C:\") } else { PathBuf::from("/") };
        assert!(matches!(scope.allow_dir(root), Err(AppError::PathNotAllowed(_))));
    }

    #[test]
    fn origin_check() {
        let request = Request::builder()
            .header("origin", "tauri://localhost")
            .body(Vec::new())
            .unwrap();
        assert!(check_origin(&request, Some("tauri://localhost")).is_ok());
        assert!(matches!(
            check_origin(&request, Some("https://evil.example")),
            Err(AppError::OriginMismatch)
        ));
        let no_origin = Request::builder().body(Vec::new()).unwrap();
        assert!(check_origin(&no_origin, None).is_ok());
    }

    #[test]
    fn media_url_is_percent_encoded_absolute_path() {
        let url = media_url(IMAGE_SCHEME, Path::new(r"C:\Users\me\página 1.png"));
        let (host, path) = if cfg!(windows) {
            ("http://koma-image.localhost", url.trim_start_matches("http://koma-image.localhost"))
        } else {
            ("koma-image://localhost", url.trim_start_matches("koma-image://localhost"))
        };
        assert!(!host.is_empty());
        let decoded = percent_decode_str(path.trim_start_matches('/'))
            .decode_utf8()
            .unwrap()
            .to_string();
        assert_eq!(decoded, r"C:\Users\me\página 1.png");
    }
}
