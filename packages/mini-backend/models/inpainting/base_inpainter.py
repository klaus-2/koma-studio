"""Shared RGB uint8 inpainting pipeline.

Coordinates use exclusive right/bottom edges. Masks are thresholded at 128.
Inputs are borrowed read-only; returned images have independent ownership.
Compositing occurs once and never changes pixels outside the binary mask.
"""

from __future__ import annotations

import logging
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
_BATCH_SIZE_TOLERANCE = 96
_BATCH_CROP_PADDING = 8

logger = logging.getLogger(__name__)


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
    AUTO = "auto"

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
            "auto": cls.AUTO,
            "hd_auto": cls.AUTO,
        }
        try:
            return aliases[normalized]
        except KeyError as exc:
            raise InvalidInpaintInputError("Unknown HD strategy") from exc


class InpaintConfig(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    hd_strategy: HDStrategy = HDStrategy.CROP
    hd_strategy_crop_margin: Annotated[int, Field(strict=True, ge=0, le=8192)] = 192
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


def pad_to_modulo[T: np.generic](array: npt.NDArray[T], mod: int, *, min_size: int | None = None, square: bool = False) -> npt.NDArray[T]:
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


def cluster_mask_boxes(mask: MaskU8, max_gap: int = 28) -> list[Box]:
    """Group nearby masked components into tightly bounded block boxes."""
    if max_gap <= 0:
        return boxes_from_mask(mask)
    binary = np.where(mask >= 128, np.uint8(255), np.uint8(0))
    if not binary.any():
        return []
    kernel_side = max_gap + 1
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (kernel_side, kernel_side))
    grouped = cv2.dilate(binary, kernel, iterations=1)
    contours, _ = cv2.findContours(
        grouped,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )
    boxes: list[Box] = []
    for contour in contours:
        x, y, width, height = cv2.boundingRect(contour)
        sub = binary[y : y + height, x : x + width]
        ys, xs = np.nonzero(sub)
        if xs.size == 0:
            continue
        boxes.append(
            (
                x + int(xs.min()),
                y + int(ys.min()),
                x + int(xs.max()) + 1,
                y + int(ys.max()) + 1,
            )
        )
    return sorted(boxes, key=lambda box: (box[1], box[0], box[3], box[2]))


def expand_crop_box(box: Box, img_w: int, img_h: int, margin: int) -> Box:
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


def blend_with_mask(original: ImageU8, inpainted: ImageU8, mask: MaskU8, feather: int) -> ImageU8:
    if original.shape != inpainted.shape or mask.shape != original.shape[:2]:
        raise InvalidInpaintInputError("Compositing dimensions do not match")
    if feather < 0:
        raise ValueError("feather must be non-negative")

    binary = mask >= 128
    alpha_full: npt.NDArray[np.float32] | None = None
    if feather > 0 and binary.any():
        dist = cv2.distanceTransform(binary.astype(np.uint8), cv2.DIST_L2, 3)
        ramp = float(min(feather, 2) + 1)
        alpha_full = np.clip(dist / ramp, 0.0, 1.0).astype(np.float32)

    result = original.copy()
    for top in range(0, original.shape[0], _BLEND_ROWS):
        bottom = min(top + _BLEND_ROWS, original.shape[0])
        support = binary[top:bottom]
        if not support.any():
            continue

        if alpha_full is None:
            alpha = support.astype(np.float32)[:, :, np.newaxis]
        else:
            alpha = (alpha_full[top:bottom] * support)[:, :, np.newaxis]

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


def _batch_canvas_groups(
    crops: Sequence[Box],
    *,
    max_batch_edge: int | None = None,
) -> list[list[Box]]:
    """Bin similar-sized crops, splitting bins that exceed pixel or edge budgets."""
    groups: list[list[Box]] = []
    for box in sorted(crops, key=lambda box: max(box[2] - box[0], box[3] - box[1])):
        span = max(box[2] - box[0], box[3] - box[1])
        if not groups or abs(span - max(max(b[2] - b[0], b[3] - b[1]) for b in groups[-1])) > _BATCH_SIZE_TOLERANCE:
            groups.append([box])
        else:
            groups[-1].append(box)
    ready: list[list[Box]] = []
    while groups:
        group = groups.pop(0)
        width = sum(b[2] - b[0] for b in group) + _BATCH_CROP_PADDING * (len(group) - 1)
        height = max(b[3] - b[1] for b in group)
        exceeds_edge = (
            max_batch_edge is not None
            and (width > max_batch_edge or height > max_batch_edge)
        )
        if len(group) > 1 and (width * height > _MAX_IMAGE_PIXELS or exceeds_edge):
            middle = len(group) // 2
            groups[0:0] = [group[:middle], group[middle:]]
        else:
            ready.append(group)
    return ready


