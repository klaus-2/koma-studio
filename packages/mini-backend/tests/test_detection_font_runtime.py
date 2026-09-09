from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection import factory as detection_factory
from models.detection.font import detector as font_detector_module


class FontDetectorRuntimeTests(unittest.TestCase):
    def test_runtime_error_does_not_mark_manifest_incomplete(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            model_dir = Path(tmp_dir) / "font_rtdetr_v2"
            model_dir.mkdir(parents=True, exist_ok=True)
            model_path = model_dir / "detector.onnx"
            model_path.write_bytes(b"not-a-real-onnx")
            manifest_path = model_dir / "manifest.json"
            manifest_path.write_text(
                json.dumps({"modelId": "font_rtdetr_v2", "status": "installed"}),
                encoding="utf-8",
            )

            detector = font_detector_module.FontRTDetrV2Detector(
                model_path=model_path,
                providers=["CPUExecutionProvider"],
            )

            with patch.object(font_detector_module, "ort", SimpleNamespace()):
                with self.assertRaises(RuntimeError) as ctx:
                    detector._ensure_session()

            self.assertIn("onnxruntime", str(ctx.exception).lower())
            payload = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["status"], "installed")

    def test_get_detector_repairs_incomplete_manifest_when_payload_exists(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            os.environ["KOMA_MODELS_ROOT"] = tmp_dir
            model_dir = Path(tmp_dir) / "font_rtdetr_v2"
            model_dir.mkdir(parents=True, exist_ok=True)
            (model_dir / "detector.onnx").write_bytes(b"existing-payload")
            manifest_path = model_dir / "manifest.json"
            manifest_path.write_text(
                json.dumps({"modelId": "font_rtdetr_v2", "status": "incomplete"}),
                encoding="utf-8",
            )

            fake_device = SimpleNamespace(
                has_gpu=False, onnx_provider="CPUExecutionProvider"
            )
            fake_detector = object()

            detection_factory.clear_detector_cache()
            try:
                with patch.dict(
                    detection_factory._BUILDERS,
                    {"font_rtdetr_v2": lambda *args, **kwargs: fake_detector},
                    clear=False,
                ):
                    result = detection_factory.get_detector(
                        task="text",
                        has_gpu=False,
                        model_key="font_rtdetr_v2",
                        device_info=fake_device,
                    )
            finally:
                detection_factory.clear_detector_cache()
                os.environ.pop("KOMA_MODELS_ROOT", None)

            self.assertIs(result, fake_detector)
            payload = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["status"], "installed")


if __name__ == "__main__":
    unittest.main()
