from __future__ import annotations

import numpy as np
import pytest

from pipelines.batch.records import (
    normalize_bbox,
    normalize_boxes,
    normalize_stage_source,
    optional_rgb,
    safe_output_filename,
)


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ([1, 2, 3, 4], (1, 2, 3, 4)),
        ((1.9, 2.1, 3.0, 4.0, 99), (1, 2, 3, 4)),
        ([np.int64(1), np.float32(2), 3, 4], (1, 2, 3, 4)),
        ([1, 2, 3], None),
        ("1234", None),
        ([1, "x", 3, 4], None),
        ([True, 2, 3, 4], None),
        (None, None),
    ],
)
def test_normalize_bbox(value: object, expected: tuple[int, ...] | None) -> None:
    assert normalize_bbox(value) == expected


def test_normalize_boxes_drops_invalid() -> None:
    assert normalize_boxes([[1, 2, 3, 4], [1], "bad", (5, 6, 7, 8)]) == [
        (1, 2, 3, 4),
        (5, 6, 7, 8),
    ]


def test_optional_rgb() -> None:
    assert optional_rgb([255, 0.0, np.uint8(7), 9]) == [255, 0, 7]
    assert optional_rgb([1, 2]) is None
    assert optional_rgb(None) is None


@pytest.mark.parametrize("value", ["manual"])
def test_stage_source_manual(value: object) -> None:
    assert normalize_stage_source(value) == "manual"


@pytest.mark.parametrize("value", ["model", "", None, "MANUAL", 3])
def test_stage_source_defaults_to_model(value: object) -> None:
    assert normalize_stage_source(value) == "model"


@pytest.mark.parametrize(
    ("filename", "index", "expected"),
    [
        ("page 01.jpg", 0, "page-01.png"),
        ("../../etc/passwd", 4, "image-5.png"),  # dots stripped → empty stem
        ("   ", 2, "image-3.png"),
        ("weird!!!.tar.gz", 0, "weird-.tar.png"),
    ],
)
def test_safe_output_filename(filename: str, index: int, expected: str) -> None:
    assert safe_output_filename(filename, index) == expected
