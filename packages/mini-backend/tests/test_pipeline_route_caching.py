from __future__ import annotations

from io import BytesIO
import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from models.ocr.base_ocr import OCRInputRegion, OCRTextResult
    from models.translation.base_translator import TranslationInputRegion, TranslationTextResult
    from pipelines.cache_manager import CacheManager
    from routers import ocr as ocr_router
    from routers import translation as translation_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


class _FakeOCREngine:
    key = "fake_ocr_model"

    def __init__(self) -> None:
        self.calls = 0

    async def recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        _ = image, language
        self.calls += 1
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


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class PipelineRouteCachingTests(unittest.TestCase):
    @staticmethod
    def _image_bytes() -> bytes:
        image = Image.new("RGB", (32, 32), (255, 255, 255))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    def setUp(self) -> None:
        ocr_router.CACHE_MANAGER = CacheManager(ttl_seconds=1800, max_entries=64, bbox_tolerance_px=5)
        translation_router.CACHE_MANAGER = CacheManager(ttl_seconds=1800, max_entries=64, bbox_tolerance_px=5)

    def test_ocr_route_uses_pipeline_cache_on_repeated_requests(self) -> None:
        fake_engine = _FakeOCREngine()
        client = TestClient(mini_app.app)

        request_data = {
            "model_key": "fake",
            "language": "ja",
            "regions": json.dumps(
                [
                    {
                        "id": "r1",
                        "bbox": [2, 2, 20, 20],
                        "source": "model",
                        "detector_model_key": "det-a",
                    },
                ]
            ),
        }

        with patch.object(ocr_router, "get_ocr_engine", return_value=fake_engine):
            first = client.post(
                "/ocr",
                data=request_data,
                files={"file": ("img.png", self._image_bytes(), "image/png")},
            )
            second = client.post(
                "/ocr",
                data=request_data,
                files={"file": ("img.png", self._image_bytes(), "image/png")},
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(fake_engine.calls, 1)
        self.assertEqual(first.json()["regions"][0]["text"], "text-r1")
        self.assertEqual(second.json()["regions"][0]["text"], "text-r1")

    def test_translation_route_uses_cache_and_invalidates_on_source_text_change(self) -> None:
        fake_engine = _FakeTranslationEngine()
        client = TestClient(mini_app.app)

        base_regions = [
            {
                "id": "r1",
                "text": "こんにちは",
                "source": "model",
                "detector_model_key": "det-a",
                "ocr_model_key": "ocr-a",
            },
        ]

        with patch.object(translation_router, "get_translation_engine", return_value=fake_engine):
            first = client.post(
                "/translate",
                data={
                    "model_key": "fake",
                    "source_language": "ja",
                    "target_language": "en",
                    "extra_context": "ctx",
                    "regions": json.dumps(base_regions),
                },
            )
            second = client.post(
                "/translate",
                data={
                    "model_key": "fake",
                    "source_language": "ja",
                    "target_language": "en",
                    "extra_context": "ctx",
                    "regions": json.dumps(base_regions),
                },
            )
            changed_regions = [
                {
                    "id": "r1",
                    "text": "こんばんは",
                    "source": "model",
                    "detector_model_key": "det-a",
                    "ocr_model_key": "ocr-a",
                },
            ]
            third = client.post(
                "/translate",
                data={
                    "model_key": "fake",
                    "source_language": "ja",
                    "target_language": "en",
                    "extra_context": "ctx",
                    "regions": json.dumps(changed_regions),
                },
            )

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(third.status_code, 200)
        self.assertEqual(fake_engine.calls, 2)
        self.assertEqual(first.json()["regions"][0]["translated_text"], "translated-こんにちは")
        self.assertEqual(second.json()["regions"][0]["translated_text"], "translated-こんにちは")
        self.assertEqual(third.json()["regions"][0]["translated_text"], "translated-こんばんは")

    def test_translation_cache_key_changes_for_custom_provider_api_base_and_model(self) -> None:
        manager = CacheManager(ttl_seconds=1800, max_entries=64, bbox_tolerance_px=5)

        base = manager.build_translation_cache_key(
            model_key="custom:ollama-local",
            source_language="ja",
            target_language="en",
            extra_context="ctx",
            llm_settings={"temperature": 0.2},
            custom_llm={"api_base": "http://127.0.0.1:11434/v1", "model": "qwen2.5:7b"},
        )
        changed_model = manager.build_translation_cache_key(
            model_key="custom:ollama-local",
            source_language="ja",
            target_language="en",
            extra_context="ctx",
            llm_settings={"temperature": 0.2},
            custom_llm={"api_base": "http://127.0.0.1:11434/v1", "model": "llama3.1:8b"},
        )
        changed_api_base = manager.build_translation_cache_key(
            model_key="custom:ollama-local",
            source_language="ja",
            target_language="en",
            extra_context="ctx",
            llm_settings={"temperature": 0.2},
            custom_llm={"api_base": "https://ollama.example.com/v1", "model": "qwen2.5:7b"},
        )

        self.assertNotEqual(base, changed_model)
        self.assertNotEqual(base, changed_api_base)


if __name__ == "__main__":
    unittest.main()
