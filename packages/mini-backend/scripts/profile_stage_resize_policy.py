"""OCR/clean-stage A/B: working-resolution policy OFF vs ON on one dense fixture.

Mirrors profile_stage_downscale.py; requires the real OCR + inpaint models
(SystemExit when unavailable — results are never faked). Writes timing and
degradation counters to --out (.sisyphus/baselines/ by default).
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import os
import sys
import tempfile
import time
import traceback
from dataclasses import dataclass
from pathlib import Path
from typing import Final

MINI_BACKEND_ROOT: Final = Path(__file__).resolve().parents[1]
for _entry in (str(MINI_BACKEND_ROOT),):
    if _entry not in sys.path:
        sys.path.insert(0, _entry)

from PIL import Image, ImageDraw  # noqa: E402

from core.config import get_config  # noqa: E402
from models.inpainting.storage import resolve_inpainting_model_path  # noqa: E402
from models.ocr.factory import _resolve_auto_model  # noqa: E402
from pipelines.batch import stages  # noqa: E402
from pipelines.batch.records import OCRRecord, OCRSeed  # noqa: E402
from pipelines.batch.stages import CleanSettings  # noqa: E402
from pipelines.ocr_region_dedup import get_ocr_region_dedup_cache  # noqa: E402
from pipelines.ocr_stage import CachedOcrRequest, run_cached_ocr  # noqa: E402
from pipelines.stage_store import StageStore, close_stage_store  # noqa: E402
from utils.resolution_policy import (  # noqa: E402
    SAFE_TARGET_MEGAPIXELS,
    megapixels_of,
    stage_resolution_plan,
)

SHIPPED_ACCELERATION_PROFILE: Final = "nvidia-cuda-legacy"
DETECTOR_MODEL_KEY: Final = "font_rtdetr_v2"
INPAINTER_MODEL_KEY: Final = "aot"
TEXT_DEGRADATION_LIMIT: Final = 0.15
DEFAULT_WIDTH: Final = 4400
DEFAULT_HEIGHT: Final = 6800
DEFAULT_LANGUAGE: Final = "ja"
DEFAULT_OUT: Final = (
    MINI_BACKEND_ROOT.parents[1]
    / ".sisyphus"
    / "baselines"
    / "perf-fase1-stage-resize-ocr-clean-ab.json"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="profile_stage_resize_policy.py")
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
    parser.add_argument("--language", default=DEFAULT_LANGUAGE)
    parser.add_argument("--ocr-model-key", default="auto")
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


def build_ocr_seeds(width: int, height: int) -> tuple[OCRSeed, ...]:
    seeds: list[OCRSeed] = []
    box_w, box_h = 220, 60
    stride_x, stride_y = 640, 320
    y = 100
    index = 0
    while y + box_h < height - 100:
        x = 100
        while x + box_w < width - 100:
            seeds.append(
                OCRSeed(
                    id=f"seed-{index}",
                    bbox=[x, y, x + box_w, y + box_h],
                    source="model",
                    detector_model_key=DETECTOR_MODEL_KEY,
                )
            )
            index += 1
            x += stride_x
        y += stride_y
    return tuple(seeds)


def build_clean_regions(width: int, height: int) -> list[dict[str, object]]:
    regions: list[dict[str, object]] = []
    box_w, box_h = 360, 120
    stride_x, stride_y = 900, 700
    y = 150
    while y + box_h < height - 150:
        x = 150
        while x + box_w < width - 150:
            regions.append({"bbox": [x, y, x + box_w, y + box_h]})
            x += stride_x
        y += stride_y
    return regions


def _require_ocr_model(language: str, ocr_model_key: str) -> str:
    if ocr_model_key != "auto":
        return ocr_model_key
    resolved = _resolve_auto_model(language=language, has_gpu=True)
    if not resolved:
        raise SystemExit(
            f"No installed OCR model for language={language!r} "
            f"(KOMA_MODELS_ROOT={os.environ.get('KOMA_MODELS_ROOT', '<unset>')})"
            " — install one via the Model Manager"
        )
    return resolved


def _require_inpaint_model() -> None:
    if resolve_inpainting_model_path(INPAINTER_MODEL_KEY) is None:
        raise SystemExit(
            f"Inpaint payload unavailable: {INPAINTER_MODEL_KEY} "
            f"(KOMA_MODELS_ROOT={os.environ.get('KOMA_MODELS_ROOT', '<unset>')})"
        )


def _apply_policy_env(*, enabled: bool) -> None:
    os.environ["MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN"] = "1" if enabled else "0"
    os.environ["MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS"] = str(
        int(SAFE_TARGET_MEGAPIXELS)
    )
    get_config.cache_clear()


def _clean_settings() -> CleanSettings:
    return CleanSettings(
        model_key=INPAINTER_MODEL_KEY,
        mask_dilation=0,
        hd_strategy=None,
        hd_strategy_resize_limit=960,
        hd_strategy_crop_margin=512,
        hd_strategy_crop_trigger_size=512,
    )


async def _warm_up(language: str, model_key: str, work_dir: Path) -> None:
    _apply_policy_env(enabled=False)
    warm_page = Image.new("RGB", (512, 512), (180, 180, 180))
    warm_seeds = (
        OCRSeed(
            id="warm-ocr",
            bbox=[40, 40, 240, 120],
            source="model",
            detector_model_key=DETECTOR_MODEL_KEY,
        ),
    )
    await run_cached_ocr(
        CachedOcrRequest(
            image=warm_page,
            image_bytes=b"resize-ab-warmup-ocr",
            language=language,
            model_key=model_key,
            has_gpu=True,
            seeds=warm_seeds,
        )
    )
    get_ocr_region_dedup_cache.cache_clear()
    warm_store = StageStore(work_dir / "warmup-clean.sqlite3")
    try:
        await stages.run_clean_stage(
            image=warm_page,
            has_gpu=True,
            settings=_clean_settings(),
            regions_for_mask=[{"bbox": [40, 40, 300, 200]}],
            default_detection_model=DETECTOR_MODEL_KEY,
            store=warm_store,
        )
    finally:
        warm_store.close()


def _non_empty_texts(records: list[OCRRecord]) -> int:
    return sum(1 for record in records if str(record["text"]).strip())


def _mean_score(records: list[OCRRecord]) -> float:
    scored = [
        float(record["score"])
        for record in records
        if str(record["text"]).strip()
    ]
    if not scored:
        return 0.0
    return sum(scored) / len(scored)


def _bbox_drift_px(off_records: list[OCRRecord], on_records: list[OCRRecord]) -> int:
    off_by_id = {record["id"]: record["bbox"] for record in off_records}
    drift = 0
    for record in on_records:
        baseline = off_by_id.get(record["id"])
        if baseline is None:
            continue
        for got, want in zip(record["bbox"], baseline):
            drift = max(drift, abs(int(got) - int(want)))
    return drift


async def measure_ocr_arm(
    page: Image.Image,
    seeds: tuple[OCRSeed, ...],
    *,
    enabled: bool,
    language: str,
    model_key: str,
) -> tuple[dict[str, float | int | str], list[OCRRecord] | None]:
    _apply_policy_env(enabled=enabled)
    request = CachedOcrRequest(
        image=page,
        image_bytes=f"resize-ab-ocr-{'on' if enabled else 'off'}".encode("ascii"),
        language=language,
        model_key=model_key,
        has_gpu=True,
        seeds=seeds,
    )
    try:
        start = time.perf_counter()
        result = await run_cached_ocr(request)
        wall_ms = (time.perf_counter() - start) * 1000.0
    except Exception as exc:  # noqa: BLE001 — arm failure is a measured result
        return {
            "wall_ms": None,
            "error": f"{type(exc).__name__}: {exc}",
            "traceback": traceback.format_exc(),
        }, None
    records = list(result.records)
    stats: dict[str, float | int | str] = {
        "wall_ms": round(wall_ms, 1),
        "regions": len(records),
        "non_empty_texts": _non_empty_texts(records),
        "mean_score": round(_mean_score(records), 4),
    }
    return stats, records


def _png_size(png: bytes) -> list[int]:
    with Image.open(io.BytesIO(png)) as decoded:
        return [decoded.width, decoded.height]


async def measure_clean_arm(
    page: Image.Image,
    regions: list[dict[str, object]],
    *,
    enabled: bool,
    store_path: Path,
) -> tuple[dict[str, float | int | str], list[int] | None]:
    _apply_policy_env(enabled=enabled)
    store = StageStore(store_path)
    try:
        try:
            start = time.perf_counter()
            result = await stages.run_clean_stage(
                image=page,
                has_gpu=True,
                settings=_clean_settings(),
                regions_for_mask=regions,
                default_detection_model=DETECTOR_MODEL_KEY,
                store=store,
            )
            wall_ms = (time.perf_counter() - start) * 1000.0
        except Exception as exc:  # noqa: BLE001 — arm failure is a measured result
            return {
                "wall_ms": None,
                "error": f"{type(exc).__name__}: {exc}",
                "traceback": traceback.format_exc(),
            }, None
    finally:
        store.close()
    stats: dict[str, float | int | str] = {
        "wall_ms": round(wall_ms, 1),
        "model_used": result.model_used,
        "hd_strategy": result.hd_strategy,
    }
    return stats, _png_size(result.png)


@dataclass(frozen=True, slots=True)
class _AbResult:
    artifact: dict[str, object]
    gate_pass: bool
    text_degradation: float | None
    dims_match: bool | None


async def _run_ab(args: argparse.Namespace, model_key: str) -> _AbResult:
    page = build_text_dense_fixture(args.width, args.height)
    seeds = build_ocr_seeds(args.width, args.height)
    regions = build_clean_regions(args.width, args.height)
    ocr_plan = stage_resolution_plan(
        "ocr", args.width, args.height, SAFE_TARGET_MEGAPIXELS
    )
    clean_plan = stage_resolution_plan(
        "clean", args.width, args.height, SAFE_TARGET_MEGAPIXELS
    )
    with tempfile.TemporaryDirectory() as tmp:
        work_dir = Path(tmp)
        await _warm_up(args.language, model_key, work_dir)
        off_ocr_stats, off_records = await measure_ocr_arm(
            page, seeds, enabled=False, language=args.language, model_key=model_key
        )
        get_ocr_region_dedup_cache.cache_clear()
        on_ocr_stats, on_records = await measure_ocr_arm(
            page, seeds, enabled=True, language=args.language, model_key=model_key
        )
        get_ocr_region_dedup_cache.cache_clear()
        off_clean_stats, off_size = await measure_clean_arm(
            page, regions, enabled=False, store_path=work_dir / "clean-off.sqlite3"
        )
        on_clean_stats, on_size = await measure_clean_arm(
            page, regions, enabled=True, store_path=work_dir / "clean-on.sqlite3"
        )

    off_texts = off_ocr_stats.get("non_empty_texts")
    on_texts = on_ocr_stats.get("non_empty_texts")
    if isinstance(off_texts, int) and isinstance(on_texts, int) and off_texts > 0:
        text_degradation: float | None = (off_texts - on_texts) / off_texts
    else:
        text_degradation = None
    dims_match: bool | None
    if off_size is None or on_size is None:
        dims_match = None
    else:
        dims_match = off_size == on_size and off_size == [args.width, args.height]
    gate_pass = (
        text_degradation is not None
        and text_degradation <= TEXT_DEGRADATION_LIMIT
        and dims_match is True
    )
    artifact: dict[str, object] = {
        "capturedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "script": "profile_stage_resize_policy.py",
        "page_size": f"{args.width}x{args.height}",
        "megapixels": round(megapixels_of(args.width, args.height), 2),
        "acceleration_profile": args.acceleration_profile,
        "language": args.language,
        "ocr_model_key": model_key,
        "policy": {
            "safe_target_mp": SAFE_TARGET_MEGAPIXELS,
            "flag_default_off": True,
            "ocr_plan_working_size": (
                f"{ocr_plan.working_width}x{ocr_plan.working_height}"
            ),
            "clean_plan_working_size": (
                f"{clean_plan.working_width}x{clean_plan.working_height}"
            ),
        },
        "timing_ms": {
            "ocr_off": off_ocr_stats["wall_ms"],
            "ocr_on": on_ocr_stats["wall_ms"],
            "clean_off": off_clean_stats["wall_ms"],
            "clean_on": on_clean_stats["wall_ms"],
        },
        "ocr": {
            "off_arm": off_ocr_stats,
            "on_arm": on_ocr_stats,
            "text_degradation": (
                round(text_degradation, 4) if text_degradation is not None else None
            ),
            "bbox_max_drift_px": (
                _bbox_drift_px(off_records, on_records)
                if off_records is not None and on_records is not None
                else None
            ),
        },
        "clean": {
            "off_arm": off_clean_stats,
            "on_arm": on_clean_stats,
            "off_output_size": off_size,
            "on_output_size": on_size,
            "dims_match": dims_match,
        },
        "gate": {
            "name": "F6-OCR-CLEAN-RESIZE",
            "text_degradation_limit": TEXT_DEGRADATION_LIMIT,
            "pass": gate_pass,
            "verdict": (
                "PASS — resize keeps OCR text yield within limit and clean dims exact"
                if gate_pass
                else "FAIL — inspect degradation counters before enabling the flag"
            ),
        },
    }
    return _AbResult(
        artifact=artifact,
        gate_pass=gate_pass,
        text_degradation=text_degradation,
        dims_match=dims_match,
    )


def main() -> int:
    args = parse_args()
    os.environ["KOMA_MODELS_ROOT"] = str(args.models_root.expanduser().resolve())
    os.environ["MINI_BACKEND_ACCELERATION_PROFILE"] = args.acceleration_profile
    model_key = _require_ocr_model(args.language, args.ocr_model_key)
    _require_inpaint_model()
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["KOMA_APP_DATA_DIR"] = tmp
        try:
            result = asyncio.run(_run_ab(args, model_key))
        finally:
            close_stage_store()
    out = args.out.expanduser().resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result.artifact, indent=2) + "\n", encoding="utf-8")
    degradation_text = (
        f"{result.text_degradation:.4f}"
        if result.text_degradation is not None
        else "n/a (arm failed)"
    )
    print(
        f"F6-OCR-CLEAN-RESIZE text_degradation={degradation_text} "
        f"(limit {TEXT_DEGRADATION_LIMIT}) dims_match={result.dims_match} "
        f"-> {'PASS' if result.gate_pass else 'FAIL'}; artifact {out}"
    )
    return 0 if result.gate_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
