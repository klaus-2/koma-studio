from __future__ import annotations

import json
from io import BytesIO
from uuid import uuid4

import cv2
import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from schemas.splitter import (
    SplitterAnalysisResponse,
    SplitterCutLineModel,
    SplitterDiagnosticsModel,
    SplitterRecipeModel,
    SplitterSegmentModel,
)


router = APIRouter(tags=["splitter"])


def _load_image(payload: bytes) -> Image.Image:
    try:
        return Image.open(BytesIO(payload)).convert("RGB")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Invalid image file") from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Failed to read the uploaded file") from exc


def _parse_recipe(raw_recipe: str | None) -> SplitterRecipeModel:
    if not raw_recipe:
        return SplitterRecipeModel()
    try:
        return SplitterRecipeModel.model_validate(json.loads(raw_recipe))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid recipe field (JSON)") from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid recipe: {exc}") from exc


def _build_projection(gray: np.ndarray, axis: str) -> np.ndarray:
    work = gray if axis == "vertical" else gray.T
    blur_kernel = (1, 9) if axis == "vertical" else (9, 1)
    blurred = cv2.GaussianBlur(work, blur_kernel, 0)
    return blurred.mean(axis=1)


def _build_fixed_positions(total_size: int, recipe: SplitterRecipeModel) -> list[int]:
    if recipe.strategy == "count":
        step = total_size / max(1, recipe.parts)
        return [int(round(step * index)) for index in range(1, max(1, recipe.parts))]
    step = max(100, recipe.fixedHeight)
    return list(range(step, total_size, step))


def _build_smart_positions(gray: np.ndarray, recipe: SplitterRecipeModel) -> tuple[list[int], float, int]:
    projection = _build_projection(gray, recipe.axis)
    total_size = int(projection.shape[0])
    sensitivity_threshold = 170 + round((recipe.whitespaceSensitivity / 100) * 70)
    min_size = max(80, recipe.minSegmentSize)
    max_size = max(min_size + 1, recipe.maxSegmentSize)
    edge_guard = max(8, recipe.edgeGuard)
    positions: list[int] = []
    last_cut = 0
    whitespace_candidates = int(np.sum(projection >= 220))

    for position in range(min_size, max(0, total_size - edge_guard)):
        if position - last_cut < min_size:
            continue
        brightness = float(projection[position])
        if brightness < sensitivity_threshold:
            continue
        if total_size - position < min_size // 2:
            continue
        segment_size = position - last_cut
        oversize = segment_size > max_size
        if recipe.protectTallBlocks and segment_size > int(max_size * 1.2) and brightness < sensitivity_threshold + 16:
            continue
        positions.append(position)
        last_cut = position
        if oversize:
            continue

    return positions, float(np.mean(projection)) if projection.size else 0.0, whitespace_candidates


def _build_segments(total_size: int, cut_positions: list[int], overlap: int) -> list[SplitterSegmentModel]:
    boundaries = [0, *sorted(set(position for position in cut_positions if 0 < position < total_size)), total_size]
    segments: list[SplitterSegmentModel] = []
    for index in range(len(boundaries) - 1):
        base_start = boundaries[index]
        base_end = boundaries[index + 1]
        start = base_start if index == 0 else max(0, base_start - overlap)
        end = base_end if index == len(boundaries) - 2 else min(total_size, base_end + overlap)
        size = max(1, end - start)
        segments.append(SplitterSegmentModel(
            id=f"segment-{uuid4().hex[:8]}",
            start=start,
            end=end,
            size=size,
            warning="Segmento muito pequeno." if size < 400 else None,
        ))
    return segments


@router.post("/splitter/analyze", response_model=SplitterAnalysisResponse)
async def analyze_splitter(
    file: UploadFile = File(...),
    recipe: str | None = Form(default=None),
):
    payload = await file.read()
    image = _load_image(payload)
    parsed_recipe = _parse_recipe(recipe)
    rgb = np.array(image)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    total_size = int(gray.shape[0] if parsed_recipe.axis == "vertical" else gray.shape[1])

    if parsed_recipe.strategy in {"count", "fixed_height"}:
        positions = _build_fixed_positions(total_size, parsed_recipe)
        average_brightness = float(np.mean(gray)) if gray.size else 0.0
        whitespace_candidates = int(np.sum(gray >= 220))
    else:
        positions, average_brightness, whitespace_candidates = _build_smart_positions(gray, parsed_recipe)

    cuts: list[SplitterCutLineModel] = []
    edge_guard = max(8, parsed_recipe.edgeGuard)
    for position in positions:
        warning = None
        if position < edge_guard or total_size - position < edge_guard:
            warning = "Too close to the edge."
        score = min(0.99, max(0.05, (position / max(1, total_size)) + 0.15))
        cuts.append(SplitterCutLineModel(
            id=f"cut-{uuid4().hex[:8]}",
            position=int(position),
            locked=False,
            score=round(score, 4),
            source="advanced_desktop",
            warning=warning,
        ))

    segments = _build_segments(total_size, [cut.position for cut in cuts], parsed_recipe.overlap)
    warnings: list[str] = []
    if not cuts:
        warnings.append("No reliable cut was found.")
    if any(segment.size < parsed_recipe.minSegmentSize for segment in segments):
        warnings.append("A segment is smaller than the configured minimum height.")
    if any(segment.size > parsed_recipe.maxSegmentSize for segment in segments):
        warnings.append("A segment is larger than the configured maximum height.")

    return SplitterAnalysisResponse(
        imageId="desktop-analysis",
        width=image.width,
        height=image.height,
        strategy=parsed_recipe.strategy,
        cuts=cuts,
        segments=segments,
        warnings=warnings,
        diagnostics=SplitterDiagnosticsModel(
            averageBrightness=round(average_brightness, 2),
            whitespaceCandidates=whitespace_candidates,
            engine="advanced_desktop",
        ),
    )
