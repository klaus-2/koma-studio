from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Final, Literal

import numpy as np
from numpy.typing import NDArray

from models.detection.base_detector import Bbox, TextDetection

type Orientation = Literal["horizontal", "vertical"]
type ReadingDirection = Literal["hor_ltr", "hor_rtl", "ver_ltr", "ver_rtl"]
type _FloatArray = NDArray[np.float64]

_LINE_BAND_RATIO: Final = 0.5
_HORIZONTAL: Final[frozenset[ReadingDirection]] = frozenset({"hor_ltr", "hor_rtl"})


def _geometry(boxes: Sequence[Bbox]) -> tuple[_FloatArray, _FloatArray, _FloatArray]:
    arr = np.asarray(boxes, dtype=np.float64).reshape(-1, 4)
    centers = (arr[:, :2] + arr[:, 2:]) / 2.0
    widths = np.maximum(1.0, arr[:, 2] - arr[:, 0])
    heights = np.maximum(1.0, arr[:, 3] - arr[:, 1])
    return centers, widths, heights


def _flow_votes(centers: _FloatArray, widths: _FloatArray, heights: _FloatArray) -> tuple[int, int]:
    """Count boxes that have a close neighbour to the right vs. below (vectorised)."""
    dx = centers[None, :, 0] - centers[:, None, 0]
    dy = centers[None, :, 1] - centers[:, None, 1]
    distance = np.hypot(dx, dy)
    to_right = (dx > 0) & (np.abs(dy) < np.abs(dx) * 0.5)
    below = (dy > 0) & (np.abs(dx) < np.abs(dy) * 0.5)
    nearest_right = np.where(to_right, distance, np.inf).min(axis=1)
    nearest_below = np.where(below, distance, np.inf).min(axis=1)
    horizontal = int(np.count_nonzero(nearest_right < float(np.median(widths)) * 3.0))
    vertical = int(np.count_nonzero(nearest_below < float(np.median(heights)) * 3.0))
    return horizontal, vertical


def _orientation_votes(boxes: Sequence[Bbox]) -> tuple[int, int]:
    if len(boxes) < 2:
        return 1, 0

    centers, widths, heights = _geometry(boxes)
    xs, ys = centers[:, 0], centers[:, 1]
    horizontal = vertical = 0

    range_x = float(np.ptp(xs)) + 1e-6
    range_y = float(np.ptp(ys)) + 1e-6
    if range_y / range_x > 1.5:
        vertical += 1
    else:
        horizontal += 1

    if float(np.median(heights / widths)) > 1.2:
        vertical += 1
    else:
        horizontal += 1

    if len(boxes) >= 3:
        # Variance is permutation-invariant, so sorting (as the previous
        # implementation did) is unnecessary here.
        y_jitter = float(np.var(ys)) / range_y
        x_jitter = float(np.var(xs)) / range_x
        if y_jitter < x_jitter * 0.6:
            horizontal += 1
        elif x_jitter < y_jitter * 0.6:
            vertical += 1

    horizontal_flow, vertical_flow = _flow_votes(centers, widths, heights)
    if horizontal_flow > vertical_flow * 1.2:
        horizontal += 1
    elif vertical_flow > horizontal_flow * 1.2:
        vertical += 1

    return horizontal, vertical


def infer_orientation(boxes: Sequence[Bbox]) -> Orientation:
    horizontal, vertical = _orientation_votes(boxes)
    return "vertical" if vertical > horizontal else "horizontal"


def _connected_groups(cross_axis: _FloatArray, band: float) -> list[list[int]]:
    """Union-find over pairs whose cross-axis centres lie within ``band``."""
    count = cross_axis.shape[0]
    parent = list(range(count))

    def find(index: int) -> int:
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    close = np.abs(cross_axis[:, None] - cross_axis[None, :]) <= band
    for left, right in np.argwhere(np.triu(close, k=1)):
        left_root, right_root = find(int(left)), find(int(right))
        if left_root != right_root:
            parent[right_root] = left_root

    groups: dict[int, list[int]] = {}
    for index in range(count):
        groups.setdefault(find(index), []).append(index)
    return list(groups.values())


def _within_line_key(
    boxes: Sequence[Bbox], direction: ReadingDirection
) -> Callable[[int], tuple[int, int, int]]:
    if direction == "hor_ltr":
        return lambda i: (boxes[i][0], boxes[i][1], i)
    if direction == "hor_rtl":
        return lambda i: (-boxes[i][0], boxes[i][1], i)
    return lambda i: (boxes[i][1], boxes[i][0], i)


def _group_into_lines(boxes: Sequence[Bbox], direction: ReadingDirection) -> list[list[int]]:
    centers, widths, heights = _geometry(boxes)
    is_horizontal = direction in _HORIZONTAL
    band = _LINE_BAND_RATIO * float(np.median(heights if is_horizontal else widths))
    cross_axis = centers[:, 1] if is_horizontal else centers[:, 0]

    key = _within_line_key(boxes, direction)
    lines = [sorted(group, key=key) for group in _connected_groups(cross_axis, band)]

    if is_horizontal:
        lines.sort(key=lambda line: min(boxes[i][1] for i in line))
    else:
        lines.sort(key=lambda line: min(boxes[i][0] for i in line), reverse=direction == "ver_rtl")
    return lines


def reading_order_permutation(boxes: Sequence[Bbox]) -> list[int]:
    """Indices of ``boxes`` in reading order. Always a permutation of ``range(len(boxes))``."""
    if len(boxes) <= 1:
        return list(range(len(boxes)))
    direction: ReadingDirection = "hor_ltr" if infer_orientation(boxes) == "horizontal" else "ver_rtl"
    return [index for line in _group_into_lines(boxes, direction) for index in line]


def sort_bboxes_in_reading_order(boxes: Sequence[Bbox]) -> list[Bbox]:
    return [boxes[i] for i in reading_order_permutation(boxes)]


def sort_detections_in_reading_order(detections: Sequence[TextDetection]) -> list[TextDetection]:
    order = reading_order_permutation([detection.bbox for detection in detections])
    return [detections[i] for i in order]
