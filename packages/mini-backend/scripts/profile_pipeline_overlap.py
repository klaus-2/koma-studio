from __future__ import annotations

import argparse
import asyncio
import dataclasses
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

from PIL import Image  # noqa: E402

from pipelines.batch.stages import CleanSettings, LLMRequestSettings  # noqa: E402
from core.device import get_device_info  # noqa: E402
from models.translation.factory import (  # noqa: E402
    TRANSLATION_MODELS,
    _is_available,
)
from pipelines.batch.orchestrator import (  # noqa: E402
    BatchImageTask,
    BatchOrchestrator,
    BatchRunConfig,
    GpuFlags,
)
from schemas.pipeline_batch import BatchStageConfig  # noqa: E402

SHIPPED_ACCELERATION_PROFILE: Final = "nvidia-cuda-legacy"
DETECTOR_MODEL_KEY: Final = "font_rtdetr_v2"
OCR_MODEL_KEY: Final = "paddleocr_en_v5"
LOCAL_KINDS: Final = {"local_gguf", "local_ctranslate2", "local_transformers"}
GATE_IDLE_SHARE: Final = 0.20
GATE_MAX_503_RATE: Final = 0.02
DEFAULT_PAGES: Final = 6
DEFAULT_WIDTH: Final = 800
DEFAULT_HEIGHT: Final = 1200
GPU_SAMPLE_INTERVAL_S: Final = 0.2
DEFAULT_OUT: Final = (
    MINI_BACKEND_ROOT.parents[1]
    / ".sisyphus"
    / "baselines"
    / "perf-eight-features-f6-overlap-gate.json"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='profile_pipeline_overlap.py')
    parser.add_argument(
        "--models-root",
        type=Path,
        default=Path(os.environ.get("APPDATA", ""))
        / "com.komastudio.desktop"
        / "models",
        help="Managed models root written to KOMA_MODELS_ROOT.",
    )
    parser.add_argument(
        "--acceleration-profile",
        default=SHIPPED_ACCELERATION_PROFILE,
        help="MINI_BACKEND_ACCELERATION_PROFILE value.",
    )
    parser.add_argument("--pages", type=int, default=DEFAULT_PAGES)
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT)
    parser.add_argument(
        "--out",
        type=Path,
        default=DEFAULT_OUT,
        help="Artifact JSON path (gitignored).",
    )
    return parser.parse_args()


def find_local_translation_model() -> str | None:
    for key, meta in TRANSLATION_MODELS.items():
        if meta.get("kind") in LOCAL_KINDS and _is_available(key, meta):
            return key
    return None


