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
# Immutable commit: `main` is a floating ref on a third-party account, and
# transformers executes the repo's Python (`trust_remote_code=True`).
_HF_REVISION: Final = "1e8aa5f1dd90cc86fe9137c9c0b26ebde613cfe8"
# SHA-256 of every executable/config asset at that commit. A hash mismatch
# deletes a poisoned local copy and re-fetches it; nothing here may float.
_PINNED_SHA256: Final[dict[str, str]] = {
    "added_tokens.json": "f59f889088e0fe21c523e7cf121bb6dca3b0bb148cb7159fbb4572c74dfc5644",
    "chat_template.jinja": "344fea8b69546526a00996468f86f583fd65441582a36f2fa4abc794aa94094c",
    "config.json": "928aaf78567a273cb73ede3671253ec4e38eb60c27a30e945bcd13b4131a0147",
    "configuration_paddleocr_vl.py": "753dd93654c3a9c8c85a3eaee1e3092dd12591b0f2dce0305e1abfb7a41ff160",
    "generation_config.json": "cf202f984e003e92dceaa27e749b60b4e6e1b566a1df8486b5b41adf1d016cea",
    "image_processing.py": "242b36a14461d81fba2913a2e736d9f7a26422c6f2cdf484a5e5a17037f78147",
    "modeling_paddleocr_vl.py": "351269f534882b2df200192adc3af6117910e9a7446caf0d6706366b1ed45d9f",
    "preprocessor_config.json": "f417a7f977820dfe6828f3ec2e461c027fdb0662f25cae4e841ec1028e0b988a",
    "processing_paddleocr_vl.py": "e29cb1e5f275f2bd3ce051bd5c9983a33894e693b2823a0e13d4c07c8c4f9e13",
    "processor_config.json": "1568858960a9760c54431dae693a6152e601ff55cdf6d2eab97a4a99958faea0",
    "special_tokens_map.json": "215bf3a1b155fafe3497f8790bedf280af92d29c2f0286c2f87a5c78baff8f7c",
    "tokenizer_config.json": "67c651ba09c22151a1fff31e8773a24f7607aef1541aa2f200b48552ed30e894",
}
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
        repo=_HF_REPO,
        files=list(_MODEL_FILES),
        target_dir=model_dir,
        revision=_HF_REVISION,
        sha256_by_file=_PINNED_SHA256,
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
