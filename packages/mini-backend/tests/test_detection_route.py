from __future__ import annotations

from io import BytesIO
import os
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
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
    from routers import detection as detection_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


class _FakeDetection:
    def __init__(self) -> None:
        self.bbox = (2, 3, 18, 19)
        self.score = 0.95
        self.label = "text_bubble"
        self.source = "model"
        self.model_key = "fake-detector"
        self.foreground_rgb = (10, 20, 30)
        self.structural_type = "speech"
        self.structural_confidence = 0.88
        self.structural_source = "reference_images"
        self.matched_reference_image = "speech bubble.png"


class _FakeDetector:
    async def detect(self, image: Image.Image) -> list[_FakeDetection]:
        _ = image
        return [_FakeDetection()]


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class DetectionRouteTests(unittest.TestCase):
    @staticmethod
    def _image_bytes() -> bytes:
        image = Image.new("RGB", (24, 24), (255, 255, 255))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    def test_detect_route_returns_optional_foreground_rgb(self) -> None:
        client = TestClient(mini_app.app)
        fake_device = SimpleNamespace(
            has_gpu=False,
            name="cpu",
            onnx_provider="CPUExecutionProvider",
            available_onnx_providers=("CPUExecutionProvider",),
            vram_gb=None,
            acceleration_profile="cpu",
            fallback_reason=None,
            supported_model_families=("ocr", "detection", "enhance", "inpainting", "translation"),
        )
        fake_config = SimpleNamespace(default_detection_model="fake-detector")

        with (
            patch.object(detection_router, "get_device_info", return_value=fake_device),
            patch.object(detection_router, "get_config", return_value=fake_config),
            patch.object(detection_router, "get_detector", return_value=_FakeDetector()),
        ):
            response = client.post(
                "/detect",
                data={"model_key": "fake-detector"},
                files={"file": ("page.png", self._image_bytes(), "image/png")},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["detections"][0]["foreground_rgb"], [10, 20, 30])
        self.assertEqual(payload["detections"][0]["structural_type"], "speech")
        self.assertEqual(payload["detections"][0]["structural_confidence"], 0.88)
        self.assertEqual(payload["detections"][0]["structural_source"], "reference_images")
        self.assertEqual(payload["detections"][0]["matched_reference_image"], "speech bubble.png")


if __name__ == "__main__":
    unittest.main()
