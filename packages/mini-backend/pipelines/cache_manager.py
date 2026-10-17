"""Shared TTL/LRU result cache with isolated record ownership.

Limits apply jointly to OCR and translation entries. The byte limit accounts
for serialized JSON payloads, not total interpreter RSS. Record counts provide
an additional bound on Python container growth.

Methods are synchronous and must run in workers when used from async handlers.
Namespaces must identify the application's authenticated cache-sharing scope.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import threading
import time
from collections import OrderedDict
from collections.abc import Mapping, Sequence
from copy import deepcopy
from dataclasses import dataclass
from functools import cache
from typing import TypedDict

from pydantic import JsonValue, TypeAdapter

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
_DEFAULT_MAX_BYTES = 64 * 1024 * 1024
_DEFAULT_MAX_BLOCKS = 4096
_CUSTOM_LLM_ENDPOINT_KEYS = ("api_base", "apiBase", "base_url", "baseUrl")

_JSON_ADAPTER: TypeAdapter[JsonValue] = TypeAdapter(JsonValue)

type _OcrBlocks = dict[str, OCRRecord]
type _TranslationBlocks = dict[str, TranslationRecord]


class CacheManagerStats(TypedDict):
    entries: int
    ttl_seconds: int
    max_entries: int


@dataclass(frozen=True, slots=True)
class _OcrPayload:
    blocks: _OcrBlocks


@dataclass(frozen=True, slots=True)
class _TranslationPayload:
    blocks: _TranslationBlocks


type _Payload = _OcrPayload | _TranslationPayload


@dataclass(frozen=True, slots=True)
class _Entry[V]:
    expires_at: float
    value: V
    size_bytes: int


class _TtlLruCache[V]:
    """Fixed-TTL LRU; access is serialized by its owner."""

    __slots__ = (
        "_entries",
        "_expiry_order",
        "_max_bytes",
        "_max_entries",
        "_size_bytes",
        "_ttl_seconds",
    )

    def __init__(
        self,
        *,
        ttl_seconds: int,
        max_entries: int,
        max_bytes: int,
    ) -> None:
        if ttl_seconds < 1 or max_entries < 1 or max_bytes < 1:
            raise ValueError("Cache limits must be positive")

        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._max_bytes = max_bytes
        self._size_bytes = 0
        self._entries: OrderedDict[str, _Entry[V]] = OrderedDict()
        self._expiry_order: OrderedDict[str, float] = OrderedDict()

    def __len__(self) -> int:
        self._purge_expired(time.monotonic())
        return len(self._entries)

    def _remove(self, key: str) -> None:
        entry = self._entries.pop(key, None)
        self._expiry_order.pop(key, None)
        if entry is not None:
            self._size_bytes -= entry.size_bytes

    def _purge_expired(self, now: float) -> None:
        while self._expiry_order:
            key = next(iter(self._expiry_order))
            if self._expiry_order[key] > now:
                break
            self._remove(key)

    def get(self, key: str) -> V | None:
        self._purge_expired(time.monotonic())
        entry = self._entries.get(key)
        if entry is None:
            return None
        self._entries.move_to_end(key)
        return entry.value

    def put(self, key: str, value: V, *, size_bytes: int) -> bool:
        if size_bytes < 0:
            raise ValueError("size_bytes must be non-negative")
        if size_bytes > self._max_bytes:
            return False

        now = time.monotonic()
        self._purge_expired(now)
        self._remove(key)

        expires_at = now + self._ttl_seconds
        self._entries[key] = _Entry(expires_at, value, size_bytes)
        self._expiry_order[key] = expires_at
        self._size_bytes += size_bytes

        while (
            len(self._entries) > self._max_entries
            or self._size_bytes > self._max_bytes
        ):
            self._remove(next(iter(self._entries)))

        return True

    def clear(self) -> None:
        self._entries.clear()
        self._expiry_order.clear()
        self._size_bytes = 0


def _hash_image_bytes(image_bytes: bytes) -> str:
    return hashlib.blake2b(image_bytes, digest_size=32).hexdigest()


def _json_ready(value: object) -> object:
    """Turn tuple-valued payload entries (frozen dataclasses) into JSON lists.

    Callers hash `dataclasses.asdict(...)` results directly; a tuple in such a
    payload is rejected by the strict JSON adapter below, so it is normalized
    here instead of at every call site.
    """
    if isinstance(value, tuple):
        return [_json_ready(item) for item in value]
    if isinstance(value, list):
        return [_json_ready(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _json_ready(item) for key, item in value.items()}
    return value


def _json_bytes(payload: object) -> bytes:
    validated = _JSON_ADAPTER.validate_python(_json_ready(payload), strict=True)
    return json.dumps(
        validated,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")


def _stable_hash(payload: Mapping[str, object]) -> str:
    return hashlib.sha256(_json_bytes(payload)).hexdigest()


def _non_sensitive_custom_llm(
    custom_llm: Mapping[str, object] | None,
) -> dict[str, str]:
    if custom_llm is None:
        return {}

    endpoint = ""
    for key in _CUSTOM_LLM_ENDPOINT_KEYS:
        value = custom_llm.get(key)
        if value is None:
            continue
        if not isinstance(value, str):
            raise ValueError("Custom LLM endpoint must be a string")
        if value.strip():
            endpoint = value.strip()
            break

    model = custom_llm.get("model", "")
    if model is None:
        model = ""
    if not isinstance(model, str):
        raise ValueError("Custom LLM model must be a string")

    return {"api_base": endpoint, "model": model.strip()}


def _bbox_id(bbox: BBox) -> str:
    return "_".join(str(value) for value in bbox)


def _trim_blocks[V](blocks: dict[str, V], limit: int) -> None:
    while len(blocks) > limit:
        del blocks[next(iter(blocks))]


class CacheManager:
    __slots__ = (
        "_cache",
        "_lock",
        "_max_blocks",
        "bbox_tolerance_px",
        "max_entries",
        "ttl_seconds",
    )

    def __init__(
        self,
        *,
        ttl_seconds: int,
        max_entries: int,
        bbox_tolerance_px: float = 0.0,
        max_bytes: int = _DEFAULT_MAX_BYTES,
        max_blocks_per_entry: int = _DEFAULT_MAX_BLOCKS,
    ) -> None:
        if ttl_seconds < 1 or max_entries < 1 or max_bytes < 1:
            raise ValueError("Cache limits must be positive")
        if max_blocks_per_entry < 1:
            raise ValueError("max_blocks_per_entry must be positive")
        if not math.isfinite(bbox_tolerance_px) or bbox_tolerance_px < 0:
            raise ValueError("bbox_tolerance_px must be finite and non-negative")

        self.ttl_seconds = max(_MIN_TTL_SECONDS, ttl_seconds)
        self.max_entries = max_entries
        self.bbox_tolerance_px = bbox_tolerance_px
        self._max_blocks = max_blocks_per_entry
        self._cache: _TtlLruCache[_Payload] = _TtlLruCache(
            ttl_seconds=self.ttl_seconds,
            max_entries=self.max_entries,
            max_bytes=max_bytes,
        )
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ keys

    def build_ocr_cache_key(
        self,
        *,
        image_bytes: bytes,
        language: str,
        model_key: str,
        namespace: str = "",
    ) -> str:
        payload: dict[str, object] = {
            "version": 2,
            "namespace": namespace,
            "language": language.strip().lower(),
            "model_key": model_key.strip(),
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
        context_fingerprint: str = "",
    ) -> str:
        payload: dict[str, object] = {
            "version": 2,
            "namespace": namespace,
            "model_key": model_key.strip(),
            "source_language": source_language.strip().lower(),
            "target_language": target_language.strip().lower(),
            "extra_context": extra_context,
            "translation_mode": translation_mode.strip().lower() or "default",
            "context_fingerprint": context_fingerprint,
            "llm_settings": dict(llm_settings) if llm_settings is not None else {},
            "custom_llm": _non_sensitive_custom_llm(custom_llm),
        }
        return f"translation::{_stable_hash(payload)}"

    # ------------------------------------------------------------------- ocr

    def get_cached_ocr_for_regions(
        self,
        cache_key: str,
        seeds: Sequence[OCRSeed],
    ) -> tuple[dict[str, OCRRecord], list[OCRSeed]]:
        with self._lock:
            payload = self._cache.get(f"ocr:{cache_key}")
            if not isinstance(payload, _OcrPayload):
                return {}, list(seeds)

            hits: dict[str, OCRRecord] = {}
            misses: list[OCRSeed] = []
            for seed in seeds:
                block = self._match_ocr_block(payload.blocks, seed)
                if block is None:
                    misses.append(seed)
                    continue

                hit = deepcopy(block)
                hit["id"] = seed["id"]
                hit["bbox"] = list(seed["bbox"])
                hits[seed["id"]] = hit

            return hits, misses

    def cache_ocr_results(
        self,
        cache_key: str,
        records: Sequence[OCRRecord],
    ) -> int:
        storage_key = f"ocr:{cache_key}"
        updated_keys: set[str] = set()

        with self._lock:
            existing = self._cache.get(storage_key)
            blocks = (
                deepcopy(existing.blocks)
                if isinstance(existing, _OcrPayload)
                else {}
            )

            for record in records:
                bbox = normalize_bbox(record["bbox"])
                # Blank text is not cached so a later pass can still recover it.
                if bbox is None or not record["text"].strip():
                    continue

                key = _bbox_id(bbox)
                blocks.pop(key, None)
                blocks[key] = deepcopy(record)
                updated_keys.add(key)
                _trim_blocks(blocks, self._max_blocks)

            if not updated_keys:
                return 0

            stored = len(updated_keys.intersection(blocks))
            size_bytes = len(_json_bytes(blocks))
            accepted = self._cache.put(
                storage_key,
                _OcrPayload(blocks),
                size_bytes=size_bytes,
            )

        logger.info(
            "pipeline_cache.ocr_write",
            extra={"blocks": stored if accepted else 0, "accepted": accepted},
        )
        return stored if accepted else 0

    def _match_ocr_block(
        self,
        blocks: _OcrBlocks,
        seed: OCRSeed,
    ) -> OCRRecord | None:
        target = normalize_bbox(seed["bbox"])
        if target is None:
            return None

        exact = blocks.get(_bbox_id(target))
        if exact is not None:
            return exact
        if self.bbox_tolerance_px == 0:
            return None

        best: OCRRecord | None = None
        best_distance = math.inf
        ambiguous = False

        for block in blocks.values():
            cached = normalize_bbox(block["bbox"])
            if cached is None:
                continue

            differences = [
                abs(left - right)
                for left, right in zip(target, cached, strict=True)
            ]
            if max(differences) > self.bbox_tolerance_px:
                continue

            distance = float(sum(value * value for value in differences))
            if distance < best_distance:
                best = block
                best_distance = distance
                ambiguous = False
            elif distance == best_distance:
                ambiguous = True

        return None if ambiguous else best

    # ----------------------------------------------------------- translation

    def get_cached_translations_for_regions(
        self,
        cache_key: str,
        seeds: Sequence[TranslationSeed],
    ) -> tuple[dict[str, TranslationRecord], list[TranslationSeed]]:
        with self._lock:
            payload = self._cache.get(f"translation:{cache_key}")
            if not isinstance(payload, _TranslationPayload):
                return {}, list(seeds)

            hits: dict[str, TranslationRecord] = {}
            misses: list[TranslationSeed] = []
            for seed in seeds:
                cached = payload.blocks.get(seed["id"])
                if cached is None or cached["source_text"] != seed["text"]:
                    misses.append(seed)
                    continue
                hits[seed["id"]] = deepcopy(cached)

            return hits, misses

    def cache_translation_results(
        self,
        cache_key: str,
        records: Sequence[TranslationRecord],
    ) -> int:
        storage_key = f"translation:{cache_key}"
        updated_keys: set[str] = set()

        with self._lock:
            existing = self._cache.get(storage_key)
            blocks = (
                deepcopy(existing.blocks)
                if isinstance(existing, _TranslationPayload)
                else {}
            )

            for record in records:
                region_id = record["id"]
                if not region_id.strip() or not record["translated_text"].strip():
                    continue

                normalized = deepcopy(record)
                normalized["translation_notes"] = [
                    note
                    for note in record["translation_notes"]
                    if note.strip()
                ]

                blocks.pop(region_id, None)
                blocks[region_id] = normalized
                updated_keys.add(region_id)
                _trim_blocks(blocks, self._max_blocks)

            if not updated_keys:
                return 0

            stored = len(updated_keys.intersection(blocks))
            size_bytes = len(_json_bytes(blocks))
            accepted = self._cache.put(
                storage_key,
                _TranslationPayload(blocks),
                size_bytes=size_bytes,
            )

        logger.info(
            "pipeline_cache.translation_write",
            extra={"blocks": stored if accepted else 0, "accepted": accepted},
        )
        return stored if accepted else 0

    # ------------------------------------------------------------------ misc

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
        logger.info("pipeline_cache.cleared")

    def stats(self) -> CacheManagerStats:
        with self._lock:
            entries = len(self._cache)

        return CacheManagerStats(
            entries=entries,
            ttl_seconds=self.ttl_seconds,
            max_entries=self.max_entries,
        )


@cache
def get_pipeline_cache() -> CacheManager:
    config = get_config()
    return CacheManager(
        ttl_seconds=config.pipeline_cache_ttl_seconds,
        max_entries=config.pipeline_cache_max_entries,
        bbox_tolerance_px=config.pipeline_cache_bbox_tolerance_px,
    )
