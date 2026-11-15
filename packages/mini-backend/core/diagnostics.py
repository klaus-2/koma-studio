"""Cached, allowlisted environment snapshot for startup diagnostics.

Reads no secrets: the only environment variable consulted is the
non-secret acceleration profile, everything else comes from runtime
capability probes (torch / onnxruntime / psutil) that degrade to ``None``
when a library is unavailable. The snapshot feeds the one-shot
``backend.startup`` log event.
"""

from __future__ import annotations

import logging
import os
import platform
import sys
from typing import Final

logger = logging.getLogger(__name__)

ACCELERATION_PROFILE_ENV: Final = "MINI_BACKEND_ACCELERATION_PROFILE"

type _SnapshotValue = str | int | float | None

_snapshot_cache: dict[str, _SnapshotValue] | None = None


def get_environment_snapshot() -> dict[str, _SnapshotValue]:
    """Process-wide cached snapshot (the same dict object on every call)."""
    global _snapshot_cache
    if _snapshot_cache is None:
        _snapshot_cache = _compute_environment_snapshot()
    return _snapshot_cache


def _compute_environment_snapshot() -> dict[str, _SnapshotValue]:
    snapshot: dict[str, _SnapshotValue] = {
        "python_version": platform.python_version(),
        "platform": sys.platform,
        "acceleration_profile": os.getenv(ACCELERATION_PROFILE_ENV, "").strip() or None,
        "gpu_name": None,
        "vram_total_gb": None,
        "vram_free_gb": None,
        "ram_total_gb": None,
        "torch_version": None,
        "onnxruntime_version": None,
    }
    _collect_torch_info(snapshot)
    _collect_onnxruntime_version(snapshot)
    _collect_ram_total(snapshot)
    return snapshot


def _collect_torch_info(snapshot: dict[str, _SnapshotValue]) -> None:
    try:
        import torch
    except ImportError:
        return
    snapshot["torch_version"] = str(torch.__version__)
    try:
        if not torch.cuda.is_available():
            return
        snapshot["gpu_name"] = torch.cuda.get_device_name(0)
        free_bytes, total_bytes = torch.cuda.mem_get_info()
        snapshot["vram_free_gb"] = round(free_bytes / 1024**3, 2)
        snapshot["vram_total_gb"] = round(total_bytes / 1024**3, 2)
    except Exception as exc:  # best-effort probe: a broken driver stays None
        logger.debug("environment snapshot torch probe failed: %s", type(exc).__name__)


def _collect_onnxruntime_version(snapshot: dict[str, _SnapshotValue]) -> None:
    try:
        import onnxruntime
    except ImportError:
        return
    snapshot["onnxruntime_version"] = str(onnxruntime.__version__)


def _collect_ram_total(snapshot: dict[str, _SnapshotValue]) -> None:
    try:
        import psutil

        snapshot["ram_total_gb"] = round(psutil.virtual_memory().total / 1024**3, 2)
    except ImportError:
        return
    except Exception as exc:  # best-effort probe: a broken WMI/driver stays None
        logger.debug("environment snapshot ram probe failed: %s", type(exc).__name__)


def reset_environment_snapshot_cache() -> None:
    """Test seam: clears the cached snapshot."""
    global _snapshot_cache
    _snapshot_cache = None
