from __future__ import annotations

import sys
import unittest
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from utils.detection_fallback import detect_with_fallbacks  # noqa: E402
from utils.image_variants import BBox  # noqa: E402


@dataclass(frozen=True, slots=True)
class Detection:
    bbox: BBox
    score: float


class DetectionIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_original_early_exit_and_result_ownership(self) -> None:
        calls = 0
        originals = [
            Detection((0, 0, 3, 3), 0.8),
            Detection((4, 4, 8, 8), 0.9),
        ]

        async def detect(_image: Image.Image) -> list[Detection]:
            nonlocal calls
            calls += 1
            return originals

        with Image.new("RGB", (16, 16), "white") as image:
            results, variant = await detect_with_fallbacks(image, detect)
            assert image.size == (16, 16)

        assert calls == 1
        assert variant == "original"
        assert results == originals
        assert results[0] is not originals[0]

    async def test_detector_exception_propagates(self) -> None:
        async def detect(_image: Image.Image) -> list[Detection]:
            raise ValueError("detector failure")

        with Image.new("RGB", (16, 16), "white") as image:
            with self.assertRaisesRegex(ValueError, "detector failure"):
                await detect_with_fallbacks(image, detect)


if __name__ == "__main__":
    unittest.main()
