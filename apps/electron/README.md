# KŌMA Studio

> **A free, open-source desktop toolkit for scanlation**: detection, OCR, translation, cleaning, typesetting and export, running locally on your machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](../../LICENSE)
[![Discord](https://img.shields.io/badge/Discord-join%20us-5865F2?logo=discord)](https://discord.gg/tzaV2efD4e)
[![Website](https://img.shields.io/badge/website-koma--studio.site-111827)](https://koma-studio.site/)

**English** · [Português (BR)](./README.pt-BR.md) · [Español](./README.es.md) · [日本語](./README.ja.md)

> ### ⚠️ This shell is v1: maintenance mode
> KŌMA Studio v1 is the **Electron + React 18** shell. New features land in the v2 shell
> (**Tauri 2 + Rust**, `apps/tauri/`), which shares the same React UI and Python AI backend.
> v1 remains available and receives fixes, but v2 is the primary line.

---

## What it is

KŌMA Studio is a desktop application for translating comics, manga, manhwa and manhua. It bundles the
whole scanlation pipeline into one workspace: you drop in pages, and it detects text, reads it,
translates it, erases the original lettering and helps you typeset the result.

**100% free.** There are no plans, tiers, quotas, credits, trials or paid features. Every capability
in the repository is available to everyone. If you bring your own API key for a cloud AI provider,
you talk to that provider directly. Nothing is brokered or metered by us.

**Local first.** Detection, OCR, inpainting, segmentation and offline translation run on your own
machine through a bundled Python sidecar. Model weights are downloaded on demand from public
repositories (Hugging Face, ModelScope, GitHub releases) and cached locally.

**No telemetry.** The app does not collect analytics, usage statistics or behavioural data. See
[Privacy & telemetry](#privacy--telemetry) for the exhaustive list of network calls it can make.

| Before | After |
|:---:|:---:|
| ![Before cleaning](resources/cl-before.webp) | ![After cleaning](resources/cl-after.webp) |

## Features

| Stage | What it does |
| --- | --- |
| **Ingest** | Import images, PDF, PSD, CBZ/7z archives; split webtoon strips into pages |
| **Detection** | Locate speech bubbles and free text (Comic Text Detector, ONNX) |
| **OCR** | Read text in JA / KO / ZH / EN and more (Manga OCR, PaddleOCR, EasyOCR, Pororo) |
| **Translation** | Offline models (CTranslate2 / llama.cpp) or bring-your-own-key cloud providers |
| **Segmentation & cleaning** | Mask the original text and inpaint the background (LaMa, ONNX) |
| **Typesetting** | Font style detection, text effects, layout tools, inline editing |
| **Export** | PSD with layers and metadata, flattened images, batch ZIP output |
| **AIO** | Run the whole pipeline over a batch, automatically or stage by stage |

Plus: 14 UI languages, a community feed, resource guides, a model manager, keyboard shortcuts,
Discord Rich Presence, and an incremental updater.

## Download

Prefer not to build from source? Grab an installer from the
[GitHub Releases](https://github.com/klaus-2/koma-studio/releases) page or visit
[koma-studio.site](https://koma-studio.site/).

## Architecture

This shell is one of two desktop apps in the KŌMA Studio monorepo. The other
(Tauri, v2) shares the same React UI and the same Python AI backend.

```
┌───────────────────────────────────────────────────────────┐
│ Desktop shell — Electron (Node.js)                        │
│  · window/updater/deep links · IPC bridge · cert pinning  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ UI — React 18 + Vite + TypeScript + Zustand         │  │
│  └─────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Sidecar — Python FastAPI "mini-backend" (127.0.0.1) │  │
│  │  detection · OCR · translation · inpainting · export │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
             ▲ optional, self-hosted
             └── auth-server (accounts, JWT) — bundled in apps/auth-server/
```

| Directory | Contents |
| --- | --- |
| `electron/` | Main and preload processes: window management, IPC, sidecar supervision, updater |
| `scripts/` | Build, dev-stack, hardening and QA tooling (Node ESM) |
| `resources/` | Icons, fonts, templates, sample assets |
| `tests/` | `node --test` suites (sidecar markers, runtime checks) |

The React application itself lives in [`packages/interface/`](../../packages/interface/), shared
with the Tauri shell; the Python sidecar in [`packages/mini-backend/`](../../packages/mini-backend/).

## Requirements

- **[Bun](https://bun.sh) ≥ 1.4**: the only supported package manager and script runner
- **Node.js ≥ 22.18**: used by Vite, Electron tooling and the build scripts (CI runs 22)
- **Python 3.11+**: for the mini-backend sidecar (CI runs 3.12)
- **PostgreSQL**: only if you run the optional auth server
- A GPU is optional; everything falls back to CPU (slower)

## Getting started

```bash
git clone https://github.com/klaus-2/koma-studio.git
cd koma-studio

# 1. Dependencies (run from the monorepo root for workspace wiring)
bun install

cd apps/electron

# 2. Environment
cp .env.example .env.development   # every value is optional for local use

# 3. Run
bun run dev              # full stack: Electron + Vite + sidecar bootstrap
bun run dev:vite         # UI only, in the browser
```

`bun run dev` provisions the Python sidecar automatically the first time: it creates
`.venv-mini` and installs `packages/mini-backend/requirements.txt`. Later runs compare a SHA-256 of
the requirements against `.venv-mini/.koma-install-stamp.json` and skip the install entirely,
so only a dependency change triggers reinstallation.

> The first bootstrap pulls PyTorch and friends. Expect several GB. Downloads are cached in `.cache/pip`,
> so a later reinstall reuses them. Set `MINI_BACKEND_PYTHON` to point at a specific interpreter if
> a suitable `python3` is not on your `PATH`.

Manual control, when you want it:

```bash
bun run dev:mini          # provision/start only the sidecar
bun run dev:auth          # only the bundled auth server (terminal of its own)
bun run mini:install-deps # force a full reinstall of the sidecar venv
```

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run dev` | Full dev stack (Electron + Vite + sidecar + optional auth) |
| `bun run dev:vite` | Vite dev server only |
| `bun run dev:mini` | Mini-backend sidecar only |
| `bun run dev:auth` | Auth server only |
| `bun run test` | `node --test` suites |
| `bun run test:python` | Mini-backend suites (pytest) |
| `bun run lint` | ESLint |
| `bun run typecheck` | TypeScript only |
| `bun run build:app` | Production build (React + Electron) |
| `bun run build:mini` | Freeze the mini-backend sidecar (profile picker) |
| `bun run build:all` | `build:mini` + `build:app` |
| `bun run build:desktop` | Desktop installers |
| `bun run build:release` | Release artifacts |
| `bun run build:hardened:{win,mac,linux}` | Hardened release pipeline |
| `bun run release:{win,mac,linux}` | Build + publish via electron-builder |

Mini-backend tests:

```bash
bun run test:python       # from apps/electron
```

## Release builds and hardware profiles

When a build includes the mini-backend (`build:mini`, `build:all`, `build:desktop`), an interactive
prompt asks which hardware acceleration profile to bake into the build:

```
Select the hardware acceleration profile to bake into this build.
The chosen profile's dependencies replace the CPU set entirely; the
pipeline produces one mini-backend sidecar, not one per profile.

  1) CPU only (default)
     cpu — Portable build. Runs anywhere, no GPU drivers required.
  2) NVIDIA CUDA
     nvidia-cuda — onnxruntime-gpu + the CUDA 12 runtime. Turing (RTX 20xx) and newer.
  ...

Profile [1-6 or id, blank = cpu]:
```

The choice selects which `packages/mini-backend/requirements*.txt` is installed into `.venv-mini`,
and that venv is the one the pipeline freezes, so the profile's native libraries (the CUDA DLLs,
the ROCm or OpenVINO execution provider) are compiled **into** the single `mini-backend` sidecar
the pipeline emits. The profile **replaces** the CPU dependency set; no separate CPU binary is
produced alongside it.

| Profile | Windows | macOS | Linux | Installs |
| --- | :-: | :-: | :-: | --- |
| `cpu` *(default)* | ✅ | ✅ | ✅ | Base set only; portable, no GPU drivers |
| `nvidia-cuda` | ✅ | — | ✅ | `onnxruntime-gpu` + CUDA 12 runtime (RTX 20xx+) |
| `nvidia-cuda-legacy` | ✅ | — | ✅ | Same CUDA 12 stack, tuned for Pascal (GTX 10xx) |
| `nvidia-tensorrt` | ✅ | — | ✅ | CUDA stack with the TensorRT provider |
| `amd-rocm` | — | — | ✅ | `onnxruntime-rocm` (no Windows ROCm build exists) |
| `intel-openvino` | ✅ | — | ✅ | `onnxruntime-openvino` for Intel iGPU/NPU/CPU |
| `apple-mps` | — | ✅ | — | Apple Silicon; Metal ships in the default PyTorch wheel |

### Non-interactive builds

CI has no terminal to answer a prompt. Skip the question in either of two ways:

```bash
# Explicit flag
bun run build:mini -- --profile nvidia-cuda

# Or an environment variable
MINI_BACKEND_ACCELERATION_PROFILE=nvidia-cuda bun run build:mini
```

Precedence is `--profile` › `$MINI_BACKEND_ACCELERATION_PROFILE` › prompt › `cpu`.
Requesting a profile that does not exist on the target platform, `amd-rocm` on Windows, say,
fails immediately instead of quietly falling back.

### Build cache

Builds are incremental: unchanged sources reuse the previous mini-backend build (`.build-cache/`),
and Python dependencies are only reinstalled when requirements or the active profile change.
Force a full rebuild with:

```bash
bun run build:mini -- --force        # or MINI_BACKEND_FORCE_REBUILD=1
```

## Configuration

Everything is driven by `.env.development` / `.env.production` (git-ignored). See
[`.env.example`](./.env.example) for the annotated list. Nothing is required to run locally.
Highlights:

| Variable | Meaning |
| --- | --- |
| `VITE_AUTH_API_URL` | Self-hosted auth server; the app works without it |
| `VITE_AUTH_DISABLED` | `true` = fully local mode (no login screens, auth features hidden) |
| `VITE_LOCAL_API_URL` | Mini-backend address (default `http://localhost:8001`) |
| `KOMA_MODELS_ROOT` | Where AI weights are cached; empty = app data directory |
| `BUG_REPORT_DISCORD_WEBHOOK_URL` | Enables the opt-in bug report form; empty = disabled |
| `MINI_BACKEND_PYTHON` | Explicit Python interpreter for the sidecar |
| `MINI_BACKEND_*_API_KEY` | Your own cloud provider keys, used directly by the sidecar |

### Optional: the auth server

Accounts, login and the community feed are served by **the auth server bundled in `apps/auth-server/`**.
KŌMA Studio runs fully in local mode without it. Set `VITE_AUTH_DISABLED=true` and the app opens
straight into the dashboard, skipping login and hiding auth-backed features (feed, model rankings,
account settings). It issues JWTs with audience `"koma-studio-backend"`; see
[`apps/auth-server/.env.example`](../../apps/auth-server/.env.example) for the full list of env vars
and [`apps/auth-server/README.md`](../../apps/auth-server/README.md) for the setup.

## Privacy & telemetry

KŌMA Studio ships **no analytics and no telemetry**. There is no event tracking, no usage reporting
and no background beaconing. The complete set of outbound requests the app can make:

| Call | When | Opt-out |
| --- | --- | --- |
| AI model downloads | You install a model in the Model Manager | Don't install it |
| Cloud AI providers | You configure your own API key and run a cloud stage | Don't configure one |
| Bug report | You submit the in-app form (text + screenshots you attach) | Leave the webhook unset |
| Update check | On startup, asks the update server for the latest version | Disable in Settings |
| Discord Rich Presence | If you enable it; sends only the current activity | Off by default in Settings |
| Auth server | Only if you configure one and log in | Don't configure one |

Error logs are written **locally** (electron-log) and never uploaded automatically.
Anti-abuse checks in `interface/security/` and the desktop registration handshake are local
integrity signals for self-hosted deployments, not user tracking.

## Third-party models and licenses

The application code is MIT. **AI models are downloaded at runtime and carry their own licenses**,
which you are responsible for respecting. Some are more restrictive than MIT and may not permit
commercial use. Notably:

| Component | Upstream | License |
| --- | --- | --- |
| Comic Text Detector | [dmMaze/comic-text-detector](https://github.com/dmMaze/comic-text-detector) | **GPL-3.0** |
| Manga OCR | [kha-white/manga-ocr](https://github.com/kha-white/manga-ocr) | Apache-2.0 |
| Pororo / brainOCR | [kakaobrain/pororo](https://github.com/kakaobrain/pororo) | Apache-2.0 |
| PaddleOCR / RapidOCR weights | ModelScope `RapidAI/RapidOCR` | Apache-2.0 |
| LaMa inpainting | [advimman/lama](https://github.com/advimman/lama) | Apache-2.0 |
| EasyOCR | [JaidedAI/EasyOCR](https://github.com/JaidedAI/EasyOCR) | Apache-2.0 |

⚠️ Some adapter code under `packages/mini-backend/models/` is derived from these upstream projects. If you
redistribute a build, review each upstream license. **GPL-3.0 components in particular have
copyleft obligations** that a downstream distribution must honour. See
[`docs/THIRD-PARTY-NOTICES.md`](../../docs/THIRD-PARTY-NOTICES.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](../../CONTRIBUTING.md) for the workflow and
[CODE_OF_CONDUCT.md](../../CODE_OF_CONDUCT.md) for community expectations. Security issues: see
[SECURITY.md](../../SECURITY.md). Please don't open a public issue for a vulnerability.

## Community

- Discord: <https://discord.gg/tzaV2efD4e>
- Website: <https://koma-studio.site/>
- Email: <klaus@koma-studio.site>

## License

[MIT](../../LICENSE) © Klaus
