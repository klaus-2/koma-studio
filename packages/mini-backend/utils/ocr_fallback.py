from __future__ import annotations

import asyncio
import logging
from dataclasses import replace

import cv2
import numpy as np
from PIL import Image

from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult


_OCR_SCORE_THRESHOLD = 0.55

logger = logging.getLogger(__name__)


def _should_retry_region(result: OCRTextResult | None) -> bool:
    if result is None:
        return True
    text = (result.text or "").strip()
    if not text:
        return True
    return float(result.score or 0.0) < _OCR_SCORE_THRESHOLD


def _score_result(result: OCRTextResult) -> float:
    text = (result.text or "").strip()
    return float(result.score or 0.0) + (0.08 if text else 0.0)


def _scale_bbox(
    bbox: tuple[int, int, int, int],
    scale_x: float,
    scale_y: float,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = bbox
    return (
        int(round(x1 * scale_x)),
        int(round(y1 * scale_y)),
        int(round(x2 * scale_x)),
        int(round(y2 * scale_y)),
    )


async def _call_engine_recognize(
    engine: BaseOCR,
    image: Image.Image,
    regions: list[OCRInputRegion],
    language: str,
    cancellation_event: asyncio.Event | None,
) -> list[OCRTextResult]:
    """Call engine.recognize, forwarding cancellation_event when supported."""
    try:
        return await engine.recognize(
            image,
            regions,
            language=language,
            cancellation_event=cancellation_event,
        )
    except TypeError:
        # Engine does not accept cancellation_event kwarg — fall back.
        return await engine.recognize(image, regions, language=language)


def _finalize_results(
    regions: list[OCRInputRegion],
    best_by_id: dict[str, OCRTextResult],
    engine: BaseOCR,
) -> list[OCRTextResult]:
    return [
        best_by_id.get(
            region.id,
            OCRTextResult(
                id=region.id,
                bbox=region.bbox,
                text="",
                score=0.0,
                source=region.source,
                detector_model_key=region.detector_model_key,
                model_key=engine.key,
            ),
        )
        for region in regions
    ]


def _build_invert_image(rgb: np.ndarray) -> Image.Image:
    return Image.fromarray(cv2.bitwise_not(rgb))


def _build_gamma_image(rgb: np.ndarray) -> Image.Image:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mean = max(1.0, float(np.mean(gray)))
    gamma = np.log(0.5 * 255.0) / np.log(mean) if mean not in {0.0, 1.0} else 1.0
    rgb_norm = rgb.astype(np.float32) / 255.0
    gamma_corrected = (np.power(rgb_norm, gamma) * 255.0).clip(0, 255).astype(np.uint8)
    return Image.fromarray(gamma_corrected)


def _is_cancelled(event: asyncio.Event | None) -> bool:
    return event is not None and event.is_set()


def _update_best(
    candidate_results: list[OCRTextResult],
    pending_regions: list[OCRInputRegion],
    best_by_id: dict[str, OCRTextResult],
) -> None:
    for candidate in candidate_results:
        original_region = next(
            (r for r in pending_regions if r.id == candidate.id), None
        )
        if original_region is None:
            continue
        normalized_candidate = replace(candidate, bbox=original_region.bbox)
        current_best = best_by_id.get(candidate.id)
        if current_best is None or _score_result(normalized_candidate) > _score_result(
            current_best
        ):
            best_by_id[candidate.id] = normalized_candidate


async def recognize_with_fallbacks(
    *,
    engine: BaseOCR,
    image: Image.Image,
    regions: list[OCRInputRegion],
    language: str,
    cancellation_event: asyncio.Event | None = None,
) -> list[OCRTextResult]:
    if not regions:
        return []

    logger.info("ocr_fallback started regions=%d", len(regions))

    # --- Pass 1: original image ---
    original_results = await _call_engine_recognize(
        engine, image, regions, language, cancellation_event
    )
    best_by_id = {result.id: result for result in original_results}
    pending_regions = [
        region for region in regions if _should_retry_region(best_by_id.get(region.id))
    ]

    logger.info(
        "ocr_fallback pass=original done=%d pending=%d",
        len(regions) - len(pending_regions),
        len(pending_regions),
    )

    if not pending_regions or _is_cancelled(cancellation_event):
        return _finalize_results(regions, best_by_id, engine)

    # Convert full image to numpy once (run in thread for very large images).
    rgb: np.ndarray = await asyncio.to_thread(lambda: np.array(image.convert("RGB")))

    # --- Pass 2: Invert ---
    if pending_regions and not _is_cancelled(cancellation_event):
        invert_image = await asyncio.to_thread(_build_invert_image, rgb)
        candidate_results = await _call_engine_recognize(
            engine, invert_image, pending_regions, language, cancellation_event
        )
        _update_best(candidate_results, pending_regions, best_by_id)
        pending_regions = [
            r for r in pending_regions if _should_retry_region(best_by_id.get(r.id))
        ]
        logger.info("ocr_fallback pass=invert pending=%d", len(pending_regions))

    # --- Pass 3: Gamma correction ---
    if pending_regions and not _is_cancelled(cancellation_event):
        gamma_image = await asyncio.to_thread(_build_gamma_image, rgb)
        candidate_results = await _call_engine_recognize(
            engine, gamma_image, pending_regions, language, cancellation_event
        )
        _update_best(candidate_results, pending_regions, best_by_id)
        pending_regions = [
            r for r in pending_regions if _should_retry_region(best_by_id.get(r.id))
        ]
        logger.info("ocr_fallback pass=gamma pending=%d", len(pending_regions))

    # --- Pass 4: Upscale (only for small images) ---
    width, height = image.size
    max_side = max(width, height)
    min_side = min(width, height)
    if (
        pending_regions
        and not _is_cancelled(cancellation_event)
        and (max_side < 1400 or min_side < 720)
    ):
        target_long_edge = min(2048, max(1400, max_side * 2))
        scale = float(target_long_edge) / float(max_side)
        upscale_w = max(1, int(round(width * scale)))
        upscale_h = max(1, int(round(height * scale)))
        if upscale_w > width or upscale_h > height:
            upscaled_rgb = await asyncio.to_thread(
                lambda: cv2.resize(
                    rgb, (upscale_w, upscale_h), interpolation=cv2.INTER_CUBIC
                )
            )
            scaled_regions = [
                replace(
                    region,
                    bbox=_scale_bbox(
                        region.bbox,
                        upscale_w / float(width),
                        upscale_h / float(height),
                    ),
                )
                for region in pending_regions
            ]
            upscale_image = Image.fromarray(upscaled_rgb)
            candidate_results = await _call_engine_recognize(
                engine, upscale_image, scaled_regions, language, cancellation_event
            )
            _update_best(candidate_results, pending_regions, best_by_id)
            logger.info("ocr_fallback pass=upscale done")

    logger.info("ocr_fallback finished regions=%d", len(regions))
    return _finalize_results(regions, best_by_id, engine)
