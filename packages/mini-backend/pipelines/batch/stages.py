"""Stage runners. Every async function here awaits model I/O and pushes
CPU-bound numpy/OpenCV/PIL work to a worker thread — the event loop stays free."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from collections.abc import Awaitable, Callable
from typing import cast

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image

from core.config import LLMRequestSettings, get_config
from core.device import DeviceInfo, release_gpu_memory
from models.detection.base_detector import TextDetection
from models.detection.factory import get_detector
from models.inpainting.base_inpainter import HDStrategy, InpaintConfig
from models.inpainting.factory import get_inpainter
from pipelines.ocr_stage import CachedOcrRequest, run_cached_ocr
from pipelines.detection_seeds import (
    detect_text_seeds,
    normalize_detector_fields,
    ocr_seeds_from_detections,
    run_text_detector,
)
from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.factory import get_segmenter
from pipelines.stage_store import (
    StageStore,
    build_clean_cache_key,
    build_detect_cache_key,
    build_segment_cache_key,
    fingerprint_clean_settings,
    fingerprint_detect_settings,
    fingerprint_mask_regions,
    fingerprint_seeds,
    get_stage_store,
    hash_image_array,
    hash_image_bytes,
)
from pipelines.translation_stage import (
    CachedTranslationRequest,
    run_cached_translation,
    seed_from_ocr,
)
from pipelines.batch.errors import ImageEncodeError, InvalidImageError
from pipelines.batch.records import (
    DetectionRecord,
    OCRRecord,
    OCRSeed,
    SegmentRecord,
    SegmentSeed,
    TranslationRecord,
    normalize_bbox,
    normalize_boxes,
    normalize_stage_source,
    optional_float,
    optional_rgb,
    optional_str,
)
from services.device_fallback import should_skip_gpu_release
from utils.detection_fallback import detect_with_fallbacks
from utils.image_codec import ImageDecodeError, decode_pil
from utils.inpaint_heuristics import (
    apply_need_inpaint_heuristic,
    detect_background_complexity,
)
from utils.mask import MaskRegion, generate_baka_style_mask
from utils.resolution_policy import StageResolutionPlan, stage_resolution_plan

type RGBArray = NDArray[np.uint8]
type MaskArray = NDArray[np.uint8]


@dataclass(frozen=True, slots=True)
class StageOutput[T]:
    model_used: str
    regions: list[T]
    # Set when the stage chose CPU before loading (the OCR device decision);
    # None on the normal path. A GPU-OOM retry is reported by the orchestrator.
    fallback_reason: str | None = None


@dataclass(frozen=True, slots=True)
class CleanSettings:
    model_key: str | None
    mask_dilation: int
    hd_strategy: str | None
    hd_strategy_resize_limit: int
    hd_strategy_crop_margin: int
    hd_strategy_crop_trigger_size: int


@dataclass(frozen=True, slots=True)
class CleanStageResult:
    model_used: str
    png: bytes
    hd_strategy: str


# --------------------------------------------------------------------------- image


async def open_rgb_image(image_bytes: bytes) -> Image.Image:
    try:
        return await asyncio.to_thread(decode_pil, image_bytes, "RGB")
    except ImageDecodeError as exc:
        raise InvalidImageError(str(exc)) from exc


def _encode_png(rgb: RGBArray) -> bytes:
    ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if not ok:
        raise ImageEncodeError("Failed to encode image as PNG")
    return encoded.tobytes()


# --------------------------------------------------------------------------- detect


def detection_to_record(det: object, index: int, fallback_model: str) -> DetectionRecord:
    """Adapt a detector-specific result object into the wire record."""
    fields = normalize_detector_fields(det, fallback_model)
    if fields is None:
        raise InvalidImageError(f"Detector returned an invalid bbox for region {index}")
    score = optional_float(getattr(det, "score", None))
    return DetectionRecord(
        id=f"det-{index}",
        bbox=fields.bbox,
        score=round(1.0 if score is None else score, 4),
        label=str(getattr(det, "label", "text")),
        source=fields.source,
        model_key=fields.model_key,
        foreground_rgb=optional_rgb(getattr(det, "foreground_rgb", None)),
        structural_type=optional_str(getattr(det, "structural_type", None)),
        structural_confidence=optional_float(
            getattr(det, "structural_confidence", None)
        ),
        structural_source=optional_str(getattr(det, "structural_source", None)),
        matched_reference_image=optional_str(
            getattr(det, "matched_reference_image", None)
        ),
    )


async def _detect_plain(
    image: Image.Image, *, has_gpu: bool, model_key: str
) -> list[DetectionRecord]:
    detections = await run_text_detector(image, has_gpu=has_gpu, model_key=model_key)
    return [
        detection_to_record(det, index, model_key)
        for index, det in enumerate(detections, start=1)
    ]


def _cached_detection_record(raw: Mapping[str, object]) -> DetectionRecord | None:
    """Rebuild a DetectionRecord from a cached JSON entry through the same
    normalize path the fresh run uses. Malformed entries (a corrupt row)
    become None so the caller treats the entry as a miss."""
    bbox = normalize_bbox(raw.get("bbox"))
    record_id = optional_str(raw.get("id"))
    model_key = optional_str(raw.get("model_key"))
    if bbox is None or record_id is None or model_key is None:
        return None
    score = optional_float(raw.get("score"))
    return DetectionRecord(
        id=record_id,
        bbox=list(bbox),
        score=round(1.0 if score is None else score, 4),
        label=optional_str(raw.get("label")) or "text",
        source=normalize_stage_source(raw.get("source")),
        model_key=model_key,
        foreground_rgb=optional_rgb(raw.get("foreground_rgb")),
        structural_type=optional_str(raw.get("structural_type")),
        structural_confidence=optional_float(raw.get("structural_confidence")),
        structural_source=optional_str(raw.get("structural_source")),
        matched_reference_image=optional_str(raw.get("matched_reference_image")),
    )


async def run_detect_stage(
    *,
    image: Image.Image,
    has_gpu: bool,
    model_key: str | None,
    default_detection_model: str,
    store: StageStore | None = None,
) -> StageOutput[DetectionRecord]:
    resolved_model = model_key or default_detection_model
    resolved_store = store if store is not None else get_stage_store()
    cfg = get_config()
    rgb = cast(RGBArray, np.asarray(image, dtype=np.uint8))
    cache_key = build_detect_cache_key(
        image_hash=hash_image_array(rgb),
        model_key=resolved_model,
        settings_fingerprint=fingerprint_detect_settings(
            conf_threshold=cfg.detection_conf_threshold,
            nms_threshold=cfg.detection_nms_threshold,
            input_size=cfg.detection_input_size,
        ),
    )
    cached = await asyncio.to_thread(resolved_store.get_detect, cache_key)
    if cached is not None:
        records = [
            record
            for record in (
                _cached_detection_record(entry) for entry in cached.records
            )
            if record is not None
        ]
        if not cached.records or records:
            return StageOutput(model_used=cached.model_used, regions=records)
    detector = get_detector(task="text", has_gpu=has_gpu, model_key=resolved_model)
    try:
        detections, variant = await detect_with_fallbacks(
            image,
            cast("Callable[[Image.Image], Awaitable[Sequence[TextDetection]]]", detector.detect),
        )
    finally:
        if not should_skip_gpu_release():
            release_gpu_memory()
    records = [
        detection_to_record(det, index, resolved_model)
        for index, det in enumerate(detections, start=1)
    ]
    model_used = records[-1]["model_key"] if records else resolved_model
    model_used = model_used if variant == "original" else f"{model_used}@{variant}"
    await asyncio.to_thread(
        resolved_store.put_detect,
        key=cache_key,
        records=records,
        model_used=model_used,
    )
    return StageOutput(model_used=model_used, regions=records)


# --------------------------------------------------------------------------- ocr


async def run_ocr_stage(
    *,
    image: Image.Image,
    image_bytes: bytes,
    source_language: str,
    model_key: str | None,
    has_gpu: bool,
    default_detection_model: str,
    seeds: Sequence[OCRSeed] | None = None,
    cancellation_event: asyncio.Event | None = None,
    device_info: DeviceInfo | None = None,
) -> StageOutput[OCRRecord]:
    """Thin adapter over the Recognize Text stage module (``pipelines.ocr_stage``).
    Detects regions when none are supplied; the stage module owns the cache,
    fallback recognition, cancellation and enrichment."""
    resolved_seeds = list(seeds) if seeds is not None else []
    if not resolved_seeds:
        resolved_seeds = await detect_text_seeds(
            image, has_gpu=has_gpu, model_key=default_detection_model
        )
    if not resolved_seeds:
        return StageOutput(model_used=model_key or "", regions=[])

    result = await run_cached_ocr(
        CachedOcrRequest(
            image=image,
            image_bytes=image_bytes,
            language=source_language,
            model_key=model_key,
            has_gpu=has_gpu,
            seeds=tuple(resolved_seeds),
            device_info=device_info,
            cancellation_event=cancellation_event,
        )
    )
    return StageOutput(
        model_used=result.engine_key,
        regions=list(result.records),
        fallback_reason=result.device_decision,
    )


# --------------------------------------------------------------------------- translate


async def run_translation_stage(
    *,
    model_key: str | None,
    source_language: str,
    target_language: str,
    extra_context: str,
    settings: LLMRequestSettings,
    ocr_regions: Sequence[OCRRecord],
    custom_llm: Mapping[str, object] | None,
    neighbor_context: str,
) -> StageOutput[TranslationRecord]:
    """Batch adapter over the Get Translations stage module."""
    if not ocr_regions:
        return StageOutput(model_used=model_key or "", regions=[])

    if extra_context and not settings.extra_context:
        settings = replace(settings, extra_context=extra_context)

    result = await run_cached_translation(
        CachedTranslationRequest(
            model_key=model_key,
            source_language=source_language,
            target_language=target_language,
            seeds=tuple(seed_from_ocr(record) for record in ocr_regions),
            translation_mode="default",
            settings=settings,
            custom_llm=dict(custom_llm) if custom_llm is not None else None,
            neighbor_context=neighbor_context,
        )
    )
    return StageOutput(model_used=result.model_used, regions=list(result.records))


# --------------------------------------------------------------------------- segment


def _mask_base64(result: object) -> str | None:
    """Map the segmenter's empty-string default to an explicit null."""
    value = getattr(result, "mask_base64", "")
    return value if isinstance(value, str) and value else None


