"""Storage helpers for YuzuMarker FontDetection model.

The model weights are expected to be bundled directly inside the
``models/detection/font_style/weights/`` directory during project packaging.
No user download is required.
"""
from __future__ import annotations

from pathlib import Path
from typing import Final


_WEIGHTS_DIR: Final = Path(__file__).resolve().parent / "weights"
_LABELS_FILE: Final = "font-labels-ex.json"
# The detector prefers the ONNX export and falls back to SafeTensors; either
# one alone is a working runtime.
_MODEL_CANDIDATES: Final = (
    "yuzumarker-font-detection.onnx",
    "yuzumarker-font-detection.safetensors",
)


def font_style_runtime_ready() -> bool:
    """Check that one model file plus the label table are present."""
    has_model = any((_WEIGHTS_DIR / name).is_file() for name in _MODEL_CANDIDATES)
    return has_model and (_WEIGHTS_DIR / _LABELS_FILE).is_file()
