"""Bounded execution of synchronous inference work.

Inputs remain borrowed until completion, including when the caller cancels.
The application lifespan must await shutdown_inference_workers() at shutdown.
"""

from __future__ import annotations

import asyncio
import logging
import os
import threading
import time
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Final

from models.errors import InferenceError

logger = logging.getLogger(__name__)

_MAX_WORKERS: Final[int] = min(4, os.cpu_count() or 1)
_MAX_OUTSTANDING: Final[int] = _MAX_WORKERS * 2


def get_inference_worker_capacity() -> int:
    """Worker threads shared by every model stage; the real concurrency limiter."""
    return _MAX_WORKERS


_lock = threading.Lock()
_admission = threading.BoundedSemaphore(_MAX_OUTSTANDING)
_executor: ThreadPoolExecutor | None = None
_closed = False


class InferenceBusyError(InferenceError):
    """The bounded inference queue has no available capacity."""


class InferenceExecutorClosedError(InferenceError):
    """Inference was requested after shutdown started."""


def _get_executor() -> ThreadPoolExecutor:
    global _executor

    with _lock:
        if _closed:
            raise InferenceExecutorClosedError("Inference workers are shutting down")
        if _executor is None:
            _executor = ThreadPoolExecutor(
                max_workers=_MAX_WORKERS,
                thread_name_prefix="inference",
            )
        return _executor


def _execute[T](operation: Callable[[], T]) -> T:
    started_at = time.perf_counter()
    succeeded = False
    try:
        result = operation()
        succeeded = True
        return result
    finally:
        logger.info(
            "inference.completed",
            extra={
                "duration_seconds": time.perf_counter() - started_at,
                "succeeded": succeeded,
            },
        )


def _release_admission[T](_future: Future[T]) -> None:
    _admission.release()


async def run_inference[T](operation: Callable[[], T]) -> T:
    if not _admission.acquire(blocking=False):
        raise InferenceBusyError("Inference capacity is exhausted")

    submitted = False
    try:
        executor = _get_executor()
        try:
            future = executor.submit(_execute, operation)
        except RuntimeError as exc:
            raise InferenceExecutorClosedError(
                "Inference workers are unavailable"
            ) from exc
        submitted = True
    finally:
        if not submitted:
            _admission.release()

    future.add_done_callback(_release_admission)
    wrapped = asyncio.wrap_future(future)

    try:
        return await asyncio.shield(wrapped)
    except asyncio.CancelledError:
        # Cancelling an await cannot stop an ONNX/OpenCV call already running.
        while not wrapped.done():
            try:
                await asyncio.wait((wrapped,))
            except asyncio.CancelledError:
                continue

        if not wrapped.cancelled():
            wrapped.exception()
        raise


async def shutdown_inference_workers() -> None:
    global _closed

    with _lock:
        _closed = True
        executor = _executor

    if executor is not None:
        await asyncio.to_thread(
            executor.shutdown,
            wait=True,
            cancel_futures=True,
        )
