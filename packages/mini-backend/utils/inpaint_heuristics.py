from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Final, Literal

import cv2
import numpy as np
from numpy.typing import NDArray

from utils.image_codec import MaskImage, RGBImage, validate_mask, validate_rgb
from utils.workers import run_native

type InpaintMethod = Literal["no-op", "solid_fill", "hybrid", "model_only"]
type BackgroundComplexity = Literal["simple", "complex"]

MIN_COMPONENT_AREA: Final = 9
RING_RADIUS: Final = 4
MIN_RING_PIXELS: Final = 24
MAX_HEURISTIC_COMPONENTS: Final = 10_000
MAX_ROI_WORK_MULTIPLIER: Final = 4

_RING_KERNEL: Final = cv2.getStructuringElement(
    cv2.MORPH_ELLIPSE,
    (RING_RADIUS * 2 + 1, RING_RADIUS * 2 + 1),
)
_NEIGHBOR_KERNEL: Final = np.ones((3, 3), dtype=np.uint8)


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
        if not self.needs_model_inpaint:
            return "solid_fill"
        return "hybrid" if self.filled_components else "model_only"


@dataclass(frozen=True, slots=True)
class _RingStatistics:
    fill_rgb: NDArray[np.uint8]
    gray_std: float
    max_channel_std: float
    saturation_mean: float


def _validate_inputs(image_rgb: RGBImage, mask: MaskImage) -> None:
    validate_rgb(image_rgb)
    validate_mask(mask)
    if mask.shape != image_rgb.shape[:2]:
        raise ValueError("Mask shape must match the RGB image")


def _validate_thresholds(*values: float) -> None:
    if not all(math.isfinite(value) and value >= 0 for value in values):
        raise ValueError("Thresholds must be finite and nonnegative")


def _ring_statistics(
    roi_rgb: RGBImage,
    roi_component: NDArray[np.bool_],
    roi_mask: MaskImage,
) -> _RingStatistics | None:
    component = roi_component.astype(np.uint8)
    dilated = np.asarray(
        cv2.dilate(
            component,
            _RING_KERNEL,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=0,
        ),
        dtype=np.uint8,
    )
    # Every masked component is excluded, not only the component being filled.
    ring_pixels = roi_rgb[(dilated > 0) & (roi_mask == 0)]
    if ring_pixels.shape[0] < MIN_RING_PIXELS:
        return None

    pixels = ring_pixels.astype(np.float32)
    column = ring_pixels.reshape(-1, 1, 3)
    gray = np.asarray(cv2.cvtColor(column, cv2.COLOR_RGB2GRAY), dtype=np.float32)
    hsv = np.asarray(cv2.cvtColor(column, cv2.COLOR_RGB2HSV), dtype=np.uint8)
    return _RingStatistics(
        fill_rgb=np.rint(np.median(pixels, axis=0)).astype(np.uint8),
        gray_std=float(np.std(gray)),
        max_channel_std=float(np.max(np.std(pixels, axis=0))),
        saturation_mean=float(np.mean(hsv[:, :, 1])),
    )


