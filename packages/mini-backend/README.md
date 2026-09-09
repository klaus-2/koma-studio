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
pip install -r requirements.txt
python app.py                       # serves on http://127.0.0.1:8001
```

The mini-backend binds to `127.0.0.1` by design — it is intended for loopback
use only. The shells supervise the sidecar (start / health check / restart on
crash) and shut it down at app exit.

## Configuration

All runtime config comes from environment variables. The shells ship a curated
subset in their `.env.example` files; the most relevant ones for local
experimentation:

- `MINI_BACKEND_ACCELERATION_PROFILE` — force a profile (overrides auto-detect)
- `MINI_BACKEND_*_API_KEY` — optional cloud OCR / translation provider keys
- `KOMA_MODELS_ROOT` — override the on-disk model cache directory
- `KOMA_PORORO_ALLOW_DOWNLOAD` — when `1`, the vendored Pororo OCR can fetch
  its checkpoints on first use
- `PORT` — uvicorn port (default `8001`)
- `MINI_BACKEND_EXPOSE_MEMORY_ENDPOINTS` — off by default; set to `1` or
  `true` to expose `/memory/stats` and `/memory/clear-caches` without session
  auth. Endpoints are diagnostic only.

See `core/config.py` and `core/cloud_registry.py` for the complete list.

## Tests

```bash
cd packages/mini-backend
python -m pytest tests -q
```

Tests do not require ONNX / FastAPI to be importable (they cover the pure-Python
parts: download jobs, pipeline batching, translation preprocessing).
