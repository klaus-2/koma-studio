"""HTTP-boundary helpers shared by routers.

Everything that turns raw multipart/JSON input into typed values — and domain
failures into ``HTTPException`` — lives here so routers stay thin adapters.
"""

from __future__ import annotations

import logging
from typing import Final

from fastapi import HTTPException, UploadFile, status
from models.errors import (
    InvalidModelSelectionError,
    MissingDependencyError,
    ModelConfigurationError,
    ModelNotInstalledError,
)
from pydantic import TypeAdapter, ValidationError

from core.runtime_errors import build_runtime_error_detail
from services.device_fallback import CpuFallbackFailedError, ExecutionError, ExecutionFailedError
from utils.image_codec import ImageDecodeError, RGBImage, decode_rgb_async

logger = logging.getLogger(__name__)

_READ_CHUNK_BYTES: Final = 1024 * 1024
DEFAULT_UPLOAD_LIMIT_BYTES: Final = 50 * 1024 * 1024

# Failures the client can fix (wrong model key, missing install, bad config):
# surfaced as 400 with the message instead of a generic 500.
CLIENT_FIXABLE_MODEL_ERRORS: Final = (
    ModelNotInstalledError,
    InvalidModelSelectionError,
    ModelConfigurationError,
    MissingDependencyError,
)


async def read_upload_bytes(
    upload: UploadFile,
    *,
    limit_bytes: int = DEFAULT_UPLOAD_LIMIT_BYTES,
    label: str = "File",
) -> bytes:
    """Read an upload in chunks, failing with 413 as soon as the limit is crossed."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await upload.read(_READ_CHUNK_BYTES):
        total += len(chunk)
        if total > limit_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{label} is too large. Maximum: {limit_bytes // (1024 * 1024)}MB",
            )
        chunks.append(chunk)
    return b"".join(chunks)


async def read_rgb_upload(
    upload: UploadFile,
    *,
    limit_bytes: int = DEFAULT_UPLOAD_LIMIT_BYTES,
    label: str = "Image",
) -> tuple[bytes, RGBImage]:
    payload = await read_upload_bytes(upload, limit_bytes=limit_bytes, label=label)
    if not payload:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"{label} is empty")
    try:
        rgb = await decode_rgb_async(payload)
    except ImageDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=f"{label}: {exc}") from exc
    return payload, rgb


def parse_json_form_field[T](
    raw: str | None, adapter: TypeAdapter[T], *, field_name: str
) -> T | None:
    """Validate a JSON-encoded multipart field; absent/blank → ``None``."""
    if raw is None or not raw.strip():
        return None
    try:
        return adapter.validate_json(raw)
    except ValidationError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": field_name, "errors": exc.errors(include_url=False)},
        ) from exc


def execution_error_to_http(exc: ExecutionError, *, model_key: str | None) -> HTTPException:
    if isinstance(exc, CpuFallbackFailedError):
        return HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=build_runtime_error_detail(
                error=exc.gpu_error,
                stage=exc.stage,
                model_key=model_key,
                used_gpu=True,
                cpu_fallback_attempted=True,
                cpu_fallback_error=exc.cpu_error,
            ),
        )
    if isinstance(exc, ExecutionFailedError) and isinstance(exc.original, CLIENT_FIXABLE_MODEL_ERRORS):
        return HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc.original))
    stage = exc.stage if isinstance(exc, (ExecutionFailedError, CpuFallbackFailedError)) else None
    logger.error(
        "execution.failed",
        extra={"stage": stage, "model_key": model_key},
        exc_info=exc,
    )
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
