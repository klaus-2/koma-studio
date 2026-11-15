from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from pipelines.batch.progress import get_batch_progress_registry
from pipelines.cache_usage import CacheStoreUsage, CacheTableUsage
from pipelines.stage_store import (
    _DEFAULT_MAX_ROWS as _STAGE_DEFAULT_MAX_ROWS,
)
from pipelines.stage_store import (
    _DEFAULT_MAX_TOTAL_BYTES as _STAGE_DEFAULT_MAX_TOTAL_BYTES,
)
from pipelines.stage_store import StageStore, get_stage_store
from pipelines.translation_store import (
    _DEFAULT_MAX_ROWS as _TRANSLATION_DEFAULT_MAX_ROWS,
)
from pipelines.translation_store import TranslationStore, get_translation_store

router = APIRouter(tags=["cache"])


class CacheUsageTableModel(BaseModel):
    row_count: int
    logical_bytes: int


class CacheUsageStoreModel(BaseModel):
    file_size_bytes: int
    page_count: int
    freelist_count: int
    tables: dict[str, CacheUsageTableModel]


class CacheUsageResponse(BaseModel):
    stage_store: CacheUsageStoreModel
    translation_store: CacheUsageStoreModel


class CachePruneRequest(BaseModel):
    max_rows_per_table: int | None = Field(default=None, ge=0)
    max_total_bytes: int | None = Field(default=None, ge=0)


class CacheStorePruneReport(BaseModel):
    store: str
    freed_rows: int
    freed_logical_bytes: int


class CachePruneResponse(BaseModel):
    freed_rows: int
    freed_logical_bytes: int
    per_store: list[CacheStorePruneReport]


class CacheStoreVacuumReport(BaseModel):
    store: str
    file_size_bytes_before: int
    file_size_bytes_after: int


class CacheVacuumResponse(BaseModel):
    per_store: list[CacheStoreVacuumReport]


def _ensure_no_active_batch() -> None:
    if get_batch_progress_registry().has_unfinished():
        raise HTTPException(
            status_code=409,
            detail=(
                "A batch is active; cache prune/vacuum are unavailable until "
                "it finishes."
            ),
        )


def _total_logical_bytes(usage: CacheStoreUsage) -> int:
    return sum(table.logical_bytes for table in usage.tables.values())


def _total_rows(usage: CacheStoreUsage) -> int:
    return sum(table.row_count for table in usage.tables.values())


def _to_usage_model(usage: CacheStoreUsage) -> CacheUsageStoreModel:
    tables: dict[str, CacheTableUsage] = usage.tables
    return CacheUsageStoreModel(
        file_size_bytes=usage.file_size_bytes,
        page_count=usage.page_count,
        freelist_count=usage.freelist_count,
        tables={
            name: CacheUsageTableModel(
                row_count=table.row_count,
                logical_bytes=table.logical_bytes,
            )
            for name, table in tables.items()
        },
    )


def _prune_report(
    usage_before: CacheStoreUsage, usage_after: CacheStoreUsage
) -> tuple[int, int]:
    return (
        _total_rows(usage_before) - _total_rows(usage_after),
        _total_logical_bytes(usage_before) - _total_logical_bytes(usage_after),
    )


def _collect_cache_usage() -> CacheUsageResponse:
    return CacheUsageResponse(
        stage_store=_to_usage_model(get_stage_store().usage()),
        translation_store=_to_usage_model(get_translation_store().usage()),
    )


@router.get("/diagnostics/cache-usage", response_model=CacheUsageResponse)
async def cache_usage() -> CacheUsageResponse:
    return await asyncio.to_thread(_collect_cache_usage)


def _run_cache_prune(request: CachePruneRequest) -> CachePruneResponse:
    _ensure_no_active_batch()

    stage_store: StageStore = get_stage_store()
    stage_before = stage_store.usage()
    stage_store.prune(
        max_rows=(
            request.max_rows_per_table
            if request.max_rows_per_table is not None
            else _STAGE_DEFAULT_MAX_ROWS
        ),
        max_bytes=(
            request.max_total_bytes
            if request.max_total_bytes is not None
            else _STAGE_DEFAULT_MAX_TOTAL_BYTES
        ),
    )
    stage_rows, stage_bytes = _prune_report(stage_before, stage_store.usage())

    translation_store: TranslationStore = get_translation_store()
    translation_before = translation_store.usage()
    translation_store.prune(
        max_rows=(
            request.max_rows_per_table
            if request.max_rows_per_table is not None
            else _TRANSLATION_DEFAULT_MAX_ROWS
        )
    )
    translation_rows, translation_bytes = _prune_report(
        translation_before, translation_store.usage()
    )

    stage_report = CacheStorePruneReport(
        store="stage",
        freed_rows=stage_rows,
        freed_logical_bytes=stage_bytes,
    )
    translation_report = CacheStorePruneReport(
        store="translation",
        freed_rows=translation_rows,
        freed_logical_bytes=translation_bytes,
    )
    return CachePruneResponse(
        freed_rows=stage_report.freed_rows + translation_report.freed_rows,
        freed_logical_bytes=stage_report.freed_logical_bytes
        + translation_report.freed_logical_bytes,
        per_store=[stage_report, translation_report],
    )


@router.post("/cache/prune", response_model=CachePruneResponse)
async def cache_prune(request: CachePruneRequest) -> CachePruneResponse:
    return await asyncio.to_thread(_run_cache_prune, request)


def _run_cache_vacuum() -> CacheVacuumResponse:
    _ensure_no_active_batch()
    stage_before, stage_after = get_stage_store().vacuum()
    translation_before, translation_after = get_translation_store().vacuum()
    return CacheVacuumResponse(
        per_store=[
            CacheStoreVacuumReport(
                store="stage",
                file_size_bytes_before=stage_before,
                file_size_bytes_after=stage_after,
            ),
            CacheStoreVacuumReport(
                store="translation",
                file_size_bytes_before=translation_before,
                file_size_bytes_after=translation_after,
            ),
        ]
    )


@router.post("/cache/vacuum", response_model=CacheVacuumResponse)
async def cache_vacuum() -> CacheVacuumResponse:
    return await asyncio.to_thread(_run_cache_vacuum)
