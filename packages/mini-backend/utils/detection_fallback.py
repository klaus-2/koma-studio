from __future__ import annotations

from dataclasses import dataclass, replace
from typing import Awaitable, Callable

import cv2
import numpy as np
from PIL import Image


DetectionRunner = Callable[[Image.Image], Awaitable[list[object]]]


@dataclass(frozen=True)
class DetectionVariant:
    name: str
    image: Image.Image
    normalize_bbox: Callable[[tuple[int, int, int, int]], tuple[int, int, int, int] | None]


def _normalize_bbox_to_canvas(
    bbox: tuple[int, int, int, int],
    width: int,
    height: int,
) -> tuple[int, int, int, int] | None:
    x1, y1, x2, y2 = [int(v) for v in bbox]
    left = max(0, min(x1, x2))
    right = min(width, max(x1, x2))
    top = max(0, min(y1, y2))
    bottom = min(height, max(y1, y2))
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def _identity_bbox(
    bbox: tuple[int, int, int, int],
    width: int,
    height: int,
) -> tuple[int, int, int, int] | None:
    return _normalize_bbox_to_canvas(bbox, width, height)


def _border_bbox(
    bbox: tuple[int, int, int, int],
    width: int,
    height: int,
) -> tuple[int, int, int, int] | None:
    normalized = _normalize_bbox_to_canvas(bbox, width, height)
    if normalized is None:
        return None
    x1, y1, x2, y2 = normalized
    if x1 >= width or y1 >= height:
        return None
    return x1, y1, x2, y2


def _scaled_bbox(
    bbox: tuple[int, int, int, int],
    width: int,
    height: int,
    scale_x: float,
    scale_y: float,
) -> tuple[int, int, int, int] | None:
    x1, y1, x2, y2 = [int(v) for v in bbox]
    restored = (
        int(round(x1 / max(scale_x, 1e-6))),
        int(round(y1 / max(scale_y, 1e-6))),
        int(round(x2 / max(scale_x, 1e-6))),
        int(round(y2 / max(scale_y, 1e-6))),
    )
    return _normalize_bbox_to_canvas(restored, width, height)


def _rotate_clockwise_bbox(
    bbox: tuple[int, int, int, int],
    width: int,
    height: int,
) -> tuple[int, int, int, int] | None:
    x1, y1, x2, y2 = [int(v) for v in bbox]
    corners = np.array(
        [
            [x1, y1],
            [x2, y1],
            [x2, y2],
            [x1, y2],
        ],
        dtype=np.int32,
    )
    restored = np.array(
        [[int(y), int(height - x)] for x, y in corners],
        dtype=np.int32,
    )
    left = int(np.min(restored[:, 0]))
    top = int(np.min(restored[:, 1]))
    right = int(np.max(restored[:, 0]))
    bottom = int(np.max(restored[:, 1]))
    return _normalize_bbox_to_canvas((left, top, right, bottom), width, height)


def _build_detection_variants(image: Image.Image) -> list[DetectionVariant]:
    width, height = image.size
    rgb = np.array(image.convert("RGB"))
    variants: list[DetectionVariant] = [
        DetectionVariant(
            name="original",
            image=image,
            normalize_bbox=lambda bbox: _identity_bbox(bbox, width, height),
        )
    ]

    if min(width, height) < 400:
        canvas_size = max(width, height, 400)
        bordered = Image.new("RGB", (canvas_size, canvas_size), (255, 255, 255))
        bordered.paste(image, (0, 0))
        variants.append(
            DetectionVariant(
                name="border",
                image=bordered,
                normalize_bbox=lambda bbox: _border_bbox(bbox, width, height),
            )
        )

    max_side = max(width, height)
    min_side = min(width, height)
    should_try_upscale = max_side < 1400 or min_side < 720
    if should_try_upscale:
        target_long_edge = min(2048, max(1400, max_side * 2))
        scale = float(target_long_edge) / float(max_side)
        upscale_w = max(1, int(round(width * scale)))
        upscale_h = max(1, int(round(height * scale)))
        if upscale_w > width or upscale_h > height:
            upscaled_rgb = cv2.resize(rgb, (upscale_w, upscale_h), interpolation=cv2.INTER_CUBIC)
            variants.append(
                DetectionVariant(
                    name="upscale",
                    image=Image.fromarray(upscaled_rgb),
                    normalize_bbox=lambda bbox: _scaled_bbox(
                        bbox,
                        width,
                        height,
                        upscale_w / float(width),
                        upscale_h / float(height),
                    ),
                )
            )

            upscaled_inverted = Image.fromarray(cv2.bitwise_not(upscaled_rgb))
            variants.append(
                DetectionVariant(
                    name="upscale_invert",
                    image=upscaled_inverted,
                    normalize_bbox=lambda bbox: _scaled_bbox(
                        bbox,
                        width,
                        height,
                        upscale_w / float(width),
                        upscale_h / float(height),
                    ),
                )
            )

    inverted = Image.fromarray(cv2.bitwise_not(rgb))
    variants.append(
        DetectionVariant(
            name="invert",
            image=inverted,
            normalize_bbox=lambda bbox: _identity_bbox(bbox, width, height),
        )
    )

    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mean = max(1.0, float(np.mean(gray)))
    gamma = np.log(0.5 * 255.0) / np.log(mean) if mean not in {0.0, 1.0} else 1.0
    gamma_corrected = np.power(rgb, gamma).clip(0, 255).astype(np.uint8)
    variants.append(
        DetectionVariant(
            name="gamma",
            image=Image.fromarray(gamma_corrected),
            normalize_bbox=lambda bbox: _identity_bbox(bbox, width, height),
        )
    )

    rotated = Image.fromarray(np.rot90(rgb, k=-1).copy())
    variants.append(
        DetectionVariant(
            name="rotate90",
            image=rotated,
            normalize_bbox=lambda bbox: _rotate_clockwise_bbox(bbox, width, height),
        )
    )

    return variants


async def detect_with_fallbacks(
    image: Image.Image,
    run_detection: DetectionRunner,
) -> tuple[list[object], str]:
    best_detections: list[object] = []
    best_variant = "original"
    best_score = -1.0

    for variant in _build_detection_variants(image):
        detections = list(await run_detection(variant.image))
        normalized_detections: list[object] = []
        total_score = 0.0

        for detection in detections:
            bbox = tuple(int(v) for v in getattr(detection, "bbox", (0, 0, 0, 0)))
            normalized_bbox = variant.normalize_bbox(bbox)
            if normalized_bbox is None:
                continue
            if hasattr(detection, "__dataclass_fields__"):
                detection = replace(detection, bbox=normalized_bbox)
            else:
                setattr(detection, "bbox", normalized_bbox)
            score = float(getattr(detection, "score", 0.0) or 0.0)
            total_score += score
            normalized_detections.append(detection)

        variant_score = (len(normalized_detections) * 10.0) + total_score
        if variant_score > best_score:
            best_score = variant_score
            best_detections = normalized_detections
            best_variant = variant.name

        if variant.name == "original" and len(normalized_detections) >= 2:
            return normalized_detections, best_variant

    return best_detections, best_variant
