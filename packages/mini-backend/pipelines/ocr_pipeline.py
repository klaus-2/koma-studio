from __future__ import annotations

import logging

from PIL import Image

from core.config import get_config
from core.device import DeviceInfo
from core.languages import normalize_language_code
from models.detection.factory import get_detector
from models.ocr.base_ocr import OCRInputRegion, OCRTextResult
from models.ocr.factory import get_ocr_engine
from schemas.export import DetectionResult, DetectionType


logger = logging.getLogger(__name__)


class OCRPipeline:
    """Run text detection + OCR and return normalized detections."""

    def __init__(self, device: DeviceInfo) -> None:
        """
        Inicializa o pipeline OCR.

        Args:
            device: Informacoes do dispositivo atual.
        """

        self.device = device
        self.detector = get_detector(
            task="text",
            has_gpu=device.has_gpu,
            model_key=get_config().default_detection_model,
        )

    async def run(
        self, image: Image.Image, language: str = "ja"
    ) -> tuple[list[DetectionResult], str]:
        """Run OCR and return ``(detections, model_key)``.

        The model key is returned instead of stored on the instance: two
        concurrent exports must not report each other's model.
        """

        normalized_language = normalize_language_code(language, default="en", allow_auto=False)
        detections = await self.detector.detect(image)
        if not detections:
            return [], "none"

        regions = [
            OCRInputRegion(
                id=f"det-{index}",
                bbox=(
                    int(detection.bbox[0]),
                    int(detection.bbox[1]),
                    int(detection.bbox[2]),
                    int(detection.bbox[3]),
                ),
                source=detection.source,
                detector_model_key=detection.model_key,
            )
            for index, detection in enumerate(detections, start=1)
        ]

        engine = get_ocr_engine(
            language=normalized_language,
            has_gpu=self.device.has_gpu,
            model_key=None,
        )
        model_key = engine.key
        ocr_results = await engine.recognize(image, regions, language=normalized_language)
        by_id: dict[str, OCRTextResult] = {result.id: result for result in ocr_results}

        converted: list[DetectionResult] = []
        for index, region in enumerate(regions):
            linked = by_id.get(region.id)
            text_value = linked.text.strip() if linked and linked.text else None
            confidence = float(linked.score if linked else detections[index].score)
            converted.append(
                DetectionResult(
                    bbox=region.bbox,
                    confidence=confidence,
                    type=DetectionType.TEXT,
                    text=text_value,
                    language=normalized_language if text_value else None,
                )
            )

        logger.info(
            "OCR pipeline finished: regions=%d, language=%s, model=%s",
            len(converted),
            normalized_language,
            model_key,
        )
        return converted, model_key
