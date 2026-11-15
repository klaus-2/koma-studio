from __future__ import annotations

import logging

from dataclasses import dataclass
from pathlib import Path
from typing import Final

from core.hf_download import ensure_files_from_hf, progress_bridge_var
from core.models_store import resolve_model_dir
from models.manifests import (
    manifest_asset_is_valid,
    manifest_assets_by_path,
    manifest_declared_total,
)
from models.ocr.common import (
    InstalledFilePayload,
    InstallPayload,
    ModelsRootNotConfiguredError,
    UnknownManagedModelError,
)


# Pre-load free-VRAM requirement per managed VLM (bytes). Single source of
# truth: the engine probe reads it before `model.to(device)` and the OCR
# factory specs mirror it (parity is tested). Only declared models are
# checked; undeclared models keep the existing GPU choice. glm_ocr_onnx and
# paddleocr_vl_manga have runtimes of their own (no probe) but still declare
# the same limits for spec/payload parity.
GOT_OCR2_MIN_VRAM_BYTES: Final = 8 * 1024**3

logger = logging.getLogger(__name__)
VLM_MIN_VRAM_BYTES: Final[dict[str, int]] = {
    "got_ocr2": GOT_OCR2_MIN_VRAM_BYTES,
    "qwen2_5_vl_3b": 8 * 1024**3,
    "glm_ocr_onnx": 8 * 1024**3,
    "paddleocr_vl_1_5": 8 * 1024**3,
    "paddleocr_vl_manga": 10 * 1024**3,
    "mangalmm": 14 * 1024**3,
    "rolmocr": 14 * 1024**3,
}


@dataclass(frozen=True, slots=True)
class HfModelSource:
    repo: str
    files: tuple[str, ...]


_TRANSFORMERS_VLM_MODEL_SOURCES: dict[str, HfModelSource] = {
    "got_ocr2": HfModelSource(
        repo="stepfun-ai/GOT-OCR-2.0-hf",
        files=(
            "config.json",
            "generation_config.json",
            "model.safetensors",
            "preprocessor_config.json",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
        ),
    ),
    "qwen2_5_vl_3b": HfModelSource(
        repo="Qwen/Qwen2.5-VL-3B-Instruct",
        files=(
            "chat_template.json",
            "config.json",
            "generation_config.json",
            "merges.txt",
            "model-00001-of-00002.safetensors",
            "model-00002-of-00002.safetensors",
            "model.safetensors.index.json",
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        ),
    ),
    "mangalmm": HfModelSource(
        repo="hal-utokyo/MangaLMM",
        files=(
            "added_tokens.json",
            "chat_template.json",
            "config.json",
            "generation_config.json",
            "merges.txt",
            "model-00001-of-00004.safetensors",
            "model-00002-of-00004.safetensors",
            "model-00003-of-00004.safetensors",
            "model-00004-of-00004.safetensors",
            "model.safetensors.index.json",
            "preprocessor_config.json",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        ),
    ),
    "rolmocr": HfModelSource(
        repo="reducto/RolmOCR",
        files=(
            "added_tokens.json",
            "chat_template.json",
            "config.json",
            "generation_config.json",
            "merges.txt",
            "model-00001-of-00004.safetensors",
            "model-00002-of-00004.safetensors",
            "model-00003-of-00004.safetensors",
            "model-00004-of-00004.safetensors",
            "model.safetensors.index.json",
            "preprocessor_config.json",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "vocab.json",
        ),
    ),
    "paddleocr_vl_1_5": HfModelSource(
        repo="PaddlePaddle/PaddleOCR-VL-1.5",
        files=(
            "added_tokens.json",
            "chat_template.jinja",
            "config.json",
            "configuration_paddleocr_vl.py",
            "generation_config.json",
            "image_processing_paddleocr_vl.py",
            "modeling_paddleocr_vl.py",
            "preprocessor_config.json",
            "processing_paddleocr_vl.py",
            "processor_config.json",
            "model.safetensors",
            "special_tokens_map.json",
            "tokenizer.json",
            "tokenizer.model",
            "tokenizer_config.json",
        ),
    ),
}


def transformers_vlm_min_vram_bytes(model_id: str) -> int | None:
    """Declared free-VRAM requirement for a managed VLM, or None when undeclared."""
    return VLM_MIN_VRAM_BYTES.get((model_id or "").strip().lower())


def _get_transformers_vlm_source(model_id: str) -> HfModelSource:
    normalized = (model_id or "").strip().lower()
    source = _TRANSFORMERS_VLM_MODEL_SOURCES.get(normalized)
    if not source:
        raise UnknownManagedModelError(model_id)
    return source


def resolve_transformers_vlm_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(model_id.strip().lower())


def transformers_vlm_runtime_ready(model_id: str) -> bool:
    model_dir = resolve_transformers_vlm_model_dir(model_id)
    if model_dir is None:
        return False
    source = _get_transformers_vlm_source(model_id)
    assets_by_path = manifest_assets_by_path((model_id or "").strip().lower())
    for relative_path in source.files:
        file_path = model_dir / relative_path
        try:
            if not file_path.exists():
                return False
            asset = assets_by_path.get(relative_path)
            if asset is None:
                continue
            if file_path.stat().st_size != int(asset["size"]):
                return False
        except OSError:
            return False
        except (KeyError, TypeError, ValueError):
            logger.warning("Readiness size gate hit malformed manifest data for %s", "vlm")
            return False
    return True


def ensure_transformers_vlm_model_installed(model_id: str) -> InstallPayload:
    normalized = (model_id or "").strip().lower()
    source = _get_transformers_vlm_source(normalized)
    model_dir = resolve_transformers_vlm_model_dir(normalized)
    if model_dir is None:
        raise ModelsRootNotConfiguredError(normalized)

    assets_by_path = manifest_assets_by_path(normalized)
    missing = [path for path in source.files if path not in assets_by_path]
    if missing:
        raise RuntimeError(
            f"Managed VLM model '{normalized}' has assets missing from the "
            f"model asset manifest: {', '.join(missing)}"
        )
    malformed = [
        path for path in source.files if not manifest_asset_is_valid(assets_by_path[path])
    ]
    if malformed:
        raise RuntimeError(
            f"Managed VLM model '{normalized}' has malformed manifest asset "
            f"digests or sizes: {', '.join(malformed)}"
        )
    total_bytes = manifest_declared_total(normalized)
    if total_bytes is None:
        raise RuntimeError(
            f"Managed VLM model '{normalized}' has a malformed manifest totalBytes."
        )

    bridge = progress_bridge_var.get()
    if bridge is not None:
        bridge.declare_total(total_bytes)

    raw_files = ensure_files_from_hf(
        repo=source.repo,
        files=list(source.files),
        target_dir=model_dir,
        revision="main",
        sha256_by_file={path: str(assets_by_path[path]["sha256"]) for path in source.files},
        size_by_file={path: int(assets_by_path[path]["size"]) for path in source.files},
    )
    files = [
        InstalledFilePayload(
            target=str(item["target"]),
            source=str(item["source"]),
            sha256=str(item["sha256"]),
            downloaded=bool(item["downloaded"]),
        )
        for item in raw_files
    ]
    return InstallPayload(
        modelId=normalized,
        directory=str(model_dir),
        fileCount=len(files),
        files=files,
        repo=source.repo,
    )
