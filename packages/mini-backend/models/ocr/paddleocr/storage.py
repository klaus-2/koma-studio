from __future__ import annotations

import logging
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from core.hf_download import HFDownloadError, download_file, sha256_file
from core.models_store import resolve_model_dir
from models.ocr.common import (
    ChecksumMismatchError,
    InstalledFilePayload,
    InstallPayload,
    ModelDownloadError,
    ModelsRootNotConfiguredError,
    UnknownManagedModelError,
    missing_files,
)

logger = logging.getLogger(__name__)

# `download_file` (core.hf_download) raises HFDownloadError (a RuntimeError)
# for transport/verify failures and raw OSError for filesystem problems.
# DownloadCancelled deliberately does NOT match: cancellation must propagate.
_DOWNLOAD_FAILURES: Final[tuple[type[Exception], ...]] = (HFDownloadError, OSError)
_DOWNLOAD_MAX_RETRIES: Final = 3

_MODELSCOPE_BASE: Final = "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0"
_HF_MIRROR_BASE: Final = "https://huggingface.co/monkt/paddleocr-onnx/resolve/main"
_SHARED_DETECTOR_REPO: Final = "RapidAI/RapidOCR"


@dataclass(frozen=True, slots=True)
class RemoteAsset:
    target: str
    urls: tuple[str, ...]
    sha256: str | None = None  # None = upstream publishes no pin (plain-text dictionaries)


_DETECTOR: Final = RemoteAsset(
    target="ch_PP-OCRv5_mobile_det.onnx",
    sha256="4d97c44a20d30a81aad087d6a396b08f786c4635742afc391f6621f5c6ae78ae",
    urls=(
        f"{_MODELSCOPE_BASE}/onnx/PP-OCRv5/det/ch_PP-OCRv5_mobile_det.onnx",
        f"{_HF_MIRROR_BASE}/detection/v5/det.onnx",
    ),
)


def _recognizer_bundle(
    *,
    upstream_name: str,
    rec_target: str,
    rec_sha256: str,
    dict_target: str,
    mirror_language: str,
) -> tuple[RemoteAsset, RemoteAsset, RemoteAsset]:
    recognizer = RemoteAsset(
        target=rec_target,
        sha256=rec_sha256,
        urls=(
            f"{_MODELSCOPE_BASE}/onnx/PP-OCRv5/rec/{upstream_name}.onnx",
            f"{_HF_MIRROR_BASE}/languages/{mirror_language}/rec.onnx",
        ),
    )
    dictionary = RemoteAsset(
        target=dict_target,
        urls=(
            f"{_MODELSCOPE_BASE}/paddle/PP-OCRv5/rec/{upstream_name}/{dict_target}",
            f"{_HF_MIRROR_BASE}/languages/{mirror_language}/dict.txt",
        ),
    )
    return _DETECTOR, recognizer, dictionary


PADDLEOCR_MANIFESTS: Final[Mapping[str, tuple[RemoteAsset, ...]]] = {
    "paddleocr": _recognizer_bundle(
        upstream_name="eslav_PP-OCRv5_rec_mobile_infer",
        rec_target="eslav_PP-OCRv5_rec_mobile_infer.onnx",
        rec_sha256="08705d6721849b1347d26187f15a5e362c431963a2a62bfff4feac578c489aab",
        dict_target="ppocrv5_eslav_dict.txt",
        mirror_language="eslav",
    ),
    "paddleocr_latin_v5": _recognizer_bundle(
        upstream_name="latin_PP-OCRv5_rec_mobile_infer",
        rec_target="latin_PP-OCRv5_rec_mobile_infer.onnx",
        rec_sha256="b20bd37c168a570f583afbc8cd7925603890efbcdc000a59e22c269d160b5f5a",
        dict_target="ppocrv5_latin_dict.txt",
        mirror_language="latin",
    ),
    "paddleocr_ch_v5": _recognizer_bundle(
        upstream_name="ch_PP-OCRv5_rec_mobile_infer",
        rec_target="ch_PP-OCRv5_rec_mobile_infer.onnx",
        rec_sha256="5825fc7ebf84ae7a412be049820b4d86d77620f204a041697b0494669b1742c5",
        dict_target="ppocrv5_dict.txt",
        mirror_language="chinese",
    ),
    "paddleocr_en_v5": _recognizer_bundle(
        upstream_name="en_PP-OCRv5_rec_mobile_infer",
        rec_target="en_PP-OCRv5_mobile_rec.onnx",
        rec_sha256="c3461add59bb4323ecba96a492ab75e06dda42467c9e3d0c18db5d1d21924be8",
        dict_target="ppocrv5_en_dict.txt",
        mirror_language="english",
    ),
}


