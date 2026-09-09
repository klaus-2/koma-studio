from __future__ import annotations

import json
from io import BytesIO

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from schemas.typography import (
    TypographyShapeDetection,
    TypographyShapeDetectionResponse,
)


router = APIRouter(tags=["typography"])

_MIN_SHAPE_AREA = 600
_PROFILE_SLICES = 10
_ELLIPTICAL_PROFILE = [0.50, 0.71, 0.87, 0.97, 1.0, 1.0, 0.97, 0.87, 0.71, 0.50]


def _load_rgb_image(payload: bytes) -> Image.Image:
    try:
        return Image.open(BytesIO(payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid image file"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Failed to read the uploaded file"
        ) from exc


def _prepare_binary_mask(image: Image.Image) -> np.ndarray:
    rgb = np.array(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    _, bright = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)
    kernel = np.ones((5, 5), np.uint8)
    closed = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, kernel, iterations=2)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)
    return opened


def _classify_shape(contour: np.ndarray) -> tuple[str, float]:
    area = float(cv2.contourArea(contour))
    perimeter = float(cv2.arcLength(contour, True))
    if area <= 0 or perimeter <= 0:
        return "square", 0.35
    circularity = float((4 * np.pi * area) / max(perimeter * perimeter, 1.0))
    x, y, w, h = cv2.boundingRect(contour)
    rect_area = float(max(1, w * h))
    extent = area / rect_area
    hull = cv2.convexHull(contour)
    hull_area = float(max(1.0, cv2.contourArea(hull)))
    solidity = area / hull_area
    rounded_score = (circularity * 0.5) + (solidity * 0.3) + (min(extent, 1.0) * 0.2)
    if rounded_score >= 0.63:
        return "rounded", float(min(0.99, max(0.45, rounded_score)))
    square_score = (min(extent, 1.0) * 0.6) + (solidity * 0.4)
    return "square", float(min(0.95, max(0.35, square_score)))


def _compute_inner_box(width: int, height: int, shape_kind: str) -> list[int]:
    if shape_kind == "rounded":
        h_padding = max(4, min(16, int(width * 0.05)))
        v_padding = max(12, min(60, int(height * 0.20)))
    else:
        h_padding = max(2, min(8, int(width * 0.02)))
        v_padding = max(6, min(30, int(height * 0.15)))
    return [
        h_padding,
        v_padding,
        max(h_padding + 1, width - h_padding),
        max(v_padding + 1, height - v_padding),
    ]


