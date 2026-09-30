from __future__ import annotations

import asyncio
import unittest

import numpy as np

from models.inpainting.base_inpainter import (
    BaseInpainter,
    HDStrategy,
    InpaintConfig,
    InvalidInpaintInputError,
    expand_crop_box,
    pad_to_modulo,
)


class _FillWhite(BaseInpainter):
    key = "fill"
    pad_mod = 8
    min_size = 64

    def __init__(self) -> None:
        self.calls: list[tuple[int, int]] = []

    def forward(self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig) -> np.ndarray:
        assert image.shape[:2] == mask.shape[:2]
        assert image.shape[0] % 8 == 0 and image.shape[1] % 8 == 0
        self.calls.append((image.shape[0], image.shape[1]))
        return np.full_like(image, 255)


def _fixture(h: int, w: int) -> tuple[np.ndarray, np.ndarray]:
    image = np.zeros((h, w, 3), dtype=np.uint8)
    mask = np.zeros((h, w), dtype=np.uint8)
    mask[h // 4 : h // 2, w // 4 : w // 2] = 255
    return image, mask


class BaseInpainterStrategyTests(unittest.TestCase):
    def test_masked_area_filled_once_and_unmasked_untouched(self) -> None:
        for strategy in HDStrategy:
            with self.subTest(strategy=strategy.value):
                image, mask = _fixture(300, 200)
                config = InpaintConfig(
                    hd_strategy=strategy,
                    hd_strategy_resize_limit=128,
                    hd_strategy_crop_trigger_size=128,
                    hd_strategy_crop_margin=16,
                    mask_feathering=0,
                )
                out = asyncio.run(_FillWhite().inpaint(image, mask, config))
                self.assertEqual(out.shape, image.shape)
                self.assertTrue(np.all(out[mask == 255] == 255))
                self.assertTrue(np.all(out[mask == 0] == 0))

    def test_resize_strategy_runs_model_once_at_reduced_size(self) -> None:
        image, mask = _fixture(1000, 500)
        model = _FillWhite()
        config = InpaintConfig(hd_strategy=HDStrategy.RESIZE, hd_strategy_resize_limit=256)
        asyncio.run(model.inpaint(image, mask, config))
        self.assertEqual(model.calls, [(256, 128)])

    def test_mask_shape_mismatch_is_rejected(self) -> None:
        image, _ = _fixture(64, 64)
        with self.assertRaises(InvalidInpaintInputError):
            asyncio.run(_FillWhite().inpaint(image, np.zeros((32, 32), dtype=np.uint8), InpaintConfig()))


class PaddingTests(unittest.TestCase):
    def test_pad_to_modulo_square_keeps_2d_and_3d_in_sync(self) -> None:
        image = np.zeros((70, 30, 3), dtype=np.uint8)
        mask = np.zeros((70, 30), dtype=np.uint8)
        self.assertEqual(pad_to_modulo(image, 8, square=True).shape[:2], (72, 72))
        self.assertEqual(pad_to_modulo(mask, 8, square=True).shape[:2], (72, 72))

    def test_expand_crop_box_stays_inside_image(self) -> None:
        # margin is ADDED to the box size (historic behaviour) and the crop is
        # shifted to remain fully inside the image.
        for box in [(0, 0, 10, 10), (990, 990, 1000, 1000), (400, 400, 600, 600)]:
            with self.subTest(box=box):
                left, top, right, bottom = expand_crop_box(box, 1000, 1000, 300)
                self.assertTrue(0 <= left < right <= 1000)
                self.assertTrue(0 <= top < bottom <= 1000)
                x1, y1, x2, y2 = box
                expected_side_w = min(1000, max(1, x2 - x1) + 600)
                expected_side_h = min(1000, max(1, y2 - y1) + 600)
                self.assertEqual(right - left, expected_side_w)
                self.assertEqual(bottom - top, expected_side_h)


class StrategyAliasTests(unittest.TestCase):
    def test_hd_strategy_aliases(self) -> None:
        self.assertIs(HDStrategy.from_value("hd_crop"), HDStrategy.CROP)
        self.assertIs(HDStrategy.from_value("resize"), HDStrategy.RESIZE)
        self.assertIs(HDStrategy.from_value(None), HDStrategy.ORIGINAL)


if __name__ == "__main__":
    unittest.main()