_DRIFT_RING_KERNEL = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))


class BaseInpainter(ABC):
    key: str = "base"
    name: str = "Base Inpainter"
    pad_mod: ClassVar[int] = 8
    min_size: ClassVar[int | None] = None
    pad_to_square: ClassVar[bool] = False
    max_crop_edge: ClassVar[int | None] = None
    max_batch_edge: ClassVar[int | None] = None
    enable_border_drift_fix: ClassVar[bool] = False

    def _effective_max_batch_edge(self) -> int | None:
        return self.max_batch_edge

    def _effective_crop_margin(self, config: InpaintConfig) -> int:
        if self.max_crop_edge is None:
            return config.hd_strategy_crop_margin
        return min(config.hd_strategy_crop_margin, max(96, self.max_crop_edge // 3))

    def _compensate_border_drift(
        self,
        original_crop: ImageU8,
        predicted_crop: ImageU8,
        mask_crop: MaskU8,
    ) -> ImageU8:
        if not self.enable_border_drift_fix:
            return predicted_crop
        active = mask_crop >= 128
        if not active.any():
            return predicted_crop
        dilated = cv2.dilate(active.astype(np.uint8), _DRIFT_RING_KERNEL, iterations=1)
        ring = (dilated > 0) & (~active)
        if int(ring.sum()) < 50:
            return predicted_crop
        diff = np.median(
            original_crop[ring].astype(np.float32) - predicted_crop[ring].astype(np.float32),
            axis=0,
        )
        max_abs = float(np.max(np.abs(diff)))
        if max_abs <= 0.5 or max_abs > 15.0:
            return predicted_crop
        shifted = predicted_crop.astype(np.float32) + diff[np.newaxis, np.newaxis, :]
        np.rint(shifted, out=shifted)
        np.clip(shifted, 0.0, 255.0, out=shifted)
        return shifted.astype(np.uint8)

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
        aspect = longest / float(max(1, min(height, width)))
        webtoon_oversized = (
            self.max_crop_edge is not None
            and aspect > 2.5
            and longest > self.max_crop_edge * 2
        )

        if config.hd_strategy is HDStrategy.AUTO:
            if longest > config.hd_strategy_crop_trigger_size or aspect > 2.2:
                return self._inpaint_crops_batched(
                    image,
                    mask,
                    cluster_mask_boxes(mask, max_gap=28),
                    config,
                )
            pred = self._pad_forward(image, mask, config)
            return self._compensate_border_drift(image, pred, mask)

        if (
            config.hd_strategy is HDStrategy.CROP
            and longest > config.hd_strategy_crop_trigger_size
        ):
            boxes = (
                cluster_mask_boxes(mask, max_gap=28)
                if self.max_crop_edge is not None
                else boxes_from_mask(mask)
            )
            return self._inpaint_crops_batched(
                image,
                mask,
                boxes,
                config,
            )

        if config.hd_strategy is HDStrategy.ORIGINAL and webtoon_oversized:
            logger.info(
                "inpainting.webtoon_auto_crop",
                extra={"key": self.key, "width": width, "height": height},
            )
            return self._inpaint_crops_batched(
                image,
                mask,
                cluster_mask_boxes(mask, max_gap=28),
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
            upscaled = np.asarray(
                cv2.resize(
                    down_result,
                    (width, height),
                    interpolation=cv2.INTER_LINEAR,
                ),
                dtype=np.uint8,
            )
            return self._compensate_border_drift(image, upscaled, mask)

        pred = self._pad_forward(image, mask, config)
        return self._compensate_border_drift(image, pred, mask)

    def _crop_boxes(self, image: ImageU8, boxes: Sequence[Box], config: InpaintConfig) -> list[Box]:
        height, width = image.shape[:2]
        margin = self._effective_crop_margin(config)
        return sorted({expand_crop_box(box, width, height, margin) for box in boxes}, key=lambda box: (box[1], box[0], box[3], box[2]))

    def _inpaint_crops(
        self,
        image: ImageU8,
        mask: MaskU8,
        boxes: Sequence[Box],
        config: InpaintConfig,
    ) -> ImageU8:
        canvas = image.copy()
        remaining = mask >= 128

        crops = self._crop_boxes(image, boxes, config)
        for left, top, right, bottom in crops:
            owned = remaining[top:bottom, left:right]
            if not owned.any():
                continue

            crop_img = canvas[top:bottom, left:right]
            crop_mask = np.where(owned, mask[top:bottom, left:right], np.uint8(0))
            prediction = self._pad_forward(
                crop_img,
                crop_mask,
                config,
            )
            prediction = self._compensate_border_drift(crop_img, prediction, crop_mask)
            np.copyto(
                canvas[top:bottom, left:right],
                prediction,
                where=owned[:, :, np.newaxis],
            )
            owned[:] = False

        return canvas

    def _inpaint_crops_batched(self, image: ImageU8, mask: MaskU8, boxes: Sequence[Box], config: InpaintConfig) -> ImageU8:
        crops = self._crop_boxes(image, boxes, config)
        if len(crops) <= 1:
            return self._inpaint_crops(image, mask, boxes, config)

        max_edge = self._effective_max_batch_edge()
        if max_edge == 0:
            return self._inpaint_crops(image, mask, boxes, config)

        image_height, image_width = image.shape[:2]
        margin = self._effective_crop_margin(config)
        raw_box_by_crop: dict[Box, Box] = {}
        for box in boxes:
            raw_box_by_crop.setdefault(
                expand_crop_box(box, image_width, image_height, margin),
                box,
            )

        canvas = image.copy()
        remaining = mask >= 128
        for group in _batch_canvas_groups(crops, max_batch_edge=max_edge):
            if len(group) == 1:
                left, top, right, bottom = group[0]
                owned = remaining[top:bottom, left:right]
                if not owned.any():
                    continue
                crop_img = canvas[top:bottom, left:right]
                crop_mask = np.where(owned, mask[top:bottom, left:right], np.uint8(0))
                prediction = self._pad_forward(crop_img, crop_mask, config)
                prediction = self._compensate_border_drift(crop_img, prediction, crop_mask)
                np.copyto(canvas[top:bottom, left:right], prediction, where=owned[:, :, np.newaxis])
                owned[:] = False
                continue

            tile_width = sum(r - l for l, t, r, b in group) + _BATCH_CROP_PADDING * (len(group) - 1)
            tile_height = max(b - t for l, t, r, b in group)
            tile = np.zeros((tile_height, tile_width, 3), dtype=np.uint8)
            tile_mask = np.zeros((tile_height, tile_width), dtype=np.uint8)
            placements: list[tuple[int, Box]] = []
            offset = 0
            for left, top, right, bottom in group:
                tile[:bottom - top, offset:offset + right - left] = canvas[top:bottom, left:right]
                tile_mask[:bottom - top, offset:offset + right - left] = np.where(
                    remaining[top:bottom, left:right],
                    mask[top:bottom, left:right],
                    np.uint8(0),
                )
                placements.append((offset, (left, top, right, bottom)))
                offset += right - left + _BATCH_CROP_PADDING
            try:
                prediction = self._pad_forward(tile, tile_mask, config)
            except Exception as exc:
                logger.warning("inpainting.batch_forward_failed", extra={"key": self.key, "crops": len(group), "error": str(exc)})
                fallback = self._inpaint_crops(image, mask, [raw_box_by_crop[box] for box in group], config)
                for left, top, right, bottom in group:
                    owned = remaining[top:bottom, left:right]
                    np.copyto(canvas[top:bottom, left:right], fallback[top:bottom, left:right], where=owned[:, :, np.newaxis])
                    owned[:] = False
                continue
            for offset, (left, top, right, bottom) in placements:
                owned = remaining[top:bottom, left:right]
                if not owned.any():
                    continue
                crop_img = canvas[top:bottom, left:right]
                crop_mask = np.where(owned, mask[top:bottom, left:right], np.uint8(0))
                crop_pred = prediction[:bottom - top, offset:offset + right - left]
                crop_pred = self._compensate_border_drift(crop_img, crop_pred, crop_mask)
                np.copyto(canvas[top:bottom, left:right], crop_pred, where=owned[:, :, np.newaxis])
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
