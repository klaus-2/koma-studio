"""Recognize Text stage — one deep module behind POST /ocr and AIO batch.

Owns engine resolution, cache key composition, fallback recognition and
record enrichment/merging.
The HTTP router only parses multipart, delegates missing-seed detection
to the shared ``detect_text_seeds`` helper (``pipelines.detection_seeds``)
and maps records onto the response schema (keeping its GPU→CPU fallback
wrapper); the batch orchestrator only detects missing seeds and threads
its cancellation event.
"""

from __future__ import annotations

import asyncio
import logging
from copy import deepcopy
from dataclasses import dataclass
from typing import Callable

from PIL import Image

from core.device import DeviceInfo, release_gpu_memory
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, to_rgb_array
from models.ocr.factory import get_ocr_engine
from pipelines.batch.records import (
    OCRRecord,
    OCRSeed,
    normalize_bbox,
    normalize_stage_source,
)
from pipelines.cache_manager import (
    CacheManager,
    _bbox_id,
    get_pipeline_cache,
    match_ocr_blocks,
)
from pipelines.ocr_enrichment import enrich_ocr_record_with_gradient
from pipelines.ocr_region_dedup import (
    build_dedup_key,
    compute_crop_hash,
    get_ocr_region_dedup_cache,
)
from pipelines.stage_store import get_stage_store
from services.device_fallback import should_skip_gpu_release
from utils.ocr_fallback import recognize_with_fallbacks

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class CachedOcrRequest:
    image: Image.Image
    image_bytes: bytes
    language: str
    model_key: str | None
    has_gpu: bool
    seeds: tuple[OCRSeed, ...]
    device_info: DeviceInfo | None = None
    # Batch AIO cancellation; HTTP leaves it empty.
    cancellation_event: asyncio.Event | None = None


@dataclass(frozen=True, slots=True)
class CachedOcrResult:
    engine_key: str
    records: tuple[OCRRecord, ...]
    device_decision: str | None = None


def _to_input_region(seed: OCRSeed) -> OCRInputRegion | None:
    bbox = normalize_bbox(seed["bbox"])
    if bbox is None:
        return None
    return OCRInputRegion(
        id=seed["id"],
        bbox=bbox,
        source=seed["source"],
        detector_model_key=seed["detector_model_key"],
    )


def _empty_record(seed: OCRSeed, engine_key: str) -> OCRRecord:
    return OCRRecord(
        id=seed["id"],
        bbox=list(seed["bbox"]),
        text="",
        score=0.0,
        source=seed["source"],
        detector_model_key=seed["detector_model_key"],
        ocr_model_key=engine_key,
    )


def _device_decision(engine: BaseOCR) -> str | None:
    # Duck-typed fakes in tests predate the BaseOCR property.
    reason = getattr(engine, "device_decision_reason", None)
    return reason if isinstance(reason, str) else None


