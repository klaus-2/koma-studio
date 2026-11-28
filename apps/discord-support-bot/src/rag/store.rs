use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Mutex;

use anyhow::{Context, Result};
use rusqlite::{params, Connection, OptionalExtension};

use super::chunker::CodeChunk;

#[derive(Debug, Clone)]
pub struct RetrievedChunk {
    pub id: i64,
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub area: String,
    pub symbol: Option<String>,
    pub content: String,
    pub score: f32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProposalKind {
    Issue,
    DraftPr,
}

impl ProposalKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ProposalKind::Issue => "issue",
            ProposalKind::DraftPr => "draft_pr",
        }
    }

    pub fn from_str_lossy(s: &str) -> Self {
        if s.eq_ignore_ascii_case("draft_pr") || s.eq_ignore_ascii_case("pr") {
            ProposalKind::DraftPr
        } else {
            ProposalKind::Issue
        }
    }
}

#[derive(Debug, Clone)]
pub struct PendingProposal {
    pub id: String,
    pub kind: ProposalKind,
    pub requester_id: String,
    pub channel_id: String,
    pub title: String,
    pub summary: String,
    pub body: String,
    pub labels: Vec<String>,
    pub file_path: Option<String>,
    pub file_content: Option<String>,
    pub viability_reason: String,
    pub created_at: String,
}

#[derive(Debug, Clone)]
pub struct RagStats {
    pub files_count: usize,
    pub chunks_count: usize,
    pub embedded_chunks_count: usize,
}

pub struct RagStore {
    conn: Mutex<Connection>,
}

