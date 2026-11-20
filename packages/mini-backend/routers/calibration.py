"""``POST /calibration/run`` + ``GET /calibration/last``: benchmark the font
detector at candidate working resolutions and recommend the largest one the
machine sustains.

Doctrine (mirrors ``routers/warmup.py``): detection ONLY — never inpainting
or OCR inference, whose payload spikes VRAM on 4GB GPUs. The benchmark is
sequential, capped by a constant wall-clock budget, and runs in a worker
thread (``asyncio.to_thread``) with its own nested event loop so the public
``detector.detect`` path (bounded executor + GPU lease) stays intact.

Honest-measurement notes kept in the report itself:
- The sidecar config is frozen per process (``@lru_cache``), so a candidate
  page larger than the current ``MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS``
  is downscaled by ``BaseDetector`` first. Each measurement therefore records
  ``downscaled`` + ``effective_megapixels`` — what was actually processed —
  instead of silently labeling a downscaled run with the candidate size.
- ``peak_vram_mb`` comes from ``torch.cuda.max_memory_allocated`` per the
  contract; ONNX Runtime CUDA allocations bypass torch's allocator, so the
  value is a torch-visible lower bound of the real peak.
- A single inference call cannot be preempted, so a long call may overshoot
  the budget once; the deadline is enforced between calls, resolutions run
  in ascending order so the cheap ones are measured first.
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import logging
import math
import os
import random
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Final, Literal

from fastapi import APIRouter, HTTPException
from PIL import Image, ImageDraw
from pydantic import BaseModel, Field, ValidationError

from core.config import get_config
from core.device import get_device_info
from models.detection.base_detector import BaseDetector
from models.detection.factory import DEFAULT_DETECTOR_KEY, get_detector
from pipelines.batch.progress import get_batch_progress_registry
from utils.resolution_policy import megapixels_of, stage_resolution_plan

logger = logging.getLogger(__name__)
router = APIRouter(tags=["calibration"])

CALIBRATION_WALL_CLOCK_BUDGET_SECONDS: Final[float] = 20.0
# Within the 4-64 MP tunable clamp and under the 32 MP detection input cap:
# 4 is the tunable floor, 24 is SAFE_TARGET_MEGAPIXELS (the config default).
BENCHMARK_RESOLUTIONS_MEGAPIXELS: Final[tuple[int, ...]] = (4, 12, 24)
MIN_ACCEPTABLE_THROUGHPUT_IMAGES_PER_SECOND: Final[float] = 0.25
VRAM_HEADROOM_RATIO: Final[float] = 0.8
_MIB: Final[float] = 1024.0 * 1024.0
_TIMED_ITERATIONS_PER_RESOLUTION: Final[int] = 2
_PAGE_SEED_BASE: Final[int] = 20261119
_PAGE_ASPECT_RATIO: Final[float] = 1600 / 2200
_DENSE_BLOCKS_PER_MEGAPIXEL: Final[float] = 14.0
_MAX_DENSE_BLOCKS: Final[int] = 300
_APP_DATA_DIR_ENV: Final = "KOMA_APP_DATA_DIR"
_DEV_APP_DATA_DIRNAME: Final = ".koma-studio"
_CALIBRATION_DIRNAME: Final = "calibration"
_REPORT_FILENAME: Final = "last-report.json"

_CALIBRATION_FLIGHT: Final[threading.Lock] = threading.Lock()


class CalibrationDeviceSnapshot(BaseModel):
    name: str
    has_gpu: bool
    cuda_available: bool
    total_vram_mb: float | None = None


class CalibrationResolutionMeasurement(BaseModel):
    megapixels: int
    status: Literal["ok", "failed"]
    iterations: int
    throughput_images_per_second: float | None = None
    peak_vram_mb: float | None = None
    downscaled: bool = False
    effective_megapixels: float | None = None
    error: str | None = None


class CalibrationReport(BaseModel):
    status: Literal["ok", "failed"]
    started_at: str
    completed_at: str
    detector_model_key: str
    device: CalibrationDeviceSnapshot
    wall_clock_seconds: float
    results: list[CalibrationResolutionMeasurement] = Field(default_factory=list)
    error: str | None = None
    recommended_working_resolution: int | None = None


class CalibrationNeverRun(BaseModel):
    status: Literal["never-run"]


def recommend_working_resolution(report: CalibrationReport) -> int | None:
    """Pick the largest measured working resolution this machine sustains.

    Pure function. Rules: any failed measurement disqualifies the whole
    report; every remaining candidate needs throughput at or above the floor
    and — only when total VRAM is known — a measured peak at or under 80% of
    it. ``None`` means "no safe recommendation": callers must never persist
    it as a valid one.
    """
    if report.status != "ok":
        return None
    if not report.results:
        return None
    if any(item.status != "ok" for item in report.results):
        return None
    total_vram_mb = report.device.total_vram_mb
    qualifying: list[CalibrationResolutionMeasurement] = []
    for item in report.results:
        throughput = item.throughput_images_per_second
        if (
            throughput is None
            or throughput < MIN_ACCEPTABLE_THROUGHPUT_IMAGES_PER_SECOND
        ):
            continue
        if total_vram_mb is not None:
            peak = item.peak_vram_mb
            if peak is None or peak > VRAM_HEADROOM_RATIO * total_vram_mb:
                continue
        qualifying.append(item)
    if not qualifying:
        return None
    return max(qualifying, key=lambda item: item.megapixels).megapixels


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _cuda_available() -> bool:
    if importlib.util.find_spec("torch") is None:
        return False
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:  # noqa: BLE001 — optional runtime boundary (torch)
        return False


def _reset_peak_vram() -> None:
    if not _cuda_available():
        return
    import torch

    torch.cuda.reset_peak_memory_stats(0)


def _read_peak_vram_mb() -> float | None:
    if not _cuda_available():
        return None
    import torch

    return round(torch.cuda.max_memory_allocated(0) / _MIB, 1)


def _device_snapshot() -> CalibrationDeviceSnapshot:
    device = get_device_info()
    total_vram_mb: float | None = None
    if device.vram_gb is not None:
        total_vram_mb = round(device.vram_gb * 1024.0, 1)
    return CalibrationDeviceSnapshot(
        name=device.name,
        has_gpu=device.has_gpu,
        cuda_available=_cuda_available(),
        total_vram_mb=total_vram_mb,
    )


def _ensure_no_active_batch() -> None:
    if get_batch_progress_registry().has_unfinished():
        raise HTTPException(
            status_code=409,
            detail="A batch is active; calibration is unavailable until it finishes.",
        )


def _page_dimensions(megapixels: int) -> tuple[int, int]:
    area = megapixels * 1_000_000
    height = max(1, round(math.sqrt(area / _PAGE_ASPECT_RATIO)))
    width = max(1, round(height * _PAGE_ASPECT_RATIO))
    return width, height


def _build_synthetic_page(megapixels: int, seed: int) -> Image.Image:
    """Deterministic dense text-block page used only for calibration timing.

    Isolated on purpose — ``scripts/bench_dense_page.py`` is a dev harness,
    not a library. Rectangles plus default-font glyph blobs give the detector
    enough visual structure; glyph fidelity is irrelevant to throughput and
    no truetype file dependency is taken (portability).
    """
    width, height = _page_dimensions(megapixels)
    rng = random.Random(seed)
    image = Image.new("RGB", (width, height), (246, 243, 236))
    draw = ImageDraw.Draw(image)
    block_count = min(
        _MAX_DENSE_BLOCKS,
        max(24, round(megapixels * _DENSE_BLOCKS_PER_MEGAPIXEL)),
    )
    columns = max(2, round(math.sqrt(block_count * _PAGE_ASPECT_RATIO)))
    rows = max(1, math.ceil(block_count / columns))
    cell_width = width / columns
    cell_height = height / rows
    for block_index in range(block_count):
        column = block_index % columns
        row = block_index // columns
        x0 = column * cell_width + rng.uniform(0.01, 0.08) * cell_width
        y0 = row * cell_height + rng.uniform(0.01, 0.08) * cell_height
        box_width = cell_width - rng.uniform(0.12, 0.22) * cell_width
        box_height = cell_height - rng.uniform(0.12, 0.22) * cell_height
        draw.rectangle(
            (x0, y0, x0 + box_width, y0 + box_height), outline=(20, 20, 20), width=3
        )
        for line_index in range(2 + rng.randint(0, 2)):
            draw.text(
                (x0 + 8, y0 + 8 + line_index * (box_height / 4)),
                "ABCD EFGH 1234",
                fill=(15, 15, 15),
            )
    return image


def _failed_measurement(
    megapixels: int,
    error: str,
    *,
    downscaled: bool,
    effective_megapixels: float | None,
) -> CalibrationResolutionMeasurement:
    return CalibrationResolutionMeasurement(
        megapixels=megapixels,
        status="failed",
        iterations=0,
        throughput_images_per_second=None,
        peak_vram_mb=None,
        downscaled=downscaled,
        effective_megapixels=effective_megapixels,
        error=error,
    )


def _unmeasured_measurement(megapixels: int) -> CalibrationResolutionMeasurement:
    return _failed_measurement(
        megapixels,
        "wall-clock budget exhausted before measurement",
        downscaled=False,
        effective_megapixels=None,
    )


async def _measure_resolution(
    detector: BaseDetector, megapixels: int, deadline: float, *, seed: int
) -> CalibrationResolutionMeasurement:
    page = _build_synthetic_page(megapixels, seed)
    plan = stage_resolution_plan(
        "detection",
        page.width,
        page.height,
        get_config().working_resolution_megapixels,
    )
    effective_megapixels = megapixels_of(plan.working_width, plan.working_height)
    try:
        _reset_peak_vram()
        # Warmup (uncounted): builds the ONNX session and warms the runtime.
        await detector.detect(page)
        durations: list[float] = []
        for _ in range(_TIMED_ITERATIONS_PER_RESOLUTION):
            if time.perf_counter() >= deadline:
                return _failed_measurement(
                    megapixels,
                    "wall-clock budget exhausted mid-measurement",
                    downscaled=plan.downscaled,
                    effective_megapixels=effective_megapixels,
                )
            started = time.perf_counter()
            await detector.detect(page)
            durations.append(time.perf_counter() - started)
    except Exception as exc:  # noqa: BLE001 — per-resolution isolation
        return _failed_measurement(
            megapixels,
            f"{type(exc).__name__}: {exc}",
            downscaled=plan.downscaled,
            effective_megapixels=effective_megapixels,
        )
    total = sum(durations)
    throughput = len(durations) / total if total > 0 else None
    return CalibrationResolutionMeasurement(
        megapixels=megapixels,
        status="ok",
        iterations=len(durations),
        throughput_images_per_second=(
            round(throughput, 4) if throughput is not None else None
        ),
        peak_vram_mb=_read_peak_vram_mb(),
        downscaled=plan.downscaled,
        effective_megapixels=round(effective_megapixels, 3),
        error=None,
    )


async def _benchmark_resolutions(
    detector: BaseDetector, deadline: float
) -> tuple[list[CalibrationResolutionMeasurement], bool]:
    measurements: list[CalibrationResolutionMeasurement] = []
    any_failed = False
    for index, megapixels in enumerate(BENCHMARK_RESOLUTIONS_MEGAPIXELS):
        if time.perf_counter() >= deadline:
            measurements.append(_unmeasured_measurement(megapixels))
            any_failed = True
            continue
        measurement = await _measure_resolution(
            detector, megapixels, deadline, seed=_PAGE_SEED_BASE + index
        )
        if measurement.status != "ok":
            any_failed = True
        measurements.append(measurement)
    return measurements, any_failed


def _execute_calibration() -> CalibrationReport:
    started_perf = time.perf_counter()
    started_at = _utc_now_iso()
    device = _device_snapshot()
    status: Literal["ok", "failed"] = "ok"
    error: str | None = None
    measurements: list[CalibrationResolutionMeasurement] = []
    try:
        detector = get_detector(
            task="text",
            has_gpu=device.has_gpu,
            model_key=DEFAULT_DETECTOR_KEY,
        )
        deadline = started_perf + CALIBRATION_WALL_CLOCK_BUDGET_SECONDS
        measurements, any_failed = asyncio.run(
            _benchmark_resolutions(detector, deadline)
        )
        status = "failed" if any_failed else "ok"
    except Exception as exc:  # noqa: BLE001 — calibration boundary: report, never raise
        status = "failed"
        error = f"{type(exc).__name__}: {exc}"
        logger.warning("calibration.run.failed", exc_info=True)
    report = CalibrationReport(
        status=status,
        started_at=started_at,
        completed_at=_utc_now_iso(),
        detector_model_key=DEFAULT_DETECTOR_KEY,
        device=device,
        wall_clock_seconds=round(time.perf_counter() - started_perf, 3),
        results=measurements,
        error=error,
    )
    recommendation = recommend_working_resolution(report)
    if recommendation is not None:
        report.recommended_working_resolution = recommendation
    _persist_report(report)
    return report


def _run_calibration_benchmark() -> CalibrationReport:
    _ensure_no_active_batch()
    # One benchmark at a time: two concurrent runs would contend for the GPU
    # (top batch risk) and skew each other's timings.
    if not _CALIBRATION_FLIGHT.acquire(blocking=False):
        raise HTTPException(
            status_code=409, detail="A calibration run is already in progress."
        )
    try:
        return _execute_calibration()
    finally:
        _CALIBRATION_FLIGHT.release()


def _report_path() -> Path:
    """Same app-data resolution as ``models/onnx_graph_cache.py``."""
    app_data_dir = Path(
        os.getenv(_APP_DATA_DIR_ENV)
        or os.path.join(os.path.expanduser("~"), _DEV_APP_DATA_DIRNAME)
    )
    return app_data_dir / _CALIBRATION_DIRNAME / _REPORT_FILENAME


def _persist_report(report: CalibrationReport) -> None:
    """Atomic write (tmp + ``os.replace``); failure never breaks the endpoint."""
    payload = report.model_dump(mode="json")
    if payload.get("recommended_working_resolution") is None:
        # A None recommendation is never persisted as a valid one: the key
        # only exists on disk when a recommendation was actually produced.
        payload.pop("recommended_working_resolution", None)
    path = _report_path()
    tmp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}")
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        os.replace(tmp_path, path)
    except OSError:
        logger.warning(
            "calibration.report.persist_failed",
            exc_info=True,
            extra={"path": str(path)},
        )
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


def _load_last_report() -> CalibrationReport | CalibrationNeverRun:
    path = _report_path()
    if not path.is_file():
        return CalibrationNeverRun(status="never-run")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        logger.warning(
            "calibration.report.load_failed",
            exc_info=True,
            extra={"path": str(path)},
        )
        return CalibrationNeverRun(status="never-run")
    try:
        return CalibrationReport.model_validate(raw)
    except ValidationError:
        logger.warning(
            "calibration.report.corrupt",
            exc_info=True,
            extra={"path": str(path)},
        )
        return CalibrationNeverRun(status="never-run")


@router.post("/calibration/run", response_model=CalibrationReport)
async def calibration_run() -> CalibrationReport:
    return await asyncio.to_thread(_run_calibration_benchmark)


@router.get("/calibration/last")
async def calibration_last() -> CalibrationReport | CalibrationNeverRun:
    return await asyncio.to_thread(_load_last_report)
