"""Strip splitter endpoints."""

from __future__ import annotations

import asyncio
from typing import Annotated, Final

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import TypeAdapter

from routers._boundary import parse_json_form_field, read_rgb_upload
from schemas.splitter import SplitterAnalysisResponse, SplitterDiagnosticsModel, SplitterRecipeModel
from services.splitter_analysis import analyze_strip

router = APIRouter(tags=["splitter"])
_RECIPE_ADAPTER: Final = TypeAdapter(SplitterRecipeModel)


@router.post("/splitter/analyze", response_model=SplitterAnalysisResponse)
async def analyze_splitter(
    file: Annotated[UploadFile, File()],
    recipe: Annotated[str | None, Form()] = None,
) -> SplitterAnalysisResponse:
    _, rgb = await read_rgb_upload(file)
    parsed_recipe = (
        parse_json_form_field(recipe, _RECIPE_ADAPTER, field_name="recipe") or SplitterRecipeModel()
    )
    analysis = await asyncio.to_thread(analyze_strip, rgb, parsed_recipe)
    height, width = rgb.shape[:2]
    return SplitterAnalysisResponse(
        imageId="desktop-analysis",
        width=width,
        height=height,
        strategy=parsed_recipe.strategy,
        cuts=analysis.cuts,
        segments=analysis.segments,
        warnings=analysis.warnings,
        diagnostics=SplitterDiagnosticsModel(
            averageBrightness=analysis.average_brightness,
            whitespaceCandidates=analysis.whitespace_candidates,
            engine="advanced_desktop",
        ),
    )
