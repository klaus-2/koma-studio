from __future__ import annotations

import asyncio
from io import BytesIO
import json
import os
from pathlib import Path
import re
import shutil
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

from fastapi import HTTPException
from fastapi.testclient import TestClient
from PIL import Image


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from contextlib import ExitStack

    from core.config import get_config
    from models.execution import get_inference_worker_capacity
    from models.ocr.base_ocr import OCRInputRegion, OCRTextResult
    from pipelines import ocr_stage
    from models.translation.base_translator import TranslationInputRegion, TranslationTextResult
    from pipelines import translation_stage
    from pipelines.batch import stages as stages_module
    from pipelines.batch.orchestrator import PER_IMAGE_TIMEOUT_SECONDS, BatchOutcome
    from pipelines import detection_seeds as detection_seeds_module
    from pipelines.cache_manager import CacheManager
    from routers import ocr as ocr_router
    from routers import pipeline as pipeline_router
    from routers import translation as translation_router
    from schemas.pipeline_batch import BatchItemResult, BatchReport
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


def _png_bytes(width: int, height: int = 20) -> bytes:
    image = Image.new("RGB", (width, height), (255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _write_sparse_file(path: Path, size: int) -> None:
    with path.open("wb") as handle:
        handle.seek(size - 1)
        handle.write(b"\x00")


class _FakeDetection:
    def __init__(
        self,
        bbox: tuple[int, int, int, int],
        *,
        foreground_rgb: tuple[int, int, int] | None = None,
    ) -> None:
        self.bbox = bbox
        self.source = "model"
        self.model_key = "fake-detector"
        self.foreground_rgb = foreground_rgb


class _FakeDetector:
    async def detect(self, image: Image.Image) -> list[_FakeDetection]:
        return [
            _FakeDetection(
                (1, 1, max(2, image.width - 1), max(2, image.height - 1)),
                foreground_rgb=(12, 34, 56),
            )
        ]


class _FakeOCREngine:
    key = "fake_ocr_model"
    device_decision_reason: str | None = None

    def __init__(self) -> None:
        self.calls = 0

    async def recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "ja",
        cancellation_event: object = None,
    ) -> list[OCRTextResult]:
        _ = language
        self.calls += 1
        if image.width == 17:
            raise RuntimeError("ocr failed")
        return [
            OCRTextResult(
                id=region.id,
                bbox=region.bbox,
                text=f"text-{region.id}",
                score=0.99,
                source=region.source,
                detector_model_key=region.detector_model_key,
                model_key=self.key,
            )
            for region in regions
        ]


class _ConcurrencyTrackingOCREngine(_FakeOCREngine):
    """Counts overlapping OCR calls: the queue must never exceed the effective cap."""

    def __init__(self) -> None:
        super().__init__()
        self.active = 0
        self.peak = 0

    async def recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "ja",
        cancellation_event: object = None,
    ) -> list[OCRTextResult]:
        self.active += 1
        self.peak = max(self.peak, self.active)
        try:
            await asyncio.sleep(0.02)
            return await super().recognize(image, regions, language, cancellation_event)
        finally:
            self.active -= 1


class _FakeTranslationEngine:
    key = "fake_translation_model"

    def __init__(self) -> None:
        self.calls = 0

    async def translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = source_language, target_language, extra_context
        _ = translation_notes_enabled, translation_mode
        self.calls += 1
        return [
            TranslationTextResult(
                id=region.id,
                source_text=region.text,
                translated_text=f"translated-{region.text}",
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=self.key,
            )
            for region in regions
        ]


class _FakeInpainter:
    key = "fake_inpainter"

    async def inpaint(self, image, mask, config):  # noqa: ANN001
        _ = mask, config
        return image


class _FakeSegmentResult:
    def __init__(
        self,
        *,
        region_id: str,
        bbox: tuple[int, int, int, int],
        source: str,
        detector_model_key: str,
        ocr_model_key: str,
        translator_model_key: str,
        segment_model_key: str,
        mask_base64: str = "",
    ) -> None:
        self.id = region_id
        self.bbox = bbox
        self.segment_boxes = [bbox]
        self.merged_boxes = [bbox]
        self.source = source
        self.detector_model_key = detector_model_key
        self.ocr_model_key = ocr_model_key
        self.translator_model_key = translator_model_key
        self.segment_model_key = segment_model_key
        self.mask_base64 = mask_base64