def detect_background_complexity(
    image_rgb: RGBImage,
    mask: MaskImage,
    *,
    gradient_threshold: float = 12.0,
    line_density_threshold: float = 0.15,
) -> BackgroundComplexity:
    """Inspect spatial gradients in observable context surrounding the mask."""
    _validate_inputs(image_rgb, mask)
    _validate_thresholds(gradient_threshold, line_density_threshold)
    if line_density_threshold > 1:
        raise ValueError("Line density threshold must not exceed one")
    if not np.any(mask):
        return "simple"

    binary: MaskImage = (mask > 0).astype(np.uint8)
    x, y, width, height = cv2.boundingRect(binary)
    padding = RING_RADIUS + 2
    x0, y0 = max(0, x - padding), max(0, y - padding)
    x1 = min(mask.shape[1], x + width + padding)
    y1 = min(mask.shape[0], y + height + padding)

    roi_mask = binary[y0:y1, x0:x1]
    surrounding = cv2.dilate(roi_mask, _RING_KERNEL) > 0
    unmasked: MaskImage = (roi_mask == 0).astype(np.uint8)
    valid_neighbors = cv2.erode(
        unmasked,
        _NEIGHBOR_KERNEL,
        borderType=cv2.BORDER_CONSTANT,
        borderValue=0,
    ) > 0
    context = surrounding & valid_neighbors
    if np.count_nonzero(context) < MIN_RING_PIXELS:
        return "complex"

    gray = cv2.cvtColor(image_rgb[y0:y1, x0:x1], cv2.COLOR_RGB2GRAY)
    dx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3, scale=1 / 8)
    dy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3, scale=1 / 8)
    magnitude = np.asarray(cv2.magnitude(dx, dy), dtype=np.float32)
    line_density = float(np.mean(magnitude[context] > gradient_threshold))
    return "complex" if line_density > line_density_threshold else "simple"


def apply_need_inpaint_heuristic(
    image_rgb: RGBImage,
    mask: MaskImage,
    *,
    background_std_threshold: float = 8.0,
    color_std_threshold: float = 9.0,
    saturation_threshold: float = 18.0,
) -> HeuristicInpaintPreparation:
    _validate_inputs(image_rgb, mask)
    _validate_thresholds(
        background_std_threshold,
        color_std_threshold,
        saturation_threshold,
    )

    binary: MaskImage = (mask > 0).astype(np.uint8)
    binary *= np.uint8(255)
    prepared = image_rgb.copy()
    remaining = binary.copy()
    if not np.any(binary):
        return HeuristicInpaintPreparation(prepared, remaining, 0, 0)

    count, raw_labels, raw_stats, _ = cv2.connectedComponentsWithStats(
        binary,
        connectivity=8,
        ltype=cv2.CV_32S,
    )
    labels: NDArray[np.int32] = np.asarray(raw_labels, dtype=np.int32)
    stats: NDArray[np.int32] = np.asarray(raw_stats, dtype=np.int32)
    total = count - 1
    height, width = binary.shape
    filled = 0
    roi_work = 0
    work_budget = binary.size * MAX_ROI_WORK_MULTIPLIER

    for label in range(1, min(count, MAX_HEURISTIC_COMPONENTS + 1)):
        x, y, component_width, component_height, area = (
            int(value) for value in stats[label]
        )
        if area < MIN_COMPONENT_AREA:
            continue

        y0 = max(0, y - RING_RADIUS)
        y1 = min(height, y + component_height + RING_RADIUS)
        x0 = max(0, x - RING_RADIUS)
        x1 = min(width, x + component_width + RING_RADIUS)
        roi_work += (y1 - y0) * (x1 - x0)
        if roi_work > work_budget:
            break

        component = labels[y0:y1, x0:x1] == label
        ring = _ring_statistics(
            image_rgb[y0:y1, x0:x1],
            component,
            binary[y0:y1, x0:x1],
        )
        if (
            ring is None
            or ring.gray_std > background_std_threshold
            or ring.max_channel_std > color_std_threshold
            or ring.saturation_mean > saturation_threshold
        ):
            continue

        prepared[y0:y1, x0:x1][component] = ring.fill_rgb
        remaining[y0:y1, x0:x1][component] = 0
        filled += 1

    return HeuristicInpaintPreparation(prepared, remaining, filled, total)


async def apply_need_inpaint_heuristic_async(
    image_rgb: RGBImage,
    mask: MaskImage,
    *,
    background_std_threshold: float = 8.0,
    color_std_threshold: float = 9.0,
    saturation_threshold: float = 18.0,
) -> HeuristicInpaintPreparation:
    return await run_native(
        apply_need_inpaint_heuristic,
        image_rgb,
        mask,
        background_std_threshold=background_std_threshold,
        color_std_threshold=color_std_threshold,
        saturation_threshold=saturation_threshold,
    )
