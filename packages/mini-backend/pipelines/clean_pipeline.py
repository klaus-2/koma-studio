"""Clean pipeline: detect → mask → inpaint."""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from typing import Protocol, cast

import cv2
import numpy as np
from numpy.typing import NDArray
from PIL import Image

from core.device import DeviceInfo, release_gpu_memory
from models.detection.factory import get_detector
from models.geometry import BBox
from models.inpainting.base_inpainter import HDStrategy, InpaintConfig
from models.inpainting.factory import get_inpainter
from schemas.inpainting import CleanRequest, CleanResult

type MaskArray = NDArray[np.uint8]

_DILATION_ITERATIONS = 2


class HasBBox(Protocol):
    @property
    def bbox(self) -> BBox: ...


def build_detection_mask(
    size: tuple[int, int], detections: Sequence[HasBBox], dilation: int
) -> MaskArray:
    """CPU-bound. Rasterise detection boxes and grow them by ``dilation``."""
    width, height = size
    mask: MaskArray = np.zeros((height, width), dtype=np.uint8)
    for det in detections:
        x1, y1, x2, y2 = det.bbox
        mask[max(0, y1) : min(height, y2), max(0, x1) : min(width, x2)] = 255
    if dilation > 0 and mask.any():
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (dilation, dilation))
        mask = cast(MaskArray, cv2.dilate(mask, kernel, iterations=_DILATION_ITERATIONS))
    return mask


class CleanPipeline:
    __slots__ = ("detector", "device", "inpainter")

    def __init__(self, device: DeviceInfo) -> None:
        self.device = device
        self.detector = get_detector(task="text", has_gpu=device.has_gpu)
        self.inpainter = get_inpainter(device.has_gpu, "auto")

    async def run(self, image: Image.Image, request: CleanRequest) -> CleanResult:
        rgb = image.convert("RGB")
        try:
            detections = await self.detector.detect(rgb)
        finally:
            release_gpu_memory()

        mask = await asyncio.to_thread(
            build_detection_mask, rgb.size, detections, request.mask_dilation
        )
        if not mask.any():
            return CleanResult(
                image=rgb.copy(),
                detections=detections,
                mask=Image.fromarray(mask),
                model_used={"detector": self.detector.name, "inpainter": "no-op"},
            )

        config = InpaintConfig(
            hd_strategy=HDStrategy.from_value(request.hd_strategy),
            hd_strategy_resize_limit=request.hd_strategy_resize_limit,
            hd_strategy_crop_margin=request.hd_strategy_crop_margin,
            hd_strategy_crop_trigger_size=request.hd_strategy_crop_trigger_size,
        )
        try:
            inpainted = await self.inpainter.inpaint(
                np.asarray(rgb, dtype=np.uint8), mask, config
            )
        finally:
            release_gpu_memory()

        return CleanResult(
            image=Image.fromarray(inpainted),
            detections=detections,
            mask=Image.fromarray(mask),
            model_used={"detector": self.detector.name, "inpainter": self.inpainter.name},
        )
