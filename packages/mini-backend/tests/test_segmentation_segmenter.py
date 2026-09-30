from __future__ import annotations

import asyncio
import base64
import unittest

import cv2
import numpy as np

from models.errors import InvalidInputImageError
from models.geometry import BBox
from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.baka_segmenter import BakaContentSegmenter, decode_grayscale

_GLYPH_A: BBox = (120, 100, 161, 141)  # cv2.rectangle is end-inclusive → 41 px wide
_GLYPH_B: BBox = (168, 100, 209, 141)
_BALLOON: BBox = (100, 80, 260, 180)


def _png(canvas: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", canvas)
    assert ok
    return np.asarray(buf).tobytes()


def _page_png() -> bytes:
    canvas = np.full((400, 600), 255, dtype=np.uint8)
    cv2.rectangle(canvas, (120, 100), (160, 140), 0, thickness=cv2.FILLED)
    cv2.rectangle(canvas, (168, 100), (208, 140), 0, thickness=cv2.FILLED)
    return _png(canvas)


class BakaSegmenterTests(unittest.TestCase):
    def test_segments_pure_binary_crop(self) -> None:
        # Regression: the old polarity split (t, > t) left the dark class EMPTY
        # on clean binary crops — the easiest case found nothing at all.
        [result] = asyncio.run(
            BakaContentSegmenter().segment(
                _page_png(), [SegmentInputRegion(id="r1", bbox=_BALLOON)]
            )
        )

        self.assertEqual(result.bbox, _BALLOON)
        self.assertEqual(result.segment_model_key, "baka_content_cc")
        self.assertEqual(set(result.segment_boxes), {_GLYPH_A, _GLYPH_B})

        [(mx1, my1, mx2, my2)] = result.merged_boxes
        self.assertLessEqual(mx1, 120)
        self.assertLessEqual(my1, 100)
        self.assertGreaterEqual(mx2, 209)
        self.assertGreaterEqual(my2, 141)

        mask = cv2.imdecode(
            np.frombuffer(base64.b64decode(result.mask_base64), dtype=np.uint8),
            cv2.IMREAD_GRAYSCALE,
        )
        self.assertEqual(mask.shape, (400, 600))
        self.assertEqual(int(np.count_nonzero(mask)), 2 * 41 * 41)
        self.assertFalse(mask[:100, :].any())
        self.assertFalse(mask[:, 210:].any())

    def test_scratch_buffer_does_not_leak_between_regions(self) -> None:
        segmenter = BakaContentSegmenter()
        regions = [
            SegmentInputRegion(id="a", bbox=_BALLOON),
            SegmentInputRegion(id="b", bbox=(300, 300, 380, 360)),
        ]
        first, second = segmenter._segment(_page_png(), regions)
        self.assertTrue(first.mask_base64)
        self.assertEqual(second.mask_base64, "")
        self.assertEqual(second.segment_boxes, ())

    def test_degenerate_region_returns_empty_result(self) -> None:
        [result] = BakaContentSegmenter()._segment(
            _page_png(), [SegmentInputRegion(id="z", bbox=(0, 0, 0, 0))]
        )
        self.assertEqual(result.bbox, (0, 0, 0, 0))
        self.assertEqual(result.segment_boxes, ())
        self.assertEqual(result.merged_boxes, ())
        self.assertEqual(result.mask_base64, "")

    def test_reversed_coordinates_are_normalised(self) -> None:
        reversed_bbox: BBox = (_BALLOON[2], _BALLOON[3], _BALLOON[0], _BALLOON[1])
        [result] = BakaContentSegmenter()._segment(
            _page_png(), [SegmentInputRegion(id="r", bbox=reversed_bbox)]
        )
        self.assertEqual(set(result.segment_boxes), {_GLYPH_A, _GLYPH_B})

    def test_invalid_bytes_raise_domain_error(self) -> None:
        with self.assertRaises(InvalidInputImageError):
            decode_grayscale(b"definitely not an image")


if __name__ == "__main__":
    unittest.main()
