"""Speech-bubble shape analysis: bright blobs → square/rounded, inner box, fit profile."""

from __future__ import annotations

import math
from typing import Final, Literal, cast

import cv2
import numpy as np
import numpy.typing as npt

from schemas.typography import TypographyShapeDetection
from utils.image_codec import RGBImage

type ShapeKind = Literal["square", "rounded"]
Bbox = tuple[int, int, int, int]
type GrayMask = npt.NDArray[np.uint8]
type Contour = npt.NDArray[np.int32]

PROFILE_SLICES: Final = 10
FLAT_PROFILE: Final[list[float]] = [1.0] * PROFILE_SLICES
ELLIPTICAL_PROFILE: Final[list[float]] = [0.50, 0.71, 0.87, 0.97, 1.0, 1.0, 0.97, 0.87, 0.71, 0.50]

_MIN_SHAPE_AREA: Final = 600
_MIN_SIDE_PX: Final = 20
_BRIGHT_THRESHOLD: Final = 220
_ROUNDED_SCORE_THRESHOLD: Final = 0.63
_CORNER_RADIUS_RATIO: Final[dict[ShapeKind, float]] = {"rounded": 0.18, "square": 0.02}
_MORPH_KERNEL: Final = np.ones((5, 5), np.uint8)
_POLYGON_EPSILON_RATIO: Final = 0.015


def clamp_bbox(bbox: Bbox, *, width: int, height: int) -> Bbox | None:
    x1 = min(max(0, bbox[0]), width)
    y1 = min(max(0, bbox[1]), height)
    x2 = min(max(x1, bbox[2]), width)
    y2 = min(max(y1, bbox[3]), height)
    return None if x2 <= x1 or y2 <= y1 else (x1, y1, x2, y2)


def _binary_mask(rgb: RGBImage) -> GrayMask:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    _, bright = cv2.threshold(gray, _BRIGHT_THRESHOLD, 255, cv2.THRESH_BINARY)
    closed = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, _MORPH_KERNEL, iterations=2)
    return cast(GrayMask, cv2.morphologyEx(closed, cv2.MORPH_OPEN, _MORPH_KERNEL, iterations=1))


def _external_contours(mask: GrayMask) -> list[Contour]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    return [np.asarray(contour, dtype=np.int32) for contour in contours]


def _classify(contour: Contour) -> tuple[ShapeKind, float]:
    area = float(cv2.contourArea(contour))
    perimeter = float(cv2.arcLength(contour, True))
    if area <= 0.0 or perimeter <= 0.0:
        return "square", 0.35
    circularity = (4.0 * math.pi * area) / max(perimeter * perimeter, 1.0)
    _, _, w, h = cv2.boundingRect(contour)
    extent = min(area / max(1, w * h), 1.0)
    solidity = area / max(1.0, float(cv2.contourArea(cv2.convexHull(contour))))
    rounded_score = circularity * 0.5 + solidity * 0.3 + extent * 0.2
    if rounded_score >= _ROUNDED_SCORE_THRESHOLD:
        return "rounded", min(0.99, max(0.45, rounded_score))
    return "square", min(0.95, max(0.35, extent * 0.6 + solidity * 0.4))


def _corner_radius(width: int, height: int, kind: ShapeKind) -> int:
    return round(min(width, height) * _CORNER_RADIUS_RATIO[kind])


def _inner_box(width: int, height: int, kind: ShapeKind) -> list[int]:
    if kind == "rounded":
        h_pad = max(4, min(16, int(width * 0.05)))
        v_pad = max(12, min(60, int(height * 0.20)))
    else:
        h_pad = max(2, min(8, int(width * 0.02)))
        v_pad = max(6, min(30, int(height * 0.15)))
    return [h_pad, v_pad, max(h_pad + 1, width - h_pad), max(v_pad + 1, height - v_pad)]


