"""HTTP boundary for the batch pipeline: validation, config assembly, response."""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
import json
import logging
from typing import Annotated, cast

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse, Response, StreamingResponse
from starlette.background import BackgroundTask

from core.config import clamp_llm_request_settings, get_config
from core.device import build_device_payload, get_device_info, release_onnx_gpu_memory
from core.languages import (
    get_source_language_options,
    get_target_language_options,
    normalize_language_code,
)
from models.detection.factory import list_detection_models
from models.inpainting.factory import list_inpainting_models
from models.ocr.factory import list_ocr_models
from models.segmentation.factory import list_segmentation_models
from models.translation.factory import list_translation_models
from pipelines.batch.archive import build_batch_archive, iter_file_chunks
from pipelines.batch.font_style import clear_font_style_detector
from pipelines.batch.orchestrator import (
    BatchImageTask,
    BatchOrchestrator,
    BatchRunConfig,
    GpuFlags,
)
from pipelines.batch.stages import CleanSettings
from schemas.pipeline_batch import BatchStageConfig

__all__ = ["clear_font_style_detector", "router"]

router = APIRouter(tags=["pipeline"])
logger = logging.getLogger(__name__)

_DISCONNECT_CHECK_INTERVAL_SECONDS = 2.0
# Manga/comic scans top out well below this; anything larger is abuse or a mistake.
_MAX_IMAGE_BYTES = 32 * 1024 * 1024
_UPLOAD_CHUNK_BYTES = 1024 * 1024


def __getattr__(name: str):  # noqa: ANN202 — module-level PEP 562
    # scripts/memory_profile.py reaches into the old module global; forward it
    # to the batch package so observability keeps working.
    if name == "_FONT_STYLE_DETECTOR":
        from pipelines.batch import font_style

        return font_style._detector
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def _clamp_int(value: int | None, *, fallback: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, fallback if value is None else value))


def _parse_optional_custom_llm(raw: str | None) -> dict[str, object] | None:
    if not raw:
        return None
    try:
        payload: object = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid translation_custom_llm field (JSON)"
        ) from exc
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=400,
            detail="The translation_custom_llm field must be a JSON object",
        )
    # JSON object keys are always strings.
    return cast(dict[str, object], payload)


async def _read_upload_bounded(upload: UploadFile, position: int) -> bytes:
    buffer = bytearray()
    while chunk := await upload.read(_UPLOAD_CHUNK_BYTES):
        buffer.extend(chunk)
        if len(buffer) > _MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File #{position + 1} exceeds {_MAX_IMAGE_BYTES // (1024 * 1024)} MiB.",
            )
    return bytes(buffer)


async def _monitor_client_disconnect(
    request: Request, cancellation_event: asyncio.Event
) -> None:
    try:
        while not cancellation_event.is_set():
            if await request.is_disconnected():
                logger.info("client disconnected, signalling cancellation")
                cancellation_event.set()
                return
            await asyncio.sleep(_DISCONNECT_CHECK_INTERVAL_SECONDS)
    except (RuntimeError, OSError):
        # Transport probe failed; the batch keeps running and completes normally.
        logger.warning("client disconnect monitor stopped", exc_info=True)


@router.get("/pipeline/options")
async def get_pipeline_options(source_language: str | None = None) -> dict[str, object]:
    device = get_device_info()
    has_gpu = device.has_gpu
    return {
        "device": build_device_payload(device),
        "stages": {
            "detectText": list_detection_models(has_gpu=has_gpu),
            "recognizeText": list_ocr_models(has_gpu=has_gpu, language=source_language),
            "getTranslations": list_translation_models(),
            "segmentText": list_segmentation_models(has_gpu=has_gpu),
            "cleanImage": list_inpainting_models(has_gpu=has_gpu),
        },
        "languages": {
            "source": get_source_language_options(),
            "target": get_target_language_options(),
        },
    }


