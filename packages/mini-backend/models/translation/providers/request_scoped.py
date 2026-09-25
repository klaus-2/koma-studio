from __future__ import annotations

from typing import Any

from models.translation import http as http_mod
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.parsing import (
    dedupe_translation_notes_across_regions,
    extract_ollama_text,
    extract_openai_chat_text,
)
from models.translation.prompts import _llm_system_prompt, _llm_user_prompt
from models.translation.providers._common import (
    _empty_translation_results,
    _preprocess_translation_regions,
    build_llm_results,
    parse_llm_response,
)
from models.translation.urls import (
    _normalize_openai_compatible_api_base,
    _resolve_openai_compatible_chat_url,
    _resolve_ollama_chat_url,
)


class RequestScopedOpenAICompatibleTranslatorEngine(BaseTranslator):
    name = "Request Scoped OpenAI-Compatible"

    def __init__(
        self,
        *,
        key: str,
        model_name: str,
        api_base: str,
        api_key: str = "",
        temperature: float = 0.2,
        timeout: int = 90,
    ) -> None:
        self.key = key
        self.model_name = model_name
        self.api_base = _normalize_openai_compatible_api_base(api_base)
        self.api_key = str(api_key or "").strip()
        self.temperature = max(0.0, min(2.0, float(temperature)))
        self.timeout = max(5, int(timeout))

    async def _translate_batch(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str,
        translation_notes_enabled: bool,
        translation_mode: str,
    ) -> dict[str, dict[str, Any]]:
        system_prompt = _llm_system_prompt(
            source_language,
            target_language,
            translation_notes_enabled,
            translation_mode,
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled, translation_mode
        )
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
        }
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else None

        response = await http_mod.post_llm_json(
            provider_label="Custom AI",
            url=_resolve_openai_compatible_chat_url(self.api_base),
            payload=payload,
            headers=headers,
            timeout=self.timeout,
        )
        return parse_llm_response(extract_openai_chat_text(response), regions)

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
            regions,
            translated_map,
            translator_key=self.key,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )


class RequestScopedOllamaNativeTranslatorEngine(BaseTranslator):
    name = "Request Scoped Ollama Native"

    def __init__(
        self,
        *,
        key: str,
        model_name: str,
        api_base: str,
        api_key: str = "",
        temperature: float = 0.2,
        timeout: int = 90,
    ) -> None:
        self.key = key
        self.model_name = model_name
        self.api_base = str(api_base or "").strip().rstrip("/")
        self.api_key = str(api_key or "").strip()
        self.temperature = max(0.0, min(2.0, float(temperature)))
        self.timeout = max(5, int(timeout))

    async def _translate_batch(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str,
        translation_notes_enabled: bool,
        translation_mode: str,
    ) -> dict[str, dict[str, Any]]:
        system_prompt = _llm_system_prompt(
            source_language,
            target_language,
            translation_notes_enabled,
            translation_mode,
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled, translation_mode
        )
        payload = {
            "model": self.model_name,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "options": {
                "temperature": self.temperature,
                "num_predict": 4096,
            },
        }
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else None

        response = await http_mod.post_llm_json(
            provider_label="Custom AI Ollama",
            url=_resolve_ollama_chat_url(self.api_base),
            payload=payload,
            headers=headers,
            timeout=self.timeout,
        )
        return parse_llm_response(extract_ollama_text(response), regions)

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
            regions,
            translated_map,
            translator_key=self.key,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )
