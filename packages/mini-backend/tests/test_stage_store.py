"""Unit tests for the persistent segment/clean stage store (no stage wiring)."""

from __future__ import annotations

import sqlite3
import sys
from concurrent.futures import ThreadPoolExecutor
from itertools import count
from pathlib import Path

import numpy as np
import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from pipelines import stage_store as stage_store_module  # noqa: E402
from pipelines.cache_manager import _hash_image_bytes  # noqa: E402
from pipelines.stage_store import (  # noqa: E402
    CleanCacheHit,
    StageStore,
    StageStoreError,
    build_clean_cache_key,
    build_segment_cache_key,
    close_stage_store,
    fingerprint_clean_settings,
    fingerprint_mask_regions,
    fingerprint_seeds,
    get_stage_store,
    hash_image_array,
    hash_image_bytes,
)
from utils.mask import MaskRegion  # noqa: E402


def _store(tmp_path: Path) -> StageStore:
    return StageStore(tmp_path / "stage-store.sqlite3")


def _segment_records() -> list[dict[str, object]]:
    return [
        {
            "id": "r1",
            "bbox": [0, 0, 8, 8],
            "segment_boxes": [[0, 0, 8, 8]],
            "merged_boxes": [[0, 0, 8, 8]],
            "source": "model",
            "detector_model_key": "det",
            "ocr_model_key": "ocr",
            "translator_model_key": "tr",
            "segment_model_key": "seg",
            "mask_base64": None,
        }
    ]


def _monotonic_time(monkeypatch: pytest.MonkeyPatch, start: int = 1) -> None:
    tick = count(start)
    monkeypatch.setattr(stage_store_module.time, "time", lambda: float(next(tick)))


def test_hash_image_bytes_matches_cache_manager_doctrine() -> None:
    payload = b"fixture-bytes"
    assert hash_image_bytes(payload) == _hash_image_bytes(payload)
    assert len(hash_image_bytes(payload)) == 64


def test_hash_image_array_is_stable_and_sensitive() -> None:
    rgb = np.zeros((4, 6, 3), dtype=np.uint8)
    first = hash_image_array(rgb)
    assert hash_image_array(rgb.copy()) == first
    assert hash_image_array(np.ones((4, 6, 3), dtype=np.uint8)) != first
    # Shape is part of the payload: same byte stream, different shape.
    assert hash_image_array(np.zeros((6, 4, 3), dtype=np.uint8)) != first


def test_segment_key_stability_and_sensitivity() -> None:
    kwargs: dict[str, str] = {
        "image_hash": "aa",
        "model_key": "m",
        "seeds_fingerprint": "sf",
    }
    base = build_segment_cache_key(**kwargs)
    assert build_segment_cache_key(**kwargs) == base
    for field, value in (
        ("image_hash", "bb"),
        ("model_key", "m2"),
        ("seeds_fingerprint", "sf2"),
    ):
        assert build_segment_cache_key(**{**kwargs, field: value}) != base


def test_clean_key_stability_and_sensitivity() -> None:
    kwargs: dict[str, str] = {
        "image_hash": "aa",
        "mask_fingerprint": "mf",
        "settings_fingerprint": "sf",
        "default_detection_model": "det",
    }
    base = build_clean_cache_key(**kwargs)
    assert build_clean_cache_key(**kwargs) == base
    for field, value in (
        ("image_hash", "bb"),
        ("mask_fingerprint", "mf2"),
        ("settings_fingerprint", "sf2"),
        ("default_detection_model", "det2"),
    ):
        assert build_clean_cache_key(**{**kwargs, field: value}) != base


def test_fingerprint_seeds_stable_and_sensitive() -> None:
    seeds = [{"id": "r1", "bbox": [0, 0, 1, 1], "source": "model"}]
    assert fingerprint_seeds(seeds) == fingerprint_seeds(list(seeds))
    # Canonical JSON: key order inside a seed dict does not matter.
    reordered = [{"source": "model", "bbox": [0, 0, 1, 1], "id": "r1"}]
    assert fingerprint_seeds(reordered) == fingerprint_seeds(seeds)
    # Any field change (and region order) changes the fingerprint.
    assert fingerprint_seeds([{**seeds[0], "bbox": [0, 0, 1, 2]}]) != fingerprint_seeds(seeds)
    assert fingerprint_seeds([{**seeds[0], "source": "manual"}]) != fingerprint_seeds(seeds)
    assert fingerprint_seeds([seeds[0], seeds[0]]) != fingerprint_seeds(seeds)


def test_fingerprint_mask_regions_stable_and_sensitive() -> None:
    regions = [MaskRegion(bbox=(0, 0, 8, 8), segment_boxes=((0, 0, 4, 4),))]
    assert fingerprint_mask_regions(regions) == fingerprint_mask_regions(list(regions))
    assert fingerprint_mask_regions([MaskRegion(bbox=(0, 0, 8, 9))]) != fingerprint_mask_regions(regions)
    assert fingerprint_mask_regions([MaskRegion(bbox=(0, 0, 8, 8))]) != fingerprint_mask_regions(regions)
    assert fingerprint_mask_regions([]) != fingerprint_mask_regions(regions)


