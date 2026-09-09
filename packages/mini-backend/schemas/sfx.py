from __future__ import annotations

from schemas.base import SchemaModel


class SfxRegionRequest(SchemaModel):
    id: str
    bbox: list[int]
    source: str = "model"
    detector_model_key: str = ""
    score: float = 0.0
    structural_type: str | None = None
    structural_confidence: float | None = None
    structural_source: str | None = None
    matched_reference_image: str | None = None
    detected_render_mode: str | None = None


class SfxRegionResult(SchemaModel):
    id: str
    is_sfx: bool
    confidence: float
    requires_redraw: bool
    reason: str | None = None


class SfxClassificationResponse(SchemaModel):
    model_used: str
    regions: list[SfxRegionResult]
