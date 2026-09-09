from __future__ import annotations

import asyncio
from dataclasses import dataclass
from io import BytesIO
import json
import logging
import re
from typing import Any
import zipfile

import cv2
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
import numpy as np
from PIL import Image, UnidentifiedImageError

from core.config import clamp_llm_request_settings, get_config
from core.device import (
    build_device_payload,
    get_device_info,
    release_gpu_memory,
    release_onnx_gpu_memory,
)
from core.languages import (
    get_source_language_options,
    get_target_language_options,
    normalize_language_code,
)
from models.detection.factory import get_detector, list_detection_models
from models.detection.font_style import YuzuFontStyleDetector
from models.detection.font_style.storage import font_style_runtime_ready
from models.inpainting.base_inpainter import HDStrategy, InpaintConfig
from models.inpainting.factory import get_inpainter, list_inpainting_models
from models.ocr.base_ocr import OCRInputRegion
from models.ocr.factory import get_ocr_engine, list_ocr_models
from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.factory import get_segmenter, list_segmentation_models
from models.translation.base_translator import TranslationInputRegion
from models.translation.factory import get_translation_engine, list_translation_models
from models.translation.providers import (
    build_current_image_translation_context,
    build_request_scoped_custom_translation_engine,
    compose_translation_extra_context,
)
from pipelines.queue_processor import QueueProcessor
from routers import ocr as ocr_router
from routers import translation as translation_router
from schemas.pipeline_batch import (
    BatchItemError,
    BatchItemResult,
    BatchReport,
    BatchStageConfig,
)
from utils.detection_fallback import detect_with_fallbacks
from utils.inpaint_heuristics import (
    apply_need_inpaint_heuristic,
    detect_background_complexity,
)
from utils.mask import MaskRegion, generate_baka_style_mask
from utils.ocr_fallback import recognize_with_fallbacks


router = APIRouter(tags=["pipeline"])
logger = logging.getLogger(__name__)

# Per-image timeout for pipeline batch processing (seconds).
# Must be generous: a single large image with many OCR regions can require
# 50+ ONNX inference calls (17 regions × 3 fallback passes).
_PIPELINE_PER_IMAGE_TIMEOUT = 600.0
# Interval for checking client disconnect (seconds).
_DISCONNECT_CHECK_INTERVAL = 2.0


def _resolve_clean_hd_strategy(
    requested: str | None,
    image_rgb: np.ndarray,
    mask: np.ndarray,
) -> str:
    if requested is not None and requested.strip():
        return requested
    return (
        "crop"
        if detect_background_complexity(image_rgb, mask) == "complex"
        else "resize"
    )


async def _monitor_client_disconnect(
    request: Request,
    cancellation_event: asyncio.Event,
) -> None:
    """Background task that sets *cancellation_event* when the client disconnects."""
    try:
        while not cancellation_event.is_set():
            if await request.is_disconnected():
                logger.info("client disconnected, signalling cancellation")
                cancellation_event.set()
                return
            await asyncio.sleep(_DISCONNECT_CHECK_INTERVAL)
    except Exception:  # noqa: BLE001
        # Best-effort only — if the check itself fails, stop monitoring silently.
        pass


def _build_neighbor_image_translation_context(
    ocr_by_index: dict[int, list[dict[str, Any]]],
    current_index: int,
    *,
    enabled: bool,
    max_items_per_neighbor: int = 8,
    max_chars_per_neighbor: int = 800,
) -> str:
    if not enabled:
        return ""

    blocks: list[str] = []
    for neighbor_index, label in (
        (current_index - 1, "Previous page context"),
        (current_index + 1, "Next page context"),
    ):
        neighbor_regions = ocr_by_index.get(neighbor_index) or []
        useful = [
            region
            for region in neighbor_regions
            if str(region.get("text") or "").strip()
        ]
        if not useful:
            continue
        lines: list[str] = []
        total_chars = 0
        for region in useful[:max_items_per_neighbor]:
            candidate = f"- id={str(region.get('id') or '').strip()} text={str(region.get('text') or '').strip()}"
            if (
                total_chars
                and total_chars + 1 + len(candidate) > max_chars_per_neighbor
            ):
                lines.append("... [context truncated]")
                break
            lines.append(candidate)
            total_chars += len(candidate) + 1
        if lines:
            blocks.append(f"{label}:\n" + "\n".join(lines))
    return "\n\n".join(blocks)


@dataclass
class _BatchImageTask:
    index: int
    filename: str
    image_bytes: bytes


def _clamp_int(value: int | None, fallback: int, minimum: int, maximum: int) -> int:
    if value is None:
        return max(minimum, min(maximum, int(fallback)))
    return max(minimum, min(maximum, int(value)))


def _safe_filename(filename: str, fallback_index: int) -> str:
    name = (filename or "").strip()
    if "." in name:
        name = name.rsplit(".", 1)[0]
    name = re.sub(r"[^a-zA-Z0-9._-]+", "-", name).strip("-_.")
    if not name:
        name = f"image-{fallback_index + 1}"
    return f"{name}.png"


def _normalize_stage_source(value: str | None) -> str:
    return value if value in {"model", "manual"} else "model"


def _parse_optional_custom_llm(raw_custom_llm: str | None) -> dict[str, Any] | None:
    if not raw_custom_llm:
        return None
    try:
        payload = json.loads(raw_custom_llm)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid translation_custom_llm field (JSON)"
        ) from exc
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=400,
            detail="The translation_custom_llm field must be a JSON object",
        )
    return payload


def _normalize_bbox(value: Any) -> tuple[int, int, int, int] | None:
    if not isinstance(value, (list, tuple)) or len(value) < 4:
        return None
    try:
        x1, y1, x2, y2 = (int(v) for v in value[:4])
    except (TypeError, ValueError):
        return None
    return x1, y1, x2, y2


def _normalize_boxes(value: Any) -> list[tuple[int, int, int, int]]:
    if not isinstance(value, (list, tuple)):
        return []
    normalized: list[tuple[int, int, int, int]] = []
    for box in value:
        parsed = _normalize_bbox(box)
        if parsed is not None:
            normalized.append(parsed)
    return normalized


def _open_rgb_image(image_bytes: bytes) -> Image.Image:
    source = Image.open(BytesIO(image_bytes))
    try:
        return source.convert("RGB")
    finally:
        source.close()


def _build_clean_mask_regions(regions: list[dict[str, Any]]) -> list[MaskRegion]:
    mask_regions: list[MaskRegion] = []
    for region in regions:
        normalized_bbox = _normalize_bbox(region.get("bbox"))
        if normalized_bbox is None:
            continue
        mask_regions.append(
            MaskRegion(
                bbox=normalized_bbox,
                segment_boxes=_normalize_boxes(region.get("segment_boxes")),
                merged_boxes=_normalize_boxes(region.get("merged_boxes")),
            )
        )
    return mask_regions


