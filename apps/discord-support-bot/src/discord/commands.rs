use std::sync::Arc;

use anyhow::Result;
use serenity::all::{
    ButtonStyle, CommandInteraction, CommandOptionType, ComponentInteraction, Context,
    ModalInteraction, ResolvedOption, ResolvedValue,
};
use serenity::builder::{
    CreateActionRow, CreateButton, CreateCommand, CreateCommandOption, CreateEmbed,
    CreateEmbedFooter, CreateInputText, CreateInteractionResponse,
    CreateInteractionResponseMessage, CreateModal, EditInteractionResponse,
};
use serenity::model::application::ActionRowComponent;
use serenity::model::application::InputTextStyle;
use serenity::model::Colour;
use tracing::{error, info};

use crate::ai::ChatMessage;
use crate::discord::prompts::{build_support_messages, truncate_chars};
use crate::discord::BotState;
use crate::github::evaluate_viability;
use crate::rag::{sync_repository, PendingProposal, ProposalKind, RetrievedChunk};

pub fn register_commands_payload() -> Vec<CreateCommand> {
    vec![
        CreateCommand::new("ask")
            .description("Ask KŌMA Assistant a technical question grounded in the koma-studio repo")
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::String,
                    "question",
                    "Your question about KŌMA Studio features, setup, architecture, or bugs",
                )
                .required(true),
            )
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::Boolean,
                    "private",
                    "Send the reply ephemerally so only you can see it",
                )
                .required(false),
            ),
        CreateCommand::new("search")
            .description("Search the KŌMA Studio codebase and docs directly via hybrid FTS5 + vector RAG")
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::String,
                    "query",
                    "Keywords, symbol name, error message, or file topic",
                )
                .required(true),
            )
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::Integer,
                    "limit",
                    "Max snippets to return (1-10)",
                )
                .min_int_value(1)
                .max_int_value(10)
                .required(false),
            ),
        CreateCommand::new("suggest")
            .description("Evaluate a bug report or feature idea and optionally submit an Issue or Draft PR to GitHub")
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::String,
                    "description",
                    "Describe the bug, reproduction steps, or improvement idea",
                )
                .required(true),
            )
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::String,
                    "type",
                    "Preferred GitHub submission type",
                )
                .add_string_choice("Auto / Issue", "issue")
                .add_string_choice("Draft Pull Request", "draft_pr")
                .required(false),
            ),
        CreateCommand::new("status")
            .description("Show AI model health, RAG index coverage, GitHub status, and uptime"),
        CreateCommand::new("reindex")
            .description("[Staff] Re-index the KŌMA Studio repository for RAG")
            .add_option(
                CreateCommandOption::new(
                    CommandOptionType::Boolean,
                    "force",
                    "Recompute all chunks & embeddings even if file hashes match",
                )
                .required(false),
            ),
        CreateCommand::new("modstatus")
            .description("[Staff] Show moderation filter configuration and live counters"),
    ]
}

pub async fn handle_slash_command(ctx: &Context, cmd: &CommandInteraction, state: Arc<BotState>) {
    let result = match cmd.data.name.as_str() {
        "ask" => handle_ask(ctx, cmd, &state).await,
        "search" => handle_search(ctx, cmd, &state).await,
        "suggest" => handle_suggest(ctx, cmd, &state).await,
        "status" => handle_status(ctx, cmd, &state).await,
        "reindex" => handle_reindex(ctx, cmd, &state).await,
        "modstatus" => handle_modstatus(ctx, cmd, &state).await,
        other => {
            let _ = cmd
                .create_response(
                    &ctx.http,
                    CreateInteractionResponse::Message(
                        CreateInteractionResponseMessage::new()
                            .ephemeral(true)
                            .content(format!("Unknown command: `{other}`")),
                    ),
                )
                .await;
            Ok(())
        }
    };

    if let Err(err) = result {
        error!("error executing slash command /{}: {err:#}", cmd.data.name);
        let _ = cmd
            .edit_response(
                &ctx.http,
                EditInteractionResponse::new()
                    .content(format!("Command failed cleanly with error: `{err}`")),
            )
            .await;
    }
}

pub async fn answer_question_with_rag(
    state: &BotState,
    channel_id: u64,
    question: &str,
) -> (String, Vec<RetrievedChunk>) {
    let query_vec = state
        .ai
        .embed_batch(&[question.to_string()])
        .await
        .ok()
        .and_then(|mut v| v.pop());

    let chunks = state
        .rag
        .hybrid_search(question, query_vec.as_deref(), state.config.rag_top_k)
        .unwrap_or_default();

    let history = state.recent_history(channel_id).await;
    let messages = build_support_messages(question, &history, &chunks);

    let answer = match state.ai.chat(&messages, 0.25, 1100).await {
        Ok(reply) => {
            state
                .push_history(channel_id, ChatMessage::user(question.to_string()))
                .await;
            state
                .push_history(channel_id, ChatMessage::assistant(reply.clone()))
                .await;
            reply
        }
        Err(err) => {
            if chunks.is_empty() {
                format!(
                    "The local AI endpoint (`{}`) is currently unreachable (`{err}`), and no matching snippets were found in the RAG index.",
                    state.ai.base_url()
                )
            } else {
                let fallback_refs = chunks
                    .iter()
                    .take(4)
                    .map(|c| format!("- `{}` (L{}-{})", c.file_path, c.start_line, c.end_line))
                    .collect::<Vec<_>>()
                    .join("\n");
                format!(
                    "The local AI chat model is currently offline (`{err}`), so here are the most relevant repository sections I found:\n{fallback_refs}"
                )
            }
        }
    };

    (answer, chunks)
}

