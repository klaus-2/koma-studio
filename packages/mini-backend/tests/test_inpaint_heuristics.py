from __future__ import annotations

from pathlib import Path
import sys
import unittest

import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from utils.inpaint_heuristics import (  # noqa: E402
    apply_need_inpaint_heuristic,
    detect_background_complexity,
)


class InpaintHeuristicsTests(unittest.TestCase):
    def test_uniform_background_uses_solid_fill_without_remaining_mask(self) -> None:
        image = np.full((48, 48, 3), 250, dtype=np.uint8)
        image[18:30, 14:34] = 15
        mask = np.zeros((48, 48), dtype=np.uint8)
        mask[18:30, 14:34] = 255

        result = apply_need_inpaint_heuristic(image, mask)

        self.assertFalse(result.needs_model_inpaint)
        self.assertEqual(result.method_label, "solid_fill")
        self.assertEqual(int(result.remaining_mask.sum()), 0)
        self.assertGreaterEqual(int(result.image_rgb[22, 20, 0]), 250)

    def test_gradient_background_prefers_local_classical_fill_for_small_text_regions(
        self,
    ) -> None:
        gradient = np.tile(np.linspace(210, 250, 72, dtype=np.uint8), (72, 1))
        image = np.dstack((gradient, gradient, gradient))
        image[30:40, 24:48] = 10
        mask = np.zeros((72, 72), dtype=np.uint8)
        mask[30:40, 24:48] = 255

        result = apply_need_inpaint_heuristic(image, mask)

        self.assertFalse(result.needs_model_inpaint)
        self.assertEqual(result.method_label, "solid_fill")
        self.assertGreater(int(result.image_rgb[35, 32, 0]), 200)

    def test_colored_background_prefers_local_classical_fill_for_small_regions(
        self,
    ) -> None:
        image = np.zeros((56, 56, 3), dtype=np.uint8)
        for row in range(56):
            image[row, :, 0] = 35 + row
            image[row, :, 1] = 90 + (row // 2)
            image[row, :, 2] = 180 - (row // 3)
        image[24:32, 18:38] = (220, 40, 120)
        mask = np.zeros((56, 56), dtype=np.uint8)
        mask[24:32, 18:38] = 255

        result = apply_need_inpaint_heuristic(image, mask)

        self.assertFalse(result.needs_model_inpaint)
        self.assertEqual(int(result.remaining_mask.sum()), 0)
        self.assertGreater(int(result.image_rgb[27, 24, 1]), 80)

    def test_bright_white_balloon_snaps_back_to_white(self) -> None:
        image = np.full((64, 64, 3), 252, dtype=np.uint8)
        image[24:36, 22:42] = 20
        mask = np.zeros((64, 64), dtype=np.uint8)
        mask[24:36, 22:42] = 255

        result = apply_need_inpaint_heuristic(image, mask)

        self.assertFalse(result.needs_model_inpaint)
        self.assertTrue(np.all(result.image_rgb[30, 30] >= 254))

    def test_detect_background_complexity_flags_gradients_and_line_dense_regions(
        self,
    ) -> None:
        image = np.full((96, 96, 3), 245, dtype=np.uint8)
        for idx in range(0, 96, 6):
            image[:, idx : idx + 2] = 110
            image[idx : idx + 2, :] = 110
        mask = np.zeros((96, 96), dtype=np.uint8)
        mask[28:68, 28:68] = 255

        self.assertEqual(detect_background_complexity(image, mask), "complex")


if __name__ == "__main__":
    unittest.main()
