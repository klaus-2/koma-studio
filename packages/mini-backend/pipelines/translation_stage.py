"""Get Translations stage — one deep module behind /translate and AIO batch.

Owns seed mapping, cache key composition, chain/single engine execution and
record mapping. The HTTP router only parses multipart and maps records onto
the response schema; the batch orchestrator only maps OCR records to seeds.
"""

from __future__ import annotations

import dataclasses
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Callable

from core.config import LLMRequestSettings, normalize_stage_model_key
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.errors import EmptyTranslationError
from models.translation.factory import (
    DEFAULT_TRANSLATION_MODEL,
    get_translation_engine,
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
from pipelines.batch.records import (
    OCRRecord,
    TranslationRecord,
    TranslationSeed,
    normalize_stage_source,
)
from pipelines.cache_manager import CacheManager, get_pipeline_cache
from schemas.translation import (
    TranslationRegionRequest,
    TranslationRegionResult,
)

logger = logging.getLogger(__name__)

# Providers that were unreachable today; in-memory, process-wide.
_TRANSLATION_QUOTA = QuotaBlocklist()


@dataclass(frozen=True, slots=True)
class CachedTranslationRequest:
    model_key: str | None
    source_language: str
    target_language: str
    seeds: tuple[TranslationSeed, ...]
    translation_mode: str
    settings: LLMRequestSettings
    custom_llm: dict[str, object] | None
    # Batch AIO neighbouring-page context; HTTP leaves it empty.
    neighbor_context: str = ""


@dataclass(frozen=True, slots=True)
class CachedTranslationResult:
    source_language: str
    target_language: str
    model_used: str
    engine_key: str
    records: tuple[TranslationRecord, ...]


def seed_from_ocr(record: OCRRecord) -> TranslationSeed:
    """Map a batch OCRRecord onto the translation seed shape."""
    return TranslationSeed(
        id=record["id"],
        text=record["text"],
        source=normalize_stage_source(record["source"]),
        detector_model_key=record["detector_model_key"],
        ocr_model_key=record["ocr_model_key"],
    )


def seed_from_request(region: TranslationRegionRequest) -> TranslationSeed:
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


def to_input_region(seed: TranslationSeed) -> TranslationInputRegion:
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


def empty_record(seed: TranslationSeed, engine_key: str) -> TranslationRecord:
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


def to_region_result(record: TranslationRecord) -> TranslationRegionResult:
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


def fallback_candidates(requested_key: str, chain: Sequence[str]) -> list[str]:
    """Requested engine first, then the configured chain, normalized and de-duplicated."""
    candidates: list[str] = []
    for raw_key in (requested_key or DEFAULT_TRANSLATION_MODEL, *chain):
        key = normalize_stage_model_key("translation", raw_key)
        if key not in candidates:
            candidates.append(key)
    return candidates


def _is_request_scoped(requested_key: str) -> bool:
    return requested_key == "custom" or requested_key.startswith("custom:")


async def run_cached_translation(
    request: CachedTranslationRequest,
    *,
    cache: CacheManager | None = None,
    quota_blocklist: QuotaBlocklist | None = None,
    resolve_engine: Callable[..., BaseTranslator] | None = None,
) -> CachedTranslationResult:
    """Translate regions through the cache + fallback chain behind one interface."""
    # Resolved at call time so tests can patch `get_translation_engine` on this module.
    resolve = resolve_engine if resolve_engine is not None else get_translation_engine
    pipeline_cache = cache if cache is not None else get_pipeline_cache()
    quota = quota_blocklist if quota_blocklist is not None else _TRANSLATION_QUOTA
    settings = request.settings
    settings_dict = dataclasses.asdict(settings)
    seeds = list(request.seeds)
    requested_key = (request.model_key or "").strip()
    request_scoped = _is_request_scoped(requested_key)

    effective_context = compose_translation_extra_context(
        settings.extra_context,
        build_current_image_translation_context([to_input_region(s) for s in seeds]),
        request.neighbor_context,
        glossary=settings.glossary,
    )

    chain = settings.translation_fallback_chain
    chain_keys: tuple[str, ...] = ()
    engine: BaseTranslator | None = None

    if request_scoped:
        engine = build_request_scoped_custom_translation_engine(
            selected_model_key=requested_key,
            custom_llm=request.custom_llm,
            llm_settings=settings_dict,
        )
    elif chain:
        chain_keys = validate_translation_chain_keys(
            fallback_candidates(requested_key, chain)
        )

    provisional_engine_key = (
        chain_keys[0]
        if chain_keys
        else (engine.key if engine is not None else (requested_key or DEFAULT_TRANSLATION_MODEL))
    )
    cache_key_model = requested_key or provisional_engine_key
    engine_key = provisional_engine_key
    cache_key = pipeline_cache.build_translation_cache_key(
        model_key=cache_key_model,
        source_language=request.source_language,
        target_language=request.target_language,
        extra_context=effective_context,
        llm_settings=settings_dict,
        custom_llm=request.custom_llm,
        translation_mode=request.translation_mode,
    )
    cached_by_id, missing = pipeline_cache.get_cached_translations_for_regions(cache_key, seeds)

    async def translate_missing(
        translator: BaseTranslator,
    ) -> list[TranslationTextResult]:
        results = await translator.translate(
            regions=[to_input_region(seed) for seed in missing],
            source_language=request.source_language,
            target_language=request.target_language,
            extra_context=effective_context,
            translation_notes_enabled=settings.translation_notes_enabled,
            translation_mode=request.translation_mode,
        )
        # A provider that gave up on every region answers with empty text. This
        # has to fail inside the attempt so a fallback chain can try the next
        # engine, instead of the stage reporting success with zero translations
        # while the cause stays in the sidecar log.
        translatable = [seed for seed in missing if seed["text"].strip()]
        if translatable and not any(item.translated_text.strip() for item in results):
            raise EmptyTranslationError(translator.key, len(translatable))
        return results

    fresh_by_id: dict[str, TranslationRecord] = {}
    if missing:
        if engine is None and not chain_keys:
            engine = resolve(model_key=request.model_key)
            engine_key = engine.key
        if engine is None:
            result = await translate_with_fallback(
                chain_keys,
                resolve=resolve,
                translate=translate_missing,
                quota_blocklist=quota,
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
        stored = pipeline_cache.cache_translation_results(cache_key, fresh)
        logger.info("translation cached", extra={"blocks": stored, "model": engine_key})
    else:
        logger.info("translation served from cache", extra={"blocks": len(seeds)})

    records = [
        fresh_by_id.get(seed["id"]) or cached_by_id.get(seed["id"]) or empty_record(seed, engine_key)
        for seed in seeds
    ]
    model_used = engine_key if chain_keys else (requested_key or engine_key)
    return CachedTranslationResult(
        source_language=request.source_language,
        target_language=request.target_language,
        model_used=model_used,
        engine_key=engine_key,
        records=tuple(records),
    )
