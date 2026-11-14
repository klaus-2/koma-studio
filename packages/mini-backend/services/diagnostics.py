"""Runtime memory report: process facts + every model cache, via public stats() only."""

from __future__ import annotations

import gc
from datetime import UTC, datetime

from pydantic import BaseModel

from models.engine_cache import CacheStats
from core.memory import ProcessMemory, collect_process_memory
from core.threads import (
    INTER_OP_THREADS_ENV,
    INTRA_OP_THREADS_ENV,
    env_thread_limit,
)
from models.detection.factory import get_detector_cache_size
from models.inpainting.factory import get_inpainter_cache_size
from models.ocr.factory import get_ocr_cache_size
from models.segmentation.factory import get_segmenter_cache_size
from models.translation.factory import get_translator_cache_size
from pipelines.cache_manager import get_pipeline_cache

_MAX_CACHE_ENTRIES = 6


class ThreadLimitsReport(BaseModel):
    intra_op: int | None = None
    inter_op: int | None = None
    torch_num_threads: int | None = None


class RuntimeMemoryReport(BaseModel):
    captured_at: datetime
    process: ProcessMemory
    caches: list[CacheStats]
    onnx_sessions: int | None = None
    thread_limits: ThreadLimitsReport


def _cache_stats(name: str, entries: int) -> CacheStats:
    return CacheStats(
        name=name, entries=entries, max_entries=_MAX_CACHE_ENTRIES, keys=[]
    )


def _count_onnx_sessions() -> int | None:
    try:
        import onnxruntime as ort
    except ImportError:
        return None
    return sum(isinstance(obj, ort.InferenceSession) for obj in gc.get_objects())


def _torch_num_threads() -> int | None:
    try:
        import torch
    except ImportError:
        return None
    return int(torch.get_num_threads())


def _collect_thread_limits() -> ThreadLimitsReport:
    return ThreadLimitsReport(
        intra_op=env_thread_limit(INTRA_OP_THREADS_ENV),
        inter_op=env_thread_limit(INTER_OP_THREADS_ENV),
        torch_num_threads=_torch_num_threads(),
    )


def collect_runtime_report(*, deep: bool = False) -> RuntimeMemoryReport:
    """``deep`` walks gc.get_objects() (hundreds of ms on a warm process); off by default."""
    return RuntimeMemoryReport(
        captured_at=datetime.now(UTC),
        process=collect_process_memory(count_objects=deep),
        caches=[
            _cache_stats("detector", get_detector_cache_size()),
            _cache_stats("ocr", get_ocr_cache_size()),
            _cache_stats("inpainter", get_inpainter_cache_size()),
            _cache_stats("segmenter", get_segmenter_cache_size()),
            _cache_stats("translator", get_translator_cache_size()),
            CacheStats(
                name="pipeline",
                entries=get_pipeline_cache().stats()["entries"],
                max_entries=get_pipeline_cache().max_entries,
                keys=[],
            ),
        ],
        onnx_sessions=_count_onnx_sessions() if deep else None,
        thread_limits=_collect_thread_limits(),
    )
