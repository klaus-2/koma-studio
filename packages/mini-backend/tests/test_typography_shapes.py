from __future__ import annotations

import unittest

import cv2
import numpy as np

from services.typography_shapes import clamp_bbox, detect_shapes, refine_shape


def _canvas_with_ellipse() -> np.ndarray:
    rgb = np.zeros((400, 600, 3), dtype=np.uint8)
    cv2.ellipse(rgb, (300, 200), (200, 120), 0, 0, 360, (255, 255, 255), thickness=cv2.FILLED)
    return rgb


class TypographyShapesTests(unittest.TestCase):
    def test_detects_single_rounded_bubble(self) -> None:
        shapes = detect_shapes(_canvas_with_ellipse())
        self.assertEqual(len(shapes), 1)
        shape = shapes[0]
        self.assertEqual(shape.shape_kind, "rounded")
        self.assertLess(shape.fit_profile[0], shape.fit_profile[4])  # narrower at top than middle
        self.assertEqual(shape.foreground_rgb, [255, 255, 255])
        self.assertIsNotNone(shape.mask_polygon)

    def test_refine_without_blob_returns_fallback(self) -> None:
        rgb = np.zeros((200, 200, 3), dtype=np.uint8)
        detection = refine_shape(rgb, (10, 10, 100, 100), preferred="rounded")
        self.assertIsNotNone(detection)
        assert detection is not None  # narrow for pyright
        self.assertEqual(detection.confidence, 0.35)
        self.assertEqual(detection.bbox, [10, 10, 100, 100])

    def test_clamp_bbox_rejects_empty_region(self) -> None:
        self.assertIsNone(clamp_bbox((50, 50, 20, 80), width=100, height=100))
        self.assertEqual(clamp_bbox((-5, -5, 500, 500), width=100, height=100), (0, 0, 100, 100))


if __name__ == "__main__":
    unittest.main()
