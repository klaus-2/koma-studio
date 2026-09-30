from __future__ import annotations

import threading
from collections.abc import Mapping
from typing import Protocol, cast

import numpy as np
from numpy.typing import NDArray

from models.errors import ModelNotInstalledError
from models.ocr.base_ocr import RegionCropOCR, RgbArray
from models.onnx_utils import translate_inference_error


class _PororoModel(Protocol):
    def run_ocr(self, image: NDArray[np.uint8]) -> object: ...
    def get_ocr_result(self) -> Mapping[str, object] | None: ...


class PororoOCREngine(RegionCropOCR):
    key = "pororo"
    name = "Pororo OCR (Korean)"

    def __init__(self, language: str = "ko") -> None:
        self._language = language or "ko"
        self._lock = threading.Lock()
        self._model: _PororoModel | None = None

    def _ensure_model(self) -> _PororoModel:
        model = self._model
        if model is not None:
            return model
        with self._lock:
            if self._model is None:
                from models.ocr.pororo.main import PororoOcr

                try:
                    self._model = cast(_PororoModel, PororoOcr(lang=self._language))
                except RuntimeError as exc:
                    raise ModelNotInstalledError(
                        "Pororo OCR models are not installed locally. "
                        "Install the model in the Model Manager before using it."
                    ) from exc
            return self._model

    def _recognize_crop(self, crop: RgbArray, language: str) -> tuple[str, float]:
        model = self._ensure_model()
        bgr = np.ascontiguousarray(crop[:, :, ::-1])
        try:
            # PororoOcr keeps the last result as instance state: run + read must be atomic.
            with self._lock:
                model.run_ocr(bgr)
                payload = model.get_ocr_result() or {}
        except (RuntimeError, ValueError) as exc:
            raise translate_inference_error(exc, model_key=self.key) from exc

        pieces = payload.get("description")
        if not isinstance(pieces, list):
            return "", 0.0
        text = " ".join(part for part in (str(piece).strip() for piece in pieces) if part)
        return text, (1.0 if text else 0.0)
