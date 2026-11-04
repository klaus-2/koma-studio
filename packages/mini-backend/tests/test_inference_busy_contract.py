"""Contract pin: the bounded admission pool refuses excess concurrency.

Engine-backed per-image inference funnels through ``run_inference``
(models/execution.py): admission is a non-blocking semaphore of
``2 x get_inference_worker_capacity()`` slots, released only when a submitted
future completes. Once blocking operations hold every slot, the next request
must refuse immediately (non-blocking) with ``InferenceBusyError`` — the wire
signal the HTTP boundary maps to 503/``INFERENCE_BUSY`` and the frontend
surfaces as the named "model busy — retry" state.

The pool geometry (``min(4, cpu)`` workers, ``BoundedSemaphore(2x)``) is
process-global shared state: this test never monkeypatches ``_admission`` and
awaits every blocker before returning, so the pool is fully released for the
rest of the suite.
"""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Callable

import pytest

from models.errors import InferenceError
from models.execution import (
    InferenceBusyError,
    get_inference_worker_capacity,
    run_inference,
)
from services.device_fallback import ExecutionError

_BLOCKER_RELEASE_TIMEOUT_S = 30.0
_BUSY_REFUSAL_TIMEOUT_S = 5.0
_ADMISSION_YIELD_PASSES = 4


def _blocking_operation(release: threading.Event) -> Callable[[], bool]:
    """A submitted operation that holds its worker thread until released."""

    def operation() -> bool:
        release.wait(timeout=_BLOCKER_RELEASE_TIMEOUT_S)
        return True

    return operation


def test_inference_busy_error_is_not_an_execution_error() -> None:
    """Wire hierarchy: busy inherits ``InferenceError``, never ``ExecutionError``.

    ``_boundary.execution_error_to_http`` receives only ``ExecutionError``, so
    the busy condition can never reach it and needs its own explicit mapping at
    the per-image router seams.
    """
    assert issubclass(InferenceBusyError, InferenceError)
    assert not issubclass(InferenceBusyError, ExecutionError)


async def test_saturated_admission_pool_refuses_the_next_request_immediately() -> None:
    capacity = get_inference_worker_capacity()
    # Two concurrent calls alone never trip the error: the semaphore always has
    # 2 x capacity >= 2 slots. Saturating it takes 2 x capacity blockers, one
    # per admission slot.
    assert capacity >= 1
    blocker_count = 2 * capacity

    releases = [threading.Event() for _ in range(blocker_count)]
    blockers = [
        asyncio.create_task(run_inference(_blocking_operation(release)))
        for release in releases
    ]
    # Admission is acquired synchronously at each coroutine's first slice —
    # before any executor thread must have started the operation — so a few
    # event-loop passes deterministically leave every slot held.
    for _ in range(_ADMISSION_YIELD_PASSES):
        await asyncio.sleep(0)

    async def probe() -> bool:
        return await run_inference(lambda: True)

    # Non-blocking refusal: the wait_for budget only guards against a regression
    # that would queue the probe behind the blockers (busy raises at once).
    with pytest.raises(InferenceBusyError):
        await asyncio.wait_for(probe(), timeout=_BUSY_REFUSAL_TIMEOUT_S)

    for release in releases:
        release.set()
    outcomes = await asyncio.gather(*blockers)
    assert outcomes == [True] * blocker_count

    # The pool is fully restored for the rest of the suite.
    assert await run_inference(lambda: True) is True
