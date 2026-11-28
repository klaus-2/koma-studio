from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Final, TypedDict

from core.hf_download import ensure_file_from_hf, progress_bridge_var, report_bridge_file
from core.models_store import resolve_model_dir
from models.detection.storage import detection_runtime_ready, ensure_detection_model_installed
from models.errors import InvalidModelSelectionError, ModelConfigurationError
from models.manifests import (
    manifest_asset_is_valid,
    manifest_assets_by_path,
    manifest_declared_total,
)

SEGMENTATION_MODEL_ID = "baka_content_cc"
CTD_SEGMENTATION_MODEL_ID = "ctd_text_seg"
COMIC_TEXT_MASK_MODEL_ID = "comic_text_mask"
SUPPORTED_SEGMENTATION_MODEL_IDS: Final[frozenset[str]] = frozenset(
    {SEGMENTATION_MODEL_ID, CTD_SEGMENTATION_MODEL_ID, COMIC_TEXT_MASK_MODEL_ID}
)

_MARKER_FILENAME = "segmenter.meta"
_MARKER_PAYLOAD = json.dumps(
    {"modelId": SEGMENTATION_MODEL_ID, "engine": "opencv", "weights": None},
    sort_keys=True,
    separators=(",", ":"),
).encode("utf-8")

_COMIC_TEXT_MASK_REPO: Final[str] = "DeWoke/comic-text-mask-onnx"
_COMIC_TEXT_MASK_FILE: Final[str] = "model.onnx"
_COMIC_TEXT_MASK_SHA256: Final[str] = (
    "39bc654215441407f2df02177af0143c176af338770ae0da6cd9fad3197dc853"
)
_COMIC_TEXT_MASK_SIZE: Final[int] = 57_312_337

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
    normalized = _normalize(model_id)
    if normalized == SEGMENTATION_MODEL_ID:
        marker = resolve_segmentation_marker_path(normalized)
        return marker is not None and marker.is_file()
    if normalized == CTD_SEGMENTATION_MODEL_ID:
        return detection_runtime_ready("comic_text_detector")
    if normalized == COMIC_TEXT_MASK_MODEL_ID:
        model_dir = resolve_segmentation_model_dir(normalized)
        if model_dir is None:
            return False
        weights = model_dir / _COMIC_TEXT_MASK_FILE
        if not weights.is_file():
            return False
        asset = manifest_assets_by_path(normalized).get(_COMIC_TEXT_MASK_FILE)
        try:
            expected = int(asset["size"]) if asset is not None else _COMIC_TEXT_MASK_SIZE
            return weights.stat().st_size == expected
        except (OSError, KeyError, TypeError, ValueError):
            return False
    return False

def _ensure_marker_install(model_id: str) -> SegmentationInstallReport:
    model_dir = resolve_segmentation_model_dir(model_id)
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
        modelId=model_id,
        directory=str(model_dir),
        fileCount=1,
        file=InstalledFileReport(
            target=_MARKER_FILENAME,
            source="local",
            sha256=hashlib.sha256(marker.read_bytes()).hexdigest(),
            downloaded=created,
        ),
    )

def ensure_segmentation_model_installed(model_id: str) -> SegmentationInstallReport:
    normalized = _normalize(model_id)
    if normalized not in SUPPORTED_SEGMENTATION_MODEL_IDS:
        raise InvalidModelSelectionError(
            f"Invalid segmentation model for managed install: {model_id!r}"
        )

    if normalized == SEGMENTATION_MODEL_ID:
        return _ensure_marker_install(normalized)

    if normalized == CTD_SEGMENTATION_MODEL_ID:
        model_dir = resolve_segmentation_model_dir(normalized)
        if model_dir is None:
            raise ModelConfigurationError(
                "KOMA_MODELS_ROOT is not configured for managed segmentation installs."
            )
        det_report = ensure_detection_model_installed("comic_text_detector")
        file_info = det_report["file"]
        model_dir.mkdir(parents=True, exist_ok=True)
        meta_path = model_dir / _MARKER_FILENAME
        meta_payload = json.dumps(
            {
                "modelId": CTD_SEGMENTATION_MODEL_ID,
                "sharedWith": "comic_text_detector",
                "target": str(file_info["target"]),
                "sha256": str(file_info["sha256"]),
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        if not meta_path.is_file() or meta_path.read_text(encoding="utf-8") != meta_payload:
            meta_path.write_text(meta_payload, encoding="utf-8")
        return SegmentationInstallReport(
            modelId=normalized,
            directory=str(det_report["directory"]),
            fileCount=1,
            file=InstalledFileReport(
                target=str(file_info["target"]),
                source=str(file_info["source"]),
                sha256=str(file_info["sha256"]),
                downloaded=bool(file_info["downloaded"]),
            ),
        )

    model_dir = resolve_segmentation_model_dir(normalized)
    if model_dir is None:
        raise ModelConfigurationError(
            "KOMA_MODELS_ROOT is not configured for managed segmentation installs."
        )
    total_bytes = manifest_declared_total(normalized) or _COMIC_TEXT_MASK_SIZE
    bridge = progress_bridge_var.get()
    if bridge is not None:
        bridge.declare_total(total_bytes)

    model_dir.mkdir(parents=True, exist_ok=True)
    declared_asset = manifest_assets_by_path(normalized).get(_COMIC_TEXT_MASK_FILE)
    declared_size = (
        int(declared_asset["size"])
        if declared_asset is not None and manifest_asset_is_valid(declared_asset)
        else _COMIC_TEXT_MASK_SIZE
    )
    report_bridge_file(_COMIC_TEXT_MASK_FILE, 0, 1)
    payload = ensure_file_from_hf(
        repo=_COMIC_TEXT_MASK_REPO,
        candidate_paths=[_COMIC_TEXT_MASK_FILE],
        target_path=model_dir / _COMIC_TEXT_MASK_FILE,
        revision="main",
        expected_sha256=_COMIC_TEXT_MASK_SHA256,
        expected_size=declared_size,
    )
    report_bridge_file(_COMIC_TEXT_MASK_FILE, 1, 1)
    return SegmentationInstallReport(
        modelId=normalized,
        directory=str(model_dir),
        fileCount=1,
        file=InstalledFileReport(
            target=_COMIC_TEXT_MASK_FILE,
            source=str(payload["path"]),
            sha256=str(payload["sha256"]),
            downloaded=bool(payload["downloaded"]),
        ),
    )
