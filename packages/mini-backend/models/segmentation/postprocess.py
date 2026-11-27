"""Shared decoding, clustering, and wire-encoding helpers for segmenters."""

from __future__ import annotations

from collections.abc import Sequence
from io import BytesIO
from typing import Final

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, UnidentifiedImageError

from models.errors import InferenceError, InvalidInputImageError
from models.geometry import BBox
from models.segmentation.baka_segmenter import (
    _clip_and_drop_thin,
    _clip_ordered,
    _components,
    _encode_png_base64,
    _merge_boxes_baka_style,
)
from models.segmentation.base_segmenter import (
    SegmentInputRegion,
    SegmentResultRegion,
)

type RGBArray = NDArray[np.uint8]
type MaskArray = NDArray[np.uint8]

_MAX_IMAGE_PIXELS: Final[int] = 32_000_000
_MAX_IMAGE_BYTES: Final[int] = 64 * 1024 * 1024
_SEGMENT_MIN_SIDE_PX: Final[int] = 5


def decode_rgb(image_bytes: bytes) -> RGBArray:
    """Safely decode encoded image bytes into an RGB uint8 array without EXIF rotation."""
    if not image_bytes or len(image_bytes) > _MAX_IMAGE_BYTES:
        raise InvalidInputImageError("Invalid encoded image size")

    try:
        with Image.open(BytesIO(image_bytes)) as source:
            width, height = source.size
            if (
                width <= 0
                or height <= 0
                or width * height > _MAX_IMAGE_PIXELS
            ):
                raise InvalidInputImageError(
                    "Decoded image exceeds the pixel budget"
                )

            with source.convert("RGB") as rgb:
                return np.array(rgb, dtype=np.uint8, copy=True)
    except (UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise InvalidInputImageError("Image cannot be safely decoded") from exc
    except (OSError, ValueError) as exc:
        raise InvalidInputImageError("Image decoding failed") from exc


def cluster_region_bboxes(
    regions: Sequence[SegmentInputRegion],
    width: int,
    height: int,
    *,
    gap_px: int = 80,
    context_pad: int = 96,
) -> list[BBox]:
    """Group nearby region bboxes into context windows at native resolution."""
    canvas = np.zeros((height, width), dtype=np.uint8)
    has_box = False
    for region in regions:
        x1, y1, x2, y2 = _clip_ordered(region.bbox, width, height)
        if x2 <= x1 or y2 <= y1:
            continue
        canvas[y1:y2, x1:x2] = 255
        has_box = True
    if not has_box:
        return []

    kernel_side = max(1, gap_px + 1)
    grouped = cv2.dilate(
        canvas,
        cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_side, kernel_side)),
        iterations=1,
    )
    contours, _ = cv2.findContours(
        grouped,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    windows: list[BBox] = []
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        windows.append(
            (
                max(0, x - context_pad),
                max(0, y - context_pad),
                min(width, x + bw + context_pad),
                min(height, y + bh + context_pad),
            )
        )
    return sorted(windows, key=lambda box: (box[1], box[0], box[3], box[2]))


def build_segment_result(
    region: SegmentInputRegion,
    *,
    crop_mask: MaskArray,
    crop_box: BBox,
    image_shape: tuple[int, int],
    scratch: MaskArray,
    segment_model_key: str,
) -> tuple[SegmentResultRegion, int]:
    """Convert a local region binary mask into a page-aligned SegmentResultRegion."""
    height, width = image_shape
    x1, y1, x2, y2 = crop_box
    if x2 <= x1 or y2 <= y1 or not crop_mask.any():
        return (
            SegmentResultRegion(
                id=region.id,
                bbox=region.bbox,
                segment_boxes=(),
                merged_boxes=(),
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=region.translator_model_key,
                segment_model_key=segment_model_key,
                mask_base64="",
            ),
            0,
        )

    local_boxes, filtered_mask = _components(
        crop_mask,
        min_area=8,
        margin=0,
    )
    effective_mask = filtered_mask if filtered_mask is not None else crop_mask
    segment_boxes = _clip_and_drop_thin(
        (
            (x1 + left, y1 + top, x1 + right, y1 + bottom)
            for left, top, right, bottom in local_boxes
        ),
        width,
        height,
        _SEGMENT_MIN_SIDE_PX,
    )
    if not segment_boxes and effective_mask.any():
        ys, xs = np.nonzero(effective_mask)
        if xs.size > 0:
            segment_boxes = [(x1 + int(xs.min()), y1 + int(ys.min()), x1 + int(xs.max()) + 1, y1 + int(ys.max()) + 1)]
    merged_boxes = _merge_boxes_baka_style(segment_boxes, width, height)

    mask_base64 = ""
    if effective_mask.any():
        window = scratch[y1:y2, x1:x2]
        window[:] = effective_mask
        try:
            mask_base64 = _encode_png_base64(scratch)
        finally:
            window[:] = 0

    if not segment_boxes and not mask_base64:
        return (
            SegmentResultRegion(
                id=region.id,
                bbox=region.bbox,
                segment_boxes=(),
                merged_boxes=(),
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=region.translator_model_key,
                segment_model_key=segment_model_key,
                mask_base64="",
            ),
            0,
        )

    return (
        SegmentResultRegion(
            id=region.id,
            bbox=region.bbox,
            segment_boxes=tuple(segment_boxes),
            merged_boxes=tuple(merged_boxes),
            source=region.source,
            detector_model_key=region.detector_model_key,
            ocr_model_key=region.ocr_model_key,
            translator_model_key=region.translator_model_key,
            segment_model_key=segment_model_key,
            mask_base64=mask_base64,
        ),
        len(mask_base64),
    )


def validate_output_budget(added_bytes: int, current_total: int, limit: int) -> int:
    new_total = current_total + added_bytes
    if new_total > limit:
        raise InferenceError("Segmentation response exceeds the output budget")
    return new_total
