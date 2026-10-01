"""Solid-colour fill for mask components on flat backgrounds; the rest goes to the model."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

import cv2
import numpy as np
from numpy.typing import NDArray

from utils.image_codec import MaskImage, RGBImage

type InpaintMethod = Literal["no-op", "solid_fill", "hybrid", "model_only"]

MIN_COMPONENT_AREA: Final = 9
RING_RADIUS: Final = 4
MIN_RING_PIXELS: Final = 24
_RING_KERNEL: Final = cv2.getStructuringElement(
    cv2.MORPH_ELLIPSE, (RING_RADIUS * 2 + 1, RING_RADIUS * 2 + 1)
)


@dataclass(frozen=True, slots=True)
class HeuristicInpaintPreparation:
    image_rgb: RGBImage
    remaining_mask: MaskImage
    filled_components: int
    total_components: int

    @property
    def needs_model_inpaint(self) -> bool:
        return bool(np.any(self.remaining_mask))

    @property
    def method_label(self) -> InpaintMethod:
        if self.total_components == 0:
            return "no-op"
        if self.filled_components == self.total_components:
            return "solid_fill"
        if self.filled_components > 0:
            return "hybrid"
        return "model_only"


@dataclass(frozen=True, slots=True)
class _RingStatistics:
    fill_rgb: NDArray[np.uint8]
    gray_std: float
    max_channel_std: float
    saturation_mean: float


def _ring_statistics(roi_rgb: RGBImage, roi_component: NDArray[np.bool_]) -> _RingStatistics | None:
    """Colour statistics of the ring just outside the component (within its ROI)."""
    component_u8 = roi_component.astype(np.uint8) * 255
    dilated = np.asarray(cv2.dilate(component_u8, _RING_KERNEL, iterations=1)) > 0
    ring_pixels = roi_rgb[dilated & ~roi_component]
    if ring_pixels.shape[0] < MIN_RING_PIXELS:
        return None

    pixels_f32 = ring_pixels.astype(np.float32)
    column = ring_pixels.reshape(-1, 1, 3)
    gray = np.asarray(cv2.cvtColor(column, cv2.COLOR_RGB2GRAY)).reshape(-1).astype(np.float32)
    hsv = np.asarray(cv2.cvtColor(column, cv2.COLOR_RGB2HSV)).reshape(-1, 3)
    return _RingStatistics(
        fill_rgb=np.median(pixels_f32, axis=0).astype(np.uint8),
        gray_std=float(np.std(gray)),
        max_channel_std=float(np.max(np.std(pixels_f32, axis=0))),
        saturation_mean=float(np.mean(hsv[:, 1])),
    )


def detect_background_complexity(
    image_rgb: RGBImage,
    mask: MaskImage,
    *,
    gradient_threshold: float = 12.0,
    line_density_threshold: float = 0.15,
) -> str:
    """Classify the background under the mask as "complex" or "simple".

    Note: the grayscale-std test fires for any dark text on a light page, so
    in practice this skews "complex" on dense pages. Callers currently use it
    only to pick the inpaint HD strategy; a spatial rewrite (Laplacian over
    the masked ROI, not a flattened vector) is on the utils refactor queue.
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

    gradient_std = float(np.std(gray.astype(np.float32)))
    if gradient_std > gradient_threshold:
        return "complex"

    _ = line_density_threshold
    roi_gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    roi_gray = roi_gray[mask > 0]
    if roi_gray.shape[0] < 10:
        return "simple"

    laplacian = cv2.Laplacian(roi_gray.astype(np.float32), cv2.CV_32F)
    if float(np.var(laplacian)) > 200.0:
        return "complex"

    return "simple"


def apply_need_inpaint_heuristic(
    image_rgb: RGBImage,
    mask: MaskImage,
    *,
    background_std_threshold: float = 8.0,
    color_std_threshold: float = 9.0,
    saturation_threshold: float = 18.0,
) -> HeuristicInpaintPreparation:
    if image_rgb.ndim != 3 or image_rgb.shape[2] != 3:
        raise ValueError(f"image_rgb must be HxWx3, got shape {image_rgb.shape}")
    if mask.ndim == 3:
        mask = mask[:, :, 0]
    if mask.shape != image_rgb.shape[:2]:
        raise ValueError(f"mask shape {mask.shape} does not match image {image_rgb.shape[:2]}")

    binary: MaskImage = np.where(mask > 0, 255, 0).astype(np.uint8)
    if not np.any(binary):
        return HeuristicInpaintPreparation(image_rgb.copy(), binary, 0, 0)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8, ltype=cv2.CV_32S)
    height, width = binary.shape
    prepared = image_rgb.copy()
    remaining = binary.copy()
    filled = total = 0

    for label in range(1, count):
        x, y, w, h, area = (int(v) for v in stats[label])
        if area < MIN_COMPONENT_AREA:
            continue
        total += 1

        y0, y1 = max(0, y - RING_RADIUS), min(height, y + h + RING_RADIUS)
        x0, x1 = max(0, x - RING_RADIUS), min(width, x + w + RING_RADIUS)
        roi_component = np.asarray(labels[y0:y1, x0:x1]) == label

        ring = _ring_statistics(image_rgb[y0:y1, x0:x1], roi_component)
        if (
            ring is None
            or ring.gray_std > background_std_threshold
            or ring.max_channel_std > color_std_threshold
            or ring.saturation_mean > saturation_threshold
        ):
            continue

        prepared[y0:y1, x0:x1][roi_component] = ring.fill_rgb
        remaining[y0:y1, x0:x1][roi_component] = 0
        filled += 1

    return HeuristicInpaintPreparation(prepared, remaining, filled, total)