async def run_cached_ocr(
    request: CachedOcrRequest,
    *,
    cache: CacheManager | None = None,
    resolve_engine: Callable[..., BaseOCR] | None = None,
) -> CachedOcrResult:
    """Recognize regions through the cache + engine fallbacks behind one interface."""
    # Resolved at call time so tests can inject fake engines.
    resolve = resolve_engine if resolve_engine is not None else get_ocr_engine
    pipeline_cache = cache if cache is not None else get_pipeline_cache()
    store = get_stage_store()
    engine = resolve(
        language=request.language,
        has_gpu=request.has_gpu,
        model_key=request.model_key,
        device_info=request.device_info,
    )
    cache_key = pipeline_cache.build_ocr_cache_key(
        image_bytes=request.image_bytes, language=request.language, model_key=engine.key
    )
    cached_by_id, missing = pipeline_cache.get_cached_ocr_for_regions(cache_key, request.seeds)
    if missing:
        # Disk miss-path consult: outside CacheManager._lock (already
        # released), sqlite read via a worker thread. Blocks are keyed by
        # bbox id, so re-matching reassigns this pass's seed ids.
        disk_blocks = await asyncio.to_thread(store.get_ocr, cache_key)
        if disk_blocks is not None:
            disk_hits, still_missing = match_ocr_blocks(
                disk_blocks,
                missing,
                bbox_tolerance_px=pipeline_cache.bbox_tolerance_px,
            )
            cached_by_id.update(disk_hits)
            missing = still_missing

    dedup_pending: list[tuple[str, list[OCRSeed]]] = []
    if missing and isinstance(request.image, Image.Image):
        dedup = get_ocr_region_dedup_cache()
        rgb = to_rgb_array(request.image)
        groups: dict[str, list[OCRSeed]] = {}
        for seed in missing:
            bbox = normalize_bbox(seed["bbox"])
            if bbox is None or bbox[2] <= bbox[0] or bbox[3] <= bbox[1]:
                continue
            key = build_dedup_key(
                language=request.language,
                model_key=engine.key,
                bbox_width=bbox[2] - bbox[0],
                bbox_height=bbox[3] - bbox[1],
                crop_hash=compute_crop_hash(rgb, bbox),
            )
            groups.setdefault(key, []).append(seed)
        dedup_hits: set[str] = set()
        for key, group in groups.items():
            stored = dedup.lookup(key)
            if stored is None:
                dedup_pending.append((key, group))
                continue
            for seed in group:
                hit = deepcopy(stored[0])
                hit["id"] = seed["id"]
                hit["bbox"] = list(seed["bbox"])
                cached_by_id[seed["id"]] = hit
                dedup_hits.add(seed["id"])
        if dedup_hits:
            missing = [seed for seed in missing if seed["id"] not in dedup_hits]

    fresh_by_id: dict[str, OCRRecord] = {}
    inputs = [region for seed in missing if (region := _to_input_region(seed)) is not None]
    if inputs:
        try:
            results = await recognize_with_fallbacks(
                engine=engine,
                image=request.image,
                regions=inputs,
                language=request.language,
                cancellation_event=request.cancellation_event,
            )
        finally:
            if not should_skip_gpu_release():
                release_gpu_memory()
        raw = [
            OCRRecord(
                id=result.id,
                bbox=[int(v) for v in result.bbox],
                text=result.text,
                score=float(result.score),
                source=normalize_stage_source(result.source),
                detector_model_key=result.detector_model_key,
                ocr_model_key=result.model_key or engine.key,
            )
            for result in results
        ]
        fresh = await asyncio.to_thread(
            lambda: [enrich_ocr_record_with_gradient(request.image, record) for record in raw]
        )
        fresh_by_id = {record["id"]: record for record in fresh}
        pipeline_cache.cache_ocr_results(cache_key, fresh)
        for key, group in dedup_pending:
            for seed in group:
                record = fresh_by_id.get(seed["id"])
                if record is None:
                    continue
                bbox = normalize_bbox(record["bbox"])
                if bbox is None or not record["text"].strip():
                    continue
                get_ocr_region_dedup_cache().store(key, [record])
                break
        # Persist to disk keyed by bbox id (never seed id — seed ids are
        # pass-local). Blank text is not persisted so a later pass can still
        # recover it, mirroring the in-memory guard.
        new_blocks: dict[str, dict[str, object]] = {}
        for record in fresh:
            bbox = normalize_bbox(record["bbox"])
            if bbox is None or not record["text"].strip():
                continue
            new_blocks[_bbox_id(bbox)] = dict(record)
        if new_blocks:
            await asyncio.to_thread(store.merge_ocr, key=cache_key, blocks=new_blocks)

    if request.device_info is not None:
        logger.info(
            "ocr finished",
            extra={
                "engine": engine.key,
                "device": request.device_info.name,
                "fresh": len(fresh_by_id),
                "cached": len(cached_by_id),
            },
        )

    def merge() -> list[OCRRecord]:
        # Fresh and cached records already went through the enricher; only
        # records with no gradient at all (empty seeds, stale cache entries)
        # are computed here.
        merged: list[OCRRecord] = []
        for seed in request.seeds:
            record = fresh_by_id.get(seed["id"])
            if record is None:
                record = cached_by_id.get(seed["id"])
            if record is None:
                record = _empty_record(seed, engine.key)
            if "foreground_gradient" in record:
                merged.append(record)
            else:
                merged.append(enrich_ocr_record_with_gradient(request.image, record))
        return merged

    return CachedOcrResult(
        engine_key=engine.key,
        records=tuple(await asyncio.to_thread(merge)),
        device_decision=_device_decision(engine),
    )
