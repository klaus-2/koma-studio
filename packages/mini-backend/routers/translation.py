from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Form, HTTPException
from pydantic import ValidationError

from core.config import clamp_llm_request_settings, get_config
from core.languages import normalize_language_code
from models.translation.base_translator import TranslationInputRegion
from models.translation.factory import get_translation_engine, list_translation_models
from models.translation.providers import (
    build_current_image_translation_context,
    build_request_scoped_custom_translation_engine,
    compose_translation_extra_context,
)
from pipelines.cache_manager import CacheManager
from schemas.translation import (
    TranslationRegionRequest,
    TranslationRegionResult,
    TranslationResponse,
)


router = APIRouter(tags=["translation"])
logger = logging.getLogger(__name__)
_CACHE_CONFIG = get_config()
CACHE_MANAGER = CacheManager(
    ttl_seconds=_CACHE_CONFIG.pipeline_cache_ttl_seconds,
    max_entries=_CACHE_CONFIG.pipeline_cache_max_entries,
    bbox_tolerance_px=_CACHE_CONFIG.pipeline_cache_bbox_tolerance_px,
)


@router.get("/translate/models")
async def translation_models():
    return {
        "models": list_translation_models(),
    }


def _parse_regions(raw_regions: str | None) -> list[TranslationRegionRequest]:
    if not raw_regions:
        return []
    try:
        payload = json.loads(raw_regions)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid regions field (JSON)") from exc
    if not isinstance(payload, list):
        raise HTTPException(status_code=400, detail="The regions field must be a JSON list")

    parsed: list[TranslationRegionRequest] = []
    for item in payload:
        try:
            parsed.append(TranslationRegionRequest.model_validate(item))
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid region: {exc}") from exc
    return parsed


def _parse_optional_custom_llm(raw_custom_llm: str | None) -> dict[str, Any] | None:
    if not raw_custom_llm:
        return None
    try:
        payload = json.loads(raw_custom_llm)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid custom_llm field (JSON)") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="The custom_llm field must be a JSON object")
    return payload


