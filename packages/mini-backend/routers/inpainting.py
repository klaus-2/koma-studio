from __future__ import annotations

import asyncio
import logging
from collections.abc import Sequence
from typing import Annotated

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from PIL import Image
from pydantic import ValidationError

from core.config import get_config
from core.device import DeviceInfo, build_device_payload, get_device_info
from core.runtime_errors import build_runtime_error_detail
from models.detection.factory import get_detector
from models.inpainting.factory import list_inpainting_models
from models.segmentation.base_segmenter import SegmentInputRegion
from models.segmentation.factory import get_segmenter
from schemas.inpainting import (
    REGION_LIST_ADAPTER,
    INPAINT_CROP_FIELD,
    INPAINT_CROP_TRIGGER_FIELD,
    INPAINT_DILATION_FIELD,
    INPAINT_MASK_DILATION_FIELD,
    INPAINT_RESIZE_LIMIT_FIELD,
    InpaintMaskForm,
    InpaintOptions,
    InpaintRegionRequest,
    InpaintRegionsForm,
)
from services.inpainting_execution import (
    InpaintError,
    InpaintFallbackFailedError,
    InpaintInvalidRequestError,
    STAGE,
    inpaint_masked_image,
    resolve_has_gpu,
)
from utils.image_codec import (
    ImageDecodeError,
    MaskImage,
    RGBImage,
    decode_binary_mask_async,
    decode_rgb_async,
    dilate_mask,
    encode_png_async,
)
from utils.mask import MaskRegion, generate_baka_style_mask
from utils.uploads import UploadTooLargeError, read_upload

logger = logging.getLogger(__name__)
router = APIRouter(tags=["inpainting"])

PNG_MEDIA_TYPE = "image/png"
AUTO_SEGMENTER_KEY = "baka_content_cc"


# --------------------------------------------------------------------------- #
# Boundary helpers
# --------------------------------------------------------------------------- #
def _parse_regions(raw_regions: str | None) -> list[InpaintRegionRequest] | None:
    if raw_regions is None:
        return None
    try:
        return REGION_LIST_ADAPTER.validate_json(raw_regions)
    except ValidationError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail=f"Invalid regions field: {exc.errors()}"
        ) from exc


async def _read_image(upload: UploadFile) -> tuple[bytes, RGBImage]:
    try:
        payload = await read_upload(upload)
        return payload, await decode_rgb_async(payload)
    except UploadTooLargeError as exc:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
    except ImageDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


async def _read_mask(upload: UploadFile, *, target_shape: tuple[int, int]) -> MaskImage:
    try:
        payload = await read_upload(upload)
        return await decode_binary_mask_async(payload, target_shape=target_shape)
    except UploadTooLargeError as exc:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc
    except ImageDecodeError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


def _to_http_error(exc: InpaintError, *, model_key: str | None) -> HTTPException:
    if isinstance(exc, InpaintFallbackFailedError):
        return HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=build_runtime_error_detail(
                error=exc.gpu_error.original,
                stage=STAGE,
                model_key=model_key,
                used_gpu=True,
                cpu_fallback_attempted=True,
                cpu_fallback_error=exc.cpu_error,
            ),
        )
    if isinstance(exc, InpaintInvalidRequestError):
        return HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


async def _png_response(rgb: RGBImage, headers: dict[str, str] | None = None) -> Response:
    return Response(
        content=await encode_png_async(rgb), media_type=PNG_MEDIA_TYPE, headers=headers
    )


async def _inpaint_and_respond(
    *, rgb_image: RGBImage, mask: MaskImage, options: InpaintOptions, device: DeviceInfo
) -> Response:
    if not mask.any():
        return await _png_response(rgb_image)
    try:
        outcome = await inpaint_masked_image(
            rgb_image=rgb_image, mask=mask, options=options, device=device
        )
    except InpaintError as exc:
        raise _to_http_error(exc, model_key=options.model_key) from exc
    return await _png_response(
        outcome.image_rgb, headers=outcome.headers(mask_dilation=options.mask_dilation)
    )


