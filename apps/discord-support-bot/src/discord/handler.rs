use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::Duration;

use serenity::all::{
    ActivityData, AutoArchiveDuration, Channel, ChannelId, ChannelType, Command, Context,
    EventHandler, GuildId, Interaction, Message, OnlineStatus, Ready, UserId,
};
use serenity::async_trait;
use serenity::builder::{CreateEmbed, CreateMessage, CreateThread};
use serenity::model::Colour;
use tracing::{error, info, warn};

use crate::ai::ChatMessage;
use crate::discord::commands::{
    answer_question_with_rag, build_proposal_from_text, handle_component_interaction,
    handle_modal_interaction, handle_slash_command, register_commands_payload,
    render_proposal_buttons, render_proposal_embed,
};
use crate::discord::prompts::{
    build_thread_title, looks_like_bug_or_feature_candidate, should_open_support_thread,
    truncate_chars, ThreadPolicy,
};
use crate::discord::BotState;
use crate::moderation::ModAction;
use crate::rag::sync_repository;

pub struct Handler {
    pub state: Arc<BotState>,
}

#[async_trait]
impl EventHandler for Handler {
    async fn ready(&self, ctx: Context, ready: Ready) {
        info!(
            "Discord bot connected as {} ({})",
            ready.user.name, ready.user.id
        );
        self.state.set_bot_user_id(ready.user.id.get());

        if let Some(first_status) = self.state.config.bot_statuses.first() {
            ctx.set_presence(
                Some(ActivityData::custom(first_status)),
                OnlineStatus::Online,
            );
        }

        if self.state.config.bot_statuses.len() > 1
            && self.state.config.bot_status_rotate_secs > 0
            && !self.state.status_task_started.swap(true, Ordering::AcqRel)
        {
            let statuses = self.state.config.bot_statuses.clone();
            let interval_secs = self.state.config.bot_status_rotate_secs;
            let shard = ctx.shard.clone();
            tokio::spawn(async move {
                let mut idx = 1usize;
                loop {
                    tokio::time::sleep(Duration::from_secs(interval_secs)).await;
                    let text = &statuses[idx % statuses.len()];
                    shard.set_presence(Some(ActivityData::custom(text)), OnlineStatus::Online);
                    idx = idx.wrapping_add(1);
                }
            });
        }

        let commands = register_commands_payload();
        if let Some(guild_id) = self.state.config.discord_guild_id {
            match GuildId::new(guild_id)
                .set_commands(&ctx.http, commands)
                .await
            {
                Ok(registered) => {
                    info!(
                        "Registered {} guild slash commands for guild {guild_id}",
                        registered.len()
                    );
                }
                Err(err) => {
                    error!("Failed registering guild slash commands for {guild_id}: {err:#}");
                }
            }
        } else {
            match Command::set_global_commands(&ctx.http, commands).await {
                Ok(registered) => {
                    info!("Registered {} global slash commands", registered.len());
                }
                Err(err) => {
                    error!("Failed registering global slash commands: {err:#}");
                }
            }
        }

        let state = Arc::clone(&self.state);
        tokio::spawn(async move {
            if let Err(err) = sync_repository(
                Arc::clone(&state.rag),
                Arc::clone(&state.ai),
                &state.config,
                false,
            )
            .await
            {
                warn!("Initial background RAG sync reported error: {err:#}");
            }
        });
    }

