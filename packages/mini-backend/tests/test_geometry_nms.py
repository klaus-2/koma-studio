from __future__ import annotations

import sys
import unittest
from pathlib import Path

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.geometry import greedy_nms  # noqa: E402


class GreedyNmsTests(unittest.TestCase):
    def test_suppresses_high_overlap_and_keeps_best_score(self) -> None:
        import numpy as np

        boxes = np.array([[0, 0, 10, 10], [1, 1, 11, 11], [50, 50, 60, 60]], dtype=np.float64)
        scores = np.array([0.8, 0.9, 0.5], dtype=np.float64)
        self.assertEqual(greedy_nms(boxes, scores, 0.5), [1, 2])

    def test_empty_input(self) -> None:
        import numpy as np

        self.assertEqual(
            greedy_nms(np.empty((0, 4), np.float64), np.empty(0, np.float64), 0.5), []
        )

    def test_inverted_case(self) -> None:
        # The old inverted-masking bug in pp_doclayout (`ious > threshold` on the
        # complement) kept suppressed boxes; greedy_nms must keep the winners.
        import numpy as np

        boxes = np.array([[0, 0, 10, 10], [1, 1, 11, 11]], dtype=np.float64)
        scores = np.array([0.9, 0.8], dtype=np.float64)
        self.assertEqual(greedy_nms(boxes, scores, 0.5), [0])


if __name__ == "__main__":
    unittest.main()