def _fit_profile(mask: GrayMask) -> list[float]:
    height, width = mask.shape[:2]
    slice_height = max(1, height // PROFILE_SLICES)
    profile: list[float] = []
    for index in range(PROFILE_SLICES):
        y1 = index * slice_height
        y2 = height if index == PROFILE_SLICES - 1 else min(height, y1 + slice_height)
        columns = np.flatnonzero(mask[y1:y2, :].any(axis=0))
        if columns.size == 0:
            profile.append(1.0)
            continue
        usable = int(columns[-1] - columns[0] + 1)
        profile.append(round(usable / max(1, width), 4))
    return profile


def _foreground_rgb(rgb_crop: RGBImage, mask: GrayMask) -> list[int] | None:
    pixels = rgb_crop[mask > 0]
    if pixels.size == 0:
        return None
    return [int(round(float(channel))) for channel in pixels.mean(axis=0)[:3]]


def _polygon(contour: Contour, *, offset_x: int, offset_y: int) -> list[list[int]] | None:
    epsilon = _POLYGON_EPSILON_RATIO * cv2.arcLength(contour, True)
    approx = np.asarray(cv2.approxPolyDP(contour, epsilon, True), dtype=np.int32)
    if len(approx) < 4:
        return None
    return [[int(point[0][0]) + offset_x, int(point[0][1]) + offset_y] for point in approx]


def _detection_from_contour(
    *,
    detection_id: str,
    contour: Contour,
    rgb: RGBImage,
    offset_x: int,
    offset_y: int,
    preferred: ShapeKind | None,
) -> TypographyShapeDetection | None:
    if cv2.contourArea(contour) < _MIN_SHAPE_AREA:
        return None
    x, y, w, h = cv2.boundingRect(contour)
    if w < _MIN_SIDE_PX or h < _MIN_SIDE_PX:
        return None
    kind, confidence = _classify(contour)
    if preferred is not None:
        kind = preferred

    mask: GrayMask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, thickness=cv2.FILLED, offset=(-x, -y))
    return TypographyShapeDetection(
        id=detection_id,
        bbox=[x + offset_x, y + offset_y, x + w + offset_x, y + h + offset_y],
        shape_kind=kind,
        corner_radius=_corner_radius(w, h, kind),
        inner_box=_inner_box(w, h, kind),
        fit_profile=_fit_profile(mask) if kind == "rounded" else FLAT_PROFILE,
        confidence=round(confidence, 4),
        foreground_rgb=_foreground_rgb(rgb[y : y + h, x : x + w], mask),
        mask_polygon=_polygon(contour, offset_x=offset_x, offset_y=offset_y),
    )


def _fallback_detection(bbox: Bbox, kind: ShapeKind) -> TypographyShapeDetection:
    width, height = bbox[2] - bbox[0], bbox[3] - bbox[1]
    return TypographyShapeDetection(
        id="shape-refined-1",
        bbox=list(bbox),
        shape_kind=kind,
        corner_radius=_corner_radius(width, height, kind),
        inner_box=_inner_box(width, height, kind),
        fit_profile=ELLIPTICAL_PROFILE if kind == "rounded" else FLAT_PROFILE,
        confidence=0.35,
        foreground_rgb=None,
        mask_polygon=None,
    )


def detect_shapes(rgb: RGBImage) -> list[TypographyShapeDetection]:
    contours = sorted(_external_contours(_binary_mask(rgb)), key=cv2.contourArea, reverse=True)
    shapes: list[TypographyShapeDetection] = []
    for index, contour in enumerate(contours, start=1):
        detection = _detection_from_contour(
            detection_id=f"shape-{index}",
            contour=contour,
            rgb=rgb,
            offset_x=0,
            offset_y=0,
            preferred=None,
        )
        if detection is not None:
            shapes.append(detection)
    return shapes


def refine_shape(
    rgb: RGBImage, bbox: Bbox, preferred: ShapeKind | None
) -> TypographyShapeDetection | None:
    """``bbox`` must already be clamped to the image; returns ``None`` when the
    region contains a blob too small to describe."""
    x1, y1, x2, y2 = bbox
    crop = rgb[y1:y2, x1:x2]
    contours = _external_contours(_binary_mask(crop))
    if not contours:
        return _fallback_detection(bbox, preferred or "square")
    return _detection_from_contour(
        detection_id="shape-refined-1",
        contour=max(contours, key=cv2.contourArea),
        rgb=crop,
        offset_x=x1,
        offset_y=y1,
        preferred=preferred,
    )
