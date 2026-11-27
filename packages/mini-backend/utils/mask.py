from __future__ import annotations

import base64
import binascii
import logging
import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Final

import cv2
import numpy as np

from utils.image_codec import (
    MAX_IMAGE_BYTES,
    ImageDecodeError,
    MaskImage,
    PixelShape,
    decode_binary_mask,
    dilate_mask,
    validate_radius,
    validate_shape,
)
from utils.image_variants import BBox, PixelSize, clip_bbox
from utils.workers import run_native

logger = logging.getLogger(__name__)

_RASTER_LONG_EDGE: Final = 2048
_MAX_BASE64_CHARACTERS: Final = 4 * ((MAX_IMAGE_BYTES + 2) // 3)
_MAX_REGIONS: Final = 10_000
_MAX_BOXES: Final = 100_000


@dataclass(frozen=True, slots=True)
class MaskRegion:
    bbox: BBox
    segment_boxes: tuple[BBox, ...] = ()
    merged_boxes: tuple[BBox, ...] = ()
    mask_base64: str = ""
    bubble_bbox: BBox | None = None

    def __post_init__(self) -> None:
        object.__setattr__(self, "segment_boxes", tuple(self.segment_boxes))
        object.__setattr__(self, "merged_boxes", tuple(self.merged_boxes))


def _decode_region_mask(
    encoded: str,
    *,
    target_shape: PixelShape,
) -> MaskImage | None:
    if len(encoded) > _MAX_BASE64_CHARACTERS:
        logger.warning("mask.encoded_budget_exceeded")
        return None

    try:
        payload = base64.b64decode(encoded, validate=True)
        return decode_binary_mask(payload, target_shape=target_shape)
    except (binascii.Error, ValueError, ImageDecodeError):
        logger.warning("mask.region_decode_failed")
        return None


def _region_boxes(region: MaskRegion, size: PixelSize) -> list[BBox]:
    candidates = region.merged_boxes or region.segment_boxes or (region.bbox,)
    return [
        clipped
        for raw in candidates
        if (clipped := clip_bbox(raw, size)) is not None
    ]


def _rasterize_boxes(mask: MaskImage, boxes: Sequence[BBox]) -> None:
    if not boxes:
        return

    min_x = min(box[0] for box in boxes)
    min_y = min(box[1] for box in boxes)
    max_x = max(box[2] for box in boxes)
    max_y = max(box[3] for box in boxes)
    width, height = max_x - min_x, max_y - min_y
    scale = max(1.0, max(width, height) / _RASTER_LONG_EDGE)
    small_width = max(1, math.ceil(width / scale))
    small_height = max(1, math.ceil(height / scale))
    small: MaskImage = np.zeros((small_height, small_width), dtype=np.uint8)

    for x1, y1, x2, y2 in boxes:
        left = math.floor((x1 - min_x) / scale)
        top = math.floor((y1 - min_y) / scale)
        right = math.ceil((x2 - min_x) / scale)
        bottom = math.ceil((y2 - min_y) / scale)
        small[top:bottom, left:right] = 255

    kernel_size = max(3, min(9, round(min(small.shape) / 160) * 2 + 1))
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (kernel_size, kernel_size),
    )
    closed = cv2.morphologyEx(
        small,
        cv2.MORPH_CLOSE,
        kernel,
        borderType=cv2.BORDER_CONSTANT,
        borderValue=0,
    )
    restored = np.asarray(
        cv2.resize(closed, (width, height), interpolation=cv2.INTER_NEAREST),
        dtype=np.uint8,
    )
    roi = mask[min_y:max_y, min_x:max_x]
    np.maximum(roi, restored, out=roi)

    for x1, y1, x2, y2 in boxes:
        mask[y1:y2, x1:x2] = 255


