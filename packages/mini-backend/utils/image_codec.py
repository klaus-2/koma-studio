from __future__ import annotations

from io import BytesIO
from typing import Annotated, Final, Literal

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image, UnidentifiedImageError
from pydantic import Field, TypeAdapter, ValidationError

from utils.workers import run_native

type RGBImage = NDArray[np.uint8]
type MaskImage = NDArray[np.uint8]
type PixelShape = tuple[int, int]
type ImageMode = Literal["RGB", "RGBA", "L"]

MAX_IMAGE_PIXELS: Final = 64_000_000
MAX_IMAGE_BYTES: Final = 32 * 1024 * 1024
MAX_DILATION_RADIUS: Final = 128

_PAYLOAD = TypeAdapter(
    Annotated[bytes, Field(strict=True, min_length=1, max_length=MAX_IMAGE_BYTES)]
)
_DIMENSION = TypeAdapter(Annotated[int, Field(strict=True, gt=0)])
_RADIUS = TypeAdapter(
    Annotated[int, Field(strict=True, ge=0, le=MAX_DILATION_RADIUS)]
)


class ImageDecodeError(ValueError):
    """The input cannot be decoded under the raster resource policy."""


class ImageTooLargeError(ImageDecodeError):
    """The encoded or decoded image exceeds the accepted budget."""


class ImageEncodeError(RuntimeError):
    """The validated raster could not be encoded."""


def validate_shape(shape: PixelShape) -> PixelShape:
    height = _DIMENSION.validate_python(shape[0])
    width = _DIMENSION.validate_python(shape[1])
    if height * width > MAX_IMAGE_PIXELS:
        raise ImageTooLargeError("Image exceeds the pixel budget")
    return height, width


def validate_rgb(rgb: RGBImage) -> None:
    if rgb.dtype != np.uint8 or rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ValueError("RGB image must be an HxWx3 uint8 array")
    validate_shape((rgb.shape[0], rgb.shape[1]))


def validate_mask(mask: MaskImage) -> None:
    if mask.dtype != np.uint8 or mask.ndim != 2:
        raise ValueError("Mask must be an HxW uint8 array")
    validate_shape((mask.shape[0], mask.shape[1]))


def validate_radius(radius: int) -> int:
    return _RADIUS.validate_python(radius)


def _validate_payload(payload: bytes) -> bytes:
    if len(payload) > MAX_IMAGE_BYTES:
        raise ImageTooLargeError("Encoded image exceeds the byte budget")
    try:
        return _PAYLOAD.validate_python(payload)
    except ValidationError as exc:
        raise ImageDecodeError("Image payload must be nonempty bytes") from exc


def _open_guarded(payload: bytes) -> Image.Image:
    stream = BytesIO(_validate_payload(payload))
    try:
        image = Image.open(stream)
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        stream.close()
        raise ImageTooLargeError("Image exceeds the decoder pixel budget") from exc
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError) as exc:
        stream.close()
        raise ImageDecodeError("Invalid raster image") from exc

    try:
        validate_shape((image.height, image.width))
        if getattr(image, "n_frames", 1) != 1:
            raise ImageDecodeError("Animated and multi-frame inputs are not accepted")
    except (ValueError, OSError):
        image.close()
        stream.close()
        raise

    return image


def decode_pil(payload: bytes, mode: ImageMode = "RGB") -> Image.Image:
    """Return an independently owned image; the caller must close it."""
    if mode not in {"RGB", "RGBA", "L"}:
        raise ImageDecodeError("Unsupported output image mode")

    try:
        with _open_guarded(payload) as image:
            image.load()
            converted = image.convert(mode)
            converted.info.clear()
            return converted
    except ImageDecodeError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
        raise ImageTooLargeError("Image exceeds the decoder pixel budget") from exc
    except (OSError, ValueError, SyntaxError) as exc:
        raise ImageDecodeError("Raster decoding failed") from exc


def decode_rgb(payload: bytes) -> RGBImage:
    with decode_pil(payload, "RGB") as image:
        return np.array(image, dtype=np.uint8, copy=True)


def decode_binary_mask(payload: bytes, *, target_shape: PixelShape) -> MaskImage:
    height, width = validate_shape(target_shape)
    with decode_pil(payload, "L") as image:
        grey: MaskImage = np.array(image, dtype=np.uint8, copy=True)

    if grey.shape != target_shape:
        grey = np.asarray(
            cv2.resize(grey, (width, height), interpolation=cv2.INTER_NEAREST),
            dtype=np.uint8,
        )
    np.greater(grey, 0, out=grey)
    grey *= np.uint8(255)
    return grey


def dilate_mask(mask: MaskImage, *, radius: int) -> MaskImage:
    validate_mask(mask)
    radius = validate_radius(radius)
    if radius == 0:
        return mask.copy()

    side = radius * 2 + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (side, side))
    return np.asarray(
        cv2.dilate(
            mask,
            kernel,
            iterations=1,
            borderType=cv2.BORDER_CONSTANT,
            borderValue=0,
        ),
        dtype=np.uint8,
    )


def encode_png(rgb: RGBImage) -> bytes:
    validate_rgb(rgb)
    try:
        bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
        success, encoded = cv2.imencode(".png", bgr)
    except cv2.error as exc:
        raise ImageEncodeError("PNG encoding failed") from exc

    if not success:
        raise ImageEncodeError("PNG encoder returned failure")
    return encoded.tobytes()


async def decode_rgb_async(payload: bytes) -> RGBImage:
    return await run_native(decode_rgb, payload)


async def decode_pil_async(payload: bytes, mode: ImageMode = "RGB") -> Image.Image:
    return await run_native(decode_pil, payload, mode)


async def decode_binary_mask_async(
    payload: bytes,
    *,
    target_shape: PixelShape,
) -> MaskImage:
    return await run_native(decode_binary_mask, payload, target_shape=target_shape)


async def dilate_mask_async(mask: MaskImage, *, radius: int) -> MaskImage:
    return await run_native(dilate_mask, mask, radius=radius)


async def encode_png_async(rgb: RGBImage) -> bytes:
    return await run_native(encode_png, rgb)
