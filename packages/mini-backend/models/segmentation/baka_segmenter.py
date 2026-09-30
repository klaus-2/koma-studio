"""Baka-style content segmentation: Otsu threshold + connected components.

Pure CPU/OpenCV, stateless, thread-safe. The pixel-accurate mask is what the
clean stage consumes; the boxes feed the editor overlay and mask heuristics.
"""

from __future__ import annotations

import base64
from collections.abc import Iterable, Sequence
from io import BytesIO
from typing import cast

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

_HEIGHT_EXPANSION_PCT = 10
_MIN_COMPONENT_AREA_PX = 10
_BORDER_MARGIN_PX = 1
_SEGMENT_MIN_SIDE_PX = 5
_MERGED_MIN_SIDE_PX = 2
_MERGE_LONG_EDGE_PX = 2048.0
# cv2 stubs type getStructuringElement as MatLike, not NDArray; the runtime
# object is an uint8 array.
_MERGE_CLOSE_KERNEL: MaskArray = cast(
    MaskArray, cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
)


def decode_grayscale(image_bytes: bytes) -> GrayArray:
    """Decode with PIL, not ``cv2.imdecode``: every other stage decodes with PIL,
    which never applies EXIF orientation, so coordinates stay aligned."""
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            return np.asarray(source.convert("L"), dtype=np.uint8)
    except UnidentifiedImageError as exc:
        raise InvalidInputImageError("Image bytes are not a decodable image") from exc
    except OSError as exc:
        raise InvalidInputImageError(f"Failed to decode image: {exc}") from exc


def _clip_ordered(bbox: BBox, width: int, height: int) -> BBox:
    x1, y1, x2, y2 = bbox
    return (
        max(0, min(x1, x2)),
        max(0, min(y1, y2)),
        min(width, max(x1, x2)),
        min(height, max(y1, y2)),
    )


def _expand_vertically(bbox: BBox, height: int, pct: int) -> BBox:
    x1, y1, x2, y2 = bbox
    # pct is the total growth; each edge receives half.
    dy = max(1, y2 - y1) * pct // 200
    return (x1, max(0, y1 - dy), x2, min(height, y2 + dy))


def _clip_and_drop_thin(
    boxes: Iterable[BBox], width: int, height: int, min_side: int
) -> list[BBox]:
    kept: list[BBox] = []
    for x1, y1, x2, y2 in boxes:
        cx1, cx2 = min(max(x1, 0), width), min(max(x2, 0), width)
        cy1, cy2 = min(max(y1, 0), height), min(max(y2, 0), height)
        if cx2 - cx1 <= min_side or cy2 - cy1 <= min_side:
            continue
        kept.append((cx1, cy1, cx2, cy2))
    return kept


def _components(
    binary: MaskArray, *, min_area: int, margin: int
) -> tuple[list[BBox], MaskArray | None]:
    """Boxes and a pixel mask of components that are big enough and do not
    touch the crop border. Single labelling pass; the mask is a LUT over labels."""
    height, width = binary.shape
    count, labels_raw, stats_raw, _ = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )
    if count <= 1:
        return [], None

    stats = np.asarray(stats_raw, dtype=np.int64)[1:]  # drop background label 0
    left = stats[:, int(cv2.CC_STAT_LEFT)]
    top = stats[:, int(cv2.CC_STAT_TOP)]
    box_w = stats[:, int(cv2.CC_STAT_WIDTH)]
    box_h = stats[:, int(cv2.CC_STAT_HEIGHT)]
    area = stats[:, int(cv2.CC_STAT_AREA)]

    keep = (
        (area > min_area)
        & (left >= margin)
        & (top >= margin)
        & (left + box_w <= width - margin)
        & (top + box_h <= height - margin)
    )
    if not keep.any():
        return [], None

    lut = np.zeros(count, dtype=np.uint8)
    lut[np.flatnonzero(keep) + 1] = 255
    # labels_raw comes back typed as cv2 MatLike; it is an int32 label matrix.
    labels = np.asarray(labels_raw, dtype=np.int64)
    mask = cast(MaskArray, lut[labels])
    boxes: list[BBox] = [
        (int(x), int(y), int(x + w), int(y + h))
        for x, y, w, h in zip(left[keep], top[keep], box_w[keep], box_h[keep], strict=True)
    ]
    return boxes, mask


