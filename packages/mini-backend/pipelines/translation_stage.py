"""Get Translations stage — one deep module behind /translate and AIO batch.

Owns seed mapping, cache key composition, chain/single engine execution and
record mapping. The HTTP router only parses multipart and maps records onto
the response schema; the batch orchestrator only maps OCR records to seeds.
"""

from __future__ import annotations

import dataclasses
import hashlib
import json
import logging
import re
import sqlite3
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Callable

from core.config import LLMRequestSettings, normalize_stage_model_key
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.errors import (
    BlankRunTranslationError,
    EmptyTranslationError,
)
from models.translation.factory import (
    DEFAULT_TRANSLATION_MODEL,
    get_translation_engine,
    is_local_translation_engine_key,
)
from models.translation.fallback import (
    QuotaBlocklist,
    translate_with_fallback,
    validate_translation_chain_keys,
)
from models.translation.local_base import LocalTranslatorBase
from models.translation.providers import (
    build_current_image_translation_context,
    build_request_scoped_custom_translation_engine,
    compose_translation_extra_context,
    request_scoped_custom_identity,
)
from pipelines.batch.records import (
    OCRRecord,
    TranslationRecord,
    TranslationSeed,
    normalize_stage_source,
)
from pipelines.cache_manager import CacheManager, get_pipeline_cache
from pipelines.translation_masking import (
    MaskedSegment,
    plan_masked_segment,
    reassemble_masked,
)
from pipelines.translation_qa import glossary_missing, run_translation_qa
from pipelines.translation_store import (
    CacheRow,
    TMEntry,
    TMWrite,
    TranslationStore,
    TranslationStoreError,
    get_translation_store,
    glossary_hash,
    normalize_source_text,
    persistent_cache_key,
    tm_key,
)
from schemas.translation import (
    TranslationRegionRequest,
    TranslationRegionResult,
)

logger = logging.getLogger(__name__)

# Providers that were unreachable today; in-memory, process-wide.
_TRANSLATION_QUOTA = QuotaBlocklist()

# The persistent store is best-effort: the first failure warns once per
# process and every later failure stays at debug. Requests degrade to the
# in-memory layer, never fail, and writes are simply dropped.
_store_degradation_warned = False


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


def _contains_protected_terms(text: str, terms: Sequence[str]) -> bool:
    """Casefold word-boundary check used by the hit-path parity guard."""
    haystack = text.casefold()
    for term in terms:
        needle = re.escape(term.casefold())
        if not re.search(rf"(?<!\w){needle}(?!\w)", haystack):
            return False
    return True


def _warn_store_degraded(exc: Exception) -> None:
    """Warn once per process; later store failures stay at debug level."""
    global _store_degradation_warned
    if not _store_degradation_warned:
        _store_degradation_warned = True
        logger.warning("translation.store.degraded_to_memory", exc_info=exc)
    else:
        logger.debug("translation.store.degraded_to_memory", exc_info=exc)


def _resolve_store_safely() -> TranslationStore | None:
    """The lazy singleton, or None when the on-disk store cannot be opened."""
    try:
        return get_translation_store()
    except (TranslationStoreError, sqlite3.Error) as exc:
        _warn_store_degraded(exc)
        return None


def _store_get_cached(
    store: TranslationStore | None, keys: Sequence[str]
) -> dict[str, CacheRow]:
    if store is None:
        return {}
    try:
        return store.get_cached(keys)
    except (TranslationStoreError, sqlite3.Error) as exc:
        _warn_store_degraded(exc)
        return {}


def _store_put_cached(
    store: TranslationStore | None, rows: Sequence[CacheRow]
) -> int:
    if store is None:
        return 0
    try:
        return store.put_cached(rows)
    except (TranslationStoreError, sqlite3.Error) as exc:
        _warn_store_degraded(exc)
        return 0


def _store_lookup_tm(
    store: TranslationStore | None,
    keys: Sequence[tuple[str, str, str]],
) -> dict[tuple[str, str, str], TMEntry]:
    if store is None:
        return {}
    try:
        return store.lookup_tm(keys)
    except (TranslationStoreError, sqlite3.Error) as exc:
        _warn_store_degraded(exc)
        return {}


