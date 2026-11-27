from __future__ import annotations

import tempfile
import unittest
from contextlib import contextmanager
from pathlib import Path
from types import MappingProxyType
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(MINI_BACKEND_DIR))

from models.errors import (
    MODEL_NOT_IMPLEMENTED_WIRE_CODE,
    UNKNOWN_MODEL_WIRE_CODE,
    ModelNotInstalledError,
    UnimplementedModelSelectionError,
)
from models.segmentation import factory
from models.segmentation.baka_segmenter import BakaContentSegmenter


DEFAULT_SEGMENTATION_MODEL_KEY = "baka_content_cc"


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

    def test_default_request_resolves_to_default_key(self) -> None:
        cases = [(None, False), ("", False), ("  ", True)]
        for requested, has_gpu in cases:
            with self.subTest(requested=requested, has_gpu=has_gpu):
                self.assertEqual(
                    factory.resolve_segmentation_model_key(requested, has_gpu),
                    "baka_content_cc",
                )

    def test_auto_request_prefers_installed_neural_segmenters(self) -> None:
        for has_gpu in (False, True):
            with self.subTest(has_gpu=has_gpu):
                self.assertEqual(
                    factory.resolve_segmentation_model_key("auto", has_gpu),
                    "comic_text_mask",
                )
        with patch.object(
            factory,
            "model_is_installed",
            side_effect=lambda key: key in {"ctd_text_seg", "comic_text_detector", "baka_content_cc"},
        ):
            self.assertEqual(
                factory.resolve_segmentation_model_key("auto", False),
                "ctd_text_seg",
            )

    def test_explicit_unservable_selection_refuses(self) -> None:
        cases = [
            ("nope", UNKNOWN_MODEL_WIRE_CODE),
            ("sam2_text", MODEL_NOT_IMPLEMENTED_WIRE_CODE),
        ]
        for requested, code in cases:
            with self.subTest(requested=requested):
                with self.assertRaises(UnimplementedModelSelectionError) as ctx:
                    factory.resolve_segmentation_model_key(requested, has_gpu=True)
                self.assertEqual(ctx.exception.code, code)
                self.assertEqual(ctx.exception.model_key, requested)
                self.assertEqual(ctx.exception.stage, "segment")
                self.assertEqual(
                    ctx.exception.alternatives,
                    ("baka_content_cc", "ctd_text_seg", "comic_text_mask"),
                )

    def test_fallback_with_warning_is_preserved_for_gpu_only_reason(self) -> None:
        gpu_only = factory.SegmentationModelMeta(
            key="gpu_only_fake",
            name="GPU Only Fake",
            device="gpu",
            use_case="test",
            implemented=True,
        )
        patched_registry = MappingProxyType(
            {
                DEFAULT_SEGMENTATION_MODEL_KEY: factory.SEGMENTATION_MODELS[
                    DEFAULT_SEGMENTATION_MODEL_KEY
                ],
                "gpu_only_fake": gpu_only,
            }
        )
        with patch.object(factory, "SEGMENTATION_MODELS", patched_registry):
            with self.assertLogs(factory.logger, level="WARNING") as captured:
                resolved = factory.resolve_segmentation_model_key(
                    "gpu_only_fake", has_gpu=False
                )
        self.assertEqual(resolved, "baka_content_cc")
        self.assertTrue(
            any("segmentation model fallback" in line for line in captured.output)
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
