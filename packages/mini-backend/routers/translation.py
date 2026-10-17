"""Translation endpoints."""

from __future__ import annotations

from collections.abc import Sequence
import dataclasses
import json
import logging
from typing import Annotated

from fastapi import APIRouter, Form, HTTPException
from pydantic import TypeAdapter, ValidationError

from core.config import clamp_llm_request_settings, normalize_stage_model_key
from core.languages import normalize_language_code
from models.errors import (
    InvalidModelSelectionError,
    MissingDependencyError,
    ModelConfigurationError,
    ModelError,
    ModelNotInstalledError,
)
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.factory import (
    DEFAULT_TRANSLATION_MODEL,
    get_translation_engine,
    list_translation_models,
)
from models.translation.fallback import (
    QuotaBlocklist,
    translate_with_fallback,
    validate_translation_chain_keys,
)
from models.translation.providers import (
    build_current_image_translation_context,
    build_request_scoped_custom_translation_engine,
    compose_translation_extra_context,
)
from pipelines.batch.records import TranslationRecord, TranslationSeed, normalize_stage_source
from pipelines.cache_manager import get_pipeline_cache
from schemas.translation import (
    TranslationRegionRequest,
    TranslationRegionResult,
    TranslationResponse,
)

router = APIRouter(tags=["translation"])
logger = logging.getLogger(__name__)

# Kept as a module attribute for existing importers; the instance is process-wide.
CACHE_MANAGER = get_pipeline_cache()

# Providers that were unreachable today; in-memory, process-wide (plan T2/T3).
_TRANSLATION_QUOTA = QuotaBlocklist()

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


def _seed_from_request(region: TranslationRegionRequest) -> TranslationSeed:
    return TranslationSeed(
        id=region.id,
        text=region.text,
        source=normalize_stage_source(region.source),
        detector_model_key=region.detector_model_key,
        ocr_model_key=region.ocr_model_key,
        detected_render_mode=str(region.detected_render_mode or ""),
        structural_type=str(region.structural_type or ""),
        sfx_requires_redraw=bool(region.sfx_requires_redraw),
    )


def _to_input_region(seed: TranslationSeed) -> TranslationInputRegion:
    return TranslationInputRegion(
        id=seed["id"],
        text=seed["text"],
        source=seed["source"],
        detector_model_key=seed["detector_model_key"],
        ocr_model_key=seed["ocr_model_key"],
        detected_render_mode=seed.get("detected_render_mode", ""),
        structural_type=seed.get("structural_type", ""),
        sfx_requires_redraw=seed.get("sfx_requires_redraw", False),
    )


def _empty_record(seed: TranslationSeed, engine_key: str) -> TranslationRecord:
    return TranslationRecord(
        id=seed["id"],
        source_text=seed["text"].strip(),
        translated_text="",
        translation_notes=[],
        source=seed["source"],
        detector_model_key=seed["detector_model_key"],
        ocr_model_key=seed["ocr_model_key"],
        translator_model_key=engine_key,
    )


def _to_region_result(record: TranslationRecord) -> TranslationRegionResult:
    return TranslationRegionResult(
        id=record["id"],
        source_text=record["source_text"],
        translated_text=record["translated_text"],
        translation_notes=[note for note in record["translation_notes"] if note.strip()],
        source=record["source"],
        detector_model_key=record["detector_model_key"],
        ocr_model_key=record["ocr_model_key"],
        translator_model_key=record["translator_model_key"],
    )


