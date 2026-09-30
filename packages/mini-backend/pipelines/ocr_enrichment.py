"""Foreground-gradient enrichment for OCR records.

CPU-bound (numpy over one crop per region): callers must run this in a worker
thread. Lives in ``pipelines`` so batch stages stop importing from ``routers``.
"""

from __future__ import annotations

import numpy as np
from PIL import Image

from models.detection.font.foreground_color import extract_foreground_gradient
from pipelines.batch.records import (
    BBox,
    ForegroundGradientRecord,
    OCRRecord,
    normalize_bbox,
)

_MIN_CROP_SIDE_PX = 2


def extract_gradient_record(
    image: Image.Image, bbox: BBox
) -> ForegroundGradientRecord | None:
    x1, y1, x2, y2 = bbox
    left, top = max(0, min(x1, x2)), max(0, min(y1, y2))
    right, bottom = min(image.width, max(x1, x2)), min(image.height, max(y1, y2))
    if right - left < _MIN_CROP_SIDE_PX or bottom - top < _MIN_CROP_SIDE_PX:
        return None
    crop = np.asarray(image.crop((left, top, right, bottom)).convert("RGB"))
    gradient = extract_foreground_gradient(crop)
    if gradient is None:
        return None
    return ForegroundGradientRecord(
        start_rgb=[int(channel) for channel in gradient.start_rgb],
        end_rgb=[int(channel) for channel in gradient.end_rgb],
        angle_degrees=float(gradient.angle_degrees),
    )


def enrich_ocr_record_with_gradient(image: Image.Image, record: OCRRecord) -> OCRRecord:
    """Return ``record`` with ``foreground_gradient`` computed exactly once.

    Presence of the key marks completion, so a region with no detectable
    gradient stores ``None`` and is never re-analysed on cache hits.
    """
    if "foreground_gradient" in record:
        return record
    bbox = normalize_bbox(record["bbox"])
    enriched = record.copy()
    enriched["foreground_gradient"] = (
        None if bbox is None else extract_gradient_record(image, bbox)
    )
    return enriched