@router.post("/pipeline/batch")
async def pipeline_batch(  # noqa: PLR0913 — multipart form contract of the endpoint
    request: Request,
    files: Annotated[Sequence[UploadFile], File(...)],
    source_language: Annotated[str, Form()] = "ja",
    target_language: Annotated[str, Form()] = "en",
    detect_model_key: Annotated[str | None, Form()] = None,
    ocr_model_key: Annotated[str | None, Form()] = None,
    translation_model_key: Annotated[str | None, Form()] = None,
    segment_model_key: Annotated[str | None, Form()] = None,
    clean_model_key: Annotated[str | None, Form()] = None,
    extra_context: Annotated[str | None, Form()] = None,
    llm_settings: Annotated[str | None, Form()] = None,
    translation_custom_llm: Annotated[str | None, Form()] = None,
    run_detect: Annotated[bool, Form()] = False,
    run_ocr: Annotated[bool, Form()] = True,
    run_translation: Annotated[bool, Form()] = True,
    run_segment: Annotated[bool, Form()] = False,
    run_clean: Annotated[bool, Form()] = True,
    concurrency: Annotated[int | None, Form()] = None,
    mask_dilation: Annotated[int | None, Form()] = None,
    hd_strategy: Annotated[str | None, Form()] = None,
    hd_strategy_resize_limit: Annotated[int | None, Form()] = None,
    hd_strategy_crop_margin: Annotated[int | None, Form()] = None,
    hd_strategy_crop_trigger_size: Annotated[int | None, Form()] = None,
    use_gpu_detect: Annotated[bool | None, Form()] = None,
    use_gpu_ocr: Annotated[bool | None, Form()] = None,
    use_gpu_segment: Annotated[bool | None, Form()] = None,
    use_gpu_clean: Annotated[bool | None, Form()] = None,
) -> Response:
    if not files:
        raise HTTPException(status_code=400, detail="No image was uploaded.")
    cfg = get_config()
    if len(files) > cfg.batch_max_images:
        raise HTTPException(
            status_code=400,
            detail=f"Batch exceeds the limit of {cfg.batch_max_images} images.",
        )
    stage_config = BatchStageConfig(
        detect=run_detect,
        ocr=run_ocr,
        translation=run_translation,
        segment=run_segment,
        clean=run_clean,
    )
    if not any((run_detect, run_ocr, run_translation, run_segment, run_clean)):
        raise HTTPException(
            status_code=400,
            detail="Select at least one stage: detect, OCR, translation, segment or clean.",
        )

    settings = clamp_llm_request_settings(llm_settings)
    device = get_device_info()
    run_config = BatchRunConfig(
        stages=stage_config,
        source_language=normalize_language_code(source_language, default="ja", allow_auto=False),
        target_language=normalize_language_code(target_language, default="en", allow_auto=False),
        llm_settings=settings,
        extra_context=settings.extra_context or (extra_context or ""),
        custom_llm=_parse_optional_custom_llm(translation_custom_llm),
        default_detection_model=cfg.default_detection_model,
        concurrency=_clamp_int(
            concurrency,
            fallback=cfg.batch_default_concurrency,
            minimum=1,
            maximum=cfg.batch_max_concurrency,
        ),
        detect_model_key=detect_model_key,
        ocr_model_key=ocr_model_key,
        translation_model_key=translation_model_key,
        segment_model_key=segment_model_key,
        clean=CleanSettings(
            model_key=clean_model_key,
            mask_dilation=_clamp_int(mask_dilation, fallback=5, minimum=0, maximum=64),
            hd_strategy=hd_strategy,
            hd_strategy_resize_limit=_clamp_int(
                hd_strategy_resize_limit, fallback=960, minimum=256, maximum=4096
            ),
            hd_strategy_crop_margin=_clamp_int(
                hd_strategy_crop_margin, fallback=512, minimum=0, maximum=4096
            ),
            hd_strategy_crop_trigger_size=_clamp_int(
                hd_strategy_crop_trigger_size, fallback=512, minimum=64, maximum=4096
            ),
        ),
        gpu=GpuFlags(
            detect=device.has_gpu if use_gpu_detect is None else use_gpu_detect,
            ocr=device.has_gpu if use_gpu_ocr is None else use_gpu_ocr,
            segment=device.has_gpu if use_gpu_segment is None else use_gpu_segment,
            clean=device.has_gpu if use_gpu_clean is None else use_gpu_clean,
        ),
    )

    tasks = [
        BatchImageTask(
            index=index,
            filename=upload.filename or f"image-{index + 1}.png",
            image_bytes=await _read_upload_bounded(upload, index),
        )
        for index, upload in enumerate(files)
    ]

    cancellation_event = asyncio.Event()
    monitor = asyncio.create_task(_monitor_client_disconnect(request, cancellation_event))
    try:
        outcome = await BatchOrchestrator(run_config, cancellation_event).run(tasks)
    finally:
        cancellation_event.set()
        monitor.cancel()
        await asyncio.gather(monitor, return_exceptions=True)
        release_onnx_gpu_memory()

    report_payload = outcome.report.model_dump(mode="json")
    if not run_clean:
        return JSONResponse(report_payload)

    archive = await asyncio.to_thread(build_batch_archive, outcome.cleaned, report_payload)
    return StreamingResponse(
        iter_file_chunks(archive),
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=pipeline-batch.zip"},
        background=BackgroundTask(archive.close),
    )
