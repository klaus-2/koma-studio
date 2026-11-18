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
from collections.abc import Sequence
from copy import deepcopy
from dataclasses import dataclass, replace
from typing import Callable

from PIL import Image

from core.config import get_config
from core.device import DeviceInfo, release_gpu_memory
from models.geometry import clip_bbox
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
from utils.resolution_policy import StageResolutionPlan, stage_resolution_plan

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


def _ocr_working_plan(request: CachedOcrRequest) -> StageResolutionPlan | None:
    """Stage-time downscale plan for OCR; None when the policy flag is off."""
    config = get_config()
    if not config.working_resolution_ocr_clean_enabled:
        return None
    if not isinstance(request.image, Image.Image):
        return None
    width, height = request.image.size
    return stage_resolution_plan(
        "ocr", width, height, config.working_resolution_megapixels
    )


def _scale_bbox(
    bbox: tuple[int, int, int, int],
    *,
    scale_x: float,
    scale_y: float,
    max_width: int,
    max_height: int,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    return (
        min(max_width, max(0, round(x1 * scale_x))),
        min(max_height, max(0, round(y1 * scale_y))),
        min(max_width, max(0, round(x2 * scale_x))),
        min(max_height, max(0, round(y2 * scale_y))),
    )


def _to_working_region(
    region: OCRInputRegion, plan: StageResolutionPlan
) -> OCRInputRegion:
    return replace(
        region,
        bbox=_scale_bbox(
            region.bbox,
            scale_x=plan.scale_x,
            scale_y=plan.scale_y,
            max_width=plan.working_width,
            max_height=plan.working_height,
        ),
    )


def _original_bbox(
    bbox: tuple[int, int, int, int],
    plan: StageResolutionPlan | None,
) -> tuple[int, int, int, int]:
    if plan is None or not plan.downscaled:
        return bbox
    return _scale_bbox(
        bbox,
        scale_x=plan.width / plan.working_width,
        scale_y=plan.height / plan.working_height,
        max_width=plan.width,
        max_height=plan.height,
    )


def _group_dedup_seeds(
    image: Image.Image,
    seeds: Sequence[OCRSeed],
    *,
    language: str,
    model_key: str,
    working_mp: float,
    ocr_clean_enabled: bool,
) -> dict[str, list[OCRSeed]]:
    """Sync page-scale work: RGB materialization + per-seed crop hashing."""
    rgb = to_rgb_array(image)
    groups: dict[str, list[OCRSeed]] = {}
    for seed in seeds:
        bbox = normalize_bbox(seed["bbox"])
        if bbox is None:
            continue
        clipped = clip_bbox(*bbox, rgb.shape[1], rgb.shape[0])
        if clipped is None:
            continue
        key = build_dedup_key(
            language=language,
            model_key=model_key,
            bbox_width=clipped[2] - clipped[0],
            bbox_height=clipped[3] - clipped[1],
            crop_hash=compute_crop_hash(rgb, clipped),
            working_mp=working_mp,
            ocr_clean_enabled=ocr_clean_enabled,
        )
        groups.setdefault(key, []).append(seed)
    return groups


def _resize_engine_inputs(
    image: Image.Image,
    plan: StageResolutionPlan,
    regions: list[OCRInputRegion],
) -> tuple[Image.Image, list[OCRInputRegion]]:
    working = image.resize(
        (plan.working_width, plan.working_height), Image.Resampling.BICUBIC
    )
    return working, [_to_working_region(region, plan) for region in regions]


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
    config = get_config()
    cache_key = pipeline_cache.build_ocr_cache_key(
        image_bytes=request.image_bytes,
        language=request.language,
        model_key=engine.key,
        working_mp=config.working_resolution_megapixels,
        ocr_clean_enabled=config.working_resolution_ocr_clean_enabled,
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

    dedup_pending: list[tuple[str, OCRSeed, list[OCRSeed]]] = []
    dedup_hit_raw: list[OCRRecord] = []
    if missing and isinstance(request.image, Image.Image):
        dedup = get_ocr_region_dedup_cache()
        groups = await asyncio.to_thread(
            _group_dedup_seeds,
            request.image,
            missing,
            language=request.language,
            model_key=engine.key,
            working_mp=config.working_resolution_megapixels,
            ocr_clean_enabled=config.working_resolution_ocr_clean_enabled,
        )
        removed_from_missing: set[str] = set()
        for key, group in groups.items():
            stored = dedup.lookup(key)
            if stored is None:
                leader = group[0]
                followers = group[1:]
                dedup_pending.append((key, leader, followers))
                for follower in followers:
                    removed_from_missing.add(follower["id"])
                continue
            for seed in group:
                hit = deepcopy(stored[0])
                hit["id"] = seed["id"]
                hit["bbox"] = list(seed["bbox"])
                hit["source"] = normalize_stage_source(seed.get("source"))
                hit["detector_model_key"] = seed.get("detector_model_key")
                hit.pop("foreground_gradient", None)
                dedup_hit_raw.append(hit)
                removed_from_missing.add(seed["id"])
        if removed_from_missing:
            missing = [seed for seed in missing if seed["id"] not in removed_from_missing]

    dedup_enriched: list[OCRRecord] = []
    if dedup_hit_raw:
        dedup_enriched = await asyncio.to_thread(
            lambda: [enrich_ocr_record_with_gradient(request.image, hit) for hit in dedup_hit_raw]
        )
        for record in dedup_enriched:
            cached_by_id[record["id"]] = record

    fresh_by_id: dict[str, OCRRecord] = {}
    inputs = [region for seed in missing if (region := _to_input_region(seed)) is not None]
    plan = _ocr_working_plan(request)
    working_image: Image.Image | None = None
    if plan is not None and plan.downscaled and inputs:
        working_image, inputs = await asyncio.to_thread(
            _resize_engine_inputs, request.image, plan, inputs
        )
    if inputs:
        try:
            results = await recognize_with_fallbacks(
                engine=engine,
                image=working_image if working_image is not None else request.image,
                regions=inputs,
                language=request.language,
                cancellation_event=request.cancellation_event,
            )
        finally:
            if working_image is not None:
                working_image.close()
            if not should_skip_gpu_release():
                release_gpu_memory()
        raw = [
            OCRRecord(
                id=result.id,
                bbox=list(_original_bbox(result.bbox, plan)),
                text=result.text,
                score=float(result.score),
                source=normalize_stage_source(result.source),
                detector_model_key=result.detector_model_key,
                ocr_model_key=result.model_key or engine.key,
            )
            for result in results
        ]
        raw_by_id = {record["id"]: record for record in raw}
        for _key, leader, followers in dedup_pending:
            leader_raw = raw_by_id.get(leader["id"])
            if leader_raw is None:
                continue
            for follower in followers:
                cloned = deepcopy(leader_raw)
                cloned["id"] = follower["id"]
                cloned["bbox"] = list(follower["bbox"])
                cloned["source"] = normalize_stage_source(follower.get("source"))
                cloned["detector_model_key"] = follower.get("detector_model_key")
                raw.append(cloned)
        fresh = await asyncio.to_thread(
            lambda: [enrich_ocr_record_with_gradient(request.image, record) for record in raw]
        )
        fresh_by_id = {record["id"]: record for record in fresh}
        for key, leader, _followers in dedup_pending:
            record = fresh_by_id.get(leader["id"])
            if record is None:
                continue
            bbox = normalize_bbox(record["bbox"])
            if bbox is None or not record["text"].strip():
                continue
            get_ocr_region_dedup_cache().store(key, [record])

    persistable = [*fresh_by_id.values(), *dedup_enriched]
    if persistable:
        pipeline_cache.cache_ocr_results(cache_key, persistable)
        new_blocks: dict[str, dict[str, object]] = {}
        for record in persistable:
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
