from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Iterable

from core.hf_download import download_file, sha256_file


_MODEL_ROOT_ENV = "KOMA_MODELS_ROOT"
_PORORO_SUBDIR = "pororo"
_SUPPORTED_LANGUAGES = {"ko", "en"}

_REQUIRED_FILES: dict[str, dict[str, str]] = {
    "craft.pt": {
        "sha256": "4a5efbfb48b4081100544e75e1e2b57f8de3d84f213004b14b85fd4b3748db17",
        "url": "https://huggingface.co/ogkalu/pororo/resolve/main/craft.pt",
    },
    "brainocr.pt": {
        "sha256": "125820ba8ae4fa5d9fd8b8a2d4d4a7afe96a70c32b1aa01d4129001a6f61baec",
        "url": "https://huggingface.co/ogkalu/pororo/resolve/main/brainocr.pt",
    },
    "ocr-opt.txt": {
        "sha256": "dd471474e91d78e54b179333439fea58158ad1a605df010ea0936dcf4387a8c2",
        "url": "https://huggingface.co/ogkalu/pororo/resolve/main/ocr-opt.txt",
    },
}


def resolve_pororo_models_root() -> Path | None:
    raw_root = os.getenv(_MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None
    return Path(raw_root).expanduser().resolve()


def resolve_pororo_storage_dir() -> Path | None:
    models_root = resolve_pororo_models_root()
    if models_root is None:
        return None

    storage_dir = models_root / _PORORO_SUBDIR
    storage_dir.mkdir(parents=True, exist_ok=True)
    return storage_dir


def _normalize_languages(languages: Iterable[str] | None) -> list[str]:
    if not languages:
        return ["ko"]

    normalized: list[str] = []
    for item in languages:
        candidate = (item or "").strip().lower()
        if candidate not in _SUPPORTED_LANGUAGES:
            continue
        if candidate not in normalized:
            normalized.append(candidate)

    return normalized or ["ko"]


def pororo_runtime_ready() -> bool:
    storage_dir = resolve_pororo_storage_dir()
    if storage_dir is None:
        return False
    return all((storage_dir / filename).exists() for filename in _REQUIRED_FILES)


def _ensure_required_file(
    filename: str,
    *,
    storage_dir: Path,
    expected_sha256: str,
    url: str,
) -> None:
    target_path = storage_dir / filename

    if target_path.exists():
        existing_sha = sha256_file(target_path)
        if existing_sha.lower() == expected_sha256.lower():
            return
        target_path.unlink(missing_ok=True)

    download_file(url, target_path, max_retries=3)
    downloaded_sha = sha256_file(target_path)
    if downloaded_sha.lower() != expected_sha256.lower():
        target_path.unlink(missing_ok=True)
        raise RuntimeError(
            f"Invalid SHA256 checksum for '{filename}'. Expected: {expected_sha256} | Got: {downloaded_sha}",
        )


def ensure_pororo_models_installed(languages: Iterable[str] | None = None) -> dict[str, Any]:
    storage_dir = resolve_pororo_storage_dir()
    if storage_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed Pororo OCR installs.",
        )

    selected_languages = _normalize_languages(languages)
    for filename, meta in _REQUIRED_FILES.items():
        _ensure_required_file(
            filename,
            storage_dir=storage_dir,
            expected_sha256=meta["sha256"],
            url=meta["url"],
        )

    files = [path for path in storage_dir.rglob("*") if path.is_file()]
    return {
        "directory": str(storage_dir),
        "languages": selected_languages,
        "fileCount": len(files),
    }
