"""Translation endpoints — HTTP seam over the cached translation stage."""

from __future__ import annotations

import json
import logging
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException
from pydantic import TypeAdapter, ValidationError

from core.config import clamp_llm_request_settings
from core.languages import normalize_language_code
from models.errors import (
    InvalidModelSelectionError,
    MissingDependencyError,
    ModelConfigurationError,
    ModelError,
    ModelNotInstalledError,
)
from models.translation.factory import list_translation_models
from models.translation.stage import (
    CachedTranslationRequest,
    run_cached_translation,
    seed_from_request,
)
from pipelines.cache_manager import get_pipeline_cache
from schemas.translation import (
    TranslationRegionRequest,
    TranslationResponse,
)

router = APIRouter(tags=["translation"])
logger = logging.getLogger(__name__)

# Kept as a module attribute for existing importers; the instance is process-wide.
CACHE_MANAGER = get_pipeline_cache()

_REGIONS_ADAPTER: TypeAdapter[list[TranslationRegionRequest]] = TypeAdapter(
    list[TranslationRegionRequest]
)
_CLIENT_FIXABLE_MODEL_ERRORS = (
    ModelNotInstalledError,
    InvalidModelSelectionError,
    ModelConfigurationError,
    MissingDependencyError,
)


def _parse_regions(raw: str | None) -> list[TranslationRegionRequest]:
    if not raw:
        return []
    try:
        return _REGIONS_ADAPTER.validate_json(raw)
    except ValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid regions field: {exc}") from exc


def _parse_json_object(raw: str | None, *, field: str) -> dict[str, object] | None:
    if not raw:
        return None
    try:
        payload: object = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid {field} field (JSON)") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail=f"The {field} field must be a JSON object")
    return {str(key): value for key, value in payload.items()}  # pyright: ignore[reportUnknownVariableType]


@router.get("/translate/models")
async def translation_models() -> dict[str, object]:
    return {"models": list_translation_models()}


@router.post("/translate", response_model=TranslationResponse)
async def translate_text(
    model_key: Annotated[str | None, Form()] = None,
    source_language: Annotated[str, Form()] = "auto",
    target_language: Annotated[str, Form()] = "en",
    regions: Annotated[str | None, Form()] = None,
    translation_mode: Annotated[str, Form()] = "default",
    extra_context: Annotated[str | None, Form()] = None,
    llm_settings: Annotated[str | None, Form()] = None,
    custom_llm: Annotated[str | None, Form()] = None,
) -> TranslationResponse:
    src_lang = normalize_language_code(source_language, default="auto", allow_auto=True)
    tgt_lang = normalize_language_code(target_language, default="en", allow_auto=False)

    seeds = tuple(seed_from_request(region) for region in _parse_regions(regions))
    if not seeds:
        raise HTTPException(status_code=400, detail="No region was provided for translation")

    settings_payload = _parse_json_object(llm_settings, field="llm_settings") or {}
    if extra_context and "extra_context" not in settings_payload:
        settings_payload["extra_context"] = extra_context
    settings = clamp_llm_request_settings(settings_payload)
    parsed_custom_llm = _parse_json_object(custom_llm, field="custom_llm")

    try:
        result = await run_cached_translation(
            CachedTranslationRequest(
                model_key=model_key,
                source_language=src_lang,
                target_language=tgt_lang,
                seeds=seeds,
                translation_mode=translation_mode,
                settings=settings,
                custom_llm=parsed_custom_llm,
            ),
            cache=CACHE_MANAGER,
        )
    except _CLIENT_FIXABLE_MODEL_ERRORS as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ModelError as exc:
        logger.exception("translation failed", extra={"model_key": model_key})
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except RuntimeError as exc:
        # Third-party provider errors that are not ModelError subclasses.
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001 — HTTP boundary
        logger.exception("translation failed unexpectedly", extra={"model_key": model_key})
        raise HTTPException(status_code=500, detail="Translation failed") from exc

    return result.response
