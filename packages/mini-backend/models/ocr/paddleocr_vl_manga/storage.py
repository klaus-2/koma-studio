from __future__ import annotations

from pathlib import Path
from typing import Final

from core.hf_download import ensure_files_from_hf
from core.models_store import resolve_model_dir
from models.ocr.common import (
    InstalledFilePayload,
    InstallPayload,
    ModelsRootNotConfiguredError,
    missing_files,
)

PADDLEOCR_VL_MANGA_MODEL_ID: Final = "paddleocr_vl_manga"
_HF_REPO: Final = "jzhang533/PaddleOCR-VL-For-Manga"
# Remote code is loaded through transformers' `trust_remote_code` + `auto_map`;
# no package shim is created on disk and sys.path is never mutated.
_MODEL_FILES: Final[tuple[str, ...]] = (
    "added_tokens.json",
    "chat_template.jinja",
    "config.json",
    "configuration_paddleocr_vl.py",
    "generation_config.json",
    "image_processing.py",
    "model.safetensors",
    "modeling_paddleocr_vl.py",
    "preprocessor_config.json",
    "processing_paddleocr_vl.py",
    "processor_config.json",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer.model",
    "tokenizer_config.json",
)


def resolve_paddleocr_vl_manga_model_dir() -> Path | None:
    return resolve_model_dir(PADDLEOCR_VL_MANGA_MODEL_ID)


def paddleocr_vl_manga_runtime_ready() -> bool:
    model_dir = resolve_paddleocr_vl_manga_model_dir()
    return model_dir is not None and not missing_files(model_dir, _MODEL_FILES)


def ensure_paddleocr_vl_manga_installed() -> InstallPayload:
    model_dir = resolve_paddleocr_vl_manga_model_dir()
    if model_dir is None:
        raise ModelsRootNotConfiguredError(PADDLEOCR_VL_MANGA_MODEL_ID)

    raw_files = ensure_files_from_hf(
        repo=_HF_REPO, files=list(_MODEL_FILES), target_dir=model_dir, revision="main"
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
        modelId=PADDLEOCR_VL_MANGA_MODEL_ID,
        directory=str(model_dir),
        fileCount=len(files),
        files=files,
        repo=_HF_REPO,
    )
