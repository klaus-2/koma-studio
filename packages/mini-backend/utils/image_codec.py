"""Raster decode/encode helpers with decompression-bomb guards.

Every public function is CPU-bound and synchronous; the ``*_async`` variants
offload to the default thread pool so request handlers never block the loop.
"""

from __future__ import annotations

import asyncio
from io import BytesIO
from typing import Final, Literal

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, UnidentifiedImageError

type RGBImage = NDArray[np.uint8]
type MaskImage = NDArray[np.uint8]
type PixelShape = tuple[int, int]
"""(height, width) — numpy order."""

MAX_IMAGE_PIXELS: Final = 64_000_000
"""8k×8k. Decoded RGB ≈ 192 MiB; anything above is not a comic page."""


class ImageDecodeError(ValueError):
    """Payload is not a decodable raster image within the accepted limits."""


class ImageEncodeError(RuntimeError):
    """OpenCV failed to encode the output image."""


def _decode(payload: bytes, *, mode: Literal["RGB", "L"], label: str) -> NDArray[np.uint8]:
    try:
        with Image.open(BytesIO(payload)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise ImageDecodeError(f"{label} exceeds {MAX_IMAGE_PIXELS} pixels")
            return np.asarray(image.convert(mode), dtype=np.uint8)
    except ImageDecodeError:
        raise
    except UnidentifiedImageError as exc:
        raise ImageDecodeError(f"Invalid {label} file") from exc
    except (OSError, ValueError, Image.DecompressionBombError) as exc:
        raise ImageDecodeError(f"Failed to read the uploaded {label}") from exc


def decode_rgb(payload: bytes) -> RGBImage:
    return _decode(payload, mode="RGB", label="image")


def decode_binary_mask(payload: bytes, *, target_shape: PixelShape) -> MaskImage:
    grey = _decode(payload, mode="L", label="mask")
    if grey.shape != target_shape:
        height, width = target_shape
        grey = np.asarray(
            cv2.resize(grey, (width, height), interpolation=cv2.INTER_NEAREST),
            dtype=np.uint8,
        )
    return np.where(grey > 0, 255, 0).astype(np.uint8)


def dilate_mask(mask: MaskImage, *, radius: int) -> MaskImage:
    if radius <= 0:
        return mask
    size = radius * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (size, size))
    return np.asarray(cv2.dilate(mask, kernel, iterations=1), dtype=np.uint8)


def encode_png(rgb: RGBImage) -> bytes:
    ok, encoded = cv2.imencode(".png", cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    if not ok:
        raise ImageEncodeError("Failed to encode the image as PNG")
    return encoded.tobytes()


async def decode_rgb_async(payload: bytes) -> RGBImage:
    return await asyncio.to_thread(decode_rgb, payload)


async def decode_binary_mask_async(payload: bytes, *, target_shape: PixelShape) -> MaskImage:
    return await asyncio.to_thread(decode_binary_mask, payload, target_shape=target_shape)


async def encode_png_async(rgb: RGBImage) -> bytes:
    return await asyncio.to_thread(encode_png, rgb)
