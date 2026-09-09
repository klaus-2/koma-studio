from __future__ import annotations

import asyncio
from pathlib import Path
import sys
import unittest


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from pipelines.queue_processor import QueueProcessor


class QueueProcessorTests(unittest.IsolatedAsyncioTestCase):
    async def test_keeps_result_order(self) -> None:
        processor: QueueProcessor[int, int] = QueueProcessor(concurrency=3, continue_on_error=True)

        async def worker(task: int, index: int) -> int:
            await asyncio.sleep(0.01 if index % 2 == 0 else 0.02)
            return task * 10

        results = await processor.process([1, 2, 3, 4], worker)
        self.assertEqual([item.result for item in results], [10, 20, 30, 40])
        self.assertTrue(all(item.error is None for item in results))

    async def test_respects_concurrency_limit(self) -> None:
        processor: QueueProcessor[int, int] = QueueProcessor(concurrency=2, continue_on_error=True)
        active = 0
        peak = 0
        lock = asyncio.Lock()

        async def worker(task: int, index: int) -> int:
            nonlocal active, peak
            _ = index
            async with lock:
                active += 1
                peak = max(peak, active)
            await asyncio.sleep(0.02)
            async with lock:
                active -= 1
            return task

        results = await processor.process([1, 2, 3, 4, 5], worker)
        self.assertEqual(len(results), 5)
        self.assertLessEqual(peak, 2)

    async def test_continues_after_worker_error(self) -> None:
        processor: QueueProcessor[int, int] = QueueProcessor(concurrency=2, continue_on_error=True)

        async def worker(task: int, index: int) -> int:
            if index == 1:
                raise RuntimeError("boom")
            await asyncio.sleep(0.01)
            return task

        results = await processor.process([10, 20, 30], worker)
        self.assertEqual(results[0].result, 10)
        self.assertIsNotNone(results[1].error)
        self.assertEqual(results[2].result, 30)


if __name__ == "__main__":
    unittest.main()