def _store_put_tm(
    store: TranslationStore | None, rows: Sequence[TMWrite]
) -> None:
    if store is None:
        return
    try:
        store.put_tm(rows)
    except (TranslationStoreError, sqlite3.Error) as exc:
        _warn_store_degraded(exc)


def _store_bump_tm_hits(
    store: TranslationStore | None, keys: Sequence[tuple[str, str, str]]
) -> None:
    if store is None:
        return
    try:
        store.bump_tm_hits(keys)
    except (TranslationStoreError, sqlite3.Error) as exc:
        _warn_store_degraded(exc)


def _consult_persistent_cache(
    *,
    request: CachedTranslationRequest,
    settings: LLMRequestSettings,
    missing: list[TranslationSeed],
    model_key: str,
    store: TranslationStore | None,
    fallback_engine_key: str,
) -> tuple[dict[str, TranslationRecord], list[TranslationSeed], dict[str, str]]:
    """Restart-safe lookup for the in-memory misses.

    Returns (hit records by seed id, remaining misses, persistent key per seed
    id for the post-engine write-back). The persistent key is context-free by
    design (D1): model, languages, mode, normalized text and glossary hash —
    page context is deliberately excluded. A hit row answered by a LOCAL
    engine must carry every never-translate term verbatim (casefold, word
    boundary) or it is discarded as a miss so the fresh re-run can mask the
    terms (Parity Guard).
    """
    gloss_hash = glossary_hash(
        [(term.source, term.target, term.never_translate) for term in settings.glossary]
    )
    mode = (request.translation_mode or "").strip().lower() or "default"
    keys_by_id = {
        seed["id"]: persistent_cache_key(
            model_key,
            request.source_language,
            request.target_language,
            mode,
            normalize_source_text(seed["text"]),
            gloss_hash,
        )
        for seed in missing
    }
    rows = _store_get_cached(store, list(keys_by_id.values()))
    protected = tuple(term.source for term in settings.glossary if term.never_translate)
    hits: dict[str, TranslationRecord] = {}
    remaining: list[TranslationSeed] = []
    for seed in missing:
        row = rows.get(keys_by_id[seed["id"]])
        if row is None or not row.translated_text.strip():
            remaining.append(seed)
            continue
        if (
            protected
            and is_local_translation_engine_key(row.engine_key)
            and not _contains_protected_terms(row.translated_text, protected)
        ):
            logger.debug(
                "translation.parity.discarded",
                extra={
                    "engine_key": row.engine_key,
                    "cache_key": keys_by_id[seed["id"]],
                },
            )
            remaining.append(seed)
            continue
        hits[seed["id"]] = TranslationRecord(
            id=seed["id"],
            source_text=seed["text"].strip(),
            translated_text=row.translated_text,
            translation_notes=list(row.notes),
            source=seed["source"],
            detector_model_key=seed["detector_model_key"],
            ocr_model_key=seed["ocr_model_key"],
            translator_model_key=row.engine_key or fallback_engine_key,
        )
    return hits, remaining, keys_by_id


def _consult_translation_memory(
    *,
    request: CachedTranslationRequest,
    settings: LLMRequestSettings,
    missing: list[TranslationSeed],
    store: TranslationStore | None,
    fallback_engine_key: str,
) -> tuple[dict[str, TranslationRecord], list[TranslationSeed]]:
    """Opt-in TM reads: exact NFKC key only, no fuzz matching.

    Hits carry the stored engine key and are bumped in one batched statement.
    A hit answered by a LOCAL engine obeys the same never-translate parity
    guard as the persistent cache: a protected term missing verbatim discards
    the hit so the fresh re-run masks the terms."""
    protected = tuple(term.source for term in settings.glossary if term.never_translate)
    hits: dict[str, TranslationRecord] = {}
    remaining: list[TranslationSeed] = []
    bumped: dict[tuple[str, str, str], None] = {}
    # One batched TM read for every in-memory miss (no N+1 queries).
    wanted_keys = [
        (
            tm_key(normalize_source_text(seed["text"])),
            request.source_language,
            request.target_language,
        )
        for seed in missing
    ]
    entries = _store_lookup_tm(store, wanted_keys)
    for seed, tm_key_value in zip(missing, wanted_keys, strict=True):
        entry = entries.get(tm_key_value)
        if entry is None or not entry.translation.strip():
            remaining.append(seed)
            continue
        if (
            protected
            and is_local_translation_engine_key(entry.model_key)
            and not _contains_protected_terms(entry.translation, protected)
        ):
            logger.debug(
                "translation.parity.discarded",
                extra={
                    "engine_key": entry.model_key,
                    "cache_key": tm_key_value,
                },
            )
            remaining.append(seed)
            continue
        hits[seed["id"]] = TranslationRecord(
            id=seed["id"],
            source_text=seed["text"].strip(),
            translated_text=entry.translation,
            translation_notes=[],
            source=seed["source"],
            detector_model_key=seed["detector_model_key"],
            ocr_model_key=seed["ocr_model_key"],
            translator_model_key=entry.model_key or fallback_engine_key,
        )
        bumped[tm_key_value] = None
    if bumped:
        _store_bump_tm_hits(store, list(bumped))
    return hits, remaining


