"""Long-strip cut-line analysis (whitespace projection along one axis)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal, cast
from uuid import uuid4

import cv2
import numpy as np
import numpy.typing as npt

from schemas.splitter import SplitterCutLineModel, SplitterRecipeModel, SplitterSegmentModel
from utils.image_codec import RGBImage

type Axis = Literal["vertical", "horizontal"]
type GrayImage = npt.NDArray[np.uint8]
type Projection = npt.NDArray[np.float64]

_WHITESPACE_LEVEL: Final = 220
_BLUR_TAPS: Final = 9
_MIN_SEGMENT_FLOOR: Final = 80
_MIN_FIXED_STEP: Final = 100
_MIN_EDGE_GUARD: Final = 8
_TINY_SEGMENT_PX: Final = 400
_ENGINE: Final = "advanced_desktop"


@dataclass(frozen=True, slots=True)
class SplitterAnalysis:
    cuts: list[SplitterCutLineModel]
    segments: list[SplitterSegmentModel]
    warnings: list[str]
    average_brightness: float
    whitespace_candidates: int


def _projection(gray: GrayImage, axis: Axis) -> Projection:
    # After the transpose, rows always index the cut position; the blur must
    # therefore run along rows (ksize height) for both axes. The old code
    # rotated the kernel together with the image, smoothing *within* each cut
    # position (which mean(axis=1) already averages) and never *between*
    # positions — horizontal strips got no smoothing at all.
    work = gray if axis == "vertical" else np.ascontiguousarray(gray.T)
    blurred = cv2.GaussianBlur(work, (1, _BLUR_TAPS), 0)
    return cast(Projection, blurred.mean(axis=1, dtype=np.float64))


def _fixed_positions(total: int, recipe: SplitterRecipeModel) -> list[int]:
    if recipe.strategy == "count":
        parts = max(1, recipe.parts)
        return [round(total / parts * index) for index in range(1, parts)]
    step = max(_MIN_FIXED_STEP, recipe.fixedHeight)
    return list(range(step, total, step))


def _smart_positions(
    gray: GrayImage, recipe: SplitterRecipeModel
) -> tuple[list[int], float, int]:
    projection = _projection(gray, recipe.axis)
    total = int(projection.shape[0])
    threshold = 170 + round(recipe.whitespaceSensitivity / 100 * 70)
    min_size = max(_MIN_SEGMENT_FLOOR, recipe.minSegmentSize)
    max_size = max(min_size + 1, recipe.maxSegmentSize)
    edge_guard = max(_MIN_EDGE_GUARD, recipe.edgeGuard)
    tall_block_limit = int(max_size * 1.2)

    positions: list[int] = []
    last_cut = 0
    for position in range(min_size, max(0, total - edge_guard)):
        if position - last_cut < min_size or total - position < min_size // 2:
            continue
        brightness = float(projection[position])
        if brightness < threshold:
            continue
        if (
            recipe.protectTallBlocks
            and position - last_cut > tall_block_limit
            and brightness < threshold + 16
        ):
            continue
        positions.append(position)
        last_cut = position

    average = float(projection.mean()) if projection.size else 0.0
    candidates = int(np.count_nonzero(projection >= _WHITESPACE_LEVEL))
    return positions, average, candidates


def _segments(total: int, cut_positions: list[int], overlap: int) -> list[SplitterSegmentModel]:
    interior = sorted({p for p in cut_positions if 0 < p < total})
    boundaries = [0, *interior, total]
    last = len(boundaries) - 2
    segments: list[SplitterSegmentModel] = []
    for index in range(len(boundaries) - 1):
        start = boundaries[index] if index == 0 else max(0, boundaries[index] - overlap)
        end = boundaries[index + 1] if index == last else min(total, boundaries[index + 1] + overlap)
        size = max(1, end - start)
        segments.append(
            SplitterSegmentModel(
                id=f"segment-{uuid4().hex[:8]}",
                start=start,
                end=end,
                size=size,
                warning="Segment is very small." if size < _TINY_SEGMENT_PX else None,
            )
        )
    return segments


def analyze_strip(rgb: RGBImage, recipe: SplitterRecipeModel) -> SplitterAnalysis:
    gray = cast(GrayImage, cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY))
    total = int(gray.shape[0] if recipe.axis == "vertical" else gray.shape[1])

    if recipe.strategy in {"count", "fixed_height"}:
        positions = _fixed_positions(total, recipe)
        average = float(gray.mean()) if gray.size else 0.0
        candidates = int(np.count_nonzero(gray >= _WHITESPACE_LEVEL))
    else:
        positions, average, candidates = _smart_positions(gray, recipe)

    edge_guard = max(_MIN_EDGE_GUARD, recipe.edgeGuard)
    cuts = [
        SplitterCutLineModel(
            id=f"cut-{uuid4().hex[:8]}",
            position=position,
            locked=False,
            score=round(min(0.99, max(0.05, position / max(1, total) + 0.15)), 4),
            source=_ENGINE,
            warning=(
                "Too close to the edge."
                if position < edge_guard or total - position < edge_guard
                else None
            ),
        )
        for position in positions
    ]
    segments = _segments(total, [cut.position for cut in cuts], recipe.overlap)

    warnings: list[str] = []
    if not cuts:
        warnings.append("No reliable cut was found.")
    if any(segment.size < recipe.minSegmentSize for segment in segments):
        warnings.append("A segment is smaller than the configured minimum height.")
    if any(segment.size > recipe.maxSegmentSize for segment in segments):
        warnings.append("A segment is larger than the configured maximum height.")

    return SplitterAnalysis(
        cuts=cuts,
        segments=segments,
        warnings=warnings,
        average_brightness=round(average, 2),
        whitespace_candidates=candidates,
    )
