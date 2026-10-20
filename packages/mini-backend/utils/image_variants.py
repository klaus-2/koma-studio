from __future__ import annotations

import math
from typing import Final

import cv2
import numpy as np
from PIL import Image

from utils.image_codec import RGBImage, validate_rgb, validate_shape

type BBox = tuple[int, int, int, int]
type PixelSize = tuple[int, int]

UPSCALE_MAX_LONG_EDGE: Final = 2048
UPSCALE_MIN_LONG_EDGE: Final = 1400
UPSCALE_MIN_SHORT_EDGE: Final = 720
GAMMA_TARGET_MEAN: Final = 0.5


def invert(rgb: RGBImage) -> RGBImage:
    validate_rgb(rgb)
    return np.asarray(cv2.bitwise_not(rgb), dtype=np.uint8)


def gamma_normalize(rgb: RGBImage) -> RGBImage:
    """Apply a mid-grey gamma LUT, without allocating float-sized image buffers."""
    validate_rgb(rgb)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mean = float(cv2.mean(gray)[0]) / 255.0
    if mean <= 0.0 or mean >= 1.0:
        return rgb.copy()

    exponent = math.log(GAMMA_TARGET_MEAN) / math.log(mean)
    levels = np.arange(256, dtype=np.float64) / 255.0
    lut = np.rint(np.power(levels, exponent) * 255.0).astype(np.uint8)
    return np.asarray(cv2.LUT(rgb, lut), dtype=np.uint8)


def upscale_target(size: PixelSize) -> PixelSize | None:
    width, height = size
    validate_shape((height, width))
    long_edge = max(size)
    short_edge = min(size)

    if long_edge >= UPSCALE_MIN_LONG_EDGE and short_edge >= UPSCALE_MIN_SHORT_EDGE:
        return None
    if long_edge >= UPSCALE_MAX_LONG_EDGE:
        return None

    scale = min(
        2.0,
        UPSCALE_MAX_LONG_EDGE / long_edge,
        max(
            UPSCALE_MIN_LONG_EDGE / long_edge,
            UPSCALE_MIN_SHORT_EDGE / short_edge,
        ),
    )
    target = max(1, round(width * scale)), max(1, round(height * scale))
    return target if target != size else None


def upscale(rgb: RGBImage, target: PixelSize) -> RGBImage:
    validate_rgb(rgb)
    validate_shape((target[1], target[0]))
    return np.asarray(
        cv2.resize(rgb, target, interpolation=cv2.INTER_CUBIC),
        dtype=np.uint8,
    )


def rotate_clockwise(rgb: RGBImage) -> RGBImage:
    validate_rgb(rgb)
    return np.ascontiguousarray(np.rot90(rgb, k=-1))


def unrotate_clockwise_bbox(bbox: BBox, original_size: PixelSize) -> BBox:
    _, height = original_size
    x1, y1, x2, y2 = bbox
    return y1, height - x2, y2, height - x1


def scale_bbox(bbox: BBox, *, scale_x: float, scale_y: float) -> BBox:
    if not all(math.isfinite(scale) and scale > 0 for scale in (scale_x, scale_y)):
        raise ValueError("Bounding-box scales must be finite and positive")

    x1, y1, x2, y2 = bbox
    return (
        math.floor(min(x1, x2) * scale_x),
        math.floor(min(y1, y2) * scale_y),
        math.ceil(max(x1, x2) * scale_x),
        math.ceil(max(y1, y2) * scale_y),
    )


def clip_bbox(bbox: BBox, size: PixelSize) -> BBox | None:
    width, height = size
    validate_shape((height, width))
    x1, y1, x2, y2 = bbox
    left = max(0, min(x1, x2))
    right = min(width, max(x1, x2))
    top = max(0, min(y1, y2))
    bottom = min(height, max(y1, y2))
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def to_rgb_array(image: Image.Image) -> RGBImage:
    with image.convert("RGB") as converted:
        rgb: RGBImage = np.array(converted, dtype=np.uint8, copy=True)
    validate_rgb(rgb)
    return rgb
