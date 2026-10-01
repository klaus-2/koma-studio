"""Local-only observability endpoint (the mini-backend binds to loopback)."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter

from services.diagnostics import RuntimeMemoryReport, collect_runtime_report

router = APIRouter(tags=["diagnostics"])


@router.get("/diagnostics/memory", response_model=RuntimeMemoryReport)
async def memory_report(deep: bool = False) -> RuntimeMemoryReport:
    return await asyncio.to_thread(collect_runtime_report, deep=deep)
