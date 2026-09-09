from __future__ import annotations

from pathlib import Path
import sys
from types import SimpleNamespace
import unittest

from PIL import Image


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from utils.detection_fallback import detect_with_fallbacks  # noqa: E402


class DetectionFallbackTests(unittest.IsolatedAsyncioTestCase):
    async def test_detect_with_fallbacks_prefers_non_empty_variant(self) -> None:
        image = Image.new("RGB", (120, 200), (255, 255, 255))

        async def fake_runner(variant_image: Image.Image) -> list[object]:
            if variant_image.size == image.size:
                return []
            return [SimpleNamespace(bbox=(10, 20, 60, 80), score=0.9)]

        detections, variant = await detect_with_fallbacks(image, fake_runner)

        self.assertEqual(variant, "border")
        self.assertEqual(len(detections), 1)
        self.assertEqual(tuple(detections[0].bbox), (10, 20, 60, 80))

    async def test_detect_with_fallbacks_maps_upscaled_bboxes_back_to_original(self) -> None:
        image = Image.new("RGB", (300, 500), (255, 255, 255))

        async def fake_runner(variant_image: Image.Image) -> list[object]:
            if variant_image.size == image.size:
                return []
            if variant_image.size[1] > 1000:
                return [SimpleNamespace(bbox=(90, 120, 210, 300), score=0.95)]
            return []

        detections, variant = await detect_with_fallbacks(image, fake_runner)

        self.assertEqual(variant, "upscale")
        self.assertEqual(len(detections), 1)
        self.assertEqual(tuple(detections[0].bbox), (32, 43, 75, 107))


if __name__ == "__main__":
    unittest.main()
