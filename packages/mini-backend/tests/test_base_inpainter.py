from __future__ import annotations

from pathlib import Path
import sys
import unittest

import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.inpainting.base_inpainter import BaseInpainter, InpaintConfig  # noqa: E402


class _GrayInpainter(BaseInpainter):
    key = "gray"
    name = "Gray"

    def forward(
        self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig
    ) -> np.ndarray:
        result = image.copy()
        result[mask > 127] = np.array((185, 185, 185), dtype=np.uint8)
        return result


class BaseInpainterTests(unittest.TestCase):
    def test_harmonization_keeps_white_regions_white_even_with_dark_outline_noise(
        self,
    ) -> None:
        image = np.full((72, 72, 3), 252, dtype=np.uint8)
        image[25:47, 19] = 0
        image[25:47, 52] = 0
        image[25, 19:53] = 0
        image[46, 19:53] = 0

        mask = np.zeros((72, 72), dtype=np.uint8)
        mask[30:42, 24:48] = 255

        inpainter = _GrayInpainter()
        result = inpainter._inpaint(image=image, mask=mask, config=InpaintConfig())

        self.assertTrue(np.all(result[35, 30] >= 235))


if __name__ == "__main__":
    unittest.main()
