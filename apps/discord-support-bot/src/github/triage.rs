use serde::Deserialize;

use crate::ai::{AiClient, ChatMessage};
use crate::rag::{ProposalKind, RetrievedChunk};

#[derive(Debug, Clone, Deserialize)]
pub struct ViabilityAssessment {
    pub viable: bool,
    #[serde(default = "default_kind")]
    pub kind: String,
    #[serde(default)]
    pub confidence: f32,
    #[serde(default)]
    pub reason: String,
    #[serde(default)]
    pub suggested_title: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub markdown_body: String,
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default)]
    pub target_file: Option<String>,
    #[serde(default)]
    pub proposed_file_patch: Option<String>,
}

fn default_kind() -> String {
    "issue".to_string()
}

impl ViabilityAssessment {
    pub fn proposal_kind(&self) -> ProposalKind {
        ProposalKind::from_str_lossy(&self.kind)
    }

    pub fn fallback_unavailable(description: &str, preferred_kind: Option<ProposalKind>) -> Self {
        let title_preview: String = description
            .lines()
            .next()
            .unwrap_or("KŌMA Studio Feedback")
            .chars()
            .take(80)
            .collect();
        let kind = preferred_kind.unwrap_or(ProposalKind::Issue);
        Self {
            viable: description.split_whitespace().count() >= 5,
            kind: kind.as_str().to_string(),
            confidence: 0.55,
            reason: "Evaluated with local heuristic fallback (AI triage endpoint offline)."
                .to_string(),
            suggested_title: format!("[Community] {title_preview}"),
            summary: description.chars().take(240).collect(),
            markdown_body: format!(
                "### Description\n{description}\n\n_Submitted via KŌMA Discord Support Bot (user confirmed)._"
            ),
            labels: vec!["community".to_string()],
            target_file: None,
            proposed_file_patch: None,
        }
    }
}

pub async fn evaluate_viability(
    ai: &AiClient,
    user_message: &str,
    conversation_context: &str,
    rag_chunks: &[RetrievedChunk],
    preferred_kind: Option<ProposalKind>,
) -> ViabilityAssessment {
    let rag_context = if rag_chunks.is_empty() {
        "No matching repository chunks found.".to_string()
    } else {
        rag_chunks
            .iter()
            .take(5)
            .map(|c| {
                let preview: String = c.content.chars().take(400).collect();
                format!(
                    "- `{}` (L{}-{}, area={}):\n```\n{}\n```",
                    c.file_path, c.start_line, c.end_line, c.area, preview
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    let preferred_hint = match preferred_kind {
        Some(ProposalKind::Issue) => "User explicitly expressed interest in an Issue.",
        Some(ProposalKind::DraftPr) => "User explicitly expressed interest in a Draft PR.",
        None => "Choose \"issue\" or \"draft_pr\" depending on clarity and specificity.",
    };

    let system = concat!(
        "You are a strict KŌMA Studio Maintainer triaging whether a Discord user's message should become a GitHub Issue or Draft PR on klaus-2/koma-studio.\n",
        "Reject vague greetings, off-topic chat, user typos/config misunderstandings already answered cleanly in docs, or non-actionable rants (set viable=false, kind=\"none\").\n",
        "Accept reproducible bugs, genuine UX/theme flaws, concrete feature requests, or clear documentation/code improvements (viable=true).\n",
        "Respond ONLY with a single JSON object with keys:\n",
        "viable (bool), kind (\"issue\"|\"draft_pr\"|\"none\"), confidence (0.0-1.0), reason (string, concise, same language as user), ",
        "suggested_title (string in English with Conventional prefix like feat:/fix:/docs:), summary (1-2 sentences), ",
        "markdown_body (well-structured Markdown with Steps/Context/Relevant Files), labels (string array like [\"bug\",\"ui\"]), ",
        "target_file (optional string relative repo path ONLY if proposing exact full-file patch, else null), proposed_file_patch (null unless full clean file content is 100% certain)."
    );

    let prompt = format!(
        "Preference: {preferred_hint}\n\nConversation context:\n{conversation_context}\n\nUser message:\n{user_message}\n\nRelevant repo context:\n{rag_context}"
    );

    let messages = vec![ChatMessage::system(system), ChatMessage::user(prompt)];

    match ai
        .chat_json::<ViabilityAssessment>(&messages, 0.15, 900)
        .await
    {
        Ok(mut parsed) => {
            if parsed.suggested_title.trim().is_empty() {
                parsed.suggested_title = "[Community] KŌMA Studio Suggestion".to_string();
            }
            if parsed.markdown_body.trim().is_empty() {
                parsed.markdown_body = user_message.to_string();
            }
            if let Some(kind) = preferred_kind {
                if parsed.viable {
                    parsed.kind = kind.as_str().to_string();
                }
            }
            parsed
        }
        Err(_) => ViabilityAssessment::fallback_unavailable(user_message, preferred_kind),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::client::parse_json_fenced;

    #[test]
    fn parses_viability_json_from_llm_output() {
        let raw = r####"```json
        {
          "viable": true,
          "kind": "issue",
          "confidence": 0.91,
          "reason": "Export menu renders default OS scrollbar in Noir theme.",
          "suggested_title": "fix(ui): style export dropdown scrollbar in Noir theme",
          "summary": "Custom scrollbar missing on KomaTopbarDownloadMenuNoir.",
          "markdown_body": "### Problem\nNative scrollbar shows up.",
          "labels": ["bug", "ui", "noir"],
          "target_file": null,
          "proposed_file_patch": null
        }
        ```"####;

        let parsed: ViabilityAssessment = parse_json_fenced(raw).unwrap();
        assert!(parsed.viable);
        assert_eq!(parsed.proposal_kind(), ProposalKind::Issue);
        assert!(parsed.confidence > 0.9);
        assert_eq!(parsed.labels, vec!["bug", "ui", "noir"]);
    }

    #[test]
    fn rejects_trivial_messages_in_fallback_mode() {
        let short = ViabilityAssessment::fallback_unavailable("oi tudo bem", None);
        assert!(!short.viable);
    }
}
