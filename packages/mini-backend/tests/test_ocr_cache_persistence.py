"""OCR disk-cache persistence: restart round-trips through the StageStore,
bbox re-matching from disk rows, merge atomicity, and the clear() doctrine.

Engine/cache fakes mirror ``tests/test_ocr_stage.py``; store-level cases
mirror ``tests/test_stage_store.py``.
"""

from __future__ import annotations

import sqlite3
import sys
from concurrent.futures import ThreadPoolExecutor
from itertools import count
from pathlib import Path

import pytest
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import get_config  # noqa: E402
from models.ocr.base_ocr import OCRTextResult  # noqa: E402
from pipelines import stage_store as stage_store_module  # noqa: E402
from pipelines.cache_manager import (  # noqa: E402
    CacheManager,
    match_ocr_blocks,
)
from pipelines.ocr_region_dedup import get_ocr_region_dedup_cache  # noqa: E402
from pipelines.ocr_stage import (  # noqa: E402
    CachedOcrRequest,
    run_cached_ocr,
)
from pipelines.batch.records import OCRSeed  # noqa: E402
from pipelines.stage_store import StageStore  # noqa: E402

_IMAGE_BYTES = b"ocr-persistence-image-bytes"


class _FakeEngine:
    def __init__(self, key: str = "fake-ocr") -> None:
        self.key = key


def _seed(seed_id: str, bbox: list[int]) -> OCRSeed:
    return OCRSeed(
        id=seed_id,
        bbox=bbox,
        source="model",
        detector_model_key="det",
    )


def _seeds() -> tuple[OCRSeed, ...]:
    return (_seed("r1", [0, 0, 10, 10]), _seed("r2", [20, 20, 30, 30]))


def _page() -> Image.Image:
    image = Image.new("RGB", (64, 64), "white")
    image.paste((30, 30, 30), (0, 0, 10, 10))
    return image


def _request() -> CachedOcrRequest:
    return CachedOcrRequest(
        image=_page(),
        image_bytes=_IMAGE_BYTES,
        language="en",
        model_key=None,
        has_gpu=False,
        seeds=_seeds(),
    )


def _new_cache() -> CacheManager:
    return CacheManager(ttl_seconds=1800, max_entries=16, bbox_tolerance_px=5.0)


def _config_key(cache: CacheManager) -> str:
    # Mirror run_cached_ocr: the key carries the working-resolution policy.
    config = get_config()
    return cache.build_ocr_cache_key(
        image_bytes=_IMAGE_BYTES,
        language="en",
        model_key="fake-ocr",
        working_mp=config.working_resolution_megapixels,
        ocr_clean_enabled=config.working_resolution_ocr_clean_enabled,
    )


def _patch_collaborators(
    monkeypatch: pytest.MonkeyPatch, recognize_calls: list[list[str]]
) -> None:
    from pipelines import ocr_stage as ocr_stage_module

    async def _fake_recognize(**kwargs: object) -> list[OCRTextResult]:
        regions = kwargs["regions"]
        recognize_calls.append([region.id for region in regions])
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

    def _mark_enriched(image: Image.Image, record: dict[str, object]) -> dict[str, object]:
        _ = image
        return {**record, "foreground_gradient": None}

    monkeypatch.setattr(ocr_stage_module, "recognize_with_fallbacks", _fake_recognize)
    monkeypatch.setattr(
        ocr_stage_module, "enrich_ocr_record_with_gradient", _mark_enriched
    )


