from __future__ import annotations

import random
import sys
import unittest
from pathlib import Path

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection.base_detector import TextDetection
from models.detection.reading_order import (
    reading_order_permutation,
    sort_detections_in_reading_order,
)


class ReadingOrderPermutationTests(unittest.TestCase):
    def test_permutation_is_always_valid(self) -> None:
        rng = random.Random(7)
        boxes = [
            (
                (x := rng.randint(0, 900)),
                (y := rng.randint(0, 900)),
                x + rng.randint(10, 80),
                y + rng.randint(10, 80),
            )
            for _ in range(60)
        ]
        self.assertEqual(sorted(reading_order_permutation(boxes)), list(range(60)))

    def test_two_horizontal_rows_read_top_then_left_to_right(self) -> None:
        row1 = [(0, 0, 40, 20), (50, 2, 90, 22), (100, 1, 140, 21)]
        row2 = [(0, 100, 40, 120), (50, 101, 90, 121), (100, 99, 140, 119)]
        shuffled = [row2[1], row1[2], row2[0], row1[0], row2[2], row1[1]]
        self.assertEqual(reading_order_permutation(shuffled), [3, 5, 1, 2, 0, 4])

    def test_single_vertical_column_reads_top_to_bottom(self) -> None:
        column = [(100, 0, 130, 120), (100, 150, 130, 270), (100, 300, 130, 420)]
        detections = [TextDetection(bbox=b, score=1.0) for b in reversed(column)]
        self.assertEqual(
            [d.bbox for d in sort_detections_in_reading_order(detections)], column
        )

    def test_duplicate_bboxes_preserve_every_detection(self) -> None:
        detections = [
            TextDetection(bbox=(0, 0, 10, 10), score=s) for s in (0.1, 0.2, 0.3)
        ]
        self.assertEqual(len(sort_detections_in_reading_order(detections)), 3)


if __name__ == "__main__":
    unittest.main()
