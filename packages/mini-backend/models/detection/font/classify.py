from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from models.detection.font.foreground_color import extract_foreground_color
from models.detection.font.reference_classifier import (
    StructuralReferenceMatch,
    find_nearby_bubble_bbox,
    match_reference_bubble,
)


@dataclass(frozen=True)
class ClassifiedTextRegion:
    bbox: tuple[int, int, int, int]
    label: str
    bubble_bbox: tuple[int, int, int, int] | None = None
    foreground_rgb: tuple[int, int, int] | None = None
    structural_type: str | None = None
    structural_confidence: float | None = None
    structural_source: str | None = None
    matched_reference_image: str | None = None


_STRUCTURAL_LABEL_MAP: dict[str, str] = {
    "narration": "text_narration",
    "scream": "text_sfx",
    "speech": "text_bubble",
    "thought": "text_bubble",
    "happy": "text_bubble",
    "trembling": "text_bubble",
}


def _calculate_iou(
    left: tuple[int, int, int, int],
    right: tuple[int, int, int, int],
) -> float:
    x1 = max(left[0], right[0])
    y1 = max(left[1], right[1])
    x2 = min(left[2], right[2])
    y2 = min(left[3], right[3])

    intersection_area = max(0, x2 - x1) * max(0, y2 - y1)
    left_area = max(0, left[2] - left[0]) * max(0, left[3] - left[1])
    right_area = max(0, right[2] - right[0]) * max(0, right[3] - right[1])
    union_area = left_area + right_area - intersection_area
    if union_area <= 0:
        return 0.0
    return intersection_area / union_area


def _fits_inside(
    outer: tuple[int, int, int, int],
    inner: tuple[int, int, int, int],
) -> bool:
    return (
        inner[0] >= outer[0]
        and inner[1] >= outer[1]
        and inner[2] <= outer[2]
        and inner[3] <= outer[3]
    )


def _best_matching_bubble(
    text_box: tuple[int, int, int, int],
    bubble_boxes: np.ndarray,
) -> tuple[int, int, int, int] | None:
    best_match: tuple[int, int, int, int] | None = None
    best_score = 0.0

    for raw_bubble in np.asarray(bubble_boxes):
        bubble = tuple(int(value) for value in raw_bubble[:4])
        if _fits_inside(bubble, text_box):
            return bubble

        overlap_score = _calculate_iou(text_box, bubble)
        if overlap_score >= 0.2 and overlap_score > best_score:
            best_score = overlap_score
            best_match = bubble

    return best_match


def _crop_is_inside_black_bubble(crop: np.ndarray) -> bool:
    if crop.size == 0:
        return False

    if crop.ndim == 3:
        grayscale = crop.mean(axis=2)
    else:
        grayscale = crop.astype(np.float32)

    dark_ratio = float((grayscale < 100).mean())
    bright_ratio = float((grayscale > 200).mean())
    mean_intensity = float(grayscale.mean())
    return dark_ratio >= 0.45 and bright_ratio >= 0.05 and mean_intensity < 140


def classify_text_regions(
    image: np.ndarray,
    text_boxes: np.ndarray,
    bubble_boxes: np.ndarray | None = None,
    bubble_matcher: Callable[[np.ndarray, tuple[int, int, int, int]], StructuralReferenceMatch | None] | None = None,
) -> list[ClassifiedTextRegion]:
    bubble_candidates = (
        np.asarray(bubble_boxes, dtype=int)
        if bubble_boxes is not None and len(bubble_boxes) > 0
        else np.empty((0, 4), dtype=int)
    )
    regions: list[ClassifiedTextRegion] = []
    resolve_bubble_match = bubble_matcher or match_reference_bubble

    for raw_text_box in np.asarray(text_boxes):
        text_box = tuple(int(value) for value in raw_text_box[:4])
        x1, y1, x2, y2 = text_box
        bubble_bbox = _best_matching_bubble(text_box, bubble_candidates)
        if bubble_bbox is None:
            bubble_bbox = find_nearby_bubble_bbox(image, text_box)
        label = "text_bubble" if bubble_bbox is not None else "text_free"
        foreground_rgb: tuple[int, int, int] | None = None
        structural_type: str | None = None
        structural_confidence: float | None = None
        structural_source: str | None = None
        matched_reference_image: str | None = None

        if bubble_bbox is not None:
            reference_match = resolve_bubble_match(image, bubble_bbox)
            if reference_match is not None:
                structural_type = reference_match.structural_type
                structural_confidence = reference_match.confidence
                structural_source = reference_match.structural_source
                matched_reference_image = reference_match.matched_reference_image
                label = _STRUCTURAL_LABEL_MAP.get(structural_type, label)
            crop = image[max(0, y1):max(0, y2), max(0, x1):max(0, x2)]
            if _crop_is_inside_black_bubble(crop):
                label = "text_inside_black_bubble"
            foreground_rgb = extract_foreground_color(crop)
        else:
            structural_type = "text_outside_bubble"
            structural_confidence = 1.0
            structural_source = "heuristic"

        regions.append(
            ClassifiedTextRegion(
                bbox=text_box,
                label=label,
                bubble_bbox=bubble_bbox,
                foreground_rgb=foreground_rgb,
                structural_type=structural_type,
                structural_confidence=structural_confidence,
                structural_source=structural_source,
                matched_reference_image=matched_reference_image,
            ),
        )

    return regions
