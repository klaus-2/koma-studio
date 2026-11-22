"""Uniform row-band detection for tall webtoon pages.

Pure numpy helpers used by the detection slicers. Bands are reported in the
same (unscaled) coordinate space as the incoming gray frame, so callers keep
their existing re-offset and resolution-remap contracts.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
import numpy.typing as npt

from models.detection.slicing import SliceBounds

_DEFAULT_ROW_VARIANCE_THRESHOLD = 4.0
_DEFAULT_GRADIENT_THRESHOLD = 8.0
_DEFAULT_MIN_BAND_HEIGHT = 32
_DEFAULT_MIN_CONTENT_OVERLAP = 0.05


@dataclass(frozen=True, slots=True)
class BlankBandParams:
    """Thresholds for a row to count as part of an empty band."""

    row_variance_threshold: float = _DEFAULT_ROW_VARIANCE_THRESHOLD
    gradient_threshold: float = _DEFAULT_GRADIENT_THRESHOLD
    min_band_height: int = _DEFAULT_MIN_BAND_HEIGHT


DEFAULT_BLANK_BAND_PARAMS = BlankBandParams()


def detect_blank_bands(
    gray: npt.NDArray[np.generic],
    params: BlankBandParams = DEFAULT_BLANK_BAND_PARAMS,
) -> list[SliceBounds]:
    """Return contiguous runs of low-variance, edge-free rows."""
    if gray.ndim != 2:
        raise ValueError("gray must be a 2-D array")
    height, width = gray.shape
    if height == 0 or width == 0:
        return []

    values = gray.astype(np.float32)
    variance = np.var(values, axis=1)
    horizontal = (
        np.max(np.abs(np.diff(values, axis=1)), axis=1)
        if width > 1
        else np.zeros(height, dtype=np.float32)
    )
    vertical = np.zeros(height, dtype=np.float32)
    if height > 1:
        deltas = np.max(np.abs(np.diff(values, axis=0)), axis=1)
        vertical[:-1] = np.maximum(vertical[:-1], deltas)
        vertical[1:] = np.maximum(vertical[1:], deltas)

    empty = (
        (variance <= params.row_variance_threshold)
        & (horizontal <= params.gradient_threshold)
        & (vertical <= params.gradient_threshold)
    )
    bands: list[SliceBounds] = []
    start: int | None = None
    for row in range(height):
        if empty[row]:
            if start is None:
                start = row
        elif start is not None:
            if row - start >= params.min_band_height:
                bands.append((start, row))
            start = None
    if start is not None and height - start >= params.min_band_height:
        bands.append((start, height))
    return bands


def filter_slices_through_content(
    bounds: Sequence[SliceBounds],
    blank_bands: Sequence[SliceBounds],
    min_content_overlap: float = _DEFAULT_MIN_CONTENT_OVERLAP,
    *,
    keep_first_on_empty: bool = True,
) -> list[SliceBounds]:
    """Keep slices whose non-blank rows cover at least ``min_content_overlap``.

    A balloon straddling a blank band still contributes content overlap, so it
    is never dropped. When every slice is empty the first one is retained: a
    page must always be processed by at least one slice.
    """
    if not bounds:
        return []
    if not blank_bands:
        return list(bounds)

    kept: list[SliceBounds] = []
    for start, end in bounds:
        span = end - start
        blank_rows = sum(
            max(0, min(end, band_end) - max(start, band_start))
            for band_start, band_end in blank_bands
        )
        if span <= 0 or (span - blank_rows) / span >= min_content_overlap:
            kept.append((start, end))
    return kept or ([bounds[0]] if keep_first_on_empty else [])
