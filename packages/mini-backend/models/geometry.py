"""Bounding-box arithmetic using exclusive right/bottom coordinates.

Extends the shared helpers with finite-value validation; ``clip_bbox``,
``expand_bbox``, ``iou`` and ``greedy_nms`` keep their historical signatures.
"""

from __future__ import annotations

import math

import numpy as np
from numpy.typing import NDArray

type BBox = tuple[int, int, int, int]


def clip_bbox(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    width: int,
    height: int,
) -> BBox | None:
    if width <= 0 or height <= 0:
        return None
    if not all(math.isfinite(value) for value in (x1, y1, x2, y2)):
        return None

    left = min(max(round(x1), 0), width)
    top = min(max(round(y1), 0), height)
    right = min(max(round(x2), 0), width)
    bottom = min(max(round(y2), 0), height)

    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def expand_bbox(
    bbox: BBox,
    width: int,
    height: int,
    percentage: int,
) -> BBox | None:
    if percentage < 0:
        raise ValueError("percentage must be non-negative")

    clipped = clip_bbox(*bbox, width, height)
    if clipped is None:
        return None

    x1, y1, x2, y2 = clipped
    dx = (x2 - x1) * percentage // 100
    dy = (y2 - y1) * percentage // 100
    return clip_bbox(
        x1 - dx,
        y1 - dy,
        x2 + dx,
        y2 + dy,
        width,
        height,
    )


def iou(a: BBox, b: BBox) -> float:
    area_a = max(0, a[2] - a[0]) * max(0, a[3] - a[1])
    area_b = max(0, b[2] - b[0]) * max(0, b[3] - b[1])
    if area_a == 0 or area_b == 0:
        return 0.0

    intersection = (
        max(0, min(a[2], b[2]) - max(a[0], b[0]))
        * max(0, min(a[3], b[3]) - max(a[1], b[1]))
    )
    union = area_a + area_b - intersection
    return intersection / union if union > 0 else 0.0


def greedy_nms(
    boxes: NDArray[np.float64],
    scores: NDArray[np.float64],
    iou_threshold: float,
) -> list[int]:
    """Stable greedy NMS; suppress only when IoU is strictly above threshold."""
    if not math.isfinite(iou_threshold) or not 0.0 <= iou_threshold <= 1.0:
        raise ValueError("iou_threshold must be finite and in [0, 1]")
    if boxes.ndim != 2 or boxes.shape[1] != 4:
        raise ValueError("boxes must have shape (N, 4)")
    if scores.ndim != 1 or scores.shape[0] != boxes.shape[0]:
        raise ValueError("scores must have shape (N,)")
    if boxes.dtype != np.float64 or scores.dtype != np.float64:
        raise TypeError("boxes and scores must use float64")
    if not np.isfinite(boxes).all() or not np.isfinite(scores).all():
        raise ValueError("boxes and scores must be finite")
    if np.any(boxes[:, 2:] <= boxes[:, :2]):
        raise ValueError("Boxes must have positive width and height")
    if boxes.shape[0] == 0:
        return []

    try:
        with np.errstate(over="raise", invalid="raise"):
            return _greedy_nms_validated(boxes, scores, iou_threshold)
    except FloatingPointError as exc:
        raise ValueError("Coordinates exceed safe numerical limits") from exc


def _greedy_nms_validated(
    boxes: NDArray[np.float64],
    scores: NDArray[np.float64],
    iou_threshold: float,
) -> list[int]:
    x1, y1, x2, y2 = boxes.T
    areas = (x2 - x1) * (y2 - y1)
    order = np.argsort(-scores, kind="stable")
    keep: list[int] = []

    while order.size:
        current = int(order[0])
        keep.append(current)
        rest = order[1:]
        if rest.size == 0:
            break

        intersection_w = np.maximum(
            np.minimum(x2[current], x2[rest])
            - np.maximum(x1[current], x1[rest]),
            0.0,
        )
        intersection_h = np.maximum(
            np.minimum(y2[current], y2[rest])
            - np.maximum(y1[current], y1[rest]),
            0.0,
        )
        intersection = intersection_w * intersection_h
        union = areas[current] + areas[rest] - intersection
        overlaps = np.divide(
            intersection,
            union,
            out=np.zeros_like(intersection),
            where=union > 0,
        )
        order = rest[overlaps <= iou_threshold]

    return keep
