from __future__ import annotations

from pathlib import Path
from typing import Final

from core.hf_download import ensure_file_from_hf
from core.models_store import resolve_model_dir
from models.ocr.common import (
    InstalledFilePayload,
    InstallPayload,
    ModelsRootNotConfiguredError,
    missing_files,
)

MEIKI_MODEL_ID: Final = "meiki_ocr"
MEIKI_HF_REPO: Final = "rtr46/meiki.txt.recognition.v0"
MEIKI_HORIZONTAL_MODEL_FILE: Final = "meiki.text.rec.v0.960x32.onnx"
MEIKI_VERTICAL_MODEL_FILE: Final = "meiki.text.rec.v0.vertical.32x480.onnx"
MEIKI_MODEL_FILES: Final[tuple[str, ...]] = (
    MEIKI_HORIZONTAL_MODEL_FILE,
    MEIKI_VERTICAL_MODEL_FILE,
)


def resolve_meiki_model_dir() -> Path | None:
    return resolve_model_dir(MEIKI_MODEL_ID)


def meiki_runtime_ready() -> bool:
    model_dir = resolve_meiki_model_dir()
    return model_dir is not None and not missing_files(model_dir, MEIKI_MODEL_FILES)


def ensure_meiki_models_installed() -> InstallPayload:
    model_dir = resolve_meiki_model_dir()
    if model_dir is None:
        raise ModelsRootNotConfiguredError(MEIKI_MODEL_ID)

    model_dir.mkdir(parents=True, exist_ok=True)
    files: list[InstalledFilePayload] = []
    for filename in MEIKI_MODEL_FILES:
        payload = ensure_file_from_hf(
            repo=MEIKI_HF_REPO,
            candidate_paths=[filename],
            target_path=model_dir / filename,
            revision="main",
        )
        files.append(
            InstalledFilePayload(
                target=filename,
                source=str(payload["path"]),
                sha256=str(payload["sha256"]),
                downloaded=bool(payload["downloaded"]),
            )
        )

    return InstallPayload(
        modelId=MEIKI_MODEL_ID,
        directory=str(model_dir),
        fileCount=len(files),
        files=files,
        repo=MEIKI_HF_REPO,
    )
