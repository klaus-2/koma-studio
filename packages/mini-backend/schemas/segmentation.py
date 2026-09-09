from __future__ import annotations

from typing import Literal

from schemas.base import SchemaModel


class SegmentRegionRequest(SchemaModel):
    id: str
    bbox: tuple[int, int, int, int]
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""


class SegmentRegionResult(SchemaModel):
    id: str
    bbox: list[int]
    segment_boxes: list[list[int]]
    merged_boxes: list[list[int]]
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""
    segment_model_key: str
    mask_base64: str = ""


class SegmentResponse(SchemaModel):
    device: str
    model_used: str
    image_width: int
    image_height: int
    regions: list[SegmentRegionResult]