def _fresh_singleton(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("KOMA_APP_DATA_DIR", str(tmp_path))
    stage_store_module.get_stage_store.cache_clear()
    get_ocr_region_dedup_cache.cache_clear()


def _store(tmp_path: Path) -> StageStore:
    return StageStore(tmp_path / "stage-store.sqlite3")


@pytest.mark.anyio
async def test_restart_round_trip_resolves_from_disk(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fresh_singleton(monkeypatch, tmp_path)
    recognize_calls: list[list[str]] = []
    _patch_collaborators(monkeypatch, recognize_calls)
    request = _request()

    first = await run_cached_ocr(
        request, cache=_new_cache(), resolve_engine=lambda **_: _FakeEngine()
    )
    assert recognize_calls == [["r1", "r2"]]

    # Force a NEW store/cache-manager view: reopen the sqlite file and drop
    # the in-memory cache — the actual "survives restart" property.
    stage_store_module.get_stage_store.cache_clear()
    get_ocr_region_dedup_cache.cache_clear()
    second = await run_cached_ocr(
        request, cache=_new_cache(), resolve_engine=lambda **_: _FakeEngine()
    )
    assert recognize_calls == [["r1", "r2"]]  # recognition never re-ran
    assert list(second.records) == list(first.records)


@pytest.mark.anyio
async def test_disk_rematch_within_and_beyond_tolerance(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fresh_singleton(monkeypatch, tmp_path)
    recognize_calls: list[list[str]] = []
    _patch_collaborators(monkeypatch, recognize_calls)

    await run_cached_ocr(
        _request(), cache=_new_cache(), resolve_engine=lambda **_: _FakeEngine()
    )
    stage_store_module.get_stage_store.cache_clear()
    get_ocr_region_dedup_cache.cache_clear()

    # Shift within the 5 px tolerance: disk hit, no recognition.
    shifted = CachedOcrRequest(
        image=_page(),
        image_bytes=_IMAGE_BYTES,
        language="en",
        model_key=None,
        has_gpu=False,
        seeds=(_seed("r1", [3, 0, 10, 10]),),
    )
    hit = await run_cached_ocr(
        shifted, cache=_new_cache(), resolve_engine=lambda **_: _FakeEngine()
    )
    assert recognize_calls == [["r1", "r2"]]
    assert hit.records[0]["id"] == "r1"
    assert hit.records[0]["text"] == "text-r1"
    assert hit.records[0]["bbox"] == [3, 0, 10, 10]

    # Shift beyond tolerance: miss, recognition runs for the seed.
    far = CachedOcrRequest(
        image=_page(),
        image_bytes=_IMAGE_BYTES,
        language="en",
        model_key=None,
        has_gpu=False,
        seeds=(_seed("r1", [40, 40, 55, 55]),),
    )
    miss = await run_cached_ocr(
        far, cache=_new_cache(), resolve_engine=lambda **_: _FakeEngine()
    )
    assert recognize_calls == [["r1", "r2"], ["r1"]]
    assert miss.records[0]["text"] == "text-r1"


def test_matcher_equidistant_blocks_are_ambiguous() -> None:
    blocks: dict[str, dict[str, object]] = {
        "8_10_30_30": {
            "id": "a",
            "bbox": [8, 10, 30, 30],
            "text": "left",
            "score": 0.9,
            "source": "model",
            "detector_model_key": "det",
            "ocr_model_key": "fake-ocr",
        },
        "12_10_30_30": {
            "id": "b",
            "bbox": [12, 10, 30, 30],
            "text": "right",
            "score": 0.9,
            "source": "model",
            "detector_model_key": "det",
            "ocr_model_key": "fake-ocr",
        },
    }
    seeds = [_seed("r1", [10, 10, 30, 30])]
    hits, misses = match_ocr_blocks(blocks, seeds, bbox_tolerance_px=5.0)
    assert hits == {}
    assert misses == seeds


@pytest.mark.anyio
async def test_blank_text_rows_never_reach_disk(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fresh_singleton(monkeypatch, tmp_path)
    from pipelines import ocr_stage as ocr_stage_module

    async def _fake_recognize(**kwargs: object) -> list[OCRTextResult]:
        regions = kwargs["regions"]
        return [
            OCRTextResult(
                id=region.id,
                bbox=region.bbox,
                text="" if region.id == "r1" else "kept",
                score=0.9,
                source=region.source,
                detector_model_key=region.detector_model_key,
                model_key="fake-ocr",
            )
            for region in regions
        ]

    def _mark_enriched(image: Image.Image, record: dict[str, object]) -> dict[str, object]:
        _ = image
        return {**record, "foreground_gradient": None}

    monkeypatch.setattr(ocr_stage_module, "recognize_with_fallbacks", _fake_recognize)
    monkeypatch.setattr(
        ocr_stage_module, "enrich_ocr_record_with_gradient", _mark_enriched
    )

    cache = _new_cache()
    await run_cached_ocr(_request(), cache=cache, resolve_engine=lambda **_: _FakeEngine())
    cache_key = _config_key(cache)
    store = stage_store_module.get_stage_store()
    try:
        blocks = store.get_ocr(cache_key)
        assert blocks is not None
        assert "0_0_10_10" not in blocks  # blank-text record excluded
        assert "20_20_30_30" in blocks
        assert blocks["20_20_30_30"]["text"] == "kept"
    finally:
        store.close()


def test_concurrent_merge_loses_no_blocks(tmp_path: Path) -> None:
    store = _store(tmp_path)
    try:
        key = "ocr::concurrent"

        def merge(index: int) -> bool:
            bbox = [index, index, index + 5, index + 5]
            return store.merge_ocr(
                key=key,
                blocks={
                    "_".join(str(v) for v in bbox): {
                        "id": f"r{index}",
                        "bbox": bbox,
                        "text": f"text-{index}",
                        "score": 0.9,
                        "source": "model",
                        "detector_model_key": "det",
                        "ocr_model_key": "fake-ocr",
                    }
                },
            )

        with ThreadPoolExecutor(max_workers=2) as pool:
            assert list(pool.map(merge, range(2))) == [True, True]

        blocks = store.get_ocr(key)
        assert blocks is not None
        assert sorted(blocks) == ["0_0_5_5", "1_1_6_6"]
    finally:
        store.close()


def test_oversize_merged_row_skipped_prior_row_preserved(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(stage_store_module, "_MAX_ENTRY_BYTES", 100_000)
    store = _store(tmp_path)
    try:
        key = "ocr::oversize"
        first_block = {
            "id": "r1",
            "bbox": [0, 0, 10, 10],
            "text": "first",
            "score": 0.9,
            "source": "model",
            "detector_model_key": "det",
            "ocr_model_key": "fake-ocr",
        }
        assert store.merge_ocr(key=key, blocks={"0_0_10_10": first_block}) is True

        monkeypatch.setattr(stage_store_module, "_MAX_ENTRY_BYTES", 16)
        big_block = dict(first_block, text="x" * 64)
        assert store.merge_ocr(key=key, blocks={"1_1_11_11": big_block}) is False

        blocks = store.get_ocr(key)
        assert blocks is not None
        assert list(blocks) == ["0_0_10_10"]
        assert blocks["0_0_10_10"]["text"] == "first"
    finally:
        store.close()


def test_prune_keeps_newest_rows_across_all_four_tables(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    tick = count(1)
    monkeypatch.setattr(stage_store_module.time, "time", lambda: float(next(tick)))
    store = _store(tmp_path)
    try:
        for index in range(3):
            store.put_segment(key=f"s{index}", records=[{"id": f"s{index}"}], engine_key="seg")
            store.put_clean(key=f"c{index}", png=b"p", model_used="aot", hd_strategy="resize")
            store.put_detect(key=f"d{index}", records=[], model_used="m")
            store.merge_ocr(
                key=f"ocr::{index}",
                blocks={
                    "0_0_1_1": {
                        "id": f"r{index}",
                        "bbox": [0, 0, 1, 1],
                        "text": "t",
                        "score": 0.9,
                        "source": "model",
                        "detector_model_key": "det",
                        "ocr_model_key": "fake-ocr",
                    }
                },
            )
        removed = store.prune(max_rows=2, max_bytes=1 << 30)
        assert removed == 4  # oldest row pruned from each rows-based table
        for getter, oldest in (
            (store.get_segment, "s0"),
            (store.get_clean, "c0"),
            (store.get_detect, "d0"),
        ):
            assert getter(oldest) is None
        assert store.get_ocr("ocr::0") is None
        assert store.get_segment("s1") is not None
        assert store.get_segment("s2") is not None
        assert store.get_clean("c1") is not None
        assert store.get_clean("c2") is not None
        assert store.get_detect("d1") is not None
        assert store.get_detect("d2") is not None
        assert store.get_ocr("ocr::1") is not None
        assert store.get_ocr("ocr::2") is not None
    finally:
        store.close()


@pytest.mark.anyio
async def test_payload_shape_tolerance_and_reenrichment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fresh_singleton(monkeypatch, tmp_path)
    from pipelines import ocr_stage as ocr_stage_module

    enrich_calls: list[str] = []

    def _mark_enriched(image: Image.Image, record: dict[str, object]) -> dict[str, object]:
        _ = image
        enrich_calls.append(str(record["id"]))
        return {**record, "foreground_gradient": None}

    async def _fail_recognize(**kwargs: object) -> list[OCRTextResult]:
        raise AssertionError("recognition must not run on a full disk hit")

    monkeypatch.setattr(ocr_stage_module, "recognize_with_fallbacks", _fail_recognize)
    monkeypatch.setattr(
        ocr_stage_module, "enrich_ocr_record_with_gradient", _mark_enriched
    )

    # A legacy-shaped disk row without foreground_gradient.
    cache_key = _config_key(_new_cache())
    store = _store(tmp_path)
    try:
        assert (
            store.merge_ocr(
                key=cache_key,
                blocks={
                    "0_0_10_10": {
                        "id": "r1",
                        "bbox": [0, 0, 10, 10],
                        "text": "text-r1",
                        "score": 0.9,
                        "source": "model",
                        "detector_model_key": "det",
                        "ocr_model_key": "fake-ocr",
                    }
                },
            )
            is True
        )
    finally:
        store.close()

    result = await run_cached_ocr(
        CachedOcrRequest(
            image=Image.new("RGB", (64, 64), "white"),
            image_bytes=_IMAGE_BYTES,
            language="en",
            model_key=None,
            has_gpu=False,
            seeds=(_seed("r1", [0, 0, 10, 10]),),
        ),
        cache=_new_cache(),
        resolve_engine=lambda **_: _FakeEngine(),
    )
    assert enrich_calls == ["r1"]  # merge() re-enriched the legacy row
    assert result.records[0]["foreground_gradient"] is None


@pytest.mark.anyio
async def test_cache_manager_clear_leaves_disk_intact(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _fresh_singleton(monkeypatch, tmp_path)
    recognize_calls: list[list[str]] = []
    _patch_collaborators(monkeypatch, recognize_calls)
    request = _request()
    cache = _new_cache()

    await run_cached_ocr(request, cache=cache, resolve_engine=lambda **_: _FakeEngine())
    cache.clear()  # memory-only: /memory/clear-caches doctrine
    store = _store(tmp_path)
    try:
        cache_key = _config_key(cache)
        assert store.get_ocr(cache_key) is not None  # disk untouched
    finally:
        store.close()

    stage_store_module.get_stage_store.cache_clear()
    again = await run_cached_ocr(
        request, cache=cache, resolve_engine=lambda **_: _FakeEngine()
    )
    assert recognize_calls == [["r1", "r2"]]  # resolved from disk, no re-run
    assert [record["text"] for record in again.records] == ["text-r1", "text-r2"]


def test_get_ocr_malformed_payload_returns_none(tmp_path: Path) -> None:
    store = _store(tmp_path)
    try:
        assert store.get_ocr("missing") is None
        store.merge_ocr(
            key="k1",
            blocks={
                "0_0_1_1": {
                    "id": "r1",
                    "bbox": [0, 0, 1, 1],
                    "text": "t",
                    "score": 0.9,
                    "source": "model",
                    "detector_model_key": "det",
                    "ocr_model_key": "fake-ocr",
                }
            },
        )
        raw = sqlite3.connect(str(tmp_path / "stage-store.sqlite3"))
        try:
            raw.execute("UPDATE ocr_cache SET payload = ? WHERE key = ?", ("not-json", "k1"))
            raw.commit()
        finally:
            raw.close()
        assert store.get_ocr("k1") is None
    finally:
        store.close()
