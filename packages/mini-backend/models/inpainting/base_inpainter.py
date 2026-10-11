"""Shared RGB uint8 inpainting pipeline.

Coordinates use exclusive right/bottom edges. Masks are thresholded at 128.
Inputs are borrowed read-only; returned images have independent ownership.
Compositing occurs once and never changes pixels outside the binary mask.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from enum import StrEnum
from typing import Annotated, ClassVar

import cv2
import numpy as np
import numpy.typing as npt
from pydantic import BaseModel, ConfigDict, Field

from models.execution import run_inference

type ImageU8 = npt.NDArray[np.uint8]
type MaskU8 = npt.NDArray[np.uint8]
type Box = tuple[int, int, int, int]

_MAX_IMAGE_PIXELS = 32_000_000
_BLEND_ROWS = 256


class InpaintingError(RuntimeError):
    """Base class for inpainting pipeline failures."""


class InvalidInpaintInputError(InpaintingError):
    """Image or mask violates the pipeline contract."""


class InpainterOutputError(InpaintingError):
    """A concrete inpainter returned an invalid image."""


class HDStrategy(StrEnum):
    ORIGINAL = "original"
    RESIZE = "resize"
    CROP = "crop"

    @classmethod
    def from_value(cls, value: str | None) -> HDStrategy:
        normalized = (value or "original").strip().lower()
        aliases = {
            "": cls.ORIGINAL,
            "original": cls.ORIGINAL,
            "hd_original": cls.ORIGINAL,
            "resize": cls.RESIZE,
            "hd_resize": cls.RESIZE,
            "crop": cls.CROP,
            "hd_crop": cls.CROP,
        }
        try:
            return aliases[normalized]
        except KeyError as exc:
            raise InvalidInpaintInputError("Unknown HD strategy") from exc


class InpaintConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    hd_strategy: HDStrategy = HDStrategy.RESIZE
    hd_strategy_crop_margin: Annotated[int, Field(strict=True, ge=0, le=8192)] = 512
    hd_strategy_crop_trigger_size: Annotated[
        int, Field(strict=True, ge=1, le=65536)
    ] = 512
    hd_strategy_resize_limit: Annotated[
        int, Field(strict=True, ge=1, le=65536)
    ] = 960
    mask_feathering: Annotated[int, Field(strict=True, ge=0, le=128)] = 5


def _ceil_modulo(value: int, modulo: int) -> int:
    if value < 0 or modulo < 1:
        raise ValueError("value must be non-negative and modulo positive")
    return ((value + modulo - 1) // modulo) * modulo


def pad_to_modulo[T: np.generic](
    array: npt.NDArray[T],
    mod: int,
    *,
    min_size: int | None = None,
    square: bool = False,
) -> npt.NDArray[T]:
    if array.ndim < 2:
        raise InvalidInpaintInputError("Padding requires at least two dimensions")
    if mod < 1 or (min_size is not None and min_size < 1):
        raise ValueError("Padding dimensions must be positive")

    height, width = array.shape[:2]
    if height == 0 or width == 0:
        raise InvalidInpaintInputError("Cannot pad an empty image")

    minimum = min_size or 1
    out_h = _ceil_modulo(max(height, minimum), mod)
    out_w = _ceil_modulo(max(width, minimum), mod)

    if square:
        out_h = out_w = max(out_h, out_w)
    if out_h * out_w > _MAX_IMAGE_PIXELS:
        raise InvalidInpaintInputError("Padded image exceeds the pixel budget")
    if (out_h, out_w) == (height, width):
        return array

    pad_width = (
        (0, out_h - height),
        (0, out_w - width),
        *(((0, 0),) * (array.ndim - 2)),
    )
    return np.pad(array, pad_width, mode="symmetric")


def resize_max_size(
    array: ImageU8,
    size_limit: int,
    interpolation: int,
) -> ImageU8:
    if size_limit < 1:
        raise ValueError("size_limit must be positive")
    if array.ndim not in {2, 3} or min(array.shape[:2]) <= 0:
        raise InvalidInpaintInputError("Cannot resize an invalid image")

    height, width = array.shape[:2]
    longest = max(height, width)
    if longest <= size_limit:
        return array

    ratio = size_limit / longest
    target = (
        max(1, round(width * ratio)),
        max(1, round(height * ratio)),
    )
    return np.asarray(
        cv2.resize(array, target, interpolation=interpolation),
        dtype=np.uint8,
    )


def boxes_from_mask(mask: MaskU8) -> list[Box]:
    binary = np.where(mask >= 128, np.uint8(255), np.uint8(0))
    contours, _ = cv2.findContours(
        binary,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    boxes: list[Box] = []

    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        boxes.append((x, y, x + width, y + height))

    return sorted(boxes, key=lambda box: (box[1], box[0], box[3], box[2]))


def expand_crop_box(
    box: Box,
    img_w: int,
    img_h: int,
    margin: int,
) -> Box:
    if img_w < 1 or img_h < 1 or margin < 0:
        raise ValueError("Invalid image dimensions or crop margin")

    x1, y1, x2, y2 = box
    if not (0 <= x1 < x2 <= img_w and 0 <= y1 < y2 <= img_h):
        raise InvalidInpaintInputError("Crop box is outside the image")

    width = min(img_w, x2 - x1 + 2 * margin)
    height = min(img_h, y2 - y1 + 2 * margin)
    left = min(max((x1 + x2 - width) // 2, 0), img_w - width)
    top = min(max((y1 + y2 - height) // 2, 0), img_h - height)
    return left, top, left + width, top + height


def blend_with_mask(
    original: ImageU8,
    inpainted: ImageU8,
    mask: MaskU8,
    feather: int,
) -> ImageU8:
    if original.shape != inpainted.shape or mask.shape != original.shape[:2]:
        raise InvalidInpaintInputError("Compositing dimensions do not match")
    if feather < 0:
        raise ValueError("feather must be non-negative")

    if feather:
        kernel_size = feather * 2 + 1
        soft_mask = np.asarray(
            cv2.GaussianBlur(mask, (kernel_size, kernel_size), 0),
            dtype=np.uint8,
        )
    else:
        soft_mask = mask

    result = original.copy()
    for top in range(0, original.shape[0], _BLEND_ROWS):
        bottom = min(top + _BLEND_ROWS, original.shape[0])
        support = mask[top:bottom] >= 128
        if not support.any():
            continue

        alpha = soft_mask[top:bottom].astype(np.float32)
        alpha *= np.float32(1.0 / 255.0)
        alpha *= support
        alpha = alpha[:, :, np.newaxis]

        blended = inpainted[top:bottom].astype(np.float32)
        blended -= original[top:bottom]
        blended *= alpha
        blended += original[top:bottom]
        np.rint(blended, out=blended)
        np.clip(blended, 0.0, 255.0, out=blended)
        result[top:bottom] = blended.astype(np.uint8)

    return result


def _validate_image(image: ImageU8) -> None:
    if image.ndim != 3 or image.shape[2] != 3:
        raise InvalidInpaintInputError(
            f"Image must be RGB (H, W, 3); got {image.shape}"
        )
    if image.dtype != np.uint8:
        raise InvalidInpaintInputError("Image must use uint8 pixels")
    if min(image.shape[:2]) < 1:
        raise InvalidInpaintInputError("Image must not be empty")
    if image.shape[0] * image.shape[1] > _MAX_IMAGE_PIXELS:
        raise InvalidInpaintInputError("Image exceeds the pixel budget")


def _normalize_mask(
    mask: npt.NDArray[np.generic],
    expected_hw: tuple[int, int],
) -> MaskU8:
    if mask.ndim == 3 and mask.shape[2] == 1:
        plane = mask[:, :, 0]
    elif mask.ndim == 2:
        plane = mask
    else:
        raise InvalidInpaintInputError(
            "Mask must have shape (H, W) or (H, W, 1)"
        )

    if plane.shape != expected_hw:
        raise InvalidInpaintInputError("Mask and image dimensions do not match")

    if plane.dtype == np.bool_:
        active = plane
    elif plane.dtype == np.uint8:
        active = plane.astype(np.uint8) >= 128
    else:
        raise InvalidInpaintInputError("Mask must use uint8 or bool pixels")

    return np.where(active, np.uint8(255), np.uint8(0))


class BaseInpainter(ABC):
    key: str = "base"
    name: str = "Base Inpainter"
    pad_mod: ClassVar[int] = 8
    min_size: ClassVar[int | None] = None
    pad_to_square: ClassVar[bool] = False

    async def inpaint(
        self,
        image: ImageU8,
        mask: npt.NDArray[np.generic],
        config: InpaintConfig,
    ) -> ImageU8:
        return await run_inference(lambda: self._inpaint(image, mask, config))

    @abstractmethod
    def forward(
        self,
        image: ImageU8,
        mask: MaskU8,
        config: InpaintConfig,
    ) -> ImageU8:
        """Return an RGB uint8 image of exactly the supplied padded dimensions."""

    def _inpaint(
        self,
        image: ImageU8,
        mask: npt.NDArray[np.generic],
        config: InpaintConfig,
    ) -> ImageU8:
        _validate_image(image)
        binary_mask = _normalize_mask(mask, (image.shape[0], image.shape[1]))
        if not binary_mask.any():
            return image.copy()

        try:
            raw = self._run_strategy(image, binary_mask, config)
            return blend_with_mask(
                image,
                raw,
                binary_mask,
                config.mask_feathering,
            )
        except cv2.error as exc:
            raise InpaintingError("OpenCV inpainting preprocessing failed") from exc

    def _run_strategy(
        self,
        image: ImageU8,
        mask: MaskU8,
        config: InpaintConfig,
    ) -> ImageU8:
        height, width = image.shape[:2]
        longest = max(height, width)

        if (
            config.hd_strategy is HDStrategy.CROP
            and longest > config.hd_strategy_crop_trigger_size
        ):
            return self._inpaint_crops(
                image,
                mask,
                boxes_from_mask(mask),
                config,
            )

        if (
            config.hd_strategy is HDStrategy.RESIZE
            and longest > config.hd_strategy_resize_limit
        ):
            down_image = resize_max_size(
                image,
                config.hd_strategy_resize_limit,
                cv2.INTER_AREA,
            )
            down_mask = resize_max_size(
                mask,
                config.hd_strategy_resize_limit,
                cv2.INTER_NEAREST,
            )

            # Conservative downsampling retains thin masked regions.
            coverage = np.asarray(
                cv2.resize(
                    mask,
                    (down_image.shape[1], down_image.shape[0]),
                    interpolation=cv2.INTER_AREA,
                ),
                dtype=np.uint8,
            )
            down_mask = np.where(
                (coverage > 0) | (down_mask >= 128),
                np.uint8(255),
                np.uint8(0),
            )
            down_result = self._pad_forward(down_image, down_mask, config)
            return np.asarray(
                cv2.resize(
                    down_result,
                    (width, height),
                    interpolation=cv2.INTER_LINEAR,
                ),
                dtype=np.uint8,
            )

        return self._pad_forward(image, mask, config)

    def _inpaint_crops(
        self,
        image: ImageU8,
        mask: MaskU8,
        boxes: Sequence[Box],
        config: InpaintConfig,
    ) -> ImageU8:
        canvas = image.copy()
        remaining = mask >= 128
        height, width = image.shape[:2]

        crops = sorted(
            {
                expand_crop_box(
                    box,
                    width,
                    height,
                    config.hd_strategy_crop_margin,
                )
                for box in boxes
            },
            key=lambda box: (box[1], box[0], box[3], box[2]),
        )

        for left, top, right, bottom in crops:
            owned = remaining[top:bottom, left:right]
            if not owned.any():
                continue

            prediction = self._pad_forward(
                image[top:bottom, left:right],
                mask[top:bottom, left:right],
                config,
            )
            np.copyto(
                canvas[top:bottom, left:right],
                prediction,
                where=owned[:, :, np.newaxis],
            )
            owned[:] = False

        return canvas

    def _pad_forward(
        self,
        image: ImageU8,
        mask: MaskU8,
        config: InpaintConfig,
    ) -> ImageU8:
        height, width = image.shape[:2]
        padded_image = pad_to_modulo(
            image,
            self.pad_mod,
            min_size=self.min_size,
            square=self.pad_to_square,
        )
        padded_mask = pad_to_modulo(
            mask,
            self.pad_mod,
            min_size=self.min_size,
            square=self.pad_to_square,
        )

        result = self.forward(padded_image, padded_mask, config)
        if result.dtype != np.uint8 or result.shape != padded_image.shape:
            raise InpainterOutputError(
                f"{self.key}: expected uint8 {padded_image.shape}; "
                f"got {result.dtype} {result.shape}"
            )

        return result[:height, :width].copy()
