use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::Arc;

use anyhow::Result;
use ignore::WalkBuilder;
use tracing::{debug, info, warn};

use crate::ai::AiClient;
use crate::config::AppConfig;

use super::chunker::{chunk_file, normalize_rel_path, sha256_hex, should_index_path};
use super::store::RagStore;

const MAX_FILE_BYTES: u64 = 256 * 1024;
const EMBED_BATCH_SIZE: usize = 16;

#[derive(Debug, Clone, Default)]
pub struct IndexReport {
    pub scanned_files: usize,
    pub updated_files: usize,
    pub skipped_unchanged: usize,
    pub removed_files: usize,
    pub indexed_chunks: usize,
    pub embeddings_enabled: bool,
}

pub async fn sync_repository(
    store: Arc<RagStore>,
    ai: Arc<AiClient>,
    config: &AppConfig,
    force: bool,
) -> Result<IndexReport> {
    let repo_root = &config.repo_root;
    if !repo_root.exists() {
        anyhow::bail!("repository root does not exist: {}", repo_root.display());
    }

    let files = collect_candidate_files(repo_root);
    let mut report = IndexReport {
        scanned_files: files.len(),
        embeddings_enabled: true,
        ..Default::default()
    };

    let existing_paths = store.list_indexed_files()?;
    let seen_paths: HashSet<String> = files.iter().map(|(rel, _)| rel.clone()).collect();

    for stale in existing_paths.difference(&seen_paths) {
        if let Err(err) = store.delete_file(stale) {
            warn!("failed deleting stale file {stale} from RAG DB: {err}");
        } else {
            report.removed_files += 1;
        }
    }

    let mut embed_offline_warned = false;

    for (rel_path, full_path) in files {
        let Ok(content) = fs::read_to_string(&full_path) else {
            continue;
        };
        let hash = sha256_hex(&content);
        if !force {
            if let Ok(Some(prev_hash)) = store.get_file_hash(&rel_path) {
                if prev_hash == hash {
                    report.skipped_unchanged += 1;
                    continue;
                }
            }
        }

        let chunks = chunk_file(
            &rel_path,
            &content,
            config.rag_chunk_lines,
            config.rag_chunk_overlap,
        );
        if chunks.is_empty() {
            continue;
        }

        let mut embeddings: Vec<Option<Vec<f32>>> = Vec::with_capacity(chunks.len());
        if report.embeddings_enabled {
            let texts: Vec<String> = chunks
                .iter()
                .map(|c| {
                    let header = match &c.symbol {
                        Some(sym) => format!("{} [{}] ({})", c.file_path, c.area, sym),
                        None => format!("{} [{}]", c.file_path, c.area),
                    };
                    format!("{header}\n{}", c.content)
                })
                .collect();

            for batch in texts.chunks(EMBED_BATCH_SIZE) {
                match ai.embed_batch(batch).await {
                    Ok(vecs) => {
                        for vec in vecs {
                            embeddings.push(Some(vec));
                        }
                    }
                    Err(err) => {
                        if !embed_offline_warned {
                            warn!(
                                "local embedding endpoint unavailable during indexing (falling back to SQLite FTS5 keyword search): {err}"
                            );
                            embed_offline_warned = true;
                        }
                        report.embeddings_enabled = false;
                        while embeddings.len() < chunks.len() {
                            embeddings.push(None);
                        }
                        break;
                    }
                }
            }
        } else {
            embeddings.resize(chunks.len(), None);
        }

        store.upsert_file_chunks(&rel_path, &hash, &chunks, &embeddings)?;
        report.updated_files += 1;
        report.indexed_chunks += chunks.len();
        debug!("indexed {} ({} chunks)", rel_path, chunks.len());
    }

    info!(
        "RAG repo sync complete: scanned={}, updated={}, skipped={}, removed={}, chunks={}, embeddings={}",
        report.scanned_files,
        report.updated_files,
        report.skipped_unchanged,
        report.removed_files,
        report.indexed_chunks,
        report.embeddings_enabled
    );

    Ok(report)
}

fn collect_candidate_files(repo_root: &Path) -> Vec<(String, std::path::PathBuf)> {
    let mut out = Vec::new();
    let walker = WalkBuilder::new(repo_root)
        .hidden(false)
        .git_ignore(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            let name = entry.file_name().to_string_lossy();
            !matches!(
                name.as_ref(),
                ".git" | "node_modules" | "target" | ".worktrees" | "dist" | "__pycache__"
            )
        })
        .build();

    for entry in walker.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let Ok(meta) = entry.metadata() else {
            continue;
        };
        if meta.len() == 0 || meta.len() > MAX_FILE_BYTES {
            continue;
        }
        let Ok(rel) = path.strip_prefix(repo_root) else {
            continue;
        };
        let rel_str = normalize_rel_path(&rel.to_string_lossy());
        if should_index_path(&rel_str) {
            out.push((rel_str, path.to_path_buf()));
        }
    }

    out.sort_by(|a, b| a.0.cmp(&b.0));
    out
}
