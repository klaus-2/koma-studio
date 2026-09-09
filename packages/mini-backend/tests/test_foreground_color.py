from __future__ import annotations

from pathlib import Path
import sys
import unittest

import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection.font.foreground_color import extract_foreground_color


class ForegroundColorExtractionTests(unittest.TestCase):
    def test_returns_none_for_empty_image(self) -> None:
        image = np.empty((0, 0, 3), dtype=np.uint8)
        self.assertIsNone(extract_foreground_color(image))

    def test_returns_none_for_tiny_crop(self) -> None:
        image = np.full((4, 12, 3), 255, dtype=np.uint8)
        self.assertIsNone(extract_foreground_color(image))

    def test_returns_black_for_black_text_on_white_bubble(self) -> None:
        image = np.full((32, 32, 3), 255, dtype=np.uint8)
        image[10:22, 12:20] = 0

        color = extract_foreground_color(image)

        self.assertEqual(color, (0, 0, 0))

    def test_returns_white_for_white_text_on_dark_bubble(self) -> None:
        image = np.full((32, 32, 3), 20, dtype=np.uint8)
        image[10:22, 12:20] = 255

        color = extract_foreground_color(image)

        self.assertEqual(color, (255, 255, 255))

    def test_preserves_colored_text_on_light_bubble(self) -> None:
        image = np.full((36, 36, 3), 240, dtype=np.uint8)
        image[10:26, 12:24] = np.array([210, 40, 60], dtype=np.uint8)

        color = extract_foreground_color(image)

        self.assertIsNotNone(color)
        assert color is not None
        self.assertLess(abs(color[0] - 210), 25)
        self.assertLess(abs(color[1] - 40), 25)
        self.assertLess(abs(color[2] - 60), 25)

    def test_handles_antialiasing_and_noise(self) -> None:
        image = np.full((40, 40, 3), 250, dtype=np.uint8)
        image[11:29, 13:27] = np.array([30, 30, 30], dtype=np.uint8)
        image[10:30, 12] = np.array([120, 120, 120], dtype=np.uint8)
        image[10:30, 27] = np.array([120, 120, 120], dtype=np.uint8)
        image[10, 12:28] = np.array([140, 140, 140], dtype=np.uint8)
        image[29, 12:28] = np.array([140, 140, 140], dtype=np.uint8)
        image[0::4, 0::5] = np.array([235, 235, 235], dtype=np.uint8)

        color = extract_foreground_color(image)

        self.assertEqual(color, (0, 0, 0))

    def test_returns_none_for_narrow_strip_without_usable_border_ring(self) -> None:
        image = np.full((8, 3, 3), 255, dtype=np.uint8)
        self.assertIsNone(extract_foreground_color(image))


if __name__ == "__main__":
    unittest.main()
