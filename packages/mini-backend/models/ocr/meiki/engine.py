from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

from core.device import get_device_info, get_onnx_execution_providers
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from models.ocr.meiki.storage import resolve_meiki_model_dir


_HORIZONTAL_MODEL_FILE = "meiki.text.rec.v0.960x32.onnx"
_VERTICAL_MODEL_FILE = "meiki.text.rec.v0.vertical.32x480.onnx"
_HORIZONTAL_WIDTH = 960
_VERTICAL_HEIGHT = 480
_INPUT_HEIGHT = 32
_INPUT_WIDTH = 32
_CONFIDENCE_THRESHOLD = 0.1
_OVERLAP_THRESHOLD = 0.3
_EPSILON = 1e-6


@dataclass(frozen=True)
class _CharPrediction:
    char: str
    bbox: tuple[int, int, int, int]
    confidence: float
    primary_start: float
    primary_end: float


class MeikiOcrEngine(BaseOCR):
    key = "meiki_ocr"
    name = "Meiki OCR"

    def __init__(
        self,
        providers: Sequence[str] | None = None,
        model_dir: str | Path | None = None,
        confidence_threshold: float = _CONFIDENCE_THRESHOLD,
    ) -> None:
        resolved_model_dir = (
            Path(model_dir).expanduser().resolve()
            if model_dir
            else resolve_meiki_model_dir()
        )
        if resolved_model_dir is None:
            raise RuntimeError(
                "Managed models directory is not configured for Meiki OCR. Check KOMA_MODELS_ROOT.",
            )
        self.model_dir = Path(resolved_model_dir)
        self.horizontal_model_path = self.model_dir / _HORIZONTAL_MODEL_FILE
        self.vertical_model_path = self.model_dir / _VERTICAL_MODEL_FILE
        self.providers = (
            list(providers)
            if providers
            else get_onnx_execution_providers(get_device_info())
        )
        self.confidence_threshold = max(0.0, float(confidence_threshold))
        self.horizontal_session: ort.InferenceSession | None = None
        self.vertical_session: ort.InferenceSession | None = None

    def _ensure_sessions(self) -> None:
        if self.horizontal_session is not None and self.vertical_session is not None:
            return
        if (
            not self.horizontal_model_path.exists()
            or not self.vertical_model_path.exists()
        ):
            raise FileNotFoundError(
                f"Meiki OCR models not found in {self.model_dir}",
            )
        self.horizontal_session = ort.InferenceSession(
            str(self.horizontal_model_path), providers=self.providers
        )
        self.vertical_session = ort.InferenceSession(
            str(self.vertical_model_path), providers=self.providers
        )

    @staticmethod
    def _crop_region(image: Image.Image, region: OCRInputRegion) -> np.ndarray:
        width, height = image.size
        x1, y1, x2, y2 = region.bbox
        left = max(0, min(x1, x2))
        top = max(0, min(y1, y2))
        right = min(width, max(x1, x2))
        bottom = min(height, max(y1, y2))
        if right <= left or bottom <= top:
            return np.zeros((_INPUT_HEIGHT, _HORIZONTAL_WIDTH, 3), dtype=np.uint8)
        crop = image.crop((left, top, right, bottom)).convert("RGB")
        return np.asarray(crop)

    @staticmethod
    def _is_vertical(region_image: np.ndarray) -> bool:
        height, width = region_image.shape[:2]
        # Official Meiki docs: vertical support is beta, horizontal is primary.
        # Only use vertical model when the region is clearly tall (height > 1.5x width)
        # AND has sufficient height to be meaningful vertical text.
        return height > max(1, int(width * 1.5)) and height >= 64

    @staticmethod
    def _preprocess_horizontal(image: np.ndarray) -> tuple[np.ndarray, int, int, int]:
        height, width = image.shape[:2]
        if height <= 0 or width <= 0:
            raise ValueError("Empty region for OCR.")

        new_height = _INPUT_HEIGHT
        new_width = int(round(width * (new_height / height)))
        if new_width > _HORIZONTAL_WIDTH:
            scale = _HORIZONTAL_WIDTH / new_width
            new_width = _HORIZONTAL_WIDTH
            new_height = max(1, int(round(new_height * scale)))

        resized = cv2.resize(
            image, (new_width, new_height), interpolation=cv2.INTER_LINEAR
        )
        pad_width = _HORIZONTAL_WIDTH - new_width
        pad_height = _INPUT_HEIGHT - new_height
        if len(resized.shape) == 2:
            padded = np.pad(
                resized, ((0, pad_height), (0, pad_width)), constant_values=0
            )
            padded = cv2.cvtColor(padded, cv2.COLOR_GRAY2RGB)
        else:
            padded = np.pad(
                resized, ((0, pad_height), (0, pad_width), (0, 0)), constant_values=0
            )
        input_tensor = (np.transpose(padded.astype(np.float32), (2, 0, 1))) / 255.0
        return np.expand_dims(input_tensor, axis=0), new_width, width, height

    @staticmethod
    def _preprocess_vertical(image: np.ndarray) -> tuple[np.ndarray, int, int, int]:
        height, width = image.shape[:2]
        if height <= 0 or width <= 0:
            raise ValueError("Empty region for OCR.")

        new_width = _INPUT_WIDTH
        new_height = int(round(height * (new_width / width)))
        if new_height > _VERTICAL_HEIGHT:
            scale = _VERTICAL_HEIGHT / new_height
            new_height = _VERTICAL_HEIGHT
            new_width = max(1, int(round(new_width * scale)))

        resized = cv2.resize(
            image, (new_width, new_height), interpolation=cv2.INTER_LINEAR
        )
        pad_width = _INPUT_WIDTH - new_width
        pad_height = _VERTICAL_HEIGHT - new_height
        if len(resized.shape) == 2:
            padded = np.pad(
                resized, ((0, pad_height), (0, pad_width)), constant_values=0
            )
            padded = cv2.cvtColor(padded, cv2.COLOR_GRAY2RGB)
        else:
            padded = np.pad(
                resized, ((0, pad_height), (0, pad_width), (0, 0)), constant_values=0
            )
        input_tensor = (np.transpose(padded.astype(np.float32), (2, 0, 1))) / 255.0
        return np.expand_dims(input_tensor, axis=0), new_height, width, height

    def _postprocess_horizontal(
        self,
        labels: np.ndarray,
        boxes: np.ndarray,
        scores: np.ndarray,
        original_width: int,
        original_height: int,
        effective_width: int,
    ) -> tuple[str, float]:
        accepted: list[_CharPrediction] = []
        candidates: list[_CharPrediction] = []
        for label, box, score in zip(labels, boxes, scores, strict=False):
            confidence = float(score)
            if confidence < self.confidence_threshold:
                continue
            char = chr(int(label))
            rx1, ry1, rx2, ry2 = [float(value) for value in box]
            rx1 = min(rx1, float(effective_width))
            rx2 = min(rx2, float(effective_width))
            cx1 = int((rx1 / max(effective_width, 1)) * original_width)
            cx2 = int((rx2 / max(effective_width, 1)) * original_width)
            cy1 = int((ry1 / _INPUT_HEIGHT) * original_height)
            cy2 = int((ry2 / _INPUT_HEIGHT) * original_height)
            candidates.append(
                _CharPrediction(
                    char=char,
                    bbox=(cx1, cy1, cx2, cy2),
                    confidence=confidence,
                    primary_start=float(cx1),
                    primary_end=float(cx2),
                )
            )

        candidates.sort(key=lambda item: item.confidence, reverse=True)
        for candidate in candidates:
            width = candidate.primary_end - candidate.primary_start + _EPSILON
            keep = True
            for current in accepted:
                overlap = max(
                    0.0,
                    min(candidate.primary_end, current.primary_end)
                    - max(candidate.primary_start, current.primary_start),
                )
                if overlap / width > _OVERLAP_THRESHOLD:
                    keep = False
                    break
            if keep:
                accepted.append(candidate)

        accepted.sort(key=lambda item: item.primary_start)
        text = "".join(item.char for item in accepted)
        mean_score = (
            float(np.mean([item.confidence for item in accepted])) if accepted else 0.0
        )
        return text, mean_score

    def _postprocess_vertical(
        self,
        labels: np.ndarray,
        boxes: np.ndarray,
        scores: np.ndarray,
        original_width: int,
        original_height: int,
        effective_height: int,
    ) -> tuple[str, float]:
        accepted: list[_CharPrediction] = []
        candidates: list[_CharPrediction] = []
        for label, box, score in zip(labels, boxes, scores, strict=False):
            confidence = float(score)
            if confidence < self.confidence_threshold:
                continue
            char = chr(int(label))
            rx1, ry1, rx2, ry2 = [float(value) for value in box]
            ry1 = min(ry1, float(effective_height))
            ry2 = min(ry2, float(effective_height))
            cx1 = int((rx1 / _INPUT_WIDTH) * original_width)
            cx2 = int((rx2 / _INPUT_WIDTH) * original_width)
            cy1 = int((ry1 / max(effective_height, 1)) * original_height)
            cy2 = int((ry2 / max(effective_height, 1)) * original_height)
            candidates.append(
                _CharPrediction(
                    char=char,
                    bbox=(cx1, cy1, cx2, cy2),
                    confidence=confidence,
                    primary_start=float(cy1),
                    primary_end=float(cy2),
                )
            )

        candidates.sort(key=lambda item: item.confidence, reverse=True)
        for candidate in candidates:
            height = candidate.primary_end - candidate.primary_start + _EPSILON
            keep = True
            for current in accepted:
                overlap = max(
                    0.0,
                    min(candidate.primary_end, current.primary_end)
                    - max(candidate.primary_start, current.primary_start),
                )
                if overlap / height > _OVERLAP_THRESHOLD:
                    keep = False
                    break
            if keep:
                accepted.append(candidate)

        accepted.sort(key=lambda item: item.primary_start)
        text = "".join(item.char for item in accepted)
        mean_score = (
            float(np.mean([item.confidence for item in accepted])) if accepted else 0.0
        )
        return text, mean_score

    def _recognize(
        self, image: Image.Image, regions: list[OCRInputRegion], language: str = "ja"
    ) -> list[OCRTextResult]:
        _ = language
        self._ensure_sessions()
        assert self.horizontal_session is not None
        assert self.vertical_session is not None

        results: list[OCRTextResult] = []
        for region in regions:
            region_image = self._crop_region(image, region)
            use_vertical = self._is_vertical(region_image)
            if use_vertical:
                input_tensor, effective_height, original_width, original_height = (
                    self._preprocess_vertical(region_image)
                )
                labels, boxes, scores = self.vertical_session.run(
                    None,
                    {
                        "images": input_tensor,
                        "orig_target_sizes": np.array(
                            [[32, _VERTICAL_HEIGHT]], dtype=np.int64
                        ),
                    },
                )
                text, score = self._postprocess_vertical(
                    labels[0],
                    boxes[0],
                    scores[0],
                    original_width=original_width,
                    original_height=original_height,
                    effective_height=effective_height,
                )
            else:
                input_tensor, effective_width, original_width, original_height = (
                    self._preprocess_horizontal(region_image)
                )
                labels, boxes, scores = self.horizontal_session.run(
                    None,
                    {
                        "images": input_tensor,
                        "orig_target_sizes": np.array(
                            [[_HORIZONTAL_WIDTH, _INPUT_HEIGHT]], dtype=np.int64
                        ),
                    },
                )
                text, score = self._postprocess_horizontal(
                    labels[0],
                    boxes[0],
                    scores[0],
                    original_width=original_width,
                    original_height=original_height,
                    effective_width=effective_width,
                )

            results.append(
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text=text,
                    score=score,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key=self.key,
                )
            )

        return results