def _cached_segment_record(raw: Mapping[str, object]) -> SegmentRecord | None:
    """Rebuild a SegmentRecord from a cached JSON entry through the same
    normalize/int-casting path the fresh run uses. Malformed entries (a
    corrupt row) become None so the caller treats the entry as a miss."""
    bbox = normalize_bbox(raw.get("bbox"))
    segment_id = optional_str(raw.get("id"))
    detector_model_key = optional_str(raw.get("detector_model_key"))
    ocr_model_key = optional_str(raw.get("ocr_model_key"))
    translator_model_key = optional_str(raw.get("translator_model_key"))
    segment_model_key = optional_str(raw.get("segment_model_key"))
    if (
        bbox is None
        or segment_id is None
        or detector_model_key is None
        or ocr_model_key is None
        or translator_model_key is None
        or segment_model_key is None
    ):
        return None
    return SegmentRecord(
        id=segment_id,
        bbox=list(bbox),
        segment_boxes=[list(box) for box in normalize_boxes(raw.get("segment_boxes"))],
        merged_boxes=[list(box) for box in normalize_boxes(raw.get("merged_boxes"))],
        source=normalize_stage_source(raw.get("source")),
        detector_model_key=detector_model_key,
        ocr_model_key=ocr_model_key,
        translator_model_key=translator_model_key,
        segment_model_key=segment_model_key,
        mask_base64=optional_str(raw.get("mask_base64")),
    )