# --------------------------------------------------------------------------- #
# Auto-detection (only when the client sent neither regions nor a brush mask)
# --------------------------------------------------------------------------- #
async def _auto_detect_regions(
    *, image_bytes: bytes, rgb_image: RGBImage, has_gpu: bool
) -> list[InpaintRegionRequest]:
    default_detector_key = get_config().default_detection_model
    detector = get_detector(task="text", has_gpu=has_gpu, model_key=default_detector_key)
    detections = await detector.detect(Image.fromarray(rgb_image))
    if not detections:
        return []

    base_regions = [
        InpaintRegionRequest(
            id=f"det-{index}",
            bbox=(int(det.bbox[0]), int(det.bbox[1]), int(det.bbox[2]), int(det.bbox[3])),
            source="model",
            detector_model_key=det.model_key or default_detector_key,
        )
        for index, det in enumerate(detections, start=1)
    ]

    segment_inputs = [
        SegmentInputRegion(
            id=item.id,
            bbox=item.bbox,
            source=item.source,
            detector_model_key=item.detector_model_key,
            ocr_model_key=item.ocr_model_key,
            translator_model_key=item.translator_model_key,
        )
        for item in base_regions
    ]
    try:
        segmenter = get_segmenter(has_gpu=has_gpu, model_key=AUTO_SEGMENTER_KEY)
        segmented = await segmenter.segment(image_bytes=image_bytes, regions=segment_inputs)
    except Exception:  # noqa: BLE001 — model boundary; segmentation is best-effort enrichment
        # bounding boxes alone still produce a valid mask.
        logger.warning(
            "inpaint.auto_segment_failed",
            extra={"segmenter": AUTO_SEGMENTER_KEY, "regions": len(base_regions)},
            exc_info=True,
        )
        return base_regions

    by_id = {region.id: region for region in segmented}
    return [
        item.model_copy(
            update={
                "segment_model_key": match.segment_model_key,
                "segment_boxes": [tuple(box) for box in match.segment_boxes],
                "merged_boxes": [tuple(box) for box in match.merged_boxes],
                "mask_base64": match.mask_base64,
            }
        )
        if (match := by_id.get(item.id)) is not None
        else item
        for item in base_regions
    ]


def _to_mask_regions(regions: Sequence[InpaintRegionRequest]) -> list[MaskRegion]:
    return [
        MaskRegion(
            bbox=region.bbox,
            segment_boxes=list(region.segment_boxes),
            merged_boxes=list(region.merged_boxes),
            mask_base64=region.mask_base64,
        )
        for region in regions
    ]


# --------------------------------------------------------------------------- #
# Form extractors (spread multipart fields → typed options; constraints on the
# Form() declarations turn out-of-range input into 422 instead of a silent clamp)
# --------------------------------------------------------------------------- #
def parse_inpaint_regions_form(
    model_key: str | None = Form(None),
    mask_dilation: INPAINT_DILATION_FIELD = None,
    hd_strategy: str | None = Form(None),
    hd_strategy_resize_limit: INPAINT_RESIZE_LIMIT_FIELD = None,
    hd_strategy_crop_margin: INPAINT_CROP_FIELD = None,
    hd_strategy_crop_trigger_size: INPAINT_CROP_TRIGGER_FIELD = None,
    use_gpu: bool | None = Form(None),
    regions: str | None = Form(None),
) -> InpaintRegionsForm:
    kwargs: dict[str, object] = {"regions": regions}
    if model_key is not None:
        kwargs["model_key"] = model_key
    if mask_dilation is not None:
        kwargs["mask_dilation"] = mask_dilation
    if hd_strategy is not None:
        kwargs["hd_strategy"] = hd_strategy
    if hd_strategy_resize_limit is not None:
        kwargs["hd_strategy_resize_limit"] = hd_strategy_resize_limit
    if hd_strategy_crop_margin is not None:
        kwargs["hd_strategy_crop_margin"] = hd_strategy_crop_margin
    if hd_strategy_crop_trigger_size is not None:
        kwargs["hd_strategy_crop_trigger_size"] = hd_strategy_crop_trigger_size
    if use_gpu is not None:
        kwargs["use_gpu"] = use_gpu
    return InpaintRegionsForm(**kwargs)  # type: ignore[arg-type]


