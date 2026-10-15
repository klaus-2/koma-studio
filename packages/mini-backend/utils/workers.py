from __future__ import annotations

import asyncio
from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor
from functools import partial
from threading import BoundedSemaphore

_MAX_NATIVE_JOBS = 2
_EXECUTOR = ThreadPoolExecutor(
    max_workers=_MAX_NATIVE_JOBS,
    thread_name_prefix="mini-image",
)
_ADMISSION = BoundedSemaphore(_MAX_NATIVE_JOBS)


class ImageWorkerBusyError(RuntimeError):
    """The bounded native-image execution capacity is exhausted."""


def _release_slot[T](_future: Future[T]) -> None:
    _ADMISSION.release()


async def run_native[**P, T](
    function: Callable[P, T],
    /,
    *args: P.args,
    **kwargs: P.kwargs,
) -> T:
    if not _ADMISSION.acquire(blocking=False):
        raise ImageWorkerBusyError("Native image workers are busy")

    try:
        future = _EXECUTOR.submit(partial(function, *args, **kwargs))
    except RuntimeError:
        _ADMISSION.release()
        raise

    future.add_done_callback(_release_slot)
    return await asyncio.wrap_future(future)