def _persist_fresh_results(
    store: TranslationStore | None,
    records: Sequence[TranslationRecord],
    keys_by_id: Mapping[str, str],
    fallback_engine_key: str,
) -> int:
    """Write fresh engine answers into the persistent store; blank rows skipped."""
    written = _store_put_cached(
        store,
        [
            CacheRow(
                key=keys_by_id[record["id"]],
                translated_text=record["translated_text"],
                notes=tuple(record["translation_notes"]),
                engine_key=record["translator_model_key"] or fallback_engine_key,
            )
            for record in records
            if record["id"] in keys_by_id and record["translated_text"].strip()
        ]
    )
    if written:
        logger.info(
            "translation.cached_persistently",
            extra={"blocks": written, "model": fallback_engine_key},
        )
    return written


async def _translate_masked(
    translator: BaseTranslator,
    masking_plans: Mapping[str, MaskedSegment],
    reps: Sequence[TranslationSeed],
    *,
    source_language: str,
    target_language: str,
    extra_context: str,
    translation_notes_enabled: bool,
    translation_mode: str,
) -> list[TranslationTextResult]:
    """Fresh dispatch through the never-translate mask (local engines only).

    The unique prose runs of every representative go to the model in ONE
    batched call; each representative is then reassembled with its protected
    terms verbatim and the runs' original whitespace."""
    global_runs: list[str] = []
    global_pos: dict[str, int] = {}
    for rep in reps:
        for run in masking_plans[rep["id"]].run_texts:
            if run not in global_pos:
                global_pos[run] = len(global_runs)
                global_runs.append(run)

    if not global_runs:
        # Every seed's alnum content is protected terms: there is nothing for
        # the engine. The reassembly is the verbatim source text — never an
        # engine call and never an EmptyTranslationError.
        return [
            TranslationTextResult(
                id=rep["id"],
                source_text=rep["text"].strip(),
                translated_text=reassemble_masked(masking_plans[rep["id"]].steps, []),
                translation_notes=[],
                source=rep["source"],
                detector_model_key=rep["detector_model_key"],
                ocr_model_key=rep["ocr_model_key"],
                translator_model_key=translator.key,
            )
            for rep in reps
        ]

    results = await translator.translate(
        regions=[
            TranslationInputRegion(id=f"mask-run-{index}", text=run)
            for index, run in enumerate(global_runs)
        ],
        source_language=source_language,
        target_language=target_language,
        extra_context=extra_context,
        translation_notes_enabled=translation_notes_enabled,
        translation_mode=translation_mode,
    )
    blank_runs = [result for result in results if not result.translated_text.strip()]
    if blank_runs:
        # A blank run spliced into the sentence would truncate it and persist
        # the damage; fail the attempt so the fallback chain tries instead.
        raise BlankRunTranslationError(translator.key, len(blank_runs))
    text_by_region_id = {result.id: result.translated_text for result in results}

    translated: list[TranslationTextResult] = []
    for rep in reps:
        segment = masking_plans[rep["id"]]
        run_translations = [
            text_by_region_id[f"mask-run-{global_pos[run]}"]
            for run in segment.run_texts
        ]
        translated.append(
            TranslationTextResult(
                id=rep["id"],
                source_text=rep["text"].strip(),
                translated_text=reassemble_masked(segment.steps, run_translations),
                translation_notes=[],
                source=rep["source"],
                detector_model_key=rep["detector_model_key"],
                ocr_model_key=rep["ocr_model_key"],
                translator_model_key=translator.key,
            )
        )
    return translated


