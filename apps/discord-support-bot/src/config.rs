use std::env;
use std::path::PathBuf;

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct AppConfig {
    pub discord_token: String,
    pub discord_guild_id: Option<u64>,
    pub support_channel_ids: Vec<u64>,
    pub mod_log_channel_id: Option<u64>,
    pub staff_role_ids: Vec<u64>,

    pub ai_api_base_url: String,
    pub ai_api_key: Option<String>,
    pub ai_chat_model: String,
    pub ai_embed_model: String,
    pub ai_timeout_secs: u64,

    pub repo_root: PathBuf,
    pub rag_db_path: PathBuf,
    pub rag_top_k: usize,
    pub rag_chunk_lines: usize,
    pub rag_chunk_overlap: usize,

    pub github_token: Option<String>,
    pub github_owner: String,
    pub github_repo: String,
    pub github_base_branch: String,

    pub moderation_enabled: bool,
    pub mod_flood_max_msgs: usize,
    pub mod_flood_window_secs: u64,
    pub mod_max_mentions: usize,
    pub mod_block_invites: bool,

    pub bot_statuses: Vec<String>,
    pub bot_status_rotate_secs: u64,
    pub auto_threads_enabled: bool,
    pub thread_min_question_chars: usize,
    pub thread_min_answer_chars: usize,
}

impl AppConfig {
    pub fn from_env() -> Result<Self> {
        let discord_token =
            env::var("DISCORD_TOKEN").context("DISCORD_TOKEN is required to run the bot")?;
        if discord_token.trim().is_empty() {
            anyhow::bail!("DISCORD_TOKEN cannot be empty");
        }

        let repo_root_raw = env::var("REPO_ROOT").unwrap_or_else(|_| "../..".to_string());
        let repo_root = PathBuf::from(&repo_root_raw)
            .canonicalize()
            .unwrap_or_else(|_| PathBuf::from(repo_root_raw));

        let rag_db_path = PathBuf::from(
            env::var("RAG_DB_PATH").unwrap_or_else(|_| "./data/koma-rag.sqlite".to_string()),
        );

        Ok(Self {
            discord_token: discord_token.trim().to_string(),
            discord_guild_id: parse_opt_u64("DISCORD_GUILD_ID"),
            support_channel_ids: parse_u64_list("SUPPORT_CHANNEL_IDS"),
            mod_log_channel_id: parse_opt_u64("MOD_LOG_CHANNEL_ID"),
            staff_role_ids: parse_u64_list("STAFF_ROLE_IDS"),

            ai_api_base_url: env::var("AI_API_BASE_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:11434/v1".to_string())
                .trim_end_matches('/')
                .to_string(),
            ai_api_key: env::var("AI_API_KEY")
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
            ai_chat_model: env::var("AI_CHAT_MODEL")
                .unwrap_or_else(|_| "qwen2.5-coder:14b".to_string()),
            ai_embed_model: env::var("AI_EMBED_MODEL")
                .unwrap_or_else(|_| "nomic-embed-text".to_string()),
            ai_timeout_secs: parse_u64("AI_TIMEOUT_SECS", 120),

            repo_root,
            rag_db_path,
            rag_top_k: parse_usize("RAG_TOP_K", 8),
            rag_chunk_lines: parse_usize("RAG_CHUNK_LINES", 85).max(20),
            rag_chunk_overlap: parse_usize("RAG_CHUNK_OVERLAP", 15).min(40),

            github_token: env::var("GITHUB_TOKEN")
                .ok()
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
            github_owner: env::var("GITHUB_OWNER").unwrap_or_else(|_| "klaus-2".to_string()),
            github_repo: env::var("GITHUB_REPO").unwrap_or_else(|_| "koma-studio".to_string()),
            github_base_branch: env::var("GITHUB_BASE_BRANCH")
                .unwrap_or_else(|_| "main".to_string()),

            moderation_enabled: parse_bool("MODERATION_ENABLED", true),
            mod_flood_max_msgs: parse_usize("MOD_FLOOD_MAX_MSGS", 6).max(2),
            mod_flood_window_secs: parse_u64("MOD_FLOOD_WINDOW_SECS", 8).max(2),
            mod_max_mentions: parse_usize("MOD_MAX_MENTIONS", 5).max(1),
            mod_block_invites: parse_bool("MOD_BLOCK_INVITES", true),

            bot_statuses: parse_status_list(),
            bot_status_rotate_secs: parse_u64("BOT_STATUS_ROTATE_SECS", 300),
            auto_threads_enabled: parse_bool("AUTO_THREADS_ENABLED", true),
            thread_min_question_chars: parse_usize("THREAD_MIN_QUESTION_CHARS", 80),
            thread_min_answer_chars: parse_usize("THREAD_MIN_ANSWER_CHARS", 450),
        })
    }
}

fn parse_status_list() -> Vec<String> {
    let raw = env::var("BOT_STATUS_TEXT").unwrap_or_else(|_| {
        "KŌMA Studio Support • /ask ou @menção|Dúvidas sobre o KŌMA? Me mencione!|AIO · Cleaner · Typesetter · Translator".to_string()
    });
    raw.split('|')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn parse_opt_u64(key: &str) -> Option<u64> {
    env::var(key)
        .ok()
        .and_then(|v| v.trim().parse::<u64>().ok())
}

fn parse_u64(key: &str, default: u64) -> u64 {
    parse_opt_u64(key).unwrap_or(default)
}

fn parse_usize(key: &str, default: usize) -> usize {
    env::var(key)
        .ok()
        .and_then(|v| v.trim().parse::<usize>().ok())
        .unwrap_or(default)
}

fn parse_bool(key: &str, default: bool) -> bool {
    match env::var(key) {
        Ok(v) => match v.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => true,
            "0" | "false" | "no" | "off" => false,
            _ => default,
        },
        Err(_) => default,
    }
}

fn parse_u64_list(key: &str) -> Vec<u64> {
    env::var(key)
        .unwrap_or_default()
        .split(',')
        .filter_map(|part| part.trim().parse::<u64>().ok())
        .collect()
}
