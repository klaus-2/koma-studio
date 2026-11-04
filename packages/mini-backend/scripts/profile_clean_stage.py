"""Clean-stage micro-profile: decomposes the opaque clean span (Pass-2 T4).

Dev measurement script — NOT benchmarking infrastructure. Runs fully
in-process against the dev source tree with the sidecar venv interpreter
(``apps/tauri/.venv-mini/Scripts/python.exe``); no sidecar/HTTP required.

The Pass-1 baseline shows clean as ONE ``inference.completed`` line of
35.1-42.2s per page (F2). The shipped stage is ``_prepare_clean`` (CPU: mask
generation + solid-fill heuristic + HD-strategy resolution) followed by ONE
inpaint call through the real ``run_inference`` pool. This script times both
parts on the Pass-1 dense fixture family and sweeps a bounded set of at most
FOUR distinct inpaint configs on an IDENTICAL image+mask, so per-config
seconds are directly comparable:

- as-shipped: the heuristic-resolved strategy with the batch route's shipped
  defaults (resize_limit 960, crop_margin 512, crop_trigger_size 512).
- variants: (resize, 512), (resize, 640), (crop, trigger 512). The crop
  variant is dropped when the heuristic already resolved "crop" (it would
  duplicate the as-shipped config).

Schedule: 1 warmup (absorbs the one-time AOT ONNX session load) + 2 recorded
as-shipped reps + 1 recorded rep per variant. Each recorded run's output PNG
is emitted to ``--emit-dir`` for human quality inspection — GATE-3's visual
evidence. Because the artifact is written before a human can look at the
PNGs, the visual verdict is recorded in a second, GPU-free step: re-run with
``--record-visual accepted|rejected`` to fill ``verdict.visual_inspection``
and recompute ``decision`` from the SAME recorded numbers.

Mask construction mirrors ``run_clean_stage``'s records branch call shape:
``detect_text_seeds(image, has_gpu=True, model_key="font_rtdetr_v2")`` ->
``mask_regions_from_records(seeds)``. The seeds carry only bboxes, so the
mask is bbox-rasterized (no segment refinement); the shipped batch path may
feed segment records instead. Scope note: the config comparison holds the
mask constant, so it is internally valid; absolute inpaint seconds correspond
to this mask. ONE fixture (``--seed``, default ``FIXTURE_SEED_BASE``) is
reused for every timed config — unlike the OCR profile there is no
per-repetition seeding.

Private helpers are called deliberately: this is a measurement script
profiling the shipped code paths, not a consumer — ``_prepare_clean``,
``_resolve_hd_strategy``, and ``_encode_png`` from ``pipelines.batch.stages``
(the stage's own decomposition and PNG encoder), and ``AOTInpainter._onnx``
(read-only active-provider check after warmup).

The acceleration profile defaults to ``nvidia-cuda-legacy`` — the value the
shipped launcher resolves for THIS machine. Without it an unattended run can
resolve ``auto`` -> ``nvidia-tensorrt`` with EXHAUSTIVE conv search and the
timings are unrepresentative of the shipped sidecar.

MODEL ALLOWLIST (user hard rule, 2026-11-04): this script loads ONLY
``font_rtdetr_v2`` and ``aot``. GLM/VLM-family engines, pororo, and every
other heavy model must never run on this machine.

GPU EXCLUSIVITY: a concurrent lane may run its own GPU measurements. Before
and after every timed window the script snapshots ``nvidia-smi
--query-compute-apps``; any process outside the ambient baseline and outside
this script's own pid contaminates the window and the measurement is re-run
(max 3 attempts). Contaminated runs are recorded, flagged, and excluded from
the ``config-win`` verdict.
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import io
import json
import os
import platform
import statistics
import subprocess
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Final

MINI_BACKEND_ROOT: Final = Path(__file__).resolve().parents[1]
SCRIPT_DIR: Final = Path(__file__).resolve().parent
REPO_ROOT: Final = Path(__file__).resolve().parents[3]
for _entry in (str(SCRIPT_DIR), str(MINI_BACKEND_ROOT)):
    if _entry not in sys.path:
        sys.path.insert(0, _entry)

import bench_dense_page  # noqa: E402  — sibling dev script, same directory, no package
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from core.device import (  # noqa: E402
    VALID_ACCELERATION_PROFILES,
    OnnxProviderSpec,
    get_device_info,
    get_provider_specs,
    release_gpu_memory,
)
from models.inpainting.aot.inpainter import AOTInpainter  # noqa: E402
from models.inpainting.base_inpainter import (  # noqa: E402
    BaseInpainter,
    HDStrategy,
    ImageU8,
    InpaintConfig,
)
from models.inpainting.factory import get_inpainter  # noqa: E402
from pipelines.batch.records import OCRSeed  # noqa: E402
from pipelines.batch.stages import (  # noqa: E402
    CleanSettings,
    CleanStageResult,
    RGBArray,
    _InpaintJob,
    _encode_png,
    _prepare_clean,
    _resolve_hd_strategy,
    mask_regions_from_records,
)
from pipelines.detection_seeds import detect_text_seeds  # noqa: E402
from utils.inpaint_heuristics import apply_need_inpaint_heuristic  # noqa: E402
from utils.mask import MaskRegion, generate_baka_style_mask  # noqa: E402

DETECTOR_MODEL_KEY: Final = "font_rtdetr_v2"
INPAINT_MODEL_KEY: Final = "aot"
ACCELERATION_PROFILE_ENV: Final = "MINI_BACKEND_ACCELERATION_PROFILE"
SHIPPED_ACCELERATION_PROFILE: Final = "nvidia-cuda-legacy"
CONFIG_WIN_THRESHOLD: Final = 0.30
MAX_TIMED_ATTEMPTS: Final = 3
# Pass-1 F2, re-verified fresh in this session: the shipped clean stage shows
# ONE inference.completed per run in .sisyphus/baselines/
# perf-tiers-pass1-baseline.json, ranging 35.1258-42.1588s.
PASS1_CLEAN_SPAN_S: Final = (35.1258, 42.1588)
# Shipped batch-route clean defaults (routers/pipeline.py fallbacks, F9).
SHIPPED_MASK_DILATION: Final = 5
SHIPPED_RESIZE_LIMIT: Final = 960
SHIPPED_CROP_MARGIN: Final = 512
SHIPPED_CROP_TRIGGER: Final = 512
DEFAULT_OUT: Final = (
    REPO_ROOT / ".sisyphus" / "baselines" / "perf-tiers-pass2-clean-profile.json"
)
DEFAULT_EMIT_DIR: Final = (
    REPO_ROOT / ".sisyphus" / "baselines" / "pass2-clean-pngs"
)
DEFAULT_MODELS_ROOT: Final = (
    Path(os.environ.get("APPDATA", "")) / "com.komastudio.desktop" / "models"
)


@dataclass(frozen=True, slots=True)
class SweepConfig:
    label: str
    role: str  # "as-shipped" | "variant"
    hd_strategy: str
    resize_limit: int
    crop_margin: int
    crop_trigger_size: int

    def fields(self) -> dict[str, object]:
        return {
            "hd_strategy": self.hd_strategy,
            "hd_strategy_resize_limit": self.resize_limit,
            "hd_strategy_crop_margin": self.crop_margin,
            "hd_strategy_crop_trigger_size": self.crop_trigger_size,
        }


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
        "shipped launcher's runtime selection for this machine.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Artifact JSON path (gitignored); overwritten on each sweep.",
    )
    parser.add_argument(
        "--emit-dir",
        type=Path,
        default=DEFAULT_EMIT_DIR,
        help="Directory for the recorded runs' output PNGs (visual evidence).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=bench_dense_page.FIXTURE_SEED_BASE,
        help="Fixture seed; ONE fixture is reused for every timed config.",
    )
    parser.add_argument(
        "--record-visual",
        choices=("accepted", "rejected"),
        default=None,
        help="GPU-free finalize step: load the existing artifact, record the "
        "executor's eyeball verdict on the emitted PNGs, and recompute the "
        "decision from the already-recorded timings.",
    )
    return parser.parse_args()


def provider_name(spec: OnnxProviderSpec) -> str:
    return spec if isinstance(spec, str) else spec[0]


def timed[T](operation: Callable[[], T]) -> tuple[float, T]:
    start = time.perf_counter()
    value = operation()
    return time.perf_counter() - start, value


def round4(seconds: float) -> float:
    return round(seconds, 4)


# --------------------------------------------------------------------------- #
# Narrow JSON accessors (the repo avoids Any-typed payloads)
# --------------------------------------------------------------------------- #
def as_dict(value: object) -> dict[str, object] | None:
    return value if isinstance(value, dict) else None


def as_list(value: object) -> list[object] | None:
    return value if isinstance(value, list) else None


def as_float(value: object) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


def as_str(value: object) -> str | None:
    return value if isinstance(value, str) else None


# --------------------------------------------------------------------------- #
# GPU exclusivity (a concurrent lane may time the same GPU)
# --------------------------------------------------------------------------- #
def gpu_compute_snapshot() -> tuple[list[dict[str, object]], str | None]:
    """(entries, error); error is recorded, never silent."""
    try:
        completed = subprocess.run(
            [
                "nvidia-smi",
                "--query-compute-apps=pid,process_name",
                "--format=csv,noheader",
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=30.0,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return [], f"{type(exc).__name__}: {exc}"
    entries: list[dict[str, object]] = []
    for line in completed.stdout.splitlines():
        pid_text, _, name = line.partition(",")
        pid_text = pid_text.strip()
        if not pid_text.isdigit():
            continue
        entries.append({"pid": int(pid_text), "process_name": name.strip()})
    return entries, None


def foreign_gpu_processes(
    entries: list[dict[str, object]],
    baseline_pids: set[int],
    own_pid: int,
) -> list[dict[str, object]]:
    foreign: list[dict[str, object]] = []
    for entry in entries:
        pid = entry.get("pid")
        if isinstance(pid, int) and pid not in baseline_pids and pid != own_pid:
            foreign.append(entry)
    return foreign


# --------------------------------------------------------------------------- #
# Clean prepare phase (CPU): mask gen + heuristic + strategy, decomposed
# --------------------------------------------------------------------------- #
def prepare_phase(
    rgb: RGBArray,
    mask_regions: list[MaskRegion],
    settings: CleanSettings,
) -> tuple[dict[str, object], _InpaintJob]:
    """Times _prepare_clean directly plus its component steps on identical
    inputs; the components sum to ~the direct stopwatch (auditable split)."""
    mask_seconds, mask = timed(
        lambda: generate_baka_style_mask(
            image_width=rgb.shape[1],
            image_height=rgb.shape[0],
            regions=list(mask_regions),
            mask_dilation=settings.mask_dilation,
        )
    )
    heuristic_seconds, heuristic = timed(
        lambda: apply_need_inpaint_heuristic(rgb, mask)
    )
    strategy_seconds, strategy = timed(
        lambda: _resolve_hd_strategy(settings.hd_strategy, rgb, heuristic.remaining_mask)
    )
    prepare_seconds, prepared = timed(
        lambda: _prepare_clean(rgb, mask_regions, settings)
    )
    if isinstance(prepared, CleanStageResult):
        raise SystemExit(
            "_prepare_clean resolved the fixture to a no-model result "
            f"({prepared.model_used}); there is no inpaint job to sweep. "
            f"mask coverage px={int(np.count_nonzero(mask))}"
        )
    consistent = (
        prepared.hd_strategy == strategy
        and bool(np.array_equal(prepared.remaining_mask, heuristic.remaining_mask))
    )
    if not consistent:
        raise SystemExit(
            "prepare decomposition mismatch: the component steps disagree "
            "with _prepare_clean's own result"
        )
    coverage_pct = 100.0 * float(np.count_nonzero(mask)) / float(mask.size)
    remaining_px = int(np.count_nonzero(prepared.remaining_mask))
    block: dict[str, object] = {
        "source": (
            "detect_text_seeds(font_rtdetr_v2) records fed through "
            "mask_regions_from_records — the records-branch call shape of "
            "run_clean_stage; bbox-rasterized (seeds carry no segment boxes)"
        ),
        "regions": len(mask_regions),
        "mask_dilation": settings.mask_dilation,
        "generated_mask_coverage_pct": round(coverage_pct, 4),
        "filled_components": heuristic.filled_components,
        "total_components": heuristic.total_components,
        "remaining_mask_nonzero_pixels": remaining_px,
        "remaining_mask_coverage_pct": round(
            100.0 * remaining_px / float(prepared.remaining_mask.size), 4
        ),
        "resolved_hd_strategy": prepared.hd_strategy,
        "strategy_consistent": True,
        "components_s": {
            "mask_gen": round4(mask_seconds),
            "heuristic": round4(heuristic_seconds),
            "strategy_resolve": round4(strategy_seconds),
        },
        "prepare_total_s": round4(prepare_seconds),
        "note": (
            "prepare_total_s is the direct _prepare_clean stopwatch; "
            "components_s are the same steps timed separately on identical "
            "inputs (they sum to ~prepare_total_s)"
        ),
    }
    return block, prepared


# --------------------------------------------------------------------------- #
# Timed inpaint runs (through the real run_inference pool)
# --------------------------------------------------------------------------- #
def run_timed(
    inpainter: BaseInpainter,
    job: _InpaintJob,
    cfg: SweepConfig,
    *,
    run_id: str,
    recorded: bool,
    emit_dir: Path,
    baseline_pids: set[int],
) -> dict[str, object]:
    config = InpaintConfig(
        hd_strategy=HDStrategy.from_value(cfg.hd_strategy),
        hd_strategy_resize_limit=cfg.resize_limit,
        hd_strategy_crop_margin=cfg.crop_margin,
        hd_strategy_crop_trigger_size=cfg.crop_trigger_size,
    )
    attempts: list[dict[str, object]] = []
    seconds = 0.0
    result: ImageU8 | None = None
    contaminated = False
    for attempt in range(1, MAX_TIMED_ATTEMPTS + 1):
        before, before_error = gpu_compute_snapshot()
        run_seconds, run_result = timed(
            lambda: asyncio.run(
                inpainter.inpaint(job.image_rgb, job.remaining_mask, config)
            )
        )
        after, after_error = gpu_compute_snapshot()
        release_gpu_memory()  # mirrors run_clean_stage's per-stage release
        foreign = foreign_gpu_processes(
            before + after, baseline_pids, os.getpid()
        )
        seconds = run_seconds
        result = run_result
        contaminated = bool(foreign)
        attempts.append(
            {
                "attempt": attempt,
                "seconds": round4(run_seconds),
                "gpu_compute_before": before,
                "gpu_compute_after": after,
                "gpu_snapshot_errors": [
                    error
                    for error in (before_error, after_error)
                    if error is not None
                ],
                "foreign_processes": foreign,
            }
        )
        if not contaminated or attempt == MAX_TIMED_ATTEMPTS:
            break
        print(
            f"[{run_id}] foreign GPU processes {foreign} during timed window; "
            f"re-running measurement (attempt {attempt + 1}/{MAX_TIMED_ATTEMPTS})",
            flush=True,
        )

    emitted: str | None = None
    if recorded and result is not None:
        emit_dir.mkdir(parents=True, exist_ok=True)
        emit_path = emit_dir / f"{run_id}.png"
        emit_path.write_bytes(_encode_png(result))
        emitted = str(emit_path)

    return {
        "run_id": run_id,
        "recorded": recorded,
        "config": cfg.fields(),
        "seconds": round4(seconds),
        "output_px": {
            "height": int(result.shape[0]),
            "width": int(result.shape[1]),
        },
        "emitted_png": emitted,
        "contaminated": contaminated,
        "attempts": attempts,
    }


# --------------------------------------------------------------------------- #
# Verdict (shared by the sweep and the --record-visual finalize step)
# --------------------------------------------------------------------------- #
def recorded_seconds(entry: dict[str, object]) -> list[float]:
    runs = as_list(entry.get("runs")) or []
    seconds: list[float] = []
    for run in runs:
        run_dict = as_dict(run)
        if run_dict is None or run_dict.get("recorded") is not True:
            continue
        value = as_float(run_dict.get("seconds"))
        if value is not None:
            seconds.append(value)
    return seconds


def kept_contaminated_run_ids(entry: dict[str, object]) -> list[str]:
    runs = as_list(entry.get("runs")) or []
    flagged: list[str] = []
    for run in runs:
        run_dict = as_dict(run)
        if (
            run_dict is not None
            and run_dict.get("recorded") is True
            and run_dict.get("contaminated") is True
        ):
            run_id = as_str(run_dict.get("run_id"))
            if run_id is not None:
                flagged.append(run_id)
    return flagged


def compute_verdict(
    configs: list[dict[str, object]],
    mask: dict[str, object],
    visual: dict[str, object],
) -> dict[str, object]:
    prepare_total = as_float(mask.get("prepare_total_s"))
    if prepare_total is None:
        raise SystemExit("Artifact mask block is missing prepare_total_s")

    as_shipped_seconds: list[float] = []
    variants: list[tuple[str, float]] = []
    contaminated: list[str] = []
    for entry in configs:
        entry_dict = as_dict(entry)
        if entry_dict is None:
            continue
        role = as_str(entry_dict.get("role"))
        label = as_str(entry_dict.get("label")) or "?"
        seconds = recorded_seconds(entry_dict)
        contaminated.extend(kept_contaminated_run_ids(entry_dict))
        if role == "as-shipped":
            as_shipped_seconds.extend(seconds)
        elif role == "variant" and seconds:
            variants.append((label, min(seconds)))

    if not as_shipped_seconds or not variants:
        raise SystemExit(
            "Artifact configs carry no recorded as-shipped or variant timings"
        )

    as_shipped_median = statistics.median(as_shipped_seconds)
    best_label, best_seconds = min(variants, key=lambda item: item[1])
    slowest_label, slowest_seconds = max(variants, key=lambda item: item[1])
    best_delta = (as_shipped_median - best_seconds) / as_shipped_median
    prepare_share = prepare_total / (prepare_total + as_shipped_median)
    visual_performed = visual.get("performed") is True
    visual_ok = visual_performed and visual.get("acceptable") is True

    decision = "intrinsic"
    if best_delta >= CONFIG_WIN_THRESHOLD and visual_ok and not contaminated:
        decision = "config-win"

    parts = [
        f"prepare_share={prepare_share:.4f} = prepare_total_s"
        f"({prepare_total:.4f}) / (prepare_total_s + as_shipped_median_s"
        f"({as_shipped_median:.4f})): the CPU mask/heuristic share of the "
        "clean span",
        f"best variant {best_label}: {best_seconds:.4f}s vs as-shipped median "
        f"{as_shipped_median:.4f}s -> best_delta={best_delta:.4f} "
        f"({best_delta * 100:.1f}% inpaint reduction)",
    ]
    if contaminated:
        parts.append(
            f"timings for {contaminated} were contaminated by foreign GPU "
            "processes — treat the deltas as suspect"
        )
    if not visual_ok:
        parts.append(
            "visual inspection pending/unaccepted — review the emitted PNGs "
            "and re-run with --record-visual accepted|rejected"
        )
    if decision == "config-win":
        parts.append(
            f"best_delta >= {CONFIG_WIN_THRESHOLD} at the recorded mask "
            "fidelity (see the mask block; every config ran the identical "
            "job) with visual inspection accepted"
        )
    else:
        parts.append(
            f"config-win criterion not met (threshold {CONFIG_WIN_THRESHOLD}, "
            "visual acceptance, clean timings)"
        )

    return {
        "prepare_share": round(prepare_share, 6),
        "arithmetic_prepare_share": {
            "prepare_total_s": round4(prepare_total),
            "as_shipped_median_s": round4(as_shipped_median),
            "formula": "prepare_total / (prepare_total + as_shipped_median)",
        },
        "best_delta": round(best_delta, 6),
        "best_variant": best_label,
        "arithmetic_best_delta": {
            "as_shipped_reps_s": [round4(v) for v in as_shipped_seconds],
            "as_shipped_median_s": round4(as_shipped_median),
            "best_variant_s": round4(best_seconds),
            "formula": "(as_shipped_median - best_variant) / as_shipped_median",
        },
        "shipped_span_context": {
            "pass1_clean_span_s": list(PASS1_CLEAN_SPAN_S),
            "pass1_source": (
                "F2: perf-tiers-pass1-baseline.json — one inference.completed "
                "per clean stage in the Pass-1 sidecar baseline"
            ),
            "in_process_as_shipped_median_s": round4(as_shipped_median),
            "in_process_variant_range_s": [
                round4(min(seconds for _, seconds in variants)),
                round4(max(seconds for _, seconds in variants)),
            ],
            "slowest_variant": {
                "label": slowest_label,
                "seconds": round4(slowest_seconds),
            },
            "reading": (
                f"The shipped clean stage measured "
                f"{PASS1_CLEAN_SPAN_S[0]:.4f}-{PASS1_CLEAN_SPAN_S[1]:.4f}s "
                f"(Pass-1 F2) while this profile's AOT forward at the shipped "
                f"resize config runs in {as_shipped_median:.4f}s in-process "
                f"and the {slowest_label} variant runs at "
                f"{slowest_seconds:.4f}s on the identical mask. The shipped "
                "span sits between the two strategy branches and is "
                "consistent with the heuristic resolving 'crop' on the "
                "shipped segment-fed mask (baka_content_cc is outside this "
                "script's allowlist, so the shipped mask was not reproduced "
                "here); co-resident engine VRAM pressure in the sidecar is "
                "not excluded as a secondary factor. Consequence for T5: if "
                "the shipped path resolves 'crop', the strategy resolution "
                "is the dominant lever (fastest vs slowest branch differ by "
                f"{(slowest_seconds - best_seconds) / slowest_seconds * 100:.1f}% "
                "on identical input) and GATE-3's quality question is "
                "crop-vs-resize output; if the shipped path resolves "
                "'resize', the config lever is bounded by this sweep's "
                f"resize deltas ({best_seconds:.4f}s best) and cannot "
                "explain the shipped span."
            ),
        },
        "decision_rule": (
            '"config-win" iff best_delta >= 0.30 AND visual_inspection '
            "recorded AND acceptable AND no contaminated recorded run; "
            'else "intrinsic"'
        ),
        "visual_inspection": visual,
        "decision": decision,
        "reason": "; ".join(parts) + ".",
    }


def visual_compared_paths(configs: list[dict[str, object]]) -> list[str]:
    paths: list[str] = []
    for entry in configs:
        entry_dict = as_dict(entry)
        if entry_dict is None:
            continue
        for run in as_list(entry_dict.get("runs")) or []:
            run_dict = as_dict(run)
            if run_dict is None or run_dict.get("recorded") is not True:
                continue
            emitted = as_str(run_dict.get("emitted_png"))
            if emitted is not None:
                paths.append(emitted)
    return paths


# --------------------------------------------------------------------------- #
# --record-visual: GPU-free finalize step over the existing artifact
# --------------------------------------------------------------------------- #
def record_visual(out_path: Path, accepted: bool) -> int:
    if not out_path.is_file():
        raise SystemExit(f"Artifact not found: {out_path} — run the sweep first")
    artifact = as_dict(json.loads(out_path.read_text(encoding="utf-8")))
    if artifact is None:
        raise SystemExit(f"Artifact at {out_path} is not a JSON object")
    configs = as_list(artifact.get("configs"))
    mask = as_dict(artifact.get("mask"))
    if not configs or mask is None:
        raise SystemExit(
            f"Artifact at {out_path} has no configs/mask blocks to finalize"
        )
    compared = visual_compared_paths(configs)
    if not compared:
        raise SystemExit("Artifact has no emitted PNG paths to compare")
    visual = {
        "performed": True,
        "acceptable": accepted,
        "compared_paths": compared,
        "method": (
            "executor eyeball comparison of the emitted PNGs (as-shipped "
            "baseline vs each variant); recorded via --record-visual"
        ),
    }
    verdict = compute_verdict(configs, mask, visual)
    artifact["verdict"] = verdict
    out_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(f"visual verdict recorded ({'accepted' if accepted else 'rejected'}); "
          f"artifact updated: {out_path}", flush=True)
    print(json.dumps({"verdict": verdict}, indent=2))
    return 0


def machine_info(acceleration_profile: str) -> dict[str, object]:
    # Same shape as profile_ocr_stage.machine_info; acceleration_profile
    # decides the ORT provider options for the AOT session.
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


def build_sweep_configs(resolved_strategy: str) -> tuple[list[SweepConfig], str | None]:
    as_shipped = SweepConfig(
        label="as-shipped",
        role="as-shipped",
        hd_strategy=resolved_strategy,
        resize_limit=SHIPPED_RESIZE_LIMIT,
        crop_margin=SHIPPED_CROP_MARGIN,
        crop_trigger_size=SHIPPED_CROP_TRIGGER,
    )
    variants = [
        SweepConfig("resize-512", "variant", "resize", 512, SHIPPED_CROP_MARGIN, SHIPPED_CROP_TRIGGER),
        SweepConfig("resize-640", "variant", "resize", 640, SHIPPED_CROP_MARGIN, SHIPPED_CROP_TRIGGER),
        SweepConfig("crop-trigger-512", "variant", "crop", SHIPPED_RESIZE_LIMIT, SHIPPED_CROP_MARGIN, 512),
    ]
    dedupe_note: str | None = None
    if resolved_strategy == "crop":
        variants = [v for v in variants if v.label != "crop-trigger-512"]
        dedupe_note = (
            'the heuristic resolved "crop", so the (crop, trigger 512) '
            "variant duplicates the as-shipped config and was dropped; "
            "3 distinct configs remain (<= 4 cap)"
        )
    return [as_shipped, *variants], dedupe_note


def main() -> int:
    args = parse_args()
    if args.acceleration_profile not in VALID_ACCELERATION_PROFILES:
        raise SystemExit(
            f"--acceleration-profile must be one of {sorted(VALID_ACCELERATION_PROFILES)}"
        )
    out_path = args.out.expanduser().resolve()
    if args.record_visual is not None:
        return record_visual(out_path, accepted=args.record_visual == "accepted")

    models_root = args.models_root.expanduser().resolve()
    detector_dir = models_root / DETECTOR_MODEL_KEY
    inpaint_dir = models_root / INPAINT_MODEL_KEY
    if not detector_dir.is_dir() or not inpaint_dir.is_dir():
        raise SystemExit(
            f"Models root {models_root} does not contain {DETECTOR_MODEL_KEY} "
            f"and {INPAINT_MODEL_KEY}; pass --models-root for the active install."
        )
    os.environ["KOMA_MODELS_ROOT"] = str(models_root)
    # Before ANY device resolution: the profile decides provider order and
    # CUDA options (get_device_info is lru_cached and reads the env per call).
    os.environ[ACCELERATION_PROFILE_ENV] = args.acceleration_profile

    ambient, ambient_error = gpu_compute_snapshot()
    baseline_pids = {
        entry["pid"] for entry in ambient if isinstance(entry.get("pid"), int)
    }
    print(
        f"gpu-exclusivity baseline: {len(ambient)} ambient processes"
        + (f" (snapshot error: {ambient_error})" if ambient_error else ""),
        flush=True,
    )

    inpainter = get_inpainter(
        has_gpu=True, image_complexity="auto", model_key=INPAINT_MODEL_KEY
    )
    if not isinstance(inpainter, AOTInpainter):
        raise SystemExit(f"Expected the AOT inpainter, got {type(inpainter).__name__}")

    fixture_png = bench_dense_page.build_fixture_png(args.seed, emit_path=None)
    image = Image.open(io.BytesIO(fixture_png))
    rgb: RGBArray = np.asarray(image, dtype=np.uint8)
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        raise SystemExit("The fixture did not decode to RGB")

    detect_seconds, seeds = timed(
        lambda: asyncio.run(
            detect_text_seeds(image, has_gpu=True, model_key=DETECTOR_MODEL_KEY)
        )
    )
    mask_regions = mask_regions_from_records(seeds)
    if not mask_regions:
        raise SystemExit(f"Fixture seed {args.seed} produced no mask regions")

    settings = CleanSettings(
        model_key=INPAINT_MODEL_KEY,
        mask_dilation=SHIPPED_MASK_DILATION,
        hd_strategy=None,  # the batch route ships None -> heuristic resolves
        hd_strategy_resize_limit=SHIPPED_RESIZE_LIMIT,
        hd_strategy_crop_margin=SHIPPED_CROP_MARGIN,
        hd_strategy_crop_trigger_size=SHIPPED_CROP_TRIGGER,
    )
    mask_block, job = prepare_phase(rgb, mask_regions, settings)
    print(
        f"[mask] regions={mask_block['regions']} "
        f"coverage={mask_block['generated_mask_coverage_pct']}% "
        f"strategy={mask_block['resolved_hd_strategy']} "
        f"filled={mask_block['filled_components']}/{mask_block['total_components']} "
        f"remaining_px={mask_block['remaining_mask_nonzero_pixels']} "
        f"prepare={mask_block['prepare_total_s']}s",
        flush=True,
    )

    sweep_configs, dedupe_note = build_sweep_configs(job.hd_strategy)
    as_shipped = sweep_configs[0]
    emit_dir = args.emit_dir.expanduser().resolve()

    warmup = run_timed(
        inpainter,
        job,
        as_shipped,
        run_id="warmup",
        recorded=False,
        emit_dir=emit_dir,
        baseline_pids=baseline_pids,
    )
    print(f"[warmup] seconds={warmup['seconds']} (includes one-time AOT session load)", flush=True)
    # Read-only private access: the active providers of the loaded AOT session
    # (the shipped load log records only the requested providers).
    active_providers = list(inpainter._onnx.load().session.get_providers())
    print(
        f"inpainter={inpainter.key} profile={args.acceleration_profile} "
        f"requested={ [provider_name(spec) for spec in get_provider_specs(get_device_info())] } "
        f"active={active_providers}",
        flush=True,
    )

    runs_by_id: dict[str, dict[str, object]] = {"warmup": warmup}
    for rep in (1, 2):
        rep_id = f"as-shipped-rep{rep}"
        run = run_timed(
            inpainter,
            job,
            as_shipped,
            run_id=rep_id,
            recorded=True,
            emit_dir=emit_dir,
            baseline_pids=baseline_pids,
        )
        runs_by_id[rep_id] = run
        print(
            f"[as-shipped-rep{rep}] seconds={run['seconds']} "
            f"strategy={as_shipped.hd_strategy} limit={as_shipped.resize_limit}",
            flush=True,
        )
    variant_runs: dict[str, dict[str, object]] = {}
    for cfg in sweep_configs[1:]:
        run = run_timed(
            inpainter,
            job,
            cfg,
            run_id=cfg.label,
            recorded=True,
            emit_dir=emit_dir,
            baseline_pids=baseline_pids,
        )
        variant_runs[cfg.label] = run
        print(
            f"[{cfg.label}] seconds={run['seconds']} "
            f"strategy={cfg.hd_strategy} limit={cfg.resize_limit}",
            flush=True,
        )

    configs: list[dict[str, object]] = [
        {
            "label": as_shipped.label,
            "role": as_shipped.role,
            **as_shipped.fields(),
            "runs": [warmup, runs_by_id["as-shipped-rep1"], runs_by_id["as-shipped-rep2"]],
        }
    ]
    for cfg in sweep_configs[1:]:
        configs.append(
            {
                "label": cfg.label,
                "role": cfg.role,
                **cfg.fields(),
                "runs": [variant_runs[cfg.label]],
            }
        )

    visual = {
        "performed": False,
        "acceptable": None,
        "compared_paths": visual_compared_paths(configs),
        "method": (
            "executor eyeball comparison of the emitted PNGs (as-shipped "
            "baseline vs each variant); recorded via --record-visual "
            "accepted|rejected"
        ),
    }
    verdict = compute_verdict(configs, mask_block, visual)

    contaminated_ids = [
        run_id
        for entry in configs
        for run_id in kept_contaminated_run_ids(entry)
    ]
    gpu_block: dict[str, object] = {
        "tool": "nvidia-smi --query-compute-apps=pid,process_name",
        "checked": ambient_error is None,
        "ambient_baseline": ambient,
        "own_pid": os.getpid(),
        "policy": (
            "a timed run is re-run (max "
            f"{MAX_TIMED_ATTEMPTS} attempts) when a process outside the "
            "ambient baseline and outside this script's pid appears in the "
            "before/after snapshot of the window"
        ),
        "contaminated_runs": contaminated_ids,
    }
    if ambient_error is not None:
        gpu_block["snapshot_error"] = ambient_error

    artifact: dict[str, object] = {
        "machine": machine_info(args.acceleration_profile),
        "tree": bench_dense_page.tree_info(),
        "fixture": {
            "size_px": [bench_dense_page.PAGE_WIDTH, bench_dense_page.PAGE_HEIGHT],
            "text_regions": bench_dense_page.TEXT_BLOCK_COUNT,
            "seed": args.seed,
            "png_sha256": hashlib.sha256(fixture_png).hexdigest(),
            "detect_seconds": round4(detect_seconds),
            "detect_regions": len(seeds),
            "seeding": (
                "ONE fixture reused for every timed config so the config "
                "comparison holds image and mask constant (no per-repetition "
                "seeding, unlike the OCR profile)"
            ),
        },
        "mask": mask_block,
        "inpainter": {
            "key": inpainter.key,
            "name": inpainter.name,
            "model_key_requested": INPAINT_MODEL_KEY,
            "acceleration_profile": args.acceleration_profile,
            "requested_providers": [
                provider_name(spec)
                for spec in get_provider_specs(get_device_info())
            ],
            "active_providers": active_providers,
        },
        "gpu_exclusivity": gpu_block,
        "configs": configs,
    }
    if dedupe_note is not None:
        artifact["configs_note"] = dedupe_note
    artifact["verdict"] = verdict

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")

    print(f"artifact written: {out_path}", flush=True)
    print(
        json.dumps(
            {"mask": mask_block, "verdict": verdict, "gpu_exclusivity": gpu_block},
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