    async fn message(&self, ctx: Context, msg: Message) {
        if msg.author.bot {
            return;
        }

        let stored_bot_id = self.state.bot_user_id();
        let bot_id = if stored_bot_id != 0 {
            UserId::new(stored_bot_id)
        } else {
            ctx.cache.current_user().id
        };
        let is_staff = is_message_author_staff(&ctx, &msg, &self.state).await;

        if msg.guild_id.is_some() {
            let decision = self.state.moderator.evaluate_message(
                msg.author.id.get(),
                &msg.content,
                msg.mentions.len(),
                msg.mention_everyone,
                is_staff,
            );

            if decision.action == ModAction::WarnDelete {
                if let Err(err) = msg.delete(&ctx.http).await {
                    warn!("Moderation could not delete message {}: {err}", msg.id);
                }
                let warn_msg = format!(
                    "<@{}>, your message was removed (`{}`): {}",
                    msg.author.id.get(),
                    decision.rule,
                    decision.reason
                );
                let _ = msg.channel_id.say(&ctx.http, warn_msg).await;

                if let Some(log_ch) = self.state.config.mod_log_channel_id {
                    let embed = CreateEmbed::new()
                        .title("Auto-Moderation Action")
                        .description(format!(
                            "**User:** <@{}> (`{}`)\n**Channel:** <#{}>\n**Rule:** `{}`\n**Reason:** {}\n**Snippet:** ```\n{}\n```",
                            msg.author.id.get(),
                            msg.author.id.get(),
                            msg.channel_id.get(),
                            decision.rule,
                            decision.reason,
                            truncate_chars(&msg.content, 400)
                        ))
                        .colour(Colour::from_rgb(255, 46, 99));
                    let _ = ChannelId::new(log_ch)
                        .send_message(&ctx.http, CreateMessage::new().embed(embed))
                        .await;
                }
                return;
            }
        }

        let is_dm = msg.guild_id.is_none();
        let is_support_channel = self
            .state
            .config
            .support_channel_ids
            .contains(&msg.channel_id.get());
        let is_bot_thread = self
            .state
            .rag
            .is_bot_thread(msg.channel_id.get())
            .unwrap_or(false);
        let is_mentioned = is_bot_mentioned(&ctx, &msg, bot_id);
        let is_reply_to_bot = is_message_reply_to_bot(&ctx, &msg, bot_id).await;

        let mentions_other_user_only = !is_mentioned && msg.mentions.iter().any(|u| u.id != bot_id);
        let should_respond = is_dm
            || is_support_channel
            || is_mentioned
            || is_reply_to_bot
            || (is_bot_thread && !mentions_other_user_only);

        if !should_respond {
            return;
        }

        let cleaned = strip_bot_mentions(&msg.content, bot_id);
        if cleaned.is_empty() {
            if is_mentioned || is_reply_to_bot {
                let _ = msg
                    .reply(
                        &ctx.http,
                        "Olá! Como posso ajudar com o **KŌMA Studio**? Pode me enviar sua dúvida aqui, responder minhas mensagens ou usar `/ask` e `/suggest`.",
                    )
                    .await;
            }
            return;
        }

        let typing = msg.channel_id.start_typing(&ctx.http);
        let (answer, chunks) =
            answer_question_with_rag(&self.state, msg.channel_id.get(), &cleaned).await;
        drop(typing);

        let mut reply_text = truncate_chars(&answer, 1750);
        if !chunks.is_empty() {
            let cites: Vec<String> = chunks
                .iter()
                .take(3)
                .map(|c| format!("`{}:{}-{}`", c.file_path, c.start_line, c.end_line))
                .collect();
            reply_text.push_str(&format!("\n\n**Sources:** {}", cites.join(" · ")));
        }

        let is_issue_candidate = looks_like_bug_or_feature_candidate(&cleaned);
        let (is_guild_text_channel, already_in_thread) =
            resolve_channel_thread_state(&ctx, &msg, is_bot_thread).await;

        let open_thread = should_open_support_thread(
            is_guild_text_channel,
            already_in_thread,
            &cleaned,
            &answer,
            is_issue_candidate,
            ThreadPolicy {
                enabled: self.state.config.auto_threads_enabled,
                min_question_chars: self.state.config.thread_min_question_chars,
                min_answer_chars: self.state.config.thread_min_answer_chars,
            },
        );

        let target_channel = if open_thread {
            let title = build_thread_title(&cleaned);
            match msg
                .channel_id
                .create_thread_from_message(
                    &ctx.http,
                    msg.id,
                    CreateThread::new(title)
                        .kind(ChannelType::PublicThread)
                        .auto_archive_duration(AutoArchiveDuration::OneDay),
                )
                .await
            {
                Ok(thread) => {
                    if let Err(err) = self.state.rag.register_thread(thread.id.get()) {
                        warn!("failed registering support thread {}: {err:#}", thread.id);
                    }
                    self.state
                        .push_history(thread.id.get(), ChatMessage::user(cleaned.clone()))
                        .await;
                    self.state
                        .push_history(thread.id.get(), ChatMessage::assistant(answer.clone()))
                        .await;
                    if let Err(err) = thread
                        .id
                        .send_message(
                            &ctx.http,
                            CreateMessage::new().content(truncate_chars(&reply_text, 1980)),
                        )
                        .await
                    {
                        error!("failed sending support reply in new thread: {err:#}");
                        return;
                    }
                    thread.id
                }
                Err(err) => {
                    warn!("could not create support thread (falling back to reply): {err}");
                    if let Err(reply_err) = msg
                        .reply(&ctx.http, truncate_chars(&reply_text, 1980))
                        .await
                    {
                        error!("failed sending support reply: {reply_err:#}");
                        return;
                    }
                    msg.channel_id
                }
            }
        } else {
            if let Err(err) = msg
                .reply(&ctx.http, truncate_chars(&reply_text, 1980))
                .await
            {
                error!("failed sending support reply: {err:#}");
                return;
            }
            msg.channel_id
        };

        if is_issue_candidate {
            if let Ok((true, proposal, similar)) = build_proposal_from_text(
                &self.state,
                &msg.author.id.get().to_string(),
                &target_channel.get().to_string(),
                &cleaned,
                &answer,
                None,
            )
            .await
            {
                let embed = render_proposal_embed(
                    &proposal,
                    &similar,
                    self.state.github.is_configured(),
                    &self.state.github.repo_slug(),
                );
                let buttons =
                    render_proposal_buttons(&proposal.id, self.state.github.is_configured());
                let _ = target_channel
                    .send_message(
                        &ctx.http,
                        CreateMessage::new()
                            .content(format!(
                                "<@{}> This looks like something worth tracking on **{}** — would you like to confirm creating it?",
                                msg.author.id.get(),
                                self.state.github.repo_slug()
                            ))
                            .embed(embed)
                            .components(buttons),
                    )
                    .await;
            }
        }
    }

