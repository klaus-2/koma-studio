from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.detection.base_detector import TextDetection  # noqa: E402
from models.detection.comic_text_detector.detector import ComicTextDetector  # noqa: E402
from models.detection.reading_order import sort_detections_in_reading_order  # noqa: E402


def _row(cx: float, cy: float, bw: float, bh: float, score: float) -> list[float]:
    return [cx, cy, bw, bh, score, 1.0, 0.0]


class _CountingSession:
    def __init__(self, rows: list[list[float]]) -> None:
        self.block = np.asarray([rows], dtype=np.float32)
        self.calls = 0

    def run(self, output_names: object, feeds: object) -> list[np.ndarray]:
        del output_names, feeds
        self.calls += 1
        return [self.block]


def _detector(rows: list[list[float]], confidence: float = 0.15) -> ComicTextDetector:
    detector = object.__new__(ComicTextDetector)
    detector._min_box_size_px = 6
    detector.nms_threshold = 0.5
    detector.confidence_threshold = confidence
    detector.session = _CountingSession(rows)
    detector.input_name = "images"
    return detector


def _two_pass_reference(detector: ComicTextDetector, rgb: np.ndarray) -> list[TextDetection]:
    height, width = rgb.shape[:2]
    candidates = detector._detect_with_slicing(rgb, score_threshold=detector.confidence_threshold)
    if not candidates:
        return []
    merged = detector._merge_text_lines(candidates, width=width, height=height)
    recall = max(0.05, min(detector.confidence_threshold * 0.5, 0.10))
    if len(merged) < 2 and recall < detector.confidence_threshold:
        extra = detector._detect_with_slicing(rgb, score_threshold=recall)
        if extra:
            merged = detector._merge_text_lines(candidates + extra, width=width, height=height)
    return sort_detections_in_reading_order(detector._apply_nms(merged))


_SINGLE_BLOCK_WITH_FAINT_CREDIT = [
    _row(200, 200, 220, 120, 0.9),
    _row(215, 210, 210, 110, 0.6),
    _row(800, 820, 240, 90, 0.08),
    _row(805, 825, 230, 85, 0.07),
    _row(820, 200, 200, 100, 0.03),
]

_TWO_STRONG_BLOCKS = [
    _row(200, 200, 220, 120, 0.9),
    _row(800, 820, 240, 90, 0.7),
    _row(500, 500, 200, 100, 0.08),
]


@pytest.mark.parametrize(
    ("rows", "confidence"),
    [
        (_SINGLE_BLOCK_WITH_FAINT_CREDIT, 0.15),
        (_TWO_STRONG_BLOCKS, 0.15),
        (_SINGLE_BLOCK_WITH_FAINT_CREDIT, 0.08),
        ([_row(500, 500, 200, 100, 0.08)], 0.15),
    ],
)
def test_single_inference_matches_the_two_pass_recall(
    rows: list[list[float]], confidence: float
) -> None:
    rgb = np.random.default_rng(5).integers(0, 256, size=(512, 512, 3), dtype=np.uint8)

    reference = _two_pass_reference(_detector(rows, confidence), rgb)
    detector = _detector(rows, confidence)
    result = detector._detect(Image.fromarray(rgb))

    assert [(d.bbox, d.score) for d in result] == [(d.bbox, d.score) for d in reference]


def test_recall_pass_reuses_the_first_inference() -> None:
    rgb = np.random.default_rng(5).integers(0, 256, size=(512, 512, 3), dtype=np.uint8)
    detector = _detector(_SINGLE_BLOCK_WITH_FAINT_CREDIT)

    result = detector._detect(Image.fromarray(rgb))

    assert len(result) == 2
    assert isinstance(detector.session, _CountingSession)
    assert detector.session.calls == 1
