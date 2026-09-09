"""Storage helpers for YuzuMarker FontDetection model.

The model weights are expected to be bundled directly inside the
``models/detection/font_style/weights/`` directory during project packaging.
No user download is required.
"""
from __future__ import annotations

from pathlib import Path


_WEIGHTS_DIR = Path(__file__).resolve().parent / "weights"

EXPECTED_FILES = [
    "yuzumarker-font-detection.safetensors",
    "font-labels-ex.json",
]


def font_style_runtime_ready() -> bool:
    """Check that all expected model files are present in the bundled weights dir."""
    return all((_WEIGHTS_DIR / f).exists() for f in EXPECTED_FILES)
