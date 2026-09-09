from __future__ import annotations

from io import BytesIO
import os
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient
from PIL import Image


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from routers import enhance as enhance_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


class _FakeEnhancer:
    key = "waifu2x_swin_unet_art_scan_2x"
    scale = 2

    async def enhance(self, image: np.ndarray) -> np.ndarray:
        height, width = image.shape[:2]
        return np.full((height * 2, width * 2, 3), 192, dtype=np.uint8)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class EnhanceRouteTests(unittest.TestCase):
    @staticmethod
    def _image_bytes() -> bytes:
        image = Image.new("RGB", (24, 24), (255, 255, 255))
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    def test_enhance_models_route_returns_catalog(self) -> None:
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
        with (
            patch.object(enhance_router, "get_device_info", return_value=fake_device),
            patch.object(
                enhance_router,
                "list_enhancement_models",
                return_value=[{"key": "waifu2x_swin_unet_art_scan_2x", "available": True}],
            ),
        ):
            response = client.get("/enhance/models")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["device"]["provider"], "CPUExecutionProvider")
        self.assertEqual(payload["models"][0]["key"], "waifu2x_swin_unet_art_scan_2x")

    def test_enhance_route_returns_processed_png(self) -> None:
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
        with (
            patch.object(enhance_router, "get_device_info", return_value=fake_device),
            patch.object(enhance_router, "get_enhancer", return_value=_FakeEnhancer()),
        ):
            response = client.post(
                "/enhance",
                data={
                    "model_key": "waifu2x_swin_unet_art_scan_2x",
                    "output_format": "png",
                },
                files={"file": ("page.png", self._image_bytes(), "image/png")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["content-type"], "image/png")
        self.assertEqual(response.headers["x-enhance-model"], "waifu2x_swin_unet_art_scan_2x")
        image = Image.open(BytesIO(response.content))
        self.assertEqual(image.size, (48, 48))


if __name__ == "__main__":
    unittest.main()
