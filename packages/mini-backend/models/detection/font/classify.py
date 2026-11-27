from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass

import numpy as np

from models.detection.bubble.contour_extractor import (
    extract_bubble_mask_in_crop,
    find_enclosed_bubble_around_text,
)
from models.detection.bubble.shape_classifier import classify_bubble_shape
from models.detection.font.foreground_color import extract_foreground_color
from models.detection.font.reference_classifier import (
    StructuralReferenceMatch,
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
    bubble_mask: np.ndarray | None = None


_STRUCTURAL_LABEL_MAP: dict[str, str] = {
    "narration": "text_narration",
    "system_box": "text_narration",
    "scream": "text_sfx",
    "speech": "text_bubble",
    "thought": "text_bubble",
    "happy": "text_bubble",
    "trembling": "text_bubble",
    "whisper": "text_bubble",
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


def _match_bubble_instance(
    text_box: tuple[int, int, int, int],
    bubble_boxes: np.ndarray,
    bubble_masks: Sequence[np.ndarray] | None = None,
) -> tuple[tuple[int, int, int, int] | None, np.ndarray | None]:
    best_idx: int | None = None
    best_score = 0.0

    for idx, raw_bubble in enumerate(np.asarray(bubble_boxes)):
        bubble = tuple(int(value) for value in raw_bubble[:4])
        if _fits_inside(bubble, text_box):
            mask = (
                bubble_masks[idx]
                if bubble_masks is not None and idx < len(bubble_masks)
                else None
            )
            return bubble, mask

        overlap_score = _calculate_iou(text_box, bubble)
        if overlap_score >= 0.2 and overlap_score > best_score:
            best_score = overlap_score
            best_idx = idx

    if best_idx is None:
        return None, None
    bubble = tuple(int(value) for value in np.asarray(bubble_boxes)[best_idx][:4])
    mask = (
        bubble_masks[best_idx]
        if bubble_masks is not None and best_idx < len(bubble_masks)
        else None
    )
    return bubble, mask


def _best_matching_bubble(
    text_box: tuple[int, int, int, int],
    bubble_boxes: np.ndarray,
) -> tuple[int, int, int, int] | None:
    bubble, _ = _match_bubble_instance(text_box, bubble_boxes)
    return bubble


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


def _merge_optional_yolo_bubbles(
    image: np.ndarray,
    existing_boxes: np.ndarray,
) -> tuple[np.ndarray, list[np.ndarray | None]]:
    """Run installed ``yolo_bubble`` segmenter when available, preserving explicit boxes."""
    masks: list[np.ndarray | None] = [None] * len(existing_boxes)
    try:
        from models.detection.factory import get_optional_bubble_segmenter

        segmenter = get_optional_bubble_segmenter()
        if segmenter is None:
            return existing_boxes, masks
        instances = segmenter.segment(image)
    except Exception:  # noqa: BLE001
        return existing_boxes, masks

    if not instances:
        return existing_boxes, masks

    merged_boxes: list[list[int]] = [list(inst.bbox) for inst in instances]
    merged_masks: list[np.ndarray | None] = [inst.mask_crop for inst in instances]
    for raw_box in existing_boxes:
        box = (int(raw_box[0]), int(raw_box[1]), int(raw_box[2]), int(raw_box[3]))
        if any(_calculate_iou(box, inst.bbox) >= 0.35 for inst in instances):
            continue
        merged_boxes.append(list(box))
        merged_masks.append(None)

    return np.asarray(merged_boxes, dtype=int), merged_masks


def classify_text_regions(
    image: np.ndarray,
    text_boxes: np.ndarray,
    bubble_boxes: np.ndarray | None = None,
    bubble_matcher: Callable[[np.ndarray, tuple[int, int, int, int]], StructuralReferenceMatch | None] | None = None,
    *,
    text_is_free: Sequence[bool] | None = None,
    bubble_masks: Sequence[np.ndarray] | None = None,
    use_optional_segmenter: bool = False,
) -> list[ClassifiedTextRegion]:
    bubble_candidates = (
        np.asarray(bubble_boxes, dtype=int)
        if bubble_boxes is not None and len(bubble_boxes) > 0
        else np.empty((0, 4), dtype=int)
    )
    resolved_masks: Sequence[np.ndarray | None] | None = bubble_masks
    if use_optional_segmenter and bubble_masks is None and bubble_matcher is None and image.size > 0:
        bubble_candidates, resolved_masks = _merge_optional_yolo_bubbles(image, bubble_candidates)

    regions: list[ClassifiedTextRegion] = []
    img_h, img_w = image.shape[:2]

    for idx, raw_text_box in enumerate(np.asarray(text_boxes)):
        text_box = tuple(int(value) for value in raw_text_box[:4])
        x1, y1, x2, y2 = text_box
        is_explicit_free = bool(text_is_free is not None and idx < len(text_is_free) and text_is_free[idx])

        bubble_bbox, matched_mask = _match_bubble_instance(
            text_box, bubble_candidates, resolved_masks
        )
        if is_explicit_free and bubble_bbox is not None and not _fits_inside(bubble_bbox, text_box):
            bubble_bbox = None
            matched_mask = None

        if bubble_bbox is None and not is_explicit_free:
            enclosed = find_enclosed_bubble_around_text(image, text_box)
            if enclosed is not None:
                bubble_bbox, matched_mask = enclosed

        label = "text_bubble" if bubble_bbox is not None else "text_free"
        foreground_rgb: tuple[int, int, int] | None = None
        structural_type: str | None = None
        structural_confidence: float | None = None
        structural_source: str | None = None
        matched_reference_image: str | None = None

        if bubble_bbox is not None:
            bx1 = max(0, min(img_w, bubble_bbox[0]))
            by1 = max(0, min(img_h, bubble_bbox[1]))
            bx2 = max(bx1, min(img_w, bubble_bbox[2]))
            by2 = max(by1, min(img_h, bubble_bbox[3]))
            bubble_crop = image[by1:by2, bx1:bx2]

            if bubble_matcher is not None:
                reference_match = bubble_matcher(image, bubble_bbox)
                if reference_match is not None:
                    structural_type = reference_match.structural_type
                    structural_confidence = reference_match.confidence
                    structural_source = reference_match.structural_source
                    matched_reference_image = reference_match.matched_reference_image
                    label = _STRUCTURAL_LABEL_MAP.get(structural_type, label)
            else:
                local_mask = matched_mask
                from_yolo = local_mask is not None and resolved_masks is not None
                if local_mask is None and bubble_crop.size > 0:
                    rel_seed = (
                        max(0, x1 - bx1),
                        max(0, y1 - by1),
                        max(0, x2 - bx1),
                        max(0, y2 - by1),
                    )
                    local_mask = extract_bubble_mask_in_crop(
                        bubble_crop, seed_boxes=(rel_seed,), allow_full_crop=True
                    )
                    matched_mask = local_mask

                if local_mask is not None and local_mask.size > 0:
                    bw_box = max(1, bx2 - bx1)
                    bh_box = max(1, by2 - by1)
                    pad_x = max(24, int(round(0.28 * bw_box)))
                    pad_top = max(16, int(round(0.20 * bh_box)))
                    pad_bottom = max(36, int(round(0.48 * bh_box)))
                    cx1 = max(0, bx1 - pad_x)
                    cy1 = max(0, by1 - pad_top)
                    cx2 = min(img_w, bx2 + pad_x)
                    cy2 = min(img_h, by2 + pad_bottom)
                    context_rgb = image[cy1:cy2, cx1:cx2]
                    shape_cls = classify_bubble_shape(
                        local_mask,
                        crop_rgb=bubble_crop,
                        context_rgb=context_rgb,
                        context_offset=(bx1 - cx1, by1 - cy1),
                    )
                    structural_type = shape_cls.shape
                    structural_confidence = round(shape_cls.confidence, 4)
                    structural_source = "yolo_bubble_geom" if from_yolo else shape_cls.source
                    label = _STRUCTURAL_LABEL_MAP.get(structural_type, label)

                if structural_type is None:
                    fallback_match = match_reference_bubble(image, bubble_bbox)
                    if fallback_match is not None:
                        structural_type = fallback_match.structural_type
                        structural_confidence = fallback_match.confidence
                        structural_source = fallback_match.structural_source
                        matched_reference_image = fallback_match.matched_reference_image
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
                bubble_mask=matched_mask,
            ),
        )

    return regions
