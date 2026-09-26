"""Stage runners. Every async function here awaits model I/O and pushes
CPU-bound numpy/OpenCV/PIL work to a worker thread — the event loop stays free."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from functools import cache
import inspect
from collections.abc import Awaitable, Callable
from typing import Protocol, cast

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image

from core.device import release_gpu_memory
from models.detection.factory import get_detector
from models.inpainting.base_inpainter import HDStrategy, InpaintConfig
from models.inpainting.factory import get_inpainter
from models.ocr.base_ocr import OCRInputRegion
from models.ocr.factory import get_ocr_engine
from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.factory import get_segmenter
from models.translation.base_translator import TranslationInputRegion
from models.translation.factory import get_translation_engine
from models.translation.providers import (
    build_current_image_translation_context,
    build_request_scoped_custom_translation_engine,
    compose_translation_extra_context,
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
from routers import ocr as ocr_router
from routers import translation as translation_router
from utils.detection_fallback import detect_with_fallbacks
from utils.inpaint_heuristics import (
    apply_need_inpaint_heuristic,
    detect_background_complexity,
)
from utils.mask import MaskRegion, generate_baka_style_mask
from utils.ocr_fallback import recognize_with_fallbacks

type RGBArray = NDArray[np.uint8]
type MaskArray = NDArray[np.uint8]


class LLMRequestSettings(Protocol):
    """Structural view of the object returned by ``clamp_llm_request_settings``."""

    @property
    def extra_context(self) -> str | None: ...
    @property
    def translation_notes_enabled(self) -> bool: ...
    @property
    def neighbor_image_context_enabled(self) -> bool: ...


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


def _decode_rgb(image_bytes: bytes) -> Image.Image:
    from io import BytesIO

    from PIL import UnidentifiedImageError

    try:
        with Image.open(BytesIO(image_bytes)) as source:
            return source.convert("RGB")
    except UnidentifiedImageError as exc:
        raise InvalidImageError("Invalid image file") from exc
    except OSError as exc:
        raise InvalidImageError(f"Failed to read the image: {exc}") from exc


async def open_rgb_image(image_bytes: bytes) -> Image.Image:
    return await asyncio.to_thread(_decode_rgb, image_bytes)


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
    detector = get_detector(task="text", has_gpu=has_gpu, model_key=model_key)
    try:
        detections = await detector.detect(image)
    finally:
        release_gpu_memory()
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
            image, cast("Callable[[Image.Image], Awaitable[list[object]]]", detector.detect)
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


def _seed_from_detection(det: DetectionRecord, default_model: str) -> OCRSeed:
    return OCRSeed(
        id=det["id"],
        bbox=list(det["bbox"]),
        source=det["source"],
        detector_model_key=det["model_key"] or default_model,
    )


def _enrich_ocr_record(image: Image.Image, record: OCRRecord) -> OCRRecord:
    # The enricher's contract is "same record plus gradient keys"; the cast
    # re-attaches the TypedDict view the plain-dict boundary drops.
    return cast(OCRRecord, ocr_router.enrich_ocr_record_with_gradient(image, dict(record)))


async def run_ocr_stage(
    *,
    image: Image.Image,
    image_bytes: bytes,
    source_language: str,
    model_key: str | None,
    has_gpu: bool,
    default_detection_model: str,
    detected_regions: Sequence[DetectionRecord],
    cancellation_event: asyncio.Event,
) -> StageOutput[OCRRecord]:
    seeds = [_seed_from_detection(det, default_detection_model) for det in detected_regions]
    if not seeds:
        plain = await _detect_plain(
            image, has_gpu=has_gpu, model_key=default_detection_model
        )
        seeds = [_seed_from_detection(det, default_detection_model) for det in plain]
    if not seeds:
        return StageOutput(model_used=model_key or "", regions=[])

    engine = get_ocr_engine(language=source_language, has_gpu=has_gpu, model_key=model_key)
    cache_manager = ocr_router.CACHE_MANAGER
    cache_key = cache_manager.build_ocr_cache_key(
        image_bytes=image_bytes, language=source_language, model_key=engine.key
    )
    cached_by_id, missing = cache_manager.get_cached_ocr_for_regions(
        cache_key, [dict(seed) for seed in seeds]
    )
    missing_seeds = [cast(OCRSeed, region) for region in missing]

    fresh_by_id: dict[str, OCRRecord] = {}
    if missing_seeds:
        inputs = [
            OCRInputRegion(
                id=seed["id"],
                bbox=(seed["bbox"][0], seed["bbox"][1], seed["bbox"][2], seed["bbox"][3]),
                source=seed["source"],
                detector_model_key=seed["detector_model_key"],
            )
            for seed in missing_seeds
        ]
        try:
            results = await recognize_with_fallbacks(
                engine=engine,
                image=image,
                regions=inputs,
                language=source_language,
                cancellation_event=cancellation_event,
            )
        finally:
            release_gpu_memory()
        raw_fresh = [
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
            lambda: [_enrich_ocr_record(image, record) for record in raw_fresh]
        )
        fresh_by_id = {record["id"]: record for record in fresh}
        cache_manager.cache_ocr_results(cache_key, [dict(record) for record in fresh])

    def _merge() -> list[OCRRecord]:
        merged: list[OCRRecord] = []
        for seed in seeds:
            fresh_record = fresh_by_id.get(seed["id"])
            if fresh_record is not None:
                merged.append(fresh_record)  # already enriched above
                continue
            cached = cached_by_id.get(seed["id"])
            record = (
                cast(OCRRecord, cached)
                if cached is not None
                else OCRRecord(
                    id=seed["id"],
                    bbox=list(seed["bbox"]),
                    text="",
                    score=0.0,
                    source=seed["source"],
                    detector_model_key=seed["detector_model_key"],
                    ocr_model_key=engine.key,
                )
            )
            merged.append(_enrich_ocr_record(image, record))
        return merged

    return StageOutput(model_used=engine.key, regions=await asyncio.to_thread(_merge))


# --------------------------------------------------------------------------- translate


@cache
def _translate_accepts_notes_flag(engine_type: type) -> bool:
    try:
        params = inspect.signature(engine_type.translate).parameters
    except (TypeError, ValueError):
        return False
    return "translation_notes_enabled" in params or any(
        p.kind is inspect.Parameter.VAR_KEYWORD for p in params.values()
    )


def _translation_input(region: Mapping[str, object]) -> TranslationInputRegion:
    return TranslationInputRegion(
        id=str(region.get("id") or ""),
        text=str(region.get("text") or ""),
        source=str(region.get("source") or "model"),
        detector_model_key=str(region.get("detector_model_key") or ""),
        ocr_model_key=str(region.get("ocr_model_key") or ""),
    )


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
    if not ocr_regions:
        return StageOutput(model_used=model_key or "", regions=[])

    requested_key = (model_key or "").strip()
    settings_payload = dict(vars(settings))
    if requested_key == "custom" or requested_key.startswith("custom:"):
        engine = build_request_scoped_custom_translation_engine(
            selected_model_key=requested_key,
            custom_llm=dict(custom_llm) if custom_llm is not None else None,
            llm_settings=settings_payload,
        )
    else:
        engine = get_translation_engine(model_key=model_key)

    inputs = [_translation_input(region) for region in ocr_regions]
    effective_context = compose_translation_extra_context(
        settings.extra_context or extra_context,
        build_current_image_translation_context(inputs),
        neighbor_context,
    )
    request_regions: list[dict[str, object]] = [
        {
            "id": item.id,
            "text": item.text,
            "source": item.source,
            "detector_model_key": item.detector_model_key,
            "ocr_model_key": item.ocr_model_key,
        }
        for item in inputs
    ]
    cache_manager = translation_router.CACHE_MANAGER
    cache_key = cache_manager.build_translation_cache_key(
        model_key=requested_key or engine.key,
        source_language=source_language,
        target_language=target_language,
        extra_context=effective_context,
        llm_settings=settings_payload,
        custom_llm=dict(custom_llm) if custom_llm is not None else None,
    )
    cached_by_id, missing = cache_manager.get_cached_translations_for_regions(
        cache_key, request_regions
    )

    fresh_by_id: dict[str, TranslationRecord] = {}
    if missing:
        missing_inputs = [_translation_input(region) for region in missing]
        if _translate_accepts_notes_flag(type(engine)):
            translated = await engine.translate(
                regions=missing_inputs,
                source_language=source_language,
                target_language=target_language,
                extra_context=effective_context,
                translation_notes_enabled=settings.translation_notes_enabled,
            )
        else:
            translated = await engine.translate(
                regions=missing_inputs,
                source_language=source_language,
                target_language=target_language,
                extra_context=effective_context,
            )
        fresh = [
            TranslationRecord(
                id=item.id,
                source_text=item.source_text,
                translated_text=item.translated_text,
                translation_notes=list(item.translation_notes),
                source=item.source,
                detector_model_key=item.detector_model_key,
                ocr_model_key=item.ocr_model_key,
                translator_model_key=item.translator_model_key or engine.key,
            )
            for item in translated
        ]
        fresh_by_id = {record["id"]: record for record in fresh}
        cache_manager.cache_translation_results(
            cache_key, [dict(record) for record in fresh]
        )

    merged: list[TranslationRecord] = []
    for item in inputs:
        resolved = fresh_by_id.get(item.id)
        if resolved is None:
            cached = cached_by_id.get(item.id)
            resolved = (
                cast(TranslationRecord, cached)
                if cached is not None
                else TranslationRecord(
                    id=item.id,
                    source_text=item.text.strip(),
                    translated_text="",
                    translation_notes=[],
                    source=item.source,
                    detector_model_key=item.detector_model_key,
                    ocr_model_key=item.ocr_model_key,
                    translator_model_key=engine.key,
                )
            )
        merged.append(resolved)
    return StageOutput(model_used=requested_key or engine.key, regions=merged)


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
