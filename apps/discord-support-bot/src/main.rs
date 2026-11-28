mod ai;
mod config;
mod discord;
mod github;
mod moderation;
mod rag;

use std::sync::Arc;

use anyhow::Result;
use serenity::all::GatewayIntents;
use serenity::Client;
use tracing::{error, info};

use crate::ai::AiClient;
use crate::config::AppConfig;
use crate::discord::handler::Handler;
use crate::discord::BotState;
use crate::github::GitHubClient;
use crate::moderation::Moderator;
use crate::rag::RagStore;

#[tokio::main]
async fn main() -> Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,koma_discord_support_bot=debug".into()),
        )
        .init();

    let cfg = AppConfig::from_env()?;
    info!(
        "Starting KŌMA Support Bot (Serenity) | repo={} | ai={} ({}) | github={}/{}",
        cfg.repo_root.display(),
        cfg.ai_api_base_url,
        cfg.ai_chat_model,
        cfg.github_owner,
        cfg.github_repo
    );

    let ai = Arc::new(AiClient::new(
        cfg.ai_api_base_url.clone(),
        cfg.ai_api_key.clone(),
        cfg.ai_chat_model.clone(),
        cfg.ai_embed_model.clone(),
        cfg.ai_timeout_secs,
    )?);

    let rag = Arc::new(RagStore::open(&cfg.rag_db_path)?);
    let github = Arc::new(GitHubClient::new(
        cfg.github_token.clone(),
        cfg.github_owner.clone(),
        cfg.github_repo.clone(),
        cfg.github_base_branch.clone(),
    )?);
    let moderator = Arc::new(Moderator::new(
        cfg.moderation_enabled,
        cfg.mod_flood_max_msgs,
        cfg.mod_flood_window_secs,
        cfg.mod_max_mentions,
        cfg.mod_block_invites,
    ));

    let state = Arc::new(BotState::new(cfg.clone(), ai, rag, github, moderator));

    let intents = GatewayIntents::GUILD_MESSAGES
        | GatewayIntents::DIRECT_MESSAGES
        | GatewayIntents::MESSAGE_CONTENT
        | GatewayIntents::GUILDS;

    let mut client = Client::builder(&cfg.discord_token, intents)
        .event_handler(Handler {
            state: Arc::clone(&state),
        })
        .await?;

    let shard_manager = client.shard_manager.clone();
    tokio::spawn(async move {
        if tokio::signal::ctrl_c().await.is_ok() {
            info!("Shutdown signal received, closing Discord shards...");
            shard_manager.shutdown_all().await;
        }
    });

    if let Err(err) = client.start().await {
        error!("Discord client stopped with error: {err:#}");
        return Err(err.into());
    }

    Ok(())
}
