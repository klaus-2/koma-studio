from __future__ import annotations

import json
from io import BytesIO

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from core.device import build_device_payload, get_device_info, release_gpu_memory
from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.factory import get_segmenter, list_segmentation_models
from schemas.segmentation import (
    SegmentRegionRequest,
    SegmentRegionResult,
    SegmentResponse,
)


router = APIRouter(tags=["segmentation"])


@router.get("/segment/models")
async def segment_models():
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": list_segmentation_models(has_gpu=device.has_gpu),
    }


def _parse_regions(raw_regions: str | None) -> list[SegmentRegionRequest]:
    if not raw_regions:
        return []
    try:
        payload = json.loads(raw_regions)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid regions field (JSON)"
        ) from exc
    if not isinstance(payload, list):
        raise HTTPException(
            status_code=400, detail="The regions field must be a JSON list"
        )

    parsed: list[SegmentRegionRequest] = []
    for item in payload:
        try:
            parsed.append(SegmentRegionRequest.model_validate(item))
        except ValidationError as exc:
            raise HTTPException(
                status_code=400, detail=f"Invalid region: {exc}"
            ) from exc
    return parsed


@router.post("/segment", response_model=SegmentResponse)
async def segment_text(
    file: UploadFile = File(...),
    model_key: str | None = Form(None),
    regions: str | None = Form(None),
    use_gpu: str | None = Form(None),
):
    device = get_device_info()
    effective_has_gpu = (
        device.has_gpu
        if use_gpu is None
        else use_gpu.lower() not in ("false", "0", "no")
    )

    try:
        payload = await file.read()
        image = Image.open(BytesIO(payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid image file"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Failed to read the uploaded file"
        ) from exc

    parsed_regions = _parse_regions(regions)
    if not parsed_regions:
        raise HTTPException(
            status_code=400, detail="No region was provided for segmentation"
        )

    input_regions = [
        SegmentInputRegion(
            id=region.id,
            bbox=tuple(int(v) for v in region.bbox),
            source=region.source,
            detector_model_key=region.detector_model_key,
            ocr_model_key=region.ocr_model_key,
            translator_model_key=region.translator_model_key,
        )
        for region in parsed_regions
    ]

    try:
        segmenter = get_segmenter(
            has_gpu=effective_has_gpu,
            model_key=model_key,
        )
        segment_results = await segmenter.segment(
            image_bytes=payload,
            regions=input_regions,
        )
    except RuntimeError as exc:
        release_gpu_memory()
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        release_gpu_memory()
        raise HTTPException(
            status_code=500, detail=f"Segmentation failed: {exc}"
        ) from exc
    else:
        release_gpu_memory()

    response_regions = [
        SegmentRegionResult(
            id=result.id,
            bbox=[int(v) for v in result.bbox],
            segment_boxes=[[int(p) for p in box] for box in result.segment_boxes],
            merged_boxes=[[int(p) for p in box] for box in result.merged_boxes],
            source=result.source if result.source in {"model", "manual"} else "model",
            detector_model_key=result.detector_model_key,
            ocr_model_key=result.ocr_model_key,
            translator_model_key=result.translator_model_key,
            segment_model_key=result.segment_model_key or (model_key or segmenter.key),
            mask_base64=result.mask_base64,
        )
        for result in segment_results
    ]

    return SegmentResponse(
        device=device.name,
        model_used=segmenter.key,
        image_width=image.width,
        image_height=image.height,
        regions=response_regions,
    )
