from __future__ import annotations

import os
from pathlib import Path
import sys
import unittest
from typing import Literal

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    from routers.calibration import (
        CalibrationDeviceSnapshot,
        CalibrationReport,
        CalibrationResolutionMeasurement,
        recommend_working_resolution,
    )
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


def _device(total_vram_mb: float | None) -> CalibrationDeviceSnapshot:
    return CalibrationDeviceSnapshot(
        name="Test Device",
        has_gpu=total_vram_mb is not None,
        cuda_available=total_vram_mb is not None,
        total_vram_mb=total_vram_mb,
    )


def _ok_item(
    megapixels: int,
    throughput: float,
    peak_vram_mb: float | None = None,
) -> CalibrationResolutionMeasurement:
    return CalibrationResolutionMeasurement(
        megapixels=megapixels,
        status="ok",
        iterations=2,
        throughput_images_per_second=throughput,
        peak_vram_mb=peak_vram_mb,
        downscaled=False,
        effective_megapixels=float(megapixels),
        error=None,
    )


def _failed_item(megapixels: int) -> CalibrationResolutionMeasurement:
    return CalibrationResolutionMeasurement(
        megapixels=megapixels,
        status="failed",
        iterations=0,
        throughput_images_per_second=None,
        peak_vram_mb=None,
        downscaled=False,
        effective_megapixels=None,
        error="boom",
    )


def _report(
    items: list[CalibrationResolutionMeasurement],
    *,
    total_vram_mb: float | None = None,
    status: Literal["ok", "failed"] = "ok",
) -> CalibrationReport:
    return CalibrationReport(
        status=status,
        started_at="2026-11-19T00:00:00+00:00",
        completed_at="2026-11-19T00:00:20+00:00",
        detector_model_key="font_rtdetr_v2",
        device=_device(total_vram_mb),
        wall_clock_seconds=20.0,
        results=items,
        error=None,
    )


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class RecommendWorkingResolutionTests(unittest.TestCase):
    def test_recommends_largest_qualifying_resolution(self) -> None:
        report = _report(
            [
                _ok_item(4, 2.0, peak_vram_mb=500.0),
                _ok_item(12, 1.0, peak_vram_mb=1200.0),
                _ok_item(24, 0.5, peak_vram_mb=2400.0),
            ],
            total_vram_mb=4000.0,
        )

        self.assertEqual(recommend_working_resolution(report), 24)

    def test_vram_over_headroom_excludes_candidate(self) -> None:
        report = _report(
            [
                _ok_item(4, 2.0, peak_vram_mb=500.0),
                _ok_item(12, 1.0, peak_vram_mb=3600.0),
                _ok_item(24, 0.5, peak_vram_mb=3800.0),
            ],
            total_vram_mb=4000.0,
        )

        self.assertEqual(recommend_working_resolution(report), 4)

    def test_unknown_total_vram_falls_back_to_throughput_only(self) -> None:
        report = _report(
            [
                _ok_item(4, 2.0, peak_vram_mb=None),
                _ok_item(12, 1.0, peak_vram_mb=None),
            ],
            total_vram_mb=None,
        )

        self.assertEqual(recommend_working_resolution(report), 12)

    def test_known_total_vram_requires_measured_peak(self) -> None:
        report = _report(
            [_ok_item(4, 2.0, peak_vram_mb=None)],
            total_vram_mb=4000.0,
        )

        self.assertIsNone(recommend_working_resolution(report))

    def test_throughput_below_threshold_excludes_candidate(self) -> None:
        report = _report(
            [
                _ok_item(12, 0.24, peak_vram_mb=500.0),
                _ok_item(24, 0.1, peak_vram_mb=500.0),
            ],
            total_vram_mb=4000.0,
        )

        self.assertIsNone(recommend_working_resolution(report))

    def test_throughput_at_threshold_qualifies(self) -> None:
        report = _report([_ok_item(4, 0.25, peak_vram_mb=500.0)], total_vram_mb=4000.0)

        self.assertEqual(recommend_working_resolution(report), 4)

    def test_any_failed_item_disqualifies_report(self) -> None:
        report = _report(
            [
                _ok_item(4, 2.0, peak_vram_mb=500.0),
                _failed_item(12),
            ],
            total_vram_mb=4000.0,
        )

        self.assertIsNone(recommend_working_resolution(report))

    def test_failed_run_status_returns_none(self) -> None:
        report = _report(
            [_ok_item(4, 2.0, peak_vram_mb=500.0)],
            total_vram_mb=4000.0,
            status="failed",
        )

        self.assertIsNone(recommend_working_resolution(report))

    def test_empty_results_return_none(self) -> None:
        self.assertIsNone(recommend_working_resolution(_report([])))


if __name__ == "__main__":
    unittest.main()
