"""Typed region records exchanged between pipeline stages and their normalizers."""

from __future__ import annotations

from collections.abc import Sequence
import re
from typing import Literal, NotRequired, SupportsFloat, SupportsInt, TypedDict, cast

type BBox = tuple[int, int, int, int]
type StageSource = Literal["model", "manual"]
type StageName = Literal[
    "input", "queue", "detect", "ocr", "translation", "segment", "clean"
]
type ItemStatus = Literal["success", "partial", "failed"]

_FILENAME_SANITIZER = re.compile(r"[^a-zA-Z0-9._-]+")


class DetectionRecord(TypedDict):
    id: str
    bbox: list[int]
    score: float
    label: str
    source: StageSource
    model_key: str
    foreground_rgb: list[int] | None
    structural_type: str | None
    structural_confidence: float | None
    structural_source: str | None
    matched_reference_image: str | None
    font_style: NotRequired[dict[str, object]]


class OCRSeed(TypedDict):
    id: str
    bbox: list[int]
    source: StageSource
    detector_model_key: str


class OCRRecord(TypedDict):
    id: str
    bbox: list[int]
    text: str
    score: float
    source: StageSource
    detector_model_key: str
    ocr_model_key: str


class TranslationRecord(TypedDict):
    id: str
    source_text: str
    translated_text: str
    translation_notes: list[str]
    source: str
    detector_model_key: str
    ocr_model_key: str
    translator_model_key: str


class SegmentSeed(TypedDict):
    id: str
    bbox: list[int]
    source: StageSource
    detector_model_key: str
    ocr_model_key: str
    translator_model_key: str


class SegmentRecord(TypedDict):
    id: str
    bbox: list[int]
    segment_boxes: list[list[int]]
    merged_boxes: list[list[int]]
    source: StageSource
    detector_model_key: str
    ocr_model_key: str
    translator_model_key: str
    segment_model_key: str


def normalize_stage_source(value: object) -> StageSource:
    return "manual" if value == "manual" else "model"


def _as_object_sequence(value: object) -> Sequence[object] | None:
    if isinstance(value, (str, bytes)) or not isinstance(value, Sequence):
        return None
    return cast(Sequence[object], value)


def coerce_int(value: object) -> int:
    # bool is excluded on purpose: True/False as a coordinate is always a bug.
    if isinstance(value, bool) or not isinstance(value, SupportsInt):
        raise TypeError(f"Cannot coerce {type(value).__name__} to int")
    return int(value)


def optional_float(value: object) -> float | None:
    if value is None or isinstance(value, bool) or not isinstance(value, SupportsFloat):
        return None
    return float(value)


def optional_str(value: object) -> str | None:
    return None if value is None else str(value)


def normalize_bbox(value: object) -> BBox | None:
    items = _as_object_sequence(value)
    if items is None or len(items) < 4:
        return None
    try:
        x1, y1, x2, y2 = (coerce_int(v) for v in items[:4])
    except (TypeError, ValueError):
        return None
    return x1, y1, x2, y2


def normalize_boxes(value: object) -> list[BBox]:
    items = _as_object_sequence(value)
    if items is None:
        return []
    return [box for box in map(normalize_bbox, items) if box is not None]


def optional_rgb(value: object) -> list[int] | None:
    items = _as_object_sequence(value)
    if items is None or len(items) < 3:
        return None
    try:
        return [coerce_int(channel) for channel in items[:3]]
    except (TypeError, ValueError):
        return None


def safe_output_filename(filename: str, fallback_index: int) -> str:
    stem = filename.strip().rsplit(".", 1)[0] if "." in filename else filename.strip()
    stem = _FILENAME_SANITIZER.sub("-", stem).strip("-_.")
    return f"{stem or f'image-{fallback_index + 1}'}.png"