def build_synthetic_page_png(width: int, height: int, index: int) -> bytes:
    shade = (600 + index * 20) % 256
    row = [(shade, 255 - shade, shade // 2)] * width
    canvas = Image.new("RGB", (width, height))
    stripe = Image.new("RGB", (width, 1))
    stripe.putdata(row)
    for y in range(height):
        canvas.paste(stripe, (0, y))
    buffer = io.BytesIO()
    canvas.save(buffer, format="PNG")
    return buffer.getvalue()


def spool_png(data: bytes) -> Path:
    handle = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    handle.write(data)
    handle.close()
    return Path(handle.name)


def build_run_config(pages: int, model_key: str) -> BatchRunConfig:
    return BatchRunConfig(
        stages=BatchStageConfig(
            detect=True, ocr=True, translation=True, segment=False, clean=False
        ),
        source_language="en",
        target_language="pt",
        llm_settings=LLMRequestSettings(neighbor_image_context_enabled=True),
        extra_context="",
        custom_llm=None,
        default_detection_model=DETECTOR_MODEL_KEY,
        concurrency=min(4, pages),
        detect_model_key=DETECTOR_MODEL_KEY,
        ocr_model_key=OCR_MODEL_KEY,
        translation_model_key=model_key,
        segment_model_key=None,
        clean=CleanSettings(),
        gpu=GpuFlags(detect=True, ocr=False, segment=False, clean=False),
        batch_id="f6-overlap-gate",
    )


async def run_chapter(
    pages: int, width: int, height: int, model_key: str
) -> tuple[float, int, list[float]]:
    try:
        import pynvml

        pynvml.nvmlInit()
        gpu_handle = pynvml.nvmlDeviceGetHandleByIndex(0)
    except Exception:
        raise SystemExit("pynvml unavailable — cannot sample GPU utilization")

    utilization: list[float] = []
    stop_sampling = asyncio.Event()

    async def sample_gpu() -> None:
        while not stop_sampling.is_set():
            try:
                utilization.append(
                    pynvml.nvmlDeviceGetUtilizationRates(gpu_handle).gpu
                )
            except Exception:
                pass
            await asyncio.sleep(GPU_SAMPLE_INTERVAL_S)

    tasks: list[BatchImageTask] = []
    try:
        for index in range(pages):
            png = build_synthetic_page_png(width, height, index)
            tasks.append(
                BatchImageTask(
                    index=index,
                    filename=f"page-{index + 1}.png",
                    image_path=str(spool_png(png)),
                )
            )
        config = build_run_config(pages, model_key)
        busy_markers = 0
        sampler = asyncio.ensure_future(sample_gpu())
        started = time.perf_counter()
        try:
            outcome = await BatchOrchestrator(config, asyncio.Event()).run(tasks)
        finally:
            stop_sampling.set()
            await sampler
        wall = time.perf_counter() - started
        for result in outcome.report.results:
            payload_text = json.dumps(result.model_dump(), default=str).lower()
            if "inference_busy" in payload_text:
                busy_markers += 1
        return wall, busy_markers, utilization
    finally:
        for task in tasks:
            Path(task.image_path).unlink(missing_ok=True)


def main() -> int:
    args = parse_args()
    models_root = args.models_root.expanduser().resolve()
    detector_dir = models_root / DETECTOR_MODEL_KEY
    ocr_dir = models_root / OCR_MODEL_KEY
    if not detector_dir.is_dir() or not ocr_dir.is_dir():
        raise SystemExit(
            f"Models root {models_root} does not contain {DETECTOR_MODEL_KEY} "
            f"and {OCR_MODEL_KEY}."
        )
    os.environ["KOMA_MODELS_ROOT"] = str(models_root)
    os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = args.acceleration_profile

    local_model = find_local_translation_model()
    if local_model is None:
        artifact = {
            "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "script": "profile_pipeline_overlap.py",
            "pages": args.pages,
            "gate": {
                "name": "F6-BASELINE",
                "pass": False,
                "verdict": (
                    "FAIL — unexecutable baseline: no local translation model "
                    "is installed (models root has detect/OCR/inpaint only). "
                    "The barrier-idle share cannot be measured meaningfully "
                    "without real local translation work behind the phase "
                    "barrier; a cloud-engine proxy would be network-bound and "
                    "out of contract for an unattended dev script. "
                    "Lookahead-1 overlap is NOT implemented; this script "
                    "ships as the instrument for a future run once a local "
                    "model is installed."
                ),
                "conditions": {
                    "a_t3_landed": True,
                    "b_idle_share_ge_20pct": None,
                    "c_503_rate_below_2pct": None,
                },
            },
            "note": (
                "Install a local translation model (e.g. nllb-200-600m-int8) "
                "and re-run to gather the real baseline; the gate then "
                "measures barrier idle share via pynvml plus 503 rate."
            ),
        }
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
        print(f"F6-BASELINE FAIL (unexecutable baseline); artifact {args.out}")
        return 1

    wall, busy, utilization = asyncio.run(
        run_chapter(args.pages, args.width, args.height, local_model)
    )
    active_share = (
        sum(min(value, 100) for value in utilization)
        / (len(utilization) * 100.0)
        if utilization
        else 0.0
    )
    idle_share = max(0.0, 1.0 - active_share)
    busy_rate = busy / max(1, args.pages)
    gate_pass = idle_share >= GATE_IDLE_SHARE and busy_rate < GATE_MAX_503_RATE

    artifact = {
        "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "script": "profile_pipeline_overlap.py",
        "pages": args.pages,
        "local_translation_model": local_model,
        "chapter_wall_seconds": round(wall, 3),
        "gpu_active_share": round(active_share, 4),
        "barrier_idle_share": round(idle_share, 4),
        "inference_busy_count": busy,
        "gate": {
            "name": "F6-BASELINE",
            "idle_threshold": GATE_IDLE_SHARE,
            "max_503_rate": GATE_MAX_503_RATE,
            "pass": gate_pass,
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artifact, indent=2) + "\n", encoding="utf-8")
    print(
        f"F6-BASELINE idle_share={idle_share:.4f} busy_rate={busy_rate:.4f} "
        f"-> {'PASS' if gate_pass else 'FAIL'}; artifact {args.out}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
