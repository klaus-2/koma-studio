from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SplitterRecipeModel(BaseModel):
    strategy: Literal["count", "fixed_height", "smart", "advanced_desktop", "manual"] = "smart"
    axis: Literal["vertical", "horizontal"] = "vertical"
    parts: int = Field(default=3, ge=1, le=64)
    fixedHeight: int = Field(default=1600, ge=100)
    minSegmentSize: int = Field(default=900, ge=100)
    maxSegmentSize: int = Field(default=2800, ge=200)
    overlap: int = Field(default=24, ge=0, le=400)
    whitespaceSensitivity: int = Field(default=60, ge=1, le=100)
    noiseReduction: int = Field(default=24, ge=0, le=100)
    edgeGuard: int = Field(default=40, ge=0, le=400)
    protectTallBlocks: bool = True
    preset: str = "webtoon_clean"
    outputFormat: Literal["png", "jpeg", "webp"] = "png"
    baseName: str = "koma-split"
    suffixPattern: str = "{image}-part-{index}"


class SplitterCutLineModel(BaseModel):
    id: str
    position: int
    locked: bool = False
    score: float
    source: Literal["auto", "manual", "advanced_desktop"] = "advanced_desktop"
    warning: str | None = None


class SplitterSegmentModel(BaseModel):
    id: str
    start: int
    end: int
    size: int
    warning: str | None = None


class SplitterDiagnosticsModel(BaseModel):
    averageBrightness: float
    whitespaceCandidates: int
    engine: Literal["worker", "advanced_desktop"] = "advanced_desktop"


class SplitterAnalysisResponse(BaseModel):
    imageId: str
    width: int
    height: int
    strategy: Literal["count", "fixed_height", "smart", "advanced_desktop", "manual"]
    cuts: list[SplitterCutLineModel]
    segments: list[SplitterSegmentModel]
    warnings: list[str]
    diagnostics: SplitterDiagnosticsModel