async def run_cached_translation(
    request: CachedTranslationRequest,
    *,
    cache: CacheManager | None = None,
    quota_blocklist: QuotaBlocklist | None = None,
    resolve_engine: Callable[..., BaseTranslator] | None = None,
    store: TranslationStore | None = None,
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
    # Request-scoped custom profiles are keyed by their resolved IDENTITY
    # (engine kind + api base + model name — never the api key): editing the
    # profile must stop serving the previous profile's cached answers, while
    # rotating the key must not invalidate them.
    custom_identity_hash = ""
    if request_scoped:
        kind, api_base, model_name = request_scoped_custom_identity(request.custom_llm)
        canonical = json.dumps(
            [kind, api_base, model_name], separators=(",", ":"), ensure_ascii=False
        )
        custom_identity_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
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

    # Symbol-only seeds carry nothing an engine can translate: they go straight
    # to the output verbatim (no notes) — no engine call, no persistent/TM
    # lookup or write, and they never reach QA as identical-to-source.
    passthrough_by_id: dict[str, TranslationRecord] = {
        seed["id"]: TranslationRecord(
            id=seed["id"],
            source_text=seed["text"].strip(),
            translated_text=seed["text"],
            translation_notes=[],
            source=seed["source"],
            detector_model_key=seed["detector_model_key"],
            ocr_model_key=seed["ocr_model_key"],
            translator_model_key=engine_key,
        )
        for seed in missing
        if all(not ch.isalnum() for ch in seed["text"].strip())
    }
    missing = [seed for seed in missing if seed["id"] not in passthrough_by_id]

    # Restart-safe layer (consulted only for in-memory misses): key is
    # context-free per D1; local-engine hits obey the never-translate parity
    # guard, cloud-engine hits pass through unchecked.
    translation_store: TranslationStore | None = (
        store if store is not None else _resolve_store_safely()
    )
    persistent_by_id: dict[str, TranslationRecord] = {}
    persistent_keys_by_id: dict[str, str] = {}
    if missing:
        persistent_by_id, missing, persistent_keys_by_id = _consult_persistent_cache(
            request=request,
            settings=settings,
            missing=missing,
            model_key=custom_identity_hash or cache_key_model,
            store=translation_store,
            fallback_engine_key=engine_key,
        )
        if persistent_by_id:
            logger.info(
                "translation.served_persistently",
                extra={"blocks": len(persistent_by_id), "model": engine_key},
            )

    tm_by_id: dict[str, TranslationRecord] = {}
    if missing and settings.translation_memory_enabled:
        tm_by_id, missing = _consult_translation_memory(
            request=request,
            settings=settings,
            missing=missing,
            store=translation_store,
            fallback_engine_key=engine_key,
        )
        if tm_by_id:
            logger.info(
                "translation.served_tm",
                extra={"blocks": len(tm_by_id), "model": engine_key},
            )

    # One engine region per unique text: remaining seeds are grouped by their
    # normalized text, the representative is translated once, and the answer is
    # replicated to every group member keeping each seed's own metadata.
    dedup_reps: list[TranslationSeed] = []
    dedup_members: dict[str, list[TranslationSeed]] = {}
    rep_id_by_text: dict[str, str] = {}
    for seed in missing:
        normalized = normalize_source_text(seed["text"])
        rep_id = rep_id_by_text.get(normalized)
        if rep_id is None:
            rep_id_by_text[normalized] = seed["id"]
            dedup_members[seed["id"]] = [seed]
            dedup_reps.append(seed)
        else:
            dedup_members[rep_id].append(seed)

    # Fresh-dispatch masking plan (applies to LOCAL engines only, mode
    # independently): unique texts are split around the never-translate terms
    # so the terms themselves never reach the model.
    protected_terms = tuple(
        term.source for term in settings.glossary if term.never_translate
    )
    masking_plans: dict[str, MaskedSegment] = (
        {
            rep["id"]: plan_masked_segment(rep["text"], protected_terms)
            for rep in dedup_reps
        }
        if protected_terms
        else {}
    )

    async def translate_missing(
        translator: BaseTranslator,
    ) -> list[TranslationTextResult]:
        if masking_plans and isinstance(translator, LocalTranslatorBase):
            results = await _translate_masked(
                translator,
                masking_plans,
                dedup_reps,
                source_language=request.source_language,
                target_language=request.target_language,
                extra_context=effective_context,
                translation_notes_enabled=settings.translation_notes_enabled,
                translation_mode=request.translation_mode,
            )
        else:
            results = await translator.translate(
                regions=[to_input_region(seed) for seed in dedup_reps],
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
        if any(seed["text"].strip() for seed in dedup_reps) and not any(
            item.translated_text.strip() for item in results
        ):
            raise EmptyTranslationError(translator.key, len(dedup_reps))
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
        # Mandatory glossary post-check: local answering engines only (cloud
        # engines get the glossary in the prompt instead), skipped in SFX.
        answered_local = (
            isinstance(engine, LocalTranslatorBase)
            if engine is not None
            else is_local_translation_engine_key(engine_key)
        )
        sfx_mode = request.translation_mode.strip().lower() == "sfx"
        fresh: list[TranslationRecord] = []
        tm_writes: list[TMWrite] = []
        for item in translated:
            # QA runs once per unique engine answer; the verdict (and any
            # deterministic echo repair) is replicated to the group members.
            outcome = run_translation_qa(
                item.source_text,
                item.translated_text,
                target_language=request.target_language,
                translation_mode=request.translation_mode,
            )
            glossary_notes: tuple[str, ...] = ()
            if answered_local and not sfx_mode and settings.glossary:
                glossary_notes = tuple(
                    glossary_missing(item.source_text, outcome.text, settings.glossary)
                )
            # TM writes are ALWAYS on outside SFX (D2) — only the reads are
            # toggle-gated. Echo-repaired results and results identical to
            # their source (direct text comparison) never enter the memory.
            if (
                not sfx_mode
                and not outcome.repaired
                and "repeated_word" not in outcome.flags
                and outcome.text.strip()
                and normalize_source_text(item.source_text)
                != normalize_source_text(outcome.text)
            ):
                tm_writes.append(
                    TMWrite(
                        nfkc_key=tm_key(normalize_source_text(item.source_text)),
                        src_lang=request.source_language,
                        tgt_lang=request.target_language,
                        translation=outcome.text,
                        model_key=item.translator_model_key or engine_key,
                    )
                )
            for member in dedup_members.get(item.id, ()):
                fresh.append(
                    TranslationRecord(
                        id=member["id"],
                        source_text=member["text"].strip(),
                        translated_text=outcome.text,
                        translation_notes=[
                            *item.translation_notes,
                            *outcome.notes,
                            *glossary_notes,
                        ],
                        source=normalize_stage_source(member["source"]),
                        detector_model_key=member["detector_model_key"],
                        ocr_model_key=member["ocr_model_key"],
                        translator_model_key=item.translator_model_key or engine_key,
                    )
                )
        _store_put_tm(translation_store, tm_writes)
        if tm_writes:
            logger.info(
                "translation.tm_written", extra={"blocks": len(tm_writes), "model": engine_key}
            )
        fresh_by_id = {record["id"]: record for record in fresh}
        # Cache layers store one entry per unique text (the representative).
        unique_fresh = [
            record for record in fresh if record["id"] in dedup_members
        ]
        stored = pipeline_cache.cache_translation_results(cache_key, unique_fresh)
        logger.info("translation cached", extra={"blocks": stored, "model": engine_key})
        if persistent_keys_by_id:
            _persist_fresh_results(
                translation_store, unique_fresh, persistent_keys_by_id, engine_key
            )
    else:
        logger.info("translation served from cache", extra={"blocks": len(seeds)})

    records = [
        fresh_by_id.get(seed["id"])
        or cached_by_id.get(seed["id"])
        or persistent_by_id.get(seed["id"])
        or tm_by_id.get(seed["id"])
        or passthrough_by_id.get(seed["id"])
        or empty_record(seed, engine_key)
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
