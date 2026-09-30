"""Pure bounding-box arithmetic shared by detectors and OCR engines."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

type BBox = tuple[int, int, int, int]


def clip_bbox(
    x1: float, y1: float, x2: float, y2: float, width: int, height: int
) -> BBox | None:
    """Round, clamp to the image and drop degenerate boxes."""
    cx1 = max(0, round(x1))
    cy1 = max(0, round(y1))
    cx2 = min(width, round(x2))
    cy2 = min(height, round(y2))
    if cx2 <= cx1 or cy2 <= cy1:
        return None
    return (cx1, cy1, cx2, cy2)


def expand_bbox(bbox: BBox, width: int, height: int, percentage: int) -> BBox | None:
    """Grow a box by ``percentage`` of its own size on each side, clamped to the image."""
    x1, y1, x2, y2 = bbox
    dx = max(1, x2 - x1) * percentage // 100
    dy = max(1, y2 - y1) * percentage // 100
    return clip_bbox(x1 - dx, y1 - dy, x2 + dx, y2 + dy, width, height)


def iou(a: BBox, b: BBox) -> float:
    ix1 = max(a[0], b[0])
    iy1 = max(a[1], b[1])
    ix2 = min(a[2], b[2])
    iy2 = min(a[3], b[3])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def greedy_nms(
    boxes: NDArray[np.float64],
    scores: NDArray[np.float64],
    iou_threshold: float,
) -> list[int]:
    """Vectorised greedy NMS. Returns kept indices ordered by descending score.

    ``boxes`` is ``(N, 4)`` as ``x1, y1, x2, y2``. A candidate is suppressed when
    its IoU with an already kept box is strictly greater than ``iou_threshold``.
    """
    if boxes.shape[0] == 0:
        return []
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = (x2 - x1) * (y2 - y1)
    order = np.argsort(-scores, kind="stable")
    keep: list[int] = []
    while order.size:
        current = int(order[0])
        keep.append(current)
        rest = order[1:]
        inter_w = np.clip(
            np.minimum(x2[current], x2[rest]) - np.maximum(x1[current], x1[rest]), 0, None
        )
        inter_h = np.clip(
            np.minimum(y2[current], y2[rest]) - np.maximum(y1[current], y1[rest]), 0, None
        )
        inter = inter_w * inter_h
        union = areas[current] + areas[rest] - inter
        ious = np.divide(inter, union, out=np.zeros_like(inter), where=union > 0)
        order = rest[ious <= iou_threshold]
    return keep
