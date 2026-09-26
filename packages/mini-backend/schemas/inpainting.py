from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import Form
from pydantic import Field, TypeAdapter, field_validator

from models.inpainting.base_inpainter import HDStrategy
from schemas.base import SchemaModel


class InpaintOptions(SchemaModel):
    """Shared inpainting options, extracted from spread multipart fields.

    FastAPI 0.115 does not bind a bare form model to spread multipart fields,
    so routers extract each field with ``Form()`` and build this via a Depends
    dependency. Field constraints (ge/le) live on the ``Form()`` declarations
    there; the model is the single typed hand-off to the execution layer.
    """

    model_key: str | None = None
    mask_dilation: int = 5
    hd_strategy: HDStrategy = HDStrategy.RESIZE
    hd_strategy_resize_limit: int = 960
    hd_strategy_crop_margin: int = 512
    hd_strategy_crop_trigger_size: int = 512
    use_gpu: bool | None = None

    @field_validator("hd_strategy", mode="before")
    @classmethod
    def _normalize_hd_strategy(cls, value: object) -> object:
        # HDStrategy.from_value normalizes aliases ("hd_resize" → RESIZE);
        # keep unspecified/empty values at the model default.
        if isinstance(value, str) and value.strip():
            return HDStrategy.from_value(value)
        return value


class InpaintRegionsForm(InpaintOptions):
    """``/inpaint`` options. ``regions`` is a JSON string inside the multipart
    body: ``None`` means "not provided" (triggers auto-detection) while an
    explicit ``"[]"`` means "the client decided there is nothing to inpaint".
    """

    regions: str | None = None


class InpaintMaskForm(InpaintOptions):
    """``/inpaint-mask`` options; dilation defaults to 0 because the uploaded
    mask is authoritative."""

    mask_dilation: int = 0


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


INPAINT_DILATION_FIELD = Annotated[int | None, Form(ge=0, le=50)]
INPAINT_MASK_DILATION_FIELD = Annotated[int | None, Form(ge=0, le=64)]
INPAINT_RESIZE_LIMIT_FIELD = Annotated[int | None, Form(ge=256, le=4096)]
INPAINT_CROP_FIELD = Annotated[int | None, Form(ge=0, le=4096)]
INPAINT_CROP_TRIGGER_FIELD = Annotated[int | None, Form(ge=64, le=4096)]

REGION_LIST_ADAPTER: TypeAdapter[list[InpaintRegionRequest]] = TypeAdapter(
    list[InpaintRegionRequest]
)
