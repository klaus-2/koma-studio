from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import ensure_file_from_hf
from core.models_store import resolve_model_dir


_INPAINTING_MODEL_SOURCES: dict[str, dict[str, Any]] = {
    "aot": {
        "repo": "ogkalu/aot-inpainting",
        "target": "aot.onnx",
        "sources": [
            "aot.onnx",
            "model.onnx",
        ],
        "sha256": "ffd39ed8e2a275869d3b49180d030f0d8b8b9c2c20ed0e099ecd207201f0eada",
    },
    "lama_manga": {
        "repo": "ogkalu/lama-manga-onnx-dynamic",
        "target": "lama-manga-dynamic.onnx",
        "sources": [
            "lama-manga-dynamic.onnx",
            "model.onnx",
            "lama_manga.onnx",
            "lama.onnx",
        ],
        "sha256": "de31ffa5ba26916b8ea35319f6c12151ff9654d4261bccf0583a69bb095315f9",
    },
    "opencv_lama": {
        "repo": "opencv/inpainting_lama",
        "target": "inpainting_lama_2025jan.onnx",
        "sources": [
            "inpainting_lama_2025jan.onnx",
            "lama.onnx",
            "model.onnx",
        ],
        "sha256": "7df918ac3921d3daf0aae1d219776cf0dc4e4935f035af81841b40adcf74fdf2",
    },
    "lama_fp32": {
        "repo": "Carve/LaMa-ONNX",
        "target": "lama_fp32.onnx",
        "sources": [
            "lama_fp32.onnx",
        ],
        "sha256": "1faef5301d78db7dda502fe59966957ec4b79dd64e16f03ed96913c7a4eb68d6",
    },
}


def _get_model_source(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    source = _INPAINTING_MODEL_SOURCES.get(normalized)
    if not source:
        raise RuntimeError(f"Invalid inpainting model for managed install: {model_id}")
    return source


def resolve_inpainting_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(model_id.strip().lower())


def resolve_inpainting_model_path(model_id: str) -> Path | None:
    model_dir = resolve_inpainting_model_dir(model_id)
    if model_dir is None:
        return None

    source = _get_model_source(model_id)
    return model_dir / str(source["target"])


def inpainting_runtime_ready(model_id: str) -> bool:
    model_path = resolve_inpainting_model_path(model_id)
    return bool(model_path and model_path.exists())


def ensure_inpainting_model_installed(model_id: str) -> dict[str, Any]:
    normalized = (model_id or "").strip().lower()
    source = _get_model_source(normalized)
    model_dir = resolve_inpainting_model_dir(normalized)
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed inpainting installs.",
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    target_path = model_dir / str(source["target"])
    payload = ensure_file_from_hf(
        repo=str(source["repo"]),
        candidate_paths=[str(item) for item in source.get("sources", [])],
        target_path=target_path,
        revision="main",
        expected_sha256=str(source.get("sha256") or ""),
    )

    return {
        "modelId": normalized,
        "directory": str(model_dir),
        "fileCount": 1,
        "file": {
            "target": str(source["target"]),
            "source": payload["path"],
            "sha256": payload["sha256"],
            "downloaded": payload["downloaded"],
        },
        "repo": str(source["repo"]),
    }