async def run_segment_stage(
    *,
    image_bytes: bytes,
    has_gpu: bool,
    model_key: str | None,
    seeds: Sequence[SegmentSeed],
    store: StageStore | None = None,
) -> StageOutput[SegmentRecord]:
    if not seeds:
        return StageOutput(model_used=model_key or "", regions=[])
    resolved_store = store if store is not None else get_stage_store()
    cache_key = build_segment_cache_key(
        image_hash=hash_image_bytes(image_bytes),
        model_key=model_key or "",
        seeds_fingerprint=fingerprint_seeds(list(seeds)),
    )
    cached = await asyncio.to_thread(resolved_store.get_segment, cache_key)
    if cached is not None:
        records = [
            record
            for record in (_cached_segment_record(entry) for entry in cached.records)
            if record is not None
        ]
        if records:
            return StageOutput(model_used=cached.engine_key, regions=records)
    segmenter = get_segmenter(has_gpu=has_gpu, model_key=model_key)
    inputs = [
        SegmentInputRegion(
            id=seed["id"],
            bbox=(seed["bbox"][0], seed["bbox"][1], seed["bbox"][2], seed["bbox"][3]),
            source=seed["source"],
            detector_model_key=seed["detector_model_key"],
            ocr_model_key=seed["ocr_model_key"],
            translator_model_key=seed["translator_model_key"],
        )
        for seed in seeds
    ]
    try:
        results = await segmenter.segment(image_bytes=image_bytes, regions=inputs)
    finally:
        if not should_skip_gpu_release():
            release_gpu_memory()
    records = [
        SegmentRecord(
            id=result.id,
            bbox=[int(v) for v in result.bbox],
            segment_boxes=[[int(p) for p in box] for box in result.segment_boxes],
            merged_boxes=[[int(p) for p in box] for box in result.merged_boxes],
            source=normalize_stage_source(result.source),
            detector_model_key=result.detector_model_key,
            ocr_model_key=result.ocr_model_key,
            translator_model_key=result.translator_model_key,
            segment_model_key=result.segment_model_key or model_key or segmenter.key,
            mask_base64=_mask_base64(result),
        )
        for result in results
    ]
    if records:
        await asyncio.to_thread(
            resolved_store.put_segment,
            key=cache_key,
            records=records,
            engine_key=segmenter.key,
        )
    return StageOutput(model_used=segmenter.key, regions=records)


