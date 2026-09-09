from __future__ import annotations

import json
from io import BytesIO

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from core.config import get_config
from core.device import (
    build_cpu_device_info,
    build_device_payload,
    get_device_info,
    release_gpu_memory,
)
from core.runtime_errors import build_runtime_error_detail, is_insufficient_memory_error
from models.detection.factory import get_detector
from models.inpainting.base_inpainter import HDStrategy, InpaintConfig
from models.inpainting.factory import get_inpainter, list_inpainting_models
from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.factory import get_segmenter
from schemas.inpainting import InpaintRegionRequest
from utils.inpaint_heuristics import apply_need_inpaint_heuristic
from utils.mask import MaskRegion, generate_baka_style_mask


router = APIRouter(tags=["inpainting"])


def _clamp_int(value: int | None, fallback: int, minimum: int, maximum: int) -> int:
    if value is None:
        return fallback
    return max(minimum, min(maximum, int(value)))


def _parse_regions(raw_regions: str | None) -> list[InpaintRegionRequest]:
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

    parsed: list[InpaintRegionRequest] = []
    for item in payload:
        try:
            parsed.append(InpaintRegionRequest.model_validate(item))
        except ValidationError as exc:
            raise HTTPException(
                status_code=400, detail=f"Invalid region: {exc}"
            ) from exc
    return parsed


async def _auto_detect_regions(
    image: Image.Image,
    image_bytes: bytes,
    has_gpu: bool,
) -> list[InpaintRegionRequest]:
    detector = get_detector(
        task="text",
        has_gpu=has_gpu,
        model_key=get_config().default_detection_model,
    )
    detections = await detector.detect(image)
    if not detections:
        return []

    base_regions: list[InpaintRegionRequest] = [
        InpaintRegionRequest(
            id=f"det-{idx}",
            bbox=(
                int(det.bbox[0]),
                int(det.bbox[1]),
                int(det.bbox[2]),
                int(det.bbox[3]),
            ),
            source="model",
            detector_model_key=det.model_key or get_config().default_detection_model,
        )
        for idx, det in enumerate(detections, start=1)
    ]

    try:
        segmenter = get_segmenter(
            has_gpu=has_gpu, model_key="baka_content_cc"
        )
        segment_inputs = [
            SegmentInputRegion(
                id=item.id,
                bbox=item.bbox,
                source=item.source,
                detector_model_key=item.detector_model_key,
                ocr_model_key=item.ocr_model_key,
                translator_model_key=item.translator_model_key,
            )
            for item in base_regions
        ]
        segmented = await segmenter.segment(
            image_bytes=image_bytes, regions=segment_inputs
        )
        by_id = {region.id: region for region in segmented}
    except Exception:
        by_id = {}

    enriched: list[InpaintRegionRequest] = []
    for item in base_regions:
        match = by_id.get(item.id)
        if match is None:
            enriched.append(item)
            continue
        enriched.append(
            InpaintRegionRequest(
                id=item.id,
                bbox=item.bbox,
                source=item.source,
                detector_model_key=item.detector_model_key,
                ocr_model_key=item.ocr_model_key,
                translator_model_key=item.translator_model_key,
                segment_model_key=match.segment_model_key,
                segment_boxes=[tuple(box) for box in match.segment_boxes],
                merged_boxes=[tuple(box) for box in match.merged_boxes],
                mask_base64=match.mask_base64,
            )
        )
    return enriched


def _regions_to_mask_regions(regions: list[InpaintRegionRequest]) -> list[MaskRegion]:
    return [
        MaskRegion(
            bbox=tuple(int(v) for v in region.bbox),
            segment_boxes=[tuple(int(v) for v in box) for box in region.segment_boxes],
            merged_boxes=[tuple(int(v) for v in box) for box in region.merged_boxes],
            mask_base64=region.mask_base64,
        )
        for region in regions
    ]


