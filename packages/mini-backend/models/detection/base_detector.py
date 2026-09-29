from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import ClassVar

from PIL import Image

type Bbox = tuple[int, int, int, int]
type Rgb = tuple[int, int, int]


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
        # ONNX inference is CPU/GPU-bound and takes hundreds of milliseconds;
        # running it inline would stall every other coroutine on the loop.
        # onnxruntime sessions are safe for concurrent ``run`` calls.
        return await asyncio.to_thread(self._detect, image)

    @abstractmethod
    def _detect(self, image: Image.Image) -> list[TextDetection]: ...
