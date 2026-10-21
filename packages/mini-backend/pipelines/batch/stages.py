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

from core.config import LLMRequestSettings
from core.device import DeviceInfo, release_gpu_memory
from models.detection.base_detector import TextDetection
from models.detection.factory import get_detector
from models.inpainting.base_inpainter import HDStrategy, InpaintConfig
from models.inpainting.factory import get_inpainter
from pipelines.ocr_stage import CachedOcrRequest, run_cached_ocr
from pipelines.detection_seeds import (
    detect_text_seeds,
    ocr_seeds_from_detections,
    run_text_detector,
)
from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.factory import get_segmenter
from models.translation.stage import (
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
from utils.detection_fallback import detect_with_fallbacks
from utils.image_codec import ImageDecodeError, decode_pil
from utils.inpaint_heuristics import (
    apply_need_inpaint_heuristic,
    detect_background_complexity,
)
from utils.mask import MaskRegion, generate_baka_style_mask

type RGBArray = NDArray[np.uint8]
type MaskArray = NDArray[np.uint8]


@dataclass(frozen=True, slots=True)
class StageOutput[T]:
    model_used: str
    regions: list[T]


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
    bbox = normalize_bbox(getattr(det, "bbox", None))
    if bbox is None:
        raise InvalidImageError(f"Detector returned an invalid bbox for region {index}")
    score = optional_float(getattr(det, "score", None))
    return DetectionRecord(
        id=f"det-{index}",
        bbox=list(bbox),
        score=round(1.0 if score is None else score, 4),
        label=str(getattr(det, "label", "text")),
        source=normalize_stage_source(getattr(det, "source", "model")),
        model_key=str(getattr(det, "model_key", "") or fallback_model),
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


async def run_detect_stage(
    *,
    image: Image.Image,
    has_gpu: bool,
    model_key: str | None,
    default_detection_model: str,
) -> StageOutput[DetectionRecord]:
    resolved_model = model_key or default_detection_model
    detector = get_detector(task="text", has_gpu=has_gpu, model_key=resolved_model)
    try:
        detections, variant = await detect_with_fallbacks(
            image,
            cast("Callable[[Image.Image], Awaitable[Sequence[TextDetection]]]", detector.detect),
        )
    finally:
        release_gpu_memory()
    records = [
        detection_to_record(det, index, resolved_model)
        for index, det in enumerate(detections, start=1)
    ]
    model_used = records[-1]["model_key"] if records else resolved_model
    return StageOutput(
        model_used=model_used if variant == "original" else f"{model_used}@{variant}",
        regions=records,
    )


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
    return StageOutput(model_used=result.engine_key, regions=list(result.records))


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


async def run_segment_stage(
    *,
    image_bytes: bytes,
    has_gpu: bool,
    model_key: str | None,
    seeds: Sequence[SegmentSeed],
) -> StageOutput[SegmentRecord]:
    if not seeds:
        return StageOutput(model_used=model_key or "", regions=[])
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
        )
        for result in results
    ]
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


async def run_clean_stage(
    *,
    image: Image.Image,
    has_gpu: bool,
    settings: CleanSettings,
    regions_for_mask: Sequence[Mapping[str, object]],
    default_detection_model: str,
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

    prepared = await asyncio.to_thread(_prepare_clean, rgb, mask_regions, settings)
    if isinstance(prepared, CleanStageResult):
        return prepared

    inpainter = get_inpainter(
        has_gpu=has_gpu, image_complexity="auto", model_key=settings.model_key
    )
    try:
        inpainted = await inpainter.inpaint(
            prepared.image_rgb,
            prepared.remaining_mask,
            InpaintConfig(
                hd_strategy=HDStrategy.from_value(prepared.hd_strategy),
                hd_strategy_resize_limit=settings.hd_strategy_resize_limit,
                hd_strategy_crop_margin=settings.hd_strategy_crop_margin,
                hd_strategy_crop_trigger_size=settings.hd_strategy_crop_trigger_size,
            ),
        )
    finally:
        release_gpu_memory()
    png = await asyncio.to_thread(_encode_png, cast(RGBArray, inpainted))
    model_used = f"hybrid:{inpainter.key}" if prepared.hybrid else inpainter.key
    return CleanStageResult(model_used, png, prepared.hd_strategy)
