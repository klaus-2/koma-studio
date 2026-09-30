"""Segmentation contract. Implementations are synchronous and CPU-bound; the
public ``segment`` coroutine offloads them so the event loop is never blocked."""

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass
from typing import ClassVar, Literal

from models.geometry import BBox

type RegionSource = Literal["model", "manual"]


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
        return await asyncio.to_thread(self._segment, image_bytes, tuple(regions))

    @abstractmethod
    def _segment(
        self,
        image_bytes: bytes,
        regions: Sequence[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        """Synchronous implementation. Must be safe to call from worker threads."""
