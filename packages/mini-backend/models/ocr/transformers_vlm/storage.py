from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from core.hf_download import ensure_files_from_hf
from core.models_store import resolve_model_dir
from models.ocr.common import (
    InstalledFilePayload,
    InstallPayload,
    ModelsRootNotConfiguredError,
    UnknownManagedModelError,
    missing_files,
)


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
    return not missing_files(model_dir, source.files)


def ensure_transformers_vlm_model_installed(model_id: str) -> InstallPayload:
    normalized = (model_id or "").strip().lower()
    source = _get_transformers_vlm_source(normalized)
    model_dir = resolve_transformers_vlm_model_dir(normalized)
    if model_dir is None:
        raise ModelsRootNotConfiguredError(normalized)

    raw_files = ensure_files_from_hf(
        repo=source.repo,
        files=list(source.files),
        target_dir=model_dir,
        revision="main",
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
