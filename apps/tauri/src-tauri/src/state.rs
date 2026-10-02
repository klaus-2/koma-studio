//! Authorized workspace assets: opaque capability tokens the renderer can hand
//! back for export/upload without ever touching filesystem paths.

pub mod api;

use std::{
    collections::{HashMap, HashSet, VecDeque},
    path::PathBuf,
    sync::{
        Arc,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};

use tokio::sync::{Mutex, RwLock};
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
    models::model_manager::DesktopModelDownloadPayload,
    models::workspace::{WorkspaceAssetId, WorkspaceAssetSource, WorkspaceAssetToken},
};

const AUTHORIZATION_TTL: Duration = Duration::from_secs(24 * 60 * 60);
const MAX_AUTHORIZED_ASSETS: usize = 10_000;

#[derive(Debug, Clone)]
pub struct AuthorizedWorkspaceAsset {
    pub id: WorkspaceAssetId,
    pub path: String,
    pub file_name: String,
    pub mime_type: String,
    pub byte_length: u64,
    pub source_path: PathBuf,
}

#[derive(Debug, Clone)]
struct StoredAuthorization {
    asset: AuthorizedWorkspaceAsset,
    expires_at: Instant,
}

#[derive(Debug, Default)]
pub struct WorkspaceAssetStore {
    assets: RwLock<HashMap<WorkspaceAssetToken, StoredAuthorization>>,
}

impl WorkspaceAssetStore {
    pub async fn authorize(
        &self,
        asset: AuthorizedWorkspaceAsset,
    ) -> AppResult<WorkspaceAssetSource> {
        let token = WorkspaceAssetToken(Uuid::new_v4().to_string());
        let source_path = asset.source_path.to_string_lossy().into_owned();

        let mut assets = self.assets.write().await;
        let now = Instant::now();
        assets.retain(|_, entry| entry.expires_at > now);

        if assets.len() >= MAX_AUTHORIZED_ASSETS {
            return Err(AppError::conflict(
                "The workspace asset authorization limit was reached.",
            ));
        }

        assets.insert(
            token.clone(),
            StoredAuthorization {
                asset: asset.clone(),
                expires_at: now + AUTHORIZATION_TTL,
            },
        );

        Ok(WorkspaceAssetSource {
            id: asset.id,
            path: asset.path,
            file_name: asset.file_name,
            mime_type: asset.mime_type,
            byte_length: asset.byte_length,
            source_token: token,
            source_path,
        })
    }

    #[allow(dead_code)] // reserved for token-based export/upload flows
    pub async fn resolve(
        &self,
        source: &WorkspaceAssetSource,
    ) -> AppResult<AuthorizedWorkspaceAsset> {
        let assets = self.assets.read().await;
        let stored = assets
            .get(&source.source_token)
            .filter(|stored| stored.expires_at > Instant::now())
            .ok_or_else(|| {
                AppError::security("The workspace asset authorization is invalid or expired.")
            })?;

        let asset = &stored.asset;
        if asset.id != source.id
            || asset.path != source.path
            || asset.file_name != source.file_name
            || asset.mime_type != source.mime_type
            || asset.byte_length != source.byte_length
        {
            return Err(AppError::security(
                "Workspace asset metadata does not match its authorization.",
            ));
        }

        Ok(asset.clone())
    }

    #[allow(dead_code)] // reserved for token-based export/upload flows
    pub async fn resolve_many(
        &self,
        sources: &[WorkspaceAssetSource],
    ) -> AppResult<Vec<AuthorizedWorkspaceAsset>> {
        let mut resolved = Vec::with_capacity(sources.len());
        for source in sources {
            resolved.push(self.resolve(source).await?);
        }
        Ok(resolved)
    }

    /// Token-bound resolution for upload flows: the token alone is useless
    /// without the matching asset id, and the on-disk file must still match
    /// the authorized metadata.
    #[allow(dead_code)] // reserved for token-based export/upload flows
    pub async fn resolve_token(
        &self,
        id: &WorkspaceAssetId,
        token: &WorkspaceAssetToken,
    ) -> AppResult<AuthorizedWorkspaceAsset> {
        let assets = self.assets.read().await;
        let stored = assets
            .get(token)
            .filter(|stored| stored.expires_at > Instant::now())
            .ok_or_else(|| {
                AppError::security("The workspace asset authorization is invalid or expired.")
            })?;

        if &stored.asset.id != id {
            return Err(AppError::security(
                "Workspace asset ID does not match its authorization.",
            ));
        }

        let metadata = std::fs::metadata(&stored.asset.source_path)?;
        if !metadata.is_file() || metadata.len() != stored.asset.byte_length {
            return Err(AppError::Conflict(
                "The authorized asset changed after authorization.".to_string(),
            ));
        }

        Ok(stored.asset.clone())
    }
}