# --------------------------------------------------------------------------- clean


def mask_regions_from_records(records: Sequence[Mapping[str, object]]) -> list[MaskRegion]:
    regions: list[MaskRegion] = []
    for record in records:
        bbox = normalize_bbox(record.get("bbox"))
        if bbox is None:
            continue
        regions.append(
            MaskRegion(
                bbox=bbox,
                segment_boxes=normalize_boxes(record.get("segment_boxes")),
                merged_boxes=normalize_boxes(record.get("merged_boxes")),
            )
        )
    return regions


@dataclass(frozen=True, slots=True)
class _InpaintJob:
    image_rgb: RGBArray
    remaining_mask: MaskArray
    hd_strategy: str
    hybrid: bool


def _resolve_hd_strategy(requested: str | None, rgb: RGBArray, mask: MaskArray) -> str:
    if requested is not None and requested.strip():
        return requested
    return "crop" if detect_background_complexity(rgb, mask) == "complex" else "resize"


def _prepare_clean(
    rgb: RGBArray,
    mask_regions: Sequence[MaskRegion],
    settings: CleanSettings,
) -> CleanStageResult | _InpaintJob:
    """CPU-bound: mask generation + heuristics + (maybe) final encode."""
    fallback_strategy = settings.hd_strategy or "resize"
    mask = generate_baka_style_mask(
        image_width=rgb.shape[1],
        image_height=rgb.shape[0],
        regions=list(mask_regions),
        mask_dilation=settings.mask_dilation,
    )
    if not np.any(mask):
        return CleanStageResult("no-op", _encode_png(rgb), fallback_strategy)
    heuristic = apply_need_inpaint_heuristic(rgb, mask)
    if not heuristic.needs_model_inpaint:
        return CleanStageResult(
            heuristic.method_label, _encode_png(heuristic.image_rgb), fallback_strategy
        )
    return _InpaintJob(
        image_rgb=heuristic.image_rgb,
        remaining_mask=heuristic.remaining_mask,
        hd_strategy=_resolve_hd_strategy(
            settings.hd_strategy, rgb, heuristic.remaining_mask
        ),
        hybrid=heuristic.filled_components > 0,
    )


def _clean_working_plan(width: int, height: int) -> StageResolutionPlan | None:
    """Stage-time downscale plan for clean; None when the policy flag is off."""
    config = get_config()
    if not config.working_resolution_ocr_clean_enabled:
        return None
    return stage_resolution_plan(
        "clean", width, height, config.working_resolution_megapixels
    )