pub async fn build_proposal_from_text(
    state: &BotState,
    requester_id: &str,
    channel_id: &str,
    description: &str,
    conversation_context: &str,
    preferred_kind: Option<ProposalKind>,
) -> Result<(bool, PendingProposal, Vec<crate::github::ExistingIssue>)> {
    let query_vec = state
        .ai
        .embed_batch(&[description.to_string()])
        .await
        .ok()
        .and_then(|mut v| v.pop());
    let chunks = state
        .rag
        .hybrid_search(description, query_vec.as_deref(), 6)
        .unwrap_or_default();

    let assessment = evaluate_viability(
        &state.ai,
        description,
        conversation_context,
        &chunks,
        preferred_kind,
    )
    .await;

    let is_viable = assessment.viable && assessment.confidence >= 0.5;

    let similar = if is_viable {
        state
            .github
            .search_similar_issues(&assessment.suggested_title)
            .await
            .unwrap_or_default()
    } else {
        Vec::new()
    };

    let proposal = PendingProposal {
        id: uuid::Uuid::new_v4().to_string(),
        kind: assessment.proposal_kind(),
        requester_id: requester_id.to_string(),
        channel_id: channel_id.to_string(),
        title: truncate_chars(&assessment.suggested_title, 180),
        summary: truncate_chars(&assessment.summary, 400),
        body: truncate_chars(&assessment.markdown_body, 3200),
        labels: assessment.labels.into_iter().take(6).collect(),
        file_path: assessment.target_file,
        file_content: assessment.proposed_file_patch,
        viability_reason: truncate_chars(&assessment.reason, 400),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    if is_viable {
        state.rag.save_proposal(&proposal)?;
    }

    Ok((is_viable, proposal, similar))
}

pub fn render_proposal_embed(
    proposal: &PendingProposal,
    similar: &[crate::github::ExistingIssue],
    github_configured: bool,
    repo_slug: &str,
) -> CreateEmbed {
    let kind_label = match proposal.kind {
        ProposalKind::Issue => "GitHub Issue Proposal",
        ProposalKind::DraftPr => "GitHub Draft PR Proposal",
    };

    let mut desc = format!(
        "**Title:** {}\n**Target:** `{}`\n\n**Why it looks viable:** {}\n\n**Preview:**\n{}",
        proposal.title,
        repo_slug,
        proposal.viability_reason,
        truncate_chars(&proposal.body, 900)
    );

    if !similar.is_empty() {
        desc.push_str("\n\n**Similar existing issues/PRs found (check before confirming):**\n");
        for item in similar.iter().take(3) {
            let tag = if item.is_pr { "PR" } else { "Issue" };
            desc.push_str(&format!(
                "- [{tag} #{} ({})]({}): {}\n",
                item.number,
                item.state,
                item.html_url,
                truncate_chars(&item.title, 70)
            ));
        }
    }

    if !github_configured {
        desc.push_str("\n\n⚠️ *Note: `GITHUB_TOKEN` is currently unset on the bot, so publishing will remain disabled until configured.*");
    }

    CreateEmbed::new()
        .title(kind_label)
        .description(truncate_chars(&desc, 3800))
        .colour(Colour::from_rgb(255, 46, 99))
        .footer(CreateEmbedFooter::new(format!(
            "Proposal {} • Requires explicit requester confirmation",
            &proposal.id[..8.min(proposal.id.len())]
        )))
}

pub fn render_proposal_buttons(proposal_id: &str, github_configured: bool) -> Vec<CreateActionRow> {
    vec![CreateActionRow::Buttons(vec![
        CreateButton::new(format!("gh_confirm_issue:{proposal_id}"))
            .label("Confirm Issue")
            .style(ButtonStyle::Success)
            .disabled(!github_configured),
        CreateButton::new(format!("gh_confirm_pr:{proposal_id}"))
            .label("Confirm Draft PR")
            .style(ButtonStyle::Primary)
            .disabled(!github_configured),
        CreateButton::new(format!("gh_edit:{proposal_id}"))
            .label("Edit Details")
            .style(ButtonStyle::Secondary),
        CreateButton::new(format!("gh_cancel:{proposal_id}"))
            .label("Cancel")
            .style(ButtonStyle::Danger),
    ])]
}

async fn handle_ask(ctx: &Context, cmd: &CommandInteraction, state: &BotState) -> Result<()> {
    let options = cmd.data.options();
    let question = get_str_opt(&options, "question").unwrap_or_default();
    let ephemeral = get_bool_opt(&options, "private").unwrap_or(false);

    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Defer(
            CreateInteractionResponseMessage::new().ephemeral(ephemeral),
        ),
    )
    .await?;

    let (answer, chunks) = answer_question_with_rag(state, cmd.channel_id.get(), &question).await;

    let sources = if chunks.is_empty() {
        "No matching repository files.".to_string()
    } else {
        chunks
            .iter()
            .take(4)
            .map(|c| format!("• `{}` (L{}-{})", c.file_path, c.start_line, c.end_line))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let embed = CreateEmbed::new()
        .title("KŌMA Technical Support")
        .description(truncate_chars(&answer, 3900))
        .field("Referenced Files", truncate_chars(&sources, 1000), false)
        .colour(Colour::from_rgb(77, 201, 255));

    let mut edit = EditInteractionResponse::new().embed(embed);

    if crate::discord::prompts::looks_like_bug_or_feature_candidate(&question) {
        if let Ok((true, proposal, _similar)) = build_proposal_from_text(
            state,
            &cmd.user.id.get().to_string(),
            &cmd.channel_id.get().to_string(),
            &question,
            &answer,
            None,
        )
        .await
        {
            edit = edit.components(vec![CreateActionRow::Buttons(vec![
                CreateButton::new(format!("gh_confirm_issue:{}", proposal.id))
                    .label("Suggest as GitHub Issue")
                    .style(ButtonStyle::Secondary)
                    .disabled(!state.github.is_configured()),
                CreateButton::new(format!("gh_edit:{}", proposal.id))
                    .label("Review / Edit Proposal")
                    .style(ButtonStyle::Primary),
                CreateButton::new(format!("gh_cancel:{}", proposal.id))
                    .label("Dismiss")
                    .style(ButtonStyle::Danger),
            ])]);
        }
    }

    cmd.edit_response(&ctx.http, edit).await?;
    Ok(())
}

async fn handle_search(ctx: &Context, cmd: &CommandInteraction, state: &BotState) -> Result<()> {
    let options = cmd.data.options();
    let query = get_str_opt(&options, "query").unwrap_or_default();
    let limit = get_int_opt(&options, "limit").unwrap_or(5).clamp(1, 10) as usize;

    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Defer(CreateInteractionResponseMessage::new()),
    )
    .await?;

    let query_vec = state
        .ai
        .embed_batch(std::slice::from_ref(&query))
        .await
        .ok()
        .and_then(|mut v| v.pop());

    let chunks = state
        .rag
        .hybrid_search(&query, query_vec.as_deref(), limit)?;
    let embed = if chunks.is_empty() {
        CreateEmbed::new()
            .title("KŌMA Codebase Search")
            .description(format!("No indexed snippets matched `{query}`."))
            .colour(Colour::from_rgb(255, 200, 87))
    } else {
        let mut e = CreateEmbed::new()
            .title(format!(
                "KŌMA Codebase Search • `{}`",
                truncate_chars(&query, 60)
            ))
            .colour(Colour::from_rgb(62, 242, 176));
        for chunk in chunks.iter().take(limit) {
            let preview: String = chunk.content.lines().take(5).collect::<Vec<_>>().join("\n");
            let sym = chunk
                .symbol
                .as_deref()
                .map(|s| format!(" • `{s}`"))
                .unwrap_or_default();
            e = e.field(
                format!(
                    "`{}` (L{}-{}){}",
                    chunk.file_path, chunk.start_line, chunk.end_line, sym
                ),
                format!("```\n{}\n```", truncate_chars(&preview, 320)),
                false,
            );
        }
        e
    };

    cmd.edit_response(&ctx.http, EditInteractionResponse::new().embed(embed))
        .await?;
    Ok(())
}

