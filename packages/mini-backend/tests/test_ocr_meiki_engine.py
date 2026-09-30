from __future__ import annotations

import unittest

import numpy as np

from models.ocr.meiki.engine import (
    _SPECS,
    TextOrientation,
    decode_predictions,
    detect_orientation,
    prepare_input,
)

HORIZONTAL = _SPECS[TextOrientation.HORIZONTAL]
VERTICAL = _SPECS[TextOrientation.VERTICAL]


class MeikiOrientationTests(unittest.TestCase):
    def test_detect_orientation_matrix(self) -> None:
        cases = [
            (100, 20, TextOrientation.HORIZONTAL),
            (40, 63, TextOrientation.HORIZONTAL),  # tall ratio, but below the 64px floor
            (40, 64, TextOrientation.VERTICAL),  # exactly at the floor: enough for a column
            (40, 100, TextOrientation.VERTICAL),
            (40, 60, TextOrientation.HORIZONTAL),
            (100, 60, TextOrientation.HORIZONTAL),  # tall ratio 1.67 but wide crop
        ]
        for width, height, expected in cases:
            with self.subTest(width=width, height=height):
                self.assertIs(detect_orientation(width=width, height=height), expected)


class MeikiPrepareInputTests(unittest.TestCase):
    def test_fits_height_and_pads_width(self) -> None:
        rgb = np.full((20, 100, 3), 255, dtype=np.uint8)
        prepared = prepare_input(rgb, HORIZONTAL)

        self.assertEqual(prepared.tensor.shape, (1, 3, 32, 960))
        self.assertEqual(prepared.tensor.dtype, np.float32)
        self.assertTrue(prepared.tensor.flags["C_CONTIGUOUS"])
        self.assertEqual((prepared.content_width, prepared.content_height), (160, 32))
        self.assertAlmostEqual(prepared.scale_x, 100 / 160)
        self.assertAlmostEqual(prepared.scale_y, 20 / 32)
        self.assertAlmostEqual(float(prepared.tensor[0, :, :, :160].min()), 1.0)
        self.assertEqual(float(prepared.tensor[0, :, :, 160:].max()), 0.0)

    def test_shrinks_height_when_width_overflows_canvas(self) -> None:
        rgb = np.zeros((20, 4000, 3), dtype=np.uint8)
        prepared = prepare_input(rgb, HORIZONTAL)

        self.assertEqual(prepared.content_width, 960)
        self.assertEqual(prepared.content_height, 5)
        # Regression: Y must be scaled by the *real* content height, not the fixed 32px canvas.
        self.assertAlmostEqual(prepared.scale_y, 20 / 5)

    def test_vertical_canvas(self) -> None:
        rgb = np.zeros((300, 30, 3), dtype=np.uint8)
        prepared = prepare_input(rgb, VERTICAL)
        self.assertEqual(prepared.tensor.shape, (1, 3, 480, 32))
        self.assertEqual((prepared.content_width, prepared.content_height), (32, 320))


class MeikiDecodeTests(unittest.TestCase):
    def test_orders_by_reading_axis_and_suppresses_overlaps(self) -> None:
        prepared = prepare_input(np.zeros((32, 960, 3), dtype=np.uint8), HORIZONTAL)
        labels = np.array([ord("b"), ord("a"), ord("x")], dtype=np.int64)
        boxes = np.array(
            [[40, 0, 60, 32], [0, 0, 20, 32], [42, 0, 62, 32]],  # 'x' overlaps 'b' by 90%
            dtype=np.float32,
        )
        scores = np.array([0.9, 0.8, 0.5], dtype=np.float32)

        text, score = decode_predictions(
            labels, boxes, scores, prepared=prepared, spec=HORIZONTAL, confidence_threshold=0.1
        )

        self.assertEqual(text, "ab")
        self.assertAlmostEqual(score, (0.9 + 0.8) / 2)

    def test_returns_empty_when_everything_is_below_threshold(self) -> None:
        prepared = prepare_input(np.zeros((32, 960, 3), dtype=np.uint8), HORIZONTAL)
        text, score = decode_predictions(
            np.array([65], dtype=np.int64),
            np.array([[0, 0, 10, 32]], dtype=np.float32),
            np.array([0.05], dtype=np.float32),
            prepared=prepared,
            spec=HORIZONTAL,
            confidence_threshold=0.1,
        )
        self.assertEqual((text, score), ("", 0.0))

    def test_out_of_range_labels_do_not_crash(self) -> None:
        # chr() on a label > 0x10FFFF or a surrogate raises ValueError; the
        # decoder must drop the candidate instead of killing the page.
        prepared = prepare_input(np.zeros((32, 960, 3), dtype=np.uint8), HORIZONTAL)
        labels = np.array([ord("a"), 0x110000, 0xD800], dtype=np.int64)
        boxes = np.array(
            [[0, 0, 10, 32], [20, 0, 30, 32], [40, 0, 50, 32]], dtype=np.float32
        )
        scores = np.array([0.9, 0.9, 0.9], dtype=np.float32)

        text, score = decode_predictions(
            labels, boxes, scores, prepared=prepared, spec=HORIZONTAL, confidence_threshold=0.1
        )
        self.assertEqual(text, "a")


if __name__ == "__main__":
    unittest.main()
