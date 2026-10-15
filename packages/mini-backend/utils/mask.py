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


def generate_baka_style_mask(
    image_width: int,
    image_height: int,
    regions: Sequence[MaskRegion],
    mask_dilation: int = 5,
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

    mask: MaskImage = np.zeros(shape, dtype=np.uint8)
    size: PixelSize = image_width, image_height

    for region in regions:
        if region.mask_base64:
            segment = _decode_region_mask(region.mask_base64, target_shape=shape)
            if segment is not None:
                np.maximum(mask, segment, out=mask)
                continue

        _rasterize_boxes(mask, _region_boxes(region, size))

    return dilate_mask(mask, radius=radius)


async def generate_baka_style_mask_async(
    image_width: int,
    image_height: int,
    regions: Sequence[MaskRegion],
    mask_dilation: int = 5,
) -> MaskImage:
    return await run_native(
        generate_baka_style_mask,
        image_width,
        image_height,
        regions,
        mask_dilation,
    )
