from __future__ import annotations

import asyncio
from datetime import datetime
from io import BytesIO
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import sys

from fastapi.testclient import TestClient
from PIL import Image


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app

    from pipelines.batch import stages
    from pipelines.batch.orchestrator import (
        BatchImageTask,
        BatchOrchestrator,
        BatchRunConfig,
        GpuFlags,
    )
    from pipelines.batch.progress import BatchProgressRegistry
    from pipelines.batch.records import OCRRecord
    from pipelines.batch.stages import CleanSettings, LLMRequestSettings, StageOutput
    from routers import pipeline as pipeline_router
    from schemas.pipeline_batch import BatchStageConfig
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


PROGRESS_KEYS = {
    "batchId",
    "total",
    "completed",
    "failed",
    "stageUnitsStarted",
    "currentIndex",
    "currentName",
    "currentStage",
    "cancelled",
    "finished",
    "updatedAt",
}


class _FakeClock:
    def __init__(self, start: float = 1_700_000_000.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (8, 8), (255, 255, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


def _spool(payload: bytes) -> Path:
    handle = tempfile.NamedTemporaryFile(suffix=".img", delete=False)
    handle.write(payload)
    handle.close()
    return Path(handle.name)


def _ocr_record(index: int) -> OCRRecord:
    return OCRRecord(
        id=f"r{index}",
        bbox=[0, 0, 4, 4],
        text=f"text-{index}",
        score=0.9,
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
    )


def _config(*, concurrency: int, batch_id: str) -> BatchRunConfig:
    return BatchRunConfig(
        stages=BatchStageConfig(
            detect=False, ocr=True, translation=False, segment=False, clean=False
        ),
        source_language="ja",
        target_language="en",
        llm_settings=LLMRequestSettings(),
        extra_context="",
        custom_llm=None,
        default_detection_model="det",
        concurrency=concurrency,
        detect_model_key=None,
        ocr_model_key=None,
        translation_model_key=None,
        segment_model_key=None,
        clean=CleanSettings(None, 5, None, 960, 512, 512),
        gpu=GpuFlags(detect=False, ocr=False, segment=False, clean=False),
        batch_id=batch_id,
        requested_concurrency=concurrency,
    )


class BatchProgressRegistryTests(unittest.TestCase):
    def test_snapshot_contract_and_iso_timestamp(self) -> None:
        clock = _FakeClock()
        registry = BatchProgressRegistry(clock=clock)
        registry.start("batch-1", 3)
        registry.item_started(0, "page0.png")
        registry.item_stage(0, "page0.png", "detect")

        snapshot = registry.snapshot("batch-1")
        self.assertIsNotNone(snapshot)
        self.assertEqual(set(snapshot), PROGRESS_KEYS)
        self.assertEqual(snapshot["batchId"], "batch-1")
        self.assertEqual(snapshot["total"], 3)
        self.assertEqual(snapshot["completed"], 0)
        self.assertEqual(snapshot["failed"], 0)
        self.assertEqual(snapshot["currentIndex"], 0)
        self.assertEqual(snapshot["currentName"], "page0.png")
        self.assertEqual(snapshot["currentStage"], "detect")
        self.assertEqual(snapshot["stageUnitsStarted"], 1)
        self.assertIs(snapshot["cancelled"], False)
        self.assertIs(snapshot["finished"], False)
        parsed = datetime.fromisoformat(str(snapshot["updatedAt"]))
        self.assertIsNotNone(parsed.tzinfo)

    def test_stage_events_move_progress_before_any_item_finishes(self) -> None:
        registry = BatchProgressRegistry(clock=_FakeClock())
        registry.start("batch-1", 2)
        registry.item_started(0, "page0.png")
        for stage in ("detect", "ocr", "translation"):
            registry.item_stage(0, "page0.png", stage)

        snapshot = registry.snapshot("batch-1")
        self.assertEqual(snapshot["stageUnitsStarted"], 3)
        self.assertEqual(snapshot["currentStage"], "translation")
        self.assertEqual(snapshot["completed"], 0)

    def test_unknown_batch_returns_none(self) -> None:
        registry = BatchProgressRegistry(clock=_FakeClock())
        self.assertIsNone(registry.snapshot("missing"))

    def test_item_finished_is_idempotent_per_index(self) -> None:
        registry = BatchProgressRegistry(clock=_FakeClock())
        registry.start("two-phase", 2)
        registry.item_finished(0, "partial")
        registry.item_finished(0, "success")

        snapshot = registry.snapshot("two-phase")
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot["completed"], 1)
        self.assertEqual(snapshot["failed"], 0)
        self.assertIs(snapshot["finished"], False)

        registry.item_finished(1, "failed")
        snapshot = registry.snapshot("two-phase")
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot["completed"], 2)
        self.assertEqual(snapshot["failed"], 1)
        self.assertIs(snapshot["finished"], False)

        registry.finish()
        snapshot = registry.snapshot("two-phase")
        self.assertIsNotNone(snapshot)
        self.assertIs(snapshot["finished"], True)

    def test_finished_entry_expires_after_ttl(self) -> None:
        clock = _FakeClock()
        registry = BatchProgressRegistry(clock=clock)
        registry.start("expire", 1)
        registry.item_started(0, "page0.png")
        registry.item_finished(0, "success")
        registry.finish()

        clock.advance(599)
        self.assertIsNotNone(registry.snapshot("expire"))
        clock.advance(2)
        self.assertIsNone(registry.snapshot("expire"))

    def test_cancel_marks_finished_and_cancelled(self) -> None:
        registry = BatchProgressRegistry(clock=_FakeClock())
        registry.start("cancel", 4)
        registry.item_finished(0, "success")
        registry.cancel()

        snapshot = registry.snapshot("cancel")
        self.assertIsNotNone(snapshot)
        self.assertIs(snapshot["cancelled"], True)
        self.assertIs(snapshot["finished"], True)
        self.assertEqual(snapshot["completed"], 1)

    def test_capacity_evicts_oldest_finished_entry(self) -> None:
        clock = _FakeClock(1000.0)
        registry = BatchProgressRegistry(clock=clock, max_entries=2)
        registry.start("a", 1)
        registry.item_finished(0, "success")
        registry.finish()
        clock.advance(10)
        registry.start("b", 1)
        registry.item_finished(0, "success")
        registry.finish()
        clock.advance(10)
        registry.start("c", 1)

        self.assertIsNone(registry.snapshot("a"))
        self.assertIsNotNone(registry.snapshot("b"))
        self.assertIsNotNone(registry.snapshot("c"))

    def test_capacity_evicts_expired_entries_before_live_finished_ones(self) -> None:
        clock = _FakeClock(1000.0)
        registry = BatchProgressRegistry(clock=clock, max_entries=3)
        registry.start("expired", 1)
        registry.item_finished(0, "success")
        registry.finish()
        clock.advance(100)
        registry.start("finished", 1)
        registry.item_finished(0, "success")
        registry.finish()
        clock.advance(500)
        registry.start("active", 1)

        self.assertIsNone(registry.snapshot("expired"))
        self.assertIsNotNone(registry.snapshot("finished"))
        self.assertIsNotNone(registry.snapshot("active"))


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class BatchProgressOrchestratorTests(unittest.IsolatedAsyncioTestCase):
    async def test_synthetic_run_tracks_monotonic_progress(self) -> None:
        registry = BatchProgressRegistry(clock=_FakeClock())
        registry.start("synthetic", 5)
        observed: list[dict[str, object]] = []

        async def fake_ocr(**kwargs: object) -> StageOutput[OCRRecord]:
            _ = kwargs
            snapshot = registry.snapshot("synthetic")
            if snapshot is not None:
                observed.append(snapshot)
            return StageOutput("ocr", [_ocr_record(len(observed) - 1)])

        png = _png_bytes()
        paths = [_spool(png) for _ in range(5)]
        for path in paths:
            self.addCleanup(path.unlink, missing_ok=True)
        tasks = [
            BatchImageTask(index, f"page{index}.png", str(path))
            for index, path in enumerate(paths)
        ]

        with patch.object(stages, "run_ocr_stage", fake_ocr):
            outcome = await BatchOrchestrator(
                _config(concurrency=1, batch_id="synthetic"),
                asyncio.Event(),
                progress=registry,
            ).run(tasks)

        self.assertEqual(outcome.report.total_images, 5)
        self.assertEqual(outcome.report.succeeded, 5)
        self.assertEqual(len(observed), 5)
        completed_values = [int(snapshot["completed"]) for snapshot in observed]
        self.assertEqual(completed_values, [0, 1, 2, 3, 4])
        for index, snapshot in enumerate(observed):
            self.assertEqual(snapshot["currentIndex"], index)
            self.assertEqual(snapshot["currentName"], f"page{index}.png")

        # The bar has to move while the first page is still working: `completed`
        # only counts finished items, so a run whose stages never reported would
        # sit at zero for the whole batch.
        first = observed[0]
        self.assertEqual(first["currentStage"], "ocr")
        self.assertGreaterEqual(int(str(first["stageUnitsStarted"])), 1)
        self.assertEqual(first["completed"], 0)

        final = registry.snapshot("synthetic")
        self.assertIsNotNone(final)
        self.assertEqual(final["completed"], 5)
        self.assertEqual(final["failed"], 0)
        self.assertEqual(final["currentIndex"], 4)
        self.assertEqual(final["currentName"], "page4.png")
        self.assertIs(final["finished"], True)
        self.assertIs(final["cancelled"], False)

    async def test_cancellation_stops_after_inflight_item(self) -> None:
        registry = BatchProgressRegistry(clock=_FakeClock())
        registry.start("cancel-run", 5)
        cancellation = asyncio.Event()
        calls = 0

        async def fake_ocr(**kwargs: object) -> StageOutput[OCRRecord]:
            nonlocal calls
            _ = kwargs
            calls += 1
            cancellation.set()
            return StageOutput("ocr", [_ocr_record(0)])

        png = _png_bytes()
        paths = [_spool(png) for _ in range(5)]
        for path in paths:
            self.addCleanup(path.unlink, missing_ok=True)
        tasks = [
            BatchImageTask(index, f"page{index}.png", str(path))
            for index, path in enumerate(paths)
        ]

        with patch.object(stages, "run_ocr_stage", fake_ocr):
            outcome = await BatchOrchestrator(
                _config(concurrency=1, batch_id="cancel-run"),
                cancellation,
                progress=registry,
            ).run(tasks)

        self.assertEqual(calls, 1)
        self.assertEqual(outcome.report.total_images, 5)
        self.assertEqual(outcome.report.succeeded, 1)
        self.assertEqual(outcome.report.failed, 4)

        snapshot = registry.snapshot("cancel-run")
        self.assertIsNotNone(snapshot)
        self.assertIs(snapshot["cancelled"], True)
        self.assertIs(snapshot["finished"], True)
        self.assertEqual(snapshot["completed"], 1)
        self.assertEqual(snapshot["currentIndex"], 0)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class BatchProgressRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)
        self.clock = _FakeClock()
        self.registry = BatchProgressRegistry(clock=self.clock)
        self.patch_registry = patch.object(
            pipeline_router,
            "get_batch_progress_registry",
            return_value=self.registry,
        )
        self.patch_registry.start()
        self.addCleanup(self.patch_registry.stop)

    def test_progress_route_returns_the_contract(self) -> None:
        self.registry.start("live", 3)
        self.registry.item_started(1, "page1.png")
        self.registry.item_stage(1, "page1.png", "ocr")
        self.registry.item_finished(0, "success")

        response = self.client.get(
            "/pipeline/batch/progress", params={"batch_id": "live"}
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(set(body), PROGRESS_KEYS)
        self.assertEqual(body["batchId"], "live")
        self.assertEqual(body["total"], 3)
        self.assertEqual(body["completed"], 1)
        self.assertEqual(body["currentIndex"], 1)
        self.assertEqual(body["currentName"], "page1.png")
        self.assertEqual(body["currentStage"], "ocr")
        self.assertEqual(body["stageUnitsStarted"], 1)
        self.assertIs(body["finished"], False)

    def test_progress_route_404_for_unknown_batch(self) -> None:
        response = self.client.get(
            "/pipeline/batch/progress", params={"batch_id": "missing"}
        )
        self.assertEqual(response.status_code, 404)

    def test_progress_route_404_after_ttl(self) -> None:
        self.registry.start("expire", 1)
        self.registry.item_finished(0, "success")
        self.registry.finish()
        self.clock.advance(601)

        response = self.client.get(
            "/pipeline/batch/progress", params={"batch_id": "expire"}
        )
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
