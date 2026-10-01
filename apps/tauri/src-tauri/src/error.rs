//! Typed application error shared by Tauri commands and the media protocol.
//!
//! Serialized to the renderer as `{ kind, message }` so the frontend can
//! discriminate without parsing strings.

use std::{
    io,
    path::PathBuf,
};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    InvalidInput(String),
    #[error("invalid path: {0}")]
    InvalidPath(String),
    #[error("path is outside the allowed media scope: {}", .0.display())]
    PathNotAllowed(PathBuf),
    #[error("not found: {}", .0.display())]
    NotFound(PathBuf),
    #[error("not a directory: {}", .0.display())]
    NotADirectory(PathBuf),
    #[error("not a regular file: {}", .0.display())]
    NotAFile(PathBuf),
    #[error("path is not allowed: {0}")]
    NotAllowed(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    NotConfigured(String),
    #[error("{0}")]
    #[allow(dead_code)] // wire-kind reserved for future auth flows
    Authentication(String),
    #[error("{0}")]
    Security(String),
    #[error("{0}")]
    Network(String),
    #[error("remote service returned HTTP {status}: {message}")]
    Remote { status: u16, message: String },
    #[error("{0}")]
    RateLimited(String),
    #[error("{0}")]
    Serialization(String),
    #[error("{0}")]
    Archive(String),
    #[error("{0}")]
    Update(String),
    #[error("unsupported media type: {0}")]
    UnsupportedMediaType(String),
    #[error("range not satisfiable (size {size})")]
    RangeNotSatisfiable { size: u64 },
    #[error("method not allowed: {0}")]
    MethodNotAllowed(String),
    #[error("request origin is not the application webview")]
    OriginMismatch,
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn kind(&self) -> &'static str {
        match self {
            Self::InvalidInput(_) => "invalid-input",
            Self::InvalidPath(_) => "invalid-path",
            Self::PathNotAllowed(_) => "path-not-allowed",
            Self::NotFound(_) => "not-found",
            Self::NotADirectory(_) => "not-a-directory",
            Self::NotAFile(_) => "not-a-file",
            Self::NotAllowed(_) => "not-allowed",
            Self::Conflict(_) => "conflict",
            Self::NotConfigured(_) => "not-configured",
            Self::Authentication(_) => "authentication",
            Self::Security(_) => "security",
            Self::Network(_) => "network",
            Self::Remote { .. } => "network",
            Self::RateLimited(_) => "rate-limited",
            Self::Serialization(_) => "serialization",
            Self::Archive(_) => "archive",
            Self::Update(_) => "update",
            Self::UnsupportedMediaType(_) => "unsupported-media-type",
            Self::RangeNotSatisfiable { .. } => "range-not-satisfiable",
            Self::MethodNotAllowed(_) => "method-not-allowed",
            Self::OriginMismatch => "origin-mismatch",
            Self::Io(_) => "io",
            Self::Internal(_) => "internal",
        }
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::InvalidInput(message.into())
    }

    pub fn invalid_path(message: impl Into<String>) -> Self {
        Self::InvalidPath(message.into())
    }

    pub fn not_allowed(message: impl Into<String>) -> Self {
        Self::NotAllowed(message.into())
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::Conflict(message.into())
    }

    pub fn not_configured(message: impl Into<String>) -> Self {
        Self::NotConfigured(message.into())
    }

    pub fn security(message: impl Into<String>) -> Self {
        Self::Security(message.into())
    }

    pub fn network(context: &str, error: &reqwest::Error) -> Self {
        tracing::error!(
            context,
            timeout = error.is_timeout(),
            connect = error.is_connect(),
            status = ?error.status(),
            "network operation failed"
        );

        Self::Network(context.to_string())
    }

    pub fn internal(context: &str, error: impl std::fmt::Display) -> Self {
        tracing::error!(context, error = %error, "internal operation failed");
        Self::Internal(context.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        tracing::error!(error = %error, "JSON serialization failed");
        Self::Serialization("Invalid serialized data.".to_string())
    }
}

impl From<url::ParseError> for AppError {
    fn from(error: url::ParseError) -> Self {
        tracing::warn!(error = %error, "URL validation failed");
        Self::InvalidInput("Invalid URL.".to_string())
    }
}

impl From<zip::result::ZipError> for AppError {
    fn from(error: zip::result::ZipError) -> Self {
        tracing::error!(error = %error, "workspace archive operation failed");
        Self::Archive("Invalid or corrupted workspace archive.".to_string())
    }
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::internal("Tauri operation failed.", error)
    }
}

impl From<tokio::task::JoinError> for AppError {
    fn from(error: tokio::task::JoinError) -> Self {
        Self::internal("Background operation failed.", error)
    }
}

