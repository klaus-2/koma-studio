from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass(frozen=True)
class HeuristicInpaintPreparation:
    image_rgb: np.ndarray
    remaining_mask: np.ndarray
    filled_components: int
    total_components: int

    @property
    def needs_model_inpaint(self) -> bool:
        return bool(np.any(self.remaining_mask))

    @property
    def method_label(self) -> str:
        if self.total_components == 0:
            return "no-op"
        if self.filled_components == self.total_components:
            return "solid_fill"
        if self.filled_components > 0:
            return "hybrid"
        return "model_only"


def _component_fill_color(
    image_rgb: np.ndarray,
    component_mask: np.ndarray,
) -> tuple[np.ndarray | None, float, float, float]:
    if image_rgb.ndim != 3 or image_rgb.shape[2] != 3:
        return None, 10_000.0, 10_000.0, 10_000.0

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
    outer_ring = cv2.dilate(component_mask, kernel, iterations=1)
    ring_only = cv2.bitwise_and(outer_ring, cv2.bitwise_not(component_mask))
    ring_pixels = image_rgb[ring_only > 0]
    if ring_pixels.shape[0] < 24:
        return None, 10_000.0, 10_000.0, 10_000.0

    ring_pixels_f32 = ring_pixels.astype(np.float32)
    mean_rgb = np.median(ring_pixels_f32, axis=0)
    gray = cv2.cvtColor(ring_pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2GRAY).reshape(-1)
    std_gray = float(np.std(gray.astype(np.float32)))
    color_std = float(np.max(np.std(ring_pixels_f32, axis=0)))
    hsv = cv2.cvtColor(ring_pixels.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2HSV).reshape(-1, 3)
    saturation_mean = float(np.mean(hsv[:, 1].astype(np.float32)))
    return mean_rgb.astype(np.uint8), std_gray, color_std, saturation_mean


def detect_background_complexity(
    image_rgb: np.ndarray,
    mask: np.ndarray,
    *,
    gradient_threshold: float = 12.0,
    line_density_threshold: float = 0.15,
) -> str:
    """Detect whether the background under the mask is complex (gradients, patterns) or simple.

    Returns "complex" if the masked region shows strong gradients or dense line patterns,
    otherwise "simple".
    """
    if mask.ndim == 3:
        mask = mask[:, :, 0]
    if image_rgb.ndim != 3 or image_rgb.shape[2] != 3:
        return "simple"

    masked_region = image_rgb[mask > 0]
    if masked_region.shape[0] < 10:
        return "simple"

    gray = cv2.cvtColor(
        masked_region.reshape(-1, 1, 3).astype(np.uint8), cv2.COLOR_RGB2GRAY
    ).reshape(-1)

    # Check gradient: high std in grayscale indicates gradient/pattern
    gradient_std = float(np.std(gray.astype(np.float32)))
    if gradient_std > gradient_threshold:
        return "complex"

    # Check line density: apply edge detection, count edge pixels
    h, w = mask.shape[:2]
    roi_gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    roi_gray = roi_gray[mask > 0]
    if roi_gray.shape[0] < 10:
        return "simple"

    laplacian = cv2.Laplacian(roi_gray.astype(np.float32), cv2.CV_32F)
    variance = float(np.var(laplacian))
    if variance > 200.0:
        return "complex"

    return "simple"


def apply_need_inpaint_heuristic(
    image_rgb: np.ndarray,
    mask: np.ndarray,
    *,
    background_std_threshold: float = 8.0,
    color_std_threshold: float = 9.0,
    saturation_threshold: float = 18.0,
) -> HeuristicInpaintPreparation:
    if mask.ndim == 3:
        mask = mask[:, :, 0]

    binary_mask = np.where(mask > 0, 255, 0).astype(np.uint8)
    if not np.any(binary_mask):
        return HeuristicInpaintPreparation(
            image_rgb=image_rgb.copy(),
            remaining_mask=binary_mask,
            filled_components=0,
            total_components=0,
        )

    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(binary_mask, 8, cv2.CV_32S)
    prepared_image = image_rgb.copy()
    remaining_mask = binary_mask.copy()
    filled_components = 0
    total_components = 0

    for label in range(1, component_count):
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area < 9:
            continue

        total_components += 1
        component_mask = np.where(labels == label, 255, 0).astype(np.uint8)
        fill_rgb, std_gray, color_std, saturation_mean = _component_fill_color(image_rgb, component_mask)
        if (
            fill_rgb is None
            or std_gray > background_std_threshold
            or color_std > color_std_threshold
            or saturation_mean > saturation_threshold
        ):
            continue

        prepared_image[component_mask > 0] = fill_rgb
        remaining_mask[component_mask > 0] = 0
        filled_components += 1

    return HeuristicInpaintPreparation(
        image_rgb=prepared_image,
        remaining_mask=remaining_mask,
        filled_components=filled_components,
        total_components=total_components,
    )
