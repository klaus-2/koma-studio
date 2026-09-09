from __future__ import annotations

from typing import Literal

from pydantic import Field

from schemas.base import SchemaModel


class DetectionBox(SchemaModel):
    id: str
    bbox: list[int] = Field(..., min_length=4, max_length=4)
    score: float = Field(..., ge=0.0, le=1.0)
    label: str = "text"
    source: Literal["model", "manual"] = "model"
    model_key: str
    foreground_rgb: list[int] | None = Field(default=None, min_length=3, max_length=3)
    structural_type: str | None = None
    structural_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    structural_source: str | None = None
    matched_reference_image: str | None = None


class DetectionResponse(SchemaModel):
    device: str
    model_used: str
    image_width: int
    image_height: int
    detections: list[DetectionBox]

