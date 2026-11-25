from __future__ import annotations

import asyncio
import os
import sys
import unittest
from io import BytesIO
from pathlib import Path
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
    from core.device import active_gpu_memory_leases
    from models.execution import InferenceBusyError
    from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
    from routers import ocr as ocr_router
    from routers._boundary import INFERENCE_BUSY_WIRE_CODE
    from routers.export import _read_render_overlay
    from routers.segmentation import _decode_rgb_image
except Exception as exc:  # pragma: no cover
    IMPORT_ERROR = exc


class _LeaseObservingOcr(BaseOCR):
    key = "lease_observer"
    batch_size = 2

    def __init__(self) -> None:
        self.observed_leases: list[int] = []

    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        del image, language
        self.observed_leases.append(active_gpu_memory_leases())
        return [
            OCRTextResult.from_region(region, text="ok", score=1.0, model_key=self.key)
            for region in regions
        ]


def _sample_png_bytes() -> bytes:
    buf = BytesIO()
    Image.new("RGB", (16, 16), (255, 255, 255)).save(buf, format="PNG")
    return buf.getvalue()


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class OcrAdmissionAndLoopTests(unittest.TestCase):
    def test_base_ocr_holds_gpu_lease_during_inference(self) -> None:
        engine = _LeaseObservingOcr()
        regions = [OCRInputRegion(id="r1", bbox=(0, 0, 10, 10))]
        results = asyncio.run(engine.recognize(Image.new("RGB", (32, 32)), regions))
        self.assertEqual(len(results), 1)
        self.assertEqual(engine.observed_leases, [1])
        self.assertEqual(active_gpu_memory_leases(), 0)

    def test_ocr_route_maps_inference_busy_from_detection_and_ocr(self) -> None:
        client = TestClient(mini_app.app)
        png = _sample_png_bytes()

        with patch.object(
            ocr_router,
            "detect_text_seeds",
            side_effect=InferenceBusyError("Inference capacity is exhausted"),
        ):
            response = client.post(
                "/ocr",
                files={"file": ("page.png", png, "image/png")},
                data={"language": "en"},
            )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], INFERENCE_BUSY_WIRE_CODE)

        with patch.object(
            ocr_router,
            "run_cached_ocr",
            side_effect=InferenceBusyError("Inference capacity is exhausted"),
        ):
            response = client.post(
                "/ocr",
                files={"file": ("page.png", png, "image/png")},
                data={
                    "language": "en",
                    "regions": '[{"id":"r1","bbox":[0,0,10,10]}]',
                },
            )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], INFERENCE_BUSY_WIRE_CODE)

    def test_segmentation_and_export_decoders_work_cleanly(self) -> None:
        png = _sample_png_bytes()
        decoded = _decode_rgb_image(png)
        self.assertEqual(decoded.mode, "RGB")
        decoded.close()

        class _UploadStub:
            content_type = "image/png"

            async def read(self) -> bytes:
                return png

        overlay = asyncio.run(
            _read_render_overlay(_UploadStub(), expected_size=(16, 16), label="rendered")  # type: ignore[arg-type]
        )
        self.assertIsNotNone(overlay)
        assert overlay is not None
        self.assertEqual(overlay.mode, "RGBA")
        overlay.close()


if __name__ == "__main__":
    unittest.main()