async fn handle_suggest(ctx: &Context, cmd: &CommandInteraction, state: &BotState) -> Result<()> {
    let options = cmd.data.options();
    let description = get_str_opt(&options, "description").unwrap_or_default();
    let preferred = get_str_opt(&options, "type").map(|s| ProposalKind::from_str_lossy(&s));

    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Defer(CreateInteractionResponseMessage::new()),
    )
    .await?;

    let (viable, proposal, similar) = build_proposal_from_text(
        state,
        &cmd.user.id.get().to_string(),
        &cmd.channel_id.get().to_string(),
        &description,
        "",
        preferred,
    )
    .await?;

    if !viable {
        let embed = CreateEmbed::new()
            .title("GitHub Proposal Not Submitted")
            .description(format!(
                "After reviewing this against KŌMA Studio's repository context, it doesn't look ready or actionable enough for GitHub yet.\n\n**Reason:** {}\n\nFeel free to share reproduction steps, screenshots/logs, or specific component details and try `/suggest` again!",
                proposal.viability_reason
            ))
            .colour(Colour::from_rgb(255, 200, 87));
        cmd.edit_response(&ctx.http, EditInteractionResponse::new().embed(embed))
            .await?;
        return Ok(());
    }

    let embed = render_proposal_embed(
        &proposal,
        &similar,
        state.github.is_configured(),
        &state.github.repo_slug(),
    );
    let buttons = render_proposal_buttons(&proposal.id, state.github.is_configured());
    cmd.edit_response(
        &ctx.http,
        EditInteractionResponse::new()
            .embed(embed)
            .components(buttons),
    )
    .await?;
    Ok(())
}

