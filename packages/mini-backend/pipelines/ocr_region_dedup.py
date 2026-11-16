"""Exact content-hash reuse of OCR region crops (repeated onomatopoeia).

``run_cached_ocr`` consults this cache between the page-level caches and the
engine: seeds whose raw crop pixels, crop size, language and OCR engine key
match a stored record reuse it. In-memory only, bounded TTL-LRU; no disk
tables and no wire-contract change.
"""

from __future__ import annotations

import hashlib
import json
import threading
from copy import deepcopy
from functools import cache
from typing import Final, TypedDict

from PIL import Image

from core.config import get_config
from models.ocr.base_ocr import RgbArray
from pipelines.batch.records import OCRRecord
from pipelines.cache_manager import _DEFAULT_MAX_BYTES, _TtlLruCache, _json_bytes

_DEDUP_SIDE_PX: Final = 64
_KEY_VERSION: Final = 1
_MAX_ENTRIES: Final = 512


class OcrRegionDedupStats(TypedDict):
    entries: int
    hits: int
    misses: int
    max_entries: int
    ttl_seconds: int


def compute_crop_hash(rgb: RgbArray, bbox: tuple[int, int, int, int]) -> str:
    """blake2b(32) over the raw seed crop, grayscaled and 64x64 BICUBIC-resized."""
    x1, y1, x2, y2 = bbox
    crop = Image.fromarray(rgb[y1:y2, x1:x2])
    normalized = crop.convert("L").resize(
        (_DEDUP_SIDE_PX, _DEDUP_SIDE_PX), Image.Resampling.BICUBIC
    )
    return hashlib.blake2b(normalized.tobytes(), digest_size=32).hexdigest()


def build_dedup_key(
    *,
    language: str,
    model_key: str,
    bbox_width: int,
    bbox_height: int,
    crop_hash: str,
) -> str:
    """Version-pinned sha256 over canonical JSON; (w, h) folding keeps
    different-sized renders of the same pixels from cross-matching."""
    payload: dict[str, object] = {
        "version": _KEY_VERSION,
        "language": language.strip().lower(),
        "model_key": model_key.strip(),
        "bbox_w": bbox_width,
        "bbox_h": bbox_height,
        "crop_hash": crop_hash,
    }
    canonical = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


class OcrRegionDedupCache:
    """Thread-safe exact-crop reuse cache; access serialized by this owner."""

    __slots__ = (
        "_cache",
        "_hits",
        "_lock",
        "_max_entries",
        "_misses",
        "_ttl_seconds",
    )

    def __init__(
        self,
        *,
        ttl_seconds: int,
        max_entries: int = _MAX_ENTRIES,
        max_bytes: int = _DEFAULT_MAX_BYTES,
    ) -> None:
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._cache: _TtlLruCache[list[OCRRecord]] = _TtlLruCache(
            ttl_seconds=ttl_seconds,
            max_entries=max_entries,
            max_bytes=max_bytes,
        )
        self._lock = threading.Lock()
        self._hits = 0
        self._misses = 0

    def lookup(self, key: str) -> list[OCRRecord] | None:
        with self._lock:
            records = self._cache.get(key)
            if records is None:
                self._misses += 1
                return None
            self._hits += 1
            return deepcopy(records)

    def store(self, key: str, records: list[OCRRecord]) -> None:
        if not records:
            return
        with self._lock:
            stored = deepcopy(records)
            self._cache.put(key, stored, size_bytes=len(_json_bytes(stored)))

    def stats(self) -> OcrRegionDedupStats:
        with self._lock:
            return OcrRegionDedupStats(
                entries=len(self._cache),
                hits=self._hits,
                misses=self._misses,
                max_entries=self._max_entries,
                ttl_seconds=self._ttl_seconds,
            )


@cache
def get_ocr_region_dedup_cache() -> OcrRegionDedupCache:
    """Process-wide dedup cache; tests reset via ``cache_clear()``."""
    config = get_config()
    return OcrRegionDedupCache(
        ttl_seconds=config.pipeline_cache_ttl_seconds,
        max_entries=_MAX_ENTRIES,
    )
