from __future__ import annotations

from pathlib import Path
import sys
import unittest

import cv2
import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection.font.classify import classify_text_regions
from models.detection.font.reference_classifier import StructuralReferenceMatch


class TextRegionClassificationTests(unittest.TestCase):
    @staticmethod
    def _match(
        structural_type: str,
        confidence: float = 0.92,
        matched_reference_image: str | None = None,
    ):
        def _resolver(_image: np.ndarray, _bubble_bbox: tuple[int, int, int, int]) -> StructuralReferenceMatch:
            return StructuralReferenceMatch(
                structural_type=structural_type,
                confidence=confidence,
                structural_source="reference_images",
                matched_reference_image=matched_reference_image or f"{structural_type}.png",
            )

        return _resolver

    def test_marks_text_inside_bubble_as_bubble_text(self) -> None:
        image = np.full((80, 80, 3), 255, dtype=np.uint8)
        image[25:35, 27:33] = 0

        regions = classify_text_regions(
            image=image,
            text_boxes=np.array([[20, 20, 40, 40]], dtype=int),
            bubble_boxes=np.array([[10, 10, 60, 60]], dtype=int),
            bubble_matcher=self._match("speech", matched_reference_image="speech bubble.png"),
        )

        self.assertEqual(len(regions), 1)
        self.assertEqual(regions[0].label, "text_bubble")
        self.assertEqual(regions[0].bubble_bbox, (10, 10, 60, 60))
        self.assertEqual(regions[0].foreground_rgb, (0, 0, 0))
        self.assertEqual(regions[0].structural_type, "speech")
        self.assertEqual(regions[0].structural_source, "reference_images")
        self.assertEqual(regions[0].matched_reference_image, "speech bubble.png")

    def test_marks_text_without_bubble_as_free_text(self) -> None:
        image = np.full((80, 80, 3), 255, dtype=np.uint8)
        image[15:35, 20:30] = 0

        regions = classify_text_regions(
            image=image,
            text_boxes=np.array([[15, 15, 35, 35]], dtype=int),
            bubble_boxes=np.empty((0, 4), dtype=int),
        )

        self.assertEqual(len(regions), 1)
        self.assertEqual(regions[0].label, "text_free")
        self.assertIsNone(regions[0].bubble_bbox)
        self.assertIsNone(regions[0].foreground_rgb)
        self.assertEqual(regions[0].structural_type, "text_outside_bubble")
        self.assertEqual(regions[0].structural_source, "heuristic")

    def test_marks_white_text_on_dark_bubble_as_inside_black_bubble(self) -> None:
        image = np.full((80, 80, 3), 255, dtype=np.uint8)
        image[10:60, 10:60] = 20
        image[24:36, 18:42] = 245

        regions = classify_text_regions(
            image=image,
            text_boxes=np.array([[18, 18, 42, 42]], dtype=int),
            bubble_boxes=np.array([[10, 10, 60, 60]], dtype=int),
            bubble_matcher=self._match("speech", matched_reference_image="speech bubble.png"),
        )

        self.assertEqual(len(regions), 1)
        self.assertEqual(regions[0].label, "text_inside_black_bubble")
        self.assertEqual(regions[0].bubble_bbox, (10, 10, 60, 60))
        self.assertEqual(regions[0].foreground_rgb, (255, 255, 255))
        self.assertEqual(regions[0].structural_type, "speech")

    def test_maps_narration_structure_to_text_narration(self) -> None:
        image = np.full((80, 80, 3), 255, dtype=np.uint8)
        image[20:30, 20:30] = 0

        regions = classify_text_regions(
            image=image,
            text_boxes=np.array([[18, 18, 42, 42]], dtype=int),
            bubble_boxes=np.array([[10, 10, 60, 60]], dtype=int),
            bubble_matcher=self._match("narration", matched_reference_image="narration box - rectangle shape.png"),
        )

        self.assertEqual(regions[0].label, "text_narration")
        self.assertEqual(regions[0].structural_type, "narration")

    def test_maps_scream_structure_to_text_sfx(self) -> None:
        image = np.full((80, 80, 3), 255, dtype=np.uint8)
        image[20:30, 20:30] = 0

        regions = classify_text_regions(
            image=image,
            text_boxes=np.array([[18, 18, 42, 42]], dtype=int),
            bubble_boxes=np.array([[10, 10, 60, 60]], dtype=int),
            bubble_matcher=self._match("scream", matched_reference_image="scream bubble - explosive spiky shape.png"),
        )

        self.assertEqual(regions[0].label, "text_sfx")
        self.assertEqual(regions[0].structural_type, "scream")

    def test_recovers_bubble_bbox_from_local_search_when_detector_only_found_text(self) -> None:
        image = np.full((160, 160, 3), 255, dtype=np.uint8)
        center = (80, 80)
        axes = (46, 34)
        # Outline separates the inner balloon from the white page, forcing local search
        # to find the enclosed bright component instead of relying on detector bubbles.
        cv2.ellipse(image, center, axes, 0, 0, 360, (0, 0, 0), 3)
        cv2.ellipse(image, center, (42, 30), 0, 0, 360, (255, 255, 255), -1)
        image[76:84, 72:88] = 0

        regions = classify_text_regions(
            image=image,
            text_boxes=np.array([[66, 70, 94, 90]], dtype=int),
            bubble_boxes=np.empty((0, 4), dtype=int),
            bubble_matcher=self._match("speech", matched_reference_image="speech bubble.png"),
        )

        self.assertEqual(len(regions), 1)
        self.assertEqual(regions[0].label, "text_bubble")
        self.assertIsNotNone(regions[0].bubble_bbox)
        assert regions[0].bubble_bbox is not None
        bx1, by1, bx2, by2 = regions[0].bubble_bbox
        self.assertLessEqual(bx1, 66)
        self.assertLessEqual(by1, 70)
        self.assertGreaterEqual(bx2, 94)
        self.assertGreaterEqual(by2, 90)
        self.assertEqual(regions[0].structural_type, "speech")


if __name__ == "__main__":
    unittest.main()
