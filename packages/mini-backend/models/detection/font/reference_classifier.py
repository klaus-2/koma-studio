from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os
from pathlib import Path

import cv2
import numpy as np


_REFERENCE_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
_REFERENCE_SOURCE = "reference_images"
# monorepo: shared resource lives inside the package (production receives it via KOMA_* env)
_DEV_REFERENCE_IMAGES_DIR = Path(__file__).resolve().parents[3] / "resources" / "reference_images"


@dataclass(frozen=True)
class StructuralReferencePrototype:
    canonical_type: str
    file_name: str
    contour: np.ndarray
    aspect_ratio: float
    circularity: float
    solidity: float
    rectangularity: float
    approx_vertices: int
    irregularity: float


@dataclass(frozen=True)
class StructuralReferenceMatch:
    structural_type: str
    confidence: float
    structural_source: str
    matched_reference_image: str


_LOCAL_SEARCH_EXPANSION_FACTORS: tuple[float, ...] = (0.45, 0.9, 1.5)


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def resolve_reference_images_dir() -> Path | None:
    explicit_dir = (os.getenv("KOMA_REFERENCE_IMAGES_DIR") or "").strip()
    if explicit_dir:
        candidate = Path(explicit_dir).expanduser().resolve()
        if candidate.is_dir():
            return candidate

    resources_root = (os.getenv("KOMA_APP_RESOURCES_DIR") or "").strip()
    if resources_root:
        candidate = Path(resources_root).expanduser().resolve() / "reference_images"
        if candidate.is_dir():
            return candidate

    if _DEV_REFERENCE_IMAGES_DIR.is_dir():
        return _DEV_REFERENCE_IMAGES_DIR

    return None


def canonical_type_from_filename(file_name: str) -> str | None:
    normalized = file_name.strip().lower()
    if normalized.startswith("happy speech bubble"):
        return "happy"
    if normalized.startswith("narration box"):
        return "narration"
    if normalized.startswith("scream bubble"):
        return "scream"
    if "speech bubble - nervous shape" in normalized:
        return "trembling"
    if normalized.startswith("thought bubble"):
        return "thought"
    if normalized.startswith("speech bubble"):
        return "speech"
    return None


def _iter_reference_image_paths(reference_dir: Path) -> list[Path]:
    if not reference_dir.is_dir():
        return []
    return sorted(
        [
            path
            for path in reference_dir.iterdir()
            if path.is_file() and path.suffix.lower() in _REFERENCE_IMAGE_EXTENSIONS
        ],
        key=lambda path: path.name.lower(),
    )


def _pick_foreground_mask_from_grayscale(gray: np.ndarray) -> np.ndarray:
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    white_ratio = float((binary > 0).mean())
    if white_ratio >= 0.65:
        binary = cv2.bitwise_not(binary)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)


def _build_reference_mask(image: np.ndarray) -> np.ndarray | None:
    if image.ndim == 3 and image.shape[2] == 4:
        alpha = image[:, :, 3]
        if int(alpha.max()) > 0:
            _, mask = cv2.threshold(alpha, 1, 255, cv2.THRESH_BINARY)
            return mask

    if image.ndim == 2:
        gray = image
    elif image.ndim == 3 and image.shape[2] >= 3:
        gray = cv2.cvtColor(image[:, :, :3], cv2.COLOR_BGR2GRAY)
    else:
        return None

    return _pick_foreground_mask_from_grayscale(gray)


def _largest_component_mask(mask: np.ndarray, *, exclude_border: bool) -> np.ndarray | None:
    if mask.size == 0 or not np.any(mask):
        return None

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), connectivity=8)
    if num_labels <= 1:
        return None

    selected_label: int | None = None
    selected_area = 0
    height, width = mask.shape[:2]

    for label in range(1, num_labels):
        x = int(stats[label, cv2.CC_STAT_LEFT])
        y = int(stats[label, cv2.CC_STAT_TOP])
        w = int(stats[label, cv2.CC_STAT_WIDTH])
        h = int(stats[label, cv2.CC_STAT_HEIGHT])
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area <= selected_area:
            continue
        touches_border = x <= 0 or y <= 0 or (x + w) >= width or (y + h) >= height
        if exclude_border and touches_border:
            continue
        selected_label = label
        selected_area = area

    if selected_label is None:
        return None

    return np.where(labels == selected_label, 255, 0).astype(np.uint8)


