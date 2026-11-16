"""Unit tests for the persistent segment/clean stage store (no stage wiring)."""

from __future__ import annotations

import base64
import logging
import sqlite3
import sys
import zlib
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
from pipelines.stage_payload_codec import decode_payload, encode_payload  # noqa: E402
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
    base = fingerprint_clean_settings(
        fields, working_megapixels=24.0, ocr_clean_enabled=False
    )
    assert (
        fingerprint_clean_settings(
            dict(fields), working_megapixels=24.0, ocr_clean_enabled=False
        )
        == base
    )
    for field, value in (
        ("model_key", "aot"),
        ("mask_dilation", 2),
        ("hd_strategy", "crop"),
        ("hd_strategy_resize_limit", 512),
        ("hd_strategy_crop_margin", 256),
        ("hd_strategy_crop_trigger_size", 1024),
    ):
        assert (
            fingerprint_clean_settings(
                {**fields, field: value},
                working_megapixels=24.0,
                ocr_clean_enabled=False,
            )
            != base
        )
    # The working-resolution policy participates in the fingerprint.
    assert (
        fingerprint_clean_settings(
            fields, working_megapixels=12.0, ocr_clean_enabled=False
        )
        != base
    )
    assert (
        fingerprint_clean_settings(
            fields, working_megapixels=24.0, ocr_clean_enabled=True
        )
        != base
    )


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
        raw.execute("PRAGMA user_version = 99")
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


def test_payload_codec_contract() -> None:
    text = '{"id":"r1","bbox":[0,0,8,8]}'
    encoded = encode_payload(text)
    assert encoded.startswith(b"KZ1")
    assert decode_payload(encoded) == text
    # Legacy str rows (v1 plain canonical JSON) pass through unchanged.
    assert decode_payload(text) == text
    # Neither str nor bytes -> miss.
    assert decode_payload(None) is None
    assert decode_payload(123) is None
    assert decode_payload([b"KZ1"]) is None
    # Corrupt/truncated containers are misses, never exceptions.
    assert decode_payload(b"KZ1not-zlib") is None
    assert decode_payload(b"KZ1" + zlib.compress(text.encode("utf-8"))[:4]) is None


