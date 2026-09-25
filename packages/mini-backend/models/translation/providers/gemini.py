from __future__ import annotations

from typing import Any
from urllib import parse

from models.translation import http as http_mod
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.parsing import (
    dedupe_translation_notes_across_regions,
    extract_gemini_text,
)
from models.translation.prompts import _llm_system_prompt, _llm_user_prompt
from models.translation.providers._common import (
    _empty_translation_results,
    _env_llm_temperature,
    _first_env,
    _preprocess_translation_regions,
    build_llm_results,
    parse_llm_response,
)

_GEMINI_SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
]


class GeminiTranslatorEngine(BaseTranslator):
    name = "Google Gemini"

    def __init__(
        self,
        model_name: str,
        key: str,
        *,
        api_key_envs: tuple[str, ...] = ("MINI_BACKEND_GEMINI_API_KEY",),
        api_base_envs: tuple[str, ...] = ("MINI_BACKEND_GEMINI_API_BASE",),
        default_api_base: str = "https://generativelanguage.googleapis.com/v1beta/models",
    ) -> None:
        self.model_name = model_name
        self.key = key
        self.api_key = _first_env(*api_key_envs)
        self.api_base = _first_env(*api_base_envs, default=default_api_base).rstrip("/")
        self.temperature = _env_llm_temperature()

    async def _translate_batch(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str,
        translation_notes_enabled: bool,
        translation_mode: str,
    ) -> dict[str, dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("Gemini requires MINI_BACKEND_GEMINI_API_KEY")

        system_prompt = _llm_system_prompt(
            source_language, target_language, translation_notes_enabled, translation_mode
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled, translation_mode
        )
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": self.temperature,
                "maxOutputTokens": 4096,
                "topP": 0.95,
                "responseMimeType": "application/json",
            },
            "safetySettings": _GEMINI_SAFETY_SETTINGS,
        }
        url = f"{self.api_base}/{self.model_name}:generateContent?key={parse.quote(self.api_key)}"
        response = await http_mod.post_llm_json(
            provider_label="Gemini", url=url, payload=payload, timeout=90
        )
        return parse_llm_response(extract_gemini_text(response), regions)

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        non_empty = [region for region in regions if (region.text or "").strip()]
        if not non_empty:
            return _empty_translation_results(regions, self.key)

        prepared_regions = _preprocess_translation_regions(non_empty, source_language)
        translated_map = await self._translate_batch(
            regions=prepared_regions,
            source_language=source_language,
            target_language=target_language,
            extra_context=extra_context,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )
        translated_map = dedupe_translation_notes_across_regions(translated_map)
        return build_llm_results(
            regions, translated_map,
            translator_key=self.key,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )
