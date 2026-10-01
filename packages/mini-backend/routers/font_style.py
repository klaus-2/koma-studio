"""YuzuMarker font/color/style detection on text blocks."""

from __future__ import annotations

import asyncio
import logging
import threading
from collections.abc import Sequence
from typing import Annotated, Final

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from PIL import Image
from pydantic import TypeAdapter

from models.detection.font_style import YuzuFontStyleDetector
from models.detection.font_style.storage import font_style_runtime_ready
from routers._boundary import parse_json_form_field, read_rgb_upload
from schemas.font_style import FontStyleDetectResponse, FontStyleRegion

logger = logging.getLogger(__name__)
router = APIRouter(tags=["font-style"])

_REGIONS_ADAPTER: Final = TypeAdapter(list[FontStyleRegion])
_MAX_TOP_K: Final = 10

_detector_lock = threading.Lock()
_detector: YuzuFontStyleDetector | None = None
# YuzuFontStyleDetector does not document thread-safety and GPU inference
# serialises anyway, so one inference at a time is the correct default.
_inference_lock = threading.Lock()


def _get_detector() -> YuzuFontStyleDetector:
    global _detector
    if _detector is None:
        with _detector_lock:
            if _detector is None:
                _detector = YuzuFontStyleDetector()
    return _detector


def _detect_blocking(
    crops: Sequence[Image.Image], *, original_widths: Sequence[int], top_k: int
):  # noqa: ANN202 — return type owned by YuzuFontStyleDetector.detect
    with _inference_lock:
        return _get_detector().detect(list(crops), original_widths=list(original_widths), top_k=top_k)


@router.get("/font-style/status")
async def font_style_status() -> dict[str, bool]:
    return {"available": font_style_runtime_ready()}


@router.post("/font-style/detect", response_model=FontStyleDetectResponse)
async def detect_font_style(
    file: Annotated[UploadFile, File()],
    regions_json: Annotated[str, Form()] = "[]",
    top_k: Annotated[int, Form(ge=1, le=_MAX_TOP_K)] = 1,
) -> FontStyleDetectResponse:
    if not font_style_runtime_ready():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="YuzuMarker font detection model not available. Check bundled weights.",
        )

    _, rgb_image = await read_rgb_upload(file)
    regions = parse_json_form_field(regions_json, _REGIONS_ADAPTER, field_name="regions_json") or []
    if not regions:
        return FontStyleDetectResponse(predictions=[])

    page_image = Image.fromarray(rgb_image)
    page_w, page_h = page_image.size

    crops: list[Image.Image] = []
    kept_regions: list[FontStyleRegion] = []
    for region in regions:
        x1, y1 = max(0, region.x), max(0, region.y)
        x2, y2 = min(region.x + region.w, page_w), min(region.y + region.h, page_h)
        if x2 <= x1 or y2 <= y1:
            continue
        crops.append(page_image.crop((x1, y1, x2, y2)))
        kept_regions.append(region)

    if not crops:
        return FontStyleDetectResponse(predictions=[])

    predictions = await asyncio.to_thread(
        _detect_blocking, crops, original_widths=[page_w] * len(crops), top_k=top_k
    )
    return FontStyleDetectResponse(
        predictions=[
            {"region_id": region.id, **prediction.to_dict()}
            for region, prediction in zip(kept_regions, predictions, strict=True)
        ]
    )
