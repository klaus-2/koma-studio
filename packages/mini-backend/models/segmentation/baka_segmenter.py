from __future__ import annotations

import base64
from io import BytesIO

import cv2
import numpy as np
from PIL import Image

from models.segmentation.base_segmenter import (
    BaseSegmenter,
    SegmentInputRegion,
    SegmentResultRegion,
)


def _normalize_box(
    box: tuple[int, int, int, int],
    width: int,
    height: int,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = box
    left = int(max(0, min(x1, x2)))
    right = int(min(width, max(x1, x2)))
    top = int(max(0, min(y1, y2)))
    bottom = int(min(height, max(y1, y2)))
    return left, top, right, bottom


def _expand_box(
    box: tuple[int, int, int, int],
    width: int,
    height: int,
    width_pct: int = 0,
    height_pct: int = 10,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = _normalize_box(box, width=width, height=height)
    bw = max(1, x2 - x1)
    bh = max(1, y2 - y1)

    dx = int((bw * width_pct) / 100.0 / 2.0)
    dy = int((bh * height_pct) / 100.0 / 2.0)

    nx1 = max(0, x1 - dx)
    ny1 = max(0, y1 - dy)
    nx2 = min(width, x2 + dx)
    ny2 = min(height, y2 + dy)
    return int(nx1), int(ny1), int(nx2), int(ny2)


def _filter_and_fix_boxes(
    boxes: list[tuple[int, int, int, int]],
    image_shape: tuple[int, int],
    width_tolerance: int = 5,
    height_tolerance: int = 5,
) -> list[tuple[int, int, int, int]]:
    img_h, img_w = image_shape[:2]
    cleaned: list[tuple[int, int, int, int]] = []
    for box in boxes:
        x1, y1, x2, y2 = box
        x1 = max(0, min(int(x1), img_w))
        x2 = max(0, min(int(x2), img_w))
        y1 = max(0, min(int(y1), img_h))
        y2 = max(0, min(int(y2), img_h))
        w = x2 - x1
        h = y2 - y1
        if w <= width_tolerance or h <= height_tolerance:
            continue
        cleaned.append((x1, y1, x2, y2))
    return cleaned


def _extract_component_boxes(
    binary: np.ndarray,
    min_area: int,
    margin: int,
) -> list[tuple[int, int, int, int]]:
    if binary.size == 0:
        return []
    h, w = binary.shape[:2]
    num_labels, _labels, stats, _centroids = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )
    if num_labels <= 1 or stats is None:
        return []

    boxes: list[tuple[int, int, int, int]] = []
    for idx in range(1, num_labels):
        x = int(stats[idx, cv2.CC_STAT_LEFT])
        y = int(stats[idx, cv2.CC_STAT_TOP])
        bw = int(stats[idx, cv2.CC_STAT_WIDTH])
        bh = int(stats[idx, cv2.CC_STAT_HEIGHT])
        area = int(stats[idx, cv2.CC_STAT_AREA])

        if area <= min_area:
            continue
        if (
            x < margin
            or y < margin
            or (x + bw) > (w - margin)
            or (y + bh) > (h - margin)
        ):
            continue
        boxes.append((x, y, x + bw, y + bh))
    return boxes


def _detect_content_boxes(
    crop: np.ndarray,
    min_area: int = 10,
    margin: int = 1,
) -> tuple[list[tuple[int, int, int, int]], np.ndarray]:
    """Detect content and return both bounding boxes and a pixel-accurate mask."""
    if crop is None or crop.size == 0:
        return [], np.zeros((0, 0), dtype=np.uint8)
    if len(crop.shape) == 3:
        gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    else:
        gray = crop

    threshold, _ = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    black_text = (gray < threshold).astype(np.uint8) * 255
    white_text = (gray > threshold).astype(np.uint8) * 255

    boxes_black = _extract_component_boxes(black_text, min_area=min_area, margin=margin)
    boxes_white = _extract_component_boxes(white_text, min_area=min_area, margin=margin)

    # Build pixel-accurate mask from the actual connected components
    h, w = gray.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    for component_binary, boxes in [
        (black_text, boxes_black),
        (white_text, boxes_white),
    ]:
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
            component_binary, connectivity=8
        )
        if num_labels <= 1 or stats is None:
            continue
        for idx in range(1, num_labels):
            x = int(stats[idx, cv2.CC_STAT_LEFT])
            y = int(stats[idx, cv2.CC_STAT_TOP])
            bw = int(stats[idx, cv2.CC_STAT_WIDTH])
            bh = int(stats[idx, cv2.CC_STAT_HEIGHT])
            area = int(stats[idx, cv2.CC_STAT_AREA])
            if area <= min_area:
                continue
            if (
                x < margin
                or y < margin
                or (x + bw) > (w - margin)
                or (y + bh) > (h - margin)
            ):
                continue
            # Draw only the actual component pixels, not the bounding box
            component_mask = (labels == idx).astype(np.uint8) * 255
            mask = cv2.bitwise_or(mask, component_mask)

    return boxes_black + boxes_white, mask


