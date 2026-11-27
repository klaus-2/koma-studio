from __future__ import annotations

import asyncio
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.inpainting import base_inpainter  # noqa: E402
from models.inpainting.base_inpainter import (  # noqa: E402
    BaseInpainter,
    HDStrategy,
    InpaintConfig,
    boxes_from_mask,
)


class _FillWhite(BaseInpainter):
    key = "fill"
    pad_mod = 8
    min_size = 64

    def __init__(self) -> None:
        self.calls: list[tuple[int, int]] = []

    def forward(self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig) -> np.ndarray:
        self.calls.append(image.shape[:2])
        return np.full_like(image, 255)


class _OomOnWideTile(_FillWhite):
    def forward(self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig) -> np.ndarray:
        if image.shape[1] > 128:
            raise RuntimeError("simulated CUDA OOM")
        return super().forward(image, mask, config)


class _CountingFillWhite(_FillWhite):
    """Counts masked pixels handed to the model (pre-padding, exact)."""

    def __init__(self) -> None:
        super().__init__()
        self.submitted_mask_pixels = 0

    def _pad_forward(self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig) -> np.ndarray:
        self.submitted_mask_pixels += int(np.count_nonzero(mask >= 128))
        return super()._pad_forward(image, mask, config)


class _ShapeRecordingFillWhite(_FillWhite):
    """Records the exact pre-padding shape of every forward context."""

    def __init__(self) -> None:
        super().__init__()
        self.forward_shapes: list[tuple[int, int]] = []

    def _pad_forward(self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig) -> np.ndarray:
        self.forward_shapes.append((image.shape[0], image.shape[1]))
        return super()._pad_forward(image, mask, config)


class _OomOnWideTileRecording(_OomOnWideTile, _ShapeRecordingFillWhite):
    pass


def _overlapping_fixture() -> tuple[np.ndarray, np.ndarray, list[tuple[int, int, int, int]]]:
    image = np.zeros((300, 400, 3), dtype=np.uint8)
    mask = np.zeros((300, 400), dtype=np.uint8)
    box_small = (40, 40, 80, 60)
    box_large = (60, 30, 200, 190)
    mask[box_small[1]:box_small[3], box_small[0]:box_small[2]] = 255
    mask[box_large[1]:box_large[3], box_large[0]:box_large[2]] = 255
    return image, mask, [box_small, box_large]


class BatchedCropsOwnershipTests(unittest.TestCase):
    def test_overlapping_crops_in_different_groups_paint_each_pixel_once(self) -> None:
        image, mask, boxes = _overlapping_fixture()
        config = _config()

        crops = _FillWhite()._crop_boxes(image, boxes, config)
        groups = base_inpainter._batch_canvas_groups(crops)
        self.assertEqual(len(groups), 2, "fixture must split into two groups")

        unique_pixels = int(np.count_nonzero(mask >= 128))
        reference_model = _CountingFillWhite()
        reference = reference_model._inpaint_crops(image, mask, boxes, config)
        batched_model = _CountingFillWhite()
        result = batched_model._inpaint_crops_batched(image, mask, boxes, config)

        self.assertLess(crops[0][0], crops[1][2])
        self.assertLess(crops[1][0], crops[0][2])
        self.assertEqual(reference_model.submitted_mask_pixels, unique_pixels)
        self.assertEqual(batched_model.submitted_mask_pixels, unique_pixels)
        self.assertTrue(np.allclose(result, reference, atol=1))
        self.assertTrue(np.all(result[mask >= 128] == 255))
        self.assertTrue(np.all(result[mask == 0] == 0))

    def test_oom_degradation_expands_the_margin_once(self) -> None:
        image = np.zeros((300, 320, 3), dtype=np.uint8)
        mask = np.zeros((300, 320), dtype=np.uint8)
        mask[40:60, 40:118] = 255
        mask[120:140, 40:118] = 255
        config = _config()
        boxes = boxes_from_mask(mask)
        self.assertEqual(len(boxes), 2)

        reference = _FillWhite()._inpaint_crops(image, mask, boxes, config)

        model = _OomOnWideTileRecording()
        result = asyncio.run(model.inpaint(image, mask, config))

        self.assertEqual(model.forward_shapes, [(52, 228), (52, 110), (52, 110)])
        self.assertTrue(np.allclose(result, reference, atol=1))
        self.assertTrue(np.all(result[mask >= 128] == 255))
        self.assertTrue(np.all(result[mask == 0] == 0))


def _fixture() -> tuple[np.ndarray, np.ndarray]:
    image = np.zeros((300, 320, 3), dtype=np.uint8)
    mask = np.zeros((300, 320), dtype=np.uint8)
    mask[40:60, 40:80] = 255
    mask[120:140, 40:80] = 255
    mask[220:240, 200:260] = 255
    return image, mask


def _config() -> InpaintConfig:
    return InpaintConfig(
        hd_strategy=HDStrategy.CROP,
        hd_strategy_crop_trigger_size=64,
        hd_strategy_crop_margin=16,
        mask_feathering=0,
    )


class BatchedCropsTests(unittest.TestCase):
    def test_batched_matches_per_crop_and_uses_fewer_forwards(self) -> None:
        image, mask = _fixture()
        config = _config()
        boxes = boxes_from_mask(mask)
        self.assertGreater(len(boxes), 1)

        reference_model = _FillWhite()
        reference = reference_model._inpaint_crops(image, mask, boxes, config)
        batched_model = _FillWhite()
        result = asyncio.run(batched_model.inpaint(image, mask, config))

        self.assertTrue(np.allclose(result, reference, atol=1))
        self.assertTrue(np.all(result[mask >= 128] == 255))
        self.assertTrue(np.all(result[mask == 0] == 0))
        self.assertLess(len(batched_model.calls), len(reference_model.calls))

    def test_forward_error_degrades_to_per_crop_for_that_batch(self) -> None:
        image, mask = _fixture()
        config = _config()
        reference = _FillWhite()._inpaint_crops(image, mask, boxes_from_mask(mask), config)

        model = _OomOnWideTile()
        result = asyncio.run(model.inpaint(image, mask, config))

        self.assertTrue(np.allclose(result, reference, atol=1))
        self.assertTrue(np.all(result[mask >= 128] == 255))

    def test_pixel_budget_splits_the_batch(self) -> None:
        image = np.zeros((120, 180, 3), dtype=np.uint8)
        mask = np.zeros((120, 180), dtype=np.uint8)
        for left in (20, 60, 100, 140):
            mask[20:40, left:left + 20] = 255
        config = _config()
        boxes = boxes_from_mask(mask)
        self.assertGreater(len(boxes), 1)

        with patch.object(base_inpainter, "_MAX_IMAGE_PIXELS", 10_000):
            reference = _FillWhite()._inpaint_crops(image, mask, boxes, config)
            model = _FillWhite()
            result = model._inpaint_crops_batched(image, mask, boxes, config)

        self.assertGreaterEqual(len(model.calls), 2)
        self.assertTrue(np.allclose(result, reference, atol=1))

    def test_max_batch_edge_splits_wide_tile_and_cluster_merges_nearby_glyphs(self) -> None:
        crops = [(0, 0, 120, 60), (200, 0, 320, 60), (400, 0, 520, 60)]
        groups = base_inpainter._batch_canvas_groups(crops, max_batch_edge=260)
        self.assertEqual(len(groups), 2)
        self.assertEqual(sum(len(g) for g in groups), 3)

        mask = np.zeros((160, 200), dtype=np.uint8)
        mask[20:40, 20:40] = 255
        mask[22:42, 50:70] = 255
        mask[110:130, 140:170] = 255
        clustered = base_inpainter.cluster_mask_boxes(mask, max_gap=28)
        self.assertEqual(len(clustered), 2)

    def test_blend_with_mask_never_modifies_unmasked_pixels_and_auto_strategy(self) -> None:
        orig = np.full((64, 64, 3), 50, dtype=np.uint8)
        inpainted = np.full((64, 64, 3), 240, dtype=np.uint8)
        mask = np.zeros((64, 64), dtype=np.uint8)
        mask[20:44, 20:44] = 255

        blended = base_inpainter.blend_with_mask(orig, inpainted, mask, feather=5)
        self.assertTrue(np.all(blended[mask == 0] == 50))
        self.assertGreater(int(blended[32, 32, 0]), 220)
        self.assertEqual(base_inpainter.HDStrategy.from_value("auto"), base_inpainter.HDStrategy.AUTO)


if __name__ == "__main__":
    unittest.main()
