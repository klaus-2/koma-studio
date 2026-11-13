from __future__ import annotations

import argparse
import io
import json
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Final

MINI_BACKEND_ROOT: Final = Path(__file__).resolve().parents[1]
for _entry in (str(MINI_BACKEND_ROOT),):
    if _entry not in sys.path:
        sys.path.insert(0, _entry)

from PIL import Image, ImageDraw  # noqa: E402

from models.detection.factory import get_detector  # noqa: E402
from models.detection.slicing import compute_slice_bounds  # noqa: E402
from utils.resolution_policy import (  # noqa: E402
    SAFE_TARGET_MEGAPIXELS,
    megapixels_of,
    stage_resolution_plan,
)

SHIPPED_ACCELERATION_PROFILE: Final = "nvidia-cuda-legacy"
DETECTOR_MODEL_KEY: Final = "font_rtdetr_v2"
RECALL_DEGRADATION_LIMIT: Final = 0.15
DEFAULT_WIDTH: Final = 4600
DEFAULT_HEIGHT: Final = 8000
DEFAULT_OUT: Final = (
    MINI_BACKEND_ROOT.parents[1]
    / ".sisyphus"
    / "baselines"
    / "perf-eight-features-f7-downscale-ab.json"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='profile_stage_downscale.py')
    parser.add_argument(
        "--models-root",
        type=Path,
        default=Path(os.environ.get("APPDATA", ""))
        / "com.komastudio.desktop"
        / "models",
    )
    parser.add_argument(
        "--acceleration-profile",
        default=SHIPPED_ACCELERATION_PROFILE,
    )
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT)
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
    )
    return parser.parse_args()


def build_text_dense_fixture(width: int, height: int) -> Image.Image:
    canvas = Image.new("RGB", (width, height), (245, 240, 230))
    draw = ImageDraw.Draw(canvas)
    block_w, block_h = 14, 20
    gap_x, gap_y = 10, 12
    line_pitch = 40
    y = 40
    while y < height - block_h:
        x = 40
        while x < width - block_w:
            shade = (30 + (x * 7 + y * 3) % 40,) * 3
            draw.rectangle((x, y, x + block_w, y + block_h), fill=shade)
            x += block_w + gap_x
        y += line_pitch + block_h
    return canvas


def detection_on_page(detector: object, page: Image.Image) -> tuple[int, int]:
    import numpy as np

    from models.detection.slicing import compute_slice_bounds as bounds_of

    rgb = np.asarray(page.convert("RGB"))
    width, height = page.size
    slice_count = len(bounds_of(height, width))
    bubble_boxes, text_boxes = detector.image_slicer.process_slices_for_detection(
        rgb, detector._detect_single_image
    )
    return slice_count, len(text_boxes)


def main() -> int:
    args = parse_args()
    models_root = args.models_root.expanduser().resolve()
    if not (models_root / DETECTOR_MODEL_KEY).is_dir():
        raise SystemExit(f"Models root lacks {DETECTOR_MODEL_KEY}")
    os.environ["KOMA_MODELS_ROOT"] = str(models_root)
    os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = args.acceleration_profile

    detector = get_detector(task="text", has_gpu=True, model_key=DETECTOR_MODEL_KEY)
    detector._ensure_session()

    page = build_text_dense_fixture(args.width, args.height)
    megapixels = megapixels_of(args.width, args.height)
    plan = stage_resolution_plan("detection", args.width, args.height)

    off_slices = len(compute_slice_bounds(args.height, args.width))
    off_start = time.perf_counter()
    _slice_count_off, off_boxes = detection_on_page(detector, page)
    off_ms = (time.perf_counter() - off_start) * 1000.0

    on_start = time.perf_counter()
    working = page.resize(
        (plan.working_width, plan.working_height), Image.Resampling.BICUBIC
    )
    _slice_count_on, on_boxes = detection_on_page(detector, working)
    on_ms = (time.perf_counter() - on_start) * 1000.0
    working.close()

    degradation = (
        (off_boxes - on_boxes) / off_boxes if off_boxes > 0 else 0.0
    )
    gate_pass = degradation <= RECALL_DEGRADATION_LIMIT
    artifact = {
        "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "script": "profile_stage_downscale.py",
        "page_size": f"{args.width}x{args.height}",
        "megapixels": round(megapixels, 2),
        "policy": {
            "safe_target_mp": SAFE_TARGET_MEGAPIXELS,
            "downscaled": plan.downscaled,
            "working_size": f"{plan.working_width}x{plan.working_height}",
        },
        "off_arm": {
            "slice_count": off_slices,
            "text_box_count": off_boxes,
            "wall_ms": round(off_ms, 1),
        },
        "on_arm": {
            "slice_count": _slice_count_on,
            "text_box_count": on_boxes,
            "wall_ms": round(on_ms, 1),
        },
        "box_count_degradation": round(degradation, 4),
        "gate": {
            "name": "F7-RECALL",
            "degradation_limit": RECALL_DEGRADATION_LIMIT,
            "pass": gate_pass,
            "verdict": (
                "PASS — downscale keeps recall proxy within limit"
                if gate_pass
                else "FAIL — lower SAFE_TARGET_MEGAPIXELS one step and re-run"
            ),
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(
        f"F7-RECALL degradation={degradation:.4f} "
        f"(limit {RECALL_DEGRADATION_LIMIT}) -> {'PASS' if gate_pass else 'FAIL'}; "
        f"artifact {args.out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
