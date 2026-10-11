"""Otsu content segmentation with connected-component filtering.

The wire contract retains page-sized PNG masks. Encoding therefore scans the
page for every non-empty region; aggregate encoded output is bounded.
"""

from __future__ import annotations

import base64
import math
from collections.abc import Iterable, Sequence
from io import BytesIO
from typing import Final

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, UnidentifiedImageError

from models.errors import InferenceError, InvalidInputImageError
from models.geometry import BBox
from models.segmentation.base_segmenter import (
    BaseSegmenter,
    SegmentInputRegion,
    SegmentResultRegion,
)

type GrayArray = NDArray[np.uint8]
type MaskArray = NDArray[np.uint8]

_HEIGHT_EXPANSION_PCT: Final[int] = 10
_MIN_COMPONENT_AREA_PX: Final[int] = 10
_BORDER_MARGIN_PX: Final[int] = 1
_SEGMENT_MIN_SIDE_PX: Final[int] = 5
_MERGED_MIN_SIDE_PX: Final[int] = 2
_MERGE_LONG_EDGE_PX: Final[int] = 2048
_MERGE_PADDING: Final[int] = 8
_MAX_IMAGE_PIXELS: Final[int] = 32_000_000
_MAX_IMAGE_BYTES: Final[int] = 64 * 1024 * 1024
_MAX_OUTPUT_BYTES: Final[int] = 64 * 1024 * 1024

_MERGE_CLOSE_KERNEL: MaskArray = np.ones((15, 15), dtype=np.uint8)
_MERGE_CLOSE_KERNEL.flags.writeable = False


def decode_grayscale(image_bytes: bytes) -> GrayArray:
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

            # EXIF orientation is intentionally left unchanged to preserve coordinates.
            with source.convert("L") as grayscale:
                return np.array(grayscale, dtype=np.uint8, copy=True)
    except (UnidentifiedImageError, Image.DecompressionBombError) as exc:
        raise InvalidInputImageError("Image cannot be safely decoded") from exc
    except (OSError, ValueError) as exc:
        raise InvalidInputImageError("Image decoding failed") from exc


def _clip_ordered(bbox: BBox, width: int, height: int) -> BBox:
    x1, y1, x2, y2 = bbox
    return (
        min(max(min(x1, x2), 0), width),
        min(max(min(y1, y2), 0), height),
        min(max(max(x1, x2), 0), width),
        min(max(max(y1, y2), 0), height),
    )


def _expand_vertically(bbox: BBox, height: int, pct: int) -> BBox:
    if pct < 0:
        raise ValueError("Expansion percentage must be non-negative")

    x1, y1, x2, y2 = bbox
    if x2 <= x1 or y2 <= y1:
        return bbox

    dy = (y2 - y1) * pct // 200
    return x1, max(0, y1 - dy), x2, min(height, y2 + dy)


def _clip_and_drop_thin(
    boxes: Iterable[BBox],
    width: int,
    height: int,
    min_side: int,
) -> list[BBox]:
    kept: list[BBox] = []
    for box in boxes:
        x1, y1, x2, y2 = _clip_ordered(box, width, height)
        if x2 - x1 < min_side or y2 - y1 < min_side:
            continue
        kept.append((x1, y1, x2, y2))
    return sorted(set(kept), key=lambda box: (box[1], box[0], box[3], box[2]))


def _components(
    binary: MaskArray,
    *,
    min_area: int,
    margin: int,
) -> tuple[list[BBox], MaskArray | None]:
    height, width = binary.shape
    count, labels_raw, stats_raw, _ = cv2.connectedComponentsWithStats(
        binary,
        connectivity=8,
        ltype=cv2.CV_32S,
    )
    if count <= 1:
        return [], None

    stats = np.asarray(stats_raw, dtype=np.int32)[1:]
    left = stats[:, cv2.CC_STAT_LEFT]
    top = stats[:, cv2.CC_STAT_TOP]
    box_width = stats[:, cv2.CC_STAT_WIDTH]
    box_height = stats[:, cv2.CC_STAT_HEIGHT]
    area = stats[:, cv2.CC_STAT_AREA]

    keep = (
        (area >= min_area)
        & (left >= margin)
        & (top >= margin)
        & (left + box_width <= width - margin)
        & (top + box_height <= height - margin)
    )
    if not keep.any():
        return [], None

    lookup = np.zeros(count, dtype=np.uint8)
    lookup[np.flatnonzero(keep) + 1] = 255
    labels = np.asarray(labels_raw, dtype=np.int32)
    mask: MaskArray = lookup[labels]

    boxes: list[BBox] = [
        (int(x), int(y), int(x + width_), int(y + height_))
        for x, y, width_, height_ in zip(
            left[keep],
            top[keep],
            box_width[keep],
            box_height[keep],
            strict=True,
        )
    ]
    return boxes, mask


def _detect_content(crop: GrayArray) -> tuple[list[BBox], MaskArray]:
    threshold, _ = cv2.threshold(
        crop,
        0,
        255,
        cv2.THRESH_BINARY | cv2.THRESH_OTSU,
    )
    mask = np.zeros_like(crop)
    boxes: list[BBox] = []

    for dark in (True, False):
        polarity = crop <= threshold if dark else crop > threshold
        binary = np.where(polarity, np.uint8(255), np.uint8(0))
        polarity_boxes, polarity_mask = _components(
            binary,
            min_area=_MIN_COMPONENT_AREA_PX,
            margin=_BORDER_MARGIN_PX,
        )
        boxes.extend(polarity_boxes)
        if polarity_mask is not None:
            np.bitwise_or(mask, polarity_mask, out=mask)

    return boxes, mask


