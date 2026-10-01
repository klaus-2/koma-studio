"""Image enhancement (super-resolution) endpoints."""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from typing import Annotated, Final, Literal

import cv2
import numpy as np
import onnxruntime as ort
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile, status
from pydantic import BaseModel

from core.device import DeviceInfo, build_device_payload, get_device_info
from models.enhance.factory import get_enhancer, list_enhancement_models
from routers._boundary import execution_error_to_http, read_rgb_upload, read_upload_bytes
from services.device_fallback import (
    ExecutionError,
    ExecutionFailedError,
    resolve_use_gpu,
    run_with_cpu_fallback,
)
from utils.image_codec import RGBImage

router = APIRouter(tags=["enhance"])
STAGE: Final = "enhance"

type OutputFormat = Literal["png", "webp"]

_MEDIA_TYPES: Final[dict[OutputFormat, str]] = {"png": "image/png", "webp": "image/webp"}
_ENCODE_PARAMS: Final[dict[OutputFormat, list[int]]] = {
    "png": [],
    "webp": [cv2.IMWRITE_WEBP_QUALITY, 95],
}
# swin-unet 4x weights exceed 100MB; this endpoint only introspects, it never keeps the session.
_ONNX_UPLOAD_LIMIT_BYTES: Final = 512 * 1024 * 1024
_ONNX_ERROR_PREVIEW_CHARS: Final = 500


class ImageEncodeError(Exception):
    """cv2.imencode returned failure for a valid image buffer."""


class OnnxTensorSpec(BaseModel):
    name: str
    shape: list[int | str | None]
    type: str


class OnnxModelValidation(BaseModel):
    ok: bool
    inputs: list[OnnxTensorSpec]
    outputs: list[OnnxTensorSpec]


def _encode_rgb(rgb: RGBImage, output_format: OutputFormat) -> bytes:
    ok, encoded = cv2.imencode(
        f".{output_format}", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR), _ENCODE_PARAMS[output_format]
    )
    if not ok:
        raise ImageEncodeError(f"cv2 could not encode {output_format}")
    return encoded.tobytes()


@router.get("/enhance/models")
async def enhance_models() -> dict[str, object]:
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": list_enhancement_models(has_gpu=device.has_gpu),
    }


@router.post(
    "/enhance",
    response_class=Response,
    responses={200: {"content": {"image/png": {}, "image/webp": {}}}},
)
async def enhance(
    file: Annotated[UploadFile, File()],
    model_key: Annotated[str | None, Form()] = None,
    output_format: Annotated[OutputFormat, Form()] = "png",
    use_gpu: Annotated[bool | None, Form()] = None,
) -> Response:
    device = get_device_info()
    _, rgb_image = await read_rgb_upload(file)

    async def run(execution_device: DeviceInfo, has_gpu: bool) -> tuple[RGBImage, str, int]:
        enhancer = get_enhancer(has_gpu=has_gpu, model_key=model_key, device_info=execution_device)
        enhanced = await enhancer.enhance(rgb_image)
        return enhanced, enhancer.key, enhancer.scale

    try:
        outcome = await run_with_cpu_fallback(
            run, device=device, use_gpu=resolve_use_gpu(device, use_gpu), stage=STAGE
        )
    except FileNotFoundError as exc:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except ExecutionError as exc:
        # Enhancers reject unsupported inputs (tile size, channel layout) with
        # RuntimeError; the existing client contract surfaces those as 400.
        if isinstance(exc, ExecutionFailedError) and isinstance(exc.original, RuntimeError):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc.original)) from exc
        raise execution_error_to_http(exc, model_key=model_key) from exc

    enhanced_rgb, enhancer_key, scale = outcome.result
    try:
        encoded = await asyncio.to_thread(_encode_rgb, enhanced_rgb, output_format)
    except ImageEncodeError as exc:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to encode the enhanced image"
        ) from exc

    return Response(
        content=encoded,
        media_type=_MEDIA_TYPES[output_format],
        headers={
            "X-Enhance-Model": enhancer_key,
            "X-Enhance-Scale": str(scale),
            **outcome.fallback_headers(model_key=enhancer_key),
        },
    )


def _tensor_specs(nodes: Sequence[ort.NodeArg]) -> list[OnnxTensorSpec]:
    return [OnnxTensorSpec(name=node.name, shape=list(node.shape), type=node.type) for node in nodes]


@router.post("/enhance/validate-model", response_model=OnnxModelValidation)
async def validate_enhance_model(file: Annotated[UploadFile, File()]) -> OnnxModelValidation:
    payload = await read_upload_bytes(file, limit_bytes=_ONNX_UPLOAD_LIMIT_BYTES, label="ONNX file")
    if not payload:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Empty ONNX file")

    try:
        session = await asyncio.to_thread(
            ort.InferenceSession, payload, providers=["CPUExecutionProvider"]
        )
    # onnxruntime raises pybind-generated types (InvalidProtobuf, InvalidGraph,
    # Fail, ...) that share no importable base; the message is the user's only
    # diagnostic for a malformed model, so it is forwarded truncated.
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid ONNX file: {str(exc)[:_ONNX_ERROR_PREVIEW_CHARS]}",
        ) from exc

    return OnnxModelValidation(
        ok=True,
        inputs=_tensor_specs(session.get_inputs()),
        outputs=_tensor_specs(session.get_outputs()),
    )
