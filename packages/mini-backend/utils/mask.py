from __future__ import annotations

import base64
from dataclasses import dataclass, field
from io import BytesIO

import cv2
import numpy as np
from PIL import Image


@dataclass(frozen=True)
class MaskRegion:
    bbox: tuple[int, int, int, int]
    segment_boxes: list[tuple[int, int, int, int]] = field(default_factory=list)
    merged_boxes: list[tuple[int, int, int, int]] = field(default_factory=list)
    mask_base64: str = ""


def _normalize_box(
    box: tuple[int, int, int, int],
    width: int,
    height: int,
) -> tuple[int, int, int, int] | None:
    x1, y1, x2, y2 = [int(v) for v in box]
    left = max(0, min(x1, x2))
    right = min(width, max(x1, x2))
    top = max(0, min(y1, y2))
    bottom = min(height, max(y1, y2))
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def _collect_boxes_for_region(
    region: MaskRegion, width: int, height: int
) -> list[tuple[int, int, int, int]]:
    base_boxes = region.merged_boxes or region.segment_boxes or [region.bbox]
    normalized: list[tuple[int, int, int, int]] = []
    for box in base_boxes:
        fixed = _normalize_box(box, width=width, height=height)
        if fixed is not None:
            normalized.append(fixed)
    return normalized


def _decode_base64_mask(b64_str: str) -> np.ndarray | None:
    """Decode a base64-encoded PNG mask to a numpy array."""
    if not b64_str:
        return None
    try:
        payload = base64.b64decode(b64_str)
        img = Image.open(BytesIO(payload)).convert("L")
        return np.array(img)
    except Exception:
        return None


def generate_baka_style_mask(
    image_width: int,
    image_height: int,
    regions: list[MaskRegion],
    mask_dilation: int = 5,
) -> np.ndarray:
    mask = np.zeros((image_height, image_width), dtype=np.uint8)
    long_edge = 2048.0
    dilation = max(0, int(mask_dilation))

    for region in regions:
        # If the segmenter provided a pixel-accurate mask, use it directly
        if region.mask_base64:
            segment_mask = _decode_base64_mask(region.mask_base64)
            if segment_mask is not None:
                if (
                    segment_mask.shape[0] != image_height
                    or segment_mask.shape[1] != image_width
                ):
                    segment_mask = cv2.resize(
                        segment_mask,
                        (image_width, image_height),
                        interpolation=cv2.INTER_NEAREST,
                    )
                block_mask = np.where(segment_mask > 0, 255, 0).astype(np.uint8)
                if dilation > 0:
                    kernel_dilate = cv2.getStructuringElement(
                        cv2.MORPH_ELLIPSE,
                        (dilation * 2 + 1, dilation * 2 + 1),
                    )
                    block_mask = cv2.dilate(block_mask, kernel_dilate, iterations=1)
                mask = cv2.bitwise_or(mask, block_mask)
                continue

        # Fallback: use rectangular boxes (legacy behavior)
        boxes = _collect_boxes_for_region(
            region, width=image_width, height=image_height
        )
        if not boxes:
            continue

        xs = [x for x1, _y1, x2, _y2 in boxes for x in (x1, x2)]
        ys = [y for _x1, y1, _x2, y2 in boxes for y in (y1, y2)]
        min_x = max(0, min(xs))
        max_x = min(image_width, max(xs))
        min_y = max(0, min(ys))
        max_y = min(image_height, max(ys))
        roi_w = max(1, max_x - min_x + 1)
        roi_h = max(1, max_y - min_y + 1)

        ds = max(1.0, max(roi_w, roi_h) / long_edge)
        mw = int(roi_w / ds) + 2
        mh = int(roi_h / ds) + 2
        pad_offset = 1

        small = np.zeros((mh, mw), dtype=np.uint8)
        for x1, y1, x2, y2 in boxes:
            x1i = int((x1 - min_x) / ds) + pad_offset
            y1i = int((y1 - min_y) / ds) + pad_offset
            x2i = int((x2 - min_x) / ds) + pad_offset
            y2i = int((y2 - min_y) / ds) + pad_offset
            cv2.rectangle(small, (x1i, y1i), (x2i, y2i), 255, thickness=-1)

        close_size = max(3, min(9, int(round(min(roi_w, roi_h) / 160)) * 2 + 1))
        kernel_close = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (close_size, close_size)
        )
        closed = cv2.morphologyEx(small, cv2.MORPH_CLOSE, kernel_close)
        contours, _ = cv2.findContours(
            closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
        )
        if not contours:
            continue

        block_mask = np.zeros((image_height, image_width), dtype=np.uint8)
        for cnt in contours:
            pts = cnt.reshape(-1, 2)
            if pts.shape[0] < 3:
                continue
            pts_f = (pts.astype(np.float32) - float(pad_offset)) * float(ds)
            pts_f[:, 0] += float(min_x)
            pts_f[:, 1] += float(min_y)
            pts_i = np.round(pts_f).astype(np.int32)
            cv2.fillPoly(block_mask, [pts_i], 255)

        if dilation > 0:
            kernel_dilate = cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE,
                (dilation * 2 + 1, dilation * 2 + 1),
            )
            block_mask = cv2.dilate(block_mask, kernel_dilate, iterations=1)

        mask = cv2.bitwise_or(mask, block_mask)

    return mask
