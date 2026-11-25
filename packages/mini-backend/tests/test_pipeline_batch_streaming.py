from __future__ import annotations

import asyncio
from io import BytesIO
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

import app as mini_app  # noqa: E402
from pipelines.batch import orchestrator as orchestrator_mod  # noqa: E402
from pipelines.batch import stages  # noqa: E402
from pipelines.batch.orchestrator import (  # noqa: E402
    BatchImageTask,
    BatchOrchestrator,
    BatchRunConfig,
    GpuFlags,
)
from pipelines.batch.progress import BatchProgressRegistry  # noqa: E402
from pipelines.batch.stages import (  # noqa: E402
    CleanSettings,
    LLMRequestSettings,
    StageOutput,
)
from pipelines.queue_processor import QueueItemResult  # noqa: E402
from routers import pipeline as pipeline_router  # noqa: E402
from schemas.pipeline_batch import BatchStageConfig  # noqa: E402

EXPECTED_PROGRESS_KEYS = {
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
    "stageSeconds",
    "lastStageMs",
}


def _png_bytes(color: tuple[int, int, int] = (240, 240, 240)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (16, 16), color=color).save(buffer, format="PNG")
    return buffer.getvalue()


def _make_config(
    *,
    priority_index: int | None = None,
    clean_enabled: bool = False,
    concurrency: int = 1,
    batch_id: str = "stream-batch",
) -> BatchRunConfig:
    return BatchRunConfig(
        stages=BatchStageConfig(
            detect=True,
            ocr=False,
            translation=False,
            segment=False,
            clean=clean_enabled,
        ),
        source_language="ja",
        target_language="en",
        llm_settings=LLMRequestSettings(),
        extra_context="",
        custom_llm=None,
        default_detection_model="default",
        concurrency=concurrency,
        detect_model_key=None,
        ocr_model_key=None,
        translation_model_key=None,
        segment_model_key=None,
        clean=CleanSettings(
            model_key=None,
            mask_dilation=5,
            hd_strategy="resize",
            hd_strategy_resize_limit=960,
            hd_strategy_crop_margin=512,
            hd_strategy_crop_trigger_size=512,
        ),
        gpu=GpuFlags(detect=False, ocr=False, segment=False, clean=False),
        batch_id=batch_id,
        requested_concurrency=concurrency,
        priority_index=priority_index,
    )


def _make_tasks(root: Path, count: int) -> list[BatchImageTask]:
    tasks: list[BatchImageTask] = []
    for idx in range(count):
        image_path = root / f"page-{idx}.png"
        image_path.write_bytes(_png_bytes((idx * 20, 100, 150)))
        tasks.append(
            BatchImageTask(
                index=idx,
                filename=image_path.name,
                image_path=str(image_path),
            )
        )
    return tasks


class BatchPriorityOrderTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.root = Path(self._tmp.name)

    async def test_priority_index_runs_closest_first_and_keeps_sorted_report(self) -> None:
        tasks = _make_tasks(self.root, 5)
        seen_order: list[int] = []

        async def _fake_detect(**kwargs: object) -> StageOutput:
            image = kwargs["image"]
            assert isinstance(image, Image.Image)
            seen_order.append(image.getpixel((0, 0))[0] // 20)
            return StageOutput(model_used="mock-detect", regions=[])

        async def _fake_clean(**kwargs: object) -> stages.CleanStageResult:
            return stages.CleanStageResult(
                model_used="mock-clean",
                hd_strategy="resize",
                png=_png_bytes((1, 2, 3)),
            )

        registry = BatchProgressRegistry()
        registry.start("prio-batch", len(tasks))
        config = _make_config(
            priority_index=2,
            clean_enabled=True,
            concurrency=1,
            batch_id="prio-batch",
        )

        with (
            patch.object(stages, "run_detect_stage", side_effect=_fake_detect),
            patch.object(stages, "run_clean_stage", side_effect=_fake_clean),
        ):
            outcome = await BatchOrchestrator(
                config, asyncio.Event(), progress=registry
            ).run(tasks)

        self.assertEqual(seen_order, [2, 3, 1, 4, 0])
        self.assertEqual([item.index for item in outcome.report.results], [0, 1, 2, 3, 4])
        self.assertEqual([item.index for item in outcome.cleaned], [0, 1, 2, 3, 4])
        self.assertIsNotNone(registry.get_cleaned_page("prio-batch", 2))

    async def test_out_of_range_priority_keeps_original_order(self) -> None:
        tasks = _make_tasks(self.root, 4)
        seen_order: list[int] = []

        async def _fake_detect(**kwargs: object) -> StageOutput:
            image = kwargs["image"]
            assert isinstance(image, Image.Image)
            seen_order.append(image.getpixel((0, 0))[0] // 20)
            return StageOutput(model_used="mock-detect", regions=[])

        with patch.object(stages, "run_detect_stage", side_effect=_fake_detect):
            await BatchOrchestrator(
                _make_config(priority_index=99), asyncio.Event()
            ).run(tasks)

        self.assertEqual(seen_order, [0, 1, 2, 3])

    async def test_queue_failure_maps_back_to_ordered_task_index(self) -> None:
        tasks = _make_tasks(self.root, 4)
        registry = BatchProgressRegistry()
        registry.start("queue-fail-batch", len(tasks))

        async def _fake_process(
            _self: object,
            items: list[object],
            _worker: object,
            **kwargs: object,
        ) -> list[QueueItemResult[object]]:
            del kwargs
            return [
                QueueItemResult(index=0, result=None, error="worker timed out"),
                QueueItemResult(index=1, result=items[1], error=None),
                QueueItemResult(index=2, result=items[2], error=None),
                QueueItemResult(index=3, result=items[3], error=None),
            ]

        with patch.object(
            orchestrator_mod.QueueProcessor, "process", new=_fake_process
        ):
            outcome = await BatchOrchestrator(
                _make_config(priority_index=2, batch_id="queue-fail-batch"),
                asyncio.Event(),
                progress=registry,
            ).run(tasks)

        self.assertEqual(outcome.report.results[2].status, "failed")
        self.assertEqual(outcome.report.results[2].errors[0].stage, "queue")
        self.assertEqual(outcome.report.results[0].errors, [])


class BatchProgressStreamingRegistryTests(unittest.IsolatedAsyncioTestCase):
    async def test_snapshot_keys_unchanged_and_live_page_events_delivered(self) -> None:
        registry = BatchProgressRegistry()
        registry.start("reg-stream", 1)
        subscription = registry.subscribe("reg-stream")
        self.assertIsNotNone(subscription)
        assert subscription is not None
        initial, existing_pages, queue = subscription
        self.assertEqual(set(initial), EXPECTED_PROGRESS_KEYS)
        self.assertEqual(existing_pages, [])

        registry.item_started(0, "page-0.png")
        registry.store_cleaned_page(0, b"png-bytes")
        registry.item_finished(0, "success")
        registry.item_page_ready(
            0,
            {"index": 0, "filename": "page-0.png", "status": "success"},
            has_cleaned=True,
        )
        registry.finish("reg-stream")

        await asyncio.sleep(0.01)
        events: list[tuple[str, dict[str, object]]] = []
        while not queue.empty():
            events.append(queue.get_nowait())

        event_names = [name for name, _ in events]
        self.assertIn("progress", event_names)
        self.assertIn("page", event_names)
        self.assertEqual(event_names[-1], "done")

        page_payload = next(payload for name, payload in events if name == "page")
        self.assertIs(page_payload["has_cleaned"], True)
        self.assertEqual(
            page_payload["cleaned_url"],
            "/pipeline/batch/reg-stream/cleaned/0",
        )
        snap = registry.snapshot("reg-stream")
        self.assertIsNotNone(snap)
        assert snap is not None
        self.assertEqual(set(snap), EXPECTED_PROGRESS_KEYS)

    async def test_finished_batch_replays_pages_and_done_immediately(self) -> None:
        registry = BatchProgressRegistry()
        registry.start("done-batch", 1)
        registry.item_page_ready(
            0,
            {"index": 0, "filename": "page-0.png", "status": "success"},
            has_cleaned=False,
        )
        registry.finish("done-batch")

        subscription = registry.subscribe("done-batch")
        self.assertIsNotNone(subscription)
        assert subscription is not None
        initial, existing_pages, _ = subscription
        self.assertIs(initial["finished"], True)
        self.assertEqual(len(existing_pages), 1)
        self.assertEqual(existing_pages[0]["cleaned_url"], None)


class BatchStreamingRouterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registry = BatchProgressRegistry()
        self.client = TestClient(mini_app.app)

    def _parse_sse(self, raw_body: str) -> tuple[list[tuple[str, dict[str, object]]], list[str]]:
        events: list[tuple[str, dict[str, object]]] = []
        comments: list[str] = []
        normalized = raw_body.replace("\r\n", "\n")
        for block in normalized.split("\n\n"):
            if not block.strip():
                continue
            event_name = "message"
            data_lines: list[str] = []
            for line in block.split("\n"):
                if line.startswith(":"):
                    comments.append(line)
                elif line.startswith("event:"):
                    event_name = line.split(":", 1)[1].strip()
                elif line.startswith("data:"):
                    data_lines.append(line.split(":", 1)[1].strip())
            if data_lines:
                events.append((event_name, json.loads("\n".join(data_lines))))
        return events, comments

    def test_events_validation_and_cleaned_page_endpoint(self) -> None:
        with patch.object(
            pipeline_router, "get_batch_progress_registry", return_value=self.registry
        ):
            self.assertEqual(
                self.client.get("/pipeline/batch/missing-id/events").status_code,
                404,
            )
            self.assertEqual(
                self.client.get("/pipeline/batch/bad id!/events").status_code,
                400,
            )

            self.registry.start("img-batch", 1)
            self.registry.store_cleaned_page(0, b"PNGDATA", batch_id="img-batch")

            self.assertEqual(
                self.client.get("/pipeline/batch/img-batch/cleaned/-1").status_code,
                400,
            )
            self.assertEqual(
                self.client.get("/pipeline/batch/img-batch/cleaned/9").status_code,
                404,
            )
            ok = self.client.get("/pipeline/batch/img-batch/cleaned/0")
            self.assertEqual(ok.status_code, 200)
            self.assertEqual(ok.headers["content-type"], "image/png")
            self.assertEqual(ok.headers["cache-control"], "no-store")
            self.assertEqual(ok.content, b"PNGDATA")

    def test_sse_stream_emits_keepalive_page_and_done(self) -> None:
        self.registry.start("live-sse", 1)

        def _drive_batch() -> None:
            time.sleep(0.06)
            self.registry.store_cleaned_page(0, b"PNG", batch_id="live-sse")
            self.registry.finish("live-sse")

        worker = threading.Thread(target=_drive_batch, daemon=True)
        with (
            patch.object(
                pipeline_router, "get_batch_progress_registry", return_value=self.registry
            ),
            patch.object(pipeline_router, "_SSE_KEEPALIVE_SECONDS", 0.02),
        ):
            worker.start()
            with self.client.stream("GET", "/pipeline/batch/live-sse/events") as response:
                self.assertEqual(response.status_code, 200)
                self.assertTrue(
                    response.headers["content-type"].startswith("text/event-stream")
                )
                body = response.read().decode("utf-8")
        worker.join(timeout=2.0)

        events, comments = self._parse_sse(body)
        self.assertGreaterEqual(len(comments), 1)
        self.assertIn(": keepalive", comments[0])
        self.assertEqual(events[0][0], "progress")
        self.assertEqual(events[-1][0], "done")

    def test_pipeline_batch_form_accepts_priority_index(self) -> None:
        captured_priority: list[int | None] = []

        async def _fake_run(self_orch: BatchOrchestrator, tasks: list[BatchImageTask]):
            captured_priority.append(self_orch._config.priority_index)
            from schemas.pipeline_batch import BatchReport

            return orchestrator_mod.BatchOutcome(
                report=BatchReport(
                    batch_id=self_orch._config.batch_id,
                    total_images=len(tasks),
                    succeeded=len(tasks),
                    partial=0,
                    failed=0,
                    stages=self_orch._config.stages,
                    results=[],
                ),
                cleaned=[],
            )

        with (
            patch.object(
                pipeline_router, "get_batch_progress_registry", return_value=self.registry
            ),
            patch.object(orchestrator_mod.BatchOrchestrator, "run", new=_fake_run),
        ):
            response = self.client.post(
                "/pipeline/batch",
                files=[("files", ("p0.png", _png_bytes(), "image/png"))],
                data={
                    "run_detect": "true",
                    "run_ocr": "false",
                    "run_translation": "false",
                    "run_segment": "false",
                    "run_clean": "false",
                    "priority_index": "0",
                    "batch_id": "prio-form-1",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(captured_priority, [0])
