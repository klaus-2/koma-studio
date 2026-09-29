from __future__ import annotations

import unittest

from models.detection.base_detector import TextDetection
from models.detection.comic_text_detector.detector import suppress_overlapping_detections


def _det(bbox: tuple[int, int, int, int], score: float) -> TextDetection:
    return TextDetection(bbox=bbox, score=score)


class NmsTests(unittest.TestCase):
    def test_indices_map_to_eligible_boxes_not_original_list(self) -> None:
        tiny = _det((0, 0, 3, 3), 0.99)  # dropped by min size, but first in the list
        strong = _det((10, 10, 110, 110), 0.9)
        weak_overlap = _det((15, 15, 115, 115), 0.5)

        kept = suppress_overlapping_detections(
            [tiny, strong, weak_overlap], min_box_size_px=6, nms_threshold=0.4
        )
        self.assertEqual(kept, [strong])

    def test_low_scores_survive_when_not_overlapping(self) -> None:
        # score_threshold=0 inside the NMS: the recall pass keeps low-score boxes.
        a = _det((0, 0, 50, 50), 0.06)
        b = _det((200, 200, 260, 260), 0.07)
        kept = suppress_overlapping_detections([a, b], min_box_size_px=6, nms_threshold=0.4)
        self.assertEqual(set(map(id, kept)), {id(a), id(b)})

    def test_all_too_small_returns_empty(self) -> None:
        self.assertEqual(
            suppress_overlapping_detections(
                [_det((0, 0, 2, 2), 1.0)], min_box_size_px=6, nms_threshold=0.4
            ),
            [],
        )


if __name__ == "__main__":
    unittest.main()
