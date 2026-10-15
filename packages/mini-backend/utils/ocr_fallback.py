from __future__ import annotations

import asyncio
import logging
import math
from collections.abc import Callable, Iterator, Mapping, Sequence
from dataclasses import dataclass, replace
from typing import Final

import numpy as np
from PIL import Image

from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from utils import image_variants as iv
from utils.image_codec import RGBImage, validate_rgb
from utils.image_variants import PixelSize
from utils.workers import run_native

logger = logging.getLogger(__name__)
OCR_SCORE_THRESHOLD: Final = 0.55


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
    if target is None:
        return

    def project(region: OCRInputRegion) -> OCRInputRegion:
        return replace(
            region,
            bbox=iv.scale_bbox(
                region.bbox,
                scale_x=target[0] / size[0],
                scale_y=target[1] / size[1],
            ),
        )

    yield _OCRPass("upscale", lambda: iv.upscale(rgb, target), project)


def _confidence(result: OCRTextResult) -> float:
    value = float(result.score or 0.0)
    return min(1.0, max(0.0, value)) if math.isfinite(value) else 0.0


def _rank(result: OCRTextResult) -> tuple[bool, float]:
    return bool((result.text or "").strip()), _confidence(result)


def _needs_retry(result: OCRTextResult | None) -> bool:
    return (
        result is None
        or not (result.text or "").strip()
        or _confidence(result) < OCR_SCORE_THRESHOLD
    )


def _check_cancelled(event: asyncio.Event | None) -> None:
    if event is not None and event.is_set():
        raise asyncio.CancelledError


def _to_rgb_array(image: Image.Image) -> RGBImage:
    with image.convert("RGB") as converted:
        rgb: RGBImage = np.array(converted, dtype=np.uint8, copy=True)
    validate_rgb(rgb)
    return rgb


def _materialize(ocr_pass: _OCRPass) -> Image.Image:
    return Image.fromarray(ocr_pass.build())


def _merge_best(
    candidates: Sequence[OCRTextResult],
    regions_by_id: Mapping[str, OCRInputRegion],
    best_by_id: dict[str, OCRTextResult],
) -> None:
    for candidate in candidates:
        region = regions_by_id.get(candidate.id)
        if region is None:
            continue

        normalized = replace(candidate, bbox=region.bbox)
        current = best_by_id.get(candidate.id)
        if current is None or _rank(normalized) > _rank(current):
            best_by_id[candidate.id] = normalized


def _finalize(
    regions: Sequence[OCRInputRegion],
    best_by_id: Mapping[str, OCRTextResult],
    engine: BaseOCR,
) -> list[OCRTextResult]:
    results: list[OCRTextResult] = []
    for region in regions:
        result = best_by_id.get(region.id)
        if result is None:
            result = OCRTextResult(
                id=region.id,
                bbox=region.bbox,
                text="",
                score=0.0,
                source=region.source,
                detector_model_key=region.detector_model_key,
                model_key=engine.key,
            )
        results.append(result)
    return results


async def recognize_with_fallbacks(
    *,
    engine: BaseOCR,
    image: Image.Image,
    regions: Sequence[OCRInputRegion],
    language: str,
    cancellation_event: asyncio.Event | None = None,
) -> list[OCRTextResult]:
    _check_cancelled(cancellation_event)
    if not regions:
        return []

    regions_by_id = {region.id: region for region in regions}
    if len(regions_by_id) != len(regions):
        raise ValueError("OCR region identifiers must be unique")

    best_by_id: dict[str, OCRTextResult] = {}
    original = await engine.recognize(
        image,
        list(regions),
        language=language,
        cancellation_event=cancellation_event,
    )
    _check_cancelled(cancellation_event)
    _merge_best(original, regions_by_id, best_by_id)

    pending = [region for region in regions if _needs_retry(best_by_id.get(region.id))]
    if not pending:
        return _finalize(regions, best_by_id, engine)

    rgb = await run_native(_to_rgb_array, image)

    for ocr_pass in _fallback_passes(rgb, image.size):
        _check_cancelled(cancellation_event)
        if not pending:
            break

        variant = await run_native(_materialize, ocr_pass)
        try:
            _check_cancelled(cancellation_event)
            candidates = await engine.recognize(
                variant,
                [ocr_pass.project_region(region) for region in pending],
                language=language,
                cancellation_event=cancellation_event,
            )
        finally:
            variant.close()

        _check_cancelled(cancellation_event)
        _merge_best(candidates, {region.id: region for region in pending}, best_by_id)
        pending = [
            region for region in pending if _needs_retry(best_by_id.get(region.id))
        ]
        logger.debug(
            "ocr_fallback.pass",
            extra={"variant": ocr_pass.name, "pending": len(pending)},
        )

    logger.info(
        "ocr_fallback.done",
        extra={"regions": len(regions), "unresolved": len(pending)},
    )
    return _finalize(regions, best_by_id, engine)
