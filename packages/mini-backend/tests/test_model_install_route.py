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


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationManagedInstallDispatchTests(unittest.TestCase):
    def test_translation_bundles_use_the_local_translation_installer(self) -> None:
        model_ids = (
            "opus-mt-ja-en",
            "opus-mt-zh-en",
            "nllb-200-3.3b",
            "nllb-200-600m-int8",
            "nllb-200-1.3b",
            "nllb-200-1.3b-int8-ct2",
        )

        for model_id in model_ids:
            with patch.object(
                model_install_router,
                "ensure_local_translation_model_installed",
                return_value={"modelId": model_id, "fileCount": 1},
            ) as installer:
                payload = model_install_router.install_managed_model_sync(model_id, None)

            installer.assert_called_once_with(model_id)
            self.assertEqual(payload["modelId"], model_id)

    def test_translation_bundles_do_not_fall_back_to_generic_download(self) -> None:
        with (
            patch.object(
                model_install_router,
                "ensure_local_translation_model_installed",
                return_value={"modelId": "opus-mt-ja-en", "fileCount": 1},
            ),
            patch.object(model_install_router, "_download_generic_model") as generic_mock,
        ):
            model_install_router.install_managed_model_sync("opus-mt-ja-en", None)

        generic_mock.assert_not_called()


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class DetectionManagedInstallDispatchTests(unittest.TestCase):
    def test_detection_models_use_the_managed_detection_installer(self) -> None:
        for model_id in ("comic_text_detector", "font_rtdetr_v2"):
            with (
                patch.object(
                    model_install_router,
                    "ensure_detection_model_installed",
                    return_value={"modelId": model_id, "fileCount": 1},
                ) as installer,
                patch.object(model_install_router, "_download_generic_model") as generic_mock,
            ):
                payload = model_install_router.install_managed_model_sync(model_id, None)

            installer.assert_called_once_with(model_id)
            generic_mock.assert_not_called()
            self.assertEqual(payload["modelId"], model_id)


if __name__ == "__main__":
    unittest.main()
