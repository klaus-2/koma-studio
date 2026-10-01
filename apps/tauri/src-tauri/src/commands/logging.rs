use std::{
    borrow::Cow,
    fmt,
    fs::{self, File, OpenOptions},
    io::Write,
    sync::{Mutex, MutexGuard, PoisonError},
};

use chrono::SecondsFormat;
use serde::{Deserialize, Serialize, Serializer};
use tauri::{AppHandle, Manager, Runtime, State};

const SESSION_LOG_FILE_NAME: &str = "desktop-session.log";
/// Upper bound per renderer message. Anything longer is either a bug or an
/// attempt to fill the disk through the IPC bridge.
const MAX_MESSAGE_CHARS: usize = 8 * 1024;

/// Append-only sink for `desktop-session.log`. The file handle is opened once
/// and kept for the process lifetime; each line is a single `write_all`, which
/// is atomic for `O_APPEND` descriptors and needs no user-space buffering
/// (buffering would lose the last lines exactly when they matter: on a crash).
///
/// Register with `.manage(SessionLogSink::default())` in the Tauri builder.
#[derive(Debug, Default)]
pub struct SessionLogSink {
    file: Mutex<Option<File>>,
}

impl SessionLogSink {
    fn append<R: Runtime>(&self, app: &AppHandle<R>, line: &[u8]) -> Result<(), SessionLogError> {
        let mut guard = self.lock();
        let file = match guard.as_mut() {
            Some(file) => file,
            None => guard.insert(open_log_file(app)?),
        };
        if let Err(error) = file.write_all(line) {
            // Drop the handle so the next call reopens (covers a log dir
            // wiped or a volume unmounted while the app is running).
            *guard = None;
            return Err(SessionLogError::Io(error));
        }
        Ok(())
    }

    fn lock(&self) -> MutexGuard<'_, Option<File>> {
        // A poisoned lock only means a panic happened mid-write in another
        // thread; the Option<File> stays structurally valid.
        self.file.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

#[derive(Debug)]
pub enum SessionLogError {
    LogDir(tauri::Error),
    Io(std::io::Error),
}

impl fmt::Display for SessionLogError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::LogDir(error) => write!(f, "failed to resolve app log directory: {error}"),
            Self::Io(error) => write!(f, "failed to write session log: {error}"),
        }
    }
}

impl std::error::Error for SessionLogError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::LogDir(error) => Some(error),
            Self::Io(error) => Some(error),
        }
    }
}

impl From<tauri::Error> for SessionLogError {
    fn from(error: tauri::Error) -> Self {
        Self::LogDir(error)
    }
}