async def _run_ocr_stage(
    *,
    image: Image.Image,
    image_bytes: bytes,
    source_language: str,
    model_key: str | None,
    has_gpu: bool,
    default_detection_model: str,
    detected_regions: list[dict[str, Any]] | None = None,
    cancellation_event: asyncio.Event | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    request_regions: list[dict[str, Any]] = []
    for index, detection in enumerate(detected_regions or [], start=1):
        normalized_bbox = _normalize_bbox(detection.get("bbox"))
        if normalized_bbox is None:
            continue
        source = _normalize_stage_source(str(detection.get("source") or "model"))
        detector_model_key = str(detection.get("model_key") or default_detection_model)
        region_id = str(detection.get("id") or f"det-{index}")
        request_regions.append(
            {
                "id": region_id,
                "bbox": [int(v) for v in normalized_bbox],
                "source": source,
                "detector_model_key": detector_model_key,
            }
        )

    if not request_regions:
        detector = get_detector(
            task="text",
            has_gpu=has_gpu,
            model_key=default_detection_model,
        )
        try:
            detections = await detector.detect(image)
        finally:
            release_gpu_memory()
        request_regions = [
            {
                "id": f"det-{index}",
                "bbox": [int(v) for v in det.bbox],
                "source": _normalize_stage_source(getattr(det, "source", "model")),
                "detector_model_key": str(
                    getattr(det, "model_key", "") or default_detection_model
                ),
            }
            for index, det in enumerate(detections, start=1)
        ]

    if not request_regions:
        return model_key or "", []

    engine = get_ocr_engine(
        language=source_language,
        has_gpu=has_gpu,
        model_key=model_key,
    )
    cache_key = ocr_router.CACHE_MANAGER.build_ocr_cache_key(
        image_bytes=image_bytes,
        language=source_language,
        model_key=engine.key,
    )
    cached_by_id, missing_regions = ocr_router.CACHE_MANAGER.get_cached_ocr_for_regions(
        cache_key,
        request_regions,
    )

    fresh_by_id: dict[str, dict[str, Any]] = {}
    if missing_regions:
        fresh_regions = [
            OCRInputRegion(
                id=str(region["id"]),
                bbox=tuple(int(v) for v in region["bbox"]),
                source=_normalize_stage_source(str(region.get("source") or "model")),
                detector_model_key=str(region.get("detector_model_key") or ""),
            )
            for region in missing_regions
        ]
        try:
            ocr_results = await recognize_with_fallbacks(
                engine=engine,
                image=image,
                regions=fresh_regions,
                language=source_language,
                cancellation_event=cancellation_event,
            )
        finally:
            release_gpu_memory()
        fresh_records = [
            ocr_router.enrich_ocr_record_with_gradient(
                image,
                {
                    "id": result.id,
                    "bbox": [int(v) for v in result.bbox],
                    "text": result.text,
                    "score": float(result.score),
                    "source": _normalize_stage_source(result.source),
                    "detector_model_key": result.detector_model_key,
                    "ocr_model_key": result.model_key or engine.key,
                },
            )
            for result in ocr_results
        ]
        fresh_by_id = {str(item["id"]): item for item in fresh_records}
        ocr_router.CACHE_MANAGER.cache_ocr_results(cache_key, fresh_records)

    merged: list[dict[str, Any]] = []
    for region in request_regions:
        region_id = str(region["id"])
        resolved = fresh_by_id.get(region_id) or cached_by_id.get(region_id)
        if resolved is None:
            resolved = {
                "id": region_id,
                "bbox": [int(v) for v in region["bbox"]],
                "text": "",
                "score": 0.0,
                "source": _normalize_stage_source(str(region.get("source") or "model")),
                "detector_model_key": str(region.get("detector_model_key") or ""),
                "ocr_model_key": engine.key,
            }
        merged.append(ocr_router.enrich_ocr_record_with_gradient(image, resolved))

    return engine.key, merged


async def _run_detect_stage(
    *,
    image: Image.Image,
    has_gpu: bool,
    model_key: str | None,
    default_detection_model: str,
) -> tuple[str, list[dict[str, Any]]]:
    detector = get_detector(
        task="text",
        has_gpu=has_gpu,
        model_key=model_key or default_detection_model,
    )
    try:
        detections, detection_variant = await detect_with_fallbacks(
            image,
            lambda variant_image: detector.detect(variant_image),
        )
    finally:
        release_gpu_memory()
    resolved_model = str(model_key or default_detection_model)
    response_boxes: list[dict[str, Any]] = []
    for index, det in enumerate(detections, start=1):
        current_model = str(getattr(det, "model_key", "") or resolved_model)
        resolved_model = current_model
        response_boxes.append(
            {
                "id": f"det-{index}",
                "bbox": [int(v) for v in det.bbox],
                "score": round(float(getattr(det, "score", 1.0)), 4),
                "label": str(getattr(det, "label", "text")),
                "source": _normalize_stage_source(getattr(det, "source", "model")),
                "model_key": current_model,
                "foreground_rgb": (
                    [int(channel) for channel in getattr(det, "foreground_rgb")]
                    if getattr(det, "foreground_rgb", None) is not None
                    else None
                ),
                "structural_type": getattr(det, "structural_type", None),
                "structural_confidence": getattr(det, "structural_confidence", None),
                "structural_source": getattr(det, "structural_source", None),
                "matched_reference_image": getattr(
                    det, "matched_reference_image", None
                ),
            }
        )
    return (
        resolved_model
        if detection_variant == "original"
        else f"{resolved_model}@{detection_variant}",
        response_boxes,
    )


async def _run_translation_stage(
    *,
    model_key: str | None,
    source_language: str,
    target_language: str,
    extra_context: str,
    llm_settings: dict[str, Any] | None,
    ocr_regions: list[dict[str, Any]],
    custom_llm: dict[str, Any] | None = None,
    neighbor_context: str = "",
) -> tuple[str, list[dict[str, Any]]]:
    if not ocr_regions:
        return model_key or "", []

    settings = clamp_llm_request_settings(llm_settings)
    requested_model_key = str(model_key or "").strip()
    use_request_scoped_custom_engine = (
        requested_model_key == "custom" or requested_model_key.startswith("custom:")
    )
    if use_request_scoped_custom_engine:
        engine = build_request_scoped_custom_translation_engine(
            selected_model_key=requested_model_key,
            custom_llm=custom_llm,
            llm_settings=settings.__dict__,
        )
    else:
        engine = get_translation_engine(model_key=model_key)
    current_image_context = build_current_image_translation_context(
        [
            TranslationInputRegion(
                id=str(region.get("id") or ""),
                text=str(region.get("text") or ""),
                source=str(region.get("source") or "model"),
                detector_model_key=str(region.get("detector_model_key") or ""),
                ocr_model_key=str(region.get("ocr_model_key") or ""),
            )
            for region in ocr_regions
        ]
    )
    effective_extra_context = compose_translation_extra_context(
        settings.extra_context or extra_context,
        current_image_context,
        neighbor_context,
    )
    request_regions = [
        {
            "id": str(region.get("id") or ""),
            "text": str(region.get("text") or ""),
            "source": str(region.get("source") or "model"),
            "detector_model_key": str(region.get("detector_model_key") or ""),
            "ocr_model_key": str(region.get("ocr_model_key") or ""),
        }
        for region in ocr_regions
    ]
    cache_key = translation_router.CACHE_MANAGER.build_translation_cache_key(
        model_key=requested_model_key or engine.key,
        source_language=source_language,
        target_language=target_language,
        extra_context=effective_extra_context,
        llm_settings=settings.__dict__,
        custom_llm=custom_llm,
    )
    cached_by_id, missing_regions = (
        translation_router.CACHE_MANAGER.get_cached_translations_for_regions(
            cache_key,
            request_regions,
        )
    )

    fresh_by_id: dict[str, dict[str, Any]] = {}
    if missing_regions:
        translation_inputs = [
            TranslationInputRegion(
                id=str(region["id"]),
                text=str(region.get("text") or ""),
                source=str(region.get("source") or "model"),
                detector_model_key=str(region.get("detector_model_key") or ""),
                ocr_model_key=str(region.get("ocr_model_key") or ""),
            )
            for region in missing_regions
        ]
        try:
            translated = await engine.translate(
                regions=translation_inputs,
                source_language=source_language,
                target_language=target_language,
                extra_context=effective_extra_context,
                translation_notes_enabled=settings.translation_notes_enabled,
            )
        except TypeError as exc:
            if "translation_notes_enabled" not in str(exc):
                raise
            translated = await engine.translate(
                regions=translation_inputs,
                source_language=source_language,
                target_language=target_language,
                extra_context=effective_extra_context,
            )
        fresh_records = [
            {
                "id": item.id,
                "source_text": item.source_text,
                "translated_text": item.translated_text,
                "translation_notes": list(item.translation_notes),
                "source": item.source,
                "detector_model_key": item.detector_model_key,
                "ocr_model_key": item.ocr_model_key,
                "translator_model_key": item.translator_model_key or engine.key,
            }
            for item in translated
        ]
        fresh_by_id = {str(item["id"]): item for item in fresh_records}
        translation_router.CACHE_MANAGER.cache_translation_results(
            cache_key, fresh_records
        )

    merged: list[dict[str, Any]] = []
    for region in request_regions:
        region_id = str(region["id"])
        resolved = fresh_by_id.get(region_id) or cached_by_id.get(region_id)
        if resolved is None:
            resolved = {
                "id": region_id,
                "source_text": str(region.get("text") or "").strip(),
                "translated_text": "",
                "translation_notes": [],
                "source": str(region.get("source") or "model"),
                "detector_model_key": str(region.get("detector_model_key") or ""),
                "ocr_model_key": str(region.get("ocr_model_key") or ""),
                "translator_model_key": engine.key,
            }
        merged.append(resolved)

    return requested_model_key or engine.key, merged


_FONT_STYLE_DETECTOR: YuzuFontStyleDetector | None = None


def _get_font_style_detector() -> YuzuFontStyleDetector | None:
    """Return font style detector if model is bundled, else None."""
    global _FONT_STYLE_DETECTOR
    if not font_style_runtime_ready():
        return None
    if _FONT_STYLE_DETECTOR is None:
        _FONT_STYLE_DETECTOR = YuzuFontStyleDetector()
    return _FONT_STYLE_DETECTOR


def clear_font_style_detector() -> None:
    """Release the global font style detector singleton and free its resources."""
    global _FONT_STYLE_DETECTOR
    _FONT_STYLE_DETECTOR = None


def _enrich_regions_with_font_style(
    image: Image.Image,
    detected_regions: list[dict[str, Any]],
) -> None:
    """Run YuzuMarker font style detection and attach results to each region in-place."""
    detector = _get_font_style_detector()
    if detector is None or not detected_regions:
        return
    page_w, page_h = image.size
    crops: list[Image.Image] = []
    valid_indices: list[int] = []
    for idx, region in enumerate(detected_regions):
        bbox = region.get("bbox")
        if not bbox or len(bbox) < 4:
            continue
        x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(page_w, x2), min(page_h, y2)
        if x2 <= x1 or y2 <= y1:
            continue
        crops.append(image.crop((x1, y1, x2, y2)))
        valid_indices.append(idx)
    if not crops:
        return
    try:
        predictions = detector.detect(
            crops, original_widths=[page_w] * len(crops), top_k=1
        )
        for i, pred in enumerate(predictions):
            detected_regions[valid_indices[i]]["font_style"] = pred.to_dict()
    except Exception:
        logger.debug("Font style detection failed, skipping enrichment", exc_info=True)


async def _run_segment_stage(
    *,
    image_bytes: bytes,
    has_gpu: bool,
    model_key: str | None,
    regions: list[dict[str, Any]],
) -> tuple[str, list[dict[str, Any]]]:
    if not regions:
        return model_key or "", []

    segmenter = get_segmenter(
        has_gpu=has_gpu,
        model_key=model_key,
    )
    input_regions = [
        SegmentInputRegion(
            id=str(region.get("id") or ""),
            bbox=tuple(int(v) for v in region.get("bbox", [0, 0, 0, 0])[:4]),
            source=_normalize_stage_source(str(region.get("source") or "model")),
            detector_model_key=str(region.get("detector_model_key") or ""),
            ocr_model_key=str(region.get("ocr_model_key") or ""),
            translator_model_key=str(region.get("translator_model_key") or ""),
        )
        for region in regions
        if _normalize_bbox(region.get("bbox")) is not None
    ]
    if not input_regions:
        return segmenter.key, []

    try:
        segment_results = await segmenter.segment(
            image_bytes=image_bytes,
            regions=input_regions,
        )
    finally:
        release_gpu_memory()
    response_regions = [
        {
            "id": result.id,
            "bbox": [int(v) for v in result.bbox],
            "segment_boxes": [[int(p) for p in box] for box in result.segment_boxes],
            "merged_boxes": [[int(p) for p in box] for box in result.merged_boxes],
            "source": _normalize_stage_source(result.source),
            "detector_model_key": result.detector_model_key,
            "ocr_model_key": result.ocr_model_key,
            "translator_model_key": result.translator_model_key,
            "segment_model_key": result.segment_model_key
            or (model_key or segmenter.key),
        }
        for result in segment_results
    ]
    return segmenter.key, response_regions


async def _run_clean_stage(
    *,
    image: Image.Image,
    has_gpu: bool,
    model_key: str | None,
    regions_for_mask: list[dict[str, Any]],
    default_detection_model: str,
    mask_dilation: int,
    hd_strategy: str | None,
    hd_strategy_resize_limit: int,
    hd_strategy_crop_margin: int,
    hd_strategy_crop_trigger_size: int,
) -> tuple[str, bytes]:
    rgb_image = np.array(image.convert("RGB"))
    if rgb_image.ndim != 3 or rgb_image.shape[2] != 3:
        raise RuntimeError("The uploaded image is not valid RGB")

    mask_regions = _build_clean_mask_regions(regions_for_mask)
    if not mask_regions:
        detector = get_detector(
            task="text",
            has_gpu=has_gpu,
            model_key=default_detection_model,
        )
        try:
            detections = await detector.detect(image)
        finally:
            release_gpu_memory()
        mask_regions = [
            MaskRegion(
                bbox=tuple(int(v) for v in det.bbox),
                segment_boxes=[],
                merged_boxes=[],
            )
            for det in detections
        ]

    if not mask_regions:
        ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR))
        if not ok:
            raise RuntimeError("Failed to encode the image without cleaning")
        return "no-op", encoded.tobytes()

    mask = generate_baka_style_mask(
        image_width=rgb_image.shape[1],
        image_height=rgb_image.shape[0],
        regions=mask_regions,
        mask_dilation=mask_dilation,
        image_rgb=rgb_image,
    )
    if not np.any(mask):
        ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR))
        if not ok:
            raise RuntimeError("Failed to encode the image without cleaning")
        return "no-op", encoded.tobytes()

    heuristic = apply_need_inpaint_heuristic(rgb_image, mask)
    if not heuristic.needs_model_inpaint:
        ok, encoded = cv2.imencode(
            ".png", cv2.cvtColor(heuristic.image_rgb, cv2.COLOR_RGB2BGR)
        )
        if not ok:
            raise RuntimeError("Failed to encode the cleaned image")
        return heuristic.method_label, encoded.tobytes()

    inpainter = get_inpainter(
        has_gpu=has_gpu,
        image_complexity="auto",
        model_key=model_key,
    )
    try:
        inpainted = await inpainter.inpaint(
            heuristic.image_rgb,
            heuristic.remaining_mask,
            InpaintConfig(
                hd_strategy=HDStrategy.from_value(
                    _resolve_clean_hd_strategy(
                        hd_strategy,
                        rgb_image,
                        heuristic.remaining_mask,
                    )
                ),
                hd_strategy_resize_limit=hd_strategy_resize_limit,
                hd_strategy_crop_margin=hd_strategy_crop_margin,
                hd_strategy_crop_trigger_size=hd_strategy_crop_trigger_size,
            ),
        )
    finally:
        release_gpu_memory()
    ok, encoded = cv2.imencode(".png", cv2.cvtColor(inpainted, cv2.COLOR_RGB2BGR))
    if not ok:
        raise RuntimeError("Failed to encode the cleaned image")
    model_used = (
        inpainter.key if heuristic.filled_components == 0 else f"hybrid:{inpainter.key}"
    )
    return model_used, encoded.tobytes()


