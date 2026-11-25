from __future__ import annotations

import hashlib
import logging
import os
import platform
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Final

import onnxruntime as ort

from core.device import OnnxProviderSpec, accelerator_identity

logger = logging.getLogger(__name__)

_GRAPH_CACHE_ENV: Final = "MINI_BACKEND_ONNX_GRAPH_CACHE"
_APP_DATA_DIR_ENV: Final = "KOMA_APP_DATA_DIR"
_DEV_APP_DATA_DIRNAME: Final = ".koma-studio"
_CACHE_DIRNAME: Final = "onnx-graph-cache"
_CACHE_SUFFIX: Final = ".onnx"
_TMP_GLOB: Final = "*.tmp-*"
_TMP_SWEEPER_MIN_AGE_SECONDS: Final[int] = 24 * 3600
_TMP_NAME_TEMPLATE: Final = "{name}.tmp-{pid}"
_CHUNK_BYTES: Final = 1024 * 1024
_CPU_PROVIDER: Final = "CPUExecutionProvider"
_CUDA_PROVIDER: Final = "CUDAExecutionProvider"
_CACHEABLE_PROVIDERS: Final = frozenset({_CPU_PROVIDER, _CUDA_PROVIDER})


def _provider_name(spec: OnnxProviderSpec) -> str:
    return spec if isinstance(spec, str) else spec[0]


def _app_data_dir() -> Path:
    """Same resolution pattern as core/translation_provider_config.py."""
    return Path(
        os.getenv(_APP_DATA_DIR_ENV)
        or os.path.join(os.path.expanduser("~"), _DEV_APP_DATA_DIRNAME)
    )


def graph_cache_dir() -> Path:
    """Cache directory: ``<KOMA_APP_DATA_DIR>/onnx-graph-cache``."""
    return _app_data_dir() / _CACHE_DIRNAME


def graph_cache_runtime_tag(provider_names: Sequence[str] = ()) -> str:
    parts = [ort.__version__, platform.machine(), platform.processor()]
    if _CUDA_PROVIDER in provider_names:
        parts.append(accelerator_identity())
    return "|".join(parts)


def _provider_key_segment(spec: OnnxProviderSpec) -> str:
    if isinstance(spec, str):
        return spec
    name, provider_options = spec
    flattened = ",".join(f"{key}={value}" for key, value in sorted(provider_options.items()))
    return f"{name}[{flattened}]"


def build_graph_cache_key(
    model_path: Path,
    provider_names: Sequence[str],
    ort_version: str,
    optimization_level: str,
) -> str:
    """sha256 over streamed 1 MiB model chunks + providers/version/level.

    The model is read in fixed-size chunks so memory stays O(1) regardless
    of model size; the string inputs are NUL-separated to avoid boundary
    collisions between concatenated segments.
    """
    digest = hashlib.sha256()
    with model_path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(_CHUNK_BYTES), b""):
            digest.update(chunk)
    for provider_name in sorted(provider_names):
        digest.update(provider_name.encode("utf-8"))
        digest.update(b"\x00")
    digest.update(ort_version.encode("utf-8"))
    digest.update(b"\x00")
    digest.update(optimization_level.encode("utf-8"))
    return digest.hexdigest()


def _log_write_failed(cache_file: Path, error: str) -> None:
    logger.warning(
        "onnx.graph_cache.write_failed",
        extra={"cache_file": str(cache_file), "error": error},
    )


def _purge_abandoned_tmp_entries(cache_dir: Path) -> None:
    """Age-purge tmp entries a previous process abandoned.

    Promotion never crosses a restart (the tmp name carries the writing
    pid), so a tmp older than the 24h floor is dead weight the size of the
    model; this cache directory is the ONLY scope that ever deletes, and
    only ``*.tmp-*`` names are eligible. Future mtimes read as a negative
    age and are skipped; a failed removal is logged and the load proceeds.
    """
    try:
        candidates = list(cache_dir.glob(_TMP_GLOB))
    except OSError as exc:
        _log_write_failed(cache_dir, str(exc))
        return
    now_value = time.time()
    for tmp_path in candidates:
        try:
            age = now_value - os.stat(tmp_path, follow_symlinks=False).st_mtime
        except OSError:
            continue
        if age < _TMP_SWEEPER_MIN_AGE_SECONDS:
            continue
        try:
            tmp_path.unlink()
        except OSError as exc:
            logger.warning(
                "onnx.graph_cache.tmp_purge_failed",
                extra={"cache_file": str(tmp_path), "error": str(exc)},
            )
        else:
            logger.info(
                "onnx.graph_cache.tmp_purged",
                extra={"cache_file": str(tmp_path)},
            )


def apply_graph_cache(
    model_path: Path,
    providers: Sequence[OnnxProviderSpec],
    options: ort.SessionOptions,
) -> None:
    if os.getenv(_GRAPH_CACHE_ENV) == "0":
        return
    provider_names = [_provider_name(spec) for spec in providers]
    if not provider_names or any(
        name not in _CACHEABLE_PROVIDERS for name in provider_names
    ):
        return
    if not model_path.is_file():
        return
    cache_dir = graph_cache_dir()
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
    except OSError as exc:
        _log_write_failed(cache_dir, str(exc))
        return
    _purge_abandoned_tmp_entries(cache_dir)
    try:
        optimization_level = str(options.graph_optimization_level)
        key = build_graph_cache_key(
            model_path,
            [_provider_key_segment(spec) for spec in providers],
            graph_cache_runtime_tag(provider_names),
            optimization_level,
        )
    except OSError as exc:
        _log_write_failed(cache_dir, str(exc))
        return
    cache_file = cache_dir / f"{key}{_CACHE_SUFFIX}"
    if cache_file.is_file():
        options.optimized_model_filepath = str(cache_file)
        return
    tmp_file = cache_dir / _TMP_NAME_TEMPLATE.format(
        name=f"{key}{_CACHE_SUFFIX}", pid=os.getpid()
    )
    options.optimized_model_filepath = str(tmp_file)


def is_final_graph_cache(cache_path: Path) -> bool:
    return cache_path.suffix == _CACHE_SUFFIX and cache_path.is_file()


def promote_graph_cache(cache_path: Path | None) -> None:
    if cache_path is None or cache_path.suffix == _CACHE_SUFFIX:
        return
    if not cache_path.is_file():
        return
    final_name, separator, _ = cache_path.name.rpartition(".tmp-")
    if not separator or not final_name.endswith(_CACHE_SUFFIX):
        return
    final_path = cache_path.with_name(final_name)
    try:
        os.replace(cache_path, final_path)
    except OSError as exc:
        _log_write_failed(final_path, str(exc))
        return
    logger.info("onnx.graph_cache.stored", extra={"cache_file": str(final_path)})


def load_guard_and_purge(cache_path: Path) -> None:
    """Unlink a failed/corrupt cache entry so the retry runs without cache."""
    try:
        cache_path.unlink(missing_ok=True)
    except OSError as exc:
        logger.warning(
            "onnx.graph_cache.purge_failed",
            extra={"cache_file": str(cache_path), "error": str(exc)},
        )
        return
    logger.info("onnx.graph_cache.purged", extra={"cache_file": str(cache_path)})
