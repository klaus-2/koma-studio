"""run_cached_ocr seam tests — inject engines/cache, patch only the
recognize/enrich collaborators."""

from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.ocr.base_ocr import OCRTextResult  # noqa: E402
from models.ocr.stage import (  # noqa: E402
    CachedOcrRequest,
    run_cached_ocr,
)
from pipelines.batch.records import OCRSeed  # noqa: E402


class _FakeEngine:
    def __init__(self, key: str = "fake-ocr") -> None:
        self.key = key


class _FakeCache:
    """Records the stage's cache interactions; pre-seeds cached hits."""

    def __init__(self, cached_by_id: dict[str, dict] | None = None) -> None:
        self.cached_by_id = cached_by_id or {}
        self.cache_calls: list[list[dict]] = []
        self.built_keys: list[dict] = []

    def build_ocr_cache_key(self, **kwargs: object) -> str:
        self.built_keys.append(kwargs)
        return "cache-key-1"

    def get_cached_ocr_for_regions(self, cache_key: str, seeds: tuple[OCRSeed, ...]):
        _ = cache_key
        missing = [seed for seed in seeds if seed["id"] not in self.cached_by_id]
        return dict(self.cached_by_id), missing

    def cache_ocr_results(self, cache_key: str, records: list[dict]) -> int:
        _ = cache_key
        self.cache_calls.append([dict(record) for record in records])
        for record in records:
            self.cached_by_id[record["id"]] = dict(record)
        return len(records)


def _seed(seed_id: str) -> OCRSeed:
    return OCRSeed(
        id=seed_id,
        bbox=[0, 0, 10, 10],
        source="model",
        detector_model_key="det",
    )


def _request(seeds: tuple[OCRSeed, ...], cache: _FakeCache) -> CachedOcrRequest:
    return CachedOcrRequest(
        image=object(),  # only forwarded to the patched collaborators
        image_bytes=b"img",
        language="en",
        model_key=None,
        has_gpu=False,
        seeds=seeds,
    )


def _mark_enriched(record: dict) -> dict:
    return {**record, "foreground_gradient": None}


