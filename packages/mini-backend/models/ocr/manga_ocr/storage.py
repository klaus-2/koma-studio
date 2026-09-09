from __future__ import annotations

import hashlib
from pathlib import Path
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from typing import Any


_MODEL_ROOT_ENV = "KOMA_MODELS_ROOT"
_MANGA_OCR_SUBDIR = "manga_ocr"

_REQUIRED_FILES: dict[str, dict[str, str]] = {
    "encoder_model.onnx": {
        "sha256": "15fa8155fe9bc1a7d25d9bb353debaa4def033d0174e907dbd2dd6d995def85f",
        "url": "https://huggingface.co/mayocream/manga-ocr-onnx/resolve/main/encoder_model.onnx",
    },
    "decoder_model.onnx": {
        "sha256": "ef7765261e9d1cdc34d89356986c2bbc2a082897f753a89605ae80fdfa61f5e8",
        "url": "https://huggingface.co/mayocream/manga-ocr-onnx/resolve/main/decoder_model.onnx",
    },
    "vocab.txt": {
        "sha256": "5cb5c5586d98a2f331d9f8828e4586479b0611bfba5d8c3b6dadffc84d6a36a3",
        "url": "https://huggingface.co/mayocream/manga-ocr-onnx/resolve/main/vocab.txt",
    },
}


def resolve_manga_ocr_models_root() -> Path | None:
    raw_root = os.getenv(_MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None

    root = Path(raw_root).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root / _MANGA_OCR_SUBDIR


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _has_required_files(directory: Path) -> bool:
    return all((directory / filename).exists() for filename in _REQUIRED_FILES.keys())


def resolve_manga_ocr_model_dir() -> Path | None:
    managed_dir = resolve_manga_ocr_models_root()
    if managed_dir is None:
        return None
    return managed_dir


def manga_ocr_runtime_ready() -> bool:
    model_dir = resolve_manga_ocr_model_dir()
    if model_dir is None:
        return False
    return _has_required_files(model_dir)


def _download_file(url: str, target_path: Path) -> None:
    request = Request(
        url,
        headers={
            "User-Agent": "koma-studio-mini-backend/1.0",
        },
    )
    temp_path = target_path.with_suffix(target_path.suffix + ".part")
    if temp_path.exists():
        temp_path.unlink(missing_ok=True)

    try:
        with urlopen(request, timeout=120) as response, temp_path.open("wb") as handle:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
    except (HTTPError, URLError) as exc:
        temp_path.unlink(missing_ok=True)
        raise RuntimeError(f"Failed to download manga_ocr file: {exc}") from exc
    except Exception as exc:
        temp_path.unlink(missing_ok=True)
        raise RuntimeError(f"Failed to save manga_ocr file: {exc}") from exc

    temp_path.replace(target_path)


def _ensure_required_file(
    filename: str,
    *,
    storage_dir: Path,
    expected_sha256: str,
    url: str,
) -> None:
    target_path = storage_dir / filename

    if target_path.exists():
        existing_sha = _sha256_file(target_path)
        if existing_sha.lower() == expected_sha256.lower():
            return
        target_path.unlink(missing_ok=True)

    _download_file(url, target_path)
    downloaded_sha = _sha256_file(target_path)
    if downloaded_sha.lower() != expected_sha256.lower():
        target_path.unlink(missing_ok=True)
        raise RuntimeError(
            f"Invalid SHA256 checksum for '{filename}'. Expected: {expected_sha256} | Got: {downloaded_sha}",
        )


def ensure_manga_ocr_models_installed() -> dict[str, Any]:
    storage_dir = resolve_manga_ocr_models_root()
    if storage_dir is None:
        raise RuntimeError(
            "KOMA_MODELS_ROOT is not configured for managed Manga OCR installs.",
        )

    storage_dir.mkdir(parents=True, exist_ok=True)
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
        "fileCount": len(files),
        "files": [str(path.relative_to(storage_dir)) for path in files],
    }
