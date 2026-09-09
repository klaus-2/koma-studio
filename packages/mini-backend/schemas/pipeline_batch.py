from __future__ import annotations

from typing import Any
from typing import Literal

from pydantic import Field

from schemas.base import SchemaModel


class BatchStageConfig(SchemaModel):
    detect: bool = False
    ocr: bool = True
    translation: bool = True
    segment: bool = False
    clean: bool = True


class BatchItemError(SchemaModel):
    stage: str
    message: str


class BatchItemResult(SchemaModel):
    index: int
    filename: str
    status: Literal["success", "partial", "failed"]
    detect: dict[str, Any] | None = None
    ocr: dict[str, Any] | None = None
    translation: dict[str, Any] | None = None
    segment: dict[str, Any] | None = None
    clean: dict[str, Any] | None = None
    errors: list[BatchItemError] = Field(default_factory=list)


class BatchSummary(SchemaModel):
    total_images: int
    succeeded: int
    failed: int
    partial: int
    stages: BatchStageConfig
    usage_consumed_pages: int | None = None
    usage_failures: int | None = None
    usage_last_snapshot: dict[str, Any] | None = None


class BatchReport(SchemaModel):
    total_images: int
    succeeded: int
    failed: int
    partial: int
    stages: BatchStageConfig
    results: list[BatchItemResult] = Field(default_factory=list)
    usage_consumed_pages: int | None = None
    usage_failures: int | None = None
    usage_last_snapshot: dict[str, Any] | None = None