@router.get("/pipeline/options")
async def get_pipeline_options(
    source_language: str | None = None,
):
    device = get_device_info()
    has_gpu = device.has_gpu
    return {
        "device": build_device_payload(device),
        "stages": {
            "detectText": list_detection_models(has_gpu=has_gpu),
            "recognizeText": list_ocr_models(
                has_gpu=has_gpu,
                language=source_language,
            ),
            "getTranslations": list_translation_models(),
            "segmentText": list_segmentation_models(has_gpu=has_gpu),
            "cleanImage": list_inpainting_models(has_gpu=has_gpu),
        },
        "languages": {
            "source": get_source_language_options(),
            "target": get_target_language_options(),
        },
    }


@router.post("/pipeline/batch")
async def pipeline_batch(
    request: Request,
    files: list[UploadFile] = File(...),
    source_language: str = Form("ja"),
    target_language: str = Form("en"),
    detect_model_key: str | None = Form(None),
    ocr_model_key: str | None = Form(None),
    translation_model_key: str | None = Form(None),
    segment_model_key: str | None = Form(None),
    clean_model_key: str | None = Form(None),
    extra_context: str | None = Form(None),
    llm_settings: str | None = Form(None),
    translation_custom_llm: str | None = Form(None),
    run_detect: bool = Form(False),
    run_ocr: bool = Form(True),
    run_translation: bool = Form(True),
    run_segment: bool = Form(False),
    run_clean: bool = Form(True),
    concurrency: int | None = Form(None),
    mask_dilation: int | None = Form(None),
    hd_strategy: str | None = Form(None),
    hd_strategy_resize_limit: int | None = Form(None),
    hd_strategy_crop_margin: int | None = Form(None),
    hd_strategy_crop_trigger_size: int | None = Form(None),
    use_gpu_detect: str | None = Form(None),
    use_gpu_ocr: str | None = Form(None),
    use_gpu_segment: str | None = Form(None),
    use_gpu_clean: str | None = Form(None),
):
    if not files:
        raise HTTPException(status_code=400, detail="No image was uploaded.")

    cfg = get_config()
    if len(files) > cfg.batch_max_images:
        raise HTTPException(
            status_code=400,
            detail=f"Batch exceeds the limit of {cfg.batch_max_images} images.",
        )

    if not (run_detect or run_ocr or run_translation or run_segment or run_clean):
        raise HTTPException(
            status_code=400,
            detail="Select at least one stage: detect, OCR, translation, segment or clean.",
        )

    source_lang = normalize_language_code(
        source_language, default="ja", allow_auto=False
    )
    target_lang = normalize_language_code(
        target_language, default="en", allow_auto=False
    )
    settings = clamp_llm_request_settings(llm_settings)
    parsed_translation_custom_llm = _parse_optional_custom_llm(translation_custom_llm)
    effective_extra_context = settings.extra_context or str(extra_context or "")
    stage_config = BatchStageConfig(
        detect=run_detect,
        ocr=run_ocr,
        translation=run_translation,
        segment=run_segment,
        clean=run_clean,
    )
    device = get_device_info()

    def _parse_gpu_flag(flag: str | None, default: bool) -> bool:
        if flag is None:
            return default
        return flag.lower() not in ("false", "0", "no")

    gpu_detect = _parse_gpu_flag(use_gpu_detect, device.has_gpu)
    gpu_ocr = _parse_gpu_flag(use_gpu_ocr, device.has_gpu)
    gpu_segment = _parse_gpu_flag(use_gpu_segment, device.has_gpu)
    gpu_clean = _parse_gpu_flag(use_gpu_clean, device.has_gpu)
    clamped_concurrency = _clamp_int(
        concurrency,
        fallback=cfg.batch_default_concurrency,
        minimum=1,
        maximum=cfg.batch_max_concurrency,
    )
    clean_mask_dilation = _clamp_int(mask_dilation, fallback=5, minimum=0, maximum=64)
    clean_hd_resize = _clamp_int(
        hd_strategy_resize_limit, fallback=960, minimum=256, maximum=4096
    )
    clean_hd_margin = _clamp_int(
        hd_strategy_crop_margin, fallback=512, minimum=0, maximum=4096
    )
    clean_hd_trigger = _clamp_int(
        hd_strategy_crop_trigger_size, fallback=512, minimum=64, maximum=4096
    )

    tasks: list[_BatchImageTask] = []
    for index, upload in enumerate(files):
        filename = upload.filename or f"image-{index + 1}.png"
        payload = await upload.read()
        tasks.append(
            _BatchImageTask(index=index, filename=filename, image_bytes=payload)
        )

    logger.info(
        "pipeline batch started total_images=%d concurrency=%d stages=%s",
        len(tasks),
        clamped_concurrency,
        stage_config.model_dump(),
    )

    # --- Client disconnect detection ---
    cancellation_event = asyncio.Event()
    disconnect_monitor = asyncio.create_task(
        _monitor_client_disconnect(request, cancellation_event),
    )

    try:
        return await _pipeline_batch_inner(
            tasks=tasks,
            cancellation_event=cancellation_event,
            clamped_concurrency=clamped_concurrency,
            stage_config=stage_config,
            source_lang=source_lang,
            target_lang=target_lang,
            settings=settings,
            effective_extra_context=effective_extra_context,
            parsed_translation_custom_llm=parsed_translation_custom_llm,
            device=device,
            cfg=cfg,
            run_detect=run_detect,
            run_ocr=run_ocr,
            run_translation=run_translation,
            run_segment=run_segment,
            run_clean=run_clean,
            detect_model_key=detect_model_key,
            ocr_model_key=ocr_model_key,
            translation_model_key=translation_model_key,
            segment_model_key=segment_model_key,
            clean_model_key=clean_model_key,
            clean_mask_dilation=clean_mask_dilation,
            hd_strategy=hd_strategy,
            clean_hd_resize=clean_hd_resize,
            clean_hd_margin=clean_hd_margin,
            clean_hd_trigger=clean_hd_trigger,
            gpu_detect=gpu_detect,
            gpu_ocr=gpu_ocr,
            gpu_segment=gpu_segment,
            gpu_clean=gpu_clean,
        )
    finally:
        cancellation_event.set()
        disconnect_monitor.cancel()
        try:
            await disconnect_monitor
        except asyncio.CancelledError:
            pass
        release_onnx_gpu_memory()


