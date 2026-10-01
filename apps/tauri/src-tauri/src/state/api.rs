//! Per-domain async operation gates. Keychain/file transactions must not
//! interleave within a domain; a semaphore serializes them without holding a
//! data lock across `.await`.

use std::sync::Arc;

use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use crate::error::{AppError, AppResult};

#[derive(Debug)]
pub struct ApiRuntimeState {
    fonts: Arc<Semaphore>,
    imgur: Arc<Semaphore>,
    llm: Arc<Semaphore>,
}

impl Default for ApiRuntimeState {
    fn default() -> Self {
        Self {
            fonts: Arc::new(Semaphore::new(1)),
            imgur: Arc::new(Semaphore::new(1)),
            llm: Arc::new(Semaphore::new(1)),
        }
    }
}

impl ApiRuntimeState {
    pub async fn fonts_permit(&self) -> AppResult<OwnedSemaphorePermit> {
        self.fonts
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| AppError::Internal("Font operation gate is closed.".to_string()))
    }

    pub async fn imgur_permit(&self) -> AppResult<OwnedSemaphorePermit> {
        self.imgur
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| AppError::Internal("Imgur operation gate is closed.".to_string()))
    }

    pub async fn llm_permit(&self) -> AppResult<OwnedSemaphorePermit> {
        self.llm
            .clone()
            .acquire_owned()
            .await
            .map_err(|_| AppError::Internal("LLM profile operation gate is closed.".to_string()))
    }
}
