from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class ForegroundGradient:
    start_rgb: tuple[int, int, int]
    end_rgb: tuple[int, int, int]
    angle_degrees: float


def snap_extreme_neutrals(rgb: tuple[int, int, int]) -> tuple[int, int, int]:
    r, g, b = (int(channel) for channel in rgb)
    luma = (0.299 * r) + (0.587 * g) + (0.114 * b)
    chroma = max(r, g, b) - min(r, g, b)
    if chroma < 40:
        return (0, 0, 0) if luma < 128 else (255, 255, 255)
    return (r, g, b)


def _collect_border_pixels(work: np.ndarray) -> np.ndarray | None:
    height, width = work.shape[:2]
    border_width = max(2, min(height, width) // 8)
    if height <= border_width * 2 or width <= border_width * 2:
        return None

    top = work[:border_width, border_width:-border_width]
    bottom = work[-border_width:, border_width:-border_width]
    left = work[border_width:-border_width, :border_width]
    right = work[border_width:-border_width, -border_width:]

    border_parts: list[np.ndarray] = []
    for part in (top, bottom, left, right):
        if part.size == 0:
            continue
        border_parts.append(part.reshape(-1, 3))

    if not border_parts:
        return None
    return np.concatenate(border_parts, axis=0).astype(np.float64)


def _estimate_foreground_color(
    text_pixels: np.ndarray,
    background_rgb: np.ndarray,
) -> tuple[int, int, int]:
    bg_luma = (
        (0.299 * background_rgb[0])
        + (0.587 * background_rgb[1])
        + (0.114 * background_rgb[2])
    )
    if bg_luma >= 170:
        foreground = np.percentile(text_pixels, 20, axis=0)
    elif bg_luma <= 85:
        foreground = np.percentile(text_pixels, 80, axis=0)
    else:
        foreground = np.median(text_pixels, axis=0)

    rounded = tuple(int(value) for value in np.round(foreground).astype(int).tolist())
    return snap_extreme_neutrals(rounded)


def _extract_text_pixel_payload(
    image: np.ndarray | None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray] | None:
    if image is None:
        return None

    work = np.asarray(image)
    if work.size == 0 or work.ndim != 3 or work.shape[2] < 3:
        return None

    work = work[:, :, :3]
    if work.shape[0] < 6 or work.shape[1] < 6:
        return None

    border_pixels = _collect_border_pixels(work)
    if border_pixels is None:
        return None

    background_rgb = np.median(border_pixels, axis=0)
    flat_pixels = work.reshape(-1, 3).astype(np.float64)
    color_distance = np.sqrt(np.sum((flat_pixels - background_rgb) ** 2, axis=1))
    distance_image = np.clip(np.round(color_distance), 0, 255).astype(np.uint8).reshape(work.shape[:2])
    otsu_threshold, _ = cv2.threshold(
        distance_image,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU,
    )
    distance_threshold = max(float(otsu_threshold), 25.0)

    text_mask = color_distance > distance_threshold
    text_pixel_count = int(np.sum(text_mask))
    if text_pixel_count < 5:
        return None

    text_pixels = flat_pixels[text_mask]
    text_mask_2d = text_mask.reshape(work.shape[:2])
    return text_mask_2d, text_pixels, background_rgb


def _estimate_rgb_distance(
    left: tuple[int, int, int],
    right: tuple[int, int, int],
) -> float:
    left_vector = np.asarray(left, dtype=np.float64)
    right_vector = np.asarray(right, dtype=np.float64)
    return float(np.sqrt(np.sum((left_vector - right_vector) ** 2)))


def extract_foreground_color(image: np.ndarray | None) -> tuple[int, int, int] | None:
    payload = _extract_text_pixel_payload(image)
    if payload is None:
        return None
    _, text_pixels, background_rgb = payload
    return _estimate_foreground_color(text_pixels, background_rgb)


def extract_foreground_gradient(image: np.ndarray | None) -> ForegroundGradient | None:
    payload = _extract_text_pixel_payload(image)
    if payload is None:
        return None

    text_mask, text_pixels, _ = payload
    if text_pixels.shape[0] < 12:
        return None

    coordinates = np.column_stack(np.where(text_mask))
    y_values = coordinates[:, 0].astype(np.float64)
    x_values = coordinates[:, 1].astype(np.float64)

    axes: tuple[tuple[np.ndarray, float], ...] = (
        (x_values, 0.0),
        (y_values, 90.0),
        (x_values + y_values, 45.0),
        (x_values - y_values, 135.0),
    )

    best_gradient: ForegroundGradient | None = None
    best_score = 0.0

    for axis_values, angle_degrees in axes:
        if float(np.ptp(axis_values)) < 4:
            continue

        low_cutoff = float(np.percentile(axis_values, 20))
        high_cutoff = float(np.percentile(axis_values, 80))
        start_pixels = text_pixels[axis_values <= low_cutoff]
        end_pixels = text_pixels[axis_values >= high_cutoff]

        if start_pixels.shape[0] < 6 or end_pixels.shape[0] < 6:
            continue

        start_rgb = snap_extreme_neutrals(
            tuple(int(value) for value in np.round(np.median(start_pixels, axis=0)).astype(int).tolist()),
        )
        end_rgb = snap_extreme_neutrals(
            tuple(int(value) for value in np.round(np.median(end_pixels, axis=0)).astype(int).tolist()),
        )
        score = _estimate_rgb_distance(start_rgb, end_rgb)

        if score < 42.0 or start_rgb == end_rgb:
            continue

        if score > best_score:
            best_score = score
            best_gradient = ForegroundGradient(
                start_rgb=start_rgb,
                end_rgb=end_rgb,
                angle_degrees=angle_degrees,
            )

    return best_gradient