def _extract_largest_contour(mask: np.ndarray) -> np.ndarray | None:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contour = max(contours, key=cv2.contourArea)
    if cv2.contourArea(contour) <= 0:
        return None
    return contour


def _extract_contours(mask: np.ndarray) -> list[np.ndarray]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [contour for contour in contours if cv2.contourArea(contour) > 0]


def _extract_candidate_bubble_contour(crop: np.ndarray) -> np.ndarray | None:
    if crop.size == 0:
        return None

    if crop.ndim == 2:
        gray = crop.astype(np.uint8)
    else:
        gray = cv2.cvtColor(crop[:, :, :3], cv2.COLOR_RGB2GRAY)

    bright_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    bright_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bright_mask = cv2.morphologyEx(bright_mask, cv2.MORPH_CLOSE, bright_kernel, iterations=2)
    bright_component = _largest_component_mask(bright_mask, exclude_border=True)
    if bright_component is not None:
        contour = _extract_largest_contour(bright_component)
        if contour is not None:
            return contour

    dark_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    kernel_size = max(5, ((min(gray.shape[:2]) // 12) * 2) + 1)
    dark_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, dark_kernel, iterations=2)
    dark_component = _largest_component_mask(dark_mask, exclude_border=False)
    if dark_component is None:
        return None
    return _extract_largest_contour(dark_component)


def _build_search_masks(gray: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    bright_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    bright_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    bright_mask = cv2.morphologyEx(bright_mask, cv2.MORPH_CLOSE, bright_kernel, iterations=2)

    kernel_size = max(5, ((min(gray.shape[:2]) // 12) * 2) + 1)
    dark_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel_size, kernel_size))
    dark_mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    dark_mask = cv2.morphologyEx(dark_mask, cv2.MORPH_CLOSE, dark_kernel, iterations=2)
    return bright_mask, dark_mask


def _expand_bbox(
    bbox: tuple[int, int, int, int],
    image_shape: tuple[int, ...],
    factor: float,
) -> tuple[int, int, int, int]:
    x1, y1, x2, y2 = [int(value) for value in bbox]
    height, width = image_shape[:2]
    box_width = max(1, x2 - x1)
    box_height = max(1, y2 - y1)
    pad_x = max(4, int(box_width * factor))
    pad_y = max(4, int(box_height * factor))
    return (
        max(0, x1 - pad_x),
        max(0, y1 - pad_y),
        min(width, x2 + pad_x),
        min(height, y2 + pad_y),
    )


def _contains_bbox(
    outer: tuple[int, int, int, int],
    inner: tuple[int, int, int, int],
) -> bool:
    return (
        outer[0] <= inner[0]
        and outer[1] <= inner[1]
        and outer[2] >= inner[2]
        and outer[3] >= inner[3]
    )


def _match_confidence_for_bbox(
    image: np.ndarray,
    bbox: tuple[int, int, int, int],
) -> float:
    match = match_reference_bubble(image, bbox)
    if match is None:
        return 0.0
    return float(match.confidence)


def find_nearby_bubble_bbox(
    image: np.ndarray,
    text_box: tuple[int, int, int, int],
) -> tuple[int, int, int, int] | None:
    text_x1, text_y1, text_x2, text_y2 = [int(value) for value in text_box]
    text_width = max(1, text_x2 - text_x1)
    text_height = max(1, text_y2 - text_y1)
    text_area = float(text_width * text_height)
    min_margin = max(2, int(min(text_width, text_height) * 0.08))

    best_candidate: tuple[float, tuple[int, int, int, int]] | None = None

    for factor in _LOCAL_SEARCH_EXPANSION_FACTORS:
        search_x1, search_y1, search_x2, search_y2 = _expand_bbox(text_box, image.shape, factor)
        search_crop = image[search_y1:search_y2, search_x1:search_x2]
        if search_crop.size == 0:
            continue

        gray = cv2.cvtColor(search_crop[:, :, :3], cv2.COLOR_RGB2GRAY) if search_crop.ndim == 3 else search_crop.astype(np.uint8)
        bright_mask, dark_mask = _build_search_masks(gray)

        contour_groups: list[tuple[str, list[np.ndarray]]] = [
            ("bright", _extract_contours(bright_mask)),
            ("dark", _extract_contours(dark_mask)),
        ]

        search_width = max(1, search_x2 - search_x1)
        search_height = max(1, search_y2 - search_y1)
        search_area = float(search_width * search_height)

        for mask_kind, contours in contour_groups:
            for contour in contours:
                local_x, local_y, local_w, local_h = cv2.boundingRect(contour)
                candidate_bbox = (
                    search_x1 + int(local_x),
                    search_y1 + int(local_y),
                    search_x1 + int(local_x + local_w),
                    search_y1 + int(local_y + local_h),
                )
                if not _contains_bbox(candidate_bbox, text_box):
                    continue

                margins = (
                    text_x1 - candidate_bbox[0],
                    text_y1 - candidate_bbox[1],
                    candidate_bbox[2] - text_x2,
                    candidate_bbox[3] - text_y2,
                )
                if min(margins) < min_margin:
                    continue

                candidate_width = max(1, candidate_bbox[2] - candidate_bbox[0])
                candidate_height = max(1, candidate_bbox[3] - candidate_bbox[1])
                candidate_area = float(candidate_width * candidate_height)
                if candidate_area <= (text_area * 1.35):
                    continue

                contour_area = float(max(cv2.contourArea(contour), 1.0))
                fill_ratio = contour_area / candidate_area
                if fill_ratio < 0.3:
                    continue

                touches_search_border = (
                    local_x <= 1
                    or local_y <= 1
                    or (local_x + local_w) >= (search_width - 1)
                    or (local_y + local_h) >= (search_height - 1)
                )
                match_confidence = _match_confidence_for_bbox(image, candidate_bbox)
                if touches_search_border and match_confidence < 0.3:
                    continue
                border_penalty = 0.45 if touches_search_border else 0.0
                mask_penalty = 0.15 if mask_kind == "dark" else 0.0
                score = (
                    (candidate_area / text_area)
                    - (match_confidence * 3.0)
                    + border_penalty
                    + mask_penalty
                )

                if best_candidate is None or score < best_candidate[0]:
                    best_candidate = (score, candidate_bbox)

        if best_candidate is not None:
            return best_candidate[1]

    return None


def _compute_shape_features(contour: np.ndarray) -> tuple[float, float, float, float, int, float]:
    area = float(max(cv2.contourArea(contour), 1.0))
    perimeter = float(max(cv2.arcLength(contour, True), 1.0))
    x, y, w, h = cv2.boundingRect(contour)
    hull = cv2.convexHull(contour)
    hull_area = float(max(cv2.contourArea(hull), 1.0))
    hull_perimeter = float(max(cv2.arcLength(hull, True), 1.0))
    epsilon = 0.02 * perimeter
    approx = cv2.approxPolyDP(contour, epsilon, True)

    aspect_ratio = float(w) / float(max(h, 1))
    circularity = float((4.0 * np.pi * area) / max(perimeter * perimeter, 1.0))
    solidity = float(area / hull_area)
    rectangularity = float(area / max(float(w * h), 1.0))
    approx_vertices = int(len(approx))
    irregularity = float(perimeter / hull_perimeter)

    return aspect_ratio, circularity, solidity, rectangularity, approx_vertices, irregularity


def _build_prototype(image_path: Path) -> StructuralReferencePrototype | None:
    raw = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)
    if raw is None:
        return None

    mask = _build_reference_mask(raw)
    if mask is None:
        return None

    contour = _extract_largest_contour(mask)
    if contour is None:
        return None

    canonical_type = canonical_type_from_filename(image_path.name)
    if canonical_type is None:
        return None

    aspect_ratio, circularity, solidity, rectangularity, approx_vertices, irregularity = _compute_shape_features(contour)

    return StructuralReferencePrototype(
        canonical_type=canonical_type,
        file_name=image_path.name,
        contour=contour,
        aspect_ratio=aspect_ratio,
        circularity=circularity,
        solidity=solidity,
        rectangularity=rectangularity,
        approx_vertices=approx_vertices,
        irregularity=irregularity,
    )


@lru_cache(maxsize=1)
def load_reference_prototypes() -> tuple[StructuralReferencePrototype, ...]:
    reference_dir = resolve_reference_images_dir()
    if reference_dir is None:
        return ()

    prototypes: list[StructuralReferencePrototype] = []
    for image_path in _iter_reference_image_paths(reference_dir):
        prototype = _build_prototype(image_path)
        if prototype is not None:
            prototypes.append(prototype)

    return tuple(prototypes)


def clear_reference_classifier_cache() -> None:
    load_reference_prototypes.cache_clear()


def build_reference_manifest() -> list[dict[str, str]]:
    return [
        {
            "file_name": prototype.file_name,
            "canonical_type": prototype.canonical_type,
        }
        for prototype in load_reference_prototypes()
    ]


def _score_against_prototype(
    contour: np.ndarray,
    features: tuple[float, float, float, float, int, float],
    prototype: StructuralReferencePrototype,
) -> float:
    shape_distance = float(cv2.matchShapes(contour, prototype.contour, cv2.CONTOURS_MATCH_I1, 0.0))
    aspect_ratio, circularity, solidity, rectangularity, approx_vertices, irregularity = features
    vertex_delta = abs(float(approx_vertices - prototype.approx_vertices)) / max(float(prototype.approx_vertices), 1.0)

    feature_penalty = (
        abs(aspect_ratio - prototype.aspect_ratio) * 0.45
        + abs(circularity - prototype.circularity) * 1.25
        + abs(solidity - prototype.solidity) * 1.0
        + abs(rectangularity - prototype.rectangularity) * 0.9
        + vertex_delta * 0.35
        + abs(irregularity - prototype.irregularity) * 1.15
    )

    type_adjustment = 0.0
    if prototype.canonical_type in {"happy", "thought"} and irregularity < 1.1:
        type_adjustment += (1.1 - irregularity) * 6.0
    if prototype.canonical_type == "speech" and irregularity < 1.1:
        type_adjustment -= min(0.08, (1.1 - irregularity) * 2.0)

    return shape_distance + feature_penalty + type_adjustment


def match_reference_bubble(
    image: np.ndarray,
    bubble_bbox: tuple[int, int, int, int],
) -> StructuralReferenceMatch | None:
    prototypes = load_reference_prototypes()
    if not prototypes:
        return None

    x1, y1, x2, y2 = [int(value) for value in bubble_bbox]
    width = max(1, x2 - x1)
    height = max(1, y2 - y1)
    pad_x = max(2, int(width * 0.08))
    pad_y = max(2, int(height * 0.08))

    crop = image[
        max(0, y1 - pad_y):max(0, y2 + pad_y),
        max(0, x1 - pad_x):max(0, x2 + pad_x),
    ]
    contour = _extract_candidate_bubble_contour(crop)
    if contour is None:
        return None

    features = _compute_shape_features(contour)
    per_type_best: dict[str, tuple[float, StructuralReferencePrototype]] = {}
    for prototype in prototypes:
        score = _score_against_prototype(contour, features, prototype)
        current = per_type_best.get(prototype.canonical_type)
        if current is None or score < current[0]:
            per_type_best[prototype.canonical_type] = (score, prototype)

    if not per_type_best:
        return None

    ranked = sorted(per_type_best.values(), key=lambda item: item[0])
    best_score, best_prototype = ranked[0]
    second_score = ranked[1][0] if len(ranked) > 1 else best_score + 0.35
    margin = max(0.0, second_score - best_score)

    base_confidence = 1.0 / (1.0 + (best_score * 2.5))
    confidence = _clamp(base_confidence + min(0.25, margin * 0.2), 0.0, 1.0)
    if confidence < 0.4:
        return None

    return StructuralReferenceMatch(
        structural_type=best_prototype.canonical_type,
        confidence=round(confidence, 4),
        structural_source=_REFERENCE_SOURCE,
        matched_reference_image=best_prototype.file_name,
    )