def _normalize_model_id(model_id: str) -> str:
    return model_id.strip().lower()


def _manifest_for(model_id: str) -> tuple[RemoteAsset, ...]:
    manifest = PADDLEOCR_MANIFESTS.get(_normalize_model_id(model_id))
    if manifest is None:
        raise UnknownManagedModelError(model_id)
    return manifest


def resolve_paddleocr_model_dir(model_id: str) -> Path | None:
    return resolve_model_dir(_normalize_model_id(model_id))


def paddleocr_runtime_ready(model_id: str) -> bool:
    model_dir = resolve_paddleocr_model_dir(model_id)
    if model_dir is None:
        return False
    return not missing_files(model_dir, (asset.target for asset in _manifest_for(model_id)))


def _download_atomically(asset: RemoteAsset, target_path: Path) -> tuple[str, str]:
    """Download to a sibling `.part` file and rename on success; returns (source_url, sha256).

    A crash mid-download can never leave a partial file under the final name,
    so `paddleocr_runtime_ready` cannot report a corrupt install.
    """
    partial_path = target_path.with_name(f"{target_path.name}.part")
    failures: list[str] = []
    try:
        for url in asset.urls:
            partial_path.unlink(missing_ok=True)
            try:
                download_file(url, partial_path, max_retries=_DOWNLOAD_MAX_RETRIES)
            except _DOWNLOAD_FAILURES as exc:
                failures.append(f"{url}: {exc}")
                logger.warning(
                    "paddleocr_download_failed",
                    extra={"target": asset.target, "url": url, "error": str(exc)},
                )
                continue
            digest = sha256_file(partial_path).lower()
            # A pinned-hash mismatch is a supply-chain signal, not a transient error:
            # never silently fall through to another mirror.
            if asset.sha256 is not None and digest != asset.sha256:
                raise ChecksumMismatchError(asset.target, expected=asset.sha256, actual=digest)
            partial_path.replace(target_path)
            return url, digest
    finally:
        partial_path.unlink(missing_ok=True)
    raise ModelDownloadError(asset.target, failures)


def _ensure_asset(model_dir: Path, asset: RemoteAsset) -> InstalledFilePayload:
    target_path = model_dir / asset.target
    if target_path.is_file():
        digest = sha256_file(target_path).lower()
        if asset.sha256 is None or digest == asset.sha256:
            return InstalledFilePayload(
                target=asset.target, source="local-cache", sha256=digest, downloaded=False
            )
        logger.warning(
            "paddleocr_cached_file_rejected",
            extra={"target": asset.target, "expected_sha256": asset.sha256, "actual_sha256": digest},
        )
        target_path.unlink()

    source_url, digest = _download_atomically(asset, target_path)
    if asset.sha256 is None:
        logger.warning(
            "paddleocr_installed_unverified",
            extra={"target": asset.target, "sha256": digest},
        )
    return InstalledFilePayload(target=asset.target, source=source_url, sha256=digest, downloaded=True)


def ensure_paddleocr_models_installed(model_id: str) -> InstallPayload:
    normalized_id = _normalize_model_id(model_id)
    manifest = _manifest_for(normalized_id)
    model_dir = resolve_paddleocr_model_dir(normalized_id)
    if model_dir is None:
        raise ModelsRootNotConfiguredError(normalized_id)

    model_dir.mkdir(parents=True, exist_ok=True)
    files = [_ensure_asset(model_dir, asset) for asset in manifest]
    return InstallPayload(
        modelId=normalized_id,
        directory=str(model_dir),
        fileCount=len(files),
        files=files,
        repo=_SHARED_DETECTOR_REPO,
    )