async def _pipeline_batch_inner(
    *,
    tasks: list[_BatchImageTask],
    cancellation_event: asyncio.Event,
    clamped_concurrency: int,
    stage_config,
    source_lang: str,
    target_lang: str,
    settings,
    effective_extra_context: str,
    parsed_translation_custom_llm,
    device,
    cfg,
    run_detect: bool,
    run_ocr: bool,
    run_translation: bool,
    run_segment: bool,
    run_clean: bool,
    detect_model_key,
    ocr_model_key,
    translation_model_key,
    segment_model_key,
    clean_model_key,
    clean_mask_dilation: int,
    hd_strategy,
    clean_hd_resize: int,
    clean_hd_margin: int,
    clean_hd_trigger: int,
    gpu_detect: bool = True,
    gpu_ocr: bool = True,
    gpu_segment: bool = True,
    gpu_clean: bool = True,
):
    if settings.neighbor_image_context_enabled and run_translation:

        async def _process_phase_one(
            task: _BatchImageTask, index: int
        ) -> dict[str, Any]:
            _ = index
            errors: list[BatchItemError] = []
            successful_stages = 0
            detect_payload: dict[str, Any] | None = None
            ocr_payload: dict[str, Any] | None = None
            detected_regions: list[dict[str, Any]] = []
            ocr_regions: list[dict[str, Any]] = []
            image_size: tuple[int, int] | None = None

            try:
                image = _open_rgb_image(task.image_bytes)
            except UnidentifiedImageError:
                return {
                    "index": task.index,
                    "filename": task.filename,
                    "image_size": None,
                    "detected_regions": [],
                    "ocr_regions": [],
                    "errors": [
                        BatchItemError(
                            stage="input", message="Invalid image file"
                        )
                    ],
                    "successful_stages": 0,
                    "detect_payload": None,
                    "ocr_payload": None,
                }
            except Exception as exc:  # noqa: BLE001
                return {
                    "index": task.index,
                    "filename": task.filename,
                    "image_size": None,
                    "detected_regions": [],
                    "ocr_regions": [],
                    "errors": [
                        BatchItemError(
                            stage="input", message=f"Failed to read the image: {exc}"
                        )
                    ],
                    "successful_stages": 0,
                    "detect_payload": None,
                    "ocr_payload": None,
                }

            try:
                image_size = (image.width, image.height)

                if run_detect:
                    try:
                        detect_model_used, detected_regions = await _run_detect_stage(
                            image=image,
                            has_gpu=gpu_detect,
                            model_key=detect_model_key,
                            default_detection_model=cfg.default_detection_model,
                        )
                        _enrich_regions_with_font_style(image, detected_regions)
                        detect_payload = {
                            "regions_count": len(detected_regions),
                            "model_used": detect_model_used,
                            "image_width": image.width,
                            "image_height": image.height,
                            "detections": detected_regions,
                        }
                        successful_stages += 1
                    except Exception as exc:  # noqa: BLE001
                        errors.append(BatchItemError(stage="detect", message=str(exc)))

                if run_ocr:
                    try:
                        ocr_model_used, ocr_regions = await _run_ocr_stage(
                            image=image,
                            image_bytes=task.image_bytes,
                            source_language=source_lang,
                            model_key=ocr_model_key,
                            has_gpu=gpu_ocr,
                            default_detection_model=cfg.default_detection_model,
                            detected_regions=detected_regions,
                            cancellation_event=cancellation_event,
                        )
                        ocr_payload = {
                            "regions_count": len(ocr_regions),
                            "model_used": ocr_model_used,
                            "image_width": image.width,
                            "image_height": image.height,
                            "regions": ocr_regions,
                        }
                        successful_stages += 1
                    except Exception as exc:  # noqa: BLE001
                        errors.append(BatchItemError(stage="ocr", message=str(exc)))
            finally:
                image.close()

            return {
                "index": task.index,
                "filename": task.filename,
                "image_size": image_size,
                "detected_regions": detected_regions,
                "ocr_regions": ocr_regions,
                "errors": errors,
                "successful_stages": successful_stages,
                "detect_payload": detect_payload,
                "ocr_payload": ocr_payload,
            }

        processor: QueueProcessor[_BatchImageTask, dict[str, Any]] = QueueProcessor(
            concurrency=clamped_concurrency,
            continue_on_error=True,
        )
        queue_results = await processor.process(
            tasks,
            _process_phase_one,
            cancellation_event=cancellation_event,
            per_task_timeout=_PIPELINE_PER_IMAGE_TIMEOUT,
        )

        phase_states: list[dict[str, Any]] = []
        for queue_item in queue_results:
            if queue_item.result is not None:
                phase_states.append(queue_item.result)
                continue
            phase_states.append(
                {
                    "index": queue_item.index,
                    "filename": tasks[queue_item.index].filename,
                    "image_size": None,
                    "detected_regions": [],
                    "ocr_regions": [],
                    "errors": [
                        BatchItemError(
                            stage="queue",
                            message=queue_item.error
                            or "Unexpected failure during batch processing.",
                        )
                    ],
                    "successful_stages": 0,
                    "detect_payload": None,
                    "ocr_payload": None,
                }
            )

        states_by_index = {int(state["index"]): state for state in phase_states}
        ocr_by_index = {
            int(state["index"]): list(state.get("ocr_regions") or [])
            for state in phase_states
        }
        cleaned_outputs: dict[int, tuple[str, bytes]] = {}
        item_results: list[BatchItemResult] = []

        for task in tasks:
            state = states_by_index[task.index]
            errors = list(state.get("errors") or [])
            successful_stages = int(state.get("successful_stages") or 0)
            raw_image_size = state.get("image_size")
            image_width = None
            image_height = None
            if isinstance(raw_image_size, tuple) and len(raw_image_size) == 2:
                try:
                    image_width = int(raw_image_size[0])
                    image_height = int(raw_image_size[1])
                except (TypeError, ValueError):
                    image_width = None
                    image_height = None
            detected_regions = list(state.get("detected_regions") or [])
            ocr_regions = list(state.get("ocr_regions") or [])
            detect_payload = state.get("detect_payload")
            ocr_payload = state.get("ocr_payload")
            translated_regions: list[dict[str, Any]] = []
            segment_regions: list[dict[str, Any]] = []
            translation_payload: dict[str, Any] | None = None
            segment_payload: dict[str, Any] | None = None
            clean_payload: dict[str, Any] | None = None

            if run_translation:
                if not ocr_regions:
                    errors.append(
                        BatchItemError(
                            stage="translation",
                            message="No OCR results to translate for this image.",
                        )
                    )
                else:
                    try:
                        neighbor_context = _build_neighbor_image_translation_context(
                            ocr_by_index,
                            task.index,
                            enabled=True,
                        )
                        (
                            translation_model_used,
                            translated_regions,
                        ) = await _run_translation_stage(
                            model_key=translation_model_key,
                            source_language=source_lang,
                            target_language=target_lang,
                            extra_context=effective_extra_context,
                            llm_settings=settings.__dict__,
                            ocr_regions=ocr_regions,
                            custom_llm=parsed_translation_custom_llm,
                            neighbor_context=neighbor_context,
                        )
                        translation_payload = {
                            "regions_count": len(translated_regions),
                            "model_used": translation_model_used,
                            "source_language": source_lang,
                            "target_language": target_lang,
                            "regions": translated_regions,
                        }
                        successful_stages += 1
                    except Exception as exc:  # noqa: BLE001
                        errors.append(
                            BatchItemError(stage="translation", message=str(exc))
                        )

            if run_segment:
                translation_by_id = {
                    str(region.get("id") or ""): region for region in translated_regions
                }
                if ocr_regions:
                    segment_input_regions = []
                    for region in ocr_regions:
                        normalized_bbox = _normalize_bbox(region.get("bbox"))
                        if normalized_bbox is None:
                            continue
                        region_id = str(region.get("id") or "")
                        translated_region = translation_by_id.get(region_id)
                        segment_input_regions.append(
                            {
                                "id": region_id,
                                "bbox": [int(v) for v in normalized_bbox],
                                "source": _normalize_stage_source(
                                    str(region.get("source") or "model")
                                ),
                                "detector_model_key": str(
                                    region.get("detector_model_key") or ""
                                ),
                                "ocr_model_key": str(region.get("ocr_model_key") or ""),
                                "translator_model_key": str(
                                    translated_region.get("translator_model_key")
                                    if translated_region is not None
                                    else ""
                                ),
                            }
                        )
                else:
                    segment_input_regions = []

                if not segment_input_regions:
                    errors.append(
                        BatchItemError(
                            stage="segment",
                            message="No regions to segment for this image.",
                        )
                    )
                else:
                    try:
                        segment_model_used, segment_regions = await _run_segment_stage(
                            image_bytes=task.image_bytes,
                            has_gpu=gpu_segment,
                            model_key=segment_model_key,
                            regions=segment_input_regions,
                        )
                        segment_payload = {
                            "regions_count": len(segment_regions),
                            "model_used": segment_model_used,
                            "image_width": image_width,
                            "image_height": image_height,
                            "regions": segment_regions,
                        }
                        successful_stages += 1
                    except Exception as exc:  # noqa: BLE001
                        errors.append(BatchItemError(stage="segment", message=str(exc)))

            if run_clean:
                try:
                    clean_image = _open_rgb_image(task.image_bytes)
                except UnidentifiedImageError:
                    errors.append(
                        BatchItemError(
                            stage="clean",
                            message="Invalid image for the clean stage.",
                        )
                    )
                except Exception as exc:  # noqa: BLE001
                    errors.append(
                        BatchItemError(
                            stage="clean",
                            message=f"Failed to read the image for cleaning: {exc}",
                        )
                    )
                else:
                    try:
                        clean_regions = (
                            segment_regions
                            or ocr_regions
                            or [
                                {
                                    "id": str(region.get("id") or ""),
                                    "bbox": [
                                        int(v)
                                        for v in region.get("bbox", [0, 0, 0, 0])[:4]
                                    ],
                                    "source": _normalize_stage_source(
                                        str(region.get("source") or "model")
                                    ),
                                    "detector_model_key": str(
                                        region.get("model_key") or ""
                                    ),
                                    "segment_boxes": [],
                                    "merged_boxes": [],
                                }
                                for region in detected_regions
                                if _normalize_bbox(region.get("bbox")) is not None
                            ]
                        )
                        clean_model_used, cleaned_png = await _run_clean_stage(
                            image=clean_image,
                            has_gpu=gpu_clean,
                            model_key=clean_model_key,
                            regions_for_mask=clean_regions,
                            default_detection_model=cfg.default_detection_model,
                            mask_dilation=clean_mask_dilation,
                            hd_strategy=hd_strategy,
                            hd_strategy_resize_limit=clean_hd_resize,
                            hd_strategy_crop_margin=clean_hd_margin,
                            hd_strategy_crop_trigger_size=clean_hd_trigger,
                        )
                        output_file = f"cleaned/{task.index:03d}-{_safe_filename(task.filename, task.index)}"
                        cleaned_outputs[task.index] = (output_file, cleaned_png)
                        clean_payload = {
                            "output_file": output_file,
                            "model_used": clean_model_used,
                            "mask_dilation": clean_mask_dilation,
                            "hd_strategy": hd_strategy or "resize",
                            "hd_strategy_resize_limit": clean_hd_resize,
                            "hd_strategy_crop_margin": clean_hd_margin,
                            "hd_strategy_crop_trigger_size": clean_hd_trigger,
                        }
                        successful_stages += 1
                    except Exception as exc:  # noqa: BLE001
                        errors.append(BatchItemError(stage="clean", message=str(exc)))
                    finally:
                        clean_image.close()

            selected_stage_count = (
                int(run_detect)
                + int(run_ocr)
                + int(run_translation)
                + int(run_segment)
                + int(run_clean)
            )
            if successful_stages == selected_stage_count and not errors:
                status = "success"
            elif successful_stages == 0:
                status = "failed"
            else:
                status = "partial"

            item_results.append(
                BatchItemResult(
                    index=task.index,
                    filename=task.filename,
                    status=status,
                    detect=detect_payload,
                    ocr=ocr_payload,
                    translation=translation_payload,
                    segment=segment_payload,
                    clean=clean_payload,
                    errors=errors,
                )
            )

        succeeded = sum(1 for item in item_results if item.status == "success")
        partial = sum(1 for item in item_results if item.status == "partial")
        failed = sum(1 for item in item_results if item.status == "failed")

        report = BatchReport(
            total_images=len(tasks),
            succeeded=succeeded,
            failed=failed,
            partial=partial,
            stages=stage_config,
            results=item_results,
        )
        report_payload = report.model_dump(mode="json")

        logger.info(
            "pipeline batch finished total_images=%d succeeded=%d partial=%d failed=%d",
            len(tasks),
            succeeded,
            partial,
            failed,
        )

        if not run_clean:
            return report_payload

        zip_buffer = BytesIO()
        with zipfile.ZipFile(
            zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED
        ) as archive:
            for task_index in sorted(cleaned_outputs.keys()):
                output_file, cleaned_png = cleaned_outputs[task_index]
                archive.writestr(output_file, cleaned_png)
            archive.writestr(
                "batch_report.json",
                json.dumps(report_payload, ensure_ascii=False, indent=2),
            )
        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=pipeline-batch.zip"},
        )

    cleaned_outputs: dict[int, tuple[str, bytes]] = {}

    async def _process_image(task: _BatchImageTask, index: int) -> BatchItemResult:
        _ = index
        errors: list[BatchItemError] = []
        successful_stages = 0
        detect_payload: dict[str, Any] | None = None
        ocr_payload: dict[str, Any] | None = None
        translation_payload: dict[str, Any] | None = None
        segment_payload: dict[str, Any] | None = None
        clean_payload: dict[str, Any] | None = None
        detected_regions: list[dict[str, Any]] = []
        ocr_regions: list[dict[str, Any]] = []
        translated_regions: list[dict[str, Any]] = []
        segment_regions: list[dict[str, Any]] = []

        try:
            image = Image.open(BytesIO(task.image_bytes)).convert("RGB")
        except UnidentifiedImageError:
            return BatchItemResult(
                index=task.index,
                filename=task.filename,
                status="failed",
                errors=[
                    BatchItemError(stage="input", message="Invalid image file")
                ],
            )
        except Exception as exc:  # noqa: BLE001
            return BatchItemResult(
                index=task.index,
                filename=task.filename,
                status="failed",
                errors=[
                    BatchItemError(stage="input", message=f"Failed to read the image: {exc}")
                ],
            )

        try:
            if run_detect:
                try:
                    detect_model_used, detected_regions = await _run_detect_stage(
                        image=image,
                        has_gpu=gpu_detect,
                        model_key=detect_model_key,
                        default_detection_model=cfg.default_detection_model,
                    )
                    _enrich_regions_with_font_style(image, detected_regions)
                    detect_payload = {
                        "regions_count": len(detected_regions),
                        "model_used": detect_model_used,
                        "image_width": image.width,
                        "image_height": image.height,
                        "detections": detected_regions,
                    }
                    successful_stages += 1
                except Exception as exc:  # noqa: BLE001
                    errors.append(BatchItemError(stage="detect", message=str(exc)))

            if run_ocr:
                try:
                    ocr_model_used, ocr_regions = await _run_ocr_stage(
                        image=image,
                        image_bytes=task.image_bytes,
                        source_language=source_lang,
                        model_key=ocr_model_key,
                        has_gpu=gpu_ocr,
                        default_detection_model=cfg.default_detection_model,
                        detected_regions=detected_regions,
                        cancellation_event=cancellation_event,
                    )
                    ocr_payload = {
                        "regions_count": len(ocr_regions),
                        "model_used": ocr_model_used,
                        "image_width": image.width,
                        "image_height": image.height,
                        "regions": ocr_regions,
                    }
                    successful_stages += 1
                except Exception as exc:  # noqa: BLE001
                    errors.append(BatchItemError(stage="ocr", message=str(exc)))

            if run_translation:
                if not ocr_regions:
                    errors.append(
                        BatchItemError(
                            stage="translation",
                            message="No OCR results to translate for this image.",
                        )
                    )
                else:
                    try:
                        (
                            translation_model_used,
                            translated_regions,
                        ) = await _run_translation_stage(
                            model_key=translation_model_key,
                            source_language=source_lang,
                            target_language=target_lang,
                            extra_context=effective_extra_context,
                            llm_settings=settings.__dict__,
                            ocr_regions=ocr_regions,
                            custom_llm=parsed_translation_custom_llm,
                        )
                        translation_payload = {
                            "regions_count": len(translated_regions),
                            "model_used": translation_model_used,
                            "source_language": source_lang,
                            "target_language": target_lang,
                            "regions": translated_regions,
                        }
                        successful_stages += 1
                    except Exception as exc:  # noqa: BLE001
                        errors.append(
                            BatchItemError(stage="translation", message=str(exc))
                        )

            if run_segment:
                translation_by_id = {
                    str(region.get("id") or ""): region for region in translated_regions
                }
                if ocr_regions:
                    segment_input_regions = []
                    for region in ocr_regions:
                        normalized_bbox = _normalize_bbox(region.get("bbox"))
                        if normalized_bbox is None:
                            continue
                        region_id = str(region.get("id") or "")
                        translated_region = translation_by_id.get(region_id)
                        segment_input_regions.append(
                            {
                                "id": region_id,
                                "bbox": [int(v) for v in normalized_bbox],
                                "source": _normalize_stage_source(
                                    str(region.get("source") or "model")
                                ),
                                "detector_model_key": str(
                                    region.get("detector_model_key") or ""
                                ),
                                "ocr_model_key": str(region.get("ocr_model_key") or ""),
                                "translator_model_key": str(
                                    translated_region.get("translator_model_key")
                                    if translated_region is not None
                                    else ""
                                ),
                            }
                        )
                else:
                    segment_input_regions = [
                        {
                            "id": str(region.get("id") or ""),
                            "bbox": [
                                int(v) for v in region.get("bbox", [0, 0, 0, 0])[:4]
                            ],
                            "source": _normalize_stage_source(
                                str(region.get("source") or "model")
                            ),
                            "detector_model_key": str(region.get("model_key") or ""),
                            "ocr_model_key": "",
                            "translator_model_key": "",
                        }
                        for region in detected_regions
                        if _normalize_bbox(region.get("bbox")) is not None
                    ]
                if not segment_input_regions:
                    errors.append(
                        BatchItemError(
                            stage="segment",
                            message="No regions to segment for this image.",
                        )
                    )
                else:
                    try:
                        segment_model_used, segment_regions = await _run_segment_stage(
                            image_bytes=task.image_bytes,
                            has_gpu=gpu_segment,
                            model_key=segment_model_key,
                            regions=segment_input_regions,
                        )
                        segment_payload = {
                            "regions_count": len(segment_regions),
                            "model_used": segment_model_used,
                            "image_width": image.width,
                            "image_height": image.height,
                            "regions": segment_regions,
                        }
                        successful_stages += 1
                    except Exception as exc:  # noqa: BLE001
                        errors.append(BatchItemError(stage="segment", message=str(exc)))

            if run_clean:
                try:
                    clean_regions = (
                        segment_regions
                        or ocr_regions
                        or [
                            {
                                "id": str(region.get("id") or ""),
                                "bbox": [
                                    int(v) for v in region.get("bbox", [0, 0, 0, 0])[:4]
                                ],
                                "source": _normalize_stage_source(
                                    str(region.get("source") or "model")
                                ),
                                "detector_model_key": str(
                                    region.get("model_key") or ""
                                ),
                                "segment_boxes": [],
                                "merged_boxes": [],
                            }
                            for region in detected_regions
                            if _normalize_bbox(region.get("bbox")) is not None
                        ]
                    )
                    clean_model_used, cleaned_png = await _run_clean_stage(
                        image=image,
                        has_gpu=gpu_clean,
                        model_key=clean_model_key,
                        regions_for_mask=clean_regions,
                        default_detection_model=cfg.default_detection_model,
                        mask_dilation=clean_mask_dilation,
                        hd_strategy=hd_strategy,
                        hd_strategy_resize_limit=clean_hd_resize,
                        hd_strategy_crop_margin=clean_hd_margin,
                        hd_strategy_crop_trigger_size=clean_hd_trigger,
                    )
                    output_file = f"cleaned/{task.index:03d}-{_safe_filename(task.filename, task.index)}"
                    cleaned_outputs[task.index] = (output_file, cleaned_png)
                    clean_payload = {
                        "output_file": output_file,
                        "model_used": clean_model_used,
                        "mask_dilation": clean_mask_dilation,
                        "hd_strategy": hd_strategy or "resize",
                        "hd_strategy_resize_limit": clean_hd_resize,
                        "hd_strategy_crop_margin": clean_hd_margin,
                        "hd_strategy_crop_trigger_size": clean_hd_trigger,
                    }
                    successful_stages += 1
                except Exception as exc:  # noqa: BLE001
                    errors.append(BatchItemError(stage="clean", message=str(exc)))

            selected_stage_count = (
                int(run_detect)
                + int(run_ocr)
                + int(run_translation)
                + int(run_segment)
                + int(run_clean)
            )
            if successful_stages == selected_stage_count and not errors:
                status = "success"
            elif successful_stages == 0:
                status = "failed"
            else:
                status = "partial"

            return BatchItemResult(
                index=task.index,
                filename=task.filename,
                status=status,
                detect=detect_payload,
                ocr=ocr_payload,
                translation=translation_payload,
                segment=segment_payload,
                clean=clean_payload,
                errors=errors,
            )
        finally:
            image.close()

    processor: QueueProcessor[_BatchImageTask, BatchItemResult] = QueueProcessor(
        concurrency=clamped_concurrency,
        continue_on_error=True,
    )
    queue_results = await processor.process(
        tasks,
        _process_image,
        cancellation_event=cancellation_event,
        per_task_timeout=_PIPELINE_PER_IMAGE_TIMEOUT,
    )

    item_results: list[BatchItemResult] = []
    for queue_item in queue_results:
        if queue_item.result is not None:
            item_results.append(queue_item.result)
            continue
        item_results.append(
            BatchItemResult(
                index=queue_item.index,
                filename=tasks[queue_item.index].filename,
                status="failed",
                errors=[
                    BatchItemError(
                        stage="queue",
                        message=queue_item.error
                        or "Unexpected failure during batch processing.",
                    )
                ],
            )
        )

    succeeded = sum(1 for item in item_results if item.status == "success")
    partial = sum(1 for item in item_results if item.status == "partial")
    failed = sum(1 for item in item_results if item.status == "failed")

    report = BatchReport(
        total_images=len(tasks),
        succeeded=succeeded,
        failed=failed,
        partial=partial,
        stages=stage_config,
        results=item_results,
    )
    report_payload = report.model_dump(mode="json")

    logger.info(
        "pipeline batch finished total_images=%d succeeded=%d partial=%d failed=%d",
        len(tasks),
        succeeded,
        partial,
        failed,
    )

    if not run_clean:
        return report_payload

    zip_buffer = BytesIO()
    with zipfile.ZipFile(
        zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED
    ) as archive:
        for task_index in sorted(cleaned_outputs.keys()):
            output_file, cleaned_png = cleaned_outputs[task_index]
            archive.writestr(output_file, cleaned_png)
        archive.writestr(
            "batch_report.json",
            json.dumps(report_payload, ensure_ascii=False, indent=2),
        )
    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=pipeline-batch.zip"},
    )
