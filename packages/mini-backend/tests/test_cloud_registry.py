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


if __name__ == "__main__":
    unittest.main()
