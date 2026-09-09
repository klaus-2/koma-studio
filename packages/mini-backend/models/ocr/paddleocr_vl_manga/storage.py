from __future__ import annotations

from pathlib import Path
from typing import Any

from core.hf_download import ensure_files_from_hf
from core.models_store import resolve_model_dir


_MODEL_ID = "paddleocr_vl_manga"
_MODEL_REPO = "jzhang533/PaddleOCR-VL-For-Manga"
_MODEL_FILES = [
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
]


def resolve_paddleocr_vl_manga_model_dir() -> Path | None:
    return resolve_model_dir(_MODEL_ID)


def paddleocr_vl_manga_runtime_ready() -> bool:
    model_dir = resolve_paddleocr_vl_manga_model_dir()
    if model_dir is None:
        return False
    return all((model_dir / relative_path).exists() for relative_path in _MODEL_FILES)


def ensure_paddleocr_vl_manga_installed() -> dict[str, Any]:
    model_dir = resolve_paddleocr_vl_manga_model_dir()
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed PaddleOCRVLManga installs.",
        )

    files_payload = ensure_files_from_hf(
        repo=_MODEL_REPO,
        files=_MODEL_FILES,
        target_dir=model_dir,
        revision="main",
    )
    init_file = model_dir / "__init__.py"
    init_created = not init_file.exists()
    if init_created:
        init_file.write_text("", encoding="utf-8")
    files_payload.append({
        "target": "__init__.py",
        "source": "generated-local",
        "sha256": "",
        "downloaded": init_created,
    })
    return {
        "modelId": _MODEL_ID,
        "directory": str(model_dir),
        "fileCount": len(files_payload),
        "files": files_payload,
        "repo": _MODEL_REPO,
    }
