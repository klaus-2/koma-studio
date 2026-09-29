from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Final

type SliceBounds = tuple[int, int]


@dataclass(frozen=True, slots=True)
class SliceParams:
    height_to_width_ratio_threshold: float = 3.5
    target_slice_ratio: float = 3.0
    overlap_height_ratio: float = 0.2
    min_last_slice_height_ratio: float = 0.7


DEFAULT_SLICE_PARAMS: Final = SliceParams()


def compute_slice_bounds(
    height: int,
    width: int,
    params: SliceParams = DEFAULT_SLICE_PARAMS,
) -> list[SliceBounds]:
    """Vertical ``(start_y, end_y)`` windows covering the whole image.

    Returns ``[(0, height)]`` when the image is not tall enough to warrant slicing,
    and ``[]`` for degenerate dimensions. The last window always ends at ``height``.
    """
    if height <= 0 or width <= 0:
        return []
    if height / width <= params.height_to_width_ratio_threshold:
        return [(0, height)]

    slice_height = max(1, int(width * params.target_slice_ratio))
    stride = max(1, int(slice_height * (1.0 - params.overlap_height_ratio)))
    num_slices = max(1, math.ceil(height / stride))

    last_start = (num_slices - 1) * stride
    if (
        num_slices > 1
        and (height - last_start) / slice_height < params.min_last_slice_height_ratio
    ):
        num_slices -= 1

    return [
        (idx * stride, height if idx == num_slices - 1 else min(idx * stride + slice_height, height))
        for idx in range(num_slices)
    ]