    async fn interaction_create(&self, ctx: Context, interaction: Interaction) {
        match interaction {
            Interaction::Command(cmd) => {
                handle_slash_command(&ctx, &cmd, Arc::clone(&self.state)).await;
            }
            Interaction::Component(comp) => {
                handle_component_interaction(&ctx, &comp, Arc::clone(&self.state)).await;
            }
            Interaction::Modal(modal) => {
                handle_modal_interaction(&ctx, &modal, Arc::clone(&self.state)).await;
            }
            _ => {}
        }
    }
}

fn is_bot_mentioned(ctx: &Context, msg: &Message, bot_id: UserId) -> bool {
    if msg.mentions.iter().any(|u| u.id == bot_id) {
        return true;
    }
    let raw_a = format!("<@{}>", bot_id.get());
    let raw_b = format!("<@!{}>", bot_id.get());
    if msg.content.contains(&raw_a) || msg.content.contains(&raw_b) {
        return true;
    }
    msg.guild_id.is_some_and(|gid| {
        !msg.mention_roles.is_empty()
            && ctx.cache.guild(gid).is_some_and(|guild| {
                msg.mention_roles.iter().any(|rid| {
                    guild
                        .roles
                        .get(rid)
                        .and_then(|role| role.tags.bot_id)
                        .is_some_and(|role_bot_id| role_bot_id == bot_id)
                })
            })
    })
}

fn strip_bot_mentions(content: &str, bot_id: UserId) -> String {
    content
        .replace(&format!("<@{}>", bot_id.get()), "")
        .replace(&format!("<@!{}>", bot_id.get()), "")
        .trim()
        .to_string()
}

async fn is_message_reply_to_bot(ctx: &Context, msg: &Message, bot_id: UserId) -> bool {
    if let Some(ref_msg) = msg.referenced_message.as_ref() {
        return ref_msg.author.id == bot_id;
    }
    let Some(ref_id) = msg.message_reference.as_ref().and_then(|r| r.message_id) else {
        return false;
    };
    match msg.channel_id.message(&ctx.http, ref_id).await {
        Ok(fetched) => fetched.author.id == bot_id,
        Err(_) => false,
    }
}

async fn resolve_channel_thread_state(
    ctx: &Context,
    msg: &Message,
    known_bot_thread: bool,
) -> (bool, bool) {
    if known_bot_thread {
        return (false, true);
    }
    let Some(_guild_id) = msg.guild_id else {
        return (false, false);
    };
    match msg.channel(&ctx.http).await {
        Ok(Channel::Guild(gc)) => {
            let is_thread = matches!(
                gc.kind,
                ChannelType::PublicThread | ChannelType::PrivateThread | ChannelType::NewsThread
            );
            (gc.kind == ChannelType::Text && !is_thread, is_thread)
        }
        _ => (false, false),
    }
}

async fn is_message_author_staff(ctx: &Context, msg: &Message, state: &BotState) -> bool {
    let Some(guild_id) = msg.guild_id else {
        return false;
    };
    if let Ok(member) = guild_id.member(&ctx.http, msg.author.id).await {
        if member
            .roles
            .iter()
            .any(|r| state.config.staff_role_ids.contains(&r.get()))
        {
            return true;
        }
        if let Some(perms) = member.permissions {
            if perms.administrator() || perms.manage_messages() {
                return true;
            }
        }
    }
    false
}
