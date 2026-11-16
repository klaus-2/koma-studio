"""run_cached_ocr seam tests — inject engines/cache, patch only the
recognize/enrich collaborators."""

from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from PIL import Image  # noqa: E402

from core.config import MiniBackendConfig  # noqa: E402
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult  # noqa: E402
from pipelines.ocr_stage import (  # noqa: E402
    CachedOcrRequest,
    run_cached_ocr,
)
from pipelines.batch.records import OCRSeed  # noqa: E402
from pipelines.ocr_region_dedup import get_ocr_region_dedup_cache  # noqa: E402
from pipelines.stage_store import StageStore  # noqa: E402
from utils.resolution_policy import (  # noqa: E402
    StageResolutionPlan,
    stage_resolution_plan,
)


class _FakeEngine:
    def __init__(self, key: str = "fake-ocr") -> None:
        self.key = key


class _FakeCache:
    """Records the stage's cache interactions; pre-seeds cached hits.

    ``remember=False`` records writes without serving them again, isolating
    the dedup layer from the page cache on repeat runs.
    """

    def __init__(
        self,
        cached_by_id: dict[str, dict] | None = None,
        *,
        remember: bool = True,
    ) -> None:
        self.cached_by_id = cached_by_id or {}
        self.remember = remember
        self.cache_calls: list[list[dict]] = []
        self.built_keys: list[dict] = []

    def build_ocr_cache_key(self, **kwargs: object) -> str:
        self.built_keys.append(kwargs)
        return f"cache-key-{len(self.built_keys)}"

    def get_cached_ocr_for_regions(self, cache_key: str, seeds: tuple[OCRSeed, ...]):
        _ = cache_key
        missing = [seed for seed in seeds if seed["id"] not in self.cached_by_id]
        return dict(self.cached_by_id), missing

    def cache_ocr_results(self, cache_key: str, records: list[dict]) -> int:
        _ = cache_key
        self.cache_calls.append([dict(record) for record in records])
        if self.remember:
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


class _DedupIsolatedTestCase(unittest.IsolatedAsyncioTestCase):
    """Resets the process-wide dedup singleton around each test method."""

    def setUp(self) -> None:
        get_ocr_region_dedup_cache.cache_clear()

    def tearDown(self) -> None:
        get_ocr_region_dedup_cache.cache_clear()


