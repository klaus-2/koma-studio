"""Install-state bookkeeping for segmentation engines.

``baka_content_cc`` is a pure OpenCV algorithm: there are no weights to fetch.
"Installing" it records an opt-in marker under the managed models root so the
Model Manager can reuse its enable/disable flow. No network access is involved.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import TypedDict

from core.models_store import resolve_model_dir
from models.errors import InvalidModelSelectionError, ModelConfigurationError

SEGMENTATION_MODEL_ID = "baka_content_cc"
_MARKER_FILENAME = "segmenter.meta"
_MARKER_PAYLOAD = json.dumps(
    {"modelId": SEGMENTATION_MODEL_ID, "engine": "opencv", "weights": None},
    sort_keys=True,
    separators=(",", ":"),
).encode("utf-8")


class InstalledFileReport(TypedDict):
    target: str
    source: str
    sha256: str
    downloaded: bool


class SegmentationInstallReport(TypedDict):
    modelId: str
    directory: str
    fileCount: int
    file: InstalledFileReport


def _normalize(model_id: str) -> str:
    return model_id.strip().lower()


def resolve_segmentation_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(_normalize(model_id))


def resolve_segmentation_marker_path(model_id: str) -> Path | None:
    model_dir = resolve_segmentation_model_dir(model_id)
    return None if model_dir is None else model_dir / _MARKER_FILENAME


def segmentation_runtime_ready(model_id: str) -> bool:
    if _normalize(model_id) != SEGMENTATION_MODEL_ID:
        return False
    marker = resolve_segmentation_marker_path(model_id)
    return marker is not None and marker.is_file()


def ensure_segmentation_model_installed(model_id: str) -> SegmentationInstallReport:
    normalized = _normalize(model_id)
    if normalized != SEGMENTATION_MODEL_ID:
        raise InvalidModelSelectionError(
            f"Invalid segmentation model for managed install: {model_id!r}"
        )
    model_dir = resolve_segmentation_model_dir(normalized)
    if model_dir is None:
        raise ModelConfigurationError(
            "KOMA_MODELS_ROOT is not configured for managed segmentation installs."
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    marker = model_dir / _MARKER_FILENAME
    created = not marker.is_file()
    if created:
        marker.write_bytes(_MARKER_PAYLOAD)

    return SegmentationInstallReport(
        modelId=normalized,
        directory=str(model_dir),
        fileCount=1,
        file=InstalledFileReport(
            target=_MARKER_FILENAME,
            source="local",
            sha256=hashlib.sha256(marker.read_bytes()).hexdigest(),
            downloaded=created,
        ),
    )