impl From<std::io::Error> for SessionLogError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl Serialize for SessionLogError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(self)
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLogPayload {
    #[serde(default)]
    level: String,
    #[serde(default)]
    source: String,
    #[serde(default)]
    message: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionLogLevel {
    Error,
    Warn,
    Info,
    Debug,
    Log,
}

impl SessionLogLevel {
    pub fn parse(raw: &str) -> Self {
        let trimmed = raw.trim();
        if trimmed.eq_ignore_ascii_case("error") {
            Self::Error
        } else if trimmed.eq_ignore_ascii_case("warn") || trimmed.eq_ignore_ascii_case("warning") {
            Self::Warn
        } else if trimmed.eq_ignore_ascii_case("info") {
            Self::Info
        } else if trimmed.eq_ignore_ascii_case("debug") {
            Self::Debug
        } else {
            Self::Log
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Error => "error",
            Self::Warn => "warn",
            Self::Info => "info",
            Self::Debug => "debug",
            Self::Log => "log",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionLogSource {
    Main,
    Renderer,
}

impl SessionLogSource {
    pub fn parse(raw: &str) -> Self {
        if raw.trim().eq_ignore_ascii_case("main") {
            Self::Main
        } else {
            Self::Renderer
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Main => "main",
            Self::Renderer => "renderer",
        }
    }
}

#[tauri::command(rename = "desktop:session-log")]
pub fn session_log<R: Runtime>(
    app: AppHandle<R>,
    sink: State<'_, SessionLogSink>,
    payload: SessionLogPayload,
) -> Result<(), SessionLogError> {
    let message = sanitize_message(&payload.message);
    if message.is_empty() {
        return Ok(());
    }

    let level = SessionLogLevel::parse(&payload.level);
    let source = SessionLogSource::parse(&payload.source);

    match level {
        SessionLogLevel::Error => log::error!("[{}] {message}", source.as_str()),
        SessionLogLevel::Warn => log::warn!("[{}] {message}", source.as_str()),
        SessionLogLevel::Info => log::info!("[{}] {message}", source.as_str()),
        SessionLogLevel::Debug => log::debug!("[{}] {message}", source.as_str()),
        SessionLogLevel::Log => log::trace!("[{}] {message}", source.as_str()),
    }

    let line = format_line(level, source, &message);
    sink.append(&app, line.as_bytes())
}

fn format_line(level: SessionLogLevel, source: SessionLogSource, message: &str) -> String {
    let timestamp = chrono::Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    format!(
        "{timestamp} [{}] [{}] {message}\n",
        level.as_str(),
        source.as_str()
    )
}

/// Trims, caps the length on a char boundary and replaces every control
/// character (including `\n`/`\r`) so a renderer message can never forge
/// additional log lines or inject terminal escape sequences.
fn sanitize_message(raw: &str) -> Cow<'_, str> {
    let trimmed = raw.trim();
    let bounded = match trimmed.char_indices().nth(MAX_MESSAGE_CHARS) {
        Some((cut, _)) => &trimmed[..cut],
        None => trimmed,
    };
    if bounded.chars().any(char::is_control) {
        Cow::Owned(
            bounded
                .chars()
                .map(|ch| if ch.is_control() { ' ' } else { ch })
                .collect(),
        )
    } else {
        Cow::Borrowed(bounded)
    }
}

fn open_log_file<R: Runtime>(app: &AppHandle<R>) -> Result<File, SessionLogError> {
    let log_dir = app.path().app_log_dir()?;
    fs::create_dir_all(&log_dir)?;
    Ok(OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join(SESSION_LOG_FILE_NAME))?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_renderer_log_defaults() {
        assert_eq!(SessionLogLevel::parse("warning"), SessionLogLevel::Warn);
        assert_eq!(SessionLogLevel::parse(" ERROR "), SessionLogLevel::Error);
        assert_eq!(SessionLogLevel::parse("verbose"), SessionLogLevel::Log);
        assert_eq!(SessionLogSource::parse("renderer"), SessionLogSource::Renderer);
        assert_eq!(SessionLogSource::parse("unknown"), SessionLogSource::Renderer);
        assert_eq!(SessionLogSource::parse("main"), SessionLogSource::Main);
    }

    #[test]
    fn sanitize_strips_control_characters() {
        let forged = "ok\n2026-01-01T00:00:00Z [error] [main] forged\u{1b}[31m";
        let sanitized = sanitize_message(forged);
        assert!(!sanitized.contains('\n'));
        assert!(!sanitized.contains('\u{1b}'));
        assert!(sanitized.starts_with("ok "));
    }

    #[test]
    fn sanitize_borrows_clean_input_and_caps_length() {
        assert!(matches!(sanitize_message("  clean  "), Cow::Borrowed("clean")));

        let long = "é".repeat(MAX_MESSAGE_CHARS + 10);
        let capped = sanitize_message(&long);
        assert_eq!(capped.chars().count(), MAX_MESSAGE_CHARS);
    }

    #[test]
    fn line_format_is_stable() {
        let line = format_line(SessionLogLevel::Warn, SessionLogSource::Renderer, "hello");
        assert!(line.ends_with(" [warn] [renderer] hello\n"));
        assert!(line.contains('T'));
    }
}
