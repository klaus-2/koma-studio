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
    fn kind(&self) -> &'static str {
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