class RunCachedOcrTests(_DedupIsolatedTestCase):
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
            patch("pipelines.ocr_stage.recognize_with_fallbacks", _fail_recognize),
            patch(
                "pipelines.ocr_stage.enrich_ocr_record_with_gradient",
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
            patch("pipelines.ocr_stage.recognize_with_fallbacks", _fake_recognize),
            patch(
                "pipelines.ocr_stage.enrich_ocr_record_with_gradient",
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
            patch("pipelines.ocr_stage.recognize_with_fallbacks", _recognize_only_r1),
            patch(
                "pipelines.ocr_stage.enrich_ocr_record_with_gradient",
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
            patch("pipelines.ocr_stage.recognize_with_fallbacks", _fail_recognize),
            patch("pipelines.ocr_stage.enrich_ocr_record_with_gradient", _fake_enrich),
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
            patch("pipelines.ocr_stage.recognize_with_fallbacks", _fail_recognize),
            patch(
                "pipelines.ocr_stage.enrich_ocr_record_with_gradient",
                lambda image, record: _mark_enriched(record),
            ),
            self.assertLogs("pipelines.ocr_stage", level="INFO") as logs,
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


class _CountingEngine(BaseOCR):
    """Real fallback path runs against it; records each batch's region ids."""

    def __init__(self, key: str = "fake-ocr") -> None:
        self.key = key
        self.batches: list[list[str]] = []

    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        _ = image, language
        self.batches.append([region.id for region in regions])
        return [
            OCRTextResult(
                id=region.id,
                bbox=region.bbox,
                text=f"text-{region.id}",
                score=0.9,
                source=region.source,
                detector_model_key=region.detector_model_key,
                model_key=self.key,
            )
            for region in regions
        ]


def _seed_at(seed_id: str, bbox: list[int]) -> OCRSeed:
    return OCRSeed(id=seed_id, bbox=bbox, source="model", detector_model_key="det")


def _pixel_request(
    seeds: tuple[OCRSeed, ...],
    cache: _FakeCache,
    *,
    image_bytes: bytes = b"img",
) -> CachedOcrRequest:
    _ = cache
    return CachedOcrRequest(
        # Uniform fill: any two same-sized crops hash identically.
        image=Image.new("RGB", (32, 32), (200, 200, 200)),
        image_bytes=image_bytes,
        language="en",
        model_key=None,
        has_gpu=False,
        seeds=seeds,
    )


class DedupReuseTests(_DedupIsolatedTestCase):
    async def test_same_crop_twice_in_one_page_runs_engine_once(self) -> None:
        cache = _FakeCache()
        engine = _CountingEngine()
        seeds = (_seed_at("r1", [0, 0, 10, 10]), _seed_at("r2", [4, 4, 14, 14]))
        with patch(
            "pipelines.ocr_stage.enrich_ocr_record_with_gradient",
            lambda image, record: _mark_enriched(record),
        ):
            result = await run_cached_ocr(
                _pixel_request(seeds, cache),
                cache=cache,
                resolve_engine=lambda **_: engine,
            )

        self.assertEqual(engine.batches, [["r1", "r2"]])
        by_id = {record["id"]: record for record in result.records}
        self.assertEqual(by_id["r1"]["bbox"], [0, 0, 10, 10])
        self.assertEqual(by_id["r2"]["bbox"], [4, 4, 14, 14])
        self.assertEqual(by_id["r2"]["text"], "text-r2")
        stats = get_ocr_region_dedup_cache().stats()
        self.assertEqual(stats["entries"], 1)
        self.assertEqual(stats["misses"], 1)

    async def test_second_call_missing_set_shrinks_via_dedup(self) -> None:
        cache = _FakeCache(remember=False)
        engine = _CountingEngine()
        seeds = (_seed_at("r1", [0, 0, 10, 10]), _seed_at("r2", [4, 4, 14, 14]))
        with patch(
            "pipelines.ocr_stage.enrich_ocr_record_with_gradient",
            lambda image, record: _mark_enriched(record),
        ):
            await run_cached_ocr(
                _pixel_request(seeds, cache, image_bytes=b"img-1"),
                cache=cache,
                resolve_engine=lambda **_: engine,
            )
            self.assertEqual(engine.batches, [["r1", "r2"]])
            result = await run_cached_ocr(
                _pixel_request(seeds, cache, image_bytes=b"img-2"),
                cache=cache,
                resolve_engine=lambda **_: engine,
            )

        self.assertEqual(engine.batches, [["r1", "r2"]])
        by_id = {record["id"]: record for record in result.records}
        self.assertEqual(by_id["r1"]["text"], "text-r1")
        self.assertEqual(by_id["r2"]["text"], "text-r1")
        self.assertEqual(by_id["r1"]["bbox"], [0, 0, 10, 10])
        self.assertEqual(by_id["r2"]["bbox"], [4, 4, 14, 14])
        stats = get_ocr_region_dedup_cache().stats()
        self.assertEqual(stats["hits"], 1)
        self.assertEqual(stats["misses"], 1)

    async def test_blank_text_records_are_not_stored(self) -> None:
        cache = _FakeCache()

        async def _blank_recognize(**kwargs: object) -> list[OCRTextResult]:
            regions = kwargs["regions"]
            return [
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text="",
                    score=0.0,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key="fake-ocr",
                )
                for region in regions
            ]

        with (
            patch("pipelines.ocr_stage.recognize_with_fallbacks", _blank_recognize),
            patch(
                "pipelines.ocr_stage.enrich_ocr_record_with_gradient",
                lambda image, record: _mark_enriched(record),
            ),
        ):
            await run_cached_ocr(
                _pixel_request((_seed_at("r1", [0, 0, 10, 10]),), cache),
                cache=cache,
                resolve_engine=lambda **_: _FakeEngine(),
            )

        self.assertEqual(get_ocr_region_dedup_cache().stats()["entries"], 0)


type _EngineBatch = tuple[tuple[int, int], list[tuple[int, int, int, int]]]


def _policy_config(*, enabled: bool, megapixels: float) -> MiniBackendConfig:
    return MiniBackendConfig(
        environment="test",
        default_detection_model="det",
        detection_conf_threshold=0.5,
        detection_nms_threshold=0.5,
        detection_input_size=1024,
        pipeline_cache_ttl_seconds=1800,
        pipeline_cache_max_entries=64,
        pipeline_cache_bbox_tolerance_px=8.0,
        batch_default_concurrency=2,
        batch_max_concurrency=4,
        batch_max_images=8,
        engine_idle_timeout_seconds=0,
        working_resolution_megapixels=megapixels,
        working_resolution_ocr_clean_enabled=enabled,
    )


def _large_request(
    seeds: tuple[OCRSeed, ...], cache: _FakeCache, page: Image.Image
) -> CachedOcrRequest:
    _ = cache
    return CachedOcrRequest(
        image=page,
        image_bytes=b"img",
        language="en",
        model_key=None,
        has_gpu=False,
        seeds=seeds,
    )


def _expected_working_bbox(
    bbox: list[int], plan: StageResolutionPlan
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    return (
        min(plan.working_width, max(0, round(x1 * plan.scale_x))),
        min(plan.working_height, max(0, round(y1 * plan.scale_y))),
        min(plan.working_width, max(0, round(x2 * plan.scale_x))),
        min(plan.working_height, max(0, round(y2 * plan.scale_y))),
    )


class WorkingResolutionOCRTests(_DedupIsolatedTestCase):
    PAGE_SIZE = (4600, 8000)

    def _page(self) -> Image.Image:
        return Image.new("RGB", self.PAGE_SIZE, (200, 200, 200))

    def _seeds(self) -> tuple[OCRSeed, ...]:
        return (
            _seed_at("r1", [0, 0, 2000, 3000]),
            _seed_at("r2", [1000, 2000, 3000, 5000]),
        )

    async def _run_arm(
        self,
        *,
        enabled: bool,
        page: Image.Image,
        seeds: tuple[OCRSeed, ...],
        cache: _FakeCache,
        batches: list[_EngineBatch],
        store_dir: Path,
    ) -> CachedOcrResult:
        config = _policy_config(enabled=enabled, megapixels=24.0)
        arm_store = StageStore(store_dir / "stage-store.sqlite3")

        def _resolve_store() -> StageStore:
            return arm_store

        async def _recognize(**kwargs: object) -> list[OCRTextResult]:
            image = kwargs["image"]
            assert isinstance(image, Image.Image)
            regions = kwargs["regions"]
            batches.append((image.size, [region.bbox for region in regions]))
            return [
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text=f"text-{region.id}",
                    score=0.9,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key="fake-ocr",
                )
                for region in regions
            ]

        try:
            with (
                patch("pipelines.ocr_stage.get_config", lambda: config),
                patch("pipelines.ocr_stage.recognize_with_fallbacks", _recognize),
                patch(
                    "pipelines.ocr_stage.enrich_ocr_record_with_gradient",
                    lambda image, record: _mark_enriched(record),
                ),
                patch("pipelines.ocr_stage.get_stage_store", _resolve_store),
            ):
                return await run_cached_ocr(
                    _large_request(seeds, cache, page),
                    cache=cache,
                    resolve_engine=lambda **_: _FakeEngine(),
                )
        finally:
            arm_store.close()

    async def test_flag_on_downscales_engine_input_keeps_original_records(
        self,
    ) -> None:
        page = self._page()
        seeds = self._seeds()
        plan = stage_resolution_plan("ocr", *self.PAGE_SIZE, 24.0)
        self.assertTrue(plan.downscaled)

        on_cache = _FakeCache()
        on_batches: list[_EngineBatch] = []
        with tempfile.TemporaryDirectory() as tmp:
            on_result = await self._run_arm(
                enabled=True,
                page=page,
                seeds=seeds,
                cache=on_cache,
                batches=on_batches,
                store_dir=Path(tmp) / "on",
            )
        self.assertEqual(on_batches[0][0], (plan.working_width, plan.working_height))
        self.assertEqual(
            on_batches[0][1],
            [_expected_working_bbox(list(seed["bbox"]), plan) for seed in seeds],
        )

        get_ocr_region_dedup_cache.cache_clear()

        off_cache = _FakeCache()
        off_batches: list[_EngineBatch] = []
        with tempfile.TemporaryDirectory() as tmp:
            off_result = await self._run_arm(
                enabled=False,
                page=page,
                seeds=seeds,
                cache=off_cache,
                batches=off_batches,
                store_dir=Path(tmp) / "off",
            )
        self.assertEqual(off_batches[0][0], self.PAGE_SIZE)
        self.assertEqual(off_batches[0][1], [tuple(seed["bbox"]) for seed in seeds])

        off_by_id = {record["id"]: record for record in off_result.records}
        for record in on_result.records:
            baseline = off_by_id[record["id"]]
            for got, want in zip(record["bbox"], baseline["bbox"]):
                self.assertLessEqual(abs(got - want), 1)
            self.assertEqual(record["text"], baseline["text"])
            self.assertEqual(record["score"], baseline["score"])
        self.assertEqual(on_cache.built_keys, off_cache.built_keys)
        self.assertEqual(len(on_cache.cache_calls), 1)
        for cached in on_cache.cache_calls[0]:
            baseline = off_by_id[cached["id"]]
            for got, want in zip(cached["bbox"], baseline["bbox"]):
                self.assertLessEqual(abs(got - want), 1)

    async def test_flag_off_keeps_full_resolution_path(self) -> None:
        page = self._page()
        seeds = self._seeds()
        cache = _FakeCache()
        batches: list[_EngineBatch] = []
        with tempfile.TemporaryDirectory() as tmp:
            result = await self._run_arm(
                enabled=False,
                page=page,
                seeds=seeds,
                cache=cache,
                batches=batches,
                store_dir=Path(tmp) / "off",
            )

        self.assertEqual(batches[0][0], self.PAGE_SIZE)
        self.assertEqual(batches[0][1], [tuple(seed["bbox"]) for seed in seeds])
        by_id = {record["id"]: record for record in result.records}
        for seed in seeds:
            self.assertEqual(by_id[seed["id"]]["bbox"], seed["bbox"])


if __name__ == "__main__":
    unittest.main()
