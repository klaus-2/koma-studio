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
    def test_mask_dilation_expands_region_beyond_bbox(self) -> None:
        regions = [MaskRegion(bbox=(24, 24, 36, 32))]

        plain_mask = generate_baka_style_mask(
            image_width=64,
            image_height=64,
            regions=regions,
            mask_dilation=0,
        )
        dilated_mask = generate_baka_style_mask(
            image_width=64,
            image_height=64,
            regions=regions,
            mask_dilation=6,
        )

        self.assertEqual(int(plain_mask[27, 20]), 0)
        self.assertEqual(int(dilated_mask[27, 20]), 255)
        self.assertGreater(int(dilated_mask.sum()), int(plain_mask.sum()))


if __name__ == "__main__":
    unittest.main()