def _resolve_region_wall_bound(
    raw_region: MaskImage,
    region: MaskRegion,
    size: PixelSize,
    bubble_masks: Sequence[MaskImage] | None,
) -> MaskImage | None:
    """Return an eroded bubble interior bound mask if any bubble strictly encloses this text."""
    raw_bool = raw_region > 0
    if not np.any(raw_bool):
        return None

    erode_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    combined_bound: MaskImage | None = None

    if bubble_masks:
        for bmask in bubble_masks:
            if bmask.shape[:2] != raw_region.shape[:2]:
                continue
            if not np.any(raw_bool & (bmask > 0)):
                continue
            eroded = cv2.erode((bmask > 0).astype(np.uint8) * 255, erode_kernel, iterations=1)
            if not np.any(eroded):
                continue
            if combined_bound is None:
                combined_bound = eroded
            else:
                np.maximum(combined_bound, eroded, out=combined_bound)

    if combined_bound is None and region.bubble_bbox is not None:
        clipped = clip_bbox(region.bubble_bbox, size)
        if clipped is not None:
            bx1, by1, bx2, by2 = clipped
            if (bx2 - bx1) > 8 and (by2 - by1) > 8:
                combined_bound = np.zeros_like(raw_region)
                combined_bound[by1 + 2 : by2 - 2, bx1 + 2 : bx2 - 2] = 255

    if combined_bound is None:
        return None

    overflow_pixels = int(np.count_nonzero(raw_bool & (combined_bound == 0)))
    total_pixels = int(np.count_nonzero(raw_bool))
    if overflow_pixels > max(12, int(0.08 * total_pixels)):
        return None
    return combined_bound


def generate_baka_style_mask(
    image_width: int,
    image_height: int,
    regions: Sequence[MaskRegion],
    mask_dilation: int = 5,
    bubble_masks: Sequence[MaskImage] | None = None,
) -> MaskImage:
    shape = validate_shape((image_height, image_width))
    radius = validate_radius(mask_dilation)
    if len(regions) > _MAX_REGIONS:
        raise ValueError("Region count exceeds the rasterization budget")
    if sum(
        len(region.merged_boxes or region.segment_boxes or (region.bbox,))
        for region in regions
    ) > _MAX_BOXES:
        raise ValueError("Box count exceeds the rasterization budget")

    size: PixelSize = image_width, image_height
    use_wall_bounds = bool(bubble_masks) or any(r.bubble_bbox is not None for r in regions)
    if not use_wall_bounds:
        mask: MaskImage = np.zeros(shape, dtype=np.uint8)
        for region in regions:
            if region.mask_base64:
                segment = _decode_region_mask(region.mask_base64, target_shape=shape)
                if segment is not None:
                    np.maximum(mask, segment, out=mask)
                    continue
            _rasterize_boxes(mask, _region_boxes(region, size))
        return dilate_mask(mask, radius=radius)

    mask = np.zeros(shape, dtype=np.uint8)
    for region in regions:
        region_raw: MaskImage | None = None
        if region.mask_base64:
            region_raw = _decode_region_mask(region.mask_base64, target_shape=shape)
        if region_raw is None:
            region_raw = np.zeros(shape, dtype=np.uint8)
            _rasterize_boxes(region_raw, _region_boxes(region, size))

        dilated_region = dilate_mask(region_raw, radius=radius)
        bound = _resolve_region_wall_bound(region_raw, region, size, bubble_masks)
        if bound is not None:
            bounded = cv2.bitwise_and(dilated_region, bound)
            np.maximum(bounded, region_raw, out=bounded)
            dilated_region = bounded
        np.maximum(mask, dilated_region, out=mask)

    return mask


async def generate_baka_style_mask_async(
    image_width: int,
    image_height: int,
    regions: Sequence[MaskRegion],
    mask_dilation: int = 5,
    bubble_masks: Sequence[MaskImage] | None = None,
) -> MaskImage:
    return await run_native(
        generate_baka_style_mask,
        image_width,
        image_height,
        regions,
        mask_dilation,
        bubble_masks,
    )
