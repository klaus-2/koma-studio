from __future__ import annotations

from pathlib import Path
import sys
import unittest

from PIL import Image


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.ocr.base_ocr import OCRInputRegion, OCRTextResult  # noqa: E402
from utils.ocr_fallback import recognize_with_fallbacks  # noqa: E402


class _FakeEngine:
    key = "fake_ocr"

    async def recognize(self, image, regions, language="en"):  # noqa: ANN001
        _ = language
        width, _height = image.size
        if width <= 400:
            return [
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text="",
                    score=0.05,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key=self.key,
                )
                for region in regions
            ]

        return [
            OCRTextResult(
                id=region.id,
                bbox=region.bbox,
                text="texto-ok",
                score=0.92,
                source=region.source,
                detector_model_key=region.detector_model_key,
                model_key=self.key,
            )
            for region in regions
        ]


class OcrFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_ocr_fallback_uses_upscaled_variant_for_weak_regions(self) -> None:
        engine = _FakeEngine()
        image = Image.new("RGB", (300, 500), (255, 255, 255))
        regions = [
            OCRInputRegion(id="r1", bbox=(10, 20, 90, 60), source="model", detector_model_key="det"),
        ]

        results = await recognize_with_fallbacks(
            engine=engine,
            image=image,
            regions=regions,
            language="en",
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].text, "texto-ok")
        self.assertEqual(results[0].bbox, regions[0].bbox)


if __name__ == "__main__":
    unittest.main()
