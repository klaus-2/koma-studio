from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from services.cloud_cleaning import _build_segment_alpha  # noqa: E402


def _reference(width: int, height: int, fade_in: int, fade_out: int) -> np.ndarray:
    # The original per-pixel loop, kept only as the oracle for this test.
    out = np.full((height, width), 255, dtype=np.int64)
    for y in range(height):
        alpha = 255
        if fade_in > 0 and y < fade_in:
            alpha = min(alpha, int((y / max(1, fade_in)) * 255))
        if fade_out > 0 and y >= height - fade_out:
            alpha = min(alpha, int(((height - y - 1) / max(1, fade_out)) * 255))
        out[y, :] = max(0, min(255, alpha))
    return out


def test_vectorized_alpha_matches_reference() -> None:
    for fade_in, fade_out in ((0, 0), (160, 0), (0, 160), (160, 160), (500, 500), (5, 900)):
        got = np.asarray(_build_segment_alpha(7, 300, fade_in=fade_in, fade_out=fade_out))
        assert np.array_equal(got, _reference(7, 300, fade_in, fade_out)), (fade_in, fade_out)
