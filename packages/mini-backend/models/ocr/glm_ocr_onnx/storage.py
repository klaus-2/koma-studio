from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import ensure_files_from_hf
from core.models_store import resolve_model_dir


_MODEL_ID = "glm_ocr_onnx"
_MODEL_REPO = "zai-org/GLM-OCR"
_MODEL_FILES = [
    "chat_template.jinja",
    "config.json",
    "generation_config.json",
    "preprocessor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "model.safetensors",
]


def resolve_glm_ocr_onnx_model_dir() -> Path | None:
    return resolve_model_dir(_MODEL_ID)


def glm_ocr_onnx_runtime_ready() -> bool:
    model_dir = resolve_glm_ocr_onnx_model_dir()
    if model_dir is None:
        return False
    return all((model_dir / relative_path).exists() for relative_path in _MODEL_FILES)


def ensure_glm_ocr_onnx_installed() -> dict[str, Any]:
    model_dir = resolve_glm_ocr_onnx_model_dir()
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed GLM-OCR installs.",
        )

    files_payload = ensure_files_from_hf(
        repo=_MODEL_REPO,
        files=_MODEL_FILES,
        target_dir=model_dir,
        revision="main",
    )
    return {
        "modelId": _MODEL_ID,
        "directory": str(model_dir),
        "fileCount": len(files_payload),
        "files": files_payload,
        "repo": _MODEL_REPO,
    }
