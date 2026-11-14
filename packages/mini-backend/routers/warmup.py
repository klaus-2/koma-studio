"""Fire-and-forget `POST /warmup`: pre-builds the OCR engine and font-style
detector after a chapter import so the first page pipeline starts warm.

Isolation mirrors ``app.warmup_text_detection_model``: broad catch, log,
never raise, never block the response. No inpaint warmup by decision —
VRAM risk on 4GB GPUs. The engine cache owns the built engines (that is the
point of warming); no GPU lease is taken around construction and no
``release_gpu_memory`` runs afterwards.

The env kill-switch is parsed LOCALLY, never imported from ``app``: app.py
imports the routers before defining ``_env_flag``, so the import would be
circular in both directions.
"""

from __future__ import annotations

import asyncio
import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.device import get_device_info
from models.ocr.factory import get_ocr_engine
from pipelines.batch.font_style import get_font_style_detector

logger = logging.getLogger(__name__)
router = APIRouter(tags=["warmup"])

_INFLIGHT_WARMUPS: set[asyncio.Task[None]] = set()


class WarmupRequest(BaseModel):
    language: str
    ocr_model_key: str | None = None


def _warmup_enabled() -> bool:
    raw = os.getenv("MINI_BACKEND_WARMUP_PIPELINES")
    if raw is None:
        return True
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _build_warmup_engines(request: WarmupRequest) -> None:
    device = get_device_info()
    # The same GPU decision the AIO path makes by default (routers/pipeline.py
    # GpuFlags); the batch path passes device_info=None.
    get_ocr_engine(
        language=request.language,
        has_gpu=device.has_gpu,
        model_key=request.ocr_model_key or None,
        device_info=None,
    )
    get_font_style_detector()


async def _warmup_pipelines(request: WarmupRequest) -> None:
    try:
        # Both constructions may load ONNX sessions synchronously: keep them
        # off the event loop.
        await asyncio.to_thread(_build_warmup_engines, request)
    except Exception:  # noqa: BLE001 — full isolation, mirroring warmup_text_detection_model
        logger.warning("warmup.pipelines.failed", exc_info=True)


@router.post("/warmup")
async def warmup(request: WarmupRequest) -> dict[str, str]:
    if not _warmup_enabled():
        return {"status": "disabled"}
    if not request.language.strip():
        raise HTTPException(status_code=400, detail="language must not be blank")
    task = asyncio.create_task(_warmup_pipelines(request))
    _INFLIGHT_WARMUPS.add(task)
    task.add_done_callback(_INFLIGHT_WARMUPS.discard)
    return {"status": "accepted"}
