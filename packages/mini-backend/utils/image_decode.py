"""Single decode path for uploaded images. Raises domain errors, never PIL's."""

from __future__ import annotations

import asyncio
from io import BytesIO
from typing import Literal

from PIL import Image, UnidentifiedImageError

from pipelines.batch.errors import ImageTooLargeError, InvalidImageError

type ImageMode = Literal["RGB", "RGBA", "L"]


def decode_image(payload: bytes, mode: ImageMode) -> Image.Image:
    """CPU-bound. ``convert`` forces a full decode so truncation surfaces here."""
    try:
        with Image.open(BytesIO(payload)) as source:
            return source.convert(mode)
    except Image.DecompressionBombError as exc:
        raise ImageTooLargeError(
            "Image exceeds the maximum supported pixel count"
        ) from exc
    except UnidentifiedImageError as exc:
        raise InvalidImageError("Invalid image file") from exc
    except (OSError, ValueError) as exc:
        raise InvalidImageError(f"Failed to read the image: {exc}") from exc


async def decode_image_async(payload: bytes, mode: ImageMode) -> Image.Image:
    return await asyncio.to_thread(decode_image, payload, mode)
