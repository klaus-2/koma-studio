from __future__ import annotations

import unittest

from models.detection.slicing import SliceParams, compute_slice_bounds


class SlicingTests(unittest.TestCase):
    def test_no_slicing_for_regular_aspect(self) -> None:
        self.assertEqual(compute_slice_bounds(1500, 1000), [(0, 1500)])

    def test_degenerate_dimensions(self) -> None:
        self.assertEqual(compute_slice_bounds(0, 1000), [])

    def test_last_slice_always_reaches_bottom_after_absorption(self) -> None:
        # 5 raw slices; the 5th (400px of 3000) is absorbed, so the 4th must extend to 10000.
        bounds = compute_slice_bounds(10_000, 1_000)
        self.assertEqual(bounds, [(0, 3000), (2400, 5400), (4800, 7800), (7200, 10_000)])
        self.assertEqual(bounds[-1][1], 10_000)

    def test_windows_cover_every_row(self) -> None:
        height = 23_457
        covered: set[int] = set()
        for start, end in compute_slice_bounds(height, 800, SliceParams()):
            covered.update(range(start, end))
        self.assertEqual(covered, set(range(height)))


if __name__ == "__main__":
    unittest.main()
