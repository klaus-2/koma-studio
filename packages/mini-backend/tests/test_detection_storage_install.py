from __future__ import annotations

import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection import storage as detection_storage


FONT_RTDETR_SHA256 = "065744e91c0594ad8663aa8b870ce3fb27222942eded5a3cc388ce23421bd195"


def _write_detector(url: str, target_path: Path, **kwargs: object) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(b"detector-weights")


class DetectionStorageInstallTests(unittest.TestCase):
    def test_font_detector_installs_as_detector_onnx(self) -> None:
        with (
            TemporaryDirectory() as temp_dir,
            patch.dict(os.environ, {"KOMA_MODELS_ROOT": temp_dir}, clear=False),
            patch.object(detection_storage, "download_file", _write_detector),
            patch.object(detection_storage, "sha256_file", return_value=FONT_RTDETR_SHA256),
        ):
            result = detection_storage.ensure_detection_model_installed("font_rtdetr_v2")

            model_dir = Path(temp_dir) / "font_rtdetr_v2"
            self.assertTrue((model_dir / "detector.onnx").is_file())
            self.assertFalse((model_dir / "model.bin").exists())
            self.assertEqual(result["file"]["target"], "detector.onnx")
            resolved = detection_storage.resolve_detection_model_path("font_rtdetr_v2")
            self.assertIsNotNone(resolved)
            assert resolved is not None
            self.assertEqual(resolved.name, "detector.onnx")
            self.assertEqual(resolved.parent.name, "font_rtdetr_v2")
            self.assertTrue(detection_storage.detection_runtime_ready("font_rtdetr_v2"))

    def test_font_detector_requires_the_configured_models_root(self) -> None:
        with patch.dict(os.environ, {"KOMA_MODELS_ROOT": ""}, clear=False):
            with self.assertRaisesRegex(RuntimeError, "KOMA_MODELS_ROOT is not configured"):
                detection_storage.ensure_detection_model_installed("font_rtdetr_v2")


if __name__ == "__main__":
    unittest.main()