async fn handle_status(ctx: &Context, cmd: &CommandInteraction, state: &BotState) -> Result<()> {
    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Defer(CreateInteractionResponseMessage::new()),
    )
    .await?;

    let health = state.ai.health_check().await;
    let stats = state.rag.stats()?;
    let mod_stats = state.moderator.stats();
    let uptime_secs = state.started_at.elapsed().as_secs();

    let ai_summary = if health.reachable {
        format!(
            "Online (`{}` • {} models loaded)\nChat: `{}`\nEmbed: `{}`",
            state.ai.base_url(),
            health.models_count,
            state.ai.chat_model(),
            state.ai.embed_model()
        )
    } else {
        format!(
            "Offline (`{}` • {})\nChat: `{}`\nEmbed: `{}`",
            state.ai.base_url(),
            health.error.as_deref().unwrap_or("unreachable"),
            state.ai.chat_model(),
            state.ai.embed_model()
        )
    };

    let embed = CreateEmbed::new()
        .title("KŌMA Support Bot Status")
        .colour(if health.reachable {
            Colour::from_rgb(62, 242, 176)
        } else {
            Colour::from_rgb(255, 200, 87)
        })
        .field("Local AI API", ai_summary, false)
        .field(
            "SQLite Hybrid RAG",
            format!(
                "Files: `{}` • Chunks: `{}` • Vector Embeddings: `{}`",
                stats.files_count, stats.chunks_count, stats.embedded_chunks_count
            ),
            false,
        )
        .field(
            "GitHub Integration",
            format!(
                "Repo: `{}` • Token: `{}`",
                state.github.repo_slug(),
                if state.github.is_configured() {
                    "Configured (Issues + Draft PRs)"
                } else {
                    "Disabled (missing GITHUB_TOKEN)"
                }
            ),
            true,
        )
        .field(
            "Moderation & Uptime",
            format!(
                "Enabled: `{}` • Checked: `{}` • Uptime: `{}m {}s`",
                mod_stats.enabled,
                mod_stats.messages_checked,
                uptime_secs / 60,
                uptime_secs % 60
            ),
            true,
        );

    cmd.edit_response(&ctx.http, EditInteractionResponse::new().embed(embed))
        .await?;
    Ok(())
}

async fn handle_reindex(
    ctx: &Context,
    cmd: &CommandInteraction,
    state: &Arc<BotState>,
) -> Result<()> {
    if !is_staff_member(cmd, &state.config.staff_role_ids) {
        cmd.create_response(
            &ctx.http,
            CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .ephemeral(true)
                    .content("Only configured staff members or server admins can run `/reindex`."),
            ),
        )
        .await?;
        return Ok(());
    }

    let force = get_bool_opt(&cmd.data.options(), "force").unwrap_or(false);
    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Defer(CreateInteractionResponseMessage::new().ephemeral(true)),
    )
    .await?;

    let report = sync_repository(
        Arc::clone(&state.rag),
        Arc::clone(&state.ai),
        &state.config,
        force,
    )
    .await?;

    let msg = format!(
        "Repository RAG re-index finished:\n• Scanned: `{}` files\n• Updated: `{}` (`{}` chunks)\n• Unchanged skipped: `{}`\n• Removed stale: `{}`\n• Embeddings enabled: `{}`",
        report.scanned_files,
        report.updated_files,
        report.indexed_chunks,
        report.skipped_unchanged,
        report.removed_files,
        report.embeddings_enabled
    );
    cmd.edit_response(&ctx.http, EditInteractionResponse::new().content(msg))
        .await?;
    Ok(())
}

async fn handle_modstatus(ctx: &Context, cmd: &CommandInteraction, state: &BotState) -> Result<()> {
    if !is_staff_member(cmd, &state.config.staff_role_ids) {
        cmd.create_response(
            &ctx.http,
            CreateInteractionResponse::Message(
                CreateInteractionResponseMessage::new()
                    .ephemeral(true)
                    .content(
                        "Only configured staff members or server admins can run `/modstatus`.",
                    ),
            ),
        )
        .await?;
        return Ok(());
    }

    let s = state.moderator.stats();
    let embed = CreateEmbed::new()
        .title("Moderation Status")
        .description(format!(
            "Enabled: `{}`\nChecked messages: `{}`\nFlood actions: `{}`\nBlocked invites: `{}`\nPhishing blocks: `{}`\nMass-mention blocks: `{}`",
            s.enabled,
            s.messages_checked,
            s.flagged_flood,
            s.flagged_invites,
            s.flagged_phishing,
            s.flagged_mentions
        ))
        .colour(Colour::from_rgb(77, 201, 255));

    cmd.create_response(
        &ctx.http,
        CreateInteractionResponse::Message(
            CreateInteractionResponseMessage::new()
                .ephemeral(true)
                .embed(embed),
        ),
    )
    .await?;
    Ok(())
}

