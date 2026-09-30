from __future__ import annotations

import asyncio
import unittest

import numpy as np
from PIL import Image

from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult


class _Echo(BaseOCR):
    key = "echo"
    batch_size = 2

    def __init__(self) -> None:
        self.seen: list[tuple[int, int]] = []

    def _recognize(self, image: Image.Image, regions: list[OCRInputRegion], language: str = "en"):
        rgb = np.asarray(image.convert("RGB"))
        for _ in regions:
            self.seen.append(rgb.shape[:2])
        return [
            OCRTextResult(
                id=region.id,
                bbox=region.bbox,
                text=f"text-{region.id}",
                score=0.9,
                source=region.source,
                detector_model_key=region.detector_model_key,
                model_key=self.key,
            )
            for region in regions
        ]


class BaseOcrBatchingTests(unittest.TestCase):
    def test_results_preserve_order_and_metadata(self) -> None:
        engine = _Echo()
        regions = [OCRInputRegion(id=str(i), bbox=(0, 0, 10, 10)) for i in range(5)]
        results = asyncio.run(engine.recognize(Image.new("RGB", (100, 100)), regions))
        self.assertEqual([r.id for r in results], ["0", "1", "2", "3", "4"])
        self.assertTrue(all(r.model_key == "echo" and r.score == 0.9 for r in results))

    def test_cancellation_between_batches_returns_empty_tail(self) -> None:
        engine = _Echo()
        event = asyncio.Event()
        event.set()
        regions = [OCRInputRegion(id=str(i), bbox=(0, 0, 10, 10)) for i in range(3)]
        results = asyncio.run(
            engine.recognize(Image.new("RGB", (100, 100)), regions, cancellation_event=event)
        )
        self.assertEqual(engine.seen, [])
        self.assertEqual([r.text for r in results], ["", "", ""])


if __name__ == "__main__":
    unittest.main()
