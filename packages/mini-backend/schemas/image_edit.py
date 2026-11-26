from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


class _ImageEditBaseModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="ignore",
        str_strip_whitespace=True,
    )


class ImageEditModelConfig(_ImageEditBaseModel):

    temperature: float | None = Field(default=None, ge=0.0, le=2.0)
    top_p: float | None = Field(default=None, ge=0.0, le=1.0)
    max_tokens: int | None = Field(default=None, ge=128, le=16384)
    seed: int | None = Field(default=None, ge=0, le=2_147_483_647)
    num_inference_steps: int | None = Field(default=None, ge=1, le=100)
    guidance_scale: float | None = Field(default=None, ge=0.0, le=20.0)
    image_quality: Literal["auto", "1k", "2k", "4k"] = "auto"
    input_fidelity: Literal["high", "low"] = "high"
    aspect_ratio_strategy: Literal["auto", "pad_unpad"] = "auto"
    slicing_mode: Literal["auto", "disabled", "custom"] = "auto"
    segment_height: int = Field(default=1400, ge=600, le=2800)
    segment_overlap: int = Field(default=160, ge=40, le=400)
    max_concurrent_segments: int = Field(default=2, ge=1, le=4)
    composite_mask_margin: int = Field(default=14, ge=0, le=48)

    @field_validator("image_quality", "input_fidelity", "aspect_ratio_strategy", "slicing_mode", mode="before")
    @classmethod
    def _lowercase_enum_fields(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class AioAiGlossaryTerm(_ImageEditBaseModel):
    source: str = Field(min_length=1, max_length=120)
    target: str = Field(min_length=1, max_length=240)
    note: str | None = Field(default=None, max_length=200)
    never_translate: bool = False


class AioAiRegionGuidance(_ImageEditBaseModel):
    id: str = "region-1"
    bbox: list[int] = Field(min_length=4)
    shape_kind: Literal["rounded", "square"] | None = None
    inner_box: list[int] | None = None
    detected_render_mode: str | None = None
    structural_type: str | None = None
    source_text: str | None = None
    translated_text: str | None = None
    foreground_rgb: list[int] | None = None


class AioAiOptions(_ImageEditBaseModel):
    execution_mode: Literal["direct", "hybrid_guided", "script_guided"] = "direct"
    sfx_mode: Literal["translate", "keep", "clean_only"] = "translate"
    style_mode: Literal["match_original", "clean_comic", "custom"] = "match_original"
    refine_alignment: bool = True
    preserve_artwork: bool = False
    skip_empty_pages: bool = True

    @field_validator("execution_mode", "sfx_mode", "style_mode", mode="before")
    @classmethod
    def _lowercase_modes(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value
