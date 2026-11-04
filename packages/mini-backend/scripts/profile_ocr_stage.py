"""OCR stage micro-profile: quantifies the per-batch snippet pass (Pass-2 T1).

Dev measurement script — NOT benchmarking infrastructure. Runs fully
in-process against the dev source tree with the sidecar venv interpreter
(``apps/tauri/.venv-mini/Scripts/python.exe``); no sidecar/HTTP required.

What it measures, per repetition (1 warmup + 3 recorded), on the Pass-1
dense fixture family (``bench_dense_page.build_fixture_png``):

- BGR convert — the inline ``cv2.cvtColor`` conversion at the top of
  ``PPOCRV5RecEngine._recognize`` (mirrored locally, engine file untouched).
- primary recognition only — every region crop through ``_run_recognition``
  directly, bypassing the snippet branch.
- full-page detection once — ``_detect_text_boxes`` on the whole page.
- snippet recognition once — the det boxes through ``_run_recognition``.
- the full shipped ``recognize()`` end-to-end — which re-runs BGR convert +
  the full-page snippet pass once per region batch call.
- the legacy per-batch composition (``_recognize`` per <=8-region slice,
  concatenated) — compared against the shipped results as T2's regression
  baseline.

Regions are built the way the pipeline does: ``detect_text_seeds`` with
``font_rtdetr_v2`` (an allowlisted model) -> ``OCRInputRegion``. The engine
comes from ``get_ocr_engine(language="en", has_gpu=True,
model_key="paddleocr_en_v5")`` — nothing else is constructed.

The acceleration profile defaults to ``nvidia-cuda-legacy`` — the value the
shipped launcher resolves for THIS machine
(``%APPDATA%/com.komastudio.desktop/mini-backend-runtime-selection.json``).
The profile decides the ORT provider list AND the CUDA options
(HEURISTIC conv search, zero max workspace); without it an unattended run
resolves ``auto`` -> ``nvidia-tensorrt`` with EXHAUSTIVE conv search and the
timings are unrepresentative of the shipped sidecar.

MODEL ALLOWLIST (user hard rule, 2026-11-04): this script loads ONLY
``font_rtdetr_v2`` and ``paddleocr_en_v5``. GLM/VLM-family engines,
pororo, and every other heavy model must never run on this machine.

The artifact records requested AND active ONNX providers for both paddle
sessions (``session.get_providers()`` — the fact the shipped load log omits)
plus a verdict: ``"hoist"`` when snippet_share >= 0.20 (the per-batch
snippet pass dominates), ``"provider"`` when a GPU provider was requested
but both sessions are CPU-only (the silent-fallback failure mode — NOT the
shipped TensorRT degrade to CUDA), ``"intrinsic"`` otherwise. ``"hoist"``
and ``"provider"`` may both fire.

Private engine helpers (``_run_recognition``, ``_detect_text_boxes``,
``_expand_box``, ``_recognize``) are called deliberately: this is a
measurement script profiling the shipped code paths, not a consumer.
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import math
import os
import platform
import statistics
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import Final

MINI_BACKEND_ROOT: Final = Path(__file__).resolve().parents[1]
SCRIPT_DIR: Final = Path(__file__).resolve().parent
REPO_ROOT: Final = Path(__file__).resolve().parents[3]
for _entry in (str(SCRIPT_DIR), str(MINI_BACKEND_ROOT)):
    if _entry not in sys.path:
        sys.path.insert(0, _entry)

import bench_dense_page  # noqa: E402  — sibling dev script, same directory, no package
import cv2  # noqa: E402
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from core.device import (  # noqa: E402
    VALID_ACCELERATION_PROFILES,
    OnnxProviderSpec,
    get_device_info,
)
from models.ocr.base_ocr import OCRInputRegion, OCRTextResult  # noqa: E402
from models.ocr.factory import get_ocr_engine  # noqa: E402
from models.ocr.paddleocr import PPOCRV5RecEngine  # noqa: E402
from pipelines.batch.records import OCRSeed, normalize_bbox  # noqa: E402
from pipelines.detection_seeds import detect_text_seeds  # noqa: E402

DETECTOR_MODEL_KEY: Final = "font_rtdetr_v2"
OCR_MODEL_KEY: Final = "paddleocr_en_v5"
OCR_LANGUAGE: Final = "en"
ACCELERATION_PROFILE_ENV: Final = "MINI_BACKEND_ACCELERATION_PROFILE"
SHIPPED_ACCELERATION_PROFILE: Final = "nvidia-cuda-legacy"
HOIST_SHARE_THRESHOLD: Final = 0.20
DEFAULT_REPETITIONS: Final = 3
DEFAULT_OUT: Final = (
    REPO_ROOT / ".sisyphus" / "baselines" / "perf-tiers-pass2-ocr-profile.json"
)
DEFAULT_MODELS_ROOT: Final = (
    Path(os.environ.get("APPDATA", "")) / "com.komastudio.desktop" / "models"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--models-root",
        type=Path,
        default=DEFAULT_MODELS_ROOT,
        help="Managed models root written to KOMA_MODELS_ROOT "
        "(default: the active app-data dir's models folder).",
    )
    parser.add_argument(
        "--acceleration-profile",
        default=SHIPPED_ACCELERATION_PROFILE,
        help="MINI_BACKEND_ACCELERATION_PROFILE value; default matches the "
        "shipped launcher's runtime selection for this machine. The profile "
        "decides the ORT provider order and CUDA options, so it must match "
        "the sidecar's for representative timings.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Artifact JSON path (gitignored); overwritten on each run.",
    )
    parser.add_argument("--repetitions", type=int, default=DEFAULT_REPETITIONS)
    parser.add_argument(
        "--seed-base",
        type=int,
        default=bench_dense_page.FIXTURE_SEED_BASE,
        help="Fixture seed base; repetition N uses seed_base + N, matching "
        "the Pass-1 baseline run seeds (warmup=base, r1=base+1, ...).",
    )
    return parser.parse_args()


def provider_name(spec: OnnxProviderSpec) -> str:
    return spec if isinstance(spec, str) else spec[0]


def provider_options(
    specs: list[OnnxProviderSpec],
) -> dict[str, dict[str, str]]:
    options: dict[str, dict[str, str]] = {}
    for spec in specs:
        if isinstance(spec, tuple):
            options[spec[0]] = dict(spec[1])
    return options


def page_to_bgr(image: Image.Image) -> np.ndarray:
    # Mirrors the inline conversion at the top of PPOCRV5RecEngine._recognize
    # (models/ocr/paddleocr/engine.py) — the cost the shipped path pays once
    # per batch call. The engine file itself stays untouched.
    return cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2BGR)


def regions_from_seeds(seeds: list[OCRSeed]) -> list[OCRInputRegion]:
    # Mirrors pipelines/ocr_stage.py _to_input_region.
    regions: list[OCRInputRegion] = []
    for seed in seeds:
        bbox = normalize_bbox(seed["bbox"])
        if bbox is None:
            continue
        regions.append(
            OCRInputRegion(
                id=seed["id"],
                bbox=bbox,
                source=seed["source"],
                detector_model_key=seed["detector_model_key"],
            )
        )
    return regions


def primary_crops(
    engine: PPOCRV5RecEngine, bgr: np.ndarray, regions: list[OCRInputRegion]
) -> list[np.ndarray]:
    # Mirrors the crop-extraction loop of _recognize (before _run_recognition).
    img_h, img_w = bgr.shape[:2]
    crops: list[np.ndarray] = []
    for region in regions:
        x1, y1, x2, y2 = engine._expand_box(region.bbox, img_w, img_h)
        if x2 <= x1 or y2 <= y1:
            continue
        crop = bgr[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        crops.append(crop)
    return crops


def snippet_crops(
    bgr: np.ndarray, boxes: list[tuple[int, int, int, int, float]]
) -> list[np.ndarray]:
    # Mirrors the crop loop of _detect_and_recognize_snippets.
    crops: list[np.ndarray] = []
    for x1, y1, x2, y2, _score in boxes:
        crop = bgr[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        crops.append(crop)
    return crops


def timed[T](operation: Callable[[], T]) -> tuple[float, T]:
    start = time.perf_counter()
    value = operation()
    return time.perf_counter() - start, value


def round4(seconds: float) -> float:
    return round(seconds, 4)


def count_model(regions: int, det_boxes: int, batch_size: int) -> dict[str, object]:
    """Modeled ORT-level run counts for the shipped vs hoisted composition.

    Shipped: ``recognize()`` slices regions into ceil(regions/batch_size)
    batch calls; each call runs one primary rec sub-batch (a batch holds at
    most batch_size valid crops, so a single sub-batch) plus one full-page
    snippet pass (1 det run + ceil(det_boxes/batch_size) rec sub-batches).
    Hoisted: identical primary work plus exactly ONE snippet pass per page.
    """
    batch_calls = math.ceil(regions / batch_size)
    snippet_rec_subbatches = math.ceil(det_boxes / batch_size)
    return {
        "regions": regions,
        "batch_calls": batch_calls,
        "ort_rec_runs_shipped": batch_calls * (1 + snippet_rec_subbatches),
        "ort_rec_runs_hoisted": batch_calls + snippet_rec_subbatches,
        "full_page_det_runs_shipped": batch_calls,
        "full_page_det_runs_hoisted": 1,
        "snippet_rec_sweeps_shipped": batch_calls,
        "snippet_rec_sweeps_hoisted": 1,
        "formulas": {
            "batch_calls": "ceil(regions / batch_size)",
            "ort_rec_runs_shipped": (
                "batch_calls * (1 + ceil(det_boxes / batch_size)); each batch "
                "call runs 1 primary sub-batch (<= batch_size valid crops) "
                "plus one snippet sweep of ceil(det_boxes / batch_size) "
                "sub-batches"
            ),
            "ort_rec_runs_hoisted": "batch_calls primary sub-batches + ONE snippet sweep",
            "full_page_det_runs": "shipped: one per batch call; hoisted: 1",
            "snippet_rec_sweeps": "shipped: one per batch call; hoisted: 1",
        },
    }


def legacy_composition(
    engine: PPOCRV5RecEngine,
    image: Image.Image,
    regions: list[OCRInputRegion],
) -> list[OCRTextResult]:
    """The pre-hoist contract: one _recognize call per <=8-region slice."""
    results: list[OCRTextResult] = []
    for start in range(0, len(regions), engine.batch_size):
        results.extend(engine._recognize(image, regions[start : start + engine.batch_size], OCR_LANGUAGE))
    return results


def mismatched_region_ids(
    shipped: list[OCRTextResult], legacy: list[OCRTextResult]
) -> list[str]:
    if len(shipped) != len(legacy):
        return [f"<length {len(shipped)} vs {len(legacy)}>"]
    return [
        shipped_item.id
        for shipped_item, legacy_item in zip(shipped, legacy)
        if shipped_item != legacy_item
    ]


def snippet_share_of(rep: dict[str, object]) -> float | None:
    timings = rep.get("timings_s")
    if not isinstance(timings, dict):
        return None
    shipped = timings.get("shipped_recognize")
    primary = timings.get("primary_rec")
    bgr = timings.get("bgr_convert")
    if not isinstance(shipped, (int, float)) or shipped <= 0.0:
        return None
    if not isinstance(primary, (int, float)) or not isinstance(bgr, (int, float)):
        return None
    return (shipped - primary - bgr) / shipped


def run_repetition(
    engine: PPOCRV5RecEngine,
    *,
    rep_index: int,
    seed_base: int,
) -> dict[str, object]:
    recorded = rep_index > 0
    rep_id = "warmup" if rep_index == 0 else f"r{rep_index}"
    seed = seed_base + rep_index
    fixture_png = bench_dense_page.build_fixture_png(seed, emit_path=None)
    image = Image.open(io.BytesIO(fixture_png))

    seeds = asyncio.run(
        detect_text_seeds(image, has_gpu=True, model_key=DETECTOR_MODEL_KEY)
    )
    regions = regions_from_seeds(seeds)
    if not regions:
        raise SystemExit(f"[{rep_id}] fixture seed {seed} produced no OCR regions")

    bgr_seconds, bgr = timed(lambda: page_to_bgr(image))
    crops = primary_crops(engine, bgr, regions)
    primary_seconds, _ = timed(lambda: engine._run_recognition(crops))
    det_seconds, boxes = timed(lambda: engine._detect_text_boxes(bgr))
    snippet_seconds, _ = timed(
        lambda: engine._run_recognition(snippet_crops(bgr, boxes))
    )
    shipped_seconds, shipped_results = timed(
        lambda: asyncio.run(engine.recognize(image, regions, OCR_LANGUAGE))
    )

    rep: dict[str, object] = {
        "repetition": rep_id,
        "recorded": recorded,
        "fixture_seed": seed,
        "regions": len(regions),
        "det_boxes": len(boxes),
        "timings_s": {
            "bgr_convert": round4(bgr_seconds),
            "primary_rec": round4(primary_seconds),
            "det_once": round4(det_seconds),
            "snippet_rec": round4(snippet_seconds),
            "shipped_recognize": round4(shipped_seconds),
            "legacy_composition": None,
        },
        "counts": count_model(len(regions), len(boxes), engine.batch_size),
        "snippet_share": None,
        "output_equal_legacy_vs_shipped": None,
        "mismatched_region_ids": [],
    }

    if recorded:
        legacy_seconds, legacy_results = timed(
            lambda: legacy_composition(engine, image, regions)
        )
        legacy_timings = rep["timings_s"]
        if isinstance(legacy_timings, dict):
            legacy_timings["legacy_composition"] = round4(legacy_seconds)
        mismatches = mismatched_region_ids(shipped_results, legacy_results)
        rep["output_equal_legacy_vs_shipped"] = not mismatches
        rep["mismatched_region_ids"] = mismatches
        share = snippet_share_of(rep)
        rep["snippet_share"] = round(share, 6) if share is not None else None

    print(
        f"[{rep_id}] regions={len(regions)} det_boxes={len(boxes)} "
        f"bgr={round4(bgr_seconds)}s primary={round4(primary_seconds)}s "
        f"det_once={round4(det_seconds)}s snippet_rec={round4(snippet_seconds)}s "
        f"shipped={round4(shipped_seconds)}s",
        flush=True,
    )
    return rep


def median_timings(reps: list[dict[str, object]]) -> dict[str, float]:
    medians: dict[str, float] = {}
    keys = ("bgr_convert", "primary_rec", "det_once", "snippet_rec", "shipped_recognize")
    for key in keys:
        values = []
        for rep in reps:
            timings = rep.get("timings_s")
            if not isinstance(timings, dict):
                continue
            value = timings.get(key)
            if isinstance(value, (int, float)):
                values.append(float(value))
        medians[key] = statistics.median(values)
    return medians


def gpu_providers(names: list[str]) -> list[str]:
    return [name for name in names if name != "CPUExecutionProvider"]


def build_verdict(
    reps: list[dict[str, object]],
    medians: dict[str, float],
    requested: list[str],
    active_det: list[str],
    active_rec: list[str],
) -> dict[str, object]:
    shipped = medians["shipped_recognize"]
    share = (shipped - medians["primary_rec"] - medians["bgr_convert"]) / shipped
    requested_gpu = gpu_providers(requested)
    active_gpu_det = gpu_providers(active_det)
    active_gpu_rec = gpu_providers(active_rec)
    # The F6 failure mode is a SILENT CPU fallback: a GPU provider was
    # requested but no GPU provider is active. A requested-but-inactive
    # higher-priority accelerator (TensorRT) that degrades to an active CUDA
    # provider is the shipped create_session_with_trt_fallback behavior —
    # recorded as a per-name diff, not a verdict.
    gpu_active = bool(active_gpu_det) and bool(active_gpu_rec)
    not_active = [
        name
        for name in requested_gpu
        if name not in active_det or name not in active_rec
    ]

    decision: list[str] = []
    if share >= HOIST_SHARE_THRESHOLD:
        decision.append("hoist")
    if requested_gpu and not gpu_active:
        decision.append("provider")
    if not decision:
        decision.append("intrinsic")

    per_rep_shares: dict[str, float | None] = {}
    for rep in reps:
        rep_id = rep.get("repetition")
        value = rep.get("snippet_share")
        if isinstance(rep_id, str):
            per_rep_shares[rep_id] = value if isinstance(value, float) else None

    share_text = f"{share:.4f}"
    if "hoist" in decision:
        hoist_reason = (
            f"snippet_share={share_text} (median of recorded repetitions) "
            f">= {HOIST_SHARE_THRESHOLD}: the per-batch snippet pass dominates "
            f"the shipped recognize() span"
        )
    else:
        hoist_reason = (
            f"snippet_share={share_text} < {HOIST_SHARE_THRESHOLD}: primary "
            f"recognition dominates; the snippet pass is not the lever"
        )
    if not requested_gpu:
        provider_reason = "no GPU provider requested; nothing can silently fall back"
    elif gpu_active and not_active:
        provider_reason = (
            f"GPU acceleration active on both sessions ({active_gpu_det[0]}); "
            f"requested-but-inactive {not_active} reflects the shipped "
            f"create_session_with_trt_fallback degrade, not a CPU fallback"
        )
    elif gpu_active:
        provider_reason = "every requested GPU provider is active on both sessions"
    else:
        provider_reason = (
            f"requested GPU providers {requested_gpu} but active providers are "
            f"CPU-only on det and/or rec sessions — silent fallback"
        )

    modeled_hoisted = (
        medians["bgr_convert"]
        + medians["primary_rec"]
        + medians["det_once"]
        + medians["snippet_rec"]
    )
    return {
        "snippet_share": round(share, 6),
        "arithmetic": {
            "basis": "medians of recorded repetitions",
            "shipped_recognize_s": round4(shipped),
            "primary_rec_s": round4(medians["primary_rec"]),
            "bgr_convert_s": round4(medians["bgr_convert"]),
            "formula": "(shipped_recognize - primary_rec - bgr_convert) / shipped_recognize",
            "per_repetition_snippet_share": per_rep_shares,
            "note": (
                "the residual also carries the extra per-call BGR conversions "
                "and batch bookkeeping, so the share is an upper bound on the "
                "snippet pass alone"
            ),
        },
        "provider_check": {
            "requested_providers": requested,
            "requested_gpu_providers": requested_gpu,
            "active_providers_det": active_det,
            "active_providers_rec": active_rec,
            "active_gpu_providers_det": active_gpu_det,
            "active_gpu_providers_rec": active_gpu_rec,
            "requested_but_not_active": not_active,
            "gpu_acceleration_active": gpu_active,
            "note": (
                "active lists come from session.get_providers(); the first "
                "entry is the provider ORT actually executes with. The "
                "'provider' verdict fires only on a silent CPU fallback "
                "(GPU requested, none active), not on the shipped TensorRT "
                "degrade to CUDA."
            ),
        },
        "modeled_hoisted_s": round4(modeled_hoisted),
        "modeled_hoisted_formula": (
            "bgr_convert + primary_rec + det_once + snippet_rec (medians); "
            "the shipped recognize() after a hoist fix must match or beat this"
        ),
        "decision": decision,
        "reason": f"{hoist_reason}; {provider_reason}.",
    }


def machine_info(acceleration_profile: str) -> dict[str, object]:
    # Same shape as bench_dense_page.machine_info minus the HTTP client;
    # acceleration_profile added because it decides the provider options.
    device = get_device_info()
    return {
        "os": f"{platform.system()} {platform.release()} ({platform.machine()})",
        "cpu": platform.processor() or platform.machine(),
        "gpu": device.name,
        "ram_gb": bench_dense_page.total_ram_gb(),
        "acceleration_profile": acceleration_profile,
        "resolved_device_profile": device.acceleration_profile,
        "resolved_onnx_provider": device.onnx_provider,
    }


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
    ocr_dir = models_root / OCR_MODEL_KEY
    if not detector_dir.is_dir() or not ocr_dir.is_dir():
        raise SystemExit(
            f"Models root {models_root} does not contain {DETECTOR_MODEL_KEY} "
            f"and {OCR_MODEL_KEY}; pass --models-root for the active install."
        )
    os.environ["KOMA_MODELS_ROOT"] = str(models_root)
    # Before ANY device resolution: the profile decides provider order and
    # CUDA options (get_device_info is lru_cached and reads the env per call).
    os.environ[ACCELERATION_PROFILE_ENV] = args.acceleration_profile

    engine = get_ocr_engine(language=OCR_LANGUAGE, has_gpu=True, model_key=OCR_MODEL_KEY)
    if not isinstance(engine, PPOCRV5RecEngine):
        raise SystemExit(f"Expected the PPOCRv5 engine, got {type(engine).__name__}")

    runtime = engine._runtime.get()  # load now; keep model load out of the timings
    requested = [provider_name(spec) for spec in engine.providers]
    active_det = list(runtime.det_session.get_providers())
    active_rec = list(runtime.session.get_providers())
    print(
        f"engine={engine.key} profile={args.acceleration_profile} "
        f"requested_providers={requested} "
        f"active_det={active_det} active_rec={active_rec}",
        flush=True,
    )

    reps: list[dict[str, object]] = []
    for rep_index in range(1 + args.repetitions):
        reps.append(run_repetition(engine, rep_index=rep_index, seed_base=args.seed_base))

    recorded_reps = [rep for rep in reps if rep.get("recorded") is True]
    medians = median_timings(recorded_reps)
    verdict = build_verdict(recorded_reps, medians, requested, active_det, active_rec)

    artifact: dict[str, object] = {
        "machine": machine_info(args.acceleration_profile),
        "tree": bench_dense_page.tree_info(),
        "engine": {
            "key": engine.key,
            "name": engine.name,
            "model_dir": str(engine.model_dir),
            "batch_size": engine.batch_size,
            "acceleration_profile": args.acceleration_profile,
            "requested_providers": requested,
            "requested_provider_options": provider_options(engine.providers),
            "active_providers": {"det": active_det, "rec": active_rec},
        },
        "fixture": {
            "size_px": [bench_dense_page.PAGE_WIDTH, bench_dense_page.PAGE_HEIGHT],
            "text_regions": bench_dense_page.TEXT_BLOCK_COUNT,
            "seed_base": args.seed_base,
            "seeding": "repetition N uses seed_base + N (warmup = seed_base), "
            "matching the Pass-1 baseline run seeds",
        },
        "repetitions": reps,
        "verdict": verdict,
    }

    out_path = args.out.expanduser().resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")

    print(f"artifact written: {out_path}", flush=True)
    print(json.dumps({"engine": artifact["engine"], "verdict": verdict}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
