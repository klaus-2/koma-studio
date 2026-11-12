from __future__ import annotations

import logging

from pathlib import Path
from typing import Any

from core.hf_download import ensure_files_from_hf, progress_bridge_var
from core.models_store import resolve_model_dir
from models.manifests import (
    manifest_asset_is_valid,
    manifest_assets_by_path,
    manifest_declared_total,
)



logger = logging.getLogger(__name__)
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
    assets_by_path = manifest_assets_by_path(_MODEL_ID)
    for relative_path in _MODEL_FILES:
        file_path = model_dir / relative_path
        try:
            if not file_path.exists():
                return False
            asset = assets_by_path.get(relative_path)
            if asset is not None and file_path.stat().st_size != int(asset["size"]):
                return False
        except OSError:
            return False
        except (KeyError, TypeError, ValueError):
            logger.warning("Readiness size gate hit malformed manifest data for %s", "glm_ocr_onnx")
            return False
    return True


def ensure_glm_ocr_onnx_installed() -> dict[str, Any]:
    model_dir = resolve_glm_ocr_onnx_model_dir()
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed GLM-OCR installs.",
        )

    assets_by_path = manifest_assets_by_path(_MODEL_ID)
    missing = [path for path in _MODEL_FILES if path not in assets_by_path]
    if missing:
        raise RuntimeError(
            f"Managed OCR model '{_MODEL_ID}' has assets missing from the "
            f"model asset manifest: {', '.join(missing)}"
        )
    malformed = [
        path for path in _MODEL_FILES if not manifest_asset_is_valid(assets_by_path[path])
    ]
    if malformed:
        raise RuntimeError(
            f"Managed OCR model '{_MODEL_ID}' has malformed manifest asset "
            f"digests or sizes: {', '.join(malformed)}"
        )
    total_bytes = manifest_declared_total(_MODEL_ID)
    if total_bytes is not None:
        bridge = progress_bridge_var.get()
        if bridge is not None:
            bridge.declare_total(total_bytes)

    files_payload = ensure_files_from_hf(
        repo=_MODEL_REPO,
        files=_MODEL_FILES,
        target_dir=model_dir,
        revision="main",
        sha256_by_file={path: str(assets_by_path[path]["sha256"]) for path in _MODEL_FILES},
        size_by_file={path: int(assets_by_path[path]["size"]) for path in _MODEL_FILES},
    )
    return {
        "modelId": _MODEL_ID,
        "directory": str(model_dir),
        "fileCount": len(files_payload),
        "files": files_payload,
        "repo": _MODEL_REPO,
    }
