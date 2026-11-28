# KŌMA Studio Discord Support Bot (Rust + Serenity)

AI-powered technical support, repository RAG search, interactive GitHub Issue / Draft PR workflow, and community moderation bot for **KŌMA Studio** built from scratch in **Rust** (`serenity` 0.12).

## Capabilities

- **Full KŌMA Repository Knowledge (Hybrid RAG)**:
  - Incrementally indexes code and docs across `apps/tauri`, `apps/electron`, `apps/landing`, `apps/auth-server`, `packages/interface`, `packages/mini-backend`, `packages/ui`, `packages/auth`, `packages/types`, and root docs.
  - Stored in embedded SQLite (`rusqlite` bundled) combining **FTS5 BM25 keyword search** and **cosine vector similarity** merged via **Reciprocal Rank Fusion (RRF)** — falls back seamlessly to FTS5 if the local embedding endpoint is temporarily unavailable.
- **Local LLM & Embeddings (OpenAI-Compatible)**:
  - Works with Ollama (`http://127.0.0.1:11434/v1`), LM Studio, llama.cpp server, or vLLM via standard `/v1/chat/completions` and `/v1/embeddings`.
- **Natural Support, Threads, Custom Status & Slash Commands**:
  - Responds when `@mentioned`, when users reply to any bot message, inside active support threads, or in configured `SUPPORT_CHANNEL_IDS` (mirroring PT-BR / English naturally).
  - Automatically opens organized public support threads on longer technical questions or GitHub triage discussions to keep main channels clutter-free (`AUTO_THREADS_ENABLED`), and rotates customizable Discord custom statuses (`BOT_STATUS_TEXT`).
  - Commands: `/ask`, `/search`, `/suggest`, `/status`, `/reindex`, `/modstatus`.
- **GitHub Viability Triage & User-Confirmed Issue / Draft PR Creation**:
  - Automatically detects actionable bug reports or feature suggestions during conversations or via `/suggest`.
  - Runs an AI viability check + searches existing open GitHub issues to avoid duplicates.
  - Never publishes anything silently — presents an interactive Discord confirmation card (**Confirm Issue**, **Confirm Draft PR**, **Edit Details Modal**, **Cancel**), persisting proposals in SQLite until confirmed or canceled.
- **Community Moderation**:
  - Sliding-window flood/spam rate limiting, unauthorized Discord invite filtering, phishing/scam URL heuristics, mass-mention protection, and structured mod-log embeds.

## Setup

```powershell
cd apps/discord-support-bot
Copy-Item .env.example .env
# Edit .env with DISCORD_TOKEN, local AI URL/models, and optional GITHUB_TOKEN
cargo run --release
```

## Verification

```powershell
cargo check --manifest-path apps/discord-support-bot/Cargo.toml
cargo test --manifest-path apps/discord-support-bot/Cargo.toml
```
