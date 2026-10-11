from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated, Final

from pydantic import BaseModel, ConfigDict, Field

type SliceBounds = tuple[int, int]


class SliceParams(BaseModel):
    model_config = ConfigDict(
        frozen=True,
        extra="forbid",
        allow_inf_nan=False,
    )

    height_to_width_ratio_threshold: Annotated[
        float, Field(strict=True, gt=0.0)
    ] = 3.5
    target_slice_ratio: Annotated[
        float, Field(strict=True, gt=0.0)
    ] = 3.0
    overlap_height_ratio: Annotated[
        float, Field(strict=True, ge=0.0, lt=1.0)
    ] = 0.2
    min_last_slice_height_ratio: Annotated[
        float, Field(strict=True, ge=0.0, le=1.0)
    ] = 0.7


DEFAULT_SLICE_PARAMS: Final[SliceParams] = SliceParams()


def iter_slice_bounds(
    height: int,
    width: int,
    params: SliceParams = DEFAULT_SLICE_PARAMS,
) -> Iterator[SliceBounds]:
    """Yield covering windows without redundant trailing slices."""
    if height <= 0 or width <= 0:
        return

    if height / width <= params.height_to_width_ratio_threshold:
        yield 0, height
        return

    if params.target_slice_ratio >= height / width:
        yield 0, height
        return

    slice_height = max(1, int(width * params.target_slice_ratio))
    stride = max(
        1,
        int(slice_height * (1.0 - params.overlap_height_ratio)),
    )
    remaining = max(0, height - slice_height)
    count = 1 + (remaining + stride - 1) // stride

    if count > 1:
        last_start = (count - 1) * stride
        last_height = height - last_start
        if last_height / slice_height < params.min_last_slice_height_ratio:
            count -= 1

    for index in range(count):
        start = index * stride
        end = (
            height
            if index == count - 1
            else min(start + slice_height, height)
        )
        yield start, end


def compute_slice_bounds(
    height: int,
    width: int,
    params: SliceParams = DEFAULT_SLICE_PARAMS,
) -> list[SliceBounds]:
    return list(iter_slice_bounds(height, width, params))
