use sha2::{Digest, Sha256};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CodeChunk {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub area: String,
    pub symbol: Option<String>,
    pub content: String,
}

const SKIP_DIRS: &[&str] = &[
    ".git/",
    "node_modules/",
    "target/",
    "dist/",
    "build/",
    ".worktrees/",
    ".next/",
    ".turbo/",
    "__pycache__/",
    ".venv/",
    "venv/",
    "apps/discord-support-bot/data/",
    "packages/mini-backend/models/",
];

const SKIP_FILENAMES: &[&str] = &[
    "package-lock.json",
    "bun.lock",
    "bun.lockb",
    "pnpm-lock.yaml",
    "yarn.lock",
    "cargo.lock",
];

const ALLOWED_EXTENSIONS: &[&str] = &[
    "rs", "ts", "tsx", "js", "jsx", "mjs", "cjs", "py", "md", "mdx", "css", "toml", "yml", "yaml",
];

const ALLOWED_ROOT_JSON: &[&str] = &["package.json", "tsconfig.json", "tauri.conf.json"];

pub fn normalize_rel_path(path: &str) -> String {
    path.replace('\\', "/").trim_start_matches("./").to_string()
}

pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    hex::encode(hasher.finalize())
}

pub fn should_index_path(rel_path: &str) -> bool {
    let norm = normalize_rel_path(rel_path);
    let lower = norm.to_ascii_lowercase();

    if SKIP_DIRS
        .iter()
        .any(|dir| lower.starts_with(dir) || lower.contains(&format!("/{dir}")))
    {
        return false;
    }

    let filename = lower.rsplit('/').next().unwrap_or(lower.as_str());
    if SKIP_FILENAMES.contains(&filename) {
        return false;
    }
    if filename.ends_with(".min.js") || filename.ends_with(".min.css") {
        return false;
    }

    if lower.contains("/langs/") && !lower.ends_with("/en.ts") && !lower.ends_with("/ptbr.ts") {
        return false;
    }

    if filename == "cargo.toml" || filename == "dockerfile" || filename == ".env.example" {
        return true;
    }

    if filename.ends_with(".json") {
        return ALLOWED_ROOT_JSON.contains(&filename);
    }

    let ext = filename.rsplit('.').next().unwrap_or("");
    ALLOWED_EXTENSIONS.contains(&ext)
}

pub fn infer_component_area(rel_path: &str) -> String {
    let norm = normalize_rel_path(rel_path);
    if norm.starts_with("apps/tauri") {
        "tauri-rust-desktop".to_string()
    } else if norm.starts_with("apps/electron") {
        "electron-legacy-desktop".to_string()
    } else if norm.starts_with("apps/auth-server") {
        "auth-server-api".to_string()
    } else if norm.starts_with("apps/landing") {
        "landing-web".to_string()
    } else if norm.starts_with("apps/discord-support-bot") {
        "discord-support-bot".to_string()
    } else if norm.starts_with("packages/interface") {
        "studio-react-interface".to_string()
    } else if norm.starts_with("packages/mini-backend") {
        "ai-python-sidecar".to_string()
    } else if norm.starts_with("packages/ui") {
        "design-system-ui".to_string()
    } else if norm.starts_with("packages/auth") {
        "shared-auth-client".to_string()
    } else if norm.starts_with("packages/types") {
        "shared-types".to_string()
    } else if norm.starts_with(".github") {
        "ci-workflows".to_string()
    } else {
        "repository-docs".to_string()
    }
}

fn detect_symbol(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with("/*") {
        return None;
    }

    for marker in [
        "pub async fn ",
        "async fn ",
        "pub fn ",
        "fn ",
        "pub struct ",
        "struct ",
        "pub enum ",
        "enum ",
        "export async function ",
        "export function ",
        "export interface ",
        "export type ",
        "export const ",
        "async def ",
        "def ",
        "class ",
        "### ",
        "## ",
        "# ",
    ] {
        if let Some(rest) = trimmed.strip_prefix(marker) {
            let ident: String = rest
                .chars()
                .take_while(|c| !matches!(c, '(' | '{' | '<' | ':' | '=' | '\n'))
                .collect();
            let clean = ident.trim();
            if !clean.is_empty() {
                return Some(clean.chars().take(80).collect());
            }
        }
    }
    None
}

pub fn chunk_file(
    rel_path: &str,
    content: &str,
    max_lines: usize,
    overlap: usize,
) -> Vec<CodeChunk> {
    let norm = normalize_rel_path(rel_path);
    let area = infer_component_area(&norm);
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return Vec::new();
    }

    let window = max_lines.max(20);
    let step_overlap = overlap.min(window / 2);
    let step = (window - step_overlap).max(1);

    let mut chunks = Vec::new();
    let mut start = 0usize;

    while start < lines.len() {
        let end = (start + window).min(lines.len());
        let slice = &lines[start..end];
        let text = slice.join("\n");

        if !text.trim().is_empty() {
            let symbol = slice.iter().find_map(|line| detect_symbol(line));
            chunks.push(CodeChunk {
                file_path: norm.clone(),
                start_line: start + 1,
                end_line: end,
                area: area.clone(),
                symbol,
                content: text,
            });
        }

        if end >= lines.len() {
            break;
        }
        start += step;
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_index_paths_accurately() {
        assert!(should_index_path(
            "apps/tauri/src-tauri/src/commands/discord.rs"
        ));
        assert!(should_index_path(
            "packages/interface/src/i18n/langs/ptBR.ts"
        ));
        assert!(should_index_path("README.md"));
        assert!(should_index_path("package.json"));

        assert!(!should_index_path("node_modules/react/index.js"));
        assert!(!should_index_path(
            "apps/tauri/src-tauri/target/debug/main.rs"
        ));
        assert!(!should_index_path("bun.lock"));
        assert!(!should_index_path(".worktrees/tmp/file.ts"));
        assert!(!should_index_path(
            "packages/interface/src/i18n/langs/de.ts"
        ));
    }

    #[test]
    fn infers_component_areas_and_chunks_with_overlap() {
        assert_eq!(
            infer_component_area("packages/mini-backend/app/main.py"),
            "ai-python-sidecar"
        );
        assert_eq!(
            infer_component_area("apps/tauri/src-tauri/src/lib.rs"),
            "tauri-rust-desktop"
        );

        let lines: Vec<String> = (1..=120)
            .map(|i| {
                if i == 1 {
                    "pub fn resolve_client_id() -> Option<u64> {".to_string()
                } else {
                    format!("    let line_{i} = {i};")
                }
            })
            .collect();
        let src = lines.join("\n");
        let chunks = chunk_file("apps/tauri/src-tauri/src/commands/discord.rs", &src, 60, 10);

        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].start_line, 1);
        assert_eq!(chunks[0].end_line, 60);
        assert_eq!(chunks[0].symbol.as_deref(), Some("resolve_client_id"));
        assert_eq!(chunks[1].start_line, 51);
        assert_eq!(chunks[1].end_line, 110);
        assert_eq!(chunks[2].start_line, 101);
        assert_eq!(chunks[2].end_line, 120);
    }
}
