# packages/mini-backend

Local Python service that powers the AI pipeline (detection, OCR, inpainting,
translation, model downloads). It is **a Python workspace, not a Bun workspace
or a Node package** — it is consumed by both desktop shells (`apps/electron`
and `apps/tauri`) as a sidecar process.

## Stack

- Python 3.12 (CI runs 3.12; the runtime works on 3.11+)
- FastAPI + uvicorn
- ONNX Runtime (`onnxruntime` for CPU, `onnxruntime-gpu` for NVIDIA CUDA)
- PyTorch (selected translation models)
- Local-model orchestration lives in `core/download_jobs.py` (the canonical
  download manager — both shells go through it for every model fetch)

## Layout

```
packages/mini-backend
├── app.py                      # FastAPI entrypoint
├── routers/                    # HTTP endpoints (pipeline, models, etc.)
├── core/                       # device, downloads, hf_download, cloud registry
├── models/                     # detection, OCR, inpainting, translation
│   └── ocr/pororo/             # vendored Korean OCR library (do not modify)
├── services/                   # cleaning, cloud cleaning, cloud OCR
├── utils/                      # small shared utilities
├── tests/                      # pytest suite
├── requirements*.txt           # per-profile dependency pins
└── scripts/ensure-mini-deps.py # the canonical Python-sidecar dependency installer
```

## Acceleration profiles

