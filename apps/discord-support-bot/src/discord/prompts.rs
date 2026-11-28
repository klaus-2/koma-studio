use crate::ai::ChatMessage;
use crate::rag::RetrievedChunk;

pub fn build_support_messages(
    question: &str,
    history: &[ChatMessage],
    chunks: &[RetrievedChunk],
) -> Vec<ChatMessage> {
    let context_block = if chunks.is_empty() {
        "No matching code or documentation snippets were found in the indexed repository."
            .to_string()
    } else {
        chunks
            .iter()
            .enumerate()
            .map(|(i, c)| {
                let sym = c
                    .symbol
                    .as_deref()
                    .map(|s| format!(" | symbol: `{s}`"))
                    .unwrap_or_default();
                let body: String = c.content.chars().take(1200).collect();
                format!(
                    "[Source {}] `{}` (L{}-{}, area: {}{})\n```\n{}\n```",
                    i + 1,
                    c.file_path,
                    c.start_line,
                    c.end_line,
                    c.area,
                    sym,
                    body
                )
            })
            .collect::<Vec<_>>()
            .join("\n\n")
    };

    let system = concat!(
        "You are KŌMA Assistant, the official friendly & knowledgeable technical support engineer for **KŌMA Studio** (a desktop manga/webtoon scanlation & typesetting workstation built with Tauri/Rust, React/TypeScript, and a Python AI sidecar).\n\n",
        "Rules:\n",
        "1. Language: Reply in the SAME language as the user's message (e.g. Portuguese / PT-BR if the user writes in Portuguese, English if in English, etc.).\n",
        "2. Grounding: Base every technical claim about files, settings, commands, themes, shortcuts, or AI pipelines ONLY on the repository sources provided below. Cite file paths and line ranges (like `packages/interface/...:10-42`) when helpful.\n",
        "3. Honesty: If the retrieved sources don't cover something completely, say clearly what is verified vs what is not in the indexed context — never invent APIs, env vars, or menu items.\n",
        "4. Tone: Warm, clear, concise (Discord-ready Markdown, ideally under 1,600 characters unless debugging detail is needed).\n",
        "5. Bugs & Ideas: If the user appears to have hit a genuine bug or proposed a solid improvement, help them troubleshoot first and briefly mention they can use the confirmation prompt or `/suggest` to submit it to GitHub after reviewing."
    );

    let mut messages = Vec::with_capacity(history.len() + 3);
    messages.push(ChatMessage::system(format!(
        "{system}\n\n## Retrieved KŌMA Studio Repository Context\n{context_block}"
    )));

    for prev in history.iter().take(6) {
        messages.push(prev.clone());
    }

    messages.push(ChatMessage::user(question));
    messages
}

pub fn looks_like_bug_or_feature_candidate(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    if text.split_whitespace().count() < 6 {
        return false;
    }
    let keywords = [
        "bug",
        "erro",
        "error",
        "crash",
        "trav",
        "quebr",
        "broken",
        "doesn't work",
        "nao funciona",
        "não funciona",
        "sugest",
        "suggest",
        "feature",
        "ideia",
        "idea",
        "melhoria",
        "improvement",
        "issue",
        "pull request",
        "pr ",
        "scrollbar",
        "z-index",
        "overflow",
        "panic",
        "exception",
        "falha",
    ];
    keywords.iter().any(|kw| lower.contains(kw))
}

#[derive(Debug, Clone, Copy)]
pub struct ThreadPolicy {
    pub enabled: bool,
    pub min_question_chars: usize,
    pub min_answer_chars: usize,
}

pub fn should_open_support_thread(
    is_guild_text_channel: bool,
    already_in_thread: bool,
    question: &str,
    answer: &str,
    looks_like_issue: bool,
    policy: ThreadPolicy,
) -> bool {
    if !policy.enabled || !is_guild_text_channel || already_in_thread {
        return false;
    }
    looks_like_issue
        || question.chars().count() >= policy.min_question_chars
        || answer.chars().count() >= policy.min_answer_chars
}

pub fn build_thread_title(question: &str) -> String {
    let single_line: String = question.split_whitespace().collect::<Vec<_>>().join(" ");
    let clean = single_line.trim();
    if clean.is_empty() {
        return "KŌMA Studio Support".to_string();
    }
    truncate_chars(clean, 88)
}

pub fn truncate_chars(text: &str, max_chars: usize) -> String {
    let count = text.chars().count();
    if count <= max_chars {
        return text.to_string();
    }
    let mut truncated: String = text.chars().take(max_chars.saturating_sub(3)).collect();
    truncated.push_str("...");
    truncated
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_bug_and_suggestion_candidates() {
        assert!(looks_like_bug_or_feature_candidate(
            "Quando abro o menu de exportar no tema noir a barra de scroll fica bugada"
        ));
        assert!(!looks_like_bug_or_feature_candidate("oi"));
    }

    #[test]
    fn truncates_unicode_without_panicking() {
        let s = "Olá mundo café ☕ 日本語";
        let out = truncate_chars(s, 10);
        assert_eq!(out.chars().count(), 10);
        assert!(out.ends_with("..."));
    }

    #[test]
    fn decides_when_to_open_support_threads() {
        let policy = ThreadPolicy {
            enabled: true,
            min_question_chars: 80,
            min_answer_chars: 450,
        };
        assert!(should_open_support_thread(
            true,
            false,
            "Short question",
            &"x".repeat(500),
            false,
            policy,
        ));
        assert!(!should_open_support_thread(
            true,
            true,
            &"q".repeat(120),
            &"a".repeat(600),
            true,
            policy,
        ));
        assert!(!should_open_support_thread(
            false, false, "Question", "Answer", true, policy,
        ));
        assert_eq!(
            build_thread_title("Como configurar\n   o RAG   local?"),
            "Como configurar o RAG local?"
        );
    }
}
