"""Boundary models for YuzuMarker font/style detection."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class FontStyleRegion(BaseModel):
    model_config = ConfigDict(extra="ignore", frozen=True)

    id: str = ""
    x: int = 0
    y: int = 0
    w: int = Field(ge=1)
    h: int = Field(ge=1)


class FontStyleDetectResponse(BaseModel):
    predictions: list[dict[str, object]]