class RunCachedOcrTests(unittest.IsolatedAsyncioTestCase):
    async def test_cached_hit_skips_recognition_and_caching(self) -> None:
        cached = {
            "r1": {
                "id": "r1",
                "bbox": [0, 0, 10, 10],
                "text": "hi",
                "score": 1.0,
                "source": "model",
                "detector_model_key": "det",
                "ocr_model_key": "old-ocr",
                "foreground_gradient": None,
            }
        }
        cache = _FakeCache(cached_by_id=cached)

        async def _fail_recognize(**kwargs: object) -> list[OCRTextResult]:
            raise AssertionError("recognize must not run on a full cache hit")

        with (
            patch("models.ocr.stage.recognize_with_fallbacks", _fail_recognize),
            patch(
                "models.ocr.stage.enrich_ocr_record_with_gradient",
                lambda image, record: _mark_enriched(record),
            ),
        ):
            result = await run_cached_ocr(
                _request((_seed("r1"),), cache), cache=cache, resolve_engine=lambda **_: _FakeEngine()
            )

        self.assertEqual(result.engine_key, "fake-ocr")
        self.assertEqual([record["id"] for record in result.records], ["r1"])
        self.assertEqual(cache.cache_calls, [])

    async def test_fresh_run_recognizes_missing_and_caches(self) -> None:
        cache = _FakeCache()
        recognized: list[list[str]] = []

        async def _fake_recognize(**kwargs: object) -> list[OCRTextResult]:
            regions = kwargs["regions"]
            recognized.append([region.id for region in regions])
            return [
                OCRTextResult(
                    id=region.id,
                    bbox=(0, 0, 10, 10),
                    text=f"text-{region.id}",
                    score=0.9,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key="fake-ocr",
                )
                for region in regions
            ]

        with (
            patch("models.ocr.stage.recognize_with_fallbacks", _fake_recognize),
            patch(
                "models.ocr.stage.enrich_ocr_record_with_gradient",
                lambda image, record: _mark_enriched(record),
            ),
        ):
            result = await run_cached_ocr(
                _request((_seed("r1"), _seed("r2")), cache),
                cache=cache,
                resolve_engine=lambda **_: _FakeEngine(),
            )

        self.assertEqual(recognized, [["r1", "r2"]])
        self.assertEqual(
            [record["text"] for record in result.records], ["text-r1", "text-r2"]
        )
        self.assertEqual(result.engine_key, "fake-ocr")
        self.assertEqual(len(cache.cache_calls), 1)
        self.assertEqual([record["id"] for record in cache.cache_calls[0]], ["r1", "r2"])

    async def test_merge_falls_back_to_seed_record_for_unknown_ids(self) -> None:
        cache = _FakeCache()

        async def _recognize_only_r1(**kwargs: object) -> list[OCRTextResult]:
            regions = kwargs["regions"]
            return [
                OCRTextResult(
                    id=region.id,
                    bbox=(0, 0, 10, 10),
                    text=f"text-{region.id}",
                    score=0.9,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key="fake-ocr",
                )
                for region in regions
                if region.id == "r1"
            ]

        with (
            patch("models.ocr.stage.recognize_with_fallbacks", _recognize_only_r1),
            patch(
                "models.ocr.stage.enrich_ocr_record_with_gradient",
                lambda image, record: _mark_enriched(record),
            ),
        ):
            result = await run_cached_ocr(
                _request((_seed("r1"), _seed("ghost")), cache),
                cache=cache,
                resolve_engine=lambda **_: _FakeEngine(),
            )

        by_id = {record["id"]: record for record in result.records}
        self.assertEqual(by_id["r1"]["text"], "text-r1")
        self.assertEqual(by_id["ghost"]["text"], "")
        self.assertEqual(by_id["ghost"]["ocr_model_key"], "fake-ocr")
        # Empty merge fallbacks still go through the enricher.
        self.assertIn("foreground_gradient", by_id["ghost"])

    async def test_merge_guard_only_enriches_records_without_gradient(self) -> None:
        cached = {
            "with-gradient": {
                "id": "with-gradient",
                "bbox": [0, 0, 10, 10],
                "text": "a",
                "score": 1.0,
                "source": "model",
                "detector_model_key": "det",
                "ocr_model_key": "old-ocr",
                "foreground_gradient": {"start_rgb": [0, 0, 0], "end_rgb": [9, 9, 9], "angle_degrees": 0.0},
            },
            "stale": {
                "id": "stale",
                "bbox": [0, 0, 10, 10],
                "text": "b",
                "score": 1.0,
                "source": "model",
                "detector_model_key": "det",
                "ocr_model_key": "old-ocr",
            },
        }
        cache = _FakeCache(cached_by_id=cached)
        enrich_calls: list[str] = []

        def _fake_enrich(image: object, record: dict) -> dict:
            _ = image
            enrich_calls.append(record["id"])
            return _mark_enriched(record)

        async def _fail_recognize(**kwargs: object) -> list[OCRTextResult]:
            raise AssertionError("recognize must not run when everything is cached")

        with (
            patch("models.ocr.stage.recognize_with_fallbacks", _fail_recognize),
            patch("models.ocr.stage.enrich_ocr_record_with_gradient", _fake_enrich),
        ):
            result = await run_cached_ocr(
                _request((_seed("with-gradient"), _seed("stale")), cache),
                cache=cache,
                resolve_engine=lambda **_: _FakeEngine(),
            )

        by_id = {record["id"]: record for record in result.records}
        self.assertEqual(by_id["with-gradient"]["foreground_gradient"]["start_rgb"], [0, 0, 0])
        self.assertIsNone(by_id["stale"]["foreground_gradient"])
        self.assertEqual(enrich_calls, ["stale"])

    async def test_ocr_finished_log_event_survives_with_device_info(self) -> None:
        cache = _FakeCache()

        async def _fail_recognize(**kwargs: object) -> list[OCRTextResult]:
            return []

        request = CachedOcrRequest(
            image=object(),
            image_bytes=b"img",
            language="en",
            model_key=None,
            has_gpu=False,
            seeds=(),
            device_info=type("DeviceInfoStub", (), {"name": "cpu-test"})(),
        )
        with (
            patch("models.ocr.stage.recognize_with_fallbacks", _fail_recognize),
            patch(
                "models.ocr.stage.enrich_ocr_record_with_gradient",
                lambda image, record: _mark_enriched(record),
            ),
            self.assertLogs("models.ocr.stage", level="INFO") as logs,
        ):
            await run_cached_ocr(
                request, cache=cache, resolve_engine=lambda **_: _FakeEngine()
            )

        self.assertTrue(any("ocr finished" in message for message in logs.output))
        # `extra` fields ride on the LogRecord (structured formatters render
        # them); the default formatter only shows the event name.
        record = next(r for r in logs.records if r.getMessage() == "ocr finished")
        self.assertEqual(record.engine, "fake-ocr")
        self.assertEqual(record.device, "cpu-test")
        self.assertEqual(record.fresh, 0)
        self.assertEqual(record.cached, 0)


if __name__ == "__main__":
    unittest.main()
