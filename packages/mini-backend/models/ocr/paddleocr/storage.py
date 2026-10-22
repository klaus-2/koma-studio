from __future__ import annotations

import json
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

# Two independent hosts that serve the SAME upstream tree with the SAME relative
# paths and byte-identical content. The previous mirror served a different model
# family (server-grade detector/recogniser under the mobile filenames), which
# turned any transient failure into a hard checksum error.
_MODELSCOPE_BASE: Final = "https://www.modelscope.cn/models/RapidAI/RapidOCR/resolve/v3.4.0"
_HF_MIRROR_BASE: Final = "https://huggingface.co/pitapo/rapidocr/resolve/main"
_MIRROR_BASES: Final = (_MODELSCOPE_BASE, _HF_MIRROR_BASE)
_SHARED_DETECTOR_REPO: Final = "RapidAI/RapidOCR"

# The generated manifest owns every path, size and digest. Regenerate with
#   python packages/mini-backend/scripts/generate_model_asset_manifest.py
_MANIFEST_PATH: Final = (
    Path(__file__).resolve().parents[2] / "manifests" / "model-assets.json"
)

# On-disk file names are a RUNTIME contract (paddleocr/engine.py hardcodes
# them), not an upstream fact: the English recogniser is published as
# `en_PP-OCRv5_rec_mobile_infer.onnx` but the runtime loads
# `en_PP-OCRv5_mobile_rec.onnx`.
_DETECTOR_TARGET: Final = "ch_PP-OCRv5_mobile_det.onnx"
_RECOGNIZER_TARGETS: Final[Mapping[str, str]] = {
    "paddleocr": "eslav_PP-OCRv5_rec_mobile_infer.onnx",
    "paddleocr_latin_v5": "latin_PP-OCRv5_rec_mobile_infer.onnx",
    "paddleocr_ch_v5": "ch_PP-OCRv5_rec_mobile_infer.onnx",
    "paddleocr_en_v5": "en_PP-OCRv5_mobile_rec.onnx",
}
_DICTIONARY_TARGETS: Final[Mapping[str, str]] = {
    "paddleocr": "ppocrv5_eslav_dict.txt",
    "paddleocr_latin_v5": "ppocrv5_latin_dict.txt",
    "paddleocr_ch_v5": "ppocrv5_dict.txt",
    "paddleocr_en_v5": "ppocrv5_en_dict.txt",
}


@dataclass(frozen=True, slots=True)
class RemoteAsset:
    target: str
    path: str
    size: int
    sha256: str

    @property
    def urls(self) -> tuple[str, ...]:
        """Every candidate that must serve byte-identical content."""
        return tuple(f"{base}/{self.path}" for base in _MIRROR_BASES)


def _load_manifest() -> Mapping[str, object]:
    try:
        payload = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise ModelDownloadError(
            "paddleocr manifest", [f"{_MANIFEST_PATH}: {exc}"]
        ) from exc
    models = payload.get("models")
    if not isinstance(models, dict):
        raise ModelDownloadError("paddleocr manifest", ["no models section"])
    return models


def _build_manifests() -> Mapping[str, tuple[RemoteAsset, ...]]:
    models = _load_manifest()
    manifests: dict[str, tuple[RemoteAsset, ...]] = {}
    for model_id, entry in models.items():
        if model_id not in _RECOGNIZER_TARGETS:
            continue
        assets = entry.get("assets") if isinstance(entry, dict) else None
        if not isinstance(assets, list) or len(assets) != 3:
            raise ModelDownloadError("paddleocr manifest", [f"{model_id}: expected 3 assets"])
        built: list[RemoteAsset] = []
        for asset in assets:
            if not isinstance(asset, dict):
                raise ModelDownloadError("paddleocr manifest", [f"{model_id}: bad asset entry"])
            path = str(asset.get("path") or "")
            size = int(asset.get("size") or 0)
            sha256 = str(asset.get("sha256") or "").lower()
            if not path or size <= 0 or len(sha256) != 64:
                raise ModelDownloadError(
                    "paddleocr manifest", [f"{model_id}: incomplete asset {path!r}"]
                )
            built.append(RemoteAsset(target=path.rsplit("/", 1)[-1], path=path, size=size, sha256=sha256))
        # Apply the runtime file-name contract on top of the upstream names.
        renamed = []
        for asset in built:
            if asset.target == _DETECTOR_TARGET:
                renamed.append(asset)
            elif asset.target.endswith(".onnx"):
                renamed.append(
                    RemoteAsset(
                        target=_RECOGNIZER_TARGETS[model_id],
                        path=asset.path,
                        size=asset.size,
                        sha256=asset.sha256,
                    )
                )
            else:
                renamed.append(
                    RemoteAsset(
                        target=_DICTIONARY_TARGETS[model_id],
                        path=asset.path,
                        size=asset.size,
                        sha256=asset.sha256,
                    )
                )
        manifests[model_id] = tuple(renamed)
    if not manifests:
        raise ModelDownloadError("paddleocr manifest", ["no paddleocr models declared"])
    return manifests


