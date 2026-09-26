from __future__ import annotations

from typing import Final

from fastapi import UploadFile

MAX_UPLOAD_BYTES: Final = 64 * 1024 * 1024
_CHUNK_SIZE: Final = 1024 * 1024


class UploadTooLargeError(ValueError):
    def __init__(self, limit: int) -> None:
        super().__init__(f"Upload exceeds the {limit // (1024 * 1024)} MiB limit")
        self.limit = limit


async def read_upload(upload: UploadFile, *, limit: int = MAX_UPLOAD_BYTES) -> bytes:
    buffer = bytearray()
    while chunk := await upload.read(_CHUNK_SIZE):
        buffer.extend(chunk)
        if len(buffer) > limit:
            raise UploadTooLargeError(limit)
    return bytes(buffer)
