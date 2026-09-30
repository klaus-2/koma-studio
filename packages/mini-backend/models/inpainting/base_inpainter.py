"""Inpainter contract and the shared HD pipeline (crop / resize / padding / blend).

Concrete inpainters implement ``forward`` on an already padded RGB uint8 image
and receive the final compositing for free. Blending happens exactly once, at
full resolution, regardless of the HD strategy — the previous code feathered
twice on RESIZE (once in low-res, again after upscaling), producing a halo.
"""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum
from typing import ClassVar

import cv2
import numpy as np
import numpy.typing as npt

type ImageU8 = npt.NDArray[np.uint8]
type MaskU8 = npt.NDArray[np.uint8]
type Box = tuple[int, int, int, int]


class InpaintingError(RuntimeError):
    """Base class for inpainting pipeline failures."""


class InvalidInpaintInputError(InpaintingError):
    """Image or mask violate the pipeline contract."""


class InpainterOutputError(InpaintingError):
    """A concrete inpainter returned a tensor with an unexpected shape."""


class HDStrategy(StrEnum):
    ORIGINAL = "original"
    RESIZE = "resize"
    CROP = "crop"

    @classmethod
    def from_value(cls, value: str | None) -> HDStrategy:
        normalized = (value or "").strip().lower()
        if normalized in {"resize", "hd_resize"}:
            return cls.RESIZE
        if normalized in {"crop", "hd_crop"}:
            return cls.CROP
        return cls.ORIGINAL


_HD_STRATEGY_ALIASES: Mapping[str, HDStrategy] = {
    "original": HDStrategy.ORIGINAL,
    "resize": HDStrategy.RESIZE,
    "hd_resize": HDStrategy.RESIZE,
    "crop": HDStrategy.CROP,
    "hd_crop": HDStrategy.CROP,
}


@dataclass(frozen=True)
class InpaintConfig:
    hd_strategy: HDStrategy = HDStrategy.RESIZE
    hd_strategy_crop_margin: int = 512
    hd_strategy_crop_trigger_size: int = 512
    hd_strategy_resize_limit: int = 960
    mask_feathering: int = 5


def _as_u8(array: npt.ArrayLike) -> ImageU8:
    return np.asarray(array, dtype=np.uint8)


