from __future__ import annotations

from io import BytesIO

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from PIL import Image, UnidentifiedImageError

from core.config import get_config
from core.device import build_cpu_device_info, build_device_payload, get_device_info, release_gpu_memory
from core.runtime_errors import build_runtime_error_detail, is_insufficient_memory_error
from models.detection.factory import get_detector, list_detection_models
from schemas.detection import DetectionBox, DetectionResponse
from utils.detection_fallback import detect_with_fallbacks


router = APIRouter(tags=["detection"])


@router.get("/detect/models")
async def detect_models():
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": list_detection_models(has_gpu=device.has_gpu),
    }


@router.post("/detect", response_model=DetectionResponse)
async def detect_text(
    response: Response,
    file: UploadFile = File(...),
    model_key: str | None = Form(None),
    confidence_threshold: float | None = Form(None),
    nms_threshold: float | None = Form(None),
    use_gpu: str | None = Form(None),
):
    config = get_config()
    device = get_device_info()
    effective_has_gpu = device.has_gpu if use_gpu is None else use_gpu.lower() not in ("false", "0", "no")

    try:
        payload = await file.read()
        image = Image.open(BytesIO(payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Invalid image file") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Failed to read the uploaded file") from exc

    execution_device = device
    try:
        detector = get_detector(
            task="text",
            has_gpu=effective_has_gpu,
            model_key=model_key,
            confidence=confidence_threshold,
            nms_threshold=nms_threshold,
            device_info=device,
        )
        detections, detection_variant = await detect_with_fallbacks(
            image,
            lambda variant_image: detector.detect(variant_image),
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        release_gpu_memory()
        if effective_has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(device, fallback_reason="gpu_runtime_out_of_memory")
            try:
                detector = get_detector(
                    task="text",
                    has_gpu=False,
                    model_key=model_key,
                    confidence=confidence_threshold,
                    nms_threshold=nms_threshold,
                    device_info=cpu_device,
                )
                detections, detection_variant = await detect_with_fallbacks(
                    image,
                    lambda variant_image: detector.detect(variant_image),
                )
                execution_device = cpu_device
                response.headers["X-Koma-Execution-Fallback"] = "gpu_oom_to_cpu"
                response.headers["X-Koma-Execution-Stage"] = "detect"
                response.headers["X-Koma-Execution-Model"] = detector.key
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="detect",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
        else:
            raise HTTPException(status_code=500, detail=f"Text detection failed: {exc}") from exc
    else:
        release_gpu_memory()

    response_boxes: list[DetectionBox] = []
    resolved_model = model_key or config.default_detection_model
    for idx, det in enumerate(detections, start=1):
        current_model = det.model_key or resolved_model
        resolved_model = current_model
        response_boxes.append(
            DetectionBox(
                id=f"det-{idx}",
                bbox=[int(v) for v in det.bbox],
                score=round(float(det.score), 4),
                label=det.label,
                source="model",
                model_key=current_model,
                foreground_rgb=(
                    [int(channel) for channel in det.foreground_rgb]
                    if det.foreground_rgb is not None
                    else None
                ),
                structural_type=getattr(det, "structural_type", None),
                structural_confidence=getattr(det, "structural_confidence", None),
                structural_source=getattr(det, "structural_source", None),
                matched_reference_image=getattr(det, "matched_reference_image", None),
            ),
        )

    return DetectionResponse(
        device=execution_device.name,
        model_used=resolved_model if detection_variant == "original" else f"{resolved_model}@{detection_variant}",
        image_width=image.width,
        image_height=image.height,
        detections=response_boxes,
    )
