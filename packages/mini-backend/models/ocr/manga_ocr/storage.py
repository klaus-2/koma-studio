from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from core.hf_download import ensure_file_from_hf
from models.errors import ModelConfigurationError

_MODEL_ROOT_ENV = "KOMA_MODELS_ROOT"
_MANGA_OCR_SUBDIR = "manga_ocr"
_HF_REPO = "mayocream/manga-ocr-onnx"

ENCODER_FILE = "encoder_model.onnx"
DECODER_FILE = "decoder_model.onnx"
VOCAB_FILE = "vocab.txt"


@dataclass(frozen=True, slots=True)
class ManagedFile:
    name: str
    sha256: str


# SHA values copied from the historical registry - wire contract with HF.
REQUIRED_FILES: tuple[ManagedFile, ...] = (
    ManagedFile(ENCODER_FILE, "15fa8155fe9bc1a7d25d9bb353debaa4def033d0174e907dbd2dd6d995def85f"),
    ManagedFile(DECODER_FILE, "ef7765261e9d1cdc34d89356986c2bbc2a082897f753a89605ae80fdfa61f5e8"),
    ManagedFile(VOCAB_FILE, "5cb5c5586d98a2f331d9f8828e4586479b0611bfba5d8c3b6dadffc84d6a36a3"),
)


def resolve_manga_ocr_model_dir() -> Path | None:
    raw_root = os.getenv(_MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None
    return Path(raw_root).expanduser().resolve() / _MANGA_OCR_SUBDIR


def manga_ocr_runtime_ready() -> bool:
    model_dir = resolve_manga_ocr_model_dir()
    return model_dir is not None and all(
        (model_dir / item.name).is_file() for item in REQUIRED_FILES
    )


def ensure_manga_ocr_models_installed() -> dict[str, object]:
    model_dir = resolve_manga_ocr_model_dir()
    if model_dir is None:
        raise ModelConfigurationError(
            "KOMA_MODELS_ROOT is not configured for managed Manga OCR installs."
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    for item in REQUIRED_FILES:
        ensure_file_from_hf(
            repo=_HF_REPO,
            candidate_paths=[item.name],
            target_path=model_dir / item.name,
            revision="main",
            expected_sha256=item.sha256,
        )

    files = sorted(
        path.relative_to(model_dir).as_posix()
        for path in model_dir.rglob("*")
        if path.is_file()
    )
    return {"directory": str(model_dir), "fileCount": len(files), "files": files}
