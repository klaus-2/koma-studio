from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import ensure_file_from_hf
from core.models_store import resolve_model_dir


_SEGMENTATION_MODEL_ID = "baka_content_cc"
_SEGMENTATION_REPO = "ogkalu/comic-text-and-bubble-detector"
_SEGMENTATION_TARGET_FILE = "segmenter.meta"


def resolve_segmentation_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(model_id.strip().lower())


def resolve_segmentation_marker_path(model_id: str) -> Path | None:
    model_dir = resolve_segmentation_model_dir(model_id)
    if model_dir is None:
        return None
    return model_dir / _SEGMENTATION_TARGET_FILE


def segmentation_runtime_ready(model_id: str) -> bool:
    if (model_id or "").strip().lower() != _SEGMENTATION_MODEL_ID:
        return False
    marker_path = resolve_segmentation_marker_path(model_id)
    return bool(marker_path and marker_path.exists())


def ensure_segmentation_model_installed(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    if normalized != _SEGMENTATION_MODEL_ID:
        raise RuntimeError(f"Invalid segmentation model for managed install: {model_id}")

    model_dir = resolve_segmentation_model_dir(normalized)
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed segmentation installs.",
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    marker_path = model_dir / _SEGMENTATION_TARGET_FILE
    payload = ensure_file_from_hf(
        repo=_SEGMENTATION_REPO,
        candidate_paths=["README.md"],
        target_path=marker_path,
        revision="main",
    )

    return {
        "modelId": normalized,
        "directory": str(model_dir),
        "fileCount": 1,
        "file": {
            "target": _SEGMENTATION_TARGET_FILE,
            "source": payload["path"],
            "sha256": payload["sha256"],
            "downloaded": payload["downloaded"],
        },
        "repo": _SEGMENTATION_REPO,
    }

