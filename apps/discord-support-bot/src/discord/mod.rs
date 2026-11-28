pub mod commands;
pub mod handler;
pub mod prompts;

use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;

use tokio::sync::Mutex;

use crate::ai::{AiClient, ChatMessage};
use crate::config::AppConfig;
use crate::github::GitHubClient;
use crate::moderation::Moderator;
use crate::rag::RagStore;

pub struct BotState {
    pub config: AppConfig,
    pub ai: Arc<AiClient>,
    pub rag: Arc<RagStore>,
    pub github: Arc<GitHubClient>,
    pub moderator: Arc<Moderator>,
    pub started_at: Instant,
    pub channel_memory: Mutex<HashMap<u64, VecDeque<ChatMessage>>>,
    pub bot_user_id: AtomicU64,
    pub status_task_started: AtomicBool,
}

impl BotState {
    pub fn new(
        config: AppConfig,
        ai: Arc<AiClient>,
        rag: Arc<RagStore>,
        github: Arc<GitHubClient>,
        moderator: Arc<Moderator>,
    ) -> Self {
        Self {
            config,
            ai,
            rag,
            github,
            moderator,
            started_at: Instant::now(),
            channel_memory: Mutex::new(HashMap::new()),
            bot_user_id: AtomicU64::new(0),
            status_task_started: AtomicBool::new(false),
        }
    }

    pub fn set_bot_user_id(&self, id: u64) {
        self.bot_user_id.store(id, Ordering::Release);
    }

    pub fn bot_user_id(&self) -> u64 {
        self.bot_user_id.load(Ordering::Acquire)
    }

    pub async fn recent_history(&self, channel_id: u64) -> Vec<ChatMessage> {
        let guard = self.channel_memory.lock().await;
        guard
            .get(&channel_id)
            .map(|q| q.iter().cloned().collect())
            .unwrap_or_default()
    }

    pub async fn push_history(&self, channel_id: u64, msg: ChatMessage) {
        let mut guard = self.channel_memory.lock().await;
        let q = guard.entry(channel_id).or_default();
        if q.len() >= 10 {
            q.pop_front();
        }
        q.push_back(msg);
    }
}
