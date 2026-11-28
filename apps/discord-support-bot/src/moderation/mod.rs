use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ModAction {
    Allow,
    WarnDelete,
}

#[derive(Debug, Clone)]
pub struct ModerationDecision {
    pub action: ModAction,
    pub rule: &'static str,
    pub reason: String,
}

impl ModerationDecision {
    fn allow() -> Self {
        Self {
            action: ModAction::Allow,
            rule: "clean",
            reason: String::new(),
        }
    }

    fn warn_delete(rule: &'static str, reason: impl Into<String>) -> Self {
        Self {
            action: ModAction::WarnDelete,
            rule,
            reason: reason.into(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ModerationStats {
    pub enabled: bool,
    pub messages_checked: u64,
    pub flagged_flood: u64,
    pub flagged_invites: u64,
    pub flagged_phishing: u64,
    pub flagged_mentions: u64,
}

pub struct Moderator {
    enabled: bool,
    flood_max_msgs: usize,
    flood_window: Duration,
    max_mentions: usize,
    block_invites: bool,
    history: Mutex<HashMap<u64, VecDeque<Instant>>>,

    messages_checked: AtomicU64,
    flagged_flood: AtomicU64,
    flagged_invites: AtomicU64,
    flagged_phishing: AtomicU64,
    flagged_mentions: AtomicU64,
}

impl Moderator {
    pub fn new(
        enabled: bool,
        flood_max_msgs: usize,
        flood_window_secs: u64,
        max_mentions: usize,
        block_invites: bool,
    ) -> Self {
        Self {
            enabled,
            flood_max_msgs,
            flood_window: Duration::from_secs(flood_window_secs),
            max_mentions,
            block_invites,
            history: Mutex::new(HashMap::new()),
            messages_checked: AtomicU64::new(0),
            flagged_flood: AtomicU64::new(0),
            flagged_invites: AtomicU64::new(0),
            flagged_phishing: AtomicU64::new(0),
            flagged_mentions: AtomicU64::new(0),
        }
    }

    pub fn stats(&self) -> ModerationStats {
        ModerationStats {
            enabled: self.enabled,
            messages_checked: self.messages_checked.load(Ordering::Relaxed),
            flagged_flood: self.flagged_flood.load(Ordering::Relaxed),
            flagged_invites: self.flagged_invites.load(Ordering::Relaxed),
            flagged_phishing: self.flagged_phishing.load(Ordering::Relaxed),
            flagged_mentions: self.flagged_mentions.load(Ordering::Relaxed),
        }
    }

    pub fn evaluate_message(
        &self,
        author_id: u64,
        content: &str,
        mention_count: usize,
        mentions_everyone: bool,
        is_staff: bool,
    ) -> ModerationDecision {
        if !self.enabled || is_staff {
            return ModerationDecision::allow();
        }
        self.messages_checked.fetch_add(1, Ordering::Relaxed);

        let lower = content.to_ascii_lowercase();

        if mentions_everyone || mention_count > self.max_mentions {
            self.flagged_mentions.fetch_add(1, Ordering::Relaxed);
            return ModerationDecision::warn_delete(
                "mass_mentions",
                format!(
                    "Excessive mentions ({mention_count} > max {}) or unauthorized @everyone/@here.",
                    self.max_mentions
                ),
            );
        }

        if self.block_invites
            && (lower.contains("discord.gg/")
                || lower.contains("discord.com/invite/")
                || lower.contains("discordapp.com/invite/"))
        {
            self.flagged_invites.fetch_add(1, Ordering::Relaxed);
            return ModerationDecision::warn_delete(
                "discord_invite",
                "Unauthorized Discord server invite links are not allowed in public channels.",
            );
        }

        if contains_phishing_signal(&lower) {
            self.flagged_phishing.fetch_add(1, Ordering::Relaxed);
            return ModerationDecision::warn_delete(
                "phishing_scam",
                "Potential scam/phishing link or suspicious giveaway pattern detected.",
            );
        }

        let now = Instant::now();
        let mut guard = self.history.lock().expect("moderation mutex poisoned");
        let queue = guard.entry(author_id).or_default();
        while let Some(&front) = queue.front() {
            if now.duration_since(front) > self.flood_window {
                queue.pop_front();
            } else {
                break;
            }
        }
        queue.push_back(now);

        if queue.len() > self.flood_max_msgs {
            self.flagged_flood.fetch_add(1, Ordering::Relaxed);
            return ModerationDecision::warn_delete(
                "flood_spam",
                format!(
                    "Slow down! Exceeded {} messages in {}s.",
                    self.flood_max_msgs,
                    self.flood_window.as_secs()
                ),
            );
        }

        ModerationDecision::allow()
    }
}

fn contains_phishing_signal(lower: &str) -> bool {
    let suspicious_domains = [
        "dlscord",
        "discorcl",
        "steancommunity",
        "steamcommunlty",
        "nitro-drop",
        "freenitro",
    ];
    if suspicious_domains.iter().any(|d| lower.contains(d)) {
        return true;
    }

    let has_url = lower.contains("http://") || lower.contains("https://");
    let has_bait = (lower.contains("free nitro") || lower.contains("nitro gratis"))
        && (lower.contains("claim") || lower.contains("resgatar") || lower.contains("airdrop"));
    has_url && has_bait
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blocks_invites_phishing_and_flood_while_allowing_support_talk() {
        let mod_engine = Moderator::new(true, 3, 10, 4, true);

        let clean = mod_engine.evaluate_message(
            1,
            "Olá! Vi um bug no export menu de https://github.com/klaus-2/koma-studio",
            0,
            false,
            false,
        );
        assert_eq!(clean.action, ModAction::Allow);

        let invite =
            mod_engine.evaluate_message(2, "Entrem aqui discord.gg/abc123", 0, false, false);
        assert_eq!(invite.action, ModAction::WarnDelete);
        assert_eq!(invite.rule, "discord_invite");

        let scam = mod_engine.evaluate_message(
            3,
            "FREE NITRO claim now at https://freenitro.example.com!",
            0,
            false,
            false,
        );
        assert_eq!(scam.action, ModAction::WarnDelete);
        assert_eq!(scam.rule, "phishing_scam");

        let staff = mod_engine.evaluate_message(
            4,
            "Convite oficial discord.gg/koma @everyone",
            10,
            true,
            true,
        );
        assert_eq!(staff.action, ModAction::Allow);

        assert_eq!(
            mod_engine
                .evaluate_message(1, "msg 2", 0, false, false)
                .action,
            ModAction::Allow
        );
        assert_eq!(
            mod_engine
                .evaluate_message(1, "msg 3", 0, false, false)
                .action,
            ModAction::Allow
        );
        let flood = mod_engine.evaluate_message(1, "msg 4 spam", 0, false, false);
        assert_eq!(flood.action, ModAction::WarnDelete);
        assert_eq!(flood.rule, "flood_spam");
    }
}
