from __future__ import annotations

from typing import Sequence

import cv2
import numpy as np
from PIL import Image

from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from models.ocr.easyocr.storage import (
    ensure_easyocr_models_installed,
    resolve_easyocr_storage_dir,
)


class EasyOCREngine(BaseOCR):
    key = "easyocr"
    name = "EasyOCR"

    def __init__(
        self,
        languages: Sequence[str] | None = None,
        use_gpu: bool = False,
        expansion_percentage: int = 5,
    ) -> None:
        self.languages = list(languages or ("en",))
        self.use_gpu = use_gpu
        self.expansion_percentage = max(0, expansion_percentage)
        self.reader = None

    def _ensure_reader(self):
        if self.reader is not None:
            return self.reader
        try:
            import easyocr  # type: ignore
        except Exception as exc:  # pragma: no cover - optional dependency
            raise RuntimeError("easyocr is not installed in the local environment") from exc

        storage_dir = resolve_easyocr_storage_dir(self.languages)
        reader_kwargs: dict[str, object] = {
            "gpu": self.use_gpu,
            "verbose": False,
        }
        if storage_dir is not None:
            # In managed desktop mode the weights must be installed via the modal.
            reader_kwargs["model_storage_directory"] = str(storage_dir)
            reader_kwargs["download_enabled"] = False

        try:
            self.reader = easyocr.Reader(self.languages, **reader_kwargs)
        except Exception as exc:
            if storage_dir is not None:
                try:
                    ensure_easyocr_models_installed(self.languages, self.use_gpu)
                    self.reader = easyocr.Reader(self.languages, **reader_kwargs)
                    return self.reader
                except Exception:
                    raise RuntimeError(
                        "EasyOCR models are not installed locally for this language. Open the Model Manager and install/reinstall the EasyOCR model.",
                    ) from exc
            raise
        return self.reader

    def _expand_box(
        self, bbox: tuple[int, int, int, int], width: int, height: int
    ) -> tuple[int, int, int, int]:
        x1, y1, x2, y2 = bbox
        box_w = max(1, x2 - x1)
        box_h = max(1, y2 - y1)
        dx = int(box_w * self.expansion_percentage / 100.0)
        dy = int(box_h * self.expansion_percentage / 100.0)
        return (
            max(0, x1 - dx),
            max(0, y1 - dy),
            min(width, x2 + dx),
            min(height, y2 + dy),
        )

    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        reader = self._ensure_reader()
        rgb = np.asarray(image.convert("RGB"))
        img_h, img_w = rgb.shape[:2]
        results: list[OCRTextResult] = []

        for region in regions:
            x1, y1, x2, y2 = self._expand_box(region.bbox, img_w, img_h)
            text = ""
            score = 0.0
            if x2 > x1 and y2 > y1:
                crop = rgb[y1:y2, x1:x2]
                crop_gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
                # Use recognize() directly instead of readtext() to skip
                # EasyOCR's internal CRAFT detection. Since regions are
                # already detected externally, we treat each crop as a
                # single text line by passing horizontal_list=None and
                # free_list=None, which makes EasyOCR use the full crop.
                pred = reader.recognize(
                    crop_gray,
                    horizontal_list=None,
                    free_list=None,
                    paragraph=False,
                    detail=1,
                    reformat=False,
                )
                if pred:
                    parts = []
                    total_score = 0.0
                    for item in pred:
                        if isinstance(item, (list, tuple)) and len(item) >= 2:
                            t = str(item[1]).strip()
                            c = float(item[2]) if len(item) > 2 else 0.0
                            if t:
                                parts.append(t)
                                total_score += c
                    text = " ".join(parts)
                    score = total_score / len(parts) if parts else 0.0

            results.append(
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text=text,
                    score=score,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key=self.key,
                ),
            )

        return results
