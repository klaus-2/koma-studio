"""Bounded-concurrency fan-out over a task list with per-item fault isolation.

Worker exceptions are captured per item; cancellation of the calling task is
never swallowed — it propagates through the TaskGroup.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

logger = logging.getLogger(__name__)

_ABORTED_MESSAGE = "batch aborted before processing item"
_TIMEOUT_MESSAGE = "per-task timeout exceeded"


@dataclass(frozen=True, slots=True)
class QueueItemResult[ResultT]:
    index: int
    result: ResultT | None = None
    error: str | None = None

    @property
    def succeeded(self) -> bool:
        return self.error is None


type QueueWorker[TaskT, ResultT] = Callable[[TaskT, int], Awaitable[ResultT]]


class QueueProcessor[TaskT, ResultT]:
    __slots__ = ("concurrency", "continue_on_error")

    def __init__(self, *, concurrency: int = 1, continue_on_error: bool = True) -> None:
        if concurrency < 1:
            raise ValueError("concurrency must be >= 1")
        self.concurrency = concurrency
        self.continue_on_error = continue_on_error

    async def process(
        self,
        tasks: Sequence[TaskT],
        worker: QueueWorker[TaskT, ResultT],
        *,
        cancellation_event: asyncio.Event | None = None,
        per_task_timeout: float | None = None,
    ) -> list[QueueItemResult[ResultT]]:
        total = len(tasks)
        logger.info(
            "batch started",
            extra={
                "total": total,
                "concurrency": self.concurrency,
                "continue_on_error": self.continue_on_error,
                "per_task_timeout": per_task_timeout,
            },
        )
        if total == 0:
            return []

        results: list[QueueItemResult[ResultT] | None] = [None] * total
        # Shared iterator is safe: workers are coroutines on one loop and never
        # await between ``next()`` and using the item.
        pending = iter(enumerate(tasks))
        abort = asyncio.Event()

        def externally_cancelled() -> bool:
            return cancellation_event is not None and cancellation_event.is_set()

        async def run_one(index: int, task: TaskT) -> QueueItemResult[ResultT]:
            try:
                if per_task_timeout is not None and per_task_timeout > 0:
                    async with asyncio.timeout(per_task_timeout):
                        value = await worker(task, index)
                else:
                    value = await worker(task, index)
            except TimeoutError:
                logger.warning(
                    "item timed out", extra={"index": index, "timeout": per_task_timeout}
                )
                return QueueItemResult(index=index, error=_TIMEOUT_MESSAGE)
            except Exception as exc:  # noqa: BLE001 — fault-isolation boundary for arbitrary worker code
                logger.exception("item failed", extra={"index": index})
                return QueueItemResult(index=index, error=str(exc) or type(exc).__name__)
            return QueueItemResult(index=index, result=value)

        async def worker_loop() -> None:
            while not abort.is_set():
                if externally_cancelled():
                    logger.info("cancellation requested, stopping worker")
                    abort.set()
                    return
                item = next(pending, None)
                if item is None:
                    return
                index, task = item
                outcome = await run_one(index, task)
                results[index] = outcome
                if not outcome.succeeded and not self.continue_on_error:
                    abort.set()

        async with asyncio.TaskGroup() as group:
            for _ in range(min(self.concurrency, total)):
                group.create_task(worker_loop())

        finalized = [
            outcome if outcome is not None else QueueItemResult(index=index, error=_ABORTED_MESSAGE)
            for index, outcome in enumerate(results)
        ]
        succeeded = sum(1 for item in finalized if item.succeeded)
        logger.info(
            "batch finished",
            extra={"total": total, "succeeded": succeeded, "failed": total - succeeded},
        )
        return finalized
