"""Unit tests for the OCR region dedup layer: crop hashing, key folding,
TTL/LRU bounds and record-ownership deep copies."""

from __future__ import annotations

from pathlib import Path
import sys
import time
import unittest
from unittest.mock import patch

import numpy as np

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import get_config  # noqa: E402
from models.ocr.base_ocr import RgbArray  # noqa: E402
from pipelines.batch.records import OCRRecord  # noqa: E402
from pipelines.ocr_region_dedup import (  # noqa: E402
    OcrRegionDedupCache,
    build_dedup_key,
    compute_crop_hash,
    get_ocr_region_dedup_cache,
)


def _key(
    crop_hash: str,
    *,
    language: str = "ja",
    model_key: str = "fake-ocr",
    width: int = 10,
    height: int = 10,
) -> str:
    return build_dedup_key(
        language=language,
        model_key=model_key,
        bbox_width=width,
        bbox_height=height,
        crop_hash=crop_hash,
    )


def _record(record_id: str, text: str = "gomu") -> OCRRecord:
    return {
        "id": record_id,
        "bbox": [0, 0, 10, 10],
        "text": text,
        "score": 0.9,
        "source": "model",
        "detector_model_key": "det",
        "ocr_model_key": "fake-ocr",
    }


class ComputeCropHashTests(unittest.TestCase):
    def test_hash_is_deterministic_and_content_sensitive(self) -> None:
        rgb: RgbArray = np.zeros((24, 24, 3), dtype=np.uint8)
        first = compute_crop_hash(rgb, (0, 0, 12, 12))
        self.assertEqual(first, compute_crop_hash(rgb, (0, 0, 12, 12)))

        marked: RgbArray = np.zeros((24, 24, 3), dtype=np.uint8)
        marked[2:10, 2:10] = 255
        self.assertNotEqual(first, compute_crop_hash(marked, (0, 0, 12, 12)))


class BuildDedupKeyTests(unittest.TestCase):
    def test_identical_inputs_share_the_key(self) -> None:
        self.assertEqual(_key("ab" * 32), _key("ab" * 32))

    def test_different_crops_same_size_get_different_keys(self) -> None:
        self.assertNotEqual(_key("ab" * 32), _key("cd" * 32))

    def test_same_pixels_different_bbox_size_get_different_keys(self) -> None:
        # Resizing normalizes crops, so the native (w, h) folding is what
        # keeps different-sized renders from cross-matching.
        rgb: RgbArray = np.zeros((32, 32, 3), dtype=np.uint8)
        small = compute_crop_hash(rgb, (0, 0, 10, 10))
        large = compute_crop_hash(rgb, (0, 0, 20, 20))
        self.assertEqual(small, large)
        self.assertNotEqual(_key(small), _key(large, width=20, height=20))

    def test_language_and_model_key_participate(self) -> None:
        base = _key("ab" * 32)
        self.assertNotEqual(base, _key("ab" * 32, language="en"))
        self.assertNotEqual(base, _key("ab" * 32, model_key="other-ocr"))


class OcrRegionDedupCacheTests(unittest.TestCase):
    def test_lookup_miss_then_hit_with_deep_copy_ownership(self) -> None:
        cache = OcrRegionDedupCache(ttl_seconds=1800, max_entries=8)
        key = _key("ab" * 32)
        self.assertIsNone(cache.lookup(key))

        record = _record("stored")
        cache.store(key, [record])
        record["text"] = "tampered-by-caller"

        first = cache.lookup(key)
        self.assertIsNotNone(first)
        self.assertEqual(first[0]["text"], "gomu")
        first[0]["text"] = "tampered-by-lookup-side"

        second = cache.lookup(key)
        self.assertEqual(second[0]["text"], "gomu")
        self.assertEqual(second[0]["id"], "stored")
        stats = cache.stats()
        self.assertEqual((stats["hits"], stats["misses"]), (2, 1))

    def test_store_ignores_empty_record_lists(self) -> None:
        cache = OcrRegionDedupCache(ttl_seconds=1800, max_entries=8)
        cache.store(_key("ab" * 32), [])
        self.assertEqual(cache.stats()["entries"], 0)
        self.assertIsNone(cache.lookup(_key("ab" * 32)))

    def test_lru_bound_evicts_oldest_entry(self) -> None:
        cache = OcrRegionDedupCache(ttl_seconds=1800, max_entries=2)
        oldest = _key("ab" * 32)
        cache.store(oldest, [_record("r0")])
        cache.store(_key("cd" * 32), [_record("r1")])
        cache.store(_key("ef" * 32), [_record("r2")])
        self.assertEqual(cache.stats()["entries"], 2)
        self.assertIsNone(cache.lookup(oldest))
        self.assertIsNotNone(cache.lookup(_key("ef" * 32)))

    def test_expired_entries_expire_by_ttl(self) -> None:
        cache = OcrRegionDedupCache(ttl_seconds=30, max_entries=8)
        key = _key("ab" * 32)
        cache.store(key, [_record("r0")])
        with patch("pipelines.cache_manager.time") as fake_time:
            fake_time.monotonic.return_value = time.monotonic() + 31
            self.assertIsNone(cache.lookup(key))
        self.assertEqual(cache.stats()["misses"], 1)
        self.assertEqual(cache.stats()["entries"], 0)


class SingletonAccessorTests(unittest.TestCase):
    def tearDown(self) -> None:
        get_ocr_region_dedup_cache.cache_clear()

    def test_accessor_returns_config_bound_singleton(self) -> None:
        first = get_ocr_region_dedup_cache()
        self.assertIs(first, get_ocr_region_dedup_cache())
        stats = first.stats()
        self.assertEqual(stats["max_entries"], 512)
        self.assertEqual(stats["ttl_seconds"], get_config().pipeline_cache_ttl_seconds)
        get_ocr_region_dedup_cache.cache_clear()
        self.assertIsNot(first, get_ocr_region_dedup_cache())


if __name__ == "__main__":
    unittest.main()
