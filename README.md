<div align="center">

# KOMA Studio: Open-Source AI Manga Translator & Scanlation Studio

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Latest release](https://img.shields.io/github/v/release/klaus-2/koma-studio)](https://github.com/klaus-2/koma-studio/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/klaus-2/koma-studio/total)](https://github.com/klaus-2/koma-studio/releases)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord)](https://discord.gg/tzaV2efD4e)
[![Website](https://img.shields.io/badge/website-koma--studio.site-111827)](https://koma-studio.site/)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/klaus-2/koma-studio?utm_source=oss&utm_medium=github&utm_campaign=klaus-2%2Fkoma-studio&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)

![KŌMA Studio — 15s preview](docs/media/koma-studio-demo.gif)

**A free, open-source AI manga translator and scanlation studio**: bubble and text
detection, OCR, LLM translation, text erasure (inpainting), typesetting and export,
running locally on your machine. Works with manga, manhwa, manhua, webtoons and
comics, and never sends your pages to a server we own.

[Download](https://github.com/klaus-2/koma-studio/releases/latest) ·
[Website](https://koma-studio.site/) · [Discord](https://discord.gg/tzaV2efD4e) ·
[Report an issue](https://github.com/klaus-2/koma-studio/issues)

</div>

---

## What is KŌMA?

Drop in manga, manhwa or manhua pages and get a fully typeset translation out. One
workspace bundles the whole pipeline: bubble and text detection, OCR, machine
translation, text erasure (inpainting) and a typesetting editor.

The whole job is one pipeline, six stages, in this order:

| Stage | What happens |
|---|---|
| **Detect** | Locate the text and bubble regions on the page |
| **OCR** | Extract the textual content of each region |
| **Translate** | Translate it with the model or service you picked |
| **Segment** | Refine the region geometry into renderable lines |
| **Clean** | Inpaint the source text away (AOT/LaMa + mask) |
| **Render** | Draw the translated text back into the image |

Run it end to end in one click (**AIO automatic**), or open it up and take
manual control of each stage — rewind, re-run, skip, adjust the region on the
page, then continue. Below the pipeline sit the individual tools: **Cleaner &
Redrawer**, **Typesetter**, **Translator**, **Stitch**, **Smart Split**,
**Watermark**, **Enhance**, **Chapter Optimizer**, plus **Blogger CDN** and
**Imgur** publishing.

- **100% free.** No plans, tiers, quotas, credits or paid features. If you bring your
  own API key for a cloud AI provider, you talk to that provider directly.
- **Local first.** Detection, OCR, inpainting and offline translation run on your own
  machine through a bundled Python sidecar. Model weights are downloaded on demand
  from public repositories and cached locally.
- **No telemetry.** The app does not collect analytics, usage statistics or behavioural
  data.
- **MIT licensed.** Bring your own models, CUDA/CPU/TensorRT/OpenVINO aware.

## How KOMA compares

KOMA is not the only open-source manga translator out there. The honest short
version: the projects below are great one-click translators; KOMA is a full
scanlation studio where translation integrity and manual control are the point.

| | KOMA Studio | [manga-image-translator](https://github.com/zyddnys/manga-image-translator) | [BallonsTranslator](https://github.com/dmMaze/BallonsTranslator) | [comic-translate](https://github.com/ogkalu2/comic-translate) | [MangaTranslator](https://github.com/meangrinch/MangaTranslator) |
|---|---|---|---|---|---|
| Pipeline | Detect, OCR, translate, segment, clean, render, export | Detect, OCR, translate, inpaint, render | Detect, OCR, translate, inpaint, render + rich editor | Detect, OCR, translate, inpaint, render | Detect, OCR, translate, inpaint, render |
| Translation memory + per-work glossary | Yes (persistent, with never-translate and echo QA) | Glossary and replacement dictionary | Translation history context for LLMs | No | No |
| SFX handling | Dedicated classifier and redraw workflow | No | No | No | Outside-bubble text detection |
| Manual editing | Mask brush, eraser, healing brush, magic wand, inline text editor | Web UI editing with GIMP render hand-off | Mask brush + rich text editor | Desktop app + browser extension editing | Web UI |
| Export | Layered PSD, ZIP/CBZ/CB7/PDF bundles, translation spreadsheets | Images | Images, Word | Images, PDF, EPUB | Images |
| Model catalog honesty | Min VRAM per model, untested badges, structured refusals | CLI options | Docs | Docs | Docs |
| Runs 100% locally | Yes (cloud optional with your key) | Yes (online service optional) | Yes | Yes (cloud LLMs are the default translator) | Yes (LLM optional) |

## FAQ

**Is it really free?**
Yes. No plans, tiers, quotas, credits or paid features. Cloud AI providers cost
what they cost, but that is your key talking to your provider, directly.

**Does it work offline?**
The core pipeline does: detection, OCR, inpainting and the offline translation
engines run entirely on your machine through the bundled Python sidecar. Cloud
translation and cloud OCR are optional and only used with your own API key.

**Does it support manhwa and webtoon long strips?**
Yes. Vertical text (tategaki) is a first-class typesetting mode, and long-strip
layouts are handled by the same pipeline with per-region control.

**Which languages does it support?**
The UI ships in 14 languages. OCR engines route by language family (Japanese,
Korean, Chinese, Russian, Latin scripts and more), and translation runs from and
to the languages your chosen engine supports, offline or in the cloud.

**Does it need a GPU?**
No. CPU profiles work out of the box; NVIDIA CUDA and other accelerators are
detected automatically and used when available. Models state their minimum VRAM
where it applies, so you can pick what fits your machine.

## Project status

| Version | Stack | Status |
|---|---|---|
| **v2** | Tauri 2 + Rust ([`apps/tauri`](./apps/tauri)) | Active primary desktop release shell (hybrid OTA UI updates, zstd deltas, and 2-layer Python runtime). |
| **v1** | Electron + React ([`apps/electron`](./apps/electron)) | Legacy / frozen. Installer builds are retired; kept for source reference. |

Both shells share the same React UI ([`packages/interface`](./packages/interface)) and
the same Python AI backend ([`packages/mini-backend`](./packages/mini-backend)).

## Repository map

Managed with Bun workspaces and Turborepo. Each app keeps its own README with setup
details.

### Apps

| Path | Package | What it is |
|---|---|---|
| [`apps/tauri`](./apps/tauri) | `@koma/tauri` | Active desktop shell **v2** |
| [`apps/electron`](./apps/electron) | `@koma/electron` | Legacy desktop shell **v1** (frozen) |
| [`apps/landing`](./apps/landing) | `@koma/landing` | Landing page (Next.js + React 19) |
| [`apps/auth-server`](./apps/auth-server) | `@koma/auth-server` | Auth API (Express + Better Auth + Drizzle + Postgres/Redis) |
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
- Complete UI redesign + theming system
- New local model support
- General local-model performance improvements

## Quick start

Requirements: Bun ≥ 1.4, Node ≥ 22.18, Python 3.12 (for the AI mini-backend) and a
Rust toolchain (for `apps/tauri`).

```bash
bun install                # single install for all workspaces

# Dev (pick your target)
bun run dev:electron       # v1 stack (vite + mini-backend; local mode, no auth server)
bun run dev:tauri          # v2 web frontend (vite only)
bun run dev:desktop        # v2 web stack (mini-backend + vite, no window; auth server joins when login is enabled)
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
