"""OCR engine contract: region batching, cancellation and off-loop execution.

``BaseOCR`` owns batching, thread offload, cancellation and OOM policy.
Engines that recognise one region crop at a time implement ``RegionCropOCR._recognize_crop``;
engines with real batched backends override ``_recognize`` (the legacy contract)
and keep working unchanged.
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import ClassVar

import numpy as np
from numpy.typing import NDArray
from PIL import Image

from models.errors import GpuOutOfMemoryError, InferenceError
from models.geometry import expand_bbox

logger = logging.getLogger(__name__)

type RgbArray = NDArray[np.uint8]
type BatchRunner = Callable[[list[OCRInputRegion]], list[OCRTextResult]]


@dataclass(frozen=True, slots=True)
class OCRInputRegion:
    id: str
    bbox: tuple[int, int, int, int]
    source: str = "model"
    detector_model_key: str = ""


@dataclass(frozen=True, slots=True)
class OCRTextResult:
    id: str
    bbox: tuple[int, int, int, int]
    text: str
    score: float
    source: str = "model"
    detector_model_key: str = ""
    model_key: str = ""

    @classmethod
    def from_region(
        cls, region: OCRInputRegion, *, text: str, score: float, model_key: str
    ) -> OCRTextResult:
        return cls(
            id=region.id,
            bbox=region.bbox,
            text=text,
            score=score,
            source=region.source,
            detector_model_key=region.detector_model_key,
            model_key=model_key,
        )

    @classmethod
    def empty(cls, region: OCRInputRegion, *, model_key: str) -> OCRTextResult:
        return cls.from_region(region, text="", score=0.0, model_key=model_key)


def to_rgb_array(image: Image.Image) -> RgbArray:
    return np.asarray(image.convert("RGB"), dtype=np.uint8)


class BaseOCR(ABC):
    key: ClassVar[str] = "base"
    name: ClassVar[str] = "Base OCR"
    batch_size: ClassVar[int] = 8

    async def recognize(
        self,
        image: Image.Image,
        regions: Sequence[OCRInputRegion],
        language: str = "en",
        *,
        cancellation_event: asyncio.Event | None = None,
    ) -> list[OCRTextResult]:
        return await self._run_batches(
            regions,
            cancellation_event,
            lambda batch: self._recognize(image, batch, language),
        )

    def release(self) -> None:
        """Drop loaded weights. Overridden by engines that hold device memory."""

    @abstractmethod
    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        """Synchronous recognition of one batch; always invoked off the event loop."""

    async def _run_batches(
        self,
        regions: Sequence[OCRInputRegion],
        cancellation_event: asyncio.Event | None,
        run_batch: BatchRunner,
    ) -> list[OCRTextResult]:
        total = len(regions)
        results: list[OCRTextResult] = []
        logger.info("ocr started", extra={"model_key": self.key, "regions": total})

        for start in range(0, total, self.batch_size):
            if cancellation_event is not None and cancellation_event.is_set():
                results.extend(
                    OCRTextResult.empty(region, model_key=self.key) for region in regions[start:]
                )
                logger.info(
                    "ocr cancelled",
                    extra={"model_key": self.key, "done": start, "regions": total},
                )
                break

            batch = list(regions[start : start + self.batch_size])
            try:
                results.extend(await asyncio.to_thread(run_batch, batch))
            except GpuOutOfMemoryError:
                logger.error("ocr out of memory, releasing engine", extra={"model_key": self.key})
                self.release()
                raise

        return results


class RegionCropOCR(BaseOCR):
    """Engine that recognises one pre-detected region crop at a time.

    Subclasses implement only ``_recognize_crop``; batching, threading, bbox
    expansion, cancellation and OOM policy are handled here.
    """

    expansion_percentage: ClassVar[int] = 5

    @abstractmethod
    def _recognize_crop(self, crop: RgbArray, language: str) -> tuple[str, float]:
        """Return ``(text, confidence)``. Raise ``InferenceError`` subclasses on failure."""

    async def recognize(
        self,
        image: Image.Image,
        regions: Sequence[OCRInputRegion],
        language: str = "en",
        *,
        cancellation_event: asyncio.Event | None = None,
    ) -> list[OCRTextResult]:
        rgb = await asyncio.to_thread(to_rgb_array, image)
        return await self._run_batches(
            regions,
            cancellation_event,
            lambda batch: self._recognize_batch(rgb, batch, language),
        )

    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        return self._recognize_batch(to_rgb_array(image), regions, language)

    def _recognize_batch(
        self,
        rgb: RgbArray,
        regions: Sequence[OCRInputRegion],
        language: str,
    ) -> list[OCRTextResult]:
        height, width = rgb.shape[:2]
        results: list[OCRTextResult] = []
        for region in regions:
            bbox = expand_bbox(region.bbox, width, height, self.expansion_percentage)
            if bbox is None:
                results.append(OCRTextResult.empty(region, model_key=self.key))
                continue
            x1, y1, x2, y2 = bbox
            try:
                text, score = self._recognize_crop(rgb[y1:y2, x1:x2], language)
            except GpuOutOfMemoryError:
                raise
            except InferenceError as exc:
                logger.warning(
                    "ocr region failed",
                    extra={"model_key": self.key, "region_id": region.id, "error": str(exc)},
                )
                text, score = "", 0.0
            results.append(
                OCRTextResult.from_region(region, text=text, score=score, model_key=self.key)
            )
        return results
