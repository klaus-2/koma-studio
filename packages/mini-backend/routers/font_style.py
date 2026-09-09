"""Router for YuzuMarker font/color/style detection on text blocks."""
from __future__ import annotations

import json
import logging
from io import BytesIO
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from models.detection.font_style import YuzuFontStyleDetector
from models.detection.font_style.storage import font_style_runtime_ready

logger = logging.getLogger(__name__)
router = APIRouter(tags=["font-style"])

_DETECTOR: YuzuFontStyleDetector | None = None


def _get_detector() -> YuzuFontStyleDetector:
    global _DETECTOR
    if _DETECTOR is None:
        _DETECTOR = YuzuFontStyleDetector()
    return _DETECTOR


@router.get("/font-style/status")
async def font_style_status() -> dict[str, Any]:
    """Check whether the bundled YuzuMarker model is available."""
    return {
        "available": font_style_runtime_ready(),
    }


@router.post("/font-style/detect")
async def detect_font_style(
    file: UploadFile = File(...),
    regions_json: str = Form("[]"),
    top_k: int = Form(1),
) -> dict[str, Any]:
    """Detect font, color, and style for text-block regions in the given image.

    Parameters
    ----------
    file : uploaded image (full page)
    regions_json : JSON array of ``{"id": str, "x": int, "y": int, "w": int, "h": int}``
    top_k : how many font candidates per region (default 1)
    """
    if not font_style_runtime_ready():
        raise HTTPException(
            status_code=503,
            detail="YuzuMarker font detection model not available. Check bundled weights.",
        )

    try:
        payload = await file.read()
        page_image = Image.open(BytesIO(payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Invalid image file") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Failed to read the uploaded file") from exc

    try:
        regions = json.loads(regions_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON in regions_json: {exc}") from exc

    if not regions:
        return {"predictions": []}

    page_w, page_h = page_image.size
    cropped_images: list[Image.Image] = []
    original_widths: list[int] = []
    valid_regions: list[dict[str, Any]] = []

    for region in regions:
        x = max(0, int(region.get("x", 0)))
        y = max(0, int(region.get("y", 0)))
        w = int(region.get("w", 0))
        h = int(region.get("h", 0))
        if w <= 0 or h <= 0:
            continue
        x2 = min(x + w, page_w)
        y2 = min(y + h, page_h)
        if x2 <= x or y2 <= y:
            continue
        crop = page_image.crop((x, y, x2, y2))
        cropped_images.append(crop)
        original_widths.append(page_w)
        valid_regions.append(region)

    if not cropped_images:
        return {"predictions": []}

    try:
        detector = _get_detector()
        predictions = detector.detect(cropped_images, original_widths=original_widths, top_k=top_k)
    except Exception as exc:
        logger.exception("Font style detection failed")
        raise HTTPException(status_code=500, detail=f"Style detection failed: {exc}") from exc

    results: list[dict[str, Any]] = []
    for region, pred in zip(valid_regions, predictions):
        results.append({
            "region_id": str(region.get("id", "")),
            **pred.to_dict(),
        })

    return {"predictions": results}
