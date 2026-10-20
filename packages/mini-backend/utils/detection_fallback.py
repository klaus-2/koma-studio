from __future__ import annotations

import copy
import logging
import math
from collections.abc import Awaitable, Callable, Iterator, Sequence
from dataclasses import dataclass, is_dataclass, replace
from typing import Final, Protocol, cast

import numpy as np
from PIL import Image

from utils import image_variants as iv
from utils.image_codec import MAX_IMAGE_PIXELS, RGBImage
from utils.image_variants import BBox, PixelSize, to_rgb_array
from utils.workers import run_native

logger = logging.getLogger(__name__)

MIN_ORIGINAL_DETECTIONS_TO_SKIP_FALLBACKS: Final = 2
BORDER_MIN_SIDE: Final = 400


class BBoxDetection(Protocol):
    @property
    def bbox(self) -> BBox: ...

    @property
    def score(self) -> float: ...


type DetectionRunner[T: BBoxDetection] = Callable[
    [Image.Image], Awaitable[Sequence[T]]
]
type DetectionCopier[T: BBoxDetection] = Callable[[T, BBox], T]


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
    size: PixelSize = width, height
    yield DetectionVariant("original", lambda: rgb, _identity)

    side = max(width, height, BORDER_MIN_SIDE)
    if min(size) < BORDER_MIN_SIDE and side * side <= MAX_IMAGE_PIXELS:
        yield DetectionVariant(
            "border",
            lambda: _pad_to_square(rgb, side),
            _identity,
        )

    target = iv.upscale_target(size)
    if target is not None:
        scale_x = width / target[0]
        scale_y = height / target[1]

        def restore(bbox: BBox) -> BBox:
            return iv.scale_bbox(bbox, scale_x=scale_x, scale_y=scale_y)

        yield DetectionVariant("upscale", lambda: iv.upscale(rgb, target), restore)
        yield DetectionVariant(
            "upscale_invert",
            lambda: iv.invert(iv.upscale(rgb, target)),
            restore,
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


def _copy_detection[T: BBoxDetection](detection: T, bbox: BBox) -> T:
    if is_dataclass(detection) and not isinstance(detection, type):
        return cast(T, replace(detection, bbox=bbox))

    cloned = copy.copy(detection)
    if cloned is detection:
        raise TypeError("Detection copy must produce an independent object")
    setattr(cloned, "bbox", bbox)
    return cloned


def _confidence(detection: BBoxDetection) -> float:
    # getattr: legacy duck-typed detections (test doubles) may omit score.
    score = float(getattr(detection, "score", 0.0) or 0.0)
    return min(1.0, max(0.0, score)) if math.isfinite(score) else 0.0


async def detect_with_fallbacks[T: BBoxDetection](
    image: Image.Image,
    run_detection: DetectionRunner[T],
    *,
    copy_detection: DetectionCopier[T] | None = None,
) -> tuple[list[T], str]:
    """Borrow the input image; return copied detections in original coordinates.

    The detector may use each supplied variant only until its await returns.
    """
    rgb = await run_native(to_rgb_array, image)
    size: PixelSize = rgb.shape[1], rgb.shape[0]
    copier = copy_detection if copy_detection is not None else _copy_detection

    best: list[T] = []
    best_variant = "original"
    best_rank: tuple[int, float] = (-1, -1.0)

    for variant in _iter_variants(rgb):
        variant_image = await run_native(_materialize, variant)
        try:
            candidates = await run_detection(variant_image)
            detections: list[T] = []
            for detection in candidates:
                restored = iv.clip_bbox(variant.restore_bbox(detection.bbox), size)
                if restored is not None:
                    detections.append(copier(detection, restored))
        finally:
            variant_image.close()

        rank = len(detections), sum(_confidence(item) for item in detections)
        logger.debug(
            "detection_fallback.variant",
            extra={"variant": variant.name, "count": len(detections)},
        )
        if rank > best_rank:
            best = detections
            best_variant = variant.name
            best_rank = rank

        if (
            variant.name == "original"
            and len(detections) >= MIN_ORIGINAL_DETECTIONS_TO_SKIP_FALLBACKS
        ):
            break

    logger.info(
        "detection_fallback.done",
        extra={"variant": best_variant, "count": len(best)},
    )
    return best, best_variant
