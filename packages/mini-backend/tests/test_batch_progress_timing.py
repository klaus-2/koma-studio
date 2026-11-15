
from __future__ import annotations

import unittest

class FakeClock:

    def __init__(self) -> None:
        self.now: float = 1000.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds

def build_registry(clock: FakeClock):
    from pipelines.batch.progress import BatchProgressRegistry

    return BatchProgressRegistry(clock=clock)

class StageTimingAccumulationTests(unittest.TestCase):
    def test_sequential_stage_events_accumulate_per_stage(self) -> None:
        clock = FakeClock()
        registry = build_registry(clock)
        registry.start("timing-batch", 2)

        registry.item_started(0, "page-0.png")
        registry.item_stage(0, "page-0.png", "detect")
        clock.advance(2.0)
        registry.item_stage(0, "page-0.png", "ocr")
        clock.advance(1.0)
        registry.item_finished(0, "success")
        registry.item_started(1, "page-1.png")
        registry.item_stage(1, "page-1.png", "detect")
        clock.advance(0.5)
        registry.item_finished(1, "success")
        registry.finish()

        snapshot = registry.snapshot("timing-batch")
        assert snapshot is not None
        self.assertEqual(
            snapshot["stageSeconds"],
            {
                "detect": 2.5,
                "ocr": 1.0,
                "translation": 0.0,
                "segment": 0.0,
                "clean": 0.0,
            },
        )
        self.assertEqual(snapshot["lastStageMs"], 500)

    def test_translation_stage_accumulates_and_reports_milliseconds(self) -> None:
        clock = FakeClock()
        registry = build_registry(clock)
        registry.start("translation-batch", 1)

        registry.item_started(0, "page-0.png")
        registry.item_stage(0, "page-0.png", "translation")
        clock.advance(1.25)
        registry.item_stage(0, "page-0.png", "translation")
        clock.advance(0.25)
        registry.finish()

        snapshot = registry.snapshot("translation-batch")
        assert snapshot is not None
        self.assertEqual(snapshot["stageSeconds"]["translation"], 1.5)
        self.assertEqual(snapshot["lastStageMs"], 250)

    def test_interleaved_items_accumulate_overlapping_wall_time(self) -> None:
        clock = FakeClock()
        registry = build_registry(clock)
        registry.start("overlap-batch", 2)

        registry.item_started(0, "page-0.png")
        registry.item_stage(0, "page-0.png", "ocr")
        clock.advance(1.0)
        registry.item_started(1, "page-1.png")
        registry.item_stage(1, "page-1.png", "ocr")
        clock.advance(2.0)
        registry.item_finished(0, "success")
        registry.item_finished(1, "success")
        registry.finish()

        snapshot = registry.snapshot("overlap-batch")
        assert snapshot is not None
        self.assertEqual(snapshot["stageSeconds"]["ocr"], 3.0)

    def test_finish_and_cancel_close_the_open_interval(self) -> None:
        clock = FakeClock()
        registry = build_registry(clock)
        registry.start("cancel-batch", 1)

        registry.item_started(0, "page-0.png")
        registry.item_stage(0, "page-0.png", "clean")
        clock.advance(0.75)
        registry.cancel()

        snapshot = registry.snapshot("cancel-batch")
        assert snapshot is not None
        self.assertEqual(snapshot["stageSeconds"]["clean"], 0.8)
        self.assertEqual(snapshot["lastStageMs"], 750)
        self.assertTrue(snapshot["cancelled"])

    def test_never_run_stages_report_zero_and_last_stage_ms_none(self) -> None:
        clock = FakeClock()
        registry = build_registry(clock)
        registry.start("empty-batch", 0)

        snapshot = registry.snapshot("empty-batch")
        assert snapshot is not None
        self.assertEqual(
            snapshot["stageSeconds"],
            {
                "detect": 0.0,
                "ocr": 0.0,
                "translation": 0.0,
                "segment": 0.0,
                "clean": 0.0,
            },
        )
        self.assertIsNone(snapshot["lastStageMs"])

if __name__ == "__main__":
    unittest.main()
