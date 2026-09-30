from __future__ import annotations

import os
import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(MINI_BACKEND_DIR))

from models.errors import InvalidModelSelectionError, ModelConfigurationError
from models.segmentation import storage


@contextmanager
def _models_root():
    with tempfile.TemporaryDirectory() as tmp:
        old = os.environ.get("KOMA_MODELS_ROOT")
        os.environ["KOMA_MODELS_ROOT"] = tmp
        try:
            yield Path(tmp)
        finally:
            if old is None:
                os.environ.pop("KOMA_MODELS_ROOT", None)
            else:
                os.environ["KOMA_MODELS_ROOT"] = old


class SegmentationStorageTests(unittest.TestCase):
    def test_install_writes_local_marker_without_network(self) -> None:
        with _models_root() as tmp:
            self.assertFalse(storage.segmentation_runtime_ready("baka_content_cc"))

            first = storage.ensure_segmentation_model_installed("BAKA_CONTENT_CC")
            second = storage.ensure_segmentation_model_installed("baka_content_cc")

            model_dir = Path(first["directory"])
            self.assertTrue((model_dir / "segmenter.meta").is_file())
            self.assertTrue(first["file"]["downloaded"])
            self.assertFalse(second["file"]["downloaded"])
            self.assertEqual(first["file"]["sha256"], second["file"]["sha256"])
            self.assertTrue(storage.segmentation_runtime_ready("baka_content_cc"))
            self.assertFalse(storage.segmentation_runtime_ready("sam2_text"))

    def test_install_rejects_unknown_model(self) -> None:
        with _models_root():
            with self.assertRaises(InvalidModelSelectionError):
                storage.ensure_segmentation_model_installed("sam2_text")

    def test_install_requires_models_root(self) -> None:
        old = os.environ.pop("KOMA_MODELS_ROOT", None)
        try:
            with self.assertRaises(ModelConfigurationError):
                storage.ensure_segmentation_model_installed("baka_content_cc")
        finally:
            if old is not None:
                os.environ["KOMA_MODELS_ROOT"] = old


if __name__ == "__main__":
    unittest.main()
