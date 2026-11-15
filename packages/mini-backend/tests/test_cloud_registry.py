from __future__ import annotations

from importlib import reload
from pathlib import Path
import os
import sys
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core import cloud_registry as cloud_registry_module


class CloudRegistryTests(unittest.TestCase):
    def test_gemini_ocr_registry_normalizes_deprecated_image_preview_alias(
        self,
    ) -> None:
        with patch.dict(
            os.environ,
            {"MINI_BACKEND_GEMINI_OCR_MODEL": "gemini-2.5-flash-image-preview"},
            clear=False,
        ):
            reload(cloud_registry_module)
            try:
                spec = cloud_registry_module.get_ocr_model_spec("gemini_2_0_flash_ocr")
                self.assertEqual(spec["model"], "gemini-2.5-flash")
            finally:
                reload(cloud_registry_module)


    def test_ocr_listing_carries_provider_and_default_api_base(self) -> None:
        listings = {
            listing["key"]: listing
            for listing in cloud_registry_module.list_cloud_ocr_models()
        }

        gemini = listings["gemini_2_0_flash_ocr"]
        self.assertEqual(gemini["provider"], "gemini_vision")
        self.assertEqual(
            gemini["default_api_base"],
            "https://generativelanguage.googleapis.com/v1beta/models",
        )
        self.assertEqual(listings["gpt_4_1_mini_ocr"]["provider"], "openai_compatible_vision")
        self.assertEqual(
            listings["gpt_4_1_mini_ocr"]["default_api_base"],
            "https://api.openai.com/v1",
        )

    def test_custom_ocr_listing_has_provider_but_no_default_host(self) -> None:
        listings = {
            listing["key"]: listing
            for listing in cloud_registry_module.list_cloud_ocr_models()
        }
        custom = listings["custom_ocr"]
        self.assertEqual(custom["provider"], "custom_openai_compatible_vision")
        self.assertNotIn("default_api_base", custom)

    def test_materialize_contract_unchanged(self) -> None:
        spec = cloud_registry_module.get_ocr_model_spec("google_cloud_vision")
        assert spec is not None
        self.assertEqual(spec["provider"], "google_cloud_vision")
        self.assertEqual(
            spec["default_api_base"], "https://vision.googleapis.com/v1"
        )
        self.assertEqual(
            spec["api_key_envs"], ("MINI_BACKEND_GOOGLE_CLOUD_VISION_API_KEY",)
        )


if __name__ == "__main__":
    unittest.main()
