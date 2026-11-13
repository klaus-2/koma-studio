from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
from pathlib import Path
from typing import Callable, Final, TypeVar

MINI_BACKEND_ROOT: Final = Path(__file__).resolve().parents[1]
for _entry in (str(MINI_BACKEND_ROOT),):
    if _entry not in sys.path:
        sys.path.insert(0, _entry)

import numpy as np  # noqa: E402  — path bootstrap above
from PIL import Image  # noqa: E402

from core.device import get_device_info  # noqa: E402
from models.detection.factory import get_detector  # noqa: E402
from models.detection.font.detector import FontRTDetrV2Detector  # noqa: E402
from models.detection.slicing import compute_slice_bounds  # noqa: E402

REPO_ROOT: Final = MINI_BACKEND_ROOT.parents[1]
SHIPPED_ACCELERATION_PROFILE: Final = "nvidia-cuda-legacy"
DETECTOR_MODEL_KEY: Final = "font_rtdetr_v2"
GATE_OVERHEAD_SHARE: Final = 0.10
DEFAULT_REPETITIONS: Final = 5
DEFAULT_WIDTH: Final = 800
DEFAULT_HEIGHT: Final = 1200
DEFAULT_OUT: Final = (
    REPO_ROOT / ".sisyphus" / "baselines"
    / "perf-eight-features-f1-binding-decomposition.json"
)
VALID_ACCELERATION_PROFILES: Final = {
    "nvidia-cuda-legacy",
    "nvidia-cuda",
    "nvidia-tensorrt",
    "cpu",
}

T = TypeVar("T")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='profile_binding_decomposition.py')
    parser.add_argument(
        "--models-root",
        type=Path,
        default=Path(os.environ.get("APPDATA", ""))
        / "com.komastudio.desktop"
        / "models",
        help="Managed models root written to KOMA_MODELS_ROOT "
        "(default: the active app-data dir's models folder).",
    )
    parser.add_argument(
        "--acceleration-profile",
        default=SHIPPED_ACCELERATION_PROFILE,
        help="MINI_BACKEND_ACCELERATION_PROFILE value; must match the "
        "shipped sidecar for representative timings.",
    )
    parser.add_argument("--repetitions", type=int, default=DEFAULT_REPETITIONS)
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT)
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Artifact JSON path (gitignored); overwritten on each run.",
    )
    return parser.parse_args()


def timed[T](operation: Callable[[], T]) -> tuple[float, T]:
    start = time.perf_counter()
    value = operation()
    return time.perf_counter() - start, value


def median(seconds: list[float]) -> float:
    ordered = sorted(seconds)
    middle = len(ordered) // 2
    if len(ordered) % 2 == 1:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def round4(seconds: float) -> float:
    return round(seconds * 1000.0, 4)


def build_synthetic_page(width: int, height: int) -> np.ndarray:
    xs = np.linspace(0.0, 1.0, width, dtype=np.float32)
    ys = np.linspace(0.0, 1.0, height, dtype=np.float32)
    column = np.tile(xs, (height, 1))
    row = np.repeat(ys[:, np.newaxis], width, axis=1)
    red = (column * 255.0).astype(np.uint8)
    green = ((1.0 - row) * 255.0).astype(np.uint8)
    blue = ((column * 0.5 + row * 0.25) * 255.0).astype(np.uint8)
    return np.stack([red, green, blue], axis=-1)


