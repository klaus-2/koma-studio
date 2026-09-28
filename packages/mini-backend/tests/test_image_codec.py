from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from utils import image_codec  # noqa: E402


def _png(size: tuple[int, int], mode: str = "RGB") -> bytes:
    from io import BytesIO

    from PIL import Image

    buffer = BytesIO()
    Image.new(mode, size, 255).save(buffer, format="PNG")
    return buffer.getvalue()


def test_decode_rgb_roundtrip() -> None:
    rgb = image_codec.decode_rgb(_png((8, 4)))
    assert rgb.shape == (4, 8, 3)
    assert rgb.dtype == np.uint8


def test_decode_rejects_garbage() -> None:
    with pytest.raises(image_codec.ImageDecodeError):
        image_codec.decode_rgb(b"definitely not an image")


def test_decode_rejects_bomb(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(image_codec, "MAX_IMAGE_PIXELS", 10)
    with pytest.raises(image_codec.ImageDecodeError, match="exceeds"):
        image_codec.decode_rgb(_png((8, 4)))


def test_mask_is_resized_and_binarized() -> None:
    mask = image_codec.decode_binary_mask(_png((3, 3), "L"), target_shape=(10, 20))
    assert mask.shape == (10, 20)
    assert set(np.unique(mask).tolist()) <= {0, 255}


def test_encode_png_roundtrip() -> None:
    rng = np.random.default_rng(0)
    rgb = rng.integers(0, 255, (5, 7, 3)).astype(np.uint8)
    assert np.array_equal(image_codec.decode_rgb(image_codec.encode_png(rgb)), rgb)


def test_dilate_mask_zero_radius_is_identity() -> None:
    mask = np.zeros((8, 8), dtype=np.uint8)
    mask[4, 4] = 255
    assert np.array_equal(image_codec.dilate_mask(mask, radius=0), mask)
