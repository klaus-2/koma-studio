"""TTL + LRU caches for OCR and translation results, shared by routers and
batch stages through ``get_pipeline_cache``.

Records are stored in their wire ``TypedDict`` shape, including the computed
``foreground_gradient``: a cache hit is served without re-running any pixel work.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import cache
from typing import TypedDict

from core.config import get_config
from pipelines.batch.records import (
    BBox,
    OCRRecord,
    OCRSeed,
    TranslationRecord,
    TranslationSeed,
    normalize_bbox,
)

logger = logging.getLogger(__name__)

_MIN_TTL_SECONDS = 30
_CUSTOM_LLM_ENDPOINT_KEYS = ("api_base", "apiBase", "base_url", "baseUrl")

type _OcrBlocks = dict[str, OCRRecord]  # keyed by bbox id
type _TranslationBlocks = dict[str, TranslationRecord]  # keyed by region id


class CacheManagerStats(TypedDict):
    entries: int
    ttl_seconds: int
    max_entries: int


@dataclass(slots=True)
class _Entry[V]:
    expires_at: float
    value: V


class _TtlLruCache[V]:
    """Monotonic-clock TTL over an LRU. Not thread-safe: ``CacheManager`` serialises access."""

    __slots__ = ("_entries", "_max_entries", "_ttl_seconds")

    def __init__(self, *, ttl_seconds: int, max_entries: int) -> None:
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._entries: OrderedDict[str, _Entry[V]] = OrderedDict()

    def __len__(self) -> int:
        return len(self._entries)

    def get(self, key: str) -> V | None:
        entry = self._entries.get(key)
        if entry is None:
            return None
        if entry.expires_at <= time.monotonic():
            del self._entries[key]
            return None
        self._entries.move_to_end(key)
        return entry.value

    def put(self, key: str, value: V) -> None:
        now = time.monotonic()
        self._entries[key] = _Entry(expires_at=now + self._ttl_seconds, value=value)
        self._entries.move_to_end(key)
        for expired in [k for k, e in self._entries.items() if e.expires_at <= now]:
            del self._entries[expired]
        while len(self._entries) > self._max_entries:
            self._entries.popitem(last=False)

    def clear(self) -> None:
        self._entries.clear()


def _hash_image_bytes(image_bytes: bytes) -> str:
    if not image_bytes:
        return "empty-image"
    # Full-content digest: sampling let two different pages collide and serve
    # each other's OCR. blake2b over a 10 MB scan is ~10 ms.
    return hashlib.blake2b(image_bytes, digest_size=32).hexdigest()


def _stable_hash(payload: Mapping[str, object]) -> str:
    encoded = json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _non_sensitive_custom_llm(custom_llm: Mapping[str, object] | None) -> dict[str, str]:
    """Only endpoint + model name enter the key; API keys never do."""
    if custom_llm is None:
        return {}
    endpoint = next(
        (str(custom_llm[k]).strip() for k in _CUSTOM_LLM_ENDPOINT_KEYS if custom_llm.get(k)),
        "",
    )
    return {"api_base": endpoint, "model": str(custom_llm.get("model") or "").strip()}


def _bbox_id(bbox: BBox) -> str:
    return f"{bbox[0]}_{bbox[1]}_{bbox[2]}_{bbox[3]}"


class CacheManager:
    __slots__ = (
        "_lock",
        "_ocr",
        "_translation",
        "bbox_tolerance_px",
        "max_entries",
        "ttl_seconds",
    )

    def __init__(
        self, *, ttl_seconds: int, max_entries: int, bbox_tolerance_px: float = 5.0
    ) -> None:
        self.ttl_seconds = max(_MIN_TTL_SECONDS, ttl_seconds)
        self.max_entries = max(1, max_entries)
        self.bbox_tolerance_px = max(0.0, bbox_tolerance_px)
        self._ocr: _TtlLruCache[_OcrBlocks] = _TtlLruCache(
            ttl_seconds=self.ttl_seconds, max_entries=self.max_entries
        )
        self._translation: _TtlLruCache[_TranslationBlocks] = _TtlLruCache(
            ttl_seconds=self.ttl_seconds, max_entries=self.max_entries
        )
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ keys

    def build_ocr_cache_key(
        self, *, image_bytes: bytes, language: str, model_key: str, namespace: str = ""
    ) -> str:
        payload = {
            "namespace": namespace.strip(),
            "language": language.strip().lower(),
            "model_key": model_key.strip().lower(),
            "image_hash": _hash_image_bytes(image_bytes),
        }
        return f"ocr::{_stable_hash(payload)}"

    def build_translation_cache_key(
        self,
        *,
        model_key: str,
        source_language: str,
        target_language: str,
        extra_context: str,
        llm_settings: Mapping[str, object] | None = None,
        custom_llm: Mapping[str, object] | None = None,
        namespace: str = "",
        translation_mode: str = "default",
    ) -> str:
        payload = {
            "namespace": namespace.strip(),
            "model_key": model_key.strip().lower(),
            "source_language": source_language.strip().lower(),
            "target_language": target_language.strip().lower(),
            "extra_context": extra_context.strip(),
            "translation_mode": (translation_mode or "default").strip().lower(),
            "llm_settings": dict(llm_settings) if llm_settings else {},
            "custom_llm": _non_sensitive_custom_llm(custom_llm),
        }
        return f"translation::{_stable_hash(payload)}"

    # ------------------------------------------------------------------- ocr

    def get_cached_ocr_for_regions(
        self, cache_key: str, seeds: Sequence[OCRSeed]
    ) -> tuple[dict[str, OCRRecord], list[OCRSeed]]:
        with self._lock:
            blocks = self._ocr.get(cache_key)
            if blocks is None:
                return {}, list(seeds)
            hits: dict[str, OCRRecord] = {}
            misses: list[OCRSeed] = []
            for seed in seeds:
                block = self._match_ocr_block(blocks, seed)
                if block is None:
                    misses.append(seed)
                    continue
                hit = block.copy()
                hit["id"] = seed["id"]
                hit["bbox"] = list(seed["bbox"])
                hits[seed["id"]] = hit
            return hits, misses

    def cache_ocr_results(self, cache_key: str, records: Sequence[OCRRecord]) -> int:
        stored = 0
        with self._lock:
            blocks = self._ocr.get(cache_key) or {}
            for record in records:
                bbox = normalize_bbox(record["bbox"])
                # Blank text is not cached so a later pass can still recover it.
                if bbox is None or not record["text"].strip():
                    continue
                blocks[_bbox_id(bbox)] = record.copy()
                stored += 1
            if blocks:
                self._ocr.put(cache_key, blocks)
        if stored:
            logger.info("ocr results cached", extra={"blocks": stored})
        return stored

    def _match_ocr_block(self, blocks: _OcrBlocks, seed: OCRSeed) -> OCRRecord | None:
        target = normalize_bbox(seed["bbox"])
        if target is None:
            return None
        exact = blocks.get(_bbox_id(target))
        if exact is not None:
            return exact
        tolerance = self.bbox_tolerance_px
        for block in blocks.values():
            cached = normalize_bbox(block["bbox"])
            if cached is not None and all(
                abs(a - b) <= tolerance for a, b in zip(target, cached, strict=True)
            ):
                return block
        return None

    # ----------------------------------------------------------- translation

    def get_cached_translations_for_regions(
        self, cache_key: str, seeds: Sequence[TranslationSeed]
    ) -> tuple[dict[str, TranslationRecord], list[TranslationSeed]]:
        with self._lock:
            blocks = self._translation.get(cache_key)
            if blocks is None:
                return {}, list(seeds)
            hits: dict[str, TranslationRecord] = {}
            misses: list[TranslationSeed] = []
            for seed in seeds:
                cached = blocks.get(seed["id"])
                if cached is None or cached["source_text"] != seed["text"].strip():
                    misses.append(seed)
                    continue
                hits[seed["id"]] = cached.copy()
            return hits, misses

    def cache_translation_results(
        self, cache_key: str, records: Sequence[TranslationRecord]
    ) -> int:
        stored = 0
        with self._lock:
            blocks = self._translation.get(cache_key) or {}
            for record in records:
                region_id = record["id"].strip()
                if not region_id or not record["translated_text"].strip():
                    continue
                normalized = record.copy()
                normalized["source_text"] = record["source_text"].strip()
                normalized["translation_notes"] = [
                    note for note in record["translation_notes"] if note.strip()
                ]
                blocks[region_id] = normalized
                stored += 1
            if blocks:
                self._translation.put(cache_key, blocks)
        if stored:
            logger.info("translation results cached", extra={"blocks": stored})
        return stored

    # ------------------------------------------------------------------ misc

    def clear(self) -> None:
        with self._lock:
            self._ocr.clear()
            self._translation.clear()

    def stats(self) -> CacheManagerStats:
        with self._lock:
            entries = len(self._ocr) + len(self._translation)
        return CacheManagerStats(
            entries=entries, ttl_seconds=self.ttl_seconds, max_entries=self.max_entries
        )


@cache
def get_pipeline_cache() -> CacheManager:
    config = get_config()
    return CacheManager(
        ttl_seconds=config.pipeline_cache_ttl_seconds,
        max_entries=config.pipeline_cache_max_entries,
        bbox_tolerance_px=config.pipeline_cache_bbox_tolerance_px,
    )