def main() -> int:
    args = parse_args()
    if args.repetitions < 1:
        raise SystemExit("--repetitions must be >= 1")
    if args.acceleration_profile not in VALID_ACCELERATION_PROFILES:
        raise SystemExit(
            f"--acceleration-profile must be one of {sorted(VALID_ACCELERATION_PROFILES)}"
        )

    models_root = args.models_root.expanduser().resolve()
    detector_dir = models_root / DETECTOR_MODEL_KEY
    if not detector_dir.is_dir():
        raise SystemExit(
            f"Models root {models_root} does not contain {DETECTOR_MODEL_KEY}; "
            "pass --models-root for the active install."
        )
    os.environ["KOMA_MODELS_ROOT"] = str(models_root)
    os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = args.acceleration_profile

    detector = get_detector(task="text", has_gpu=True, model_key=DETECTOR_MODEL_KEY)
    if not isinstance(detector, FontRTDetrV2Detector):
        raise SystemExit(f"Expected the RT-DETR v2 detector, got {type(detector).__name__}")
    detector._ensure_session()
    if detector.session is None:
        raise SystemExit("Detector session failed to initialize")

    session = detector.session
    requested = list(detector.providers)
    active = list(session.get_providers())
    print(
        f"detector={detector.key} profile={args.acceleration_profile} "
        f"requested_providers={requested} active_providers={active}",
        flush=True,
    )

    page = build_synthetic_page(args.width, args.height)
    slice_count = len(
        compute_slice_bounds(page.shape[0], page.shape[1])
    )

    pil_image = Image.fromarray(page)
    resized_once = pil_image.resize((640, 640), Image.Resampling.BICUBIC)
    im_data_once = (
        np.asarray(resized_once, dtype=np.float32) / 255.0
    ).transpose(2, 0, 1)[np.newaxis, ...]
    feed: dict[str, np.ndarray] = {detector.image_input_name: im_data_once}
    if detector.target_size_input_name is not None:
        feed[detector.target_size_input_name] = np.array(
            [[pil_image.width, pil_image.height]], dtype=np.int64
        )

    recorded: list[dict[str, float]] = []
    for rep in range(1 + args.repetitions):
        warmup = rep == 0

        resize_s, resized = timed(
            lambda: pil_image.resize((640, 640), Image.Resampling.BICUBIC)
        )
        normalize_s, im_data = timed(
            lambda: (
                np.asarray(resized, dtype=np.float32) / 255.0
            ).transpose(2, 0, 1)[np.newaxis, ...]
        )
        _ = im_data
        run_s, outputs = timed(lambda: session.run(None, feed))
        decode_s, _ = timed(
            lambda: (
                np.asarray(outputs[0]).reshape(-1),
                np.asarray(outputs[1]).reshape(-1, 4),
                np.asarray(outputs[2]).reshape(-1),
            )
        )
        full_s, _ = timed(lambda: detector._detect_single_image(page))

        segment = {
            "resize_ms": round4(resize_s),
            "normalize_chw_ms": round4(normalize_s),
            "session_run_ms": round4(run_s),
            "output_decode_ms": round4(decode_s),
            "full_detect_single_ms": round4(full_s),
        }
        if not warmup:
            recorded.append(segment)
            print(f"rep {rep}: {segment}", flush=True)

    if not recorded:
        raise SystemExit("No recorded repetitions")

    medians = {
        key: median([row[key] for row in recorded]) for key in recorded[0]
    }
    pre_post = (
        medians["resize_ms"] + medians["normalize_chw_ms"] + medians["output_decode_ms"]
    )
    total = medians["full_detect_single_ms"]
    overhead_share = pre_post / total if total > 0 else 0.0
    gate_pass = overhead_share >= GATE_OVERHEAD_SHARE

    artifact = {
        "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "script": "profile_binding_decomposition.py",
        "acceleration_profile": args.acceleration_profile,
        "detector_key": detector.key,
        "page_size": f"{args.width}x{args.height}",
        "slice_count": slice_count,
        "requested_providers": requested,
        "active_providers": active,
        "note_no_ascontiguousarray": (
            "detection builds the contiguous NCHW tensor in normalize_chw; "
            "an explicit np.ascontiguousarray exists only on the inpainting path"
        ),
        "repetitions_recorded": len(recorded),
        "medians_ms": medians,
        "pre_post_ms": round(pre_post, 4),
        "overhead_share": round(overhead_share, 4),
        "gate": {
            "name": "F1-PROFILE",
            "threshold": GATE_OVERHEAD_SHARE,
            "pass": gate_pass,
            "verdict": (
                "PASS — proceed to per-call input-binding buffers (T3)"
                if gate_pass
                else "FAIL — scope out IOBinding (overhead below gate)"
            ),
        },
        "device": {
            "gpu": get_device_info().name,
            "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        },
    }

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(
        f"F1-PROFILE overhead_share={overhead_share:.4f} "
        f"(threshold {GATE_OVERHEAD_SHARE}) -> {'PASS' if gate_pass else 'FAIL'}; "
        f"artifact {args.out}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