impl From<keyring::Error> for AppError {
    fn from(error: keyring::Error) -> Self {
        tracing::error!(error = %error, "operating-system keychain operation failed");
        Self::Security("The operating-system keychain is unavailable.".to_string())
    }
}

impl From<String> for AppError {
    fn from(message: String) -> Self {
        Self::Internal(message)
    }
}

impl From<PathBuf> for AppError {
    fn from(path: PathBuf) -> Self {
        Self::PathNotAllowed(path)
    }
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;

        let mut state = serializer.serialize_struct("AppError", 2)?;
        state.serialize_field("kind", self.kind())?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;

/// Sanitized command-layer error. Duplicates AppError's kebab-case wire
/// format but never carries filesystem paths or raw internals: messages are
/// replaced with safe generics at the conversion boundary.
pub type CommandResult<T> = Result<T, CommandError>;

#[derive(Debug, thiserror::Error)]
pub enum CommandError {
    #[error("{0}")]
    InvalidInput(String),
    #[error("{0}")]
    InvalidPath(String),
    #[error("{0}")]
    PathNotAllowed(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Conflict(String),
    #[error("{0}")]
    NotConfigured(String),
    #[error("{0}")]
    Authentication(String),
    #[error("{0}")]
    Security(String),
    #[error("{0}")]
    Network(String),
    #[error("{0}")]
    RateLimited(String),
    #[error("{0}")]
    Archive(String),
    #[error("{0}")]
    Update(String),
    #[error("{0}")]
    Internal(String),
}

impl serde::Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;

        let kind = match self {
            Self::InvalidInput(_) => "invalid-input",
            Self::InvalidPath(_) => "invalid-path",
            Self::PathNotAllowed(_) => "path-not-allowed",
            Self::NotFound(_) => "not-found",
            Self::Conflict(_) => "conflict",
            Self::NotConfigured(_) => "not-configured",
            Self::Authentication(_) => "authentication",
            Self::Security(_) => "security",
            Self::Network(_) => "network",
            Self::RateLimited(_) => "rate-limited",
            Self::Archive(_) => "archive",
            Self::Update(_) => "update",
            Self::Internal(_) => "internal",
        };

        let mut state = serializer.serialize_struct("CommandError", 2)?;
        state.serialize_field("kind", kind)?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

impl From<tauri::Error> for CommandError {
    fn from(error: tauri::Error) -> Self {
        Self::Internal(format!("Tauri operation failed: {error}"))
    }
}

impl From<tokio::task::JoinError> for CommandError {
    fn from(_error: tokio::task::JoinError) -> Self {
        Self::Internal("A background operation failed.".to_string())
    }
}

impl From<AppError> for CommandError {
    fn from(error: AppError) -> Self {
        tracing::error!(error_kind = error.kind(), "application operation failed");

        match error {
            AppError::InvalidInput(message) => Self::InvalidInput(message),
            AppError::InvalidPath(_) => {
                Self::InvalidPath("The selected path is invalid.".to_string())
            }
            AppError::PathNotAllowed(_) => {
                Self::PathNotAllowed("The selected path is not authorized.".to_string())
            }
            AppError::NotFound(_) => {
                Self::NotFound("The requested resource was not found.".to_string())
            }
            AppError::NotADirectory(_) => {
                Self::InvalidPath("The selected path is not a directory.".to_string())
            }
            AppError::NotAFile(_) => {
                Self::InvalidPath("The selected path is not a regular file.".to_string())
            }
            AppError::NotAllowed(_) => {
                Self::PathNotAllowed("The requested path is not authorized.".to_string())
            }
            AppError::UnsupportedMediaType(message) => Self::InvalidInput(message),
            AppError::RangeNotSatisfiable { .. } => {
                Self::InvalidInput("The requested byte range is invalid.".to_string())
            }
            AppError::MethodNotAllowed(message) => Self::InvalidInput(message),
            AppError::OriginMismatch => {
                Self::Security("The request origin is not authorized.".to_string())
            }
            AppError::Conflict(message) => Self::Conflict(message),
            AppError::NotConfigured(message) => Self::NotConfigured(message),
            AppError::Authentication(message) => Self::Authentication(message),
            AppError::Security(message) => Self::Security(message),
            AppError::Network(message) => Self::Network(message),
            AppError::Remote { status, message } => {
                Self::Network(format!("Remote service returned HTTP {status}: {message}"))
            }
            AppError::RateLimited(message) => Self::RateLimited(message),
            AppError::Archive(message) => Self::Archive(message),
            AppError::Update(message) => Self::Update(message),
            AppError::Io(_) => Self::Internal("A filesystem operation failed.".to_string()),
            AppError::Serialization(_) => {
                Self::Internal("A data serialization operation failed.".to_string())
            }
            AppError::Internal(message) => Self::Internal(message),
        }
    }
}
