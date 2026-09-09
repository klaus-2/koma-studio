from __future__ import annotations

import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from routers import model_install as model_install_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class ModelInstallRouteTests(unittest.TestCase):
    def test_managed_install_accepts_enhance_model(self) -> None:
        client = TestClient(mini_app.app)

        with patch.object(
            model_install_router,
            "ensure_enhance_model_installed",
            return_value={"directory": "C:/models/waifu2x_swin_unet_art_scan_2x", "fileCount": 12},
        ) as ensure_mock:
            response = client.post(
                "/models/install",
                json={"model_id": "waifu2x_swin_unet_art_scan_2x"},
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["modelId"], "waifu2x_swin_unet_art_scan_2x")
        ensure_mock.assert_called_once_with("waifu2x_swin_unet_art_scan_2x")


if __name__ == "__main__":
    unittest.main()
