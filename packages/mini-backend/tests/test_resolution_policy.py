from __future__ import annotations

import unittest

from utils.resolution_policy import (
    DECODE_CEILING_MEGAPIXELS,
    DETECTION_HARD_CAP_MEGAPIXELS,
    SAFE_TARGET_MEGAPIXELS,
    decode_rejects,
    detection_rejects,
    megapixels_of,
    stage_resolution_plan,
)


class MegapixelsTests(unittest.TestCase):
    def test_megapixels_of(self) -> None:
        self.assertAlmostEqual(megapixels_of(800, 1200), 0.96)
        self.assertAlmostEqual(megapixels_of(4000, 8000), 32.0)


class StageResolutionPlanTests(unittest.TestCase):
    def test_small_page_untouched_for_every_stage(self) -> None:
        for stage in ("detection", "inpaint", "segment", "clean", "decode"):
            plan = stage_resolution_plan(stage, 800, 1200)
            self.assertFalse(plan.downscaled)
            self.assertEqual((plan.working_width, plan.working_height), (800, 1200))
            self.assertEqual((plan.scale_x, plan.scale_y), (1.0, 1.0))

    def test_oversized_page_downscales_for_detection_only(self) -> None:
        detection = stage_resolution_plan("detection", 4000, 8000)
        self.assertTrue(detection.downscaled)
        self.assertAlmostEqual(detection.working_width * detection.working_height / 1e6, 24.0, places=1)
        self.assertLess(detection.working_width, 4000)
        self.assertLess(detection.scale_x, 1.0)
        self.assertLess(detection.scale_y, 1.0)

        for stage in ("inpaint", "segment", "clean", "decode"):
            plan = stage_resolution_plan(stage, 4000, 8000)
            self.assertFalse(plan.downscaled, stage)
            self.assertEqual((plan.working_width, plan.working_height), (4000, 8000))

    def test_tall_strip_downscales_preserving_aspect(self) -> None:
        plan = stage_resolution_plan("detection", 800, 20000)
        self.assertFalse(plan.downscaled)

        tall = stage_resolution_plan("detection", 1200, 30000)
        self.assertTrue(tall.downscaled)
        self.assertAlmostEqual(tall.working_width / tall.working_height, 1200 / 30000, places=4)

    def test_working_dimensions_never_below_one_pixel(self) -> None:
        plan = stage_resolution_plan("detection", 2, 2_000_000)
        self.assertGreaterEqual(plan.working_width, 1)
        self.assertGreaterEqual(plan.working_height, 1)


class CapTests(unittest.TestCase):
    def test_detection_rejects_above_hard_cap(self) -> None:
        self.assertFalse(detection_rejects(4000, 8000))
        self.assertTrue(detection_rejects(4100, 8000))

    def test_decode_rejects_above_ceiling(self) -> None:
        self.assertFalse(decode_rejects(4000, 8000))
        self.assertTrue(decode_rejects(5000, 13000))

    def test_constants_ordered_sensibly(self) -> None:
        self.assertLess(SAFE_TARGET_MEGAPIXELS, DETECTION_HARD_CAP_MEGAPIXELS)
        self.assertEqual(DETECTION_HARD_CAP_MEGAPIXELS, 32.0)
        self.assertEqual(DECODE_CEILING_MEGAPIXELS, 64.0)


if __name__ == "__main__":
    unittest.main()


class SliceInteractionTests(unittest.TestCase):
    def test_downscale_keeps_slice_count_and_shrinks_slices(self) -> None:
        from models.detection.slicing import compute_slice_bounds

        width, height = 1200, 30000
        plan = stage_resolution_plan("detection", width, height)
        self.assertTrue(plan.downscaled)
        before = compute_slice_bounds(height, width)
        after = compute_slice_bounds(plan.working_height, plan.working_width)
        self.assertEqual(len(after), len(before))
        self.assertLess(after[0][1], before[0][1])