def _ceil_modulo(value: int, modulo: int) -> int:
    if modulo <= 1 or value % modulo == 0:
        return value
    return (value // modulo + 1) * modulo


def pad_to_modulo[T: np.generic](
    array: npt.NDArray[T],
    mod: int,
    *,
    min_size: int | None = None,
    square: bool = False,
) -> npt.NDArray[T]:
    """Symmetric-pad H and W (any trailing dims untouched) so both are multiples of ``mod``."""
    h, w = array.shape[:2]
    floor = min_size or 0
    out_h = max(_ceil_modulo(h, mod), floor)
    out_w = max(_ceil_modulo(w, mod), floor)
    if square:
        out_h = out_w = max(out_h, out_w)
    if (out_h, out_w) == (h, w):
        return array
    pad_width = ((0, out_h - h), (0, out_w - w), *(((0, 0),) * (array.ndim - 2)))
    return np.pad(array, pad_width, mode="symmetric")


def resize_max_size(array: ImageU8, size_limit: int, interpolation: int) -> ImageU8:
    h, w = array.shape[:2]
    longest = max(h, w)
    if size_limit <= 0 or longest <= size_limit:
        return array
    ratio = size_limit / longest
    new_w = max(1, round(w * ratio))
    new_h = max(1, round(h * ratio))
    return _as_u8(cv2.resize(array, (new_w, new_h), interpolation=interpolation))


def boxes_from_mask(mask: MaskU8) -> list[Box]:
    _, binary = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = mask.shape[:2]
    boxes: list[Box] = []
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        boxes.append((max(0, x), max(0, y), min(w, x + bw), min(h, y + bh)))
    return boxes


def expand_crop_box(box: Box, img_w: int, img_h: int, margin: int) -> Box:
    """Grow ``box`` by ``margin`` on each side and shift it to stay inside the image."""
    x1, y1, x2, y2 = box
    width = min(img_w, max(1, x2 - x1) + 2 * margin)
    height = min(img_h, max(1, y2 - y1) + 2 * margin)
    left = min(max((x1 + x2) // 2 - width // 2, 0), img_w - width)
    top = min(max((y1 + y2) // 2 - height // 2, 0), img_h - height)
    return left, top, left + width, top + height


def blend_with_mask(original: ImageU8, inpainted: ImageU8, mask: MaskU8, feather: int) -> ImageU8:
    if feather > 0:
        ksize = feather * 2 + 1
        soft_mask = np.asarray(cv2.GaussianBlur(mask, (ksize, ksize), 0), dtype=np.float32)
    else:
        soft_mask = mask.astype(np.float32)
    alpha = (soft_mask / 255.0)[:, :, np.newaxis]
    blended = inpainted.astype(np.float32) * alpha + original.astype(np.float32) * (1.0 - alpha)
    return _as_u8(np.clip(np.rint(blended), 0, 255))


def _validate_image(image: ImageU8) -> None:
    if image.ndim != 3 or image.shape[2] != 3:
        raise InvalidInpaintInputError(f"Image must be RGB (H, W, 3); got shape {image.shape}")
    if image.dtype != np.uint8:
        raise InvalidInpaintInputError(f"Image must be uint8; got {image.dtype}")


def _normalize_mask(mask: npt.NDArray[np.generic], expected_hw: tuple[int, int]) -> MaskU8:
    plane = mask[:, :, 0] if mask.ndim == 3 else mask
    if plane.ndim != 2:
        raise InvalidInpaintInputError(f"Mask must be 2D or (H, W, C); got shape {mask.shape}")
    if plane.shape[:2] != expected_hw:
        raise InvalidInpaintInputError(
            f"Mask shape {plane.shape[:2]} does not match image shape {expected_hw}"
        )
    return _as_u8(plane)


class BaseInpainter(ABC):
    # ``key``/``name`` are instance-overridable: one class may serve several registry entries.
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
        # Inference is CPU/GPU-bound and synchronous (ONNX Runtime); never run it on the loop thread.
        return await asyncio.to_thread(self._inpaint, image, mask, config)

    @abstractmethod
    def forward(self, image: ImageU8, mask: MaskU8, config: InpaintConfig) -> ImageU8:
        """Run the model on a padded RGB image and a binary mask of the same H×W."""

    def _inpaint(
        self,
        image: ImageU8,
        mask: npt.NDArray[np.generic],
        config: InpaintConfig,
    ) -> ImageU8:
        _validate_image(image)
        mask_2d = _normalize_mask(mask, (image.shape[0], image.shape[1]))
        raw = self._run_strategy(image, mask_2d, config)
        return blend_with_mask(image, raw, mask_2d, config.mask_feathering)

    def _run_strategy(self, image: ImageU8, mask: MaskU8, config: InpaintConfig) -> ImageU8:
        img_h, img_w = image.shape[:2]
        longest = max(img_h, img_w)

        if config.hd_strategy is HDStrategy.CROP and longest > config.hd_strategy_crop_trigger_size:
            boxes = boxes_from_mask(mask)
            if boxes:
                return self._inpaint_crops(image, mask, boxes, config)

        if config.hd_strategy is HDStrategy.RESIZE and longest > config.hd_strategy_resize_limit:
            down_image = resize_max_size(image, config.hd_strategy_resize_limit, cv2.INTER_CUBIC)
            down_mask = resize_max_size(mask, config.hd_strategy_resize_limit, cv2.INTER_NEAREST)
            down_result = self._pad_forward(down_image, down_mask, config)
            return _as_u8(cv2.resize(down_result, (img_w, img_h), interpolation=cv2.INTER_CUBIC))

        return self._pad_forward(image, mask, config)

    def _inpaint_crops(
        self, image: ImageU8, mask: MaskU8, boxes: list[Box], config: InpaintConfig
    ) -> ImageU8:
        canvas = image.copy()
        img_h, img_w = image.shape[:2]
        for box in boxes:
            left, top, right, bottom = expand_crop_box(box, img_w, img_h, config.hd_strategy_crop_margin)
            canvas[top:bottom, left:right] = self._pad_forward(
                image[top:bottom, left:right], mask[top:bottom, left:right], config
            )
        return canvas

    def _pad_forward(self, image: ImageU8, mask: MaskU8, config: InpaintConfig) -> ImageU8:
        h, w = image.shape[:2]
        padded_image = pad_to_modulo(image, self.pad_mod, min_size=self.min_size, square=self.pad_to_square)
        # Same square rule for both arrays: with pad_to_square=True a mask padded
        # independently used to end up with a different H×W than the image, and
        # the multiply exploded at runtime.
        padded_mask = pad_to_modulo(mask, self.pad_mod, min_size=self.min_size, square=self.pad_to_square)
        result = self.forward(padded_image, padded_mask, config)
        if result.ndim != 3 or result.shape[2] != 3 or result.shape[0] < h or result.shape[1] < w:
            raise InpainterOutputError(
                f"Inpainter '{self.key}' returned shape {result.shape}; expected at least ({h}, {w}, 3)"
            )
        return _as_u8(result[:h, :w])
