from __future__ import annotations

from io import BytesIO

import numpy as np
import pytest
from PIL import Image

from utils.image_codec import (
    ImageDecodeError,
    ImageTooLargeError,
    decode_binary_mask,
    decode_pil,
    decode_rgb,
    dilate_mask,
    encode_png,
    validate_shape,
)
from utils.image_variants import (
    clip_bbox,
    gamma_normalize,
    invert,
    rotate_clockwise,
    scale_bbox,
    unrotate_clockwise_bbox,
    upscale_target,
)


def test_rgb_round_trip_has_independent_writable_storage() -> None:
    source = np.arange(60, dtype=np.uint8).reshape(4, 5, 3)
    decoded = decode_rgb(encode_png(source))
    np.testing.assert_array_equal(decoded, source)
    assert decoded.flags.writeable
    assert not np.shares_memory(decoded, source)


@pytest.mark.parametrize("payload", [b"", b"not an image", b"\x89PNG\r\n"])
def test_invalid_raster(payload: bytes) -> None:
    with pytest.raises(ImageDecodeError):
        decode_rgb(payload)


def test_pixel_budget() -> None:
    with pytest.raises(ImageTooLargeError):
        validate_shape((64_000_001, 1))


def test_mask_resize_is_binary() -> None:
    source = np.array([[0, 1], [128, 255]], dtype=np.uint8)
    stream = BytesIO()
    with Image.fromarray(source) as image:
        image.save(stream, format="PNG")
    decoded = decode_binary_mask(stream.getvalue(), target_shape=(8, 8))
    assert decoded.shape == (8, 8)
    assert set(np.unique(decoded)) == {0, 255}


def test_pil_ownership() -> None:
    source = np.zeros((3, 4, 3), dtype=np.uint8)
    image = decode_pil(encode_png(source), "RGBA")
    try:
        assert image.mode == "RGBA"
        assert image.getpixel((0, 0)) == (0, 0, 0, 255)
    finally:
        image.close()


def test_dilation_identity_is_not_alias() -> None:
    mask = np.zeros((8, 8), dtype=np.uint8)
    result = dilate_mask(mask, radius=0)
    assert not np.shares_memory(mask, result)


def test_dilation_expands() -> None:
    mask = np.zeros((9, 9), dtype=np.uint8)
    mask[4, 4] = 255
    assert np.count_nonzero(dilate_mask(mask, radius=1)) > 1


@pytest.mark.parametrize("radius", [-1, 129])
def test_dilation_rejects_invalid_radius(radius: int) -> None:
    with pytest.raises(ValueError):
        dilate_mask(np.zeros((8, 8), dtype=np.uint8), radius=radius)


def test_variants_do_not_mutate_input() -> None:
    source = np.full((8, 12, 3), 64, dtype=np.uint8)
    original = source.copy()
    assert np.all(invert(source) == 191)
    assert gamma_normalize(source).dtype == np.uint8
    assert rotate_clockwise(source).shape == (12, 8, 3)
    np.testing.assert_array_equal(source, original)


@pytest.mark.parametrize("value", [0, 255])
def test_flat_gamma_returns_copy(value: int) -> None:
    source = np.full((8, 8, 3), value, dtype=np.uint8)
    result = gamma_normalize(source)
    np.testing.assert_array_equal(source, result)
    assert not np.shares_memory(source, result)


def test_bbox_geometry() -> None:
    assert clip_bbox((9, 9, -2, -3), (8, 8)) == (0, 0, 8, 8)
    assert clip_bbox((9, 9, 12, 12), (8, 8)) is None
    assert clip_bbox((1, 1, 1, 2), (8, 8)) is None
    assert scale_bbox((1, 1, 3, 3), scale_x=0.5, scale_y=0.5) == (0, 0, 2, 2)
    assert unrotate_clockwise_bbox((0, 2, 4, 5), (8, 10)) == (2, 6, 5, 10)


def test_upscale_policy() -> None:
    assert upscale_target((2048, 100)) is None
    assert upscale_target((1600, 900)) is None
    assert upscale_target((100, 200)) == (200, 400)


@pytest.mark.parametrize("scale", [0.0, -1.0, float("nan"), float("inf")])
def test_invalid_scale(scale: float) -> None:
    with pytest.raises(ValueError):
        scale_bbox((0, 0, 1, 1), scale_x=scale, scale_y=1)
