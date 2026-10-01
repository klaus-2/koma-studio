"""Typography endpoints: bubble shape detection and refinement."""

from __future__ import annotations

import asyncio
from typing import Annotated, Final

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status
from pydantic import TypeAdapter

from routers._boundary import parse_json_form_field, read_rgb_upload
from schemas.typography import TypographyShapeDetectionResponse
from services.typography_shapes import Bbox, ShapeKind, clamp_bbox, detect_shapes, refine_shape

router = APIRouter(tags=["typography"])
_BBOX_ADAPTER: Final = TypeAdapter(Bbox)
_SHAPE_KINDS: Final = ("square", "rounded")


@router.post("/typography/shapes/detect", response_model=TypographyShapeDetectionResponse)
async def detect_typography_shapes(
    file: Annotated[UploadFile, File()],
) -> TypographyShapeDetectionResponse:
    _, rgb = await read_rgb_upload(file)
    shapes = await asyncio.to_thread(detect_shapes, rgb)
    height, width = rgb.shape[:2]
    return TypographyShapeDetectionResponse(image_width=width, image_height=height, shapes=shapes)


@router.post("/typography/shapes/refine", response_model=TypographyShapeDetectionResponse)
async def refine_typography_shape(
    file: Annotated[UploadFile, File()],
    bbox: Annotated[str, Form()],
    current_shape_kind: Annotated[str | None, Form()] = None,
) -> TypographyShapeDetectionResponse:
    _, rgb = await read_rgb_upload(file)
    height, width = rgb.shape[:2]
    requested = parse_json_form_field(bbox, _BBOX_ADAPTER, field_name="bbox")
    clamped = None if requested is None else clamp_bbox(requested, width=width, height=height)
    if clamped is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="bbox is empty or outside the image"
        )

    preferred: ShapeKind | None = (
        current_shape_kind if current_shape_kind in _SHAPE_KINDS else None
    )
    detection = await asyncio.to_thread(refine_shape, rgb, clamped, preferred)
    if detection is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not refine the provided shape"
        )
    return TypographyShapeDetectionResponse(
        image_width=width, image_height=height, shapes=[detection]
    )
