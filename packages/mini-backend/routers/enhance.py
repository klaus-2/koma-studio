from __future__ import annotations

from io import BytesIO

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
import onnxruntime as ort
from PIL import Image, UnidentifiedImageError

from core.device import build_cpu_device_info, build_device_payload, get_device_info, release_gpu_memory
from core.runtime_errors import build_runtime_error_detail, is_insufficient_memory_error
from models.enhance.factory import get_enhancer, list_enhancement_models


router = APIRouter(tags=["enhance"])


def _normalize_output_format(value: str | None) -> tuple[str, str]:
    normalized = (value or "png").strip().lower()
    if normalized not in {"png", "webp"}:
        raise HTTPException(status_code=400, detail="Invalid output format. Use png or webp.")
    return normalized, "image/png" if normalized == "png" else "image/webp"


@router.get("/enhance/models")
async def enhance_models():
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": list_enhancement_models(has_gpu=device.has_gpu),
    }


@router.post("/enhance")
async def enhance(
    file: UploadFile = File(...),
    model_key: str | None = Form(None),
    output_format: str | None = Form("png"),
):
    device = get_device_info()
    resolved_output_format, media_type = _normalize_output_format(output_format)

    try:
        payload = await file.read()
        image = Image.open(BytesIO(payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Invalid image file") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Failed to read the uploaded file") from exc

    rgb_image = np.array(image)
    if rgb_image.ndim != 3 or rgb_image.shape[2] != 3:
        raise HTTPException(status_code=400, detail="The uploaded image is not valid RGB")

    try:
        enhancer = get_enhancer(
            has_gpu=device.has_gpu,
            model_key=model_key,
            device_info=device,
        )
        enhanced_rgb = await enhancer.enhance(rgb_image)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        release_gpu_memory()
        if device.has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(device, fallback_reason="gpu_runtime_out_of_memory")
            try:
                enhancer = get_enhancer(
                    has_gpu=False,
                    model_key=model_key,
                    device_info=cpu_device,
                )
                enhanced_rgb = await enhancer.enhance(rgb_image)
                extension = ".png" if resolved_output_format == "png" else ".webp"
                encode_params: list[int] = []
                if resolved_output_format == "webp":
                    encode_params = [cv2.IMWRITE_WEBP_QUALITY, 95]
                ok, encoded = cv2.imencode(extension, cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGR), encode_params)
                if not ok:
                    raise HTTPException(status_code=500, detail="Failed to encode the enhanced image")
                return StreamingResponse(
                    BytesIO(encoded.tobytes()),
                    media_type=media_type,
                    headers={
                        "X-Enhance-Model": enhancer.key,
                        "X-Enhance-Scale": str(enhancer.scale),
                        "X-Koma-Execution-Fallback": "gpu_oom_to_cpu",
                        "X-Koma-Execution-Stage": "enhance",
                        "X-Koma-Execution-Model": enhancer.key,
                    },
                )
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="enhance",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
        else:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        release_gpu_memory()
        if device.has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(device, fallback_reason="gpu_runtime_out_of_memory")
            try:
                enhancer = get_enhancer(
                    has_gpu=False,
                    model_key=model_key,
                    device_info=cpu_device,
                )
                enhanced_rgb = await enhancer.enhance(rgb_image)
                extension = ".png" if resolved_output_format == "png" else ".webp"
                encode_params: list[int] = []
                if resolved_output_format == "webp":
                    encode_params = [cv2.IMWRITE_WEBP_QUALITY, 95]
                ok, encoded = cv2.imencode(extension, cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGR), encode_params)
                if not ok:
                    raise HTTPException(status_code=500, detail="Failed to encode the enhanced image")
                return StreamingResponse(
                    BytesIO(encoded.tobytes()),
                    media_type=media_type,
                    headers={
                        "X-Enhance-Model": enhancer.key,
                        "X-Enhance-Scale": str(enhancer.scale),
                        "X-Koma-Execution-Fallback": "gpu_oom_to_cpu",
                        "X-Koma-Execution-Stage": "enhance",
                        "X-Koma-Execution-Model": enhancer.key,
                    },
                )
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="enhance",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
        else:
            raise HTTPException(status_code=500, detail=f"Failed to enhance the image: {exc}") from exc
    else:
        release_gpu_memory()

    extension = ".png" if resolved_output_format == "png" else ".webp"
    encode_params: list[int] = []
    if resolved_output_format == "webp":
        encode_params = [cv2.IMWRITE_WEBP_QUALITY, 95]
    ok, encoded = cv2.imencode(extension, cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGR), encode_params)
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode the enhanced image")

    return StreamingResponse(
        BytesIO(encoded.tobytes()),
        media_type=media_type,
        headers={
            "X-Enhance-Model": enhancer.key,
            "X-Enhance-Scale": str(enhancer.scale),
        },
    )


@router.post("/enhance/validate-model")
async def validate_enhance_model(file: UploadFile = File(...)) -> dict[str, object]:
    try:
        payload = await file.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Failed to read the uploaded ONNX file") from exc

    if not payload:
        raise HTTPException(status_code=400, detail="Empty ONNX file")

    try:
        session = ort.InferenceSession(payload, providers=["CPUExecutionProvider"])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid ONNX file: {exc}") from exc

    inputs = [
        {
            "name": item.name,
            "shape": list(item.shape) if isinstance(item.shape, (list, tuple)) else item.shape,
            "type": item.type,
        }
        for item in session.get_inputs()
    ]
    outputs = [
        {
            "name": item.name,
            "shape": list(item.shape) if isinstance(item.shape, (list, tuple)) else item.shape,
            "type": item.type,
        }
        for item in session.get_outputs()
    ]
    return {
        "ok": True,
        "inputs": inputs,
        "outputs": outputs,
    }
