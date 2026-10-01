from __future__ import annotations

import unittest

import numpy as np
import numpy.typing as npt

from schemas.splitter import SplitterRecipeModel
from services.splitter_analysis import analyze_strip


def _strip_with_gaps(length: int, gaps: list[int], *, gap_px: int = 30) -> npt.NDArray[np.uint8]:
    rgb = np.full((length, 400, 3), 40, dtype=np.uint8)  # dark content
    for gap in gaps:
        rgb[gap : gap + gap_px, :, :] = 255  # whitespace band
    return rgb


def _smart(axis: str) -> SplitterRecipeModel:
    return SplitterRecipeModel(strategy="smart", axis=axis, minSegmentSize=200, maxSegmentSize=2000)


class SplitterAnalysisTests(unittest.TestCase):
    def test_smart_cuts_land_inside_whitespace_bands(self) -> None:
        rgb = _strip_with_gaps(1800, gaps=[600, 1200])
        analysis = analyze_strip(rgb, _smart("vertical"))
        positions = [cut.position for cut in analysis.cuts]
        self.assertTrue(positions, "expected at least one cut")
        for position in positions:
            self.assertTrue(
                any(gap <= position <= gap + 30 for gap in (600, 1200)),
                f"cut {position} outside every whitespace band",
            )
        self.assertEqual(len(analysis.segments), len(positions) + 1)

    def test_horizontal_axis_matches_transposed_vertical(self) -> None:
        # Regression for the blur-axis bug: horizontal analysis must equal the
        # vertical analysis of the transposed image.
        rgb = _strip_with_gaps(1800, gaps=[600, 1200])
        vertical = analyze_strip(rgb, _smart("vertical"))
        horizontal = analyze_strip(
            np.ascontiguousarray(rgb.transpose(1, 0, 2)), _smart("horizontal")
        )
        self.assertEqual(
            [cut.position for cut in vertical.cuts],
            [cut.position for cut in horizontal.cuts],
        )
        self.assertEqual(vertical.whitespace_candidates, horizontal.whitespace_candidates)

    def test_count_strategy_is_even_spacing(self) -> None:
        rgb = np.zeros((1000, 100, 3), dtype=np.uint8)
        analysis = analyze_strip(rgb, SplitterRecipeModel(strategy="count", parts=4))
        self.assertEqual([cut.position for cut in analysis.cuts], [250, 500, 750])


if __name__ == "__main__":
    unittest.main()
