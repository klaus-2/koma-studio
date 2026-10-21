"""Text-detection seeding shared by POST /ocr and the batch Recognize Text
stage. Owns the detector lifecycle and the detection-to-seed adaptation."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

from PIL import Image

from core.device import release_gpu_memory
from models.detection.base_detector import TextDetection
from models.detection.factory import get_detector
from pipelines.batch.records import (
    DetectionRecord,
    OCRSeed,
    normalize_bbox,
    normalize_stage_source,
)


@dataclass(frozen=True, slots=True)
class DetectorFields:
    bbox: list[int]
    source: str
    model_key: str


def normalize_detector_fields(
    det: object, fallback_model: str
) -> DetectorFields | None:
    bbox = normalize_bbox(getattr(det, "bbox", None))
    if bbox is None:
        return None
    return DetectorFields(
        bbox=list(bbox),
        source=normalize_stage_source(getattr(det, "source", "model")),
        model_key=str(getattr(det, "model_key", "") or fallback_model),
    )


async def run_text_detector(
    image: Image.Image, *, has_gpu: bool, model_key: str
) -> Sequence[TextDetection]:
    detector = get_detector(task="text", has_gpu=has_gpu, model_key=model_key)
    try:
        return await detector.detect(image)
    finally:
        release_gpu_memory()


async def detect_text_seeds(
    image: Image.Image, *, has_gpu: bool, model_key: str
) -> list[OCRSeed]:
    """Resolve the text detector, run one detection pass, and map the
    detections onto OCR seeds — the shared empty-seeds path of POST /ocr
    and the batch Recognize Text stage."""
    detections = await run_text_detector(image, has_gpu=has_gpu, model_key=model_key)
    seeds: list[OCRSeed] = []
    for index, det in enumerate(detections, start=1):
        fields = normalize_detector_fields(det, model_key)
        if fields is None:
            continue
        seeds.append(
            OCRSeed(
                id=f"det-{index}",
                bbox=fields.bbox,
                source=fields.source,
                detector_model_key=fields.model_key,
            )
        )
    return seeds


def ocr_seeds_from_detections(
    detections: Sequence[DetectionRecord], default_model: str
) -> list[OCRSeed]:
    return [
        OCRSeed(
            id=det["id"],
            bbox=list(det["bbox"]),
            source=det["source"],
            detector_model_key=det["model_key"] or default_model,
        )
        for det in detections
    ]
