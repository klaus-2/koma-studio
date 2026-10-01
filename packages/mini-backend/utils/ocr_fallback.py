"""Re-run OCR on photometric variants for regions the first pass read poorly."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, replace
from typing import Final

import numpy as np
from PIL import Image

from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from utils import image_variants as iv
from utils.image_variants import PixelSize, RGBImage

logger = logging.getLogger(__name__)

OCR_SCORE_THRESHOLD: Final = 0.55
_NON_EMPTY_TEXT_BONUS: Final = 0.08


@dataclass(frozen=True, slots=True)
class _OCRPass:
    name: str
    build: Callable[[], RGBImage]
    project_region: Callable[[OCRInputRegion], OCRInputRegion]


def _same_region(region: OCRInputRegion) -> OCRInputRegion:
    return region


def _fallback_passes(rgb: RGBImage, size: PixelSize) -> Iterator[_OCRPass]:
    yield _OCRPass("invert", lambda: iv.invert(rgb), _same_region)
    yield _OCRPass("gamma", lambda: iv.gamma_normalize(rgb), _same_region)

    target = iv.upscale_target(size)
    if target is not None:
        scale_x, scale_y = target[0] / size[0], target[1] / size[1]

        def project(region: OCRInputRegion) -> OCRInputRegion:
            return replace(region, bbox=iv.scale_bbox(region.bbox, scale_x=scale_x, scale_y=scale_y))

        yield _OCRPass("upscale", lambda: iv.upscale(rgb, target), project)


def _needs_retry(result: OCRTextResult | None) -> bool:
    if result is None or not (result.text or "").strip():
        return True
    return float(result.score or 0.0) < OCR_SCORE_THRESHOLD


def _score(result: OCRTextResult) -> float:
    bonus = _NON_EMPTY_TEXT_BONUS if (result.text or "").strip() else 0.0
    return float(result.score or 0.0) + bonus


def _is_cancelled(event: asyncio.Event | None) -> bool:
    return event is not None and event.is_set()


def _to_rgb_array(image: Image.Image) -> RGBImage:
    return np.asarray(image.convert("RGB"), dtype=np.uint8)


def _materialize(ocr_pass: _OCRPass) -> Image.Image:
    return Image.fromarray(ocr_pass.build())


def _merge_best(
    candidates: Sequence[OCRTextResult],
    pending_by_id: Mapping[str, OCRInputRegion],
    best_by_id: dict[str, OCRTextResult],
) -> None:
    for candidate in candidates:
        region = pending_by_id.get(candidate.id)
        if region is None:
            continue
        normalized = replace(candidate, bbox=region.bbox)
        current = best_by_id.get(candidate.id)
        if current is None or _score(normalized) > _score(current):
            best_by_id[candidate.id] = normalized


def _finalize(
    regions: Sequence[OCRInputRegion], best_by_id: Mapping[str, OCRTextResult], engine: BaseOCR
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


async def recognize_with_fallbacks(
    *,
    engine: BaseOCR,
    image: Image.Image,
    regions: Sequence[OCRInputRegion],
    language: str,
    cancellation_event: asyncio.Event | None = None,
) -> list[OCRTextResult]:
    if not regions:
        return []

    original = await engine.recognize(
        image, list(regions), language=language, cancellation_event=cancellation_event
    )
    best_by_id: dict[str, OCRTextResult] = {result.id: result for result in original}
    pending = [region for region in regions if _needs_retry(best_by_id.get(region.id))]
    logger.debug("ocr_fallback.pass", extra={"pass": "original", "pending": len(pending)})
    if not pending or _is_cancelled(cancellation_event):
        return _finalize(regions, best_by_id, engine)

    rgb = await asyncio.to_thread(_to_rgb_array, image)

    for ocr_pass in _fallback_passes(rgb, image.size):
        if not pending or _is_cancelled(cancellation_event):
            break
        variant_image = await asyncio.to_thread(_materialize, ocr_pass)
        candidates = await engine.recognize(
            variant_image,
            [ocr_pass.project_region(region) for region in pending],
            language=language,
            cancellation_event=cancellation_event,
        )
        _merge_best(candidates, {region.id: region for region in pending}, best_by_id)
        pending = [region for region in pending if _needs_retry(best_by_id.get(region.id))]
        logger.debug("ocr_fallback.pass", extra={"pass": ocr_pass.name, "pending": len(pending)})

    logger.info("ocr_fallback.done", extra={"regions": len(regions), "unresolved": len(pending)})
    return _finalize(regions, best_by_id, engine)