def _resize_for_inpaint(
    rgb: RGBArray, mask: MaskArray, plan: StageResolutionPlan
) -> tuple[RGBArray, MaskArray]:
    working_rgb = cv2.resize(
        rgb, (plan.working_width, plan.working_height), interpolation=cv2.INTER_CUBIC
    )
    working_mask = cv2.resize(
        mask, (plan.working_width, plan.working_height), interpolation=cv2.INTER_NEAREST
    )
    return cast(RGBArray, working_rgb), cast(MaskArray, working_mask)


def _resize_to_page(rgb: RGBArray, width: int, height: int) -> RGBArray:
    return cast(
        RGBArray, cv2.resize(rgb, (width, height), interpolation=cv2.INTER_CUBIC)
    )


async def run_clean_stage(
    *,
    image: Image.Image,
    has_gpu: bool,
    settings: CleanSettings,
    regions_for_mask: Sequence[Mapping[str, object]],
    default_detection_model: str,
    store: StageStore | None = None,
) -> CleanStageResult:
    rgb = cast(RGBArray, np.asarray(image, dtype=np.uint8))
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        raise InvalidImageError("The uploaded image is not valid RGB")

    mask_regions = mask_regions_from_records(regions_for_mask)
    if not mask_regions:
        detections = await _detect_plain(
            image, has_gpu=has_gpu, model_key=default_detection_model
        )
        mask_regions = mask_regions_from_records(detections)
    if not mask_regions:
        png = await asyncio.to_thread(_encode_png, rgb)
        return CleanStageResult("no-op", png, settings.hd_strategy or "resize")

    resolved_store = store if store is not None else get_stage_store()
    cache_key = build_clean_cache_key(
        image_hash=hash_image_array(rgb),
        mask_fingerprint=fingerprint_mask_regions(mask_regions),
        settings_fingerprint=fingerprint_clean_settings(
            {
                "model_key": settings.model_key,
                "mask_dilation": settings.mask_dilation,
                "hd_strategy": settings.hd_strategy,
                "hd_strategy_resize_limit": settings.hd_strategy_resize_limit,
                "hd_strategy_crop_margin": settings.hd_strategy_crop_margin,
                "hd_strategy_crop_trigger_size": settings.hd_strategy_crop_trigger_size,
            }
        ),
        default_detection_model=default_detection_model,
    )
    cached = await asyncio.to_thread(resolved_store.get_clean, cache_key)
    if cached is not None:
        return CleanStageResult(cached.model_used, cached.png, cached.hd_strategy)

    prepared = await asyncio.to_thread(_prepare_clean, rgb, mask_regions, settings)
    if isinstance(prepared, CleanStageResult):
        await asyncio.to_thread(
            resolved_store.put_clean,
            key=cache_key,
            png=prepared.png,
            model_used=prepared.model_used,
            hd_strategy=prepared.hd_strategy,
        )
        return prepared

    plan = _clean_working_plan(rgb.shape[1], rgb.shape[0])
    job_rgb = prepared.image_rgb
    job_mask = prepared.remaining_mask
    if plan is not None and plan.downscaled:
        job_rgb, job_mask = await asyncio.to_thread(
            _resize_for_inpaint, job_rgb, job_mask, plan
        )
    inpainter = get_inpainter(
        has_gpu=has_gpu, image_complexity="auto", model_key=settings.model_key
    )
    try:
        inpainted = await inpainter.inpaint(
            job_rgb,
            job_mask,
            InpaintConfig(
                hd_strategy=HDStrategy.from_value(prepared.hd_strategy),
                hd_strategy_resize_limit=settings.hd_strategy_resize_limit,
                hd_strategy_crop_margin=settings.hd_strategy_crop_margin,
                hd_strategy_crop_trigger_size=settings.hd_strategy_crop_trigger_size,
            ),
        )
    finally:
        if not should_skip_gpu_release():
            release_gpu_memory()
    output_rgb = cast(RGBArray, inpainted)
    if plan is not None and plan.downscaled:
        output_rgb = await asyncio.to_thread(
            _resize_to_page, output_rgb, rgb.shape[1], rgb.shape[0]
        )
    png = await asyncio.to_thread(_encode_png, output_rgb)
    model_used = f"hybrid:{inpainter.key}" if prepared.hybrid else inpainter.key
    await asyncio.to_thread(
        resolved_store.put_clean,
        key=cache_key,
        png=png,
        model_used=model_used,
        hd_strategy=prepared.hd_strategy,
    )
    return CleanStageResult(model_used, png, prepared.hd_strategy)
