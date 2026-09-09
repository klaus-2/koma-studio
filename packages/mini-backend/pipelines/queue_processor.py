from __future__ import annotations

import asyncio
from dataclasses import dataclass
import logging
from typing import Awaitable, Callable, Generic, TypeVar


logger = logging.getLogger(__name__)

TaskT = TypeVar("TaskT")
ResultT = TypeVar("ResultT")


@dataclass
class QueueItemResult(Generic[ResultT]):
    index: int
    result: ResultT | None = None
    error: str | None = None

    @property
    def succeeded(self) -> bool:
        return self.error is None


class QueueProcessor(Generic[TaskT, ResultT]):
    def __init__(
        self,
        *,
        concurrency: int = 1,
        continue_on_error: bool = True,
    ) -> None:
        self.concurrency = max(1, int(concurrency))
        self.continue_on_error = bool(continue_on_error)

    async def process(
        self,
        tasks: list[TaskT],
        worker: Callable[[TaskT, int], Awaitable[ResultT]],
        *,
        cancellation_event: asyncio.Event | None = None,
        per_task_timeout: float | None = None,
    ) -> list[QueueItemResult[ResultT]]:
        total = len(tasks)
        logger.info(
            "batch started total=%d concurrency=%d continue_on_error=%s per_task_timeout=%s",
            total,
            self.concurrency,
            self.continue_on_error,
            per_task_timeout,
        )

        if total == 0:
            logger.info("batch finished total=0 succeeded=0 failed=0")
            return []

        queue: asyncio.Queue[tuple[int, TaskT]] = asyncio.Queue()
        for index, task in enumerate(tasks):
            queue.put_nowait((index, task))

        results: list[QueueItemResult[ResultT] | None] = [None] * total
        abort_requested = asyncio.Event()

        async def _worker_loop() -> None:
            while True:
                if abort_requested.is_set():
                    break

                if cancellation_event is not None and cancellation_event.is_set():
                    logger.info("cancellation detected, stopping worker")
                    abort_requested.set()
                    break

                try:
                    index, task = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break

                try:
                    logger.info("item started index=%d", index)
                    if per_task_timeout is not None and per_task_timeout > 0:
                        value = await asyncio.wait_for(
                            worker(task, index),
                            timeout=per_task_timeout,
                        )
                    else:
                        value = await worker(task, index)
                    results[index] = QueueItemResult(index=index, result=value, error=None)
                    logger.info("item done index=%d", index)
                except asyncio.TimeoutError:
                    results[index] = QueueItemResult(
                        index=index, result=None, error="per-task timeout exceeded"
                    )
                    logger.warning("item timed out index=%d timeout=%.1fs", index, per_task_timeout or 0)
                    if not self.continue_on_error:
                        abort_requested.set()
                except asyncio.CancelledError:
                    results[index] = QueueItemResult(
                        index=index, result=None, error="task cancelled"
                    )
                    logger.info("item cancelled index=%d", index)
                    abort_requested.set()
                    break
                except Exception as exc:  # noqa: BLE001
                    results[index] = QueueItemResult(index=index, result=None, error=str(exc))
                    logger.exception("item failed index=%d", index)
                    if not self.continue_on_error:
                        abort_requested.set()
                finally:
                    queue.task_done()

        worker_count = min(self.concurrency, total)
        workers = [asyncio.create_task(_worker_loop()) for _ in range(worker_count)]
        await asyncio.gather(*workers)

        finalized: list[QueueItemResult[ResultT]] = []
        for index, item_result in enumerate(results):
            if item_result is not None:
                finalized.append(item_result)
                continue
            if abort_requested.is_set() or (cancellation_event is not None and cancellation_event.is_set()):
                finalized.append(
                    QueueItemResult(index=index, result=None, error="batch aborted before processing item")
                )
                continue
            finalized.append(
                QueueItemResult(index=index, result=None, error="item was not processed")
            )

        succeeded = sum(1 for item in finalized if item.succeeded)
        failed = total - succeeded
        logger.info("batch finished total=%d succeeded=%d failed=%d", total, succeeded, failed)
        return finalized
