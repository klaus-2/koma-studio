from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, replace
from typing import ClassVar

from PIL import Image

from core.config import get_config
from models.errors import InvalidInputImageError
from models.execution import run_inference
from models.geometry import BBox
from utils.resolution_policy import stage_resolution_plan

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

        plan = stage_resolution_plan(
            "detection", width, height, get_config().working_resolution_megapixels
        )
        with image.convert("RGB") as rgb:
            rgb.load()
            if not plan.downscaled:
                return self._detect(rgb)
            working = rgb.resize(
                (plan.working_width, plan.working_height), Image.Resampling.BICUBIC
            )
            try:
                scaled = self._detect(working)
            finally:
                working.close()
            scale_x = plan.width / plan.working_width
            scale_y = plan.height / plan.working_height
            remapped: list[TextDetection] = []
            for detection in scaled:
                x1, y1, x2, y2 = detection.bbox
                remapped.append(
                    replace(
                        detection,
                        bbox=(
                            min(plan.width, max(0, round(x1 * scale_x))),
                            min(plan.height, max(0, round(y1 * scale_y))),
                            min(plan.width, max(0, round(x2 * scale_x))),
                            min(plan.height, max(0, round(y2 * scale_y))),
                        ),
                    )
                )
            return remapped

    @abstractmethod
    def _detect(self, image: Image.Image) -> list[TextDetection]:
        """Synchronous implementation; must not retain or mutate image."""
