from __future__ import annotations

import json
from io import BytesIO
import logging

from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
import httpx
import numpy as np
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from core.cloud_registry import get_ocr_model_spec, list_cloud_ocr_models
from core.config import get_config, normalize_stage_model_key
from core.device import (
    build_cpu_device_info,
    build_device_payload,
    get_device_info,
    release_gpu_memory,
)
from core.languages import normalize_language_code
from core.runtime_errors import build_runtime_error_detail, is_insufficient_memory_error
from models.detection.factory import get_detector
from models.detection.font.foreground_color import extract_foreground_gradient
from models.ocr.base_ocr import OCRInputRegion
from models.ocr.factory import get_ocr_engine, list_ocr_models
from services.cloud_ocr import recognize_text_regions as recognize_text_regions_cloud
from pipelines.cache_manager import CacheManager
from schemas.ocr import (
    OCRForegroundGradient,
    OCRRegionRequest,
    OCRRegionResult,
    OCRResponse,
)
from utils.ocr_fallback import recognize_with_fallbacks


router = APIRouter(tags=["ocr"])
logger = logging.getLogger(__name__)
_CACHE_CONFIG = get_config()
CACHE_MANAGER = CacheManager(
    ttl_seconds=_CACHE_CONFIG.pipeline_cache_ttl_seconds,
    max_entries=_CACHE_CONFIG.pipeline_cache_max_entries,
    bbox_tolerance_px=_CACHE_CONFIG.pipeline_cache_bbox_tolerance_px,
)


@router.get("/ocr/models")
async def ocr_models(
    language: str | None = None,
):
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": [
            *list_ocr_models(
                has_gpu=device.has_gpu,
                language=language,
            ),
            *list_cloud_ocr_models(),
        ],
    }


def _parse_regions(raw_regions: str | None) -> list[OCRRegionRequest]:
    if not raw_regions:
        return []
    try:
        payload = json.loads(raw_regions)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid regions field (JSON)"
        ) from exc
    if not isinstance(payload, list):
        raise HTTPException(
            status_code=400, detail="The regions field must be a JSON list"
        )

    parsed: list[OCRRegionRequest] = []
    for item in payload:
        try:
            parsed.append(OCRRegionRequest.model_validate(item))
        except ValidationError as exc:
            raise HTTPException(
                status_code=400, detail=f"Invalid region: {exc}"
            ) from exc
    return parsed


def _is_cloud_ocr_model(model_key: str | None) -> bool:
    normalized = normalize_stage_model_key("ocr", model_key or "")
    return get_ocr_model_spec(normalized) is not None


def _serialize_foreground_gradient(
    image: Image.Image,
    bbox: list[int] | tuple[int, int, int, int],
) -> dict[str, object] | None:
    if len(bbox) < 4:
        return None
    x1, y1, x2, y2 = (int(value) for value in bbox[:4])
    left = max(0, min(x1, x2))
    top = max(0, min(y1, y2))
    right = min(image.width, max(x1, x2))
    bottom = min(image.height, max(y1, y2))
    if right - left < 2 or bottom - top < 2:
        return None

    crop = np.asarray(image.crop((left, top, right, bottom)).convert("RGB"))
    gradient = extract_foreground_gradient(crop)
    if gradient is None:
        return None
    return {
        "start_rgb": [int(channel) for channel in gradient.start_rgb],
        "end_rgb": [int(channel) for channel in gradient.end_rgb],
        "angle_degrees": float(gradient.angle_degrees),
    }


def enrich_ocr_record_with_gradient(
    image: Image.Image,
    record: dict[str, object],
) -> dict[str, object]:
    if record.get("foreground_gradient") is not None:
        return record
    bbox = record.get("bbox")
    if not isinstance(bbox, list) or len(bbox) < 4:
        return record
    return {
        **record,
        "foreground_gradient": _serialize_foreground_gradient(image, bbox),
    }


