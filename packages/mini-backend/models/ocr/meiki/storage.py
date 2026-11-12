from __future__ import annotations

import logging

from pathlib import Path
from typing import Final

from core.hf_download import ensure_file_from_hf, progress_bridge_var
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
)

MEIKI_MODEL_ID: Final = "meiki_ocr"
MEIKI_HF_REPO: Final = "rtr46/meiki.txt.recognition.v0"
MEIKI_HORIZONTAL_MODEL_FILE: Final = "meiki.text.rec.v0.960x32.onnx"
MEIKI_VERTICAL_MODEL_FILE: Final = "meiki.text.rec.v0.vertical.32x480.onnx"
MEIKI_MODEL_FILES: Final[tuple[str, ...]] = (
    MEIKI_HORIZONTAL_MODEL_FILE,
    MEIKI_VERTICAL_MODEL_FILE,
)



logger = logging.getLogger(__name__)
def resolve_meiki_model_dir() -> Path | None:
    return resolve_model_dir(MEIKI_MODEL_ID)


def meiki_runtime_ready() -> bool:
    model_dir = resolve_meiki_model_dir()
    if model_dir is None:
        return False
    assets_by_path = manifest_assets_by_path(MEIKI_MODEL_ID)
    for filename in MEIKI_MODEL_FILES:
        file_path = model_dir / filename
        try:
            if not file_path.exists():
                return False
            asset = assets_by_path.get(filename)
            if asset is not None and file_path.stat().st_size != int(asset["size"]):
                return False
        except OSError:
            return False
        except (KeyError, TypeError, ValueError):
            logger.warning("Readiness size gate hit malformed manifest data for %s", "meiki")
            return False
    return True


def ensure_meiki_models_installed() -> InstallPayload:
    model_dir = resolve_meiki_model_dir()
    if model_dir is None:
        raise ModelsRootNotConfiguredError(MEIKI_MODEL_ID)

    assets_by_path = manifest_assets_by_path(MEIKI_MODEL_ID)
    missing = [name for name in MEIKI_MODEL_FILES if name not in assets_by_path]
    if missing:
        raise RuntimeError(
            f"Managed OCR model '{MEIKI_MODEL_ID}' has assets missing from the "
            f"model asset manifest: {', '.join(missing)}"
        )
    malformed = [
        name for name in MEIKI_MODEL_FILES if not manifest_asset_is_valid(assets_by_path[name])
    ]
    if malformed:
        raise RuntimeError(
            f"Managed OCR model '{MEIKI_MODEL_ID}' has malformed manifest asset "
            f"digests or sizes: {', '.join(malformed)}"
        )
    total_bytes = manifest_declared_total(MEIKI_MODEL_ID)
    if total_bytes is not None:
        bridge = progress_bridge_var.get()
        if bridge is not None:
            bridge.declare_total(total_bytes)

    model_dir.mkdir(parents=True, exist_ok=True)
    files: list[InstalledFilePayload] = []
    for filename in MEIKI_MODEL_FILES:
        payload = ensure_file_from_hf(
            repo=MEIKI_HF_REPO,
            candidate_paths=[filename],
            target_path=model_dir / filename,
            revision="main",
            expected_sha256=str(assets_by_path[filename]["sha256"]),
            expected_size=int(assets_by_path[filename]["size"]),
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
