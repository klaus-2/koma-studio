from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Iterable

import cv2
import numpy as np


class HDStrategy(str, Enum):
    ORIGINAL = "original"
    RESIZE = "resize"
    CROP = "crop"

    @classmethod
    def from_value(cls, value: str | None) -> "HDStrategy":
        normalized = (value or "").strip().lower()
        if normalized in {"resize", "hd_resize"}:
            return cls.RESIZE
        if normalized in {"crop", "hd_crop"}:
            return cls.CROP
        return cls.ORIGINAL


@dataclass(frozen=True)
class InpaintConfig:
    hd_strategy: HDStrategy = HDStrategy.RESIZE
    hd_strategy_crop_margin: int = 512
    hd_strategy_crop_trigger_size: int = 512
    hd_strategy_resize_limit: int = 960
    mask_feathering: int = 5


def _ceil_modulo(value: int, modulo: int) -> int:
    if modulo <= 1:
        return value
    if value % modulo == 0:
        return value
    return ((value // modulo) + 1) * modulo


def _pad_to_modulo_2d(mask: np.ndarray, mod: int, min_size: int | None = None) -> np.ndarray:
    h, w = mask.shape[:2]
    out_h = _ceil_modulo(h, mod)
    out_w = _ceil_modulo(w, mod)
    if min_size is not None:
        out_h = max(out_h, min_size)
        out_w = max(out_w, min_size)
    if out_h == h and out_w == w:
        return mask
    return np.pad(mask, ((0, out_h - h), (0, out_w - w)), mode="symmetric")


def _pad_to_modulo_3d(
    image: np.ndarray,
    mod: int,
    min_size: int | None = None,
    square: bool = False,
) -> np.ndarray:
    h, w = image.shape[:2]
    out_h = _ceil_modulo(h, mod)
    out_w = _ceil_modulo(w, mod)
    if min_size is not None:
        out_h = max(out_h, min_size)
        out_w = max(out_w, min_size)
    if square:
        max_side = max(out_h, out_w)
        out_h = max_side
        out_w = max_side
    if out_h == h and out_w == w:
        return image
    return np.pad(image, ((0, out_h - h), (0, out_w - w), (0, 0)), mode="symmetric")


def resize_max_size(
    array: np.ndarray,
    size_limit: int,
    interpolation: int = cv2.INTER_CUBIC,
) -> np.ndarray:
    h, w = array.shape[:2]
    if size_limit <= 0 or max(h, w) <= size_limit:
        return array
    ratio = float(size_limit) / float(max(h, w))
    new_w = max(1, int(w * ratio + 0.5))
    new_h = max(1, int(h * ratio + 0.5))
    return cv2.resize(array, (new_w, new_h), interpolation=interpolation)


def boxes_from_mask(mask: np.ndarray) -> list[np.ndarray]:
    if mask.ndim == 3:
        mask = mask[:, :, 0]
    _, thresh = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    h, w = mask.shape[:2]
    boxes: list[np.ndarray] = []
    for contour in contours:
        x, y, bw, bh = cv2.boundingRect(contour)
        box = np.array([x, y, x + bw, y + bh], dtype=np.int32)
        box[::2] = np.clip(box[::2], 0, w)
        box[1::2] = np.clip(box[1::2], 0, h)
        boxes.append(box)
    return boxes


class BaseInpainter(ABC):
    key: str = "base"
    name: str = "Base Inpainter"
    pad_mod: int = 8
    min_size: int | None = None
    pad_to_square: bool = False

    async def inpaint(
        self,
        image: np.ndarray,
        mask: np.ndarray,
        config: InpaintConfig,
    ) -> np.ndarray:
        return self._inpaint(image=image, mask=mask, config=config)

    @abstractmethod
    def forward(self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig) -> np.ndarray:
        raise NotImplementedError

    def _inpaint(
        self,
        image: np.ndarray,
        mask: np.ndarray,
        config: InpaintConfig,
    ) -> np.ndarray:
        if image.ndim != 3 or image.shape[2] != 3:
            raise ValueError("Image must be in RGB format (H, W, 3)")

        if mask.ndim == 3:
            mask = mask[:, :, 0]
        if mask.ndim != 2:
            raise ValueError("Mask must be a 2D array")

        strategy = config.hd_strategy
        if strategy == HDStrategy.CROP and max(image.shape[:2]) > config.hd_strategy_crop_trigger_size:
            boxes = boxes_from_mask(mask)
            if boxes:
                inpainted = image.copy()
                for box in boxes:
                    crop_img, crop_mask, crop_box = self._crop_box(image, mask, box, config)
                    crop_result = self._pad_forward(crop_img, crop_mask, config)
                    l, t, r, b = crop_box
                    inpainted[t:b, l:r, :] = crop_result
                return inpainted

        if strategy == HDStrategy.RESIZE and max(image.shape[:2]) > config.hd_strategy_resize_limit:
            origin_h, origin_w = image.shape[:2]
            down_image = resize_max_size(image, config.hd_strategy_resize_limit, interpolation=cv2.INTER_CUBIC)
            down_mask = resize_max_size(mask, config.hd_strategy_resize_limit, interpolation=cv2.INTER_NEAREST)
            inpainted_down = self._pad_forward(down_image, down_mask, config)
            inpainted_up = cv2.resize(inpainted_down, (origin_w, origin_h), interpolation=cv2.INTER_CUBIC)
            return self._blend_results(image, inpainted_up, mask, config.mask_feathering)

        return self._pad_forward(image, mask, config)

    def _blend_results(
        self,
        original_image: np.ndarray,
        inpainted_image: np.ndarray,
        mask: np.ndarray,
        feather: int = 5,
    ) -> np.ndarray:
        if feather > 0:
            ksize = feather * 2 + 1
            blend_mask = cv2.GaussianBlur(mask, (ksize, ksize), 0)
        else:
            blend_mask = mask.copy()
            
        mask_01 = (blend_mask.astype(np.float32) / 255.0)[:, :, np.newaxis]
        blended = (inpainted_image.astype(np.float32) * mask_01) + (original_image.astype(np.float32) * (1.0 - mask_01))
        return np.clip(np.round(blended), 0, 255).astype(np.uint8)

    def _pad_forward(
        self,
        image: np.ndarray,
        mask: np.ndarray,
        config: InpaintConfig,
    ) -> np.ndarray:
        origin_h, origin_w = image.shape[:2]
        padded_image = _pad_to_modulo_3d(
            image,
            mod=self.pad_mod,
            min_size=self.min_size,
            square=self.pad_to_square,
        )
        padded_mask = _pad_to_modulo_2d(mask, mod=self.pad_mod, min_size=self.min_size)

        result = self.forward(padded_image, padded_mask, config)
        result = np.asarray(result)
        if result.ndim != 3 or result.shape[2] != 3:
            raise RuntimeError(f"Inpainter {self.key} returned an invalid shape: {result.shape}")

        result = result[:origin_h, :origin_w, :]
        mask_slice = mask[:origin_h, :origin_w]
        return self._blend_results(image, result, mask_slice, config.mask_feathering)

    def _crop_box(
        self,
        image: np.ndarray,
        mask: np.ndarray,
        box: Iterable[int],
        config: InpaintConfig,
    ) -> tuple[np.ndarray, np.ndarray, list[int]]:
        x1, y1, x2, y2 = [int(v) for v in box]
        box_h = max(1, y2 - y1)
        box_w = max(1, x2 - x1)
        cx = (x1 + x2) // 2
        cy = (y1 + y2) // 2
        img_h, img_w = image.shape[:2]

        width = box_w + config.hd_strategy_crop_margin * 2
        height = box_h + config.hd_strategy_crop_margin * 2

        left_raw = cx - width // 2
        right_raw = cx + width // 2
        top_raw = cy - height // 2
        bottom_raw = cy + height // 2

        left = max(left_raw, 0)
        right = min(right_raw, img_w)
        top = max(top_raw, 0)
        bottom = min(bottom_raw, img_h)

        if left_raw < 0:
            right += abs(left_raw)
        if right_raw > img_w:
            left -= (right_raw - img_w)
        if top_raw < 0:
            bottom += abs(top_raw)
        if bottom_raw > img_h:
            top -= (bottom_raw - img_h)

        left = max(0, left)
        top = max(0, top)
        right = min(img_w, right)
        bottom = min(img_h, bottom)

        crop_img = image[top:bottom, left:right, :]
        crop_mask = mask[top:bottom, left:right]
        return crop_img, crop_mask, [left, top, right, bottom]
