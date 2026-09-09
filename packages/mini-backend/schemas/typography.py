from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class TypographyShapeDetection(BaseModel):
    id: str
    bbox: list[int] = Field(..., min_length=4, max_length=4)
    shape_kind: Literal["square", "rounded"]
    corner_radius: int = Field(default=0, ge=0)
    inner_box: list[int] = Field(..., min_length=4, max_length=4)
    fit_profile: list[float] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)
    foreground_rgb: list[int] | None = Field(default=None, min_length=3, max_length=3)
    mask_polygon: list[list[int]] | None = None


class TypographyShapeDetectionResponse(BaseModel):
    image_width: int
    image_height: int
    shapes: list[TypographyShapeDetection]
