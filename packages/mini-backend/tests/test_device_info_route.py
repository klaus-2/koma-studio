from __future__ import annotations

import os
from pathlib import Path
import sys
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class DeviceInfoRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self._original_session_secret = mini_app.LOCAL_API_SESSION_SECRET
        self._original_environment = mini_app.ENVIRONMENT

    def tearDown(self) -> None:
        mini_app.LOCAL_API_SESSION_SECRET = self._original_session_secret
        mini_app.ENVIRONMENT = self._original_environment

    def test_device_info_returns_local_hardware_snapshot(self) -> None:
        client = TestClient(mini_app.app)
        fake_device = SimpleNamespace(
            name="RTX 4070",
            has_gpu=True,
            onnx_provider="CUDAExecutionProvider",
            available_onnx_providers=("CUDAExecutionProvider", "CPUExecutionProvider"),
            vram_gb=12.0,
            acceleration_profile="nvidia-cuda",
            fallback_reason=None,
            supported_model_families=("ocr", "detection", "enhance", "inpainting", "translation"),
        )

        with patch.object(mini_app, "get_device_info", return_value=fake_device):
            response = client.get("/device/info")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(
            payload,
            {
                "name": "RTX 4070",
                "has_gpu": True,
                "provider": "CUDAExecutionProvider",
                "available_providers": ["CUDAExecutionProvider", "CPUExecutionProvider"],
                "vram_gb": 12.0,
                "profile": "nvidia-cuda",
                "fallback_reason": None,
                "supported_model_families": ["ocr", "detection", "enhance", "inpainting", "translation"],
                "nvidia_cuda_available": True,
                "nvidia_tensorrt_available": False,
                "intel_openvino_available": False,
                "amd_rocm_available": False,
            },
        )

    def test_device_info_allows_browser_dev_origin_without_desktop_session_header(self) -> None:
        client = TestClient(mini_app.app)
        mini_app.LOCAL_API_SESSION_SECRET = "dev-secret"
        mini_app.ENVIRONMENT = "development"
        fake_device = SimpleNamespace(
            name="CPU",
            has_gpu=False,
            onnx_provider="CPUExecutionProvider",
            available_onnx_providers=("CPUExecutionProvider",),
            vram_gb=None,
            acceleration_profile="cpu",
            fallback_reason=None,
            supported_model_families=("ocr",),
        )

        with patch.object(mini_app, "get_device_info", return_value=fake_device):
            response = client.get("/device/info", headers={"Origin": "http://localhost:5173"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("access-control-allow-origin"), "http://localhost:5173")

    def test_device_info_requires_desktop_session_header_in_production(self) -> None:
        client = TestClient(mini_app.app)
        mini_app.LOCAL_API_SESSION_SECRET = "prod-secret"
        mini_app.ENVIRONMENT = "production"

        response = client.get("/device/info", headers={"Origin": "http://localhost:5173"})

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "LOCAL_API_SESSION_REQUIRED")


if __name__ == "__main__":
    unittest.main()
