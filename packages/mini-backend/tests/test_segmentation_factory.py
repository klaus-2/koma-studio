from __future__ import annotations

import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(MINI_BACKEND_DIR))

from models.errors import ModelNotInstalledError
from models.segmentation import factory
from models.segmentation.baka_segmenter import BakaContentSegmenter


def _always(_: str) -> bool:
    return True


def _never(_: str) -> bool:
    return False


@contextmanager
def _models_root():
    with tempfile.TemporaryDirectory() as tmp:
        old = __import__("os").environ.get("KOMA_MODELS_ROOT")
        __import__("os").environ["KOMA_MODELS_ROOT"] = tmp
        try:
            yield tmp
        finally:
            if old is None:
                __import__("os").environ.pop("KOMA_MODELS_ROOT", None)
            else:
                __import__("os").environ["KOMA_MODELS_ROOT"] = old


class SegmentationFactoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self._patches = [
            patch.object(factory, "model_is_installed", _always),
            patch.object(factory, "segmentation_runtime_ready", _always),
        ]
        for item in self._patches:
            item.start()
            self.addCleanup(item.stop)
        factory.clear_segmenter_cache()
        self.addCleanup(factory.clear_segmenter_cache)

    def test_resolution_falls_back_to_default(self) -> None:
        cases = [(None, False), ("", False), ("  ", True), ("nope", True),
                 ("sam2_text", True), ("sam2_text", False)]
        for requested, has_gpu in cases:
            with self.subTest(requested=requested, has_gpu=has_gpu):
                self.assertEqual(
                    factory.resolve_segmentation_model_key(requested, has_gpu),
                    "baka_content_cc",
                )

    def test_get_segmenter_is_cached_per_key(self) -> None:
        first = factory.get_segmenter(has_gpu=False)
        second = factory.get_segmenter(has_gpu=True, model_key="baka_content_cc")
        self.assertIsInstance(first, BakaContentSegmenter)
        self.assertIs(first, second)
        self.assertEqual(factory.get_segmenter_cache_size(), 1)
        factory.clear_segmenter_cache()
        self.assertEqual(factory.get_segmenter_cache_size(), 0)

    def test_not_installed_raises_typed_error(self) -> None:
        for item in self._patches:
            item.stop()
        ready = patch.object(factory, "segmentation_runtime_ready", _never)
        ready.start()
        try:
            with self.assertRaises(ModelNotInstalledError):
                factory.get_segmenter(has_gpu=False)
            self.assertFalse(factory.list_segmentation_models(has_gpu=False)[0]["available"])
        finally:
            ready.stop()

    def test_gpu_only_model_is_unavailable_without_gpu(self) -> None:
        by_key = {opt["key"]: opt for opt in factory.list_segmentation_models(has_gpu=False)}
        self.assertTrue(by_key["baka_content_cc"]["available"])
        self.assertFalse(by_key["sam2_text"]["available"])


if __name__ == "__main__":
    unittest.main()
