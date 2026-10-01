"""Inpaint mask rasterisation from segmenter masks and/or detection boxes."""

from __future__ import annotations

import base64
import binascii
import logging
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Final

import cv2
import numpy as np

from utils.image_codec import (
    ImageDecodeError,
    MaskImage,
    PixelShape,
    decode_binary_mask,
    dilate_mask,
)
from utils.image_variants import BBox, clip_bbox

logger = logging.getLogger(__name__)

_RASTER_LONG_EDGE: Final = 2048.0
_RASTER_PAD: Final = 1


@dataclass(frozen=True)
class MaskRegion:
    bbox: BBox
    segment_boxes: list[BBox] = field(default_factory=list)
    merged_boxes: list[BBox] = field(default_factory=list)
    mask_base64: str = ""


def _decode_region_mask(encoded: str, *, target_shape: PixelShape) -> MaskImage | None:
    try:
        payload = base64.b64decode(encoded)
    except (binascii.Error, ValueError):
        logger.warning("mask.base64_invalid")
        return None
    try:
        return decode_binary_mask(payload, target_shape=target_shape)
    except ImageDecodeError:
        # decode_binary_mask guards the pixel budget (decompression-bomb safe).
        logger.warning("mask.png_invalid", exc_info=True)
        return None


def _region_boxes(region: MaskRegion, size: tuple[int, int]) -> list[BBox]:
    candidates = region.merged_boxes or region.segment_boxes or [region.bbox]
    return [box for raw in candidates if (box := clip_bbox(raw, size)) is not None]


def _rasterize_boxes(mask: MaskImage, boxes: Sequence[BBox]) -> None:
    """Draw the closed hull of ``boxes`` into ``mask`` in place.

    Works on a ≤2048px-long-edge copy of the boxes' bounding ROI so the
    morphological close costs the same regardless of page resolution;
    resulting contours are scaled back onto the full mask.
    """
    min_x = min(x1 for x1, _, _, _ in boxes)
    min_y = min(y1 for _, y1, _, _ in boxes)
    roi_w = max(1, max(x2 for _, _, x2, _ in boxes) - min_x + 1)
    roi_h = max(1, max(y2 for _, _, _, y2 in boxes) - min_y + 1)
    downscale = max(1.0, max(roi_w, roi_h) / _RASTER_LONG_EDGE)

    small = np.zeros((int(roi_h / downscale) + 2, int(roi_w / downscale) + 2), dtype=np.uint8)
    for x1, y1, x2, y2 in boxes:
        cv2.rectangle(
            small,
            (int((x1 - min_x) / downscale) + _RASTER_PAD, int((y1 - min_y) / downscale) + _RASTER_PAD),
            (int((x2 - min_x) / downscale) + _RASTER_PAD, int((y2 - min_y) / downscale) + _RASTER_PAD),
            255,
            thickness=-1,
        )

    close_size = max(3, min(9, round(min(roi_w, roi_h) / 160) * 2 + 1))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_size, close_size))
    closed = cv2.morphologyEx(small, cv2.MORPH_CLOSE, kernel)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    polygons: list[np.ndarray] = []
    for contour in contours:
        points = np.asarray(contour).reshape(-1, 2)
        if points.shape[0] < 3:
            continue
        scaled = (points.astype(np.float32) - _RASTER_PAD) * downscale
        scaled[:, 0] += min_x
        scaled[:, 1] += min_y
        polygons.append(np.round(scaled).astype(np.int32))
    if polygons:
        cv2.fillPoly(mask, polygons, 255)


def generate_baka_style_mask(
    image_width: int,
    image_height: int,
    regions: Sequence[MaskRegion],
    mask_dilation: int = 5,
) -> MaskImage:
    """Union of all region masks, dilated once.

    Dilation distributes over union (``dilate(A ∪ B) == dilate(A) ∪ dilate(B)``),
    so a single pass at the end is identical to dilating each region and is
    O(pixels) instead of O(regions × pixels).
    """
    mask: MaskImage = np.zeros((image_height, image_width), dtype=np.uint8)
    shape: PixelShape = (image_height, image_width)
    size = (image_width, image_height)

    for region in regions:
        if region.mask_base64:
            segment = _decode_region_mask(region.mask_base64, target_shape=shape)
            if segment is not None:
                np.maximum(mask, segment, out=mask)
                continue
        boxes = _region_boxes(region, size)
        if boxes:
            _rasterize_boxes(mask, boxes)

    return dilate_mask(mask, radius=max(0, mask_dilation))