class _FakeSegmenter:
    key = "fake_segmenter"

    def __init__(self, *, mask_base64: str = "") -> None:
        self.mask_base64 = mask_base64

    async def segment(self, image_bytes, regions):  # noqa: ANN001
        _ = image_bytes
        return [
            _FakeSegmentResult(
                region_id=region.id,
                bbox=region.bbox,
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=region.translator_model_key,
                segment_model_key=self.key,
                mask_base64=self.mask_base64,
            )
            for region in regions
        ]


class _StubBatchOrchestrator:
    """Marks every item successful without touching a model."""

    def __init__(self, config, cancellation_event, *, progress=None) -> None:  # noqa: ANN001
        _ = cancellation_event
        _ = progress
        self._config = config

    async def run(self, tasks):  # noqa: ANN001, ANN201
        requested = (
            self._config.requested_concurrency
            if self._config.requested_concurrency is not None
            else self._config.concurrency
        )
        report = BatchReport(
            batch_id=self._config.batch_id,
            total_images=len(tasks),
            succeeded=len(tasks),
            failed=0,
            partial=0,
            stages=self._config.stages,
            results=[
                BatchItemResult(index=task.index, filename=task.filename, status="success")
                for task in tasks
            ],
            requested_concurrency=requested,
            effective_concurrency=self._config.concurrency,
        )
        return BatchOutcome(report=report, cleaned=[])


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class PipelineBatchRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(mini_app.app)
        self.fake_ocr = _FakeOCREngine()
        self.fake_translation = _FakeTranslationEngine()
        self.fake_detector = _FakeDetector()
        self.fake_segmenter = _FakeSegmenter()
        self.fake_inpainter = _FakeInpainter()
        ocr_router.CACHE_MANAGER = CacheManager(ttl_seconds=1800, max_entries=128, bbox_tolerance_px=5)
        translation_router.CACHE_MANAGER = CacheManager(ttl_seconds=1800, max_entries=128, bbox_tolerance_px=5)

    def _patch_pipeline_dependencies(self):
        # The batch stages own the model factories now; patching pipeline_router
        # alone would leave the real ONNX factories in play.
        stack = ExitStack()
        stack.enter_context(
            patch.multiple(
                stages_module,
                get_detector=lambda **_: self.fake_detector,
                get_segmenter=lambda **_: self.fake_segmenter,
                get_inpainter=lambda **_: self.fake_inpainter,
            )
        )
        # Seed detection (batch OCR without supplied seeds) resolves the
        # detector through the shared detection_seeds module.
        stack.enter_context(
            patch.object(
                detection_seeds_module,
                "get_detector",
                lambda **_: self.fake_detector,
            )
        )
        # Engine resolution lives in the Recognize Text stage module now.
        stack.enter_context(
            patch.object(ocr_stage, "get_ocr_engine", lambda **_: self.fake_ocr)
        )
        stack.enter_context(
            patch.object(
                translation_stage,
                "get_translation_engine",
                lambda **_: self.fake_translation,
            )
        )
        stack.enter_context(
            patch.multiple(
                pipeline_router,
                get_device_info=lambda: SimpleNamespace(
                    has_gpu=False,
                    name="cpu",
                    onnx_provider="CPUExecutionProvider",
                    available_onnx_providers=("CPUExecutionProvider",),
                    vram_gb=None,
                    acceleration_profile="cpu",
                    fallback_reason=None,
                    supported_model_families=("ocr", "detection", "enhance", "inpainting", "translation"),
                ),
            )
        )
        return stack

    def test_batch_with_clean_returns_zip_with_report_and_images(self) -> None:
        files = [
            ("files", ("page1.png", _png_bytes(20), "image/png")),
            ("files", ("page2.png", _png_bytes(22), "image/png")),
        ]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "true",
                    "run_clean": "true",
                    "concurrency": "2",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("content-type"), "application/zip")
        self.assertRegex(
            response.headers.get("x-koma-batch-id", ""), r"^[A-Za-z0-9_-]{1,64}$"
        )

        with zipfile.ZipFile(BytesIO(response.content), "r") as archive:
            names = set(archive.namelist())
            self.assertIn("batch_report.json", names)
            cleaned_files = [name for name in names if name.startswith("cleaned/")]
            self.assertEqual(len(cleaned_files), 2)
            report = json.loads(archive.read("batch_report.json"))

        self.assertEqual(report["total_images"], 2)
        self.assertEqual(report["succeeded"], 2)
        self.assertEqual(report["failed"], 0)
        self.assertEqual(report["partial"], 0)

    def test_batch_continues_when_one_image_fails_ocr(self) -> None:
        files = [
            ("files", ("broken.png", _png_bytes(17), "image/png")),
            ("files", ("ok.png", _png_bytes(18), "image/png")),
        ]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "true",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertEqual(report["total_images"], 2)
        statuses = {item["filename"]: item["status"] for item in report["results"]}
        self.assertEqual(statuses["broken.png"], "failed")
        self.assertEqual(statuses["ok.png"], "success")

    def test_batch_without_clean_returns_json_report(self) -> None:
        files = [("files", ("page.png", _png_bytes(20), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers.get("content-type", "").startswith("application/json"))
        report = response.json()
        self.assertEqual(report["total_images"], 1)
        self.assertEqual(report["succeeded"], 1)
        self.assertEqual(report["failed"], 0)

    def test_batch_rejects_when_image_limit_is_exceeded(self) -> None:
        files = [
            ("files", ("page1.png", _png_bytes(20), "image/png")),
            ("files", ("page2.png", _png_bytes(20), "image/png")),
        ]
        fake_config = SimpleNamespace(
            default_detection_model="fake-detector",
            batch_max_images=1,
            batch_default_concurrency=1,
            batch_max_concurrency=4,
        )
        with self._patch_pipeline_dependencies(), patch.object(
            pipeline_router,
            "get_config",
            return_value=fake_config,
        ):
            response = self.client.post("/pipeline/batch", files=files, data={"run_clean": "false"})

        self.assertEqual(response.status_code, 400)
        # tauri app responds in English (legacy test expected PT — v2 debt)
        self.assertIn("limit", response.json()["detail"])

    def test_batch_detect_and_segment_returns_detailed_payload(self) -> None:
        files = [("files", ("page.png", _png_bytes(24), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_detect": "true",
                    "run_ocr": "true",
                    "run_translation": "true",
                    "run_segment": "true",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertEqual(report["total_images"], 1)
        self.assertEqual(report["succeeded"], 1)
        self.assertEqual(report["failed"], 0)
        self.assertEqual(report["partial"], 0)
        self.assertEqual(report["stages"]["detect"], True)
        self.assertEqual(report["stages"]["segment"], True)

        item = report["results"][0]
        self.assertEqual(item["status"], "success")
        self.assertIn("detect", item)
        self.assertIn("ocr", item)
        self.assertIn("translation", item)
        self.assertIn("segment", item)
        self.assertGreaterEqual(len(item["detect"]["detections"]), 1)
        self.assertGreaterEqual(len(item["ocr"]["regions"]), 1)
        self.assertGreaterEqual(len(item["translation"]["regions"]), 1)
        self.assertGreaterEqual(len(item["segment"]["regions"]), 1)
        self.assertEqual(item["detect"]["detections"][0]["foreground_rgb"], [12, 34, 56])

    # ------------------------------------------------------------- 3.1 caps

    def test_config_caps_match_phase_three_budget(self) -> None:
        cfg = get_config()
        self.assertEqual(cfg.batch_max_images, 64)
        self.assertEqual(cfg.batch_max_concurrency, 32)
        self.assertEqual(pipeline_router._MAX_IMAGE_BYTES, 50 * 1024 * 1024)

    def test_batch_accepts_64_images(self) -> None:
        files = [
            ("files", (f"page{i}.png", _png_bytes(12), "image/png"))
            for i in range(64)
        ]
        with self._patch_pipeline_dependencies(), patch.object(
            pipeline_router, "BatchOrchestrator", _StubBatchOrchestrator
        ):
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertEqual(report["total_images"], 64)
        self.assertEqual(report["succeeded"], 64)

    def test_batch_rejects_65_images(self) -> None:
        files = [
            ("files", (f"page{i}.png", _png_bytes(12), "image/png"))
            for i in range(65)
        ]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("64", response.json()["detail"])

    def test_spool_accepts_33_mib_and_rejects_51_mib(self) -> None:
        self.assertEqual(pipeline_router._MAX_IMAGE_BYTES, 50 * 1024 * 1024)
        with tempfile.TemporaryDirectory() as raw_dir:
            root = Path(raw_dir)
            accepted_path = root / "accepted.img"
            _write_sparse_file(accepted_path, 33 * 1024 * 1024)
            with accepted_path.open("rb") as handle:
                upload = SimpleNamespace(filename="accepted.png", file=handle)
                tasks = asyncio.run(
                    pipeline_router._spool_uploads(
                        [upload], limit_bytes=pipeline_router._MAX_IMAGE_BYTES
                    )
                )
            self.assertEqual(len(tasks), 1)
            spool_dir = Path(tasks[0].image_path).parent
            try:
                self.assertEqual(
                    Path(tasks[0].image_path).stat().st_size, 33 * 1024 * 1024
                )
            finally:
                shutil.rmtree(spool_dir, ignore_errors=True)

            rejected_path = root / "rejected.img"
            _write_sparse_file(rejected_path, 51 * 1024 * 1024)
            with rejected_path.open("rb") as handle:
                upload = SimpleNamespace(filename="rejected.png", file=handle)
                with self.assertRaises(HTTPException) as raised:
                    asyncio.run(
                        pipeline_router._spool_uploads(
                            [upload], limit_bytes=pipeline_router._MAX_IMAGE_BYTES
                        )
                    )

        self.assertEqual(raised.exception.status_code, 413)
        self.assertIn("50 MiB", str(raised.exception.detail))

    # --------------------------------------------------------- 3.2 batch id

    def test_batch_id_is_echoed_on_json_report(self) -> None:
        files = [("files", ("page.png", _png_bytes(20), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                    "batch_id": "client-batch_01",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("x-koma-batch-id"), "client-batch_01")
        self.assertEqual(response.json()["batch_id"], "client-batch_01")
        snapshot = pipeline_router.get_batch_progress_registry().snapshot(
            "client-batch_01"
        )
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot["completed"], 1)
        self.assertIs(snapshot["finished"], True)

    def test_batch_id_is_generated_when_absent(self) -> None:
        files = [("files", ("page.png", _png_bytes(20), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        generated = response.headers.get("x-koma-batch-id", "")
        self.assertIsNotNone(re.fullmatch(r"[A-Za-z0-9_-]{1,64}", generated))
        self.assertEqual(response.json()["batch_id"], generated)

    def test_batch_id_rejects_invalid_value(self) -> None:
        files = [("files", ("page.png", _png_bytes(20), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                    "batch_id": "bad id!",
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertIn("batch_id", response.json()["detail"])

    def test_batch_id_header_is_exposed_to_the_desktop_origin(self) -> None:
        files = [("files", ("page.png", _png_bytes(20), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                headers={"Origin": "tauri://localhost"},
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                    "batch_id": "cors-batch",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("x-koma-batch-id"), "cors-batch")
        self.assertEqual(
            response.headers.get("access-control-expose-headers"),
            "X-Koma-Batch-Id",
        )

    # ------------------------------------------------------ 3.3 concurrency

    def test_batch_capacity_contract(self) -> None:
        cfg = get_config()
        response = self.client.get(
            "/pipeline/batch/capacity", params={"concurrency": 32}
        )
        self.assertEqual(response.status_code, 200)
        body = response.json()
        capacity = get_inference_worker_capacity()
        self.assertEqual(body["maxImages"], cfg.batch_max_images)
        self.assertEqual(body["maxImageBytes"], pipeline_router._MAX_IMAGE_BYTES)
        self.assertEqual(body["requestedConcurrency"], 32)
        self.assertEqual(
            body["effectiveConcurrency"],
            min(32, cfg.batch_max_concurrency, capacity),
        )
        self.assertEqual(body["perImageBudgetSeconds"], PER_IMAGE_TIMEOUT_SECONDS)

    def test_batch_capacity_defaults_to_batch_default_concurrency(self) -> None:
        cfg = get_config()
        body = self.client.get("/pipeline/batch/capacity").json()
        self.assertEqual(body["requestedConcurrency"], cfg.batch_default_concurrency)
        self.assertEqual(
            body["effectiveConcurrency"],
            min(
                cfg.batch_default_concurrency,
                cfg.batch_max_concurrency,
                get_inference_worker_capacity(),
            ),
        )

    def test_batch_runs_at_inference_capacity_and_reports_both_values(self) -> None:
        self.fake_ocr = _ConcurrencyTrackingOCREngine()
        cfg = get_config()
        capacity = get_inference_worker_capacity()
        expected = min(32, cfg.batch_max_concurrency, capacity)
        files = [
            ("files", (f"page{i}.png", _png_bytes(18), "image/png"))
            for i in range(8)
        ]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                    "concurrency": "32",
                },
            )

        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertEqual(report["requested_concurrency"], 32)
        self.assertEqual(report["effective_concurrency"], expected)
        if capacity == 4:
            # The measured device-independent case: ask 32, run 4.
            self.assertEqual(report["effective_concurrency"], 4)
        self.assertEqual(len(report["results"]), 8)
        self.assertTrue(all(item["status"] == "success" for item in report["results"]))
        self.assertLessEqual(self.fake_ocr.peak, expected)
        if expected < 32:
            self.assertIsNotNone(report["concurrency_note"])
            self.assertIn("32", report["concurrency_note"])
        else:
            self.assertIsNone(report["concurrency_note"])

    def test_batch_without_concurrency_uses_the_default(self) -> None:
        cfg = get_config()
        expected = min(
            cfg.batch_default_concurrency,
            cfg.batch_max_concurrency,
            get_inference_worker_capacity(),
        )
        files = [("files", ("page.png", _png_bytes(20), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        report = response.json()
        self.assertEqual(report["requested_concurrency"], cfg.batch_default_concurrency)
        self.assertEqual(report["effective_concurrency"], expected)
        if cfg.batch_default_concurrency < 32:
            self.assertLess(report["effective_concurrency"], 32)

    # -------------------------------------------------- 3.4 failure isolation

    def test_batch_failure_isolated_to_one_item(self) -> None:
        files = [
            ("files", (f"page{i}.png", _png_bytes(17 if i == 2 else 18), "image/png"))
            for i in range(5)
        ]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "true",
                    "concurrency": "2",
                },
            )

        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(BytesIO(response.content), "r") as archive:
            report = json.loads(archive.read("batch_report.json"))

        self.assertEqual(report["total_images"], 5)
        self.assertEqual(
            [item["status"] for item in report["results"]],
            ["success", "success", "partial", "success", "success"],
        )
        self.assertEqual(report["succeeded"], 4)
        self.assertEqual(report["partial"], 1)
        self.assertEqual(report["failed"], 0)
        broken = report["results"][2]
        self.assertEqual([error["stage"] for error in broken["errors"]], ["ocr"])
        self.assertIn("ocr failed", broken["errors"][0]["message"])
        for index, item in enumerate(report["results"]):
            if index != 2:
                self.assertEqual(item["errors"], [])

    # -------------------------------------------------- 3.5 payload / timeout

    def test_segment_payload_round_trips_mask_base64(self) -> None:
        self.fake_segmenter = _FakeSegmenter(mask_base64="bWFzay1ieXRlcw==")
        files = [("files", ("page.png", _png_bytes(24), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_detect": "true",
                    "run_ocr": "false",
                    "run_translation": "false",
                    "run_segment": "true",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        region = response.json()["results"][0]["segment"]["regions"][0]
        self.assertEqual(region["mask_base64"], "bWFzay1ieXRlcw==")

    def test_segment_payload_emits_null_mask_when_absent(self) -> None:
        files = [("files", ("page.png", _png_bytes(24), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_detect": "true",
                    "run_ocr": "false",
                    "run_translation": "false",
                    "run_segment": "true",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        region = response.json()["results"][0]["segment"]["regions"][0]
        self.assertIn("mask_base64", region)
        self.assertIsNone(region["mask_base64"])

    def test_ocr_device_decision_reaches_batch_report(self) -> None:
        self.fake_ocr.device_decision_reason = "vram_to_cpu"
        files = [("files", ("page.png", _png_bytes(20), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "true",
                },
            )

        self.assertEqual(response.status_code, 200)
        with zipfile.ZipFile(BytesIO(response.content), "r") as archive:
            report = json.loads(archive.read("batch_report.json"))

        item = report["results"][0]
        self.assertEqual(item["status"], "success")
        self.assertIs(item["ocr"]["fell_back_to_cpu"], True)
        self.assertEqual(item["ocr"]["fallback_reason"], "vram_to_cpu")
        self.assertNotIn("fallback_reason", item["clean"])

    def test_ocr_without_fallback_omits_fallback_fields(self) -> None:
        files = [("files", ("page.png", _png_bytes(20), "image/png"))]
        with self._patch_pipeline_dependencies():
            response = self.client.post(
                "/pipeline/batch",
                files=files,
                data={
                    "run_ocr": "true",
                    "run_translation": "false",
                    "run_clean": "false",
                },
            )

        self.assertEqual(response.status_code, 200)
        ocr_payload = response.json()["results"][0]["ocr"]
        self.assertNotIn("fell_back_to_cpu", ocr_payload)
        self.assertNotIn("fallback_reason", ocr_payload)

    def test_per_image_budget_is_1200_seconds(self) -> None:
        self.assertEqual(PER_IMAGE_TIMEOUT_SECONDS, 1200.0)
        body = self.client.get("/pipeline/batch/capacity").json()
        self.assertEqual(body["perImageBudgetSeconds"], 1200.0)
        self.assertEqual(body["perImageBudgetSeconds"], PER_IMAGE_TIMEOUT_SECONDS)
        self.assertIsInstance(body["perImageBudgetSeconds"], float)


if __name__ == "__main__":
    unittest.main()