def test_fingerprint_clean_settings_stable_and_sensitive() -> None:
    fields: dict[str, object] = {
        "model_key": None,
        "mask_dilation": 0,
        "hd_strategy": None,
        "hd_strategy_resize_limit": 960,
        "hd_strategy_crop_margin": 512,
        "hd_strategy_crop_trigger_size": 512,
    }
    assert fingerprint_clean_settings(fields) == fingerprint_clean_settings(dict(fields))
    for field, value in (
        ("model_key", "aot"),
        ("mask_dilation", 2),
        ("hd_strategy", "crop"),
        ("hd_strategy_resize_limit", 512),
        ("hd_strategy_crop_margin", 256),
        ("hd_strategy_crop_trigger_size", 1024),
    ):
        assert fingerprint_clean_settings({**fields, field: value}) != fingerprint_clean_settings(fields)


def test_segment_round_trip(tmp_path: Path) -> None:
    store = _store(tmp_path)
    try:
        records = _segment_records()
        assert store.get_segment("k1") is None
        assert store.put_segment(key="k1", records=records, engine_key="seg") is True
        hit = store.get_segment("k1")
        assert hit is not None
        assert hit.engine_key == "seg"
        assert hit.records == records
    finally:
        store.close()


def test_clean_round_trip(tmp_path: Path) -> None:
    store = _store(tmp_path)
    try:
        png = b"\x89PNG-fake-bytes"
        assert store.get_clean("k1") is None
        assert store.put_clean(key="k1", png=png, model_used="aot", hd_strategy="crop") is True
        assert store.get_clean("k1") == CleanCacheHit(
            model_used="aot", png=png, hd_strategy="crop"
        )
    finally:
        store.close()


def test_oversize_entries_are_skipped(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(stage_store_module, "_MAX_ENTRY_BYTES", 16)
    store = _store(tmp_path)
    try:
        assert store.put_clean(key="c1", png=b"x" * 17, model_used="aot", hd_strategy="crop") is False
        assert store.get_clean("c1") is None
        big_records = [{"id": "r1", "bbox": [0] * 20}]
        assert store.put_segment(key="s1", records=big_records, engine_key="seg") is False
        assert store.get_segment("s1") is None
    finally:
        store.close()


def test_prune_keeps_newest_rows_per_table(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _monotonic_time(monkeypatch)
    store = _store(tmp_path)
    try:
        for index in range(3):
            store.put_segment(key=f"s{index}", records=[{"id": f"s{index}"}], engine_key="seg")
            store.put_clean(key=f"c{index}", png=b"p", model_used="aot", hd_strategy="resize")
        removed = store.prune(max_rows=2, max_bytes=1 << 30)
        assert removed == 2
        assert store.get_segment("s0") is None
        assert store.get_segment("s1") is not None
        assert store.get_segment("s2") is not None
        assert store.get_clean("c0") is None
        assert store.get_clean("c1") is not None
        assert store.get_clean("c2") is not None
    finally:
        store.close()


def test_prune_keeps_clean_bytes_under_bound(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    _monotonic_time(monkeypatch)
    store = _store(tmp_path)
    try:
        store.put_segment(key="s0", records=[{"id": "s0"}], engine_key="seg")
        for index in range(3):
            store.put_clean(key=f"c{index}", png=b"x" * 100, model_used="aot", hd_strategy="resize")
        removed = store.prune(max_rows=100, max_bytes=150)
        # Oldest-first deletion: c2 (100) stays, c1 (200) and c0 (300) go.
        assert removed == 2
        assert store.get_clean("c0") is None
        assert store.get_clean("c1") is None
        assert store.get_clean("c2") is not None
        # The byte bound is a clean-PNG bound: segment rows are untouched.
        assert store.get_segment("s0") is not None
    finally:
        store.close()


def test_foreign_user_version_raises_typed_error(tmp_path: Path) -> None:
    db_path = tmp_path / "stage-store.sqlite3"
    raw = sqlite3.connect(str(db_path))
    try:
        raw.execute("PRAGMA user_version = 7")
        raw.commit()
    finally:
        raw.close()
    with pytest.raises(StageStoreError):
        StageStore(db_path)


def test_concurrent_access_smoke(tmp_path: Path) -> None:
    store = _store(tmp_path)
    try:

        def worker(index: int) -> str:
            key = f"k{index}"
            assert store.put_segment(key=key, records=[{"id": key}], engine_key="seg") is True
            hit = store.get_segment(key)
            assert hit is not None
            assert hit.records[0]["id"] == key
            return key

        with ThreadPoolExecutor(max_workers=2) as pool:
            assert list(pool.map(worker, range(2))) == ["k0", "k1"]
    finally:
        store.close()


def test_get_stage_store_singleton_and_close(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KOMA_APP_DATA_DIR", str(tmp_path))
    stage_store_module.get_stage_store.cache_clear()
    try:
        first = get_stage_store()
        assert get_stage_store() is first
        assert (tmp_path / "stage-store.sqlite3").exists()
        assert first.get_segment("missing") is None
        close_stage_store()
        close_stage_store()  # already closed: no-op
        reopened = get_stage_store()
        assert reopened is not first
    finally:
        stage_store_module.get_stage_store.cache_clear()
