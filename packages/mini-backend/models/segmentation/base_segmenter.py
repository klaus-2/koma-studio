"""Segmentation contracts with bounded asynchronous execution."""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from typing import ClassVar, Literal

from models.errors import InvalidInputImageError
from models.execution import run_inference
from models.geometry import BBox

type RegionSource = Literal["model", "manual"]

_MAX_REGIONS = 256
_MAX_IMAGE_BYTES = 64 * 1024 * 1024


@dataclass(frozen=True, slots=True)
class SegmentInputRegion:
    id: str
    bbox: BBox
    source: RegionSource = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""


@dataclass(frozen=True, slots=True)
class SegmentResultRegion:
    id: str
    bbox: BBox
    segment_boxes: tuple[BBox, ...] = ()
    merged_boxes: tuple[BBox, ...] = ()
    source: RegionSource = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""
    segment_model_key: str = ""
    mask_base64: str = ""


class BaseSegmenter(ABC):
    key: ClassVar[str] = "base_segmenter"
    name: ClassVar[str] = "Base Segmenter"

    async def segment(
        self,
        image_bytes: bytes,
        regions: Sequence[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        if len(regions) > _MAX_REGIONS:
            raise InvalidInputImageError("Too many segmentation regions")
        if len(image_bytes) > _MAX_IMAGE_BYTES:
            raise InvalidInputImageError("Encoded image exceeds the byte budget")

        snapshot = tuple(regions)
        if not snapshot:
            return []

        return await run_inference(
            lambda: self._segment(image_bytes, snapshot)
        )

    @abstractmethod
    def _segment(
        self,
        image_bytes: bytes,
        regions: Sequence[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        """Synchronous implementation; must be safe across worker threads."""
