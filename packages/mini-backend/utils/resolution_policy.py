from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Final, Literal

StageName = Literal["detection", "decode", "inpaint", "segment", "clean"]

SAFE_TARGET_MEGAPIXELS: Final[float] = 24.0

DETECTION_HARD_CAP_MEGAPIXELS: Final[float] = 32.0

DECODE_CEILING_MEGAPIXELS: Final[float] = 64.0

Megapixel = float


@dataclass(frozen=True, slots=True)
class StageResolutionPlan:
    stage: StageName
    width: int
    height: int
    megapixels: float
    working_width: int
    working_height: int
    scale_x: float
    scale_y: float
    downscaled: bool


def megapixels_of(width: int, height: int) -> Megapixel:
    return (width * height) / 1_000_000.0


def _working_dimensions(
    width: int,
    height: int,
    target_megapixels: float,
) -> tuple[int, int, float, float]:
    scale = math.sqrt(target_megapixels / megapixels_of(width, height))
    working_width = max(1, round(width * scale))
    working_height = max(1, round(height * scale))
    return working_width, working_height, working_width / width, working_height / height


def stage_resolution_plan(
    stage: StageName,
    width: int,
    height: int,
) -> StageResolutionPlan:
    megapixels = megapixels_of(width, height)
    if stage != "detection" or megapixels <= SAFE_TARGET_MEGAPIXELS:
        return StageResolutionPlan(
            stage=stage,
            width=width,
            height=height,
            megapixels=megapixels,
            working_width=width,
            working_height=height,
            scale_x=1.0,
            scale_y=1.0,
            downscaled=False,
        )
    working_width, working_height, scale_x, scale_y = _working_dimensions(
        width, height, SAFE_TARGET_MEGAPIXELS
    )
    return StageResolutionPlan(
        stage="detection",
        width=width,
        height=height,
        megapixels=megapixels,
        working_width=working_width,
        working_height=working_height,
        scale_x=scale_x,
        scale_y=scale_y,
        downscaled=True,
    )


def detection_rejects(width: int, height: int) -> bool:
    return megapixels_of(width, height) > DETECTION_HARD_CAP_MEGAPIXELS


def decode_rejects(width: int, height: int) -> bool:
    return megapixels_of(width, height) > DECODE_CEILING_MEGAPIXELS
