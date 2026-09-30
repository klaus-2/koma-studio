from __future__ import annotations

from pathlib import Path
from typing import TypedDict

from core.hf_download import ensure_file_from_hf
from core.models_store import resolve_model_dir
from models.inpainting.registry import get_spec


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
    return path is not None and path.is_file()


def ensure_inpainting_model_installed(model_id: str) -> InstallReport:
    spec = get_spec(model_id)
    model_dir = resolve_inpainting_model_dir(spec.key)
    if model_dir is None:
        raise ModelsRootNotConfiguredError(
            "KOMA_MODELS_ROOT is not configured for managed inpainting installs."
        )

    model_dir.mkdir(parents=True, exist_ok=True)
    payload = ensure_file_from_hf(
        repo=spec.repo,
        candidate_paths=list(spec.source_candidates),
        target_path=model_dir / spec.target_file,
        revision="main",
        expected_sha256=spec.sha256,
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
