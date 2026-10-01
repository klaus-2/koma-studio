"""Text detection endpoints."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Annotated, Final, cast

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status
from PIL import Image

from core.config import get_config
from core.device import DeviceInfo, build_device_payload, get_device_info
from models.detection.base_detector import TextDetection
from models.detection.factory import get_detector, list_detection_models
from routers._boundary import execution_error_to_http, read_rgb_upload
from schemas.detection import DetectionBox, DetectionResponse
from services.device_fallback import ExecutionError, resolve_use_gpu, run_with_cpu_fallback
from utils.detection_fallback import detect_with_fallbacks

router = APIRouter(tags=["detection"])
STAGE: Final = "detect"


@router.get("/detect/models")
async def detect_models() -> dict[str, object]:
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": list_detection_models(has_gpu=device.has_gpu),
    }


@router.post("/detect", response_model=DetectionResponse)
async def detect_text(
    response: Response,
    file: Annotated[UploadFile, File()],
    model_key: Annotated[str | None, Form()] = None,
    confidence_threshold: Annotated[float | None, Form(ge=0.0, le=1.0)] = None,
    nms_threshold: Annotated[float | None, Form(ge=0.0, le=1.0)] = None,
    use_gpu: Annotated[bool | None, Form()] = None,
) -> DetectionResponse:
    device = get_device_info()
    _, rgb_image = await read_rgb_upload(file)
    image = Image.fromarray(rgb_image)

    async def run(execution_device: DeviceInfo, has_gpu: bool) -> tuple[list[TextDetection], str, str]:
        detector = get_detector(
            task="text",
            has_gpu=has_gpu,
            model_key=model_key,
            confidence=confidence_threshold,
            nms_threshold=nms_threshold,
            device_info=execution_device,
        )
        async def run_detection(variant_image: Image.Image) -> list[object]:
            return list(await detector.detect(variant_image))

        detections, variant = await detect_with_fallbacks(image, run_detection)
        # detection_fallback's runner alias is list[object]; narrow at this boundary.
        return list(cast("list[TextDetection]", detections)), variant, detector.key

    try:
        outcome = await run_with_cpu_fallback(
            run, device=device, use_gpu=resolve_use_gpu(device, use_gpu), stage=STAGE
        )
    except FileNotFoundError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ExecutionError as exc:
        raise execution_error_to_http(exc, model_key=model_key) from exc

    detections, detection_variant, detector_key = outcome.result
    response.headers.update(outcome.fallback_headers(model_key=detector_key))

    default_model = model_key or get_config().default_detection_model
    boxes = [
        DetectionBox(
            id=f"det-{index}",
            bbox=[int(v) for v in det.bbox],
            score=round(float(det.score), 4),
            label=det.label,
            source="model",
            model_key=det.model_key or default_model,
            foreground_rgb=(
                None if det.foreground_rgb is None else [int(c) for c in det.foreground_rgb]
            ),
            structural_type=det.structural_type,
            structural_confidence=det.structural_confidence,
            structural_source=det.structural_source,
            matched_reference_image=det.matched_reference_image,
        )
        for index, det in enumerate(detections, start=1)
    ]
    resolved_model = boxes[-1].model_key if boxes else default_model

    return DetectionResponse(
        device=outcome.device.name,
        model_used=(
            resolved_model
            if detection_variant == "original"
            else f"{resolved_model}@{detection_variant}"
        ),
        image_width=image.width,
        image_height=image.height,
        detections=boxes,
    )