The mini-backend picks the right ONNX Runtime variant for the host GPU.
Profiles are stored in `scripts/ensure-mini-deps.py` (single source of truth — the
Tauri shell's parity test parses this dict).

| Profile              | Windows         | Linux           | macOS           |
| -------------------- | --------------- | --------------- | --------------- |
| `cpu` (default)      | ✅              | ✅              | ✅              |
| `nvidia-cuda`        | ✅              | ✅              | —               |
| `nvidia-tensorrt`    | ✅              | ✅              | —               |
| `nvidia-cuda-legacy` | ✅ (Pascal/CC6.1) | ✅            | —               |
| `amd-rocm`           | —               | ✅              | —               |
| `intel-openvino`     | ✅              | ✅              | —               |
| `apple-mps`          | —               | —               | ✅              |

The shell picks automatically on first run (you can override with
`MINI_BACKEND_ACCELERATION_PROFILE=cpu|nvidia-cuda|…`).

## Local development

```bash
# from the repo root
cd packages/mini-backend
python -m venv .venv
source .venv/bin/activate           # or .venv\Scripts\Activate.ps1 on Windows
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py                       # serves on http://127.0.0.1:8001
```

The mini-backend binds to `127.0.0.1` by design — it is intended for loopback
use only. The shells supervise the sidecar (start / health check / restart on
crash) and shut it down at app exit. Startup is health-gated: the shells wait
on `/health` before marking the sidecar ready — the single uvicorn worker
blocks during ONNX warmup, which can take minutes on slow machines, and a
startup timeout folds into the `HealthTimeout` restart path. The `/device/info`
runtime-state sync is eventual (retried in the background); boot never waits
for it.

## Configuration

All runtime config comes from environment variables. The shells ship a curated
subset in their `.env.example` files; the most relevant ones for local
experimentation:

- `MINI_BACKEND_ACCELERATION_PROFILE` — force a profile (overrides auto-detect)
- `MINI_BACKEND_*_API_KEY` — optional cloud OCR / translation provider keys
- `KOMA_MODELS_ROOT` — override the on-disk model cache directory
- `KOMA_PORORO_ALLOW_DOWNLOAD` — when `1`, the vendored Pororo OCR can fetch
  its checkpoints on first use
- `KOMA_APP_DATA_DIR` — app-data directory for sidecar state that outlives the
  models cache (the persistent translation store, crash logs); the Tauri shell
  sets it to the models root's parent, dev fallback is `~/.koma-studio`
- `PORT` — uvicorn port (default `8001`)
- `MINI_BACKEND_EXPOSE_MEMORY_ENDPOINTS` — off by default; set to `1` or
  `true` to expose `/memory/stats` and `/memory/clear-caches` without session
  auth. Endpoints are diagnostic only.

See `core/config.py` and `core/cloud_registry.py` for the complete list.

## Request settings (`llm_settings`)

Per-request knobs travel in the `llm_settings` form field (JSON object), parsed
by `clamp_llm_request_settings` in `core/config.py`. Translation-specific ones:

- `translation_notes_enabled` (bool, default `true`)
- `translation_fallback_chain` (list of engine keys, default empty). When
  present, both `POST /translate` **and** the AIO batch Get Translations stage
  try the requested engine first and then each key in order,
  moving to the next one only on transport-level failures (unavailable, bad
  response, broken local runtime); configuration errors and unsupported
  language pairs fail fast with the original 400. The parser keeps at most 4
  keys, drops non-strings and duplicates, and every key is validated against
  the registry (`GET /translate/models`) before any engine is resolved — an
  unknown key is a loud 400, never a silent `google_translate` attempt. The
  `custom:` request-scoped path never chains. `model_used` reports the engine
  that actually answered, and the attempts are logged at WARNING only (the
  response schema is unchanged). Implementation: `models/translation/fallback.py`.
- `translation_memory_enabled` (bool, default `false`) — gates **reads** from
  the persistent translation memory only. Writes are not gated: every
  successful, non-identical, non-echo-repaired engine answer is recorded (SFX
  mode skips TM writes entirely).
- Engine keys are case-insensitive: they go through `normalize_stage_model_key`,
  so `a` and `A` are the same key, and a free endpoint already ships at
  `models/translation/providers/google.py` (`google_translate`, no API key).

A provider that was unreachable stays blocked **for the local calendar day** in
the in-memory `QuotaBlocklist` (`models/translation/fallback.py`); the block is
per process, resets on the next day or a restart, and is not a quota server.

### Persistent store, QA, and never-translate terms

- **Persistent store**: translations are also written to a stdlib-sqlite store
  at `<KOMA_APP_DATA_DIR>/translation-store.sqlite3` (dev fallback
  `~/.koma-studio`) with a WAL journal and two tables — `translation_cache`
  keyed by a version-pinned SHA-256 of (model, language pair, translation mode,
  normalized source text, glossary hash) and `tm` for cross-model exact-match
  lookups (NFKC-normalized source, no fuzz matching). It prunes each table to
  the newest 200k rows on open, survives restarts, and is **not** cleared by
  `/memory/clear-caches` or `_clear_all_caches` — it is closed only at process
  shutdown. Implementation: `pipelines/translation_store.py`.
- **Stage store**: segment and clean stage results are also cached in a
  stdlib-sqlite store at `<KOMA_APP_DATA_DIR>/stage-store.sqlite3` (dev
  fallback `~/.koma-studio`), fingerprint-keyed and pruned at open, closed
  only at process shutdown. Implementation: `pipelines/stage_store.py`.
- **Consultation order** per request: in-memory cache → symbol-only passthrough
  (non-alphanumeric seeds skip engines, caches, and QA entirely) → persistent
  cache → TM (only when `translation_memory_enabled`) → dedup of identical
  seeds → engine → QA → cache/TM writes.
- **Degradation**: if the store cannot be opened or a store operation fails,
  the stage degrades to in-memory-only caching with a once-per-process WARNING
  (`translation.store.degraded_to_memory`) — a store failure never 500s a
  request.
- **`never_translate` glossary flag** (`GlossaryTerm.never_translate`, default
  `false`): flagged terms never reach a local model — the text is split into
  prose runs, the runs are translated, and the terms are reassembled verbatim
  with the original whitespace (parity guarantee). Cloud engines receive the
  terms via prompt as before. A cache/TM hit answered by a local engine is
  discarded when a protected term is missing (parity guard), the mandatory-term
  post-check appends notes for local engines (skipped in SFX), and a masked run
  that comes back blank raises `BlankRunTranslationError` — retryable in
  fallback chains.
  Implementation: `pipelines/translation_masking.py`.
- **QA layer**: detectors annotate via `translation_notes` (echo / repetition,
  foreign residue, length ratio, empty and identical-to-source); the heuristic
  ones are skipped in SFX mode. Echo collapse only rewrites at 3+ repetitions,
  and only when the collapsed text re-passes the same detectors.
  Implementation: `pipelines/translation_qa.py`.

## Tests

```bash
cd packages/mini-backend
python -m pytest tests -q
```

Tests do not require ONNX / FastAPI to be importable (they cover the pure-Python
parts: download jobs, pipeline batching, translation preprocessing).