@router.post("/ocr", response_model=OCRResponse)
async def recognize_text(
    response: Response,
    file: UploadFile = File(...),
    model_key: str | None = Form(None),
    language: str | None = Form(None),
    regions: str | None = Form(None),
    llm_settings: str | None = Form(None),
    custom_llm: str | None = Form(None),
    use_gpu: str | None = Form(None),
):
    config = get_config()
    device = get_device_info()
    effective_has_gpu = (
        device.has_gpu
        if use_gpu is None
        else use_gpu.lower() not in ("false", "0", "no")
    )
    source_language = normalize_language_code(language, default="en", allow_auto=False)

    try:
        image_payload = await file.read()
        image = Image.open(BytesIO(image_payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400, detail="Invalid image file"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="Failed to read the uploaded file"
        ) from exc

    parsed_regions = _parse_regions(regions)

    if _is_cloud_ocr_model(model_key):
        request_regions = [
            {
                "id": region.id,
                "bbox": [int(v) for v in region.bbox],
                "source": region.source,
                "detector_model_key": region.detector_model_key,
            }
            for region in parsed_regions
        ]
        if not request_regions:
            request_regions = [
                {
                    "id": "region-1",
                    "bbox": [0, 0, image.width, image.height],
                    "source": "model",
                    "detector_model_key": "mini_full_page",
                }
            ]

        parsed_custom_llm = None
        if custom_llm:
            try:
                parsed_custom_llm = json.loads(custom_llm)
            except json.JSONDecodeError as exc:
                raise HTTPException(
                    status_code=400, detail="Invalid custom_llm field (JSON)"
                ) from exc

        try:
            model_used, cloud_results = await recognize_text_regions_cloud(
                image=image,
                model_key=model_key or "",
                language=source_language,
                regions=request_regions,
                llm_settings=llm_settings,
                custom_llm=parsed_custom_llm,
            )
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502, detail=f"Cloud OCR failed: {exc.response.text}"
            ) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"Cloud OCR failed: {exc}"
            ) from exc

        return OCRResponse(
            device="Mini Backend Cloud",
            language=source_language,
            model_used=model_used,
            image_width=image.width,
            image_height=image.height,
            regions=[
                OCRRegionResult.model_validate(
                    enrich_ocr_record_with_gradient(image, item)
                )
                for item in cloud_results
            ],
        )
    input_regions: list[OCRInputRegion] = [
        OCRInputRegion(
            id=region.id,
            bbox=tuple(int(v) for v in region.bbox),
            source=region.source,
            detector_model_key=region.detector_model_key,
        )
        for region in parsed_regions
    ]

    if not input_regions:
        try:
            detector = get_detector(
                task="text",
                has_gpu=effective_has_gpu,
                model_key=config.default_detection_model,
            )
            detections = await detector.detect(image)
            input_regions = [
                OCRInputRegion(
                    id=f"det-{idx}",
                    bbox=tuple(int(v) for v in det.bbox),
                    source=det.source if det.source in {"model", "manual"} else "model",
                    detector_model_key=det.model_key or config.default_detection_model,
                )
                for idx, det in enumerate(detections, start=1)
            ]
        except Exception as exc:
            raise HTTPException(
                status_code=500, detail=f"Failed to detect regions for OCR: {exc}"
            ) from exc

    input_region_payload = [
        {
            "id": region.id,
            "bbox": [int(v) for v in region.bbox],
            "source": region.source,
            "detector_model_key": region.detector_model_key,
        }
        for region in input_regions
    ]

    execution_device = device
    try:
        engine = get_ocr_engine(
            language=source_language,
            has_gpu=effective_has_gpu,
            model_key=model_key,
            device_info=device,
        )
        cache_key = CACHE_MANAGER.build_ocr_cache_key(
            image_bytes=image_payload,
            language=source_language,
            model_key=engine.key,
        )
        cached_by_id, missing_regions_payload = (
            CACHE_MANAGER.get_cached_ocr_for_regions(
                cache_key,
                input_region_payload,
            )
        )

        fresh_by_id: dict[str, dict[str, object]] = {}
        if missing_regions_payload:
            missing_regions = [
                OCRInputRegion(
                    id=str(region["id"]),
                    bbox=tuple(int(v) for v in region["bbox"]),  # type: ignore[arg-type]
                    source=str(region.get("source") or "model"),
                    detector_model_key=str(region.get("detector_model_key") or ""),
                )
                for region in missing_regions_payload
            ]
            ocr_results = await recognize_with_fallbacks(
                engine=engine,
                image=image,
                regions=missing_regions,
                language=source_language,
            )
            fresh_records = [
                enrich_ocr_record_with_gradient(
                    image,
                    {
                        "id": result.id,
                        "bbox": [int(v) for v in result.bbox],
                        "text": result.text,
                        "score": float(result.score),
                        "source": result.source,
                        "detector_model_key": result.detector_model_key,
                        "ocr_model_key": result.model_key or engine.key,
                    },
                )
                for result in ocr_results
            ]
            fresh_by_id = {str(item["id"]): item for item in fresh_records}
            cached_count = CACHE_MANAGER.cache_ocr_results(cache_key, fresh_records)
            logger.info("OCR completed and cached for %d blocks", cached_count)
        else:
            logger.info(
                "Using cached OCR results for all %d blocks", len(input_region_payload)
            )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        release_gpu_memory()
        if effective_has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(
                device, fallback_reason="gpu_runtime_out_of_memory"
            )
            try:
                engine = get_ocr_engine(
                    language=source_language,
                    has_gpu=False,
                    model_key=model_key,
                    device_info=cpu_device,
                )
                cache_key = CACHE_MANAGER.build_ocr_cache_key(
                    image_bytes=image_payload,
                    language=source_language,
                    model_key=engine.key,
                )
                cached_by_id, missing_regions_payload = (
                    CACHE_MANAGER.get_cached_ocr_for_regions(
                        cache_key,
                        input_region_payload,
                    )
                )
                fresh_by_id = {}
                if missing_regions_payload:
                    missing_regions = [
                        OCRInputRegion(
                            id=str(region["id"]),
                            bbox=tuple(int(v) for v in region["bbox"]),  # type: ignore[arg-type]
                            source=str(region.get("source") or "model"),
                            detector_model_key=str(
                                region.get("detector_model_key") or ""
                            ),
                        )
                        for region in missing_regions_payload
                    ]
                    ocr_results = await recognize_with_fallbacks(
                        engine=engine,
                        image=image,
                        regions=missing_regions,
                        language=source_language,
                    )
                    fresh_records = [
                        enrich_ocr_record_with_gradient(
                            image,
                            {
                                "id": result.id,
                                "bbox": [int(v) for v in result.bbox],
                                "text": result.text,
                                "score": float(result.score),
                                "source": result.source,
                                "detector_model_key": result.detector_model_key,
                                "ocr_model_key": result.model_key or engine.key,
                            },
                        )
                        for result in ocr_results
                    ]
                    fresh_by_id = {str(item["id"]): item for item in fresh_records}
                    cached_count = CACHE_MANAGER.cache_ocr_results(
                        cache_key, fresh_records
                    )
                    logger.info(
                        "OCR CPU fallback completed and cached for %d blocks",
                        cached_count,
                    )
                else:
                    logger.info(
                        "Using cached OCR results for all %d blocks after CPU fallback",
                        len(input_region_payload),
                    )
                execution_device = cpu_device
                response.headers["X-Koma-Execution-Fallback"] = "gpu_oom_to_cpu"
                response.headers["X-Koma-Execution-Stage"] = "ocr"
                response.headers["X-Koma-Execution-Model"] = engine.key
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="ocr",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
        else:
            raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        release_gpu_memory()
        if effective_has_gpu and is_insufficient_memory_error(exc):
            cpu_device = build_cpu_device_info(
                device, fallback_reason="gpu_runtime_out_of_memory"
            )
            try:
                engine = get_ocr_engine(
                    language=source_language,
                    has_gpu=False,
                    model_key=model_key,
                    device_info=cpu_device,
                )
                cache_key = CACHE_MANAGER.build_ocr_cache_key(
                    image_bytes=image_payload,
                    language=source_language,
                    model_key=engine.key,
                )
                cached_by_id, missing_regions_payload = (
                    CACHE_MANAGER.get_cached_ocr_for_regions(
                        cache_key,
                        input_region_payload,
                    )
                )
                fresh_by_id = {}
                if missing_regions_payload:
                    missing_regions = [
                        OCRInputRegion(
                            id=str(region["id"]),
                            bbox=tuple(int(v) for v in region["bbox"]),  # type: ignore[arg-type]
                            source=str(region.get("source") or "model"),
                            detector_model_key=str(
                                region.get("detector_model_key") or ""
                            ),
                        )
                        for region in missing_regions_payload
                    ]
                    ocr_results = await recognize_with_fallbacks(
                        engine=engine,
                        image=image,
                        regions=missing_regions,
                        language=source_language,
                    )
                    fresh_records = [
                        enrich_ocr_record_with_gradient(
                            image,
                            {
                                "id": result.id,
                                "bbox": [int(v) for v in result.bbox],
                                "text": result.text,
                                "score": float(result.score),
                                "source": result.source,
                                "detector_model_key": result.detector_model_key,
                                "ocr_model_key": result.model_key or engine.key,
                            },
                        )
                        for result in ocr_results
                    ]
                    fresh_by_id = {str(item["id"]): item for item in fresh_records}
                    CACHE_MANAGER.cache_ocr_results(cache_key, fresh_records)
                execution_device = cpu_device
                response.headers["X-Koma-Execution-Fallback"] = "gpu_oom_to_cpu"
                response.headers["X-Koma-Execution-Stage"] = "ocr"
                response.headers["X-Koma-Execution-Model"] = engine.key
            except Exception as cpu_exc:
                raise HTTPException(
                    status_code=500,
                    detail=build_runtime_error_detail(
                        error=exc,
                        stage="ocr",
                        model_key=model_key,
                        used_gpu=True,
                        cpu_fallback_attempted=True,
                        cpu_fallback_error=cpu_exc,
                    ),
                ) from cpu_exc
            # CPU fallback succeeded; continue building the normal response below.
        else:
            raise HTTPException(status_code=500, detail=f"OCR failed: {exc}") from exc
    else:
        release_gpu_memory()

    response_regions: list[OCRRegionResult] = []
    for region in input_region_payload:
        region_id = str(region["id"])
        merged = fresh_by_id.get(region_id) or cached_by_id.get(region_id)
        if merged is None:
            merged = {
                "id": region_id,
                "bbox": [int(v) for v in region["bbox"]],  # type: ignore[arg-type]
                "text": "",
                "score": 0.0,
                "source": str(region.get("source") or "model"),
                "detector_model_key": str(region.get("detector_model_key") or ""),
                "ocr_model_key": engine.key,
            }
        merged = enrich_ocr_record_with_gradient(image, merged)

        response_regions.append(
            OCRRegionResult(
                id=str(merged.get("id") or region_id),
                bbox=[int(v) for v in (merged.get("bbox") or region["bbox"])][:4],  # type: ignore[index]
                text=str(merged.get("text") or ""),
                score=round(float(merged.get("score") or 0.0), 4),
                source=(
                    str(merged.get("source") or "model")
                    if str(merged.get("source") or "model") in {"model", "manual"}
                    else "model"
                ),
                detector_model_key=str(merged.get("detector_model_key") or ""),
                ocr_model_key=str(merged.get("ocr_model_key") or engine.key),
                foreground_gradient=(
                    OCRForegroundGradient.model_validate(merged["foreground_gradient"])
                    if merged.get("foreground_gradient") is not None
                    else None
                ),
            )
        )

    return OCRResponse(
        device=execution_device.name,
        language=source_language,
        model_used=engine.key,
        image_width=image.width,
        image_height=image.height,
        regions=response_regions,
    )
