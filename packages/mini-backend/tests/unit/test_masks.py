from __future__ import annotations

import numpy as np
import pytest

from utils.inpaint_heuristics import (
    apply_need_inpaint_heuristic,
    detect_background_complexity,
)
from utils.mask import MaskRegion, generate_baka_style_mask


def test_single_pixel_and_exclusive_edges() -> None:
    mask = generate_baka_style_mask(
        8,
        8,
        [MaskRegion(bbox=(7, 7, 8, 8))],
        mask_dilation=0,
    )
    assert mask[7, 7] == 255
    assert np.count_nonzero(mask) == 1


def test_invalid_base64_falls_back_to_box() -> None:
    mask = generate_baka_style_mask(
        10,
        10,
        [MaskRegion(bbox=(2, 2, 4, 4), mask_base64="%%%")],
        mask_dilation=0,
    )
    assert np.all(mask[2:4, 2:4] == 255)


def test_outside_box_does_not_draw() -> None:
    mask = generate_baka_style_mask(
        10,
        10,
        [MaskRegion(bbox=(20, 20, 30, 30))],
        mask_dilation=0,
    )
    assert not np.any(mask)


def test_tiny_component_still_requires_model() -> None:
    image = np.full((32, 32, 3), 255, dtype=np.uint8)
    mask = np.zeros((32, 32), dtype=np.uint8)
    mask[16, 16] = 255
    result = apply_need_inpaint_heuristic(image, mask)
    assert result.total_components == 1
    assert result.filled_components == 0
    assert result.needs_model_inpaint
    assert result.method_label == "model_only"


def test_flat_background_is_filled() -> None:
    image = np.full((40, 40, 3), 245, dtype=np.uint8)
    mask = np.zeros((40, 40), dtype=np.uint8)
    mask[15:22, 15:22] = 255
    image[15:22, 15:22] = 0

    result = apply_need_inpaint_heuristic(image, mask)

    assert result.method_label == "solid_fill"
    assert not result.needs_model_inpaint
    assert np.all(result.image_rgb[15:22, 15:22] == 245)
    assert np.all(image[15:22, 15:22] == 0)
    assert np.any(mask)


def test_noop_owns_arrays() -> None:
    image = np.zeros((8, 8, 3), dtype=np.uint8)
    mask = np.zeros((8, 8), dtype=np.uint8)
    result = apply_need_inpaint_heuristic(image, mask)
    assert result.method_label == "no-op"
    assert not np.shares_memory(result.image_rgb, image)
    assert not np.shares_memory(result.remaining_mask, mask)


def test_no_observable_background_is_complex() -> None:
    image = np.full((32, 32, 3), 255, dtype=np.uint8)
    mask = np.full((32, 32), 255, dtype=np.uint8)
    assert detect_background_complexity(image, mask) == "complex"


def test_flat_observable_background_is_simple() -> None:
    image = np.full((40, 40, 3), 255, dtype=np.uint8)
    mask = np.zeros((40, 40), dtype=np.uint8)
    mask[15:25, 15:25] = 255
    image[15:25, 15:25] = 0
    assert detect_background_complexity(image, mask) == "simple"


def test_mismatched_mask_rejected() -> None:
    with pytest.raises(ValueError):
        apply_need_inpaint_heuristic(
            np.zeros((8, 8, 3), dtype=np.uint8),
            np.zeros((4, 4), dtype=np.uint8),
        )
