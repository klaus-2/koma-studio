"""Photometric/geometric variants shared by the detection and OCR fallbacks.

Every function is pure and CPU-bound; callers offload with ``asyncio.to_thread``.
Bounding boxes are ``(x1, y1, x2, y2)`` with exclusive right/bottom edges.
"""

from __future__ import annotations

import math
from typing import Final

import cv2
import numpy as np
from numpy.typing import NDArray

type RGBImage = NDArray[np.uint8]
type BBox = tuple[int, int, int, int]
type PixelSize = tuple[int, int]
"""(width, height) — PIL order."""

UPSCALE_MAX_LONG_EDGE: Final = 2048
UPSCALE_MIN_LONG_EDGE: Final = 1400
UPSCALE_MIN_SHORT_EDGE: Final = 720
GAMMA_TARGET_MEAN: Final = 0.5


def invert(rgb: RGBImage) -> RGBImage:
    return np.asarray(cv2.bitwise_not(rgb), dtype=np.uint8)


def gamma_normalize(rgb: RGBImage) -> RGBImage:
    """Remap luminance so the mean lands on mid-grey. Identity for flat black/white.

    Implemented as a 256-entry LUT: O(pixels) uint8 work, no float temporaries.
    """
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mean = float(np.mean(gray)) / 255.0
    if mean <= 0.0 or mean >= 1.0:
        return rgb
    gamma = math.log(GAMMA_TARGET_MEAN) / math.log(mean)
    lut = (np.linspace(0.0, 1.0, 256) ** gamma * 255.0).round().astype(np.uint8)
    return np.asarray(cv2.LUT(rgb, lut), dtype=np.uint8)


def upscale_target(size: PixelSize) -> PixelSize | None:
    """Target size for the upscale variant, or ``None`` when the page is already large."""
    width, height = size
    long_edge, short_edge = max(size), min(size)
    if long_edge >= UPSCALE_MIN_LONG_EDGE and short_edge >= UPSCALE_MIN_SHORT_EDGE:
        return None
    target_long = min(UPSCALE_MAX_LONG_EDGE, max(UPSCALE_MIN_LONG_EDGE, long_edge * 2))
    scale = target_long / long_edge
    target = (max(1, round(width * scale)), max(1, round(height * scale)))
    return target if target[0] > width or target[1] > height else None


def upscale(rgb: RGBImage, target: PixelSize) -> RGBImage:
    return np.asarray(cv2.resize(rgb, target, interpolation=cv2.INTER_CUBIC), dtype=np.uint8)


def rotate_clockwise(rgb: RGBImage) -> RGBImage:
    return np.ascontiguousarray(np.rot90(rgb, k=-1))


def unrotate_clockwise_bbox(bbox: BBox, original_size: PixelSize) -> BBox:
    """Map a box from the clockwise-rotated frame back to the original frame.

    Clockwise rotation sends original ``(x, y)`` to ``(H - 1 - y, x)``; with
    exclusive edges the box inverse is ``x' = y`` and ``y' = H - x``.
    """
    _, height = original_size
    x1, y1, x2, y2 = bbox
    return (y1, height - x2, y2, height - x1)


def scale_bbox(bbox: BBox, *, scale_x: float, scale_y: float) -> BBox:
    x1, y1, x2, y2 = bbox
    return (round(x1 * scale_x), round(y1 * scale_y), round(x2 * scale_x), round(y2 * scale_y))


def clip_bbox(bbox: BBox, size: PixelSize) -> BBox | None:
    """Normalise corner order and clip to the canvas; ``None`` when the box is empty."""
    width, height = size
    x1, y1, x2, y2 = bbox
    left, right = max(0, min(x1, x2)), min(width, max(x1, x2))
    top, bottom = max(0, min(y1, y2)), min(height, max(y1, y2))
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom
