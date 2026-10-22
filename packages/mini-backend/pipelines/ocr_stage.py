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
from dataclasses import dataclass
from typing import Callable

from PIL import Image

from core.device import DeviceInfo, release_gpu_memory
from models.ocr.base_ocr import BaseOCR, OCRInputRegion
from models.ocr.factory import get_ocr_engine
from pipelines.batch.records import (
    OCRRecord,
    OCRSeed,
    normalize_bbox,
    normalize_stage_source,
)
from pipelines.cache_manager import CacheManager, get_pipeline_cache
from pipelines.ocr_enrichment import enrich_ocr_record_with_gradient
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
