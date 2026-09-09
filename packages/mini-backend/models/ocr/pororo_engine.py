from __future__ import annotations

from typing import Any

import numpy as np
from PIL import Image

from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult


class PororoOCREngine(BaseOCR):
    key = "pororo"
    name = "Pororo OCR (Korean)"

    def __init__(self, language: str = "ko", expansion_percentage: int = 5) -> None:
        self.language = language or "ko"
        self.expansion_percentage = max(0, expansion_percentage)
        self._model: Any | None = None

    def _ensure_model(self) -> None:
        if self._model is not None:
            return
        from models.ocr.pororo.main import PororoOcr

        try:
            self._model = PororoOcr(lang=self.language)
        except RuntimeError as exc:
            raise RuntimeError(
                "Pororo OCR models are not installed locally. "
                "Install the model in the Model Manager before using it.",
            ) from exc

    def _expand_box(
        self,
        bbox: tuple[int, int, int, int],
        width: int,
        height: int,
    ) -> tuple[int, int, int, int]:
        x1, y1, x2, y2 = bbox
        box_w = max(1, x2 - x1)
        box_h = max(1, y2 - y1)
        dx = int(box_w * self.expansion_percentage / 100.0)
        dy = int(box_h * self.expansion_percentage / 100.0)
        return max(0, x1 - dx), max(0, y1 - dy), min(width, x2 + dx), min(height, y2 + dy)

    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "ko",
    ) -> list[OCRTextResult]:
        self._ensure_model()
        assert self._model is not None

        rgb = np.asarray(image.convert("RGB"))
        img_h, img_w = rgb.shape[:2]
        results: list[OCRTextResult] = []

        for region in regions:
            x1, y1, x2, y2 = self._expand_box(region.bbox, img_w, img_h)
            text = ""
            score = 0.0

            if x2 > x1 and y2 > y1:
                crop_rgb = rgb[y1:y2, x1:x2]
                crop_bgr = crop_rgb[:, :, ::-1]
                try:
                    self._model.run_ocr(crop_bgr)
                    payload = self._model.get_ocr_result() or {}
                    pieces = payload.get("description", [])
                    text = " ".join(str(piece).strip() for piece in pieces if str(piece).strip()).strip()
                    score = 1.0 if text else 0.0
                except Exception:
                    text = ""
                    score = 0.0

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