pub async fn handle_component_interaction(
    ctx: &Context,
    comp: &ComponentInteraction,
    state: Arc<BotState>,
) {
    let custom_id = comp.data.custom_id.as_str();
    let Some((action, proposal_id)) = custom_id.split_once(':') else {
        return;
    };

    let Ok(Some(proposal)) = state.rag.get_proposal(proposal_id) else {
        let _ = comp
            .create_response(
                &ctx.http,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .ephemeral(true)
                        .content(
                        "This GitHub proposal has already been processed, canceled, or expired.",
                    ),
                ),
            )
            .await;
        return;
    };

    let actor_id = comp.user.id.get().to_string();
    let is_staff = comp
        .member
        .as_ref()
        .map(|m| {
            m.roles
                .iter()
                .any(|r| state.config.staff_role_ids.contains(&r.get()))
                || m.permissions
                    .map(|p| p.manage_messages() || p.administrator())
                    .unwrap_or(false)
        })
        .unwrap_or(false);

    if actor_id != proposal.requester_id && !is_staff {
        let _ = comp
            .create_response(
                &ctx.http,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .ephemeral(true)
                        .content("Only the user who initiated this proposal (or staff) can confirm, edit, or cancel it."),
                ),
            )
            .await;
        return;
    }

    match action {
        "gh_cancel" => {
            let _ = state.rag.delete_proposal(proposal_id);
            let _ = comp
                .create_response(
                    &ctx.http,
                    CreateInteractionResponse::UpdateMessage(
                        CreateInteractionResponseMessage::new()
                            .embed(
                                CreateEmbed::new()
                                    .title("Proposal Canceled")
                                    .description(format!(
                                        "Canceled by <@{}> without sending anything to GitHub.",
                                        comp.user.id.get()
                                    ))
                                    .colour(Colour::from_rgb(122, 128, 137)),
                            )
                            .components(Vec::new()),
                    ),
                )
                .await;
        }
        "gh_edit" => {
            let modal = CreateModal::new(
                format!("gh_edit_modal:{proposal_id}"),
                "Edit GitHub Proposal",
            )
            .components(vec![
                CreateActionRow::InputText(
                    CreateInputText::new(InputTextStyle::Short, "Title", "title")
                        .value(&proposal.title)
                        .required(true)
                        .max_length(180),
                ),
                CreateActionRow::InputText(
                    CreateInputText::new(
                        InputTextStyle::Paragraph,
                        "Description (Markdown)",
                        "body",
                    )
                    .value(truncate_chars(&proposal.body, 3000))
                    .required(true)
                    .max_length(3500),
                ),
            ]);
            if let Err(err) = comp
                .create_response(&ctx.http, CreateInteractionResponse::Modal(modal))
                .await
            {
                error!("failed opening GitHub proposal edit modal: {err:#}");
            }
        }
        "gh_confirm_issue" | "gh_confirm_pr" => {
            if let Err(err) = comp
                .create_response(&ctx.http, CreateInteractionResponse::Acknowledge)
                .await
            {
                error!("failed acknowledging confirmation click: {err:#}");
                return;
            }

            let body_with_attribution = format!(
                "{}\n\n---\n_Confirmed on Discord by user `{}` (`{}`)._",
                proposal.body, comp.user.name, comp.user.id
            );

            let outcome = if action == "gh_confirm_pr" {
                state
                    .github
                    .create_draft_pr(
                        &proposal.id,
                        &proposal.title,
                        &body_with_attribution,
                        proposal.file_path.as_deref(),
                        proposal.file_content.as_deref(),
                    )
                    .await
            } else {
                state
                    .github
                    .create_issue(&proposal.title, &body_with_attribution, &proposal.labels)
                    .await
            };

            match outcome {
                Ok(created) => {
                    let _ = state.rag.delete_proposal(proposal_id);
                    info!(
                        "published GitHub item #{} via confirmation: {}",
                        created.number, created.html_url
                    );
                    let heading = if action == "gh_confirm_pr" {
                        format!("Draft PR #{} Created", created.number)
                    } else {
                        format!("Issue #{} Created", created.number)
                    };
                    let mut details = format!(
                        "**Title:** {}\n**URL:** {}\nConfirmed by <@{}>.",
                        proposal.title,
                        created.html_url,
                        comp.user.id.get()
                    );
                    if let Some(branch) = created.branch_name {
                        details.push_str(&format!("\n**Branch:** `{branch}`"));
                    }
                    let _ = comp
                        .edit_response(
                            &ctx.http,
                            EditInteractionResponse::new()
                                .embed(
                                    CreateEmbed::new()
                                        .title(heading)
                                        .description(details)
                                        .colour(Colour::from_rgb(62, 242, 176)),
                                )
                                .components(Vec::new()),
                        )
                        .await;
                }
                Err(err) => {
                    error!("GitHub submission error: {err:#}");
                    let _ = comp
                        .edit_response(
                            &ctx.http,
                            EditInteractionResponse::new().embed(
                                CreateEmbed::new()
                                    .title("GitHub Submission Failed")
                                    .description(format!(
                                        "Could not publish `{}` to GitHub:\n`{err}`\n\nYou can edit and retry below or cancel.",
                                        proposal.title
                                    ))
                                    .colour(Colour::from_rgb(255, 46, 99)),
                            ),
                        )
                        .await;
                }
            }
        }
        _ => {}
    }
}

