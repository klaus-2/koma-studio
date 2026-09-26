"""Lazily-initialised, thread-safe YuzuMarker font style detector."""

from __future__ import annotations

import logging
import threading

from PIL import Image

from models.detection.font_style import YuzuFontStyleDetector
from models.detection.font_style.storage import font_style_runtime_ready
from pipelines.batch.records import DetectionRecord, normalize_bbox

logger = logging.getLogger(__name__)

_detector_lock = threading.Lock()
_detector: YuzuFontStyleDetector | None = None


def get_font_style_detector() -> YuzuFontStyleDetector | None:
    """Return the shared detector, or None when the model is not bundled."""
    global _detector
    if not font_style_runtime_ready():
        return None
    if _detector is None:
        with _detector_lock:
            if _detector is None:
                _detector = YuzuFontStyleDetector()
    return _detector


def clear_font_style_detector() -> None:
    """Drop the shared detector so its ONNX session can be garbage-collected."""
    global _detector
    with _detector_lock:
        _detector = None


def enrich_regions_with_font_style(
    image: Image.Image,
    regions: list[DetectionRecord],
) -> None:
    """Attach ``font_style`` to each region in-place. CPU-bound: call via a thread."""
    detector = get_font_style_detector()
    if detector is None or not regions:
        return
    page_w, page_h = image.size
    crops: list[Image.Image] = []
    targets: list[DetectionRecord] = []
    for region in regions:
        bbox = normalize_bbox(region["bbox"])
        if bbox is None:
            continue
        x1, y1 = max(0, bbox[0]), max(0, bbox[1])
        x2, y2 = min(page_w, bbox[2]), min(page_h, bbox[3])
        if x2 <= x1 or y2 <= y1:
            continue
        crops.append(image.crop((x1, y1, x2, y2)))
        targets.append(region)
    if not crops:
        return
    try:
        predictions = detector.detect(
            crops, original_widths=[page_w] * len(crops), top_k=1
        )
    except Exception:  # noqa: BLE001 — optional enrichment; never fail detection.
        logger.warning("font style enrichment failed", exc_info=True)
        return
    for region, prediction in zip(targets, predictions, strict=True):
        region["font_style"] = dict(prediction.to_dict())
