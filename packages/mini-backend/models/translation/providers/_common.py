from __future__ import annotations

import os
from typing import Any

from core.languages import is_no_space_lang
from models.translation.base_translator import TranslationInputRegion, TranslationTextResult
from models.translation.parsing import _parse_llm_translation_map


def _first_env(*names: str, default: str = "") -> str:
    for name in names:
        value = (os.getenv(name) or "").strip()
        if value:
            return value
    return default


def _env_llm_temperature() -> float:
    # was inlined identically in OpenAI/Gemini/Claude __init__
    return float((os.getenv("MINI_BACKEND_LLM_TEMPERATURE") or "0.2").strip())


def _preprocess_translation_text(text: str, source_language: str) -> str:
    cleaned = str(text or "").replace("\r", "").replace("\n", "")
    if is_no_space_lang(source_language):
        cleaned = cleaned.replace(" ", "")
    return cleaned.strip()


def _preprocess_translation_regions(
    regions: list[TranslationInputRegion],
    source_language: str,
) -> list[TranslationInputRegion]:
    prepared: list[TranslationInputRegion] = []
    for region in regions:
        prepared.append(
            TranslationInputRegion(
                id=region.id,
                text=_preprocess_translation_text(region.text, source_language),
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                detected_render_mode=region.detected_render_mode,
                structural_type=region.structural_type,
                sfx_requires_redraw=region.sfx_requires_redraw,
            ),
        )
    return prepared


def _empty_translation_results(
    regions: list[TranslationInputRegion],
    translator_key: str,
) -> list[TranslationTextResult]:
    return [
        TranslationTextResult(
            id=region.id,
            source_text=(region.text or "").strip(),
            translated_text="",
            source=region.source,
            detector_model_key=region.detector_model_key,
            ocr_model_key=region.ocr_model_key,
            translator_model_key=translator_key,
        )
        for region in regions
    ]


def parse_llm_response(
    raw_text: str | None, regions: list[TranslationInputRegion]
) -> dict[str, dict[str, Any]]:
    if raw_text is None:      # provider returned no choices/candidates
        return {}
    return _parse_llm_translation_map(raw_text, regions)


_EMPTY_PAYLOAD: dict[str, Any] = {"text": "", "notes": []}


def build_llm_results(
    regions: list[TranslationInputRegion],
    translated_map: dict[str, dict[str, Any]],
    *,
    translator_key: str,
    translation_notes_enabled: bool,
    translation_mode: str,
) -> list[TranslationTextResult]:
    # Body of the result loop that was identical in OpenAI, RequestScoped*,
    # Gemini and Claude. CustomTranslatorEngine's index-based loop is left alone.
    results: list[TranslationTextResult] = []
    for region in regions:
        source_text = (region.text or "").strip()
        payload = (
            translated_map.get(region.id, {"text": "", "notes": []})
            if source_text
            else {"text": "", "notes": []}
        )
        results.append(
            TranslationTextResult(
                id=region.id,
                source_text=source_text,
                translated_text=str(payload.get("text") or ""),
                translation_notes=list(payload.get("notes") or [])
                if translation_notes_enabled and translation_mode != "sfx"
                else [],
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=translator_key,
            ),
        )
    return results