def _compute_fit_profile(mask: np.ndarray) -> list[float]:
    height, width = mask.shape[:2]
    if height <= 0 or width <= 0:
        return [1.0] * _PROFILE_SLICES
    profile: list[float] = []
    slice_height = max(1, height // _PROFILE_SLICES)
    for index in range(_PROFILE_SLICES):
        y1 = index * slice_height
        y2 = (
            height
            if index == _PROFILE_SLICES - 1
            else min(height, (index + 1) * slice_height)
        )
        stripe = mask[y1:y2, :]
        coords = np.where(stripe > 0)
        if coords[1].size == 0:
            profile.append(1.0)
            continue
        min_x = int(coords[1].min())
        max_x = int(coords[1].max())
        usable_width = max(1, max_x - min_x + 1)
        profile.append(round(float(usable_width / max(1, width)), 4))
    return profile


def _extract_foreground_rgb(
    rgb_array: np.ndarray, mask: np.ndarray
) -> list[int] | None:
    try:
        ys, xs = np.where(mask > 0)
        if xs.size == 0:
            return None
        pixels = rgb_array[ys, xs]
        mean = pixels.mean(axis=0)
        return [int(round(channel)) for channel in mean[:3]]
    except Exception:
        return None


def _contour_to_polygon(
    contour: np.ndarray, offset_x: int = 0, offset_y: int = 0
) -> list[list[int]] | None:
    epsilon = 0.015 * cv2.arcLength(contour, True)
    approx = cv2.approxPolyDP(contour, epsilon, True)
    if approx is None or len(approx) < 4:
        return None
    return [
        [int(point[0][0] + offset_x), int(point[0][1] + offset_y)] for point in approx
    ]


def _build_detection(
    *,
    detection_id: str,
    contour: np.ndarray,
    rgb_array: np.ndarray,
    offset_x: int = 0,
    offset_y: int = 0,
    preferred_shape_kind: str | None = None,
) -> TypographyShapeDetection | None:
    area = cv2.contourArea(contour)
    if area < _MIN_SHAPE_AREA:
        return None
    x, y, w, h = cv2.boundingRect(contour)
    if w < 20 or h < 20:
        return None
    shape_kind, confidence = _classify_shape(contour)
    if preferred_shape_kind in {"square", "rounded"}:
        shape_kind = preferred_shape_kind
    mask = np.zeros((h, w), dtype=np.uint8)
    shifted = contour.copy()
    shifted[:, 0, 0] -= x
    shifted[:, 0, 1] -= y
    cv2.drawContours(mask, [shifted], -1, 255, -1)
    corner_radius = int(round(min(w, h) * (0.18 if shape_kind == "rounded" else 0.02)))
    inner_box = _compute_inner_box(w, h, shape_kind)
    fit_profile = _compute_fit_profile(
        mask if shape_kind == "rounded" else np.full((h, w), 255, dtype=np.uint8)
    )
    polygon = _contour_to_polygon(contour, offset_x=offset_x, offset_y=offset_y)
    foreground = _extract_foreground_rgb(rgb_array[y : y + h, x : x + w], mask)
    return TypographyShapeDetection(
        id=detection_id,
        bbox=[x + offset_x, y + offset_y, x + w + offset_x, y + h + offset_y],
        shape_kind=shape_kind,
        corner_radius=corner_radius,
        inner_box=inner_box,
        fit_profile=fit_profile,
        confidence=round(confidence, 4),
        foreground_rgb=foreground,
        mask_polygon=polygon,
    )


@router.post(
    "/typography/shapes/detect", response_model=TypographyShapeDetectionResponse
)
async def detect_typography_shapes(
    file: UploadFile = File(...),
):
    payload = await file.read()
    image = _load_rgb_image(payload)
    rgb = np.array(image)
    binary = _prepare_binary_mask(image)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    shapes: list[TypographyShapeDetection] = []
    for index, contour in enumerate(
        sorted(contours, key=cv2.contourArea, reverse=True), start=1
    ):
        detection = _build_detection(
            detection_id=f"shape-{index}",
            contour=contour,
            rgb_array=rgb,
        )
        if detection is not None:
            shapes.append(detection)
    return TypographyShapeDetectionResponse(
        image_width=image.width,
        image_height=image.height,
        shapes=shapes,
    )


@router.post(
    "/typography/shapes/refine", response_model=TypographyShapeDetectionResponse
)
async def refine_typography_shape(
    file: UploadFile = File(...),
    bbox: str = Form(...),
    current_shape_kind: str | None = Form(default=None),
):
    payload = await file.read()
    image = _load_rgb_image(payload)
    rgb = np.array(image)
    try:
        parsed_bbox = json.loads(bbox)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Invalid bbox") from exc

    preferred_shape_kind = (
        current_shape_kind if current_shape_kind in {"square", "rounded"} else None
    )
    if not isinstance(parsed_bbox, list) or len(parsed_bbox) != 4:
        raise HTTPException(status_code=422, detail="Invalid bbox")

    x1, y1, x2, y2 = [int(value) for value in parsed_bbox]
    x1 = max(0, min(image.width, x1))
    y1 = max(0, min(image.height, y1))
    x2 = max(x1 + 1, min(image.width, x2))
    y2 = max(y1 + 1, min(image.height, y2))
    cropped = image.crop((x1, y1, x2, y2))
    binary = _prepare_binary_mask(cropped)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        width = x2 - x1
        height = y2 - y1
        fallback = TypographyShapeDetection(
            id="shape-refined-1",
            bbox=[x1, y1, x2, y2],
            shape_kind=preferred_shape_kind or "square",
            corner_radius=int(
                round(
                    min(width, height)
                    * (0.18 if preferred_shape_kind == "rounded" else 0.02)
                )
            ),
            inner_box=_compute_inner_box(
                width, height, preferred_shape_kind or "square"
            ),
            fit_profile=_ELLIPTICAL_PROFILE
            if preferred_shape_kind == "rounded"
            else [1.0] * _PROFILE_SLICES,
            confidence=0.35,
            foreground_rgb=None,
            mask_polygon=None,
        )
        return TypographyShapeDetectionResponse(
            image_width=image.width,
            image_height=image.height,
            shapes=[fallback],
        )

    contour = max(contours, key=cv2.contourArea)
    detection = _build_detection(
        detection_id="shape-refined-1",
        contour=contour,
        rgb_array=rgb[y1:y2, x1:x2],
        offset_x=x1,
        offset_y=y1,
        preferred_shape_kind=preferred_shape_kind,
    )
    if detection is None:
        raise HTTPException(
            status_code=422, detail="Could not refine the provided shape"
        )

    return TypographyShapeDetectionResponse(
        image_width=image.width,
        image_height=image.height,
        shapes=[detection],
    )