def parse_inpaint_mask_form(
    model_key: str | None = Form(None),
    mask_dilation: INPAINT_MASK_DILATION_FIELD = None,
    hd_strategy: str | None = Form(None),
    hd_strategy_resize_limit: INPAINT_RESIZE_LIMIT_FIELD = None,
    hd_strategy_crop_margin: INPAINT_CROP_FIELD = None,
    hd_strategy_crop_trigger_size: INPAINT_CROP_TRIGGER_FIELD = None,
    use_gpu: bool | None = Form(None),
) -> InpaintMaskForm:
    kwargs: dict[str, object] = {}
    if model_key is not None:
        kwargs["model_key"] = model_key
    if mask_dilation is not None:
        kwargs["mask_dilation"] = mask_dilation
    if hd_strategy is not None:
        kwargs["hd_strategy"] = hd_strategy
    if hd_strategy_resize_limit is not None:
        kwargs["hd_strategy_resize_limit"] = hd_strategy_resize_limit
    if hd_strategy_crop_margin is not None:
        kwargs["hd_strategy_crop_margin"] = hd_strategy_crop_margin
    if hd_strategy_crop_trigger_size is not None:
        kwargs["hd_strategy_crop_trigger_size"] = hd_strategy_crop_trigger_size
    if use_gpu is not None:
        kwargs["use_gpu"] = use_gpu
    return InpaintMaskForm(**kwargs)  # type: ignore[arg-type]


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #
@router.get("/inpaint/models")
async def inpaint_models() -> dict[str, object]:
    device = get_device_info()
    return {
        "device": build_device_payload(device),
        "models": list_inpainting_models(has_gpu=device.has_gpu),
    }


@router.post(
    "/inpaint",
    response_class=Response,
    responses={200: {"content": {PNG_MEDIA_TYPE: {}}}},
)
async def inpaint(
    file: Annotated[UploadFile, File()],
    options: Annotated[InpaintRegionsForm, Depends(parse_inpaint_regions_form)],
    brush_mask: Annotated[UploadFile | None, File()] = None,
) -> Response:
    device = get_device_info()
    image_bytes, rgb_image = await _read_image(file)
    target_shape = (rgb_image.shape[0], rgb_image.shape[1])

    regions = _parse_regions(options.regions)
    has_brush = brush_mask is not None and bool(brush_mask.filename)
    if regions is None and not has_brush:
        regions = await _auto_detect_regions(
            image_bytes=image_bytes,
            rgb_image=rgb_image,
            has_gpu=resolve_has_gpu(device, options.use_gpu),
        )
    region_list = regions or []
    if not region_list and not has_brush:
        return await _png_response(rgb_image)

    mask = await asyncio.to_thread(
        generate_baka_style_mask,
        image_width=target_shape[1],
        image_height=target_shape[0],
        regions=_to_mask_regions(region_list),
        mask_dilation=options.mask_dilation,
    )
    if has_brush and brush_mask is not None:
        brush = await _read_mask(brush_mask, target_shape=target_shape)
        mask = cv2.bitwise_or(mask, brush)

    return await _inpaint_and_respond(
        rgb_image=rgb_image, mask=mask, options=options, device=device
    )


@router.post(
    "/inpaint-mask",
    response_class=Response,
    responses={200: {"content": {PNG_MEDIA_TYPE: {}}}},
)
async def inpaint_with_mask(
    file: Annotated[UploadFile, File()],
    mask: Annotated[UploadFile, File()],
    options: Annotated[InpaintMaskForm, Depends(parse_inpaint_mask_form)],
) -> Response:
    device = get_device_info()
    _, rgb_image = await _read_image(file)
    binary_mask = await _read_mask(
        mask, target_shape=(rgb_image.shape[0], rgb_image.shape[1])
    )
    dilated = await asyncio.to_thread(
        dilate_mask, binary_mask, radius=options.mask_dilation
    )
    return await _inpaint_and_respond(
        rgb_image=rgb_image, mask=dilated, options=options, device=device
    )
