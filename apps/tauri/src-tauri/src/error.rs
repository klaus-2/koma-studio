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
            Self::UnsupportedMediaType(_) => "unsupported-media-type",
            Self::RangeNotSatisfiable { .. } => "range-not-satisfiable",
            Self::MethodNotAllowed(_) => "method-not-allowed",
            Self::OriginMismatch => "origin-mismatch",
            Self::Io(_) => "io",
            Self::Internal(_) => "internal",
        }
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