PADDLEOCR_MANIFESTS: Final[Mapping[str, tuple[RemoteAsset, ...]]] = _build_manifests()


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
    so `paddleocr_runtime_ready` cannot report a corrupt install. The partial
    survives a failed attempt so the next job resumes instead of restarting.
    """
    partial_path = target_path.with_name(f"{target_path.name}.part")
    failures: list[str] = []
    try:
        for url in asset.urls:
            try:
                download_file(
                    url,
                    partial_path,
                    max_retries=_DOWNLOAD_MAX_RETRIES,
                    expected_size=asset.size,
                )
            except ChecksumMismatchError:
                # A pinned-hash mismatch is a supply-chain signal, not a
                # transient error: never silently fall through to another
                # mirror. Re-raised so the type system enforces the invariant.
                raise
            except _DOWNLOAD_FAILURES as exc:
                failures.append(f"{url}: {exc}")
                logger.warning(
                    "paddleocr_download_failed",
                    extra={"target": asset.target, "url": url, "error": str(exc)},
                )
                continue
            digest = sha256_file(partial_path).lower()
            if digest != asset.sha256:
                raise ChecksumMismatchError(
                    f"Invalid SHA256 checksum for '{asset.target}'. "
                    f"Expected: {asset.sha256} | Got: {digest}",
                    expected=asset.sha256,
                    actual=digest,
                )
            partial_path.replace(target_path)
            return url, digest
    finally:
        if partial_path.exists():
            partial_path.unlink(missing_ok=True)
    raise ModelDownloadError(asset.target, failures)


def _ensure_asset(model_dir: Path, asset: RemoteAsset) -> InstalledFilePayload:
    target_path = model_dir / asset.target
    if target_path.is_file():
        digest = sha256_file(target_path).lower()
        if digest == asset.sha256:
            _report_cached_bytes(asset)
            return InstalledFilePayload(
                target=asset.target, source="local-cache", sha256=digest, downloaded=False
            )
        logger.warning(
            "paddleocr_cached_file_rejected",
            extra={"target": asset.target, "expected_sha256": asset.sha256, "actual_sha256": digest},
        )
        target_path.unlink()

    source_url, digest = _download_atomically(asset, target_path)
    return InstalledFilePayload(target=asset.target, source=source_url, sha256=digest, downloaded=True)


def _report_cached_bytes(asset: RemoteAsset) -> None:
    """Count a cached asset as already-present bytes.

    Without it a retried install reports 0 bytes until the first byte of the
    next asset arrives, which makes the bar jump backwards.
    """
    bridge = _active_bridge()
    if bridge is None:
        return
    bridge.report_download(asset.path, asset.size)


def _active_bridge():
    from core.hf_download import progress_bridge_var

    return progress_bridge_var.get()


def ensure_paddleocr_models_installed(model_id: str) -> InstallPayload:
    normalized_id = _normalize_model_id(model_id)
    manifest = _manifest_for(normalized_id)
    model_dir = resolve_paddleocr_model_dir(normalized_id)
    if model_dir is None:
        raise ModelsRootNotConfiguredError(normalized_id)

    model_dir.mkdir(parents=True, exist_ok=True)

    bridge = _active_bridge()
    if bridge is not None:
        # The bundle size is known before the first byte: declare it so the
        # percentage is monotonic for the whole install.
        bridge.declare_total(sum(asset.size for asset in manifest))

    files = [_ensure_asset(model_dir, asset) for asset in manifest]
    return InstallPayload(
        modelId=normalized_id,
        directory=str(model_dir),
        fileCount=len(files),
        files=files,
        repo=_SHARED_DETECTOR_REPO,
    )
