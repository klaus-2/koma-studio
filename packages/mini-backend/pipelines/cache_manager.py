from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
import hashlib
import json
import logging
import threading
import time
from typing import Any


logger = logging.getLogger(__name__)


@dataclass
class _TimedCacheEntry:
    cached_at: float
    payload: dict[str, Any]


class CacheManager:
    """Caches OCR/translation results for pipeline stages."""

    def __init__(
        self,
        *,
        ttl_seconds: int,
        max_entries: int,
        bbox_tolerance_px: float = 5.0,
    ) -> None:
        self.ttl_seconds = max(30, int(ttl_seconds))
        self.max_entries = max(1, int(max_entries))
        self.bbox_tolerance_px = max(0.0, float(bbox_tolerance_px))
        self._ocr_cache: OrderedDict[str, _TimedCacheEntry] = OrderedDict()
        self._translation_cache: OrderedDict[str, _TimedCacheEntry] = OrderedDict()
        self._lock = threading.RLock()

    def build_ocr_cache_key(
        self,
        *,
        image_bytes: bytes,
        language: str,
        model_key: str,
        namespace: str = "",
    ) -> str:
        key_payload = {
            "namespace": (namespace or "").strip(),
            "language": (language or "").strip().lower(),
            "model_key": (model_key or "").strip().lower(),
            "image_hash": self._hash_image_bytes(image_bytes),
        }
        return f"ocr::{self._stable_hash(key_payload)}"

    def build_translation_cache_key(
        self,
        *,
        model_key: str,
        source_language: str,
        target_language: str,
        extra_context: str,
        llm_settings: dict[str, Any] | None = None,
        custom_llm: dict[str, Any] | None = None,
        namespace: str = "",
        translation_mode: str = "default",
    ) -> str:
        non_sensitive_custom = {}
        if isinstance(custom_llm, dict):
            non_sensitive_custom = {
                "api_base": str(
                    custom_llm.get("api_base")
                    or custom_llm.get("apiBase")
                    or custom_llm.get("base_url")
                    or custom_llm.get("baseUrl")
                    or ""
                ).strip(),
                "model": str(custom_llm.get("model") or "").strip(),
            }
        key_payload = {
            "namespace": (namespace or "").strip(),
            "model_key": (model_key or "").strip().lower(),
            "source_language": (source_language or "").strip().lower(),
            "target_language": (target_language or "").strip().lower(),
            "extra_context": str(extra_context or "").strip(),
            "translation_mode": str(translation_mode or "default").strip().lower(),
            "llm_settings": llm_settings if isinstance(llm_settings, dict) else {},
            "custom_llm": non_sensitive_custom,
        }
        return f"translation::{self._stable_hash(key_payload)}"

    def get_cached_ocr_for_regions(
        self,
        cache_key: str,
        regions: list[dict[str, Any]],
    ) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
        with self._lock:
            entry = self._get_entry(self._ocr_cache, cache_key)
            if entry is None:
                return {}, list(regions)

            cached_records: dict[str, dict[str, Any]] = {}
            missing_regions: list[dict[str, Any]] = []
            records = entry.payload

            for region in regions:
                match = self._find_matching_ocr_record(records, region)
                region_id = str(region.get("id") or "")
                if match is None:
                    missing_regions.append(region)
                    continue

                cached_records[region_id] = {
                    "id": region_id,
                    "bbox": [int(v) for v in region.get("bbox", [])[:4]],
                    "text": str(match.get("text") or ""),
                    "score": float(match.get("score") or 0.0),
                    "source": str(match.get("source") or "model"),
                    "detector_model_key": str(match.get("detector_model_key") or ""),
                    "ocr_model_key": str(match.get("ocr_model_key") or ""),
                }

            return cached_records, missing_regions

    def cache_ocr_results(
        self,
        cache_key: str,
        records: list[dict[str, Any]],
    ) -> int:
        with self._lock:
            entry = self._get_entry(self._ocr_cache, cache_key)
            merged: dict[str, dict[str, Any]] = dict(entry.payload) if entry else {}

            cached_count = 0
            for record in records:
                text = str(record.get("text") or "")
                bbox = self._parse_bbox(record.get("bbox"))
                if bbox is None or not text.strip():
                    continue
                block_id = self._bbox_to_id(bbox)
                merged[block_id] = {
                    "bbox": [int(v) for v in bbox],
                    "text": text,
                    "score": float(record.get("score") or 0.0),
                    "source": str(record.get("source") or "model"),
                    "detector_model_key": str(record.get("detector_model_key") or ""),
                    "ocr_model_key": str(record.get("ocr_model_key") or ""),
                }
                cached_count += 1

            if merged:
                self._ocr_cache[cache_key] = _TimedCacheEntry(
                    cached_at=time.time(),
                    payload=merged,
                )
                self._ocr_cache.move_to_end(cache_key)
                self._cleanup_cache(self._ocr_cache)

            if cached_count:
                logger.info("Cached OCR results for %d blocks", cached_count)
            return cached_count

    def get_cached_translations_for_regions(
        self,
        cache_key: str,
        regions: list[dict[str, Any]],
    ) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]]]:
        with self._lock:
            entry = self._get_entry(self._translation_cache, cache_key)
            if entry is None:
                return {}, list(regions)

            cached_records: dict[str, dict[str, Any]] = {}
            missing_regions: list[dict[str, Any]] = []
            records = entry.payload

            for region in regions:
                region_id = str(region.get("id") or "")
                source_text = str(region.get("text") or "").strip()
                cached = records.get(region_id)
                if cached is None:
                    missing_regions.append(region)
                    continue
                if str(cached.get("source_text") or "").strip() != source_text:
                    missing_regions.append(region)
                    continue

                cached_records[region_id] = {
                    "id": region_id,
                    "source_text": source_text,
                    "translated_text": str(cached.get("translated_text") or ""),
                    "translation_notes": [str(item) for item in (cached.get("translation_notes") or []) if str(item).strip()],
                    "source": str(cached.get("source") or "model"),
                    "detector_model_key": str(cached.get("detector_model_key") or ""),
                    "ocr_model_key": str(cached.get("ocr_model_key") or ""),
                    "translator_model_key": str(cached.get("translator_model_key") or ""),
                }

            return cached_records, missing_regions

    def cache_translation_results(
        self,
        cache_key: str,
        records: list[dict[str, Any]],
    ) -> int:
        with self._lock:
            entry = self._get_entry(self._translation_cache, cache_key)
            merged: dict[str, dict[str, Any]] = dict(entry.payload) if entry else {}

            cached_count = 0
            for record in records:
                region_id = str(record.get("id") or "").strip()
                translated_text = str(record.get("translated_text") or "")
                if not region_id or not translated_text.strip():
                    continue

                merged[region_id] = {
                    "source_text": str(record.get("source_text") or "").strip(),
                    "translated_text": translated_text,
                    "translation_notes": [str(item) for item in (record.get("translation_notes") or []) if str(item).strip()],
                    "source": str(record.get("source") or "model"),
                    "detector_model_key": str(record.get("detector_model_key") or ""),
                    "ocr_model_key": str(record.get("ocr_model_key") or ""),
                    "translator_model_key": str(record.get("translator_model_key") or ""),
                }
                cached_count += 1

            if merged:
                self._translation_cache[cache_key] = _TimedCacheEntry(
                    cached_at=time.time(),
                    payload=merged,
                )
                self._translation_cache.move_to_end(cache_key)
                self._cleanup_cache(self._translation_cache)

            return cached_count

    def clear(self) -> None:
        with self._lock:
            self._ocr_cache.clear()
            self._translation_cache.clear()

    def _find_matching_ocr_record(
        self,
        records: dict[str, dict[str, Any]],
        target_region: dict[str, Any],
    ) -> dict[str, Any] | None:
        target_bbox = self._parse_bbox(target_region.get("bbox"))
        if target_bbox is None:
            return None

        exact = records.get(self._bbox_to_id(target_bbox))
        if exact is not None:
            return exact

        for record in records.values():
            cached_bbox = self._parse_bbox(record.get("bbox"))
            if cached_bbox is None:
                continue
            if self._bbox_matches(target_bbox, cached_bbox):
                return record
        return None

    def _bbox_matches(
        self,
        bbox_a: tuple[int, int, int, int],
        bbox_b: tuple[int, int, int, int],
    ) -> bool:
        tolerance = self.bbox_tolerance_px
        return (
            abs(float(bbox_a[0]) - float(bbox_b[0])) <= tolerance
            and abs(float(bbox_a[1]) - float(bbox_b[1])) <= tolerance
            and abs(float(bbox_a[2]) - float(bbox_b[2])) <= tolerance
            and abs(float(bbox_a[3]) - float(bbox_b[3])) <= tolerance
        )

    def _parse_bbox(self, raw_bbox: Any) -> tuple[int, int, int, int] | None:
        if not isinstance(raw_bbox, (list, tuple)) or len(raw_bbox) < 4:
            return None
        try:
            x1, y1, x2, y2 = [int(float(v)) for v in raw_bbox[:4]]
        except (TypeError, ValueError):
            return None
        return (x1, y1, x2, y2)

    def _bbox_to_id(self, bbox: tuple[int, int, int, int]) -> str:
        x1, y1, x2, y2 = bbox
        return f"{x1}_{y1}_{x2}_{y2}"

    def _hash_image_bytes(self, image_bytes: bytes) -> str:
        if not image_bytes:
            return "empty-image"
        if len(image_bytes) <= 4096:
            return hashlib.sha256(image_bytes).hexdigest()
        sampled = image_bytes[::97]
        return hashlib.sha256(sampled).hexdigest()

    def _stable_hash(self, payload: dict[str, Any]) -> str:
        encoded = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def _cleanup_cache(self, cache: OrderedDict[str, _TimedCacheEntry]) -> None:
        now = time.time()
        expired_keys = [
            key for key, entry in cache.items() if (now - entry.cached_at) >= self.ttl_seconds
        ]
        for key in expired_keys:
            cache.pop(key, None)

        while len(cache) > self.max_entries:
            cache.popitem(last=False)

    def _get_entry(
        self,
        cache: OrderedDict[str, _TimedCacheEntry],
        key: str,
    ) -> _TimedCacheEntry | None:
        self._cleanup_cache(cache)
        entry = cache.get(key)
        if entry is None:
            return None
        if (time.time() - entry.cached_at) >= self.ttl_seconds:
            cache.pop(key, None)
            return None
        cache.move_to_end(key)
        return entry
