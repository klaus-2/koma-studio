"""Clean pipeline: detect, construct a bounded mask, and inpaint.

Construction is non-blocking. Engines are obtained inside inference workers.
Per-request cleanup never clears engines potentially shared by other requests.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image

from core.device import DeviceInfo
from models.detection.base_detector import BaseDetector, TextDetection
from models.detection.factory import get_detector
from models.errors import InferenceError, InvalidInputImageError
from models.execution import run_inference
from models.geometry import BBox, clip_bbox
from models.inpainting.base_inpainter import (
    HDStrategy,
    ImageU8,
    InpaintConfig,
)
from models.inpainting.factory import get_inpainter
from schemas.inpainting import CleanRequest, CleanResult

type MaskArray = NDArray[np.uint8]

_DILATION_ITERATIONS = 2
_MAX_DILATION = 256
_MAX_IMAGE_PIXELS = 32_000_000


class HasBBox(Protocol):
    @property
    def bbox(self) -> BBox: ...


def build_detection_mask(
    size: tuple[int, int],
    detections: Sequence[HasBBox],
    dilation: int,
) -> MaskArray:
    width, height = size
    if (
        width <= 0
        or height <= 0
        or width * height > _MAX_IMAGE_PIXELS
    ):
        raise InvalidInputImageError("Invalid mask dimensions")
    if dilation < 0 or dilation > _MAX_DILATION:
        raise InvalidInputImageError("Mask dilation is outside supported limits")

    mask = np.zeros((height, width), dtype=np.uint8)
    for detection in detections:
        clipped = clip_bbox(*detection.bbox, width, height)
        if clipped is None:
            continue
        left, top, right, bottom = clipped
        mask[top:bottom, left:right] = 255

    if dilation > 1 and mask.any():
        try:
            kernel = cv2.getStructuringElement(
                cv2.MORPH_RECT,
                (dilation, dilation),
            )
            mask = np.asarray(
                cv2.dilate(
                    mask,
                    kernel,
                    iterations=_DILATION_ITERATIONS,
                ),
                dtype=np.uint8,
            )
        except cv2.error as exc:
            raise InferenceError("Detection mask dilation failed") from exc

    return mask


def _prepare_rgb(image: Image.Image) -> Image.Image:
    width, height = image.size
    if (
        width <= 0
        or height <= 0
        or width * height > _MAX_IMAGE_PIXELS
    ):
        raise InvalidInputImageError("Image dimensions exceed cleaning limits")

    try:
        rgb = image.convert("RGB")
        rgb.load()
        return rgb
    except (OSError, ValueError) as exc:
        raise InvalidInputImageError("Image conversion failed") from exc


def _prepare_mask_and_pixels(
    rgb: Image.Image,
    detections: Sequence[TextDetection],
    dilation: int,
) -> tuple[MaskArray, ImageU8, bool]:
    mask = build_detection_mask(rgb.size, detections, dilation)
    pixels = np.array(rgb, dtype=np.uint8, copy=True)
    return mask, pixels, bool(mask.any())


def _build_result(
    pixels: ImageU8,
    mask: MaskArray,
    detections: list[TextDetection],
    detector_name: str,
    inpainter_name: str,
) -> CleanResult:
    image = Image.fromarray(pixels)
    mask_image = Image.fromarray(mask)
    completed = False

    try:
        result = CleanResult(
            image=image,
            detections=detections,
            mask=mask_image,
            model_used={
                "detector": detector_name,
                "inpainter": inpainter_name,
            },
        )
        completed = True
        return result
    finally:
        if not completed:
            image.close()
            mask_image.close()


class CleanPipeline:
    __slots__ = ("device",)

    def __init__(self, device: DeviceInfo) -> None:
        self.device = device

    def _get_detector(self) -> BaseDetector:
        return get_detector(
            task="text",
            has_gpu=self.device.has_gpu,
            device_info=self.device,
        )

    async def run(
        self,
        image: Image.Image,
        request: CleanRequest,
    ) -> CleanResult:
        config = InpaintConfig(
            hd_strategy=HDStrategy.from_value(request.hd_strategy),
            hd_strategy_resize_limit=request.hd_strategy_resize_limit,
            hd_strategy_crop_margin=request.hd_strategy_crop_margin,
            hd_strategy_crop_trigger_size=request.hd_strategy_crop_trigger_size,
        )
        rgb = await run_inference(lambda: _prepare_rgb(image))

        try:
            detector = await run_inference(self._get_detector)
            detections = await detector.detect(rgb)

            mask, pixels, has_mask = await run_inference(
                lambda: _prepare_mask_and_pixels(
                    rgb,
                    detections,
                    request.mask_dilation,
                )
            )

            if not has_mask:
                return await run_inference(
                    lambda: _build_result(
                        pixels,
                        mask,
                        detections,
                        detector.name,
                        "no-op",
                    )
                )

            inpainter = await run_inference(
                lambda: get_inpainter(
                    has_gpu=self.device.has_gpu,
                    model_key="auto",
                    device_info=self.device,
                )
            )
            inpainted = await inpainter.inpaint(pixels, mask, config)

            return await run_inference(
                lambda: _build_result(
                    inpainted,
                    mask,
                    detections,
                    detector.name,
                    inpainter.name,
                )
            )
        finally:
            rgb.close()
