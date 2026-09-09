from __future__ import annotations

from pathlib import Path
import sys
import unittest

import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from utils.mask import MaskRegion, generate_baka_style_mask  # noqa: E402


class MaskGenerationTests(unittest.TestCase):
    def test_image_aware_refinement_expands_mask_towards_dark_text_pixels(self) -> None:
        image = np.full((64, 64, 3), 255, dtype=np.uint8)
        image[24:32, 18:46] = 0
        regions = [MaskRegion(bbox=(24, 24, 36, 32))]

        plain_mask = generate_baka_style_mask(
            image_width=64,
            image_height=64,
            regions=regions,
            mask_dilation=0,
            image_rgb=None,
        )
        refined_mask = generate_baka_style_mask(
            image_width=64,
            image_height=64,
            regions=regions,
            mask_dilation=0,
            image_rgb=image,
        )

        self.assertEqual(int(plain_mask[27, 20]), 0)
        self.assertEqual(int(refined_mask[27, 20]), 255)
        self.assertGreater(int(refined_mask.sum()), int(plain_mask.sum()))


if __name__ == "__main__":
    unittest.main()