def _encode_mask_as_base64(mask: np.ndarray) -> str:
    """Encode a binary mask as a base64-encoded PNG string."""
    if mask.size == 0 or not np.any(mask):
        return ""
    _, buf = cv2.imencode(".png", mask)
    return base64.b64encode(buf.tobytes()).decode("ascii")


def _merge_boxes_baka_style(
    boxes: list[tuple[int, int, int, int]],
    image_shape: tuple[int, int],
) -> list[tuple[int, int, int, int]]:
    if not boxes:
        return []
    h, w = image_shape[:2]
    xs = [x for x1, _y1, x2, _y2 in boxes for x in (x1, x2)]
    ys = [y for _x1, y1, _x2, y2 in boxes for y in (y1, y2)]

    min_x = max(0, min(xs))
    max_x = min(w, max(xs))
    min_y = max(0, min(ys))
    max_y = min(h, max(ys))
    roi_w = max(1, max_x - min_x + 1)
    roi_h = max(1, max_y - min_y + 1)

    # Same downsample idea from Baka draw_segmentation_lines.
    long_edge = 2048.0
    ds = max(1.0, max(roi_w, roi_h) / long_edge)
    mw = int(roi_w / ds) + 2
    mh = int(roi_h / ds) + 2

    mask = np.zeros((mh, mw), dtype=np.uint8)
    for x1, y1, x2, y2 in boxes:
        x1i = int((x1 - min_x) / ds)
        y1i = int((y1 - min_y) / ds)
        x2i = int((x2 - min_x) / ds)
        y2i = int((y2 - min_y) / ds)
        cv2.rectangle(mask, (x1i, y1i), (x2i, y2i), 255, thickness=-1)

    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 15))
    closed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    contours, _hierarchy = cv2.findContours(
        closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return boxes

    merged: list[tuple[int, int, int, int]] = []
    for cnt in contours:
        x, y, bw, bh = cv2.boundingRect(cnt)
        gx1 = int(min_x + x * ds)
        gy1 = int(min_y + y * ds)
        gx2 = int(min(w, min_x + (x + bw) * ds))
        gy2 = int(min(h, min_y + (y + bh) * ds))
        merged.append((gx1, gy1, gx2, gy2))
    return _filter_and_fix_boxes(
        merged, image_shape=image_shape, width_tolerance=2, height_tolerance=2
    )


class BakaContentSegmenter(BaseSegmenter):
    key = "baka_content_cc"
    name = "Baka Content CC"

    def _segment(
        self,
        image_bytes: bytes,
        regions: list[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        pil_image = Image.open(BytesIO(image_bytes)).convert("RGB")
        rgb = np.array(pil_image)
        image = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        h, w = image.shape[:2]

        results: list[SegmentResultRegion] = []
        for region in regions:
            x1, y1, x2, y2 = _expand_box(
                region.bbox, width=w, height=h, width_pct=0, height_pct=10
            )
            if x2 <= x1 or y2 <= y1:
                results.append(
                    SegmentResultRegion(
                        id=region.id,
                        bbox=(x1, y1, x2, y2),
                        segment_boxes=[],
                        merged_boxes=[],
                        source=region.source,
                        detector_model_key=region.detector_model_key,
                        ocr_model_key=region.ocr_model_key,
                        translator_model_key=region.translator_model_key,
                        segment_model_key=self.key,
                    ),
                )
                continue

            crop = image[y1:y2, x1:x2]
            local_boxes, crop_mask = _detect_content_boxes(crop, min_area=10, margin=1)
            global_boxes = [
                (x1 + lx1, y1 + ly1, x1 + lx2, y1 + ly2)
                for lx1, ly1, lx2, ly2 in local_boxes
            ]
            segment_boxes = _filter_and_fix_boxes(
                global_boxes,
                image_shape=(h, w),
                width_tolerance=5,
                height_tolerance=5,
            )
            merged_boxes = _merge_boxes_baka_style(segment_boxes, image_shape=(h, w))

            # Build full-size pixel-accurate mask from the crop mask
            mask_base64 = ""
            if crop_mask.size > 0 and np.any(crop_mask):
                full_mask = np.zeros((h, w), dtype=np.uint8)
                full_mask[y1:y2, x1:x2] = crop_mask
                mask_base64 = _encode_mask_as_base64(full_mask)

            results.append(
                SegmentResultRegion(
                    id=region.id,
                    bbox=(
                        int(region.bbox[0]),
                        int(region.bbox[1]),
                        int(region.bbox[2]),
                        int(region.bbox[3]),
                    ),
                    segment_boxes=segment_boxes,
                    merged_boxes=merged_boxes,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=region.translator_model_key,
                    segment_model_key=self.key,
                    mask_base64=mask_base64,
                ),
            )

        return results