def test_decode_payload_bound_rejects_oversized_expansion() -> None:
    # ~33 MiB of repetitive text compresses to a few KiB, so the compressed
    # row fits every store bound — but its expansion exceeds the
    # decompression cap and must be a miss, never a full in-RAM expansion.
    huge_text = "0123456789" * ((32 << 20) // 10 + 100)
    encoded = encode_payload(huge_text)
    assert len(encoded) < 1 << 20
    assert decode_payload(encoded) is None


def test_detect_and_ocr_round_trip(tmp_path: Path) -> None:
    store = _store(tmp_path)
    try:
        detect_records: list[dict[str, object]] = [{"id": "d1", "bbox": [1, 2, 3, 4]}]
        assert store.get_detect("k1") is None
        assert store.put_detect(key="k1", records=detect_records, model_used="det") is True
        detect_hit = store.get_detect("k1")
        assert detect_hit is not None
        assert detect_hit.model_used == "det"
        assert detect_hit.records == detect_records

        first: dict[str, dict[str, object]] = {"b1": {"text": "ド", "score": 0.9}}
        assert store.get_ocr("k1") is None
        assert store.merge_ocr(key="k1", blocks=first) is True
        assert store.get_ocr("k1") == first
        assert store.merge_ocr(key="k1", blocks={"b2": {"text": "カ", "score": 0.8}}) is True
        assert store.get_ocr("k1") == {
            "b1": {"text": "ド", "score": 0.9},
            "b2": {"text": "カ", "score": 0.8},
        }
    finally:
        store.close()


def test_merge_ocr_warns_and_overwrites_undecodable_row(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    db_path = tmp_path / "stage-store.sqlite3"
    raw = sqlite3.connect(str(db_path))
    try:
        raw.executescript(stage_store_module._SCHEMA_SQL)
        raw.execute(
            "INSERT INTO ocr_cache (key, payload) VALUES (?, ?)", ("o1", b"KZ1not-zlib")
        )
        raw.commit()
    finally:
        raw.close()
    blocks: dict[str, dict[str, object]] = {"b1": {"text": "ド", "score": 0.9}}
    store = StageStore(db_path)
    try:
        with caplog.at_level(logging.WARNING, logger="pipelines.stage_store"):
            assert store.merge_ocr(key="o1", blocks=blocks) is True
        records = [
            record
            for record in caplog.records
            if record.getMessage() == "stage_store.ocr_payload_undecodable"
        ]
        assert len(records) == 1
        assert records[0].key == "o1"
        assert store.get_ocr("o1") == blocks
    finally:
        store.close()


def test_legacy_plain_json_rows_are_readable(tmp_path: Path) -> None:
    db_path = tmp_path / "stage-store.sqlite3"
    raw = sqlite3.connect(str(db_path))
    try:
        raw.executescript(stage_store_module._SCHEMA_SQL)
        raw.execute("PRAGMA user_version = 1")
        raw.execute(
            "INSERT INTO segment_cache (key, payload, engine_key) VALUES (?, ?, ?)",
            ("s1", stage_store_module._canonical_json(_segment_records()), "seg"),
        )
        raw.execute(
            "INSERT INTO detect_cache (key, payload, model_used) VALUES (?, ?, ?)",
            (
                "d1",
                stage_store_module._canonical_json([{"id": "d1", "bbox": [1, 2, 3, 4]}]),
                "det",
            ),
        )
        raw.execute(
            "INSERT INTO ocr_cache (key, payload) VALUES (?, ?)",
            ("o1", stage_store_module._canonical_json({"b1": {"text": "ド", "score": 0.9}})),
        )
        raw.commit()
    finally:
        raw.close()
    store = StageStore(db_path)
    try:
        segment_hit = store.get_segment("s1")
        assert segment_hit is not None
        assert segment_hit.engine_key == "seg"
        assert segment_hit.records == _segment_records()
        detect_hit = store.get_detect("d1")
        assert detect_hit is not None
        assert detect_hit.model_used == "det"
        assert detect_hit.records == [{"id": "d1", "bbox": [1, 2, 3, 4]}]
        assert store.get_ocr("o1") == {"b1": {"text": "ド", "score": 0.9}}
    finally:
        store.close()


def _read_user_version(db_path: Path) -> int:
    raw = sqlite3.connect(str(db_path))
    try:
        row = raw.execute("PRAGMA user_version").fetchone()
    finally:
        raw.close()
    assert row is not None
    return int(row[0])


def test_fresh_db_stamps_v2_and_v1_fixture_opens(tmp_path: Path) -> None:
    fresh_path = tmp_path / "fresh.sqlite3"
    store = StageStore(fresh_path)
    store.close()
    assert _read_user_version(fresh_path) == 2

    # A v1 fixture opens without StageStoreError and keeps its stored
    # version (no forced rewrite).
    v1_path = tmp_path / "v1.sqlite3"
    raw = sqlite3.connect(str(v1_path))
    try:
        raw.executescript(stage_store_module._SCHEMA_SQL)
        raw.execute("PRAGMA user_version = 1")
        raw.commit()
    finally:
        raw.close()
    store = StageStore(v1_path)
    try:
        assert store.get_segment("missing") is None
    finally:
        store.close()
    assert _read_user_version(v1_path) == 1


def test_corrupt_compressed_rows_are_misses(tmp_path: Path) -> None:
    valid_compressed = zlib.compress(
        stage_store_module._canonical_json([{"id": "x"}]).encode("utf-8")
    )
    db_path = tmp_path / "stage-store.sqlite3"
    raw = sqlite3.connect(str(db_path))
    try:
        raw.executescript(stage_store_module._SCHEMA_SQL)
        raw.execute(
            "INSERT INTO segment_cache (key, payload, engine_key) VALUES (?, ?, ?)",
            ("s1", b"KZ1not-zlib", "seg"),
        )
        raw.execute(
            "INSERT INTO segment_cache (key, payload, engine_key) VALUES (?, ?, ?)",
            ("s2", b"\x00\x01garbage-without-magic", "seg"),
        )
        raw.execute(
            "INSERT INTO segment_cache (key, payload, engine_key) VALUES (?, ?, ?)",
            ("s3", b"KZ1" + valid_compressed[:4], "seg"),
        )
        raw.execute(
            "INSERT INTO detect_cache (key, payload, model_used) VALUES (?, ?, ?)",
            ("d1", b"KZ1not-zlib", "det"),
        )
        raw.execute(
            "INSERT INTO ocr_cache (key, payload) VALUES (?, ?)", ("o1", b"KZ1not-zlib")
        )
        raw.commit()
    finally:
        raw.close()
    store = StageStore(db_path)
    try:
        for key in ("s1", "s2", "s3"):
            assert store.get_segment(key) is None
        assert store.get_detect("d1") is None
        assert store.get_ocr("o1") is None
    finally:
        store.close()


def _mask_heavy_segment_records() -> list[dict[str, object]]:
    """Segment records whose base64 masks dominate the JSON size (>100 KiB).

    The mask bytes alternate long background runs with short bursts,
    mirroring real sparse masks, so the payload compresses far below half.
    """
    records: list[dict[str, object]] = []
    for index in range(8):
        mask_run = (b"\x00" * 4096 + b"\xff" * 256) * 7
        records.append(
            {
                "id": f"r{index}",
                "bbox": [0, index * 100, 1024, 100],
                "segment_boxes": [[0, index * 100, 1024, 100]],
                "source": "model",
                "mask_base64": base64.b64encode(mask_run).decode("ascii"),
            }
        )
    return records


def test_compression_efficacy_and_usage(tmp_path: Path) -> None:
    records = _mask_heavy_segment_records()
    canonical = stage_store_module._canonical_json(list(records))
    json_bytes = len(canonical.encode("utf-8"))
    assert json_bytes > 100 * 1024

    db_path = tmp_path / "stage-store.sqlite3"
    store = StageStore(db_path)
    try:
        assert store.put_segment(key="k1", records=records, engine_key="seg") is True
        segment_usage = store.usage().tables["segment_cache"]
    finally:
        store.close()

    raw = sqlite3.connect(str(db_path))
    try:
        row = raw.execute(
            "SELECT payload FROM segment_cache WHERE key = ?", ("k1",)
        ).fetchone()
    finally:
        raw.close()
    assert row is not None
    stored = row[0]
    assert isinstance(stored, bytes)  # v2 rows are BLOBs in the TEXT column
    assert stored.startswith(b"KZ1")
    assert len(stored) < json_bytes * 0.5

    # cache_usage verification: SQL LENGTH(payload) returns the byte length
    # for BLOB values, so usage() accounts compressed rows correctly.
    assert segment_usage.row_count == 1
    assert segment_usage.logical_bytes == len(stored)

    reopened = StageStore(db_path)
    try:
        hit = reopened.get_segment("k1")
        assert hit is not None
        assert hit.engine_key == "seg"
        assert hit.records == records
    finally:
        reopened.close()


def test_max_entry_bytes_enforced_against_compressed_size(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Compressed size above the cap: skipped on every payload write path.
    monkeypatch.setattr(stage_store_module, "_MAX_ENTRY_BYTES", 16)
    noisy = [
        {"id": "r1", "mask_base64": base64.b64encode(bytes(range(256))).decode("ascii")}
    ]
    store = _store(tmp_path)
    try:
        assert store.put_segment(key="s1", records=noisy, engine_key="seg") is False
        assert store.put_detect(key="d1", records=noisy, model_used="det") is False
        assert store.merge_ocr(key="o1", blocks={"b1": {"text": "ド", "score": 0.9}}) is False
        assert store.get_segment("s1") is None
        assert store.get_detect("d1") is None
        assert store.get_ocr("o1") is None
    finally:
        store.close()

    # Compressed size below the cap: stored although the plain JSON itself
    # exceeds the cap (the bound applies to the stored bytes, not the text).
    monkeypatch.setattr(stage_store_module, "_MAX_ENTRY_BYTES", 256)
    long_run = [
        {"id": "r1", "mask_base64": base64.b64encode(b"\x00" * 4096).decode("ascii")}
    ]
    store = _store(tmp_path / "below-cap")
    try:
        assert store.put_segment(key="s2", records=long_run, engine_key="seg") is True
        hit = store.get_segment("s2")
        assert hit is not None
        assert hit.records == long_run
    finally:
        store.close()
