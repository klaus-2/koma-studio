from __future__ import annotations

from io import BytesIO
import json
import os
from pathlib import Path
from types import SimpleNamespace
import sys
import unittest
from unittest.mock import patch
import zipfile

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

    from models.ocr.base_ocr import OCRInputRegion, OCRTextResult
    from models.translation.base_translator import TranslationInputRegion, TranslationTextResult
    from pipelines.batch import stages as stages_module
    from pipelines.cache_manager import CacheManager
    from routers import ocr as ocr_router
    from routers import pipeline as pipeline_router
    from routers import translation as translation_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


def _png_bytes(width: int, height: int = 20) -> bytes:
    image = Image.new("RGB", (width, height), (255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


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

    def __init__(self) -> None:
        self.calls = 0

    async def recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "ja",
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
    ) -> list[TranslationTextResult]:
        _ = source_language, target_language, extra_context
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


class _FakeSegmenter:
    key = "fake_segmenter"

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
            )
            for region in regions
        ]


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
                get_ocr_engine=lambda **_: self.fake_ocr,
                get_translation_engine=lambda **_: self.fake_translation,
                get_segmenter=lambda **_: self.fake_segmenter,
                get_inpainter=lambda **_: self.fake_inpainter,
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


if __name__ == "__main__":
    unittest.main()
