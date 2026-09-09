from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import ensure_file_from_hf
from core.models_store import resolve_model_dir


_MEIKI_MODEL_ID = "meiki_ocr"
_MEIKI_REPO = "rtr46/meiki.txt.recognition.v0"
_MEIKI_FILES: list[dict[str, str]] = [
    {
        "target": "meiki.text.rec.v0.960x32.onnx",
        "candidate": "meiki.text.rec.v0.960x32.onnx",
    },
    {
        "target": "meiki.text.rec.v0.vertical.32x480.onnx",
        "candidate": "meiki.text.rec.v0.vertical.32x480.onnx",
    },
]


def resolve_meiki_model_dir() -> Path | None:
    return resolve_model_dir(_MEIKI_MODEL_ID)


def meiki_runtime_ready() -> bool:
    model_dir = resolve_meiki_model_dir()
    if model_dir is None:
        return False
    return all((model_dir / item["target"]).exists() for item in _MEIKI_FILES)


def ensure_meiki_models_installed() -> dict[str, Any]:
    model_dir = resolve_meiki_model_dir()
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed Meiki OCR installs.",
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    files_payload: list[dict[str, Any]] = []
    for item in _MEIKI_FILES:
        target_path = model_dir / item["target"]
        payload = ensure_file_from_hf(
            repo=_MEIKI_REPO,
            candidate_paths=[item["candidate"]],
            target_path=target_path,
            revision="main",
        )
        files_payload.append(
            {
                "target": item["target"],
                "source": payload["path"],
                "sha256": payload["sha256"],
                "downloaded": payload["downloaded"],
            }
        )

    return {
        "modelId": _MEIKI_MODEL_ID,
        "directory": str(model_dir),
        "fileCount": len(files_payload),
        "files": files_payload,
        "repo": _MEIKI_REPO,
    }
