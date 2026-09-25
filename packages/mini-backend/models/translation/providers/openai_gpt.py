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
    extract_openai_chat_text,
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


class OpenAIGPTTranslatorEngine(BaseTranslator):
    name = "OpenAI GPT"

    def __init__(
        self,
        model_name: str,
        key: str,
        *,
        api_key_envs: tuple[str, ...] = ("MINI_BACKEND_OPENAI_API_KEY",),
        api_base_envs: tuple[str, ...] = ("MINI_BACKEND_OPENAI_API_BASE",),
        default_api_base: str = "https://api.openai.com/v1",
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
    ) -> dict[str, dict[str, Any]]:
        if not self.api_key:
            raise RuntimeError("OpenAI requires MINI_BACKEND_OPENAI_API_KEY")

        system_prompt = _llm_system_prompt(
            source_language, target_language, translation_notes_enabled
        )
        user_prompt = _llm_user_prompt(
            regions, extra_context, translation_notes_enabled
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
        headers = {"Authorization": f"Bearer {self.api_key}"}

        response = await http_mod.post_llm_json(
            provider_label="OpenAI",
            url=f"{self.api_base}/chat/completions",
            payload=payload,
            headers=headers,
            timeout=90,
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
        )
        translated_map = dedupe_translation_notes_across_regions(translated_map)

        return build_llm_results(
            regions,
            translated_map,
            translator_key=self.key,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )
