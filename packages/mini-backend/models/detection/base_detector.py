from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from PIL import Image


@dataclass(frozen=True)
class TextDetection:
    bbox: tuple[int, int, int, int]
    score: float
    label: str = "text"
    source: str = "model"
    model_key: str = ""
    foreground_rgb: tuple[int, int, int] | None = None
    structural_type: str | None = None
    structural_confidence: float | None = None
    structural_source: str | None = None
    matched_reference_image: str | None = None


class BaseDetector(ABC):
    key: str = "base"
    name: str = "Base Detector"

    async def detect(self, image: Image.Image) -> list[TextDetection]:
        return self._detect(image)

    @abstractmethod
    def _detect(self, image: Image.Image) -> list[TextDetection]:
        raise NotImplementedError
