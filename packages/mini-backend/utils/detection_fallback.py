"""Multi-variant text detection for pages where a single pass under-detects.

Variants are built lazily — only when the previous variant failed to produce
enough detections — and materialized off the event loop.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Iterator, Sequence
from dataclasses import dataclass, replace
from typing import Final, Protocol

import numpy as np
from PIL import Image

from utils import image_variants as iv
from utils.image_variants import BBox, PixelSize, RGBImage

logger = logging.getLogger(__name__)

MIN_ORIGINAL_DETECTIONS_TO_SKIP_FALLBACKS: Final = 2
BORDER_MIN_SIDE: Final = 400
_DETECTION_WEIGHT: Final = 10.0


class BBoxDetection(Protocol):
    """Anything with an integer bbox and a score — dataclass or duck-typed."""

    @property
    def bbox(self) -> BBox: ...
    @property
    def score(self) -> float: ...


type DetectionRunner[T: BBoxDetection] = Callable[[Image.Image], Awaitable[Sequence[T]]]


@dataclass(frozen=True, slots=True)
class DetectionVariant:
    name: str
    build: Callable[[], RGBImage]
    restore_bbox: Callable[[BBox], BBox]


def _identity(bbox: BBox) -> BBox:
    return bbox


def _pad_to_square(rgb: RGBImage, side: int) -> RGBImage:
    canvas = np.full((side, side, 3), 255, dtype=np.uint8)
    canvas[: rgb.shape[0], : rgb.shape[1]] = rgb
    return canvas


def _iter_variants(rgb: RGBImage) -> Iterator[DetectionVariant]:
    height, width = rgb.shape[:2]
    size: PixelSize = (width, height)

    yield DetectionVariant("original", lambda: rgb, _identity)

    if min(size) < BORDER_MIN_SIDE:
        side = max(width, height, BORDER_MIN_SIDE)
        # The original is pasted at (0, 0); border detections are clipped back
        # to the page so out-of-canvas boxes never leak downstream.
        yield DetectionVariant("border", lambda: _pad_to_square(rgb, side), _identity)

    target = iv.upscale_target(size)
    if target is not None:
        scale_x, scale_y = target[0] / width, target[1] / height

        def downscale(bbox: BBox) -> BBox:
            return iv.scale_bbox(bbox, scale_x=1.0 / scale_x, scale_y=1.0 / scale_y)

        yield DetectionVariant("upscale", lambda: iv.upscale(rgb, target), downscale)
        yield DetectionVariant(
            "upscale_invert", lambda: iv.invert(iv.upscale(rgb, target)), downscale
        )

    yield DetectionVariant("invert", lambda: iv.invert(rgb), _identity)
    yield DetectionVariant("gamma", lambda: iv.gamma_normalize(rgb), _identity)
    yield DetectionVariant(
        "rotate90",
        lambda: iv.rotate_clockwise(rgb),
        lambda bbox: iv.unrotate_clockwise_bbox(bbox, size),
    )


def _materialize(variant: DetectionVariant) -> Image.Image:
    return Image.fromarray(variant.build())


def _to_rgb_array(image: Image.Image) -> RGBImage:
    return np.asarray(image.convert("RGB"), dtype=np.uint8)


def _rebind_bbox(detection: object, bbox: BBox) -> object:
    """Return a copy of ``detection`` with ``bbox`` replaced.

    Frozen dataclasses go through ``dataclasses.replace``; plain namespaces
    (test doubles, duck-typed results) are mutated in place, matching the
    historical behaviour of this module.
    """
    if hasattr(detection, "__dataclass_fields__"):
        return replace(detection, bbox=bbox)  # type: ignore[type-var]
    setattr(detection, "bbox", bbox)
    return detection


async def detect_with_fallbacks[T: BBoxDetection](
    image: Image.Image,
    run_detection: DetectionRunner[T],
) -> tuple[list[T], str]:
    """Run the detector over progressively more aggressive variants; keep the best.

    Variants are built lazily and off the event loop. Stops early when the
    original page already yields enough detections.
    """
    rgb = await asyncio.to_thread(_to_rgb_array, image)
    size: PixelSize = (rgb.shape[1], rgb.shape[0])

    best: list[T] = []
    best_variant = "original"
    best_score = -1.0

    for variant in _iter_variants(rgb):
        variant_image = await asyncio.to_thread(_materialize, variant)
        detections: list[T] = []
        for detection in await run_detection(variant_image):
            raw = getattr(detection, "bbox", (0, 0, 0, 0))
            x1, y1, x2, y2 = (int(v) for v in raw)
            restored = iv.clip_bbox(variant.restore_bbox((x1, y1, x2, y2)), size)
            if restored is None:
                continue
            detections.append(_rebind_bbox(detection, restored))  # type: ignore[arg-type]
        score = len(detections) * _DETECTION_WEIGHT + sum(
            float(getattr(d, "score", 0.0) or 0.0) for d in detections
        )
        logger.debug(
            "detection_fallback.variant",
            extra={"variant": variant.name, "count": len(detections), "score": round(score, 3)},
        )
        if score > best_score:
            best, best_variant, best_score = detections, variant.name, score
        if (
            variant.name == "original"
            and len(detections) >= MIN_ORIGINAL_DETECTIONS_TO_SKIP_FALLBACKS
        ):
            break

    logger.info("detection_fallback.done", extra={"variant": best_variant, "count": len(best)})
    return best, best_variant
