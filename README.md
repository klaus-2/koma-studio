<div align="center">

# KŌMA Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord)](https://discord.gg/tzaV2efD4e)
[![Website](https://img.shields.io/badge/website-koma--studio.site-111827)](https://koma-studio.site/)

**A free, open-source desktop toolkit for scanlation**: detection, OCR, translation,
cleaning, typesetting and export, running locally on your machine.

[Website](https://koma-studio.site/) · [Discord](https://discord.gg/tzaV2efD4e) ·
[Report an issue](https://github.com/klaus-2/koma-studio/issues)

</div>

---

## What is KŌMA?

Drop in manga, manhwa or manhua pages and get a fully typeset translation out. One
workspace bundles the whole pipeline: bubble and text detection, OCR, machine
translation, text erasure (inpainting) and a typesetting editor.

- **100% free.** No plans, tiers, quotas, credits or paid features. If you bring your
  own API key for a cloud AI provider, you talk to that provider directly.
- **Local first.** Detection, OCR, inpainting and offline translation run on your own
  machine through a bundled Python sidecar. Model weights are downloaded on demand
  from public repositories and cached locally.
- **No telemetry.** The app does not collect analytics, usage statistics or behavioural
  data.

## Project status

| Version | Stack | Status |
|---|---|---|
| **v1** | Electron + React ([`apps/electron`](./apps/electron)) | Stable, maintenance mode. The version most users should download today. |
| **v2** | Tauri 2 + Rust ([`apps/tauri`](./apps/tauri)) | Work in progress. Expect breaking changes and incomplete features. |

Both shells share the same React UI ([`packages/interface`](./packages/interface)) and
the same Python AI backend ([`packages/mini-backend`](./packages/mini-backend)), so
improvements land in both.

## Repository map

Managed with Bun workspaces and Turborepo. Each app keeps its own README with setup
details.

### Apps

| Path | Package | What it is |
|---|---|---|
| [`apps/electron`](./apps/electron) | `@koma/electron` | Desktop shell **v1** |
| [`apps/tauri`](./apps/tauri) | `@koma/tauri` | Desktop shell **v2** |
| [`apps/landing`](./apps/landing) | `@koma/landing` | Landing page (Next.js + React 19) |
| [`apps/auth-server`](./apps/auth-server) | `@koma/auth-server` | Auth API (Express + Better Auth + Drizzle + Postgres/Redis) |
| [`apps/tools/koma-build-tool`](./apps/tools/koma-build-tool) | `@koma/build-tool` | Internal maintainer tool (Tauri + Svelte) that builds, signs and deploys releases |
| [`apps/discord-support-bot`](./apps/discord-support-bot) | — | Discord support bot (Python, RAG) |

### Packages

| Path | Package | What it is |
|---|---|---|
| [`packages/interface`](./packages/interface) | `@koma/interface` | **Single interface** (React, v2 base) consumed by both desktop shells |
| [`packages/mini-backend`](./packages/mini-backend) | Python workspace (no Bun package) | Local AI sidecar: detection, OCR, inpainting, translation and model downloads (FastAPI + ONNX Runtime / PyTorch) |
| [`packages/types`](./packages/types) | `@koma/types` | Shared TS contracts (desktop bridge, workspace, blogger, imgur) |
| [`packages/config`](./packages/config) | `@koma/config` | Shared tsconfig bases |
| [`packages/ui`](./packages/ui) | `@koma/ui` | Shared design system |
| [`packages/auth`](./packages/auth) | `@koma/auth` | Shared auth client |

## Roadmap

- Code refactoring and cleanup (the biggest pain point today: giant components with thousands of lines)
- React performance optimization (Electron/Tauri)
- `tauri-async` optimization
- Complete UI redesign + theming system
- New local model support
- General local-model performance improvements

## Quick start

Requirements: Bun ≥ 1.4, Node ≥ 22.18, Python 3.12 (for the AI mini-backend) and a
Rust toolchain (for `apps/tauri`).

```bash
bun install                # single install for all workspaces

# Dev (pick your target)
bun run dev:electron       # v1 stack (vite + mini-backend + auth-server)
bun run dev:tauri          # v2 web frontend (vite only)
bun run dev:desktop        # v2 web stack (mini-backend + auth-server + vite, no window)
bun run dev:tauri:window   # v2 with native window
bun run dev:landing        # landing page
bun run dev:auth           # auth-server

# Checks (the full local gate before opening a PR)
bun run lint               # oxlint + per-app ESLint
bun run typecheck          # tsc --noEmit across workspaces
bun run test               # vitest
bun run build              # turbo build
```

## Community & support

- [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Security](SECURITY.md)
- The UI ships in 14 languages. To help translate, see
  [Translations](CONTRIBUTING.md#translations).
- Discord: <https://discord.gg/tzaV2efD4e> · Website: <https://koma-studio.site/>
- Bug reports and feature requests: [GitHub issues](https://github.com/klaus-2/koma-studio/issues)

## License

MIT, see [LICENSE](LICENSE). Third-party notices:
[docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md).
