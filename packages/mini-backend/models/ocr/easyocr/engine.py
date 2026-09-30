from __future__ import annotations

import logging
import threading
from collections.abc import Sequence
from typing import Protocol, cast

import cv2
import numpy as np
from numpy.typing import NDArray

from models.errors import MissingDependencyError, ModelNotInstalledError
from models.ocr.base_ocr import RegionCropOCR, RgbArray
from models.ocr.easyocr.storage import resolve_easyocr_storage_dir
from models.onnx_utils import translate_inference_error

logger = logging.getLogger(__name__)


class _EasyOcrReader(Protocol):
    def recognize(
        self,
        img_cv_grey: NDArray[np.uint8],
        horizontal_list: None,
        free_list: None,
        paragraph: bool,
        detail: int,
        reformat: bool,
    ) -> list[tuple[object, str, float]]: ...


class EasyOCREngine(RegionCropOCR):
    key = "easyocr"
    name = "EasyOCR"

    def __init__(self, languages: Sequence[str] | None = None, use_gpu: bool = False) -> None:
        self._languages: list[str] = list(languages or ("en",))
        self._use_gpu = use_gpu
        self._lock = threading.Lock()
        self._reader: _EasyOcrReader | None = None

    def _ensure_reader(self) -> _EasyOcrReader:
        reader = self._reader
        if reader is not None:
            return reader
        with self._lock:
            if self._reader is None:
                self._reader = self._build_reader()
            return self._reader

    def _build_reader(self) -> _EasyOcrReader:
        try:
            import easyocr  # pyright: ignore[reportMissingTypeStubs]
        except ImportError as exc:
            raise MissingDependencyError("easyocr is not installed in the local environment") from exc

        storage_dir = resolve_easyocr_storage_dir(self._languages)
        reader_kwargs: dict[str, object] = {"gpu": self._use_gpu, "verbose": False}
        if storage_dir is not None:
            # Managed desktop mode: weights are provisioned by the Model Manager only.
            reader_kwargs["model_storage_directory"] = str(storage_dir)
            reader_kwargs["download_enabled"] = False

        logger.info("easyocr loading", extra={"languages": self._languages, "gpu": self._use_gpu})
        try:
            reader = easyocr.Reader(  # pyright: ignore[reportUnknownMemberType, reportCallIssue]
                self._languages,
                **reader_kwargs,  # pyright: ignore[reportArgumentType] - easyocr ships no stubs
            )
        except FileNotFoundError as exc:
            raise ModelNotInstalledError(
                "EasyOCR weights are not installed for this language. "
                "Install them in the Model Manager before using EasyOCR."
            ) from exc
        return cast(_EasyOcrReader, reader)

    def _recognize_crop(self, crop: RgbArray, language: str) -> tuple[str, float]:
        reader = self._ensure_reader()
        gray = np.ascontiguousarray(cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY), dtype=np.uint8)
        try:
            # recognize() bypasses EasyOCR's CRAFT detector: regions are already
            # detected upstream, so each crop is treated as one text line.
            predictions = reader.recognize(
                gray,
                horizontal_list=None,
                free_list=None,
                paragraph=False,
                detail=1,
                reformat=False,
            )
        except RuntimeError as exc:
            raise translate_inference_error(exc, model_key=self.key) from exc

        texts: list[str] = []
        confidence_sum = 0.0
        for _box, raw_text, confidence in predictions:
            text = raw_text.strip()
            if text:
                texts.append(text)
                confidence_sum += float(confidence)
        if not texts:
            return "", 0.0
        return " ".join(texts), confidence_sum / len(texts)