// Model download queue: a single worker drains the queue; every state
// transition (queue/active/reserved) is one short critical section on a
// single tokio Mutex, never held across `.await`ed I/O.

#[derive(Debug, Clone)]
pub(crate) struct QueuedModelDownload {
    pub model: DesktopModelDownloadPayload,
}

#[derive(Debug, Clone)]
pub(crate) struct ActiveModelDownload {
    pub model_id: String,
    pub cancelled: Arc<AtomicBool>,
}

#[derive(Debug, Default)]
struct ModelDownloadState {
    queue: VecDeque<QueuedModelDownload>,
    active: Option<ActiveModelDownload>,
    reserved: HashSet<String>,
    worker_running: bool,
}

#[derive(Debug, Default)]
pub struct ModelDownloadStore {
    inner: Mutex<ModelDownloadState>,
}

#[derive(Debug)]
pub(crate) enum CancellationTarget {
    Queued(String),
    Active,
    NotFound,
}

impl ModelDownloadStore {
    pub(crate) async fn enqueue(
        &self,
        model: DesktopModelDownloadPayload,
    ) -> AppResult<(u32, bool)> {
        let mut state = self.inner.lock().await;

        let duplicated = state
            .active
            .as_ref()
            .is_some_and(|active| active.model_id == model.id)
            || state
                .queue
                .iter()
                .any(|queued| queued.model.id == model.id)
            || state.reserved.contains(&model.id);

        if duplicated {
            return Err(AppError::conflict(
                "The model already has an active operation.",
            ));
        }

        state.queue.push_back(QueuedModelDownload { model });
        let position = state.queue.len().min(u32::MAX as usize) as u32;
        let start_worker = !state.worker_running;

        if start_worker {
            state.worker_running = true;
        }

        Ok((position, start_worker))
    }

    pub(crate) async fn pop_next(&self) -> Option<QueuedModelDownload> {
        let mut state = self.inner.lock().await;
        let queued = state.queue.pop_front();

        match queued {
            Some(queued) => {
                state.active = Some(ActiveModelDownload {
                    model_id: queued.model.id.clone(),
                    cancelled: Arc::new(AtomicBool::new(false)),
                });
                Some(queued)
            }
            None => {
                state.active = None;
                state.worker_running = false;
                None
            }
        }
    }

    pub(crate) async fn active_cancellation(&self, model_id: &str) -> Option<Arc<AtomicBool>> {
        let state = self.inner.lock().await;

        state
            .active
            .as_ref()
            .filter(|active| active.model_id == model_id)
            .map(|active| Arc::clone(&active.cancelled))
    }

    pub(crate) async fn clear_active(&self, model_id: &str) {
        let mut state = self.inner.lock().await;

        if state
            .active
            .as_ref()
            .is_some_and(|active| active.model_id == model_id)
        {
            state.active = None;
        }
    }

    pub(crate) async fn cancel(&self, model_id: &str) -> CancellationTarget {
        let mut state = self.inner.lock().await;

        if let Some(index) = state
            .queue
            .iter()
            .position(|queued| queued.model.id == model_id)
        {
            if let Some(queued) = state.queue.remove(index) {
                return CancellationTarget::Queued(queued.model.id);
            }
        }

        if let Some(active) = state
            .active
            .as_ref()
            .filter(|active| active.model_id == model_id)
        {
            active.cancelled.store(true, Ordering::Release);
            return CancellationTarget::Active;
        }

        CancellationTarget::NotFound
    }

    pub(crate) async fn cancel_all(&self) -> (Vec<String>, bool) {
        let mut state = self.inner.lock().await;

        let queued = state
            .queue
            .drain(..)
            .map(|queued| queued.model.id)
            .collect::<Vec<_>>();

        let active = state.active.is_some();
        if let Some(active_download) = &state.active {
            active_download.cancelled.store(true, Ordering::Release);
        }

        (queued, active)
    }

    pub(crate) async fn reserve(&self, model_id: &str) -> AppResult<()> {
        let mut state = self.inner.lock().await;

        let busy = state
            .active
            .as_ref()
            .is_some_and(|active| active.model_id == model_id)
            || state
                .queue
                .iter()
                .any(|queued| queued.model.id == model_id)
            || state.reserved.contains(model_id);

        if busy {
            return Err(AppError::conflict(
                "The model already has an active operation.",
            ));
        }

        state.reserved.insert(model_id.to_string());
        Ok(())
    }

    pub(crate) async fn release(&self, model_id: &str) {
        self.inner.lock().await.reserved.remove(model_id);
    }
}
