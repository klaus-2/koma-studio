from __future__ import annotations

from pathlib import Path
import sys
import unittest


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection.base_detector import TextDetection
from models.detection.reading_order import sort_bboxes_in_reading_order, sort_detections_in_reading_order


class DetectionReadingOrderTests(unittest.TestCase):
    def test_sorts_horizontal_boxes_top_to_bottom_and_left_to_right(self) -> None:
        boxes = [
            (140, 70, 200, 110),
            (20, 20, 80, 60),
            (90, 20, 150, 60),
            (30, 70, 90, 110),
        ]

        ordered = sort_bboxes_in_reading_order(boxes)

        self.assertEqual(
            ordered,
            [
                (20, 20, 80, 60),
                (90, 20, 150, 60),
                (30, 70, 90, 110),
                (140, 70, 200, 110),
            ],
        )

    def test_sorts_vertical_boxes_right_to_left_and_top_to_bottom(self) -> None:
        boxes = [
            (20, 80, 50, 150),
            (120, 20, 150, 90),
            (20, 10, 50, 70),
            (120, 110, 150, 180),
        ]

        ordered = sort_bboxes_in_reading_order(boxes)

        self.assertEqual(
            ordered,
            [
                (120, 20, 150, 90),
                (120, 110, 150, 180),
                (20, 10, 50, 70),
                (20, 80, 50, 150),
            ],
        )

    def test_preserves_detection_payload_while_reordering(self) -> None:
        detections = [
            TextDetection(bbox=(80, 20, 130, 60), score=0.2, label="b"),
            TextDetection(bbox=(10, 20, 60, 60), score=0.9, label="a"),
        ]

        ordered = sort_detections_in_reading_order(detections)

        self.assertEqual([item.label for item in ordered], ["a", "b"])
        self.assertEqual([item.score for item in ordered], [0.9, 0.2])


if __name__ == "__main__":
    unittest.main()
