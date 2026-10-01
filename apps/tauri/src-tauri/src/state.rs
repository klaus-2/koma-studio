//! Authorized workspace assets: opaque capability tokens the renderer can hand
//! back for export/upload without ever touching filesystem paths.

pub mod api;

use std::{
    collections::HashMap,
    path::PathBuf,
    time::{Duration, Instant},
};

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{
    error::{AppError, AppResult},
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
