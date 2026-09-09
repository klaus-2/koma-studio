from __future__ import annotations

from typing import Literal

from pydantic import Field

from schemas.base import SchemaModel


class OCRRegionRequest(SchemaModel):
    id: str
    bbox: list[int] = Field(..., min_length=4, max_length=4)
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""


class OCRForegroundGradient(SchemaModel):
    start_rgb: list[int] = Field(..., min_length=3, max_length=3)
    end_rgb: list[int] = Field(..., min_length=3, max_length=3)
    angle_degrees: float


class OCRRegionResult(SchemaModel):
    id: str
    bbox: list[int] = Field(..., min_length=4, max_length=4)
    text: str = ""
    score: float = Field(..., ge=0.0, le=1.0)
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""
    ocr_model_key: str
    foreground_gradient: OCRForegroundGradient | None = None


class OCRResponse(SchemaModel):
    device: str
    language: str
    model_used: str
    image_width: int
    image_height: int
    regions: list[OCRRegionResult]
