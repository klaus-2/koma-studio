from __future__ import annotations

import asyncio
from dataclasses import dataclass

import numpy as np
from PIL import Image

from utils import image_variants as iv
from utils.detection_fallback import detect_with_fallbacks
from utils.inpaint_heuristics import apply_need_inpaint_heuristic
from utils.mask import MaskRegion, generate_baka_style_mask


def test_gamma_normalize_pulls_bright_page_to_mid_grey() -> None:
    rng = np.random.default_rng(0)
    rgb = rng.integers(180, 256, size=(64, 64, 3), dtype=np.uint8)
    out = iv.gamma_normalize(rgb)
    assert out.dtype == np.uint8
    assert abs(float(out.mean()) - 127.5) < 12.0


def test_gamma_normalize_is_identity_on_flat_black() -> None:
    rgb = np.zeros((8, 8, 3), dtype=np.uint8)
    assert np.array_equal(iv.gamma_normalize(rgb), rgb)


def test_unrotate_clockwise_bbox_round_trips_pixels() -> None:
    rgb = np.zeros((30, 50, 3), dtype=np.uint8)  # H=30, W=50
    rgb[5:12, 10:20] = 255
    rotated = iv.rotate_clockwise(rgb)
    ys, xs = np.nonzero(rotated[:, :, 0])
    rotated_bbox = (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1)
    assert iv.unrotate_clockwise_bbox(rotated_bbox, (50, 30)) == (10, 5, 20, 12)


@dataclass(frozen=True, slots=True)
class _Detection:
    bbox: tuple[int, int, int, int]
    score: float


def test_detection_short_circuits_after_original_when_enough_boxes() -> None:
    calls = 0

    async def run(_: Image.Image) -> list[_Detection]:
        nonlocal calls
        calls += 1
        return [_Detection((0, 0, 10, 10), 0.9), _Detection((20, 20, 30, 30), 0.8)]

    detections, variant = asyncio.run(
        detect_with_fallbacks(Image.new("RGB", (100, 100), (255, 255, 255)), run)
    )
    assert calls == 1
    assert variant == "original"
    assert len(detections) == 2


def test_box_regions_are_covered_and_single_dilation_grows_them() -> None:
    regions = [MaskRegion(bbox=(10, 10, 30, 20)), MaskRegion(bbox=(50, 50, 70, 60))]
    base = generate_baka_style_mask(100, 100, regions, mask_dilation=0)
    assert base[15, 20] == 255 and base[55, 60] == 255 and base[0, 0] == 0
    dilated = generate_baka_style_mask(100, 100, regions, mask_dilation=3)
    assert dilated[8, 20] == 255
    assert np.count_nonzero(dilated) > np.count_nonzero(base)


def test_flat_background_component_is_solid_filled() -> None:
    image = np.full((60, 60, 3), 250, dtype=np.uint8)
    image[20:30, 20:40] = 0
    mask = np.zeros((60, 60), dtype=np.uint8)
    mask[20:30, 20:40] = 255
    prep = apply_need_inpaint_heuristic(image, mask)
    assert prep.method_label == "solid_fill"
    assert not prep.needs_model_inpaint
    assert bool((prep.image_rgb[20:30, 20:40] == 250).all())


def test_gradient_background_is_left_to_the_model() -> None:
    ramp = np.linspace(0, 255, 60).astype(np.uint8)
    image = np.repeat(np.tile(ramp, (60, 1))[..., None], 3, axis=2)
    mask = np.zeros((60, 60), dtype=np.uint8)
    mask[20:30, 15:45] = 255
    prep = apply_need_inpaint_heuristic(image, mask)
    assert prep.method_label == "model_only"
    assert prep.needs_model_inpaint
