from __future__ import annotations

from collections.abc import Mapping

from models.translation.base_translator import BaseTranslator
from models.translation.errors import TranslatorConfigurationError
from models.translation.providers._common import (
    DEFAULT_LLM_TEMPERATURE,
    clamp_temperature,
)
from models.translation.providers.request_scoped import (
    RequestScopedOllamaNativeTranslatorEngine,
    RequestScopedOpenAICompatibleTranslatorEngine,
)
from models.translation.urls import (
    _is_ollama_cloud_host,
    resolve_request_custom_openai_config,
)


def _parse_temperature(settings: Mapping[str, object] | None) -> float:
    raw = settings.get("temperature") if settings else None
    if isinstance(raw, bool) or raw is None:
        return DEFAULT_LLM_TEMPERATURE
    if isinstance(raw, int | float):
        return clamp_temperature(float(raw))
    if isinstance(raw, str):
        try:
            return clamp_temperature(float(raw))
        except ValueError:
            return DEFAULT_LLM_TEMPERATURE
    return DEFAULT_LLM_TEMPERATURE


def build_request_scoped_custom_translation_engine(
    *,
    selected_model_key: str,
    custom_llm: Mapping[str, object] | None,
    llm_settings: Mapping[str, object] | None = None,
) -> BaseTranslator:
    resolved = resolve_request_custom_openai_config(custom_llm)
    temperature = _parse_temperature(llm_settings)
    translator_key = selected_model_key.strip() or "custom"

    if _is_ollama_cloud_host(resolved["api_base"]):
        if not resolved["api_key"]:
            raise TranslatorConfigurationError(
                "Ollama Cloud requires a valid Bearer token for Custom AI."
            )
        return RequestScopedOllamaNativeTranslatorEngine(
            key=translator_key,
            model_name=resolved["model"],
            api_base=resolved["api_base"],
            api_key=resolved["api_key"],
            temperature=temperature,
        )
    return RequestScopedOpenAICompatibleTranslatorEngine(
        key=translator_key,
        model_name=resolved["model"],
        api_base=resolved["api_base"],
        api_key=resolved["api_key"],
        temperature=temperature,
    )
