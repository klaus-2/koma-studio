from __future__ import annotations

from typing import Any
from typing import Literal

from pydantic import Field

from schemas.base import SchemaModel


class InpaintRegionRequest(SchemaModel):
    id: str
    bbox: tuple[int, int, int, int]
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""
    segment_model_key: str = ""
    segment_boxes: list[tuple[int, int, int, int]] = Field(default_factory=list)
    merged_boxes: list[tuple[int, int, int, int]] = Field(default_factory=list)
    mask_base64: str = ""


class CleanRequest(SchemaModel):
    mask_dilation: int = 5
    model_key: str | None = None
    hd_strategy: str = "crop"
    hd_strategy_resize_limit: int = 960
    hd_strategy_crop_margin: int = 512
    hd_strategy_crop_trigger_size: int = 512


class CleanResult(SchemaModel):
    image: Any = None
    detections: list[Any] = Field(default_factory=list)
    mask: Any = None
    model_used: dict[str, str] = Field(default_factory=dict)

    model_config = {"arbitrary_types_allowed": True}
