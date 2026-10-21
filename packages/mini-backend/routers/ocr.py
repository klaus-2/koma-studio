"""OCR endpoints. The local recognition path exists exactly once
(``models.ocr.stage.run_cached_ocr``); the GPU→CPU retry wraps it instead of
copying it."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Mapping, Sequence
from typing import Annotated

import httpx
from fastapi import APIRouter, File, Form, HTTPException, Response, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import TypeAdapter, ValidationError

from core.cloud_registry import get_ocr_model_spec, list_cloud_ocr_models
from core.config import get_config, normalize_stage_model_key
from core.device import (
    DeviceInfo,
    build_device_payload,
    get_device_info,
    release_gpu_memory,
)
from core.languages import normalize_language_code
from models.detection.factory import get_detector
from models.errors import (
    InvalidModelSelectionError,
    MissingDependencyError,
    ModelConfigurationError,
    ModelNotInstalledError,
)
from models.ocr.factory import list_ocr_models
from models.ocr.stage import CachedOcrRequest, CachedOcrResult, run_cached_ocr
from pipelines.batch.records import (
    OCRRecord,
    OCRSeed,
    normalize_bbox,
    normalize_stage_source,
    optional_float,
)
from pipelines.cache_manager import get_pipeline_cache
from pipelines.ocr_enrichment import enrich_ocr_record_with_gradient
from routers._boundary import execution_error_to_http
from routers.uploads import decode_upload, read_upload_limited
from schemas.ocr import (
    OCRForegroundGradient,
    OCRRegionRequest,
    OCRRegionResult,
    OCRResponse,
)
from services.cloud_ocr import recognize_text_regions as recognize_text_regions_cloud
from services.device_fallback import ExecutionError, run_with_cpu_fallback

router = APIRouter(tags=["ocr"])
logger = logging.getLogger(__name__)

# Kept as a module attribute for existing importers; the instance is process-wide.
CACHE_MANAGER = get_pipeline_cache()

_REGIONS_ADAPTER: TypeAdapter[list[OCRRegionRequest]] = TypeAdapter(list[OCRRegionRequest])
_FALSE_FLAGS = frozenset({"false", "0", "no"})
_FULL_PAGE_DETECTOR_KEY = "mini_full_page"
_MAX_IMAGE_BYTES = 50 * 1024 * 1024
_CLIENT_FIXABLE_MODEL_ERRORS = (
    ModelNotInstalledError,
    InvalidModelSelectionError,
    ModelConfigurationError,
    MissingDependencyError,
)


# ------------------------------------------------------------------ parsing


def _parse_regions(raw: str | None) -> list[OCRRegionRequest]:
    if not raw:
        return []
    try:
        return _REGIONS_ADAPTER.validate_json(raw)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid regions field: {exc}") from exc


def _seed_from_request(region: OCRRegionRequest) -> OCRSeed:
    bbox = normalize_bbox(region.bbox)
    if bbox is None:
        raise HTTPException(status_code=400, detail=f"Invalid bbox for region '{region.id}'")
    return OCRSeed(
        id=region.id,
        bbox=list(bbox),
        source=normalize_stage_source(region.source),
        detector_model_key=region.detector_model_key,
    )


async def _read_image(file: UploadFile) -> tuple[bytes, Image.Image]:
    payload = await read_upload_limited(file, limit_bytes=_MAX_IMAGE_BYTES, label="Image")
    image = await decode_upload(payload, mode="RGB", label="Uploaded image", invalid_status=400)
    return payload, image


def _parse_optional_json_object(raw: str | None, *, field: str) -> dict[str, object] | None:
    if not raw:
        return None
    try:
        payload: object = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field} field (JSON)") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail=f"The {field} field must be a JSON object")
    return {str(key): value for key, value in payload.items()}  # pyright: ignore[reportUnknownVariableType]


def _is_cloud_ocr_model(model_key: str | None) -> bool:
    return get_ocr_model_spec(normalize_stage_model_key("ocr", model_key or "")) is not None


# ----------------------------------------------------------------- records


def _to_region_result(record: OCRRecord) -> OCRRegionResult:
    gradient = record.get("foreground_gradient")
    return OCRRegionResult(
        id=record["id"],
        bbox=list(record["bbox"][:4]),
        text=record["text"],
        score=round(record["score"], 4),
        source=record["source"],
        detector_model_key=record["detector_model_key"],
        ocr_model_key=record["ocr_model_key"],
        foreground_gradient=(
            OCRForegroundGradient.model_validate(gradient) if gradient is not None else None
        ),
    )



# ---------------------------------------------------------------- detection


async def _detect_seeds(image: Image.Image, *, has_gpu: bool, default_model: str) -> list[OCRSeed]:
    detector = get_detector(task="text", has_gpu=has_gpu, model_key=default_model)
    try:
        detections = await detector.detect(image)
    finally:
        release_gpu_memory()
    seeds: list[OCRSeed] = []
    for index, det in enumerate(detections, start=1):
        bbox = normalize_bbox(getattr(det, "bbox", None))
        if bbox is None:
            continue
        seeds.append(
            OCRSeed(
                id=f"det-{index}",
                bbox=list(bbox),
                source=normalize_stage_source(getattr(det, "source", "model")),
                detector_model_key=str(getattr(det, "model_key", "") or default_model),
            )
        )
    return seeds


# -------------------------------------------------------------------- cloud


def _cloud_item_to_record(item: Mapping[str, object], engine_key: str) -> OCRRecord:
    bbox = normalize_bbox(item.get("bbox"))
    if bbox is None:
        raise HTTPException(status_code=502, detail="Cloud OCR returned a region without a bbox")
    score = optional_float(item.get("score"))
    return OCRRecord(
        id=str(item.get("id") or ""),
        bbox=list(bbox),
        text=str(item.get("text") or ""),
        score=0.0 if score is None else score,
        source=normalize_stage_source(item.get("source")),
        detector_model_key=str(item.get("detector_model_key") or ""),
        ocr_model_key=str(item.get("ocr_model_key") or engine_key),
    )


async def _recognize_cloud(
    *,
    image: Image.Image,
    model_key: str,
    language: str,
    seeds: Sequence[OCRSeed],
    llm_settings: str | None,
    custom_llm: dict[str, object] | None,
) -> OCRResponse:
    request_regions: list[dict[str, object]] = [dict(seed) for seed in seeds] or [
        {
            "id": "region-1",
            "bbox": [0, 0, image.width, image.height],
            "source": "model",
            "detector_model_key": _FULL_PAGE_DETECTOR_KEY,
        }
    ]
    try:
        model_used, cloud_results = await recognize_text_regions_cloud(
            image=image,
            model_key=model_key,
            language=language,
            regions=request_regions,
            llm_settings=llm_settings,
            custom_llm=custom_llm,
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502, detail=f"Cloud OCR failed: {exc.response.text}"
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Cloud OCR unreachable: {exc}") from exc
    except RuntimeError as exc:  # ModelError ⊂ RuntimeError; provider misconfiguration
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    raw = [_cloud_item_to_record(item, model_used) for item in cloud_results]
    records = await asyncio.to_thread(
        lambda: [enrich_ocr_record_with_gradient(image, record) for record in raw]
    )
    return OCRResponse(
        device="Mini Backend Cloud",
        language=language,
        model_used=model_used,
        image_width=image.width,
        image_height=image.height,
        regions=[_to_region_result(record) for record in records],
    )


# ---------------------------------------------------------------- endpoints


@router.get("/ocr/models")
async def ocr_models(language: str | None = None) -> dict[str, object]:
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": [
            *list_ocr_models(has_gpu=device.has_gpu, language=language),
            *list_cloud_ocr_models(),
        ],
    }


@router.post("/ocr", response_model=OCRResponse)
async def recognize_text(
    response: Response,
    file: Annotated[UploadFile, File()],
    model_key: Annotated[str | None, Form()] = None,
    language: Annotated[str | None, Form()] = None,
    regions: Annotated[str | None, Form()] = None,
    llm_settings: Annotated[str | None, Form()] = None,
    custom_llm: Annotated[str | None, Form()] = None,
    use_gpu: Annotated[str | None, Form()] = None,
) -> OCRResponse:
    config = get_config()
    device = get_device_info()
    effective_has_gpu = (
        device.has_gpu if use_gpu is None else use_gpu.strip().lower() not in _FALSE_FLAGS
    )
    source_language = normalize_language_code(language, default="en", allow_auto=False)

    image_bytes, image = await _read_image(file)
    seeds = [_seed_from_request(region) for region in _parse_regions(regions)]

    if _is_cloud_ocr_model(model_key):
        return await _recognize_cloud(
            image=image,
            model_key=model_key or "",
            language=source_language,
            seeds=seeds,
            llm_settings=llm_settings,
            custom_llm=_parse_optional_json_object(custom_llm, field="custom_llm"),
        )

    if not seeds:
        try:
            seeds = await _detect_seeds(
                image, has_gpu=effective_has_gpu, default_model=config.default_detection_model
            )
        except Exception as exc:  # noqa: BLE001 — HTTP boundary; detector backends raise heterogeneous errors
            raise HTTPException(
                status_code=500, detail=f"Failed to detect regions for OCR: {exc}"
            ) from exc

    async def _run_with_device(
        op_device: DeviceInfo,
        use_gpu_flag: bool,
    ) -> CachedOcrResult:
        return await run_cached_ocr(
            CachedOcrRequest(
                image=image,
                image_bytes=image_bytes,
                seeds=tuple(seeds),
                language=source_language,
                model_key=model_key,
                has_gpu=use_gpu_flag,
                device_info=op_device,
            )
        )

    try:
        execution = await run_with_cpu_fallback(
            _run_with_device,
            device=device,
            use_gpu=effective_has_gpu,
            stage="ocr",
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ExecutionError as exc:
        raise execution_error_to_http(exc, model_key=model_key) from exc

    outcome = execution.result
    response.headers.update(execution.fallback_headers(model_key=outcome.engine_key))

    return OCRResponse(
        device=execution.device.name,
        language=source_language,
        model_used=outcome.engine_key,
        image_width=image.width,
        image_height=image.height,
        regions=[_to_region_result(record) for record in outcome.records],
    )