def _detect_content(crop: GrayArray) -> tuple[list[BBox], MaskArray]:
    threshold, _ = cv2.threshold(crop, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    mask: MaskArray = np.zeros_like(crop)
    boxes: list[BBox] = []
    # Otsu partitions as (<= t, > t). Both polarities are kept: dark text on a
    # light balloon and light text over dark art. The old (t, > t) pair dropped
    # the =t pixels and left the dark class empty on clean binary crops.
    for polarity in (crop <= threshold, crop > threshold):
        binary = cast(MaskArray, np.multiply(polarity, 255, dtype=np.uint8))
        polarity_boxes, polarity_mask = _components(
            binary, min_area=_MIN_COMPONENT_AREA_PX, margin=_BORDER_MARGIN_PX
        )
        boxes.extend(polarity_boxes)
        if polarity_mask is not None:
            np.bitwise_or(mask, polarity_mask, out=mask)
    return boxes, mask


def _merge_boxes_baka_style(boxes: Sequence[BBox], width: int, height: int) -> list[BBox]:
    """Port of Baka's ``draw_segmentation_lines`` merge: rasterise boxes on a
    downsampled canvas, close small gaps, take external contours."""
    if not boxes:
        return []
    min_x = max(0, min(b[0] for b in boxes))
    min_y = max(0, min(b[1] for b in boxes))
    max_x = min(width, max(b[2] for b in boxes))
    max_y = min(height, max(b[3] for b in boxes))
    roi_w = max(1, max_x - min_x + 1)
    roi_h = max(1, max_y - min_y + 1)
    scale = max(1.0, max(roi_w, roi_h) / _MERGE_LONG_EDGE_PX)

    canvas: MaskArray = np.zeros(
        (int(roi_h / scale) + 2, int(roi_w / scale) + 2), dtype=np.uint8
    )
    for x1, y1, x2, y2 in boxes:
        cv2.rectangle(
            canvas,
            (int((x1 - min_x) / scale), int((y1 - min_y) / scale)),
            (int((x2 - min_x) / scale), int((y2 - min_y) / scale)),
            255,
            thickness=cv2.FILLED,
        )
    closed = cv2.morphologyEx(canvas, cv2.MORPH_CLOSE, _MERGE_CLOSE_KERNEL)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    merged: list[BBox] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        merged.append(
            (
                int(min_x + x * scale),
                int(min_y + y * scale),
                int(min_x + (x + w) * scale),
                int(min_y + (y + h) * scale),
            )
        )
    return _clip_and_drop_thin(merged, width, height, _MERGED_MIN_SIDE_PX)


def _encode_png_base64(mask: MaskArray) -> str:
    ok, encoded = cv2.imencode(".png", mask)
    if not ok:
        raise InferenceError("baka_content_cc: failed to encode segmentation mask as PNG")
    return base64.b64encode(np.asarray(encoded).tobytes()).decode("ascii")


class BakaContentSegmenter(BaseSegmenter):
    key = "baka_content_cc"
    name = "Baka Content CC"

    def _segment(
        self,
        image_bytes: bytes,
        regions: Sequence[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        gray = decode_grayscale(image_bytes)
        # One page-sized scratch buffer shared by all regions; only the window a
        # region wrote is cleared afterwards, so cost stays O(crop) per region.
        scratch: MaskArray = np.zeros_like(gray)
        return [self._segment_region(gray, scratch, region) for region in regions]

    def _segment_region(
        self,
        gray: GrayArray,
        scratch: MaskArray,
        region: SegmentInputRegion,
    ) -> SegmentResultRegion:
        height, width = gray.shape
        x1, y1, x2, y2 = _expand_vertically(
            _clip_ordered(region.bbox, width, height), height, _HEIGHT_EXPANSION_PCT
        )
        if x2 <= x1 or y2 <= y1:
            return self._result(region, (), (), "")

        local_boxes, crop_mask = _detect_content(gray[y1:y2, x1:x2])
        segment_boxes = _clip_and_drop_thin(
            ((x1 + lx1, y1 + ly1, x1 + lx2, y1 + ly2) for lx1, ly1, lx2, ly2 in local_boxes),
            width,
            height,
            _SEGMENT_MIN_SIDE_PX,
        )
        merged_boxes = _merge_boxes_baka_style(segment_boxes, width, height)

        mask_base64 = ""
        if crop_mask.any():
            scratch[y1:y2, x1:x2] = crop_mask
            mask_base64 = _encode_png_base64(scratch)
            scratch[y1:y2, x1:x2] = 0

        return self._result(region, tuple(segment_boxes), tuple(merged_boxes), mask_base64)

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
