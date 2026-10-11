from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Final, Literal

import numpy as np
from numpy.typing import NDArray

from models.detection.base_detector import Bbox, TextDetection

type Orientation = Literal["horizontal", "vertical"]
type ReadingDirection = Literal["hor_ltr", "hor_rtl", "ver_ltr", "ver_rtl"]
type _FloatArray = NDArray[np.float64]

_LINE_BAND_RATIO: Final[float] = 0.5
_FLOW_BLOCK_SIZE: Final[int] = 256
_HORIZONTAL: Final[frozenset[ReadingDirection]] = frozenset(
    {"hor_ltr", "hor_rtl"}
)


def _geometry(
    boxes: Sequence[Bbox],
) -> tuple[_FloatArray, _FloatArray, _FloatArray]:
    if not boxes:
        return (
            np.empty((0, 2), dtype=np.float64),
            np.empty(0, dtype=np.float64),
            np.empty(0, dtype=np.float64),
        )

    array = np.asarray(boxes, dtype=np.float64)
    if array.shape != (len(boxes), 4) or not np.isfinite(array).all():
        raise ValueError("Boxes must contain four finite coordinates")
    if np.any(array[:, 2:] <= array[:, :2]):
        raise ValueError("Boxes must have positive width and height")

    centers = array[:, :2] * 0.5 + array[:, 2:] * 0.5
    widths = array[:, 2] - array[:, 0]
    heights = array[:, 3] - array[:, 1]
    return centers, widths, heights


def _flow_votes(
    centers: _FloatArray,
    widths: _FloatArray,
    heights: _FloatArray,
) -> tuple[int, int]:
    """Exact directional-neighbour votes with bounded temporary memory."""
    count = centers.shape[0]
    if count == 0:
        return 0, 0

    right_limit = float(np.median(widths)) * 3.0
    below_limit = float(np.median(heights)) * 3.0
    horizontal = vertical = 0

    for start in range(0, count, _FLOW_BLOCK_SIZE):
        stop = min(start + _FLOW_BLOCK_SIZE, count)
        source = centers[start:stop]
        has_right = np.zeros(stop - start, dtype=np.bool_)
        has_below = np.zeros(stop - start, dtype=np.bool_)

        for other_start in range(0, count, _FLOW_BLOCK_SIZE):
            other = centers[other_start : other_start + _FLOW_BLOCK_SIZE]
            dx = other[None, :, 0] - source[:, None, 0]
            dy = other[None, :, 1] - source[:, None, 1]
            distance = np.hypot(dx, dy)

            has_right |= np.any(
                (dx > 0)
                & (np.abs(dy) < dx * 0.5)
                & (distance < right_limit),
                axis=1,
            )
            has_below |= np.any(
                (dy > 0)
                & (np.abs(dx) < dy * 0.5)
                & (distance < below_limit),
                axis=1,
            )

            if has_right.all() and has_below.all():
                break

        horizontal += int(np.count_nonzero(has_right))
        vertical += int(np.count_nonzero(has_below))

    return horizontal, vertical


def _orientation_votes(boxes: Sequence[Bbox]) -> tuple[int, int]:
    centers, widths, heights = _geometry(boxes)
    if len(boxes) < 2:
        return 1, 0

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
    """Connected components of a one-dimensional proximity graph in O(N log N)."""
    if cross_axis.ndim != 1 or not np.isfinite(cross_axis).all():
        raise ValueError("cross_axis must be a finite one-dimensional array")
    if not np.isfinite(band) or band < 0:
        raise ValueError("band must be finite and non-negative")
    if cross_axis.size == 0:
        return []

    order = np.argsort(cross_axis, kind="stable")
    first = int(order[0])
    groups: list[list[int]] = []
    current = [first]
    previous = first

    for raw_index in order[1:]:
        index = int(raw_index)
        if float(cross_axis[index] - cross_axis[previous]) > band:
            groups.append(sorted(current))
            current = []
        current.append(index)
        previous = index

    groups.append(sorted(current))
    groups.sort(key=lambda group: group[0])
    return groups


def _within_line_key(
    boxes: Sequence[Bbox],
    direction: ReadingDirection,
) -> Callable[[int], tuple[int, int, int]]:
    if direction == "hor_ltr":
        return lambda index: (boxes[index][0], boxes[index][1], index)
    if direction == "hor_rtl":
        return lambda index: (-boxes[index][0], boxes[index][1], index)
    return lambda index: (boxes[index][1], boxes[index][0], index)


def _group_into_lines(
    boxes: Sequence[Bbox],
    direction: ReadingDirection,
) -> list[list[int]]:
    if not boxes:
        return []

    centers, widths, heights = _geometry(boxes)
    horizontal = direction in _HORIZONTAL
    band = _LINE_BAND_RATIO * float(
        np.median(heights if horizontal else widths)
    )
    cross_axis = centers[:, 1] if horizontal else centers[:, 0]
    within_line = _within_line_key(boxes, direction)
    lines = [
        sorted(group, key=within_line)
        for group in _connected_groups(cross_axis, band)
    ]

    if horizontal:
        lines.sort(
            key=lambda line: (
                min(boxes[index][1] for index in line),
                min(line),
            )
        )
    elif direction == "ver_rtl":
        lines.sort(
            key=lambda line: (
                -min(boxes[index][0] for index in line),
                min(line),
            )
        )
    else:
        lines.sort(
            key=lambda line: (
                min(boxes[index][0] for index in line),
                min(line),
            )
        )

    return lines


def reading_order_permutation(boxes: Sequence[Bbox]) -> list[int]:
    if not boxes:
        return []
    if len(boxes) == 1:
        _geometry(boxes)
        return [0]

    direction: ReadingDirection = (
        "hor_ltr" if infer_orientation(boxes) == "horizontal" else "ver_rtl"
    )
    return [
        index
        for line in _group_into_lines(boxes, direction)
        for index in line
    ]


def sort_bboxes_in_reading_order(boxes: Sequence[Bbox]) -> list[Bbox]:
    return [boxes[index] for index in reading_order_permutation(boxes)]


def sort_detections_in_reading_order(
    detections: Sequence[TextDetection],
) -> list[TextDetection]:
    order = reading_order_permutation(
        [detection.bbox for detection in detections]
    )
    return [detections[index] for index in order]
