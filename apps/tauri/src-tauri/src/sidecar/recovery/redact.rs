use std::{
    fs,
    io::Write,
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager, Runtime};

use super::policy::RestartTrigger;

pub(crate) const LAST_STDERR_CAPACITY: usize = 50;
pub(crate) const LAST_STDERR_TAIL_LINES: usize = 50;
pub(crate) const LAST_STDERR_TAIL_CHARS: usize = 2_000;
const CRASH_LOG_FILE_NAME: &str = "mini-backend-crash.log";
const REDACTED_VALUE: &str = "[redacted]";

pub(crate) fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or_default()
}

fn chars_match_ci(chars: &[char], at: usize, needle: &str) -> bool {
    needle.chars().enumerate().all(|(offset, c)| {
        chars
            .get(at + offset)
            .is_some_and(|found| found.eq_ignore_ascii_case(&c))
    })
}

fn find_ci(chars: &[char], from: usize, needle: &str) -> Option<usize> {
    (from..chars.len()).find(|&at| chars_match_ci(chars, at, needle))
}

fn run_end(chars: &[char], from: usize, accept: impl Fn(char) -> bool) -> usize {
    let mut i = from;
    while i < chars.len() && accept(chars[i]) {
        i += 1;
    }
    i
}

fn replace_run(chars: &mut Vec<char>, from: usize, to: usize, replacement: &str) {
    chars.splice(from..to, replacement.chars());
}

pub(crate) fn redact_mini_backend_secrets(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut chars = redact_prefixed_key(&chars, "sk-");
    chars = redact_after_keyword(&chars, "bearer");
    for name in ["api_key", "api-key", "apikey", "token"] {
        chars = redact_assigned_value(&chars, name);
    }
    chars.into_iter().collect()
}

fn redact_prefixed_key(chars: &[char], prefix: &str) -> Vec<char> {
    let mut out = chars.to_vec();
    let mut from = 0;
    while let Some(at) = find_ci(&out, from, prefix) {
        let value = at + prefix.chars().count();
        let end = run_end(&out, value, |c| {
            c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '~')
        });
        if end - value >= 3 {
            replace_run(&mut out, value, end, REDACTED_VALUE);
            from = value + REDACTED_VALUE.chars().count();
        } else {
            from = value;
        }
    }
    out
}

fn redact_after_keyword(chars: &[char], keyword: &str) -> Vec<char> {
    let mut out = chars.to_vec();
    let mut from = 0;
    while let Some(at) = find_ci(&out, from, keyword) {
        let after_keyword = at + keyword.chars().count();
        let value = run_end(&out, after_keyword, char::is_whitespace);
        let end = run_end(&out, value, |c| {
            c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '+' | '/' | '~')
        });
        if end > value {
            replace_run(&mut out, value, end, REDACTED_VALUE);
            from = value + REDACTED_VALUE.chars().count();
        } else {
            from = after_keyword;
        }
    }
    out
}

fn redact_assigned_value(chars: &[char], name: &str) -> Vec<char> {
    let mut out = chars.to_vec();
    let mut from = 0;
    while let Some(at) = find_ci(&out, from, name) {
        let after_name = at + name.chars().count();
        let separator = run_end(&out, after_name, char::is_whitespace);
        let value = run_end(&out, separator + 1, char::is_whitespace);
        let quoted = matches!(out.get(value), Some('"') | Some('\''));
        let end = if quoted {
            (run_end(&out, value + 1, |c| c != '"' && c != '\'') + 1).min(out.len())
        } else {
            run_end(&out, value, |c| {
                !c.is_whitespace() && !matches!(c, ',' | ';' | '&')
            })
        };
        if !out.get(separator).is_some_and(|c| matches!(c, '=' | ':')) || end <= value {
            from = after_name;
            continue;
        }
        replace_run(&mut out, value, end, REDACTED_VALUE);
        from = value + REDACTED_VALUE.chars().count();
    }
    out
}

pub(crate) fn write_crash_log<R: Runtime>(
    app: &AppHandle<R>,
    trigger: RestartTrigger,
    tail: &str,
) -> Option<String> {
    let dir = app.path().app_log_dir().ok()?;
    fs::create_dir_all(&dir).ok()?;
    let path = dir.join(CRASH_LOG_FILE_NAME);
    let mut file = fs::File::create(&path).ok()?;
    let exit_code = trigger
        .exit_code()
        .map_or_else(|| "unknown".to_string(), |code| code.to_string());
    writeln!(
        file,
        "mini-backend {cause} at {timestamp}ms since epoch\nexit code: {exit_code}\n{tail}",
        cause = trigger.label(),
        timestamp = now_millis(),
        tail = if tail.is_empty() {
            "<no stderr captured>"
        } else {
            tail
        },
    )
    .ok()?;
    file.flush().ok()?;
    Some(path.to_string_lossy().to_string())
}
