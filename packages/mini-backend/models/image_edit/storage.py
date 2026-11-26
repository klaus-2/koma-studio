from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from core.hf_download import (
    ensure_file_from_hf,
    progress_bridge_var,
    report_bridge_file,
)
from core.models_store import resolve_model_dir
from models.image_edit.registry import (
    LocalImageEditModelSpec,
    get_local_image_edit_spec,
)
from models.manifests import (
    manifest_asset_is_valid,
    manifest_assets_by_path,
    manifest_declared_total,
)

logger = logging.getLogger(__name__)


def resolve_local_image_edit_model_dir(model_id: str) -> Path | None:
    spec = get_local_image_edit_spec(model_id)
    if spec is None:
        return None
    return resolve_model_dir(spec.key)


def missing_local_image_edit_files(model_id: str, model_dir: Path) -> tuple[str, ...]:
    spec = get_local_image_edit_spec(model_id)
    if spec is None:
        return ()
    missing: list[str] = []
    for rel_path in spec.required_local_paths():
        file_path = model_dir / rel_path
        if not file_path.is_file() or file_path.stat().st_size <= 0:
            missing.append(rel_path)
    return tuple(missing)


def local_image_edit_runtime_ready(model_id: str) -> bool:
    spec = get_local_image_edit_spec(model_id)
    if spec is None:
        return False
    model_dir = resolve_local_image_edit_model_dir(spec.key)
    if model_dir is None or not model_dir.is_dir():
        return False
    return not missing_local_image_edit_files(spec.key, model_dir)


def _require_spec(model_id: str) -> LocalImageEditModelSpec:
    spec = get_local_image_edit_spec(model_id)
    if spec is None:
        raise ValueError(f"Unsupported local image-edit model: {model_id!r}")
    return spec


def ensure_local_image_edit_model_installed(model_id: str) -> dict[str, Any]:
    spec = _require_spec(model_id)
    model_dir = resolve_model_dir(spec.key)
    if model_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed local image-edit installs."
        )

    assets_by_path = manifest_assets_by_path(spec.key)
    required_paths = spec.required_local_paths()
    malformed = [
        path
        for path in required_paths
        if path not in assets_by_path or not manifest_asset_is_valid(assets_by_path[path])
    ]
    if malformed:
        raise RuntimeError(
            f"Managed local image-edit model '{spec.key}' has missing or malformed manifest assets: "
            f"{', '.join(malformed[:8])}"
        )

    total_bytes = manifest_declared_total(spec.key)
    if total_bytes is not None:
        bridge = progress_bridge_var.get()
        if bridge is not None:
            bridge.declare_total(total_bytes)

    model_dir.mkdir(parents=True, exist_ok=True)
    files_payload: list[dict[str, Any]] = []

    for group in spec.assets:
        for repo_rel_path in group.files:
            target_rel_path = group.target_for(repo_rel_path)
            asset = assets_by_path[target_rel_path]
            expected_sha256 = str(asset["sha256"])
            expected_size = int(asset["size"])
            target_path = model_dir / target_rel_path
            target_path.parent.mkdir(parents=True, exist_ok=True)

            report_bridge_file(target_rel_path, 0, expected_size)
            logger.debug(
                "Ensuring local image-edit asset %s/%s -> %s",
                group.hf_repo,
                repo_rel_path,
                target_path,
            )
            info = ensure_file_from_hf(
                repo=group.hf_repo,
                candidate_paths=[repo_rel_path],
                target_path=target_path,
                expected_sha256=expected_sha256,
                expected_size=expected_size,
            )
            files_payload.append(
                {
                    "path": target_rel_path,
                    "repo": group.hf_repo,
                    "source_path": repo_rel_path,
                    "size": info.get("size", expected_size),
                    "sha256": info.get("sha256", expected_sha256),
                    "downloaded": bool(info.get("downloaded", False)),
                }
            )

    return {
        "model_id": spec.key,
        "model_dir": str(model_dir),
        "installed": True,
        "files": files_payload,
    }
