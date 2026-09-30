"""Upload helpers shared by routers: bounded reads and decode → HTTP mapping."""

from __future__ import annotations

from fastapi import HTTPException, UploadFile
from PIL import Image

from pipelines.batch.errors import ImageTooLargeError, InvalidImageError
from utils.image_decode import ImageMode, decode_image_async

_MIB = 1024 * 1024


async def read_upload_limited(upload: UploadFile, *, limit_bytes: int, label: str) -> bytes:
    """Read at most ``limit_bytes``; one extra byte tells us the limit was exceeded."""
    payload = await upload.read(limit_bytes + 1)
    if len(payload) > limit_bytes:
        raise HTTPException(
            status_code=413, detail=f"{label} is too large. Maximum: {limit_bytes // _MIB}MB"
        )
    return payload


async def decode_upload(
    payload: bytes, *, mode: ImageMode, label: str, invalid_status: int = 422
) -> Image.Image:
    try:
        return await decode_image_async(payload, mode)
    except ImageTooLargeError as exc:
        raise HTTPException(status_code=413, detail=f"{label}: {exc}") from exc
    except InvalidImageError as exc:
        raise HTTPException(status_code=invalid_status, detail=f"{label}: {exc}") from exc
