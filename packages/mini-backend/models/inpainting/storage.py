from __future__ import annotations

import logging
from pathlib import Path
from typing import TypedDict

from core.hf_download import ensure_file_from_hf, progress_bridge_var
from core.models_store import resolve_model_dir
from models.inpainting.registry import get_spec

logger = logging.getLogger(__name__)
from models.manifests import manifest_asset_is_valid, manifest_assets_by_path, manifest_declared_total


class InstalledFile(TypedDict):
    target: str
    source: str
    sha256: str
    downloaded: bool


class InstallReport(TypedDict):
    modelId: str
    directory: str
    fileCount: int
    file: InstalledFile
    repo: str


class ModelsRootNotConfiguredError(RuntimeError):
    """KOMA_MODELS_ROOT is not configured for managed installs."""


def resolve_inpainting_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(model_id.strip().lower())


def resolve_inpainting_model_path(model_id: str) -> Path | None:
    spec = get_spec(model_id)
    model_dir = resolve_inpainting_model_dir(spec.key)
    return None if model_dir is None else model_dir / spec.target_file


def inpainting_runtime_ready(model_id: str) -> bool:
    path = resolve_inpainting_model_path(model_id)
    if path is None or not path.is_file():
        return False
    normalized = (model_id or "").strip().lower()
    try:
        asset = manifest_assets_by_path(normalized).get(path.name)
        if asset is not None and path.stat().st_size != int(asset["size"]):
            return False
    except OSError:
        return False
    except (KeyError, TypeError, ValueError):
        logger.warning(
            "Inpainting readiness hit malformed manifest data for %s", normalized
        )
        return False
    return True


def ensure_inpainting_model_installed(model_id: str) -> InstallReport:
    spec = get_spec(model_id)
    model_dir = resolve_inpainting_model_dir(spec.key)
    if model_dir is None:
        raise ModelsRootNotConfiguredError(
            "KOMA_MODELS_ROOT is not configured for managed inpainting installs."
        )

    total_bytes = manifest_declared_total(spec.key)
    if total_bytes is not None:
        bridge = progress_bridge_var.get()
        if bridge is not None:
            bridge.declare_total(total_bytes)

    model_dir.mkdir(parents=True, exist_ok=True)
    declared_asset = manifest_assets_by_path(spec.key).get(spec.target_file)
    declared_size = (
        int(declared_asset["size"])
        if declared_asset is not None and manifest_asset_is_valid(declared_asset)
        else None
    )
    payload = ensure_file_from_hf(
        repo=spec.repo,
        candidate_paths=list(spec.source_candidates),
        target_path=model_dir / spec.target_file,
        revision="main",
        expected_sha256=spec.sha256,
        expected_size=declared_size,
    )
    return InstallReport(
        modelId=spec.key,
        directory=str(model_dir),
        fileCount=1,
        file=InstalledFile(
            target=spec.target_file,
            source=str(payload["path"]),
            sha256=str(payload["sha256"]),
            downloaded=bool(payload["downloaded"]),
        ),
        repo=spec.repo,
    )
