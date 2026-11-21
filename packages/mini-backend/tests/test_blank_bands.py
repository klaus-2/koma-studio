from __future__ import annotations

from pathlib import Path
import sys
import unittest

import numpy as np


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection.base_detector import TextDetection  # noqa: E402
from models.detection.blank_bands import (  # noqa: E402
    detect_blank_bands,
    filter_slices_through_content,
)
from models.detection.comic_text_detector.detector import (  # noqa: E402
    ComicTextDetector,
)
from models.detection.font.detector import ImageSlicer  # noqa: E402
from models.detection.slicing import compute_slice_bounds  # noqa: E402


def _page_with_band(height: int = 900, width: int = 100) -> np.ndarray:
    rng = np.random.default_rng(11)
    gray = rng.integers(0, 256, size=(height, width), dtype=np.uint8)
    gray[240:540, :] = 250
    return gray


def _page_with_faint_line_inside_band(line_value: int = 245, line_rows: int = 1) -> np.ndarray:
    """Noise page carrying a 1-2px faint line inside the uniform band.

    The line's delta to the band value (|250 - 245| = 5) sits below
    ``_DEFAULT_GRADIENT_THRESHOLD`` (8.0), so the detector treats the line as
    band noise rather than content: the band absorbs it and still spans it.
    """
    gray = _page_with_band()
    start = (240 + 540) // 2
    gray[start : start + line_rows, :] = line_value
    return gray


class BlankBandTests(unittest.TestCase):
    def test_detects_the_uniform_band(self) -> None:
        bands = detect_blank_bands(_page_with_band())
        self.assertEqual(len(bands), 1)
        self.assertGreaterEqual(bands[0][0], 240)
        self.assertLessEqual(bands[0][1], 540)
        self.assertGreaterEqual(bands[0][1] - bands[0][0], 290)

    def test_dense_page_has_no_bands(self) -> None:
        rng = np.random.default_rng(5)
        gray = rng.integers(0, 256, size=(400, 120), dtype=np.uint8)
        self.assertEqual(detect_blank_bands(gray), [])

    def test_filters_only_empty_slices(self) -> None:
        bounds = [(0, 100), (120, 180), (200, 300)]
        self.assertEqual(
            filter_slices_through_content(bounds, [(100, 200)]),
            [(0, 100), (200, 300)],
        )

    def test_balloon_crossing_a_band_is_kept(self) -> None:
        bounds = [(120, 220)]
        kept = filter_slices_through_content(bounds, [(100, 200)], 0.05)
        self.assertEqual(kept, bounds)

    def test_faint_line_inside_band_is_absorbed(self) -> None:
        """A 1-2px line whose contrast sits below gradient_threshold is band noise.

        Documents the threshold contract: detect_blank_bands keeps reporting one
        band across the faint line (it cannot cut it out of a uniform region),
        and filter_slices_through_content then drops only the middle slice, so
        any real balloon in that region is still preserved by its own content
        overlap (see test_balloon_crossing_a_band_is_kept).
        """
        for line_rows in (1, 2):
            bands = detect_blank_bands(_page_with_faint_line_inside_band(line_rows=line_rows))
            self.assertEqual(len(bands), 1)
            self.assertLess(bands[0][0], 390)
            self.assertGreater(bands[0][1], 391)

    def test_high_contrast_line_inside_band_splits_it(self) -> None:
        """A line above gradient_threshold (delta 10 > 8.0) breaks the run."""
        bands = detect_blank_bands(_page_with_faint_line_inside_band(line_value=240, line_rows=1))
        self.assertEqual(len(bands), 2)
        self.assertLess(bands[0][1], 390)
        self.assertGreater(bands[1][0], 390)

    def test_band_over_faint_line_drops_only_the_empty_slice(self) -> None:
        bounds = compute_slice_bounds(900, 100)
        bands = detect_blank_bands(_page_with_faint_line_inside_band())
        kept = filter_slices_through_content(bounds, bands)
        self.assertEqual(kept, [(0, 300), (480, 900)])

    def test_all_blank_page_keeps_at_least_one_slice(self) -> None:
        bounds = compute_slice_bounds(600, 100)
        kept = filter_slices_through_content(bounds, [(0, 600)])
        self.assertGreaterEqual(len(kept), 1)


class SlicerBandInjectionTests(unittest.TestCase):
    def test_comic_detector_reoffsets_the_original_start_y(self) -> None:
        gray = _page_with_band()
        rgb = np.repeat(gray[:, :, np.newaxis], 3, axis=2)
        detector = object.__new__(ComicTextDetector)
        detector._min_box_size_px = 6

        def detect_single(crop: np.ndarray, score_threshold: float) -> list[TextDetection]:
            return [TextDetection(bbox=(5, 10, 20, 20), score=1.0)]

        detector._detect_single = detect_single
        detections = detector._detect_with_slicing(rgb, score_threshold=0.5)
        self.assertEqual({det.bbox[1] for det in detections}, {10, 490})

    def test_font_slicer_reoffsets_the_original_start_y(self) -> None:
        gray = _page_with_band()
        rgb = np.repeat(gray[:, :, np.newaxis], 3, axis=2)

        def detect_func(crop: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
            return np.array([[5, 10, 20, 20]]), np.empty((0, 4), dtype=int)

        bubbles, _ = ImageSlicer().process_slices_for_detection(rgb, detect_func)
        self.assertEqual({int(y) for y in bubbles[:, 1]}, {10, 490})


if __name__ == "__main__":
    unittest.main()