impl RagStore {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent).with_context(|| {
                    format!("failed creating RAG directory {}", parent.display())
                })?;
            }
        }
        let conn = Connection::open(path)
            .with_context(|| format!("failed opening SQLite RAG database {}", path.display()))?;
        Self::from_connection(conn)
    }

    #[cfg(test)]
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        Self::from_connection(conn)
    }

    fn from_connection(conn: Connection) -> Result<Self> {
        conn.execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS files (
                path TEXT PRIMARY KEY,
                sha256 TEXT NOT NULL,
                indexed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                area TEXT NOT NULL,
                symbol TEXT,
                content TEXT NOT NULL,
                embedding BLOB
            );

            CREATE INDEX IF NOT EXISTS idx_chunks_file_path ON chunks(file_path);

            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                file_path,
                symbol,
                content,
                content='chunks',
                content_rowid='id'
            );

            CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
                INSERT INTO chunks_fts(rowid, file_path, symbol, content)
                VALUES (new.id, new.file_path, coalesce(new.symbol, ''), new.content);
            END;

            CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
                INSERT INTO chunks_fts(chunks_fts, rowid, file_path, symbol, content)
                VALUES ('delete', old.id, old.file_path, coalesce(old.symbol, ''), old.content);
            END;

            CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
                INSERT INTO chunks_fts(chunks_fts, rowid, file_path, symbol, content)
                VALUES ('delete', old.id, old.file_path, coalesce(old.symbol, ''), old.content);
                INSERT INTO chunks_fts(rowid, file_path, symbol, content)
                VALUES (new.id, new.file_path, coalesce(new.symbol, ''), new.content);
            END;

            CREATE TABLE IF NOT EXISTS pending_proposals (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                requester_id TEXT NOT NULL,
                channel_id TEXT NOT NULL,
                title TEXT NOT NULL,
                summary TEXT NOT NULL,
                body TEXT NOT NULL,
                labels_json TEXT NOT NULL,
                file_path TEXT,
                file_content TEXT,
                viability_reason TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS bot_threads (
                thread_id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            );
            ",
        )
        .context("failed initializing SQLite RAG schema")?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn get_file_hash(&self, file_path: &str) -> Result<Option<String>> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let hash = conn
            .query_row(
                "SELECT sha256 FROM files WHERE path = ?1",
                params![file_path],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        Ok(hash)
    }

    pub fn list_indexed_files(&self) -> Result<HashSet<String>> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let mut stmt = conn.prepare("SELECT path FROM files")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut out = HashSet::new();
        for r in rows {
            out.insert(r?);
        }
        Ok(out)
    }

    pub fn delete_file(&self, file_path: &str) -> Result<()> {
        let mut conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let tx = conn.transaction()?;
        tx.execute(
            "DELETE FROM chunks WHERE file_path = ?1",
            params![file_path],
        )?;
        tx.execute("DELETE FROM files WHERE path = ?1", params![file_path])?;
        tx.commit()?;
        Ok(())
    }

    pub fn upsert_file_chunks(
        &self,
        file_path: &str,
        sha256: &str,
        chunks: &[CodeChunk],
        embeddings: &[Option<Vec<f32>>],
    ) -> Result<()> {
        let mut conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let tx = conn.transaction()?;
        let now = chrono::Utc::now().to_rfc3339();

        tx.execute(
            "INSERT INTO files (path, sha256, indexed_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(path) DO UPDATE SET sha256 = excluded.sha256, indexed_at = excluded.indexed_at",
            params![file_path, sha256, now],
        )?;
        tx.execute(
            "DELETE FROM chunks WHERE file_path = ?1",
            params![file_path],
        )?;

        {
            let mut stmt = tx.prepare(
                "INSERT INTO chunks (file_path, start_line, end_line, area, symbol, content, embedding)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            )?;

            for (idx, chunk) in chunks.iter().enumerate() {
                let emb_blob = embeddings
                    .get(idx)
                    .and_then(|opt| opt.as_ref())
                    .map(|vec| encode_embedding(vec));
                stmt.execute(params![
                    chunk.file_path,
                    chunk.start_line as i64,
                    chunk.end_line as i64,
                    chunk.area,
                    chunk.symbol,
                    chunk.content,
                    emb_blob,
                ])?;
            }
        }

        tx.commit()?;
        Ok(())
    }

    pub fn stats(&self) -> Result<RagStats> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let files_count: i64 = conn.query_row("SELECT COUNT(*) FROM files", [], |r| r.get(0))?;
        let chunks_count: i64 = conn.query_row("SELECT COUNT(*) FROM chunks", [], |r| r.get(0))?;
        let embedded_chunks_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM chunks WHERE embedding IS NOT NULL",
            [],
            |r| r.get(0),
        )?;
        Ok(RagStats {
            files_count: files_count as usize,
            chunks_count: chunks_count as usize,
            embedded_chunks_count: embedded_chunks_count as usize,
        })
    }

    pub fn hybrid_search(
        &self,
        query: &str,
        query_embedding: Option<&[f32]>,
        top_k: usize,
    ) -> Result<Vec<RetrievedChunk>> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let limit = top_k.max(1);
        let candidate_limit = (limit * 4).max(20);

        let mut chunks_by_id: HashMap<i64, RetrievedChunk> = HashMap::new();
        let mut rrf_scores: HashMap<i64, f32> = HashMap::new();

        if let Some(fts_query) = build_fts_query(query) {
            let mut stmt = conn.prepare(
                "SELECT c.id, c.file_path, c.start_line, c.end_line, c.area, c.symbol, c.content
                 FROM chunks_fts f
                 JOIN chunks c ON c.id = f.rowid
                 WHERE chunks_fts MATCH ?1
                 ORDER BY bm25(chunks_fts, 4.0, 2.5, 1.0)
                 LIMIT ?2",
            )?;

            let rows = stmt.query_map(params![fts_query, candidate_limit as i64], |row| {
                Ok(RetrievedChunk {
                    id: row.get(0)?,
                    file_path: row.get(1)?,
                    start_line: row.get::<_, i64>(2)? as usize,
                    end_line: row.get::<_, i64>(3)? as usize,
                    area: row.get(4)?,
                    symbol: row.get(5)?,
                    content: row.get(6)?,
                    score: 0.0,
                })
            })?;

            for (rank, row) in rows.enumerate() {
                if let Ok(chunk) = row {
                    let score = 1.0 / (60.0 + (rank as f32) + 1.0);
                    *rrf_scores.entry(chunk.id).or_insert(0.0) += score;
                    chunks_by_id.insert(chunk.id, chunk);
                }
            }
        }

        if let Some(q_vec) = query_embedding {
            if !q_vec.is_empty() {
                let mut stmt =
                    conn.prepare("SELECT id, embedding FROM chunks WHERE embedding IS NOT NULL")?;
                let mut scored: Vec<(i64, f32)> = Vec::new();
                let mut rows = stmt.query([])?;
                while let Some(row) = rows.next()? {
                    let id: i64 = row.get(0)?;
                    let blob: Vec<u8> = row.get(1)?;
                    let emb = decode_embedding(&blob);
                    let sim = cosine_similarity(q_vec, &emb);
                    if sim > 0.15 {
                        scored.push((id, sim));
                    }
                }
                scored.sort_by(|a, b| b.1.total_cmp(&a.1));
                scored.truncate(candidate_limit);

                for (rank, (id, _sim)) in scored.into_iter().enumerate() {
                    let score = 1.0 / (60.0 + (rank as f32) + 1.0);
                    *rrf_scores.entry(id).or_insert(0.0) += score;

                    if let std::collections::hash_map::Entry::Vacant(entry) = chunks_by_id.entry(id)
                    {
                        if let Some(chunk) = conn
                            .query_row(
                                "SELECT id, file_path, start_line, end_line, area, symbol, content
                                 FROM chunks WHERE id = ?1",
                                params![id],
                                |row| {
                                    Ok(RetrievedChunk {
                                        id: row.get(0)?,
                                        file_path: row.get(1)?,
                                        start_line: row.get::<_, i64>(2)? as usize,
                                        end_line: row.get::<_, i64>(3)? as usize,
                                        area: row.get(4)?,
                                        symbol: row.get(5)?,
                                        content: row.get(6)?,
                                        score: 0.0,
                                    })
                                },
                            )
                            .optional()?
                        {
                            entry.insert(chunk);
                        }
                    }
                }
            }
        }

        let mut merged: Vec<RetrievedChunk> = chunks_by_id
            .into_values()
            .map(|mut chunk| {
                chunk.score = rrf_scores.get(&chunk.id).copied().unwrap_or(0.0);
                chunk
            })
            .collect();

        merged.sort_by(|a, b| b.score.total_cmp(&a.score));
        merged.truncate(limit);
        Ok(merged)
    }

    pub fn save_proposal(&self, proposal: &PendingProposal) -> Result<()> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let labels_json = serde_json::to_string(&proposal.labels)?;
        conn.execute(
            "INSERT INTO pending_proposals
             (id, kind, requester_id, channel_id, title, summary, body, labels_json, file_path, file_content, viability_reason, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
             ON CONFLICT(id) DO UPDATE SET
               kind = excluded.kind,
               title = excluded.title,
               summary = excluded.summary,
               body = excluded.body,
               labels_json = excluded.labels_json,
               file_path = excluded.file_path,
               file_content = excluded.file_content,
               viability_reason = excluded.viability_reason",
            params![
                proposal.id,
                proposal.kind.as_str(),
                proposal.requester_id,
                proposal.channel_id,
                proposal.title,
                proposal.summary,
                proposal.body,
                labels_json,
                proposal.file_path,
                proposal.file_content,
                proposal.viability_reason,
                proposal.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_proposal(&self, id: &str) -> Result<Option<PendingProposal>> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        conn.query_row(
            "SELECT id, kind, requester_id, channel_id, title, summary, body, labels_json, file_path, file_content, viability_reason, created_at
             FROM pending_proposals WHERE id = ?1",
            params![id],
            |row| {
                let kind_str: String = row.get(1)?;
                let labels_json: String = row.get(7)?;
                let labels: Vec<String> = serde_json::from_str(&labels_json).unwrap_or_default();
                Ok(PendingProposal {
                    id: row.get(0)?,
                    kind: ProposalKind::from_str_lossy(&kind_str),
                    requester_id: row.get(2)?,
                    channel_id: row.get(3)?,
                    title: row.get(4)?,
                    summary: row.get(5)?,
                    body: row.get(6)?,
                    labels,
                    file_path: row.get(8)?,
                    file_content: row.get(9)?,
                    viability_reason: row.get(10)?,
                    created_at: row.get(11)?,
                })
            },
        )
        .optional()
        .map_err(Into::into)
    }

    pub fn delete_proposal(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        conn.execute("DELETE FROM pending_proposals WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn register_thread(&self, thread_id: u64) -> Result<()> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO bot_threads (thread_id, created_at)
             VALUES (?1, ?2)
             ON CONFLICT(thread_id) DO NOTHING",
            params![thread_id.to_string(), now],
        )?;
        Ok(())
    }

    pub fn is_bot_thread(&self, thread_id: u64) -> Result<bool> {
        let conn = self.conn.lock().expect("RAG SQLite mutex poisoned");
        let found: Option<String> = conn
            .query_row(
                "SELECT thread_id FROM bot_threads WHERE thread_id = ?1",
                params![thread_id.to_string()],
                |row| row.get(0),
            )
            .optional()?;
        Ok(found.is_some())
    }
}

pub fn encode_embedding(vec: &[f32]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(vec.len() * 4);
    for &v in vec {
        bytes.extend_from_slice(&v.to_le_bytes());
    }
    bytes
}

pub fn decode_embedding(bytes: &[u8]) -> Vec<f32> {
    bytes
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect()
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.is_empty() || a.len() != b.len() {
        return 0.0;
    }
    let mut dot = 0.0_f32;
    let mut norm_a = 0.0_f32;
    let mut norm_b = 0.0_f32;
    for (&x, &y) in a.iter().zip(b.iter()) {
        dot += x * y;
        norm_a += x * x;
        norm_b += y * y;
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom <= 1e-12 {
        0.0
    } else {
        dot / denom
    }
}

pub fn build_fts_query(raw: &str) -> Option<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();

    for ch in raw.chars() {
        if ch.is_alphanumeric() || ch == '_' {
            current.push(ch);
        } else if !current.is_empty() {
            if current.chars().count() >= 2 {
                tokens.push(current.clone());
            }
            current.clear();
        }
    }
    if current.chars().count() >= 2 {
        tokens.push(current);
    }

    if tokens.is_empty() {
        return None;
    }

    tokens.truncate(12);
    let terms: Vec<String> = tokens
        .into_iter()
        .map(|tok| {
            let escaped = tok.replace('"', "");
            if escaped.chars().count() >= 4 {
                format!("\"{escaped}\"*")
            } else {
                format!("\"{escaped}\"")
            }
        })
        .collect();

    Some(terms.join(" OR "))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hybrid_search_combines_fts_and_vectors_safely() {
        let store = RagStore::open_in_memory().unwrap();
        let chunks = vec![
            CodeChunk {
                file_path: "packages/interface/src/themes/noir/noir.css".into(),
                start_line: 1,
                end_line: 20,
                area: "studio-react-interface".into(),
                symbol: Some("noir-crimson".into()),
                content: "--noir-crimson controls the primary Noir accent color tint".into(),
            },
            CodeChunk {
                file_path: "apps/tauri/src-tauri/src/commands/discord.rs".into(),
                start_line: 10,
                end_line: 40,
                area: "tauri-rust-desktop".into(),
                symbol: Some("resolve_client_id".into()),
                content: "Discord Rich Presence client ID and preset activity status".into(),
            },
        ];
        let embs = vec![Some(vec![1.0, 0.0, 0.0]), Some(vec![0.0, 1.0, 0.0])];
        store
            .upsert_file_chunks("doc1", "hash1", &chunks, &embs)
            .unwrap();

        let stats = store.stats().unwrap();
        assert_eq!(stats.chunks_count, 2);
        assert_eq!(stats.embedded_chunks_count, 2);

        let results = store
            .hybrid_search(
                "How does --noir-crimson custom \"color\" work?",
                Some(&[0.98, 0.02, 0.0]),
                5,
            )
            .unwrap();
        assert!(!results.is_empty());
        assert_eq!(
            results[0].file_path,
            "packages/interface/src/themes/noir/noir.css"
        );
    }

    #[test]
    fn persists_pending_proposals_for_confirmation() {
        let store = RagStore::open_in_memory().unwrap();
        let proposal = PendingProposal {
            id: "prop-1".into(),
            kind: ProposalKind::DraftPr,
            requester_id: "123".into(),
            channel_id: "456".into(),
            title: "Fix export dropdown scrollbar in Noir theme".into(),
            summary: "Applies custom scrollbar styling".into(),
            body: "Detailed body".into(),
            labels: vec!["ui".into(), "noir".into()],
            file_path: None,
            file_content: None,
            viability_reason: "Reproducible UI regression".into(),
            created_at: "2026-11-27T00:00:00Z".into(),
        };
        store.save_proposal(&proposal).unwrap();
        let fetched = store.get_proposal("prop-1").unwrap().unwrap();
        assert_eq!(fetched.kind, ProposalKind::DraftPr);
        assert_eq!(fetched.labels, vec!["ui", "noir"]);
        store.delete_proposal("prop-1").unwrap();
        assert!(store.get_proposal("prop-1").unwrap().is_none());
    }

    #[test]
    fn tracks_support_threads_across_queries() {
        let store = RagStore::open_in_memory().unwrap();
        assert!(!store.is_bot_thread(99887766).unwrap());
        store.register_thread(99887766).unwrap();
        assert!(store.is_bot_thread(99887766).unwrap());
    }
}