def _merge_boxes_baka_style(
    boxes: Sequence[BBox],
    width: int,
    height: int,
) -> list[BBox]:
    clipped = _clip_and_drop_thin(boxes, width, height, 1)
    if not clipped:
        return []

    min_x = min(box[0] for box in clipped)
    min_y = min(box[1] for box in clipped)
    max_x = max(box[2] for box in clipped)
    max_y = max(box[3] for box in clipped)
    roi_width = max_x - min_x
    roi_height = max_y - min_y
    scale = max(
        1.0,
        max(roi_width, roi_height) / _MERGE_LONG_EDGE_PX,
    )
    padding = _MERGE_PADDING

    canvas = np.zeros(
        (
            math.ceil(roi_height / scale) + 2 * padding,
            math.ceil(roi_width / scale) + 2 * padding,
        ),
        dtype=np.uint8,
    )

    for x1, y1, x2, y2 in clipped:
        left = math.floor((x1 - min_x) / scale) + padding
        top = math.floor((y1 - min_y) / scale) + padding
        right = math.ceil((x2 - min_x) / scale) + padding
        bottom = math.ceil((y2 - min_y) / scale) + padding
        canvas[top:bottom, left:right] = 255

    closed = cv2.morphologyEx(
        canvas,
        cv2.MORPH_CLOSE,
        _MERGE_CLOSE_KERNEL,
        borderType=cv2.BORDER_CONSTANT,
        borderValue=0,
    )
    contours, _ = cv2.findContours(
        closed,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    merged: list[BBox] = []
    for contour in contours:
        x, y, box_width, box_height = cv2.boundingRect(contour)
        merged.append(
            (
                math.floor(min_x + (x - padding) * scale),
                math.floor(min_y + (y - padding) * scale),
                math.ceil(min_x + (x + box_width - padding) * scale),
                math.ceil(min_y + (y + box_height - padding) * scale),
            )
        )

    return _clip_and_drop_thin(
        merged,
        width,
        height,
        _MERGED_MIN_SIDE_PX,
    )


def _encode_png_base64(mask: MaskArray) -> str:
    ok, encoded = cv2.imencode(".png", mask)
    if not ok:
        raise InferenceError("Segmentation mask encoding failed")

    payload = np.asarray(encoded, dtype=np.uint8)
    encoded_length = 4 * ((payload.nbytes + 2) // 3)
    if encoded_length > _MAX_OUTPUT_BYTES:
        raise InferenceError("Segmentation mask exceeds the output budget")

    return base64.b64encode(payload.tobytes()).decode("ascii")


class BakaContentSegmenter(BaseSegmenter):
    key = "baka_content_cc"
    name = "Baka Content CC"

    def _segment(
        self,
        image_bytes: bytes,
        regions: Sequence[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        if not regions:
            return []

        gray = decode_grayscale(image_bytes)
        scratch = np.zeros_like(gray)
        results: list[SegmentResultRegion] = []
        output_bytes = 0

        try:
            for region in regions:
                result = self._segment_region(gray, scratch, region)
                output_bytes += len(result.mask_base64)
                if output_bytes > _MAX_OUTPUT_BYTES:
                    raise InferenceError(
                        "Segmentation response exceeds the output budget"
                    )
                results.append(result)
        except cv2.error as exc:
            raise InferenceError("OpenCV segmentation failed") from exc

        return results

    def _segment_region(
        self,
        gray: GrayArray,
        scratch: MaskArray,
        region: SegmentInputRegion,
    ) -> SegmentResultRegion:
        height, width = gray.shape
        clipped = _clip_ordered(region.bbox, width, height)
        if clipped[2] <= clipped[0] or clipped[3] <= clipped[1]:
            return self._result(region, (), (), "")

        x1, y1, x2, y2 = _expand_vertically(
            clipped,
            height,
            _HEIGHT_EXPANSION_PCT,
        )

        local_boxes, crop_mask = _detect_content(gray[y1:y2, x1:x2])
        segment_boxes = _clip_and_drop_thin(
            (
                (x1 + left, y1 + top, x1 + right, y1 + bottom)
                for left, top, right, bottom in local_boxes
            ),
            width,
            height,
            _SEGMENT_MIN_SIDE_PX,
        )
        merged_boxes = _merge_boxes_baka_style(
            segment_boxes,
            width,
            height,
        )

        mask_base64 = ""
        if crop_mask.any():
            window = scratch[y1:y2, x1:x2]
            window[:] = crop_mask
            try:
                mask_base64 = _encode_png_base64(scratch)
            finally:
                window[:] = 0

        return self._result(
            region,
            tuple(segment_boxes),
            tuple(merged_boxes),
            mask_base64,
        )

    def _result(
        self,
        region: SegmentInputRegion,
        segment_boxes: tuple[BBox, ...],
        merged_boxes: tuple[BBox, ...],
        mask_base64: str,
    ) -> SegmentResultRegion:
        return SegmentResultRegion(
            id=region.id,
            bbox=region.bbox,
            segment_boxes=segment_boxes,
            merged_boxes=merged_boxes,
            source=region.source,
            detector_model_key=region.detector_model_key,
            ocr_model_key=region.ocr_model_key,
            translator_model_key=region.translator_model_key,
            segment_model_key=self.key,
            mask_base64=mask_base64,
        )