pub async fn handle_modal_interaction(
    ctx: &Context,
    modal: &ModalInteraction,
    state: Arc<BotState>,
) {
    let Some(proposal_id) = modal.data.custom_id.strip_prefix("gh_edit_modal:") else {
        return;
    };

    let Ok(Some(mut proposal)) = state.rag.get_proposal(proposal_id) else {
        let _ = modal
            .create_response(
                &ctx.http,
                CreateInteractionResponse::Message(
                    CreateInteractionResponseMessage::new()
                        .ephemeral(true)
                        .content("Proposal no longer exists."),
                ),
            )
            .await;
        return;
    };

    for row in &modal.data.components {
        for component in &row.components {
            if let ActionRowComponent::InputText(input) = component {
                if input.custom_id == "title" {
                    if let Some(val) = input.value.as_ref().filter(|s| !s.trim().is_empty()) {
                        proposal.title = truncate_chars(val.trim(), 180);
                    }
                } else if input.custom_id == "body" {
                    if let Some(val) = input.value.as_ref().filter(|s| !s.trim().is_empty()) {
                        proposal.body = truncate_chars(val.trim(), 3200);
                    }
                }
            }
        }
    }

    if let Err(err) = state.rag.save_proposal(&proposal) {
        error!("failed saving edited proposal: {err:#}");
    }

    let embed = render_proposal_embed(
        &proposal,
        &[],
        state.github.is_configured(),
        &state.github.repo_slug(),
    );
    let buttons = render_proposal_buttons(&proposal.id, state.github.is_configured());
    let _ = modal
        .create_response(
            &ctx.http,
            CreateInteractionResponse::UpdateMessage(
                CreateInteractionResponseMessage::new()
                    .embed(embed)
                    .components(buttons),
            ),
        )
        .await;
}

fn is_staff_member(cmd: &CommandInteraction, staff_role_ids: &[u64]) -> bool {
    let Some(member) = cmd.member.as_ref() else {
        return false;
    };
    if member
        .permissions
        .map(|p| p.administrator() || p.manage_messages())
        .unwrap_or(false)
    {
        return true;
    }
    member
        .roles
        .iter()
        .any(|r| staff_role_ids.contains(&r.get()))
}

fn get_str_opt(options: &[ResolvedOption<'_>], name: &str) -> Option<String> {
    options.iter().find_map(|opt| {
        if opt.name == name {
            if let ResolvedValue::String(s) = opt.value {
                return Some(s.to_string());
            }
        }
        None
    })
}

fn get_bool_opt(options: &[ResolvedOption<'_>], name: &str) -> Option<bool> {
    options.iter().find_map(|opt| {
        if opt.name == name {
            if let ResolvedValue::Boolean(b) = opt.value {
                return Some(b);
            }
        }
        None
    })
}

fn get_int_opt(options: &[ResolvedOption<'_>], name: &str) -> Option<i64> {
    options.iter().find_map(|opt| {
        if opt.name == name {
            if let ResolvedValue::Integer(v) = opt.value {
                return Some(v);
            }
        }
        None
    })
}