def _fallback_candidates(requested_key: str, chain: Sequence[str]) -> list[str]:
    """Requested engine first, then the configured chain, normalized and de-duplicated."""
    candidates: list[str] = []
    for raw_key in (requested_key or DEFAULT_TRANSLATION_MODEL, *chain):
        key = normalize_stage_model_key("translation", raw_key)
        if key not in candidates:
            candidates.append(key)
    return candidates


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

    seeds = [_seed_from_request(region) for region in _parse_regions(regions)]
    if not seeds:
        raise HTTPException(status_code=400, detail="No region was provided for translation")

    settings_payload = _parse_json_object(llm_settings, field="llm_settings") or {}
    if extra_context and "extra_context" not in settings_payload:
        settings_payload["extra_context"] = extra_context
    settings = clamp_llm_request_settings(settings_payload)
    settings_dict = dataclasses.asdict(settings)
    parsed_custom_llm = _parse_json_object(custom_llm, field="custom_llm")
    requested_key = (model_key or "").strip()
    request_scoped = requested_key == "custom" or requested_key.startswith("custom:")

    effective_context = compose_translation_extra_context(
        settings.extra_context,
        build_current_image_translation_context([_to_input_region(s) for s in seeds]),
    )

    chain = settings.translation_fallback_chain
    chain_keys: tuple[str, ...] = ()
    engine: BaseTranslator | None = None

    try:
        if request_scoped:
            # A "custom:" session cannot be satisfied by a registry key: never chains.
            engine = build_request_scoped_custom_translation_engine(
                selected_model_key=requested_key,
                custom_llm=parsed_custom_llm,
                llm_settings=settings_dict,
            )
        elif chain:
            # get_translation_engine silently defaults unknown keys, so the whole
            # chain is validated up front instead of resolving each key blind.
            chain_keys = validate_translation_chain_keys(
                _fallback_candidates(requested_key, chain)
            )
        else:
            engine = get_translation_engine(model_key=model_key)
        # ``engine`` stays None only on the chain path, where each candidate is
        # resolved while translating; chain_keys is never empty there.
        engine_key = chain_keys[0] if engine is None else engine.key
        cache_key_model = requested_key or engine_key
        cache = get_pipeline_cache()
        cache_key = cache.build_translation_cache_key(
            model_key=cache_key_model,
            source_language=src_lang,
            target_language=tgt_lang,
            extra_context=effective_context,
            llm_settings=settings_dict,
            custom_llm=parsed_custom_llm,
            translation_mode=translation_mode,
        )
        cached_by_id, missing = cache.get_cached_translations_for_regions(cache_key, seeds)

        async def translate_missing(
            translator: BaseTranslator,
        ) -> list[TranslationTextResult]:
            return await translator.translate(
                regions=[_to_input_region(seed) for seed in missing],
                source_language=src_lang,
                target_language=tgt_lang,
                extra_context=effective_context,
                translation_notes_enabled=settings.translation_notes_enabled,
                translation_mode=translation_mode,
            )

        fresh_by_id: dict[str, TranslationRecord] = {}
        if missing:
            if engine is None:
                result = await translate_with_fallback(
                    chain_keys,
                    resolve=get_translation_engine,
                    translate=translate_missing,
                    quota_blocklist=_TRANSLATION_QUOTA,
                )
                translated = result.value
                engine_key = result.engine_key
                failed = [attempt for attempt in result.attempts if not attempt.ok]
                if failed:
                    logger.warning(
                        "translation fallback answered on %s after %d failed attempt(s): %s",
                        engine_key,
                        len(failed),
                        ", ".join(
                            f"{attempt.model_key}:{attempt.error_class}"
                            for attempt in failed
                        ),
                    )
            else:
                translated = await translate_missing(engine)
            fresh = [
                TranslationRecord(
                    id=item.id,
                    source_text=item.source_text,
                    translated_text=item.translated_text,
                    translation_notes=list(item.translation_notes),
                    source=normalize_stage_source(item.source),
                    detector_model_key=item.detector_model_key,
                    ocr_model_key=item.ocr_model_key,
                    translator_model_key=item.translator_model_key or engine_key,
                )
                for item in translated
            ]
            fresh_by_id = {record["id"]: record for record in fresh}
            stored = cache.cache_translation_results(cache_key, fresh)
            logger.info("translation cached", extra={"blocks": stored, "model": engine_key})
        else:
            logger.info("translation served from cache", extra={"blocks": len(seeds)})
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

    records = [
        fresh_by_id.get(seed["id"]) or cached_by_id.get(seed["id"]) or _empty_record(seed, engine_key)
        for seed in seeds
    ]
    return TranslationResponse(
        source_language=src_lang,
        target_language=tgt_lang,
        # With a chain the honest answer is the engine that actually answered;
        # without one this is today's ``requested_key or engine.key``.
        model_used=engine_key if chain_keys else cache_key_model,
        regions=[_to_region_result(record) for record in records],
    )
