from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from PIL import Image


@dataclass(frozen=True)
class OCRInputRegion:
    id: str
    bbox: tuple[int, int, int, int]
    source: str = "model"
    detector_model_key: str = ""


@dataclass(frozen=True)
class OCRTextResult:
    id: str
    bbox: tuple[int, int, int, int]
    text: str
    score: float
    source: str = "model"
    detector_model_key: str = ""
    model_key: str = ""


class BaseOCR(ABC):
    key: str = "base"
    name: str = "Base OCR"

    async def recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        return self._recognize(image, regions, language)

    @abstractmethod
    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        raise NotImplementedError
