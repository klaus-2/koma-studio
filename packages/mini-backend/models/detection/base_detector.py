from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar

from PIL import Image

from models.errors import InvalidInputImageError
from models.execution import run_inference
from models.geometry import BBox

type Bbox = BBox
type Rgb = tuple[int, int, int]

_MAX_IMAGE_PIXELS = 32_000_000


@dataclass(frozen=True, slots=True)
class TextDetection:
    bbox: Bbox
    score: float
    label: str = "text"
    source: str = "model"
    model_key: str = ""
    foreground_rgb: Rgb | None = None
    structural_type: str | None = None
    structural_confidence: float | None = None
    structural_source: str | None = None
    matched_reference_image: str | None = None


class BaseDetector(ABC):
    key: ClassVar[str] = "base"
    name: ClassVar[str] = "Base Detector"

    async def detect(self, image: Image.Image) -> list[TextDetection]:
        """Borrow image read-only until completion, including cancellation."""
        return await run_inference(lambda: self._detect_validated(image))

    def _detect_validated(self, image: Image.Image) -> list[TextDetection]:
        width, height = image.size
        if width < 1 or height < 1 or width * height > _MAX_IMAGE_PIXELS:
            raise InvalidInputImageError("Image dimensions exceed detection limits")

        with image.convert("RGB") as rgb:
            rgb.load()
            return self._detect(rgb)

    @abstractmethod
    def _detect(self, image: Image.Image) -> list[TextDetection]:
        """Synchronous implementation; must not retain or mutate image."""
