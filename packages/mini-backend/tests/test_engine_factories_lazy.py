from __future__ import annotations

import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import Mock, patch

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from models.inpainting import factory as inpainting_factory
    from models.inpainting.registry import INPAINT_MODEL_SPECS
    from models.segmentation import factory as segmentation_factory
    from models.segmentation.baka_segmenter import BakaContentSegmenter
except Exception as exc:  # pragma: no cover
    IMPORT_ERROR = exc


def _run_fresh_interpreter(code: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True,
        text=True,
        cwd=str(MINI_BACKEND_DIR),
        check=False,
    )


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class InpaintingFactoryLazyImportTests(unittest.TestCase):
    def test_importing_factory_does_not_load_engine_modules(self) -> None:
        code = "\n".join(
            [
                "import sys",
                f"sys.path.insert(0, r'{MINI_BACKEND_DIR}')",
                "import models.inpainting.factory as factory",
                "loaded = [name for name in sys.modules if name.startswith((",
                "    'models.inpainting.aot', 'models.inpainting.lama'",
                "))]",
                "assert loaded == [], loaded",
                "first = factory.AOTInpainter",
                "second = factory.LaMaInpainter",
                "assert callable(first) and callable(second)",
                "assert 'models.inpainting.aot.inpainter' in sys.modules",
                "assert 'models.inpainting.lama.inpainter' in sys.modules",
                "assert 'AOTInpainter' not in vars(factory)",
                "assert 'LaMaInpainter' not in vars(factory)",
                "print('LAZY-OK')",
            ]
        )

        result = _run_fresh_interpreter(code)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("LAZY-OK", result.stdout)

    def test_builder_honors_engine_module_patch(self) -> None:
        vars(inpainting_factory).pop("LaMaInpainter", None)
        vars(inpainting_factory).pop("AOTInpainter", None)
        spec = INPAINT_MODEL_SPECS["lama_manga"]

        with patch(
            "models.inpainting.lama.inpainter.LaMaInpainter"
        ) as lama_cls:
            built = inpainting_factory._build(
                spec, Path("unused.onnx"), ("CPUExecutionProvider",)
            )

        self.assertIs(built, lama_cls.return_value)
        lama_cls.assert_called_once_with(
            model_path=Path("unused.onnx"),
            providers=("CPUExecutionProvider",),
            key=spec.key,
            name=spec.name,
            output_range=spec.output_range,
        )

    def test_builder_honors_factory_attribute_patch(self) -> None:
        spec = INPAINT_MODEL_SPECS["aot"]

        with patch.object(inpainting_factory, "AOTInpainter") as aot_cls:
            built = inpainting_factory._build(
                spec, Path("unused.onnx"), ("CPUExecutionProvider",)
            )

        self.assertIs(built, aot_cls.return_value)
        aot_cls.assert_called_once_with(
            model_path=Path("unused.onnx"),
            providers=("CPUExecutionProvider",),
        )

    def test_pep_562_shim_resolves_engine_classes(self) -> None:
        from models.inpainting.aot.inpainter import AOTInpainter
        from models.inpainting.lama.inpainter import LaMaInpainter

        self.assertIs(inpainting_factory.AOTInpainter, AOTInpainter)
        self.assertIs(inpainting_factory.LaMaInpainter, LaMaInpainter)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class SegmentationFactoryLazyImportTests(unittest.TestCase):
    def test_factory_module_has_no_top_level_engine_binding(self) -> None:
        code = "\n".join(
            [
                "import sys",
                f"sys.path.insert(0, r'{MINI_BACKEND_DIR}')",
                "import models.segmentation.factory as factory",
                "assert 'BakaContentSegmenter' not in vars(factory)",
                "assert callable(factory._BUILDERS['baka_content_cc'])",
                "print('LAZY-OK')",
            ]
        )

        result = _run_fresh_interpreter(code)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("LAZY-OK", result.stdout)

    def test_builder_honors_engine_module_patch(self) -> None:
        with patch(
            "models.segmentation.baka_segmenter.BakaContentSegmenter"
        ) as baka_cls:
            built = segmentation_factory._BUILDERS[
                segmentation_factory.DEFAULT_SEGMENTATION_MODEL_KEY
            ]()

        self.assertIs(built, baka_cls.return_value)
        baka_cls.assert_called_once_with()

    def test_get_segmenter_builds_real_segmenter_through_lazy_builder(self) -> None:
        always = Mock(return_value=True)
        with (
            patch.object(segmentation_factory, "model_is_installed", always),
            patch.object(
                segmentation_factory, "segmentation_runtime_ready", always
            ),
        ):
            segmentation_factory.clear_segmenter_cache()
            try:
                segmenter = segmentation_factory.get_segmenter(has_gpu=False)
            finally:
                segmentation_factory.clear_segmenter_cache()

        self.assertIsInstance(segmenter, BakaContentSegmenter)


if __name__ == "__main__":
    unittest.main()
