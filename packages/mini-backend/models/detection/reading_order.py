from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from models.detection.base_detector import TextDetection


_Bbox = tuple[int, int, int, int]


@dataclass(frozen=True)
class _IndexedBox:
    index: int
    bbox: _Bbox


def _center(bbox: _Bbox) -> tuple[float, float]:
    x1, y1, x2, y2 = bbox
    return ((x1 + x2) / 2.0, (y1 + y2) / 2.0)


def _orientation_votes(boxes: list[_Bbox]) -> tuple[int, int]:
    if len(boxes) < 2:
        return 1, 0

    centers = np.array([_center(box) for box in boxes], dtype=float)
    xs = centers[:, 0]
    ys = centers[:, 1]
    widths = np.array([max(1, box[2] - box[0]) for box in boxes], dtype=float)
    heights = np.array([max(1, box[3] - box[1]) for box in boxes], dtype=float)

    horizontal_votes = 0
    vertical_votes = 0

    range_x = float(xs.max() - xs.min()) + 1e-6
    range_y = float(ys.max() - ys.min()) + 1e-6
    spread_ratio = range_y / range_x
    if spread_ratio > 1.5:
        vertical_votes += 1
    else:
        horizontal_votes += 1

    median_aspect = float(np.median(heights / widths))
    if median_aspect > 1.2:
        vertical_votes += 1
    else:
        horizontal_votes += 1

    if len(boxes) >= 3:
        sorted_by_x = centers[np.argsort(xs)]
        sorted_by_y = centers[np.argsort(ys)]
        y_jitter = float(np.var(sorted_by_x[:, 1])) / range_y
        x_jitter = float(np.var(sorted_by_y[:, 0])) / range_x
        if y_jitter < x_jitter * 0.6:
            horizontal_votes += 1
        elif x_jitter < y_jitter * 0.6:
            vertical_votes += 1

    horizontal_flow = 0
    vertical_flow = 0
    median_width = float(np.median(widths))
    median_height = float(np.median(heights))
    for idx, current in enumerate(centers):
        right_candidates: list[float] = []
        down_candidates: list[float] = []
        for other_idx, other in enumerate(centers):
            if idx == other_idx:
                continue
            dx = float(other[0] - current[0])
            dy = float(other[1] - current[1])
            if dx > 0 and abs(dy) < abs(dx) * 0.5:
                right_candidates.append(float(np.hypot(dx, dy)))
            if dy > 0 and abs(dx) < abs(dy) * 0.5:
                down_candidates.append(float(np.hypot(dx, dy)))
        if right_candidates and min(right_candidates) < median_width * 3.0:
            horizontal_flow += 1
        if down_candidates and min(down_candidates) < median_height * 3.0:
            vertical_flow += 1
    if horizontal_flow > vertical_flow * 1.2:
        horizontal_votes += 1
    elif vertical_flow > horizontal_flow * 1.2:
        vertical_votes += 1

    return horizontal_votes, vertical_votes


def _infer_orientation(boxes: list[_Bbox]) -> str:
    horizontal_votes, vertical_votes = _orientation_votes(boxes)
    return "vertical" if vertical_votes > horizontal_votes else "horizontal"


def _group_boxes_into_lines(
    items: list[_IndexedBox], direction: str, band_ratio: float = 0.5
) -> list[list[_IndexedBox]]:
    if not items:
        return []

    widths = [max(1, item.bbox[2] - item.bbox[0]) for item in items]
    heights = [max(1, item.bbox[3] - item.bbox[1]) for item in items]
    median_width = float(np.median(widths)) if widths else 1.0
    median_height = float(np.median(heights)) if heights else 1.0
    adaptive_band = band_ratio * (median_height if "hor" in direction else median_width)

    parent = list(range(len(items)))

    def find(index: int) -> int:
        if parent[index] == index:
            return index
        parent[index] = find(parent[index])
        return parent[index]

    def union(left: int, right: int) -> None:
        left_root = find(left)
        right_root = find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for left in range(len(items)):
        left_center = _center(items[left].bbox)
        for right in range(left + 1, len(items)):
            right_center = _center(items[right].bbox)
            delta = (
                abs(left_center[1] - right_center[1])
                if "hor" in direction
                else abs(left_center[0] - right_center[0])
            )
            if delta <= adaptive_band:
                union(left, right)

    grouped: dict[int, list[_IndexedBox]] = {}
    for idx, item in enumerate(items):
        grouped.setdefault(find(idx), []).append(item)

    lines = list(grouped.values())

    for idx, line in enumerate(lines):
        if direction == "hor_ltr":
            lines[idx] = sorted(
                line, key=lambda item: (item.bbox[0], item.bbox[1], item.index)
            )
        elif direction == "hor_rtl":
            lines[idx] = sorted(
                line, key=lambda item: (-item.bbox[0], item.bbox[1], item.index)
            )
        else:
            lines[idx] = sorted(
                line, key=lambda item: (item.bbox[1], item.bbox[0], item.index)
            )

    if direction in {"hor_ltr", "hor_rtl"}:
        lines.sort(key=lambda line: min(item.bbox[1] for item in line))
    elif direction == "ver_ltr":
        lines.sort(key=lambda line: min(item.bbox[0] for item in line))
    else:
        lines.sort(key=lambda line: min(item.bbox[0] for item in line), reverse=True)

    return lines


def sort_bboxes_in_reading_order(boxes: list[_Bbox]) -> list[_Bbox]:
    if len(boxes) <= 1:
        return boxes

    orientation = _infer_orientation(boxes)
    direction = "hor_ltr" if orientation == "horizontal" else "ver_rtl"
    indexed_items = [
        _IndexedBox(index=index, bbox=bbox) for index, bbox in enumerate(boxes)
    ]
    lines = _group_boxes_into_lines(indexed_items, direction=direction)
    return [item.bbox for line in lines for item in line]


def sort_detections_in_reading_order(
    detections: list[TextDetection],
) -> list[TextDetection]:
    if len(detections) <= 1:
        return detections

    queue_by_bbox: dict[_Bbox, list[TextDetection]] = {}
    for detection in detections:
        queue_by_bbox.setdefault(detection.bbox, []).append(detection)

    sorted_boxes = sort_bboxes_in_reading_order(
        [detection.bbox for detection in detections]
    )
    ordered: list[TextDetection] = []
    for bbox in sorted_boxes:
        if queue_by_bbox[bbox]:
            ordered.append(queue_by_bbox[bbox].pop(0))

    if len(ordered) != len(detections):
        return detections
    return ordered
