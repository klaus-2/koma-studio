"""Process memory facts. No model imports — composition lives in services.diagnostics."""

from __future__ import annotations

import gc
import tracemalloc
from typing import Final

import psutil
from pydantic import BaseModel

_MIB: Final = 1024 * 1024


class ProcessMemory(BaseModel):
    rss_mb: float
    vms_mb: float
    # gc.get_count() is "allocations since last collection per generation",
    # not live objects; both are exposed under truthful names.
    gc_pending: tuple[int, int, int]
    gc_thresholds: tuple[int, int, int]
    gc_tracked_objects: int | None = None
    tracemalloc_current_mb: float | None = None
    tracemalloc_peak_mb: float | None = None
    gpu_vram_used_mb: float | None = None
    gpu_vram_total_mb: float | None = None


def _gpu_vram_mb() -> tuple[float | None, float | None]:
    try:
        import torch
    except ImportError:
        return None, None
    if not torch.cuda.is_available():
        return None, None
    used = torch.cuda.memory_allocated(0) / _MIB
    total = torch.cuda.get_device_properties(0).total_memory / _MIB
    return round(used, 1), round(total, 1)


def collect_process_memory(*, count_objects: bool = False) -> ProcessMemory:
    info = psutil.Process().memory_info()
    current_mb = peak_mb = None
    if tracemalloc.is_tracing():
        current, peak = tracemalloc.get_traced_memory()
        current_mb, peak_mb = round(current / _MIB, 2), round(peak / _MIB, 2)
    used, total = _gpu_vram_mb()
    gen0, gen1, gen2 = gc.get_count()
    t0, t1, t2 = gc.get_threshold()
    return ProcessMemory(
        rss_mb=round(info.rss / _MIB, 1),
        vms_mb=round(info.vms / _MIB, 1),
        gc_pending=(gen0, gen1, gen2),
        gc_thresholds=(t0, t1, t2),
        gc_tracked_objects=len(gc.get_objects()) if count_objects else None,
        tracemalloc_current_mb=current_mb,
        tracemalloc_peak_mb=peak_mb,
        gpu_vram_used_mb=used,
        gpu_vram_total_mb=total,
    )