@router.get("/inpaint/models")
async def inpaint_models():
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": list_inpainting_models(has_gpu=device.has_gpu),
    }


@router.post("/inpaint")
async def inpaint(
    file: UploadFile = File(...),
    brush_mask: UploadFile | None = File(None),
    model_key: str | None = Form(None),
    regions: str | None = Form(None),
    mask_dilation: int | None = Form(None),
    hd_strategy: str | None = Form(None),
    hd_strategy_resize_limit: int | None = Form(None),
    hd_strategy_crop_margin: int | None = Form(None),
    hd_strategy_crop_trigger_size: int | None = Form(None),
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
    has_brush_mask = brush_mask is not None and bool(brush_mask.filename)
    # Only run auto-detection when the client provided neither explicit regions nor a brush mask.
    # If the client sent an explicit (possibly empty) regions list OR a brush mask, respect that.
    if not parsed_regions and not has_brush_mask and regions is None:
        parsed_regions = await _auto_detect_regions(
            image=image,
            image_bytes=payload,
            has_gpu=effective_has_gpu,
        )

    rgb_image = np.array(image)
    if rgb_image.ndim != 3 or rgb_image.shape[2] != 3:
        raise HTTPException(
            status_code=400, detail="The uploaded image is not valid RGB"
        )

    if not parsed_regions and not has_brush_mask:
        ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR))
        if not ok:
            raise HTTPException(status_code=500, detail="Failed to encode the image")
        return StreamingResponse(BytesIO(encoded.tobytes()), media_type="image/png")

    dilation = _clamp_int(mask_dilation, fallback=5, minimum=0, maximum=50)

    # Generate mask from regions (automatic segment + pixel-accurate masks from segmenter)
    region_mask = generate_baka_style_mask(
        image_width=rgb_image.shape[1],
        image_height=rgb_image.shape[0],
        regions=_regions_to_mask_regions(parsed_regions),
        mask_dilation=dilation,
    )

    if has_brush_mask:
        try:
            brush_payload = await brush_mask.read()
            brush_image = Image.open(BytesIO(brush_payload)).convert("L")
            brush_np = np.array(brush_image)
            if (
                brush_np.shape[0] != rgb_image.shape[0]
                or brush_np.shape[1] != rgb_image.shape[1]
            ):
                brush_np = cv2.resize(
                    brush_np,
                    (rgb_image.shape[1], rgb_image.shape[0]),
                    interpolation=cv2.INTER_NEAREST,
                )
            brush_binary = np.where(brush_np > 0, 255, 0).astype(np.uint8)
            # Combine both: automatic segment mask OR manual brush mask
            mask = cv2.bitwise_or(region_mask, brush_binary)
        except Exception:
            mask = region_mask
    else:
        mask = region_mask

    if not np.any(mask):
        ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR))
        if not ok:
            raise HTTPException(status_code=500, detail="Failed to encode the image")
        return StreamingResponse(BytesIO(encoded.tobytes()), media_type="image/png")

    heuristic = apply_need_inpaint_heuristic(rgb_image, mask)
    if not heuristic.needs_model_inpaint:
        ok, encoded = cv2.imencode(
            ".png", cv2.cvtColor(heuristic.image_rgb, cv2.COLOR_RGB2BGR)
        )
        if not ok:
            raise HTTPException(
                status_code=500, detail="Failed to encode the processed image"
            )
        return StreamingResponse(
            BytesIO(encoded.tobytes()),
            media_type="image/png",
            headers={
                "X-Inpaint-Model": heuristic.method_label,
                "X-Mask-Dilation": str(dilation),
                "X-HD-Strategy": "solid-fill",
            },
        )

    inpaint_config = InpaintConfig(
        hd_strategy=HDStrategy.from_value(
            hd_strategy if hd_strategy is not None else HDStrategy.RESIZE.value
        ),
        hd_strategy_resize_limit=_clamp_int(
            hd_strategy_resize_limit, fallback=960, minimum=256, maximum=4096
        ),
        hd_strategy_crop_margin=_clamp_int(
            hd_strategy_crop_margin, fallback=512, minimum=0, maximum=4096
        ),
        hd_strategy_crop_trigger_size=_clamp_int(
            hd_strategy_crop_trigger_size, fallback=512, minimum=64, maximum=4096
        ),
    )

    try:
        inpainter = get_inpainter(
            has_gpu=effective_has_gpu,
            image_complexity="auto",
            model_key=model_key,
            device_info=device,
        )
        inpainted_rgb = await inpainter.inpaint(
            heuristic.image_rgb, heuristic.remaining_mask, inpaint_config
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        release_gpu_memory()
        if effective_has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(
                device, fallback_reason="gpu_runtime_out_of_memory"
            )
            try:
                inpainter = get_inpainter(
                    has_gpu=False,
                    image_complexity="auto",
                    model_key=model_key,
                    device_info=cpu_device,
                )
                inpainted_rgb = await inpainter.inpaint(
                    heuristic.image_rgb, heuristic.remaining_mask, inpaint_config
                )
                ok, encoded = cv2.imencode(
                    ".png", cv2.cvtColor(inpainted_rgb, cv2.COLOR_RGB2BGR)
                )
                if not ok:
                    raise HTTPException(
                        status_code=500, detail="Failed to encode the processed image"
                    )
                model_used = (
                    inpainter.key
                    if heuristic.filled_components == 0
                    else f"hybrid:{inpainter.key}"
                )
                return StreamingResponse(
                    BytesIO(encoded.tobytes()),
                    media_type="image/png",
                    headers={
                        "X-Inpaint-Model": model_used,
                        "X-Mask-Dilation": str(dilation),
                        "X-HD-Strategy": inpaint_config.hd_strategy.value,
                        "X-Koma-Execution-Fallback": "gpu_oom_to_cpu",
                        "X-Koma-Execution-Stage": "inpaint",
                        "X-Koma-Execution-Model": inpainter.key,
                    },
                )
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="inpaint",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        release_gpu_memory()
        if effective_has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(
                device, fallback_reason="gpu_runtime_out_of_memory"
            )
            try:
                inpainter = get_inpainter(
                    has_gpu=False,
                    image_complexity="auto",
                    model_key=model_key,
                    device_info=cpu_device,
                )
                inpainted_rgb = await inpainter.inpaint(
                    heuristic.image_rgb, heuristic.remaining_mask, inpaint_config
                )
                ok, encoded = cv2.imencode(
                    ".png", cv2.cvtColor(inpainted_rgb, cv2.COLOR_RGB2BGR)
                )
                if not ok:
                    raise HTTPException(
                        status_code=500, detail="Failed to encode the processed image"
                    )
                model_used = (
                    inpainter.key
                    if heuristic.filled_components == 0
                    else f"hybrid:{inpainter.key}"
                )
                return StreamingResponse(
                    BytesIO(encoded.tobytes()),
                    media_type="image/png",
                    headers={
                        "X-Inpaint-Model": model_used,
                        "X-Mask-Dilation": str(dilation),
                        "X-HD-Strategy": inpaint_config.hd_strategy.value,
                        "X-Koma-Execution-Fallback": "gpu_oom_to_cpu",
                        "X-Koma-Execution-Stage": "inpaint",
                        "X-Koma-Execution-Model": inpainter.key,
                    },
                )
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="inpaint",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
        raise HTTPException(
            status_code=500, detail=f"Inpainting failed: {exc}"
        ) from exc
    else:
        release_gpu_memory()

    ok, encoded = cv2.imencode(".png", cv2.cvtColor(inpainted_rgb, cv2.COLOR_RGB2BGR))
    if not ok:
        raise HTTPException(
            status_code=500, detail="Failed to encode the processed image"
        )

    return StreamingResponse(
        BytesIO(encoded.tobytes()),
        media_type="image/png",
        headers={
            "X-Inpaint-Model": inpainter.key
            if heuristic.filled_components == 0
            else f"hybrid:{inpainter.key}",
            "X-Mask-Dilation": str(dilation),
            "X-HD-Strategy": inpaint_config.hd_strategy.value,
        },
    )


@router.post("/inpaint-mask")
async def inpaint_with_mask(
    file: UploadFile = File(...),
    mask: UploadFile = File(...),
    model_key: str | None = Form(None),
    mask_dilation: int | None = Form(None),
    hd_strategy: str | None = Form(None),
    hd_strategy_resize_limit: int | None = Form(None),
    hd_strategy_crop_margin: int | None = Form(None),
    hd_strategy_crop_trigger_size: int | None = Form(None),
    use_gpu: str | None = Form(None),
):
    device = get_device_info()
    effective_has_gpu = (
        device.has_gpu
        if use_gpu is None
        else use_gpu.lower() not in ("false", "0", "no")
    )

    try:
        image_payload = await file.read()
        image = Image.open(BytesIO(image_payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid image file"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Failed to read the uploaded file"
        ) from exc

    try:
        mask_payload = await mask.read()
        mask_image = Image.open(BytesIO(mask_payload)).convert("L")
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid mask file"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Failed to read the uploaded mask"
        ) from exc

    rgb_image = np.array(image)
    if rgb_image.ndim != 3 or rgb_image.shape[2] != 3:
        raise HTTPException(
            status_code=400, detail="The uploaded image is not valid RGB"
        )

    mask_np = np.array(mask_image)
    if mask_np.ndim != 2:
        raise HTTPException(
            status_code=400, detail="The uploaded mask is not in a valid format"
        )

    if mask_np.shape[0] != rgb_image.shape[0] or mask_np.shape[1] != rgb_image.shape[1]:
        mask_np = cv2.resize(
            mask_np,
            (rgb_image.shape[1], rgb_image.shape[0]),
            interpolation=cv2.INTER_NEAREST,
        )

    mask_binary = np.where(mask_np > 0, 255, 0).astype(np.uint8)
    dilation = _clamp_int(mask_dilation, fallback=0, minimum=0, maximum=64)
    if dilation > 0:
        kernel_size = max(1, (dilation * 2) + 1)
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (kernel_size, kernel_size)
        )
        mask_binary = cv2.dilate(mask_binary, kernel, iterations=1)

    if not np.any(mask_binary):
        ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb_image, cv2.COLOR_RGB2BGR))
        if not ok:
            raise HTTPException(status_code=500, detail="Failed to encode the image")
        return StreamingResponse(BytesIO(encoded.tobytes()), media_type="image/png")

    heuristic = apply_need_inpaint_heuristic(rgb_image, mask_binary)
    if not heuristic.needs_model_inpaint:
        ok, encoded = cv2.imencode(
            ".png", cv2.cvtColor(heuristic.image_rgb, cv2.COLOR_RGB2BGR)
        )
        if not ok:
            raise HTTPException(
                status_code=500, detail="Failed to encode the processed image"
            )
        return StreamingResponse(
            BytesIO(encoded.tobytes()),
            media_type="image/png",
            headers={
                "X-Inpaint-Model": heuristic.method_label,
                "X-Mask-Dilation": str(dilation),
                "X-HD-Strategy": "solid-fill",
            },
        )

    inpaint_config = InpaintConfig(
        hd_strategy=HDStrategy.from_value(
            hd_strategy if hd_strategy is not None else HDStrategy.RESIZE.value
        ),
        hd_strategy_resize_limit=_clamp_int(
            hd_strategy_resize_limit, fallback=960, minimum=256, maximum=4096
        ),
        hd_strategy_crop_margin=_clamp_int(
            hd_strategy_crop_margin, fallback=512, minimum=0, maximum=4096
        ),
        hd_strategy_crop_trigger_size=_clamp_int(
            hd_strategy_crop_trigger_size, fallback=512, minimum=64, maximum=4096
        ),
    )

    try:
        inpainter = get_inpainter(
            has_gpu=effective_has_gpu,
            image_complexity="auto",
            model_key=model_key,
            device_info=device,
        )
        inpainted_rgb = await inpainter.inpaint(
            heuristic.image_rgb, heuristic.remaining_mask, inpaint_config
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        release_gpu_memory()
        if effective_has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(
                device, fallback_reason="gpu_runtime_out_of_memory"
            )
            try:
                inpainter = get_inpainter(
                    has_gpu=False,
                    image_complexity="auto",
                    model_key=model_key,
                    device_info=cpu_device,
                )
                inpainted_rgb = await inpainter.inpaint(
                    heuristic.image_rgb, heuristic.remaining_mask, inpaint_config
                )
                ok, encoded = cv2.imencode(
                    ".png", cv2.cvtColor(inpainted_rgb, cv2.COLOR_RGB2BGR)
                )
                if not ok:
                    raise HTTPException(
                        status_code=500, detail="Failed to encode the processed image"
                    )
                model_used = (
                    inpainter.key
                    if heuristic.filled_components == 0
                    else f"hybrid:{inpainter.key}"
                )
                return StreamingResponse(
                    BytesIO(encoded.tobytes()),
                    media_type="image/png",
                    headers={
                        "X-Inpaint-Model": model_used,
                        "X-Mask-Dilation": str(dilation),
                        "X-HD-Strategy": inpaint_config.hd_strategy.value,
                        "X-Koma-Execution-Fallback": "gpu_oom_to_cpu",
                        "X-Koma-Execution-Stage": "inpaint",
                        "X-Koma-Execution-Model": inpainter.key,
                    },
                )
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="inpaint",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        release_gpu_memory()
        if effective_has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(
                device, fallback_reason="gpu_runtime_out_of_memory"
            )
            try:
                inpainter = get_inpainter(
                    has_gpu=False,
                    image_complexity="auto",
                    model_key=model_key,
                    device_info=cpu_device,
                )
                inpainted_rgb = await inpainter.inpaint(
                    heuristic.image_rgb, heuristic.remaining_mask, inpaint_config
                )
                ok, encoded = cv2.imencode(
                    ".png", cv2.cvtColor(inpainted_rgb, cv2.COLOR_RGB2BGR)
                )
                if not ok:
                    raise HTTPException(
                        status_code=500, detail="Failed to encode the processed image"
                    )
                model_used = (
                    inpainter.key
                    if heuristic.filled_components == 0
                    else f"hybrid:{inpainter.key}"
                )
                return StreamingResponse(
                    BytesIO(encoded.tobytes()),
                    media_type="image/png",
                    headers={
                        "X-Inpaint-Model": model_used,
                        "X-Mask-Dilation": str(dilation),
                        "X-HD-Strategy": inpaint_config.hd_strategy.value,
                        "X-Koma-Execution-Fallback": "gpu_oom_to_cpu",
                        "X-Koma-Execution-Stage": "inpaint",
                        "X-Koma-Execution-Model": inpainter.key,
                    },
                )
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="inpaint",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
        raise HTTPException(
            status_code=500, detail=f"Inpainting failed: {exc}"
        ) from exc
    else:
        release_gpu_memory()

    ok, encoded = cv2.imencode(".png", cv2.cvtColor(inpainted_rgb, cv2.COLOR_RGB2BGR))
    if not ok:
        raise HTTPException(
            status_code=500, detail="Failed to encode the processed image"
        )

    return StreamingResponse(
        BytesIO(encoded.tobytes()),
        media_type="image/png",
        headers={
            "X-Inpaint-Model": inpainter.key
            if heuristic.filled_components == 0
            else f"hybrid:{inpainter.key}",
            "X-Mask-Dilation": str(dilation),
            "X-HD-Strategy": inpaint_config.hd_strategy.value,
        },
    )
