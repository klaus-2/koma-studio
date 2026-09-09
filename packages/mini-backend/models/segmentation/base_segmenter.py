from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal


@dataclass(frozen=True)
class SegmentInputRegion:
    id: str
    bbox: tuple[int, int, int, int]
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""


@dataclass(frozen=True)
class SegmentResultRegion:
    id: str
    bbox: tuple[int, int, int, int]
    segment_boxes: list[tuple[int, int, int, int]] = field(default_factory=list)
    merged_boxes: list[tuple[int, int, int, int]] = field(default_factory=list)
    source: Literal["model", "manual"] = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""
    segment_model_key: str = ""
    mask_base64: str = ""


class BaseSegmenter(ABC):
    key: str = "base_segmenter"
    name: str = "Base Segmenter"

    async def segment(
        self,
        image_bytes: bytes,
        regions: list[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        return self._segment(image_bytes=image_bytes, regions=regions)

    @abstractmethod
    def _segment(
        self,
        image_bytes: bytes,
        regions: list[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        raise NotImplementedError
