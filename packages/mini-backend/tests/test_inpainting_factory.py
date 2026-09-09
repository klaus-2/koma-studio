from __future__ import annotations

import os
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from models.inpainting import factory as inpainting_factory
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class InpaintingFactoryTests(unittest.TestCase):
    def test_list_inpainting_models_includes_new_cpu_options(self) -> None:
        with (
            patch.object(inpainting_factory, "model_is_installed", return_value=True),
            patch.object(inpainting_factory, "_path_exists", return_value=True),
        ):
            models = inpainting_factory.list_inpainting_models(has_gpu=False)

        keys = {item["key"] for item in models}
        self.assertIn("aot", keys)
        self.assertIn("lama_manga", keys)
        self.assertIn("opencv_lama", keys)
        self.assertIn("lama_fp32", keys)

    def test_auto_prefers_contextual_lama_variants_when_available(self) -> None:
        with patch.object(
            inpainting_factory,
            "_available_model_keys",
            return_value=["aot", "opencv_lama", "lama_fp32", "lama_manga"],
        ):
            selected = inpainting_factory._resolve_model_key(False, "auto")

        self.assertEqual(selected, "lama_manga")

    def test_cpu_friendly_variants_force_cpu_provider(self) -> None:
        fake_device = SimpleNamespace(
            name="Legacy GPU",
            has_gpu=True,
            onnx_provider="CUDAExecutionProvider",
            available_onnx_providers=("CUDAExecutionProvider", "CPUExecutionProvider"),
            vram_gb=4.0,
            acceleration_profile="nvidia-cuda-legacy",
        )

        with (
            patch.object(inpainting_factory, "get_device_info", return_value=fake_device),
            patch.object(inpainting_factory, "model_is_installed", return_value=True),
            patch.object(inpainting_factory, "resolve_inpainting_model_path", return_value=Path(__file__)),
            patch.object(inpainting_factory, "_available_model_keys", return_value=["opencv_lama"]),
            patch.object(inpainting_factory, "LaMaInpainter") as lama_cls,
        ):
            inpainting_factory.get_inpainter(True, model_key="opencv_lama")

        self.assertEqual(lama_cls.call_args.kwargs["providers"], ["CPUExecutionProvider"])


if __name__ == "__main__":
    unittest.main()
