from __future__ import annotations

from typing import Literal

from pydantic import Field

from schemas.base import SchemaModel


class TranslationRegionRequest(SchemaModel):
    id: str
    text: str = ""
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    detected_render_mode: str = ""
    structural_type: str = ""
    sfx_requires_redraw: bool = False


class TranslationRegionResult(SchemaModel):
    id: str
    source_text: str = ""
    translated_text: str = ""
    translation_notes: list[str] = Field(default_factory=list)
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str
    # Provenance of the answer: "cache" | "tm" | "engine"; None when the
    # record did not pass through a stamped source (passthrough, empty).
    translation_source: str | None = None


class TranslationResponse(SchemaModel):
    source_language: str
    target_language: str
    model_used: str
    regions: list[TranslationRegionResult]