@router.post("/translate", response_model=TranslationResponse)
async def translate_text(
    model_key: str | None = Form(None),
    source_language: str = Form("auto"),
    target_language: str = Form("en"),
    regions: str | None = Form(None),
    translation_mode: str = Form("default"),
    extra_context: str | None = Form(None),
    llm_settings: str | None = Form(None),
    custom_llm: str | None = Form(None),
):
    src_lang = normalize_language_code(source_language, default="auto", allow_auto=True)
    tgt_lang = normalize_language_code(target_language, default="en", allow_auto=False)

    parsed_regions = _parse_regions(regions)
    if not parsed_regions:
        raise HTTPException(status_code=400, detail="No region was provided for translation")

    effective_settings_payload: dict[str, object] = {}
    if llm_settings:
        try:
            parsed_settings = json.loads(llm_settings)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail="Invalid llm_settings field (JSON)") from exc
        if isinstance(parsed_settings, dict):
            effective_settings_payload = parsed_settings
    if extra_context and "extra_context" not in effective_settings_payload:
        effective_settings_payload["extra_context"] = extra_context
    settings = clamp_llm_request_settings(effective_settings_payload)
    parsed_custom_llm = _parse_optional_custom_llm(custom_llm)
    requested_model_key = (model_key or "").strip()
    use_request_scoped_custom_engine = requested_model_key == "custom" or requested_model_key.startswith("custom:")

    input_region_payload = [
        {
            "id": region.id,
            "text": region.text,
            "source": region.source,
            "detector_model_key": region.detector_model_key,
            "ocr_model_key": region.ocr_model_key,
            "detected_render_mode": region.detected_render_mode,
            "structural_type": region.structural_type,
            "sfx_requires_redraw": region.sfx_requires_redraw,
        }
        for region in parsed_regions
    ]
    current_image_context = build_current_image_translation_context(
        [
            TranslationInputRegion(
                id=item["id"],
                text=item["text"],
                source=item["source"],
                detector_model_key=item["detector_model_key"],
                ocr_model_key=item["ocr_model_key"],
                detected_render_mode=str(item.get("detected_render_mode") or ""),
                structural_type=str(item.get("structural_type") or ""),
                sfx_requires_redraw=bool(item.get("sfx_requires_redraw", False)),
            )
            for item in input_region_payload
        ]
    )
    effective_extra_context = compose_translation_extra_context(
        settings.extra_context,
        current_image_context,
    )

    try:
        if use_request_scoped_custom_engine:
            engine = build_request_scoped_custom_translation_engine(
                selected_model_key=requested_model_key,
                custom_llm=parsed_custom_llm,
                llm_settings=settings.__dict__,
            )
        else:
            engine = get_translation_engine(model_key=model_key)
        cache_key = CACHE_MANAGER.build_translation_cache_key(
            model_key=requested_model_key or engine.key,
            source_language=src_lang,
            target_language=tgt_lang,
            extra_context=effective_extra_context,
            llm_settings=settings.__dict__,
            custom_llm=parsed_custom_llm,
            translation_mode=translation_mode,
        )
        cached_by_id, missing_regions_payload = CACHE_MANAGER.get_cached_translations_for_regions(
            cache_key,
            input_region_payload,
        )

        fresh_by_id: dict[str, dict[str, str]] = {}
        if missing_regions_payload:
            translated = await engine.translate(
                regions=[
                    TranslationInputRegion(
                        id=str(region["id"]),
                        text=str(region.get("text") or ""),
                        source=str(region.get("source") or "model"),
                        detector_model_key=str(region.get("detector_model_key") or ""),
                        ocr_model_key=str(region.get("ocr_model_key") or ""),
                        detected_render_mode=str(region.get("detected_render_mode") or ""),
                        structural_type=str(region.get("structural_type") or ""),
                        sfx_requires_redraw=bool(region.get("sfx_requires_redraw", False)),
                    )
                    for region in missing_regions_payload
                ],
                source_language=src_lang,
                target_language=tgt_lang,
                extra_context=effective_extra_context,
                translation_notes_enabled=settings.translation_notes_enabled,
                translation_mode=translation_mode,
            )
            fresh_records = [
                {
                    "id": item.id,
                    "source_text": item.source_text,
                    "translated_text": item.translated_text,
                    "translation_notes": list(item.translation_notes),
                    "source": item.source,
                    "detector_model_key": item.detector_model_key,
                    "ocr_model_key": item.ocr_model_key,
                    "translator_model_key": item.translator_model_key or engine.key,
                }
                for item in translated
            ]
            fresh_by_id = {str(item["id"]): item for item in fresh_records}
            cached_count = CACHE_MANAGER.cache_translation_results(cache_key, fresh_records)
            logger.info("Translation completed and cached for %d blocks", cached_count)
        else:
            logger.info("Using cached translation results for all %d blocks", len(input_region_payload))
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Translation failed: {exc}") from exc

    response_regions: list[TranslationRegionResult] = []
    for region in input_region_payload:
        region_id = str(region["id"])
        merged = fresh_by_id.get(region_id) or cached_by_id.get(region_id)
        if merged is None:
                merged = {
                    "id": region_id,
                    "source_text": str(region.get("text") or "").strip(),
                    "translated_text": "",
                    "translation_notes": [],
                    "source": str(region.get("source") or "model"),
                    "detector_model_key": str(region.get("detector_model_key") or ""),
                    "ocr_model_key": str(region.get("ocr_model_key") or ""),
                "translator_model_key": engine.key,
            }

        source_value = str(merged.get("source") or "model")
        response_regions.append(
            TranslationRegionResult(
                id=str(merged.get("id") or region_id),
                source_text=str(merged.get("source_text") or ""),
                translated_text=str(merged.get("translated_text") or ""),
                translation_notes=[str(item) for item in (merged.get("translation_notes") or []) if str(item).strip()],
                source=source_value if source_value in {"model", "manual"} else "model",
                detector_model_key=str(merged.get("detector_model_key") or ""),
                ocr_model_key=str(merged.get("ocr_model_key") or ""),
                translator_model_key=str(merged.get("translator_model_key") or engine.key),
            )
        )

    return TranslationResponse(
        source_language=src_lang,
        target_language=tgt_lang,
        model_used=requested_model_key or engine.key,
        regions=response_regions,
    )
