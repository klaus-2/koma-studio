from __future__ import annotations

from typing import Any

from models.translation.base_translator import BaseTranslator
from models.translation.providers.request_scoped import (
    RequestScopedOllamaNativeTranslatorEngine,
    RequestScopedOpenAICompatibleTranslatorEngine,
)
from models.translation.urls import (
    _is_ollama_cloud_host,
    resolve_request_custom_openai_config,
)


def build_request_scoped_custom_translation_engine(
    *,
    selected_model_key: str,
    custom_llm: dict[str, Any] | None,
    llm_settings: dict[str, Any] | None = None,
) -> BaseTranslator:
    resolved = resolve_request_custom_openai_config(custom_llm)
    settings = llm_settings if isinstance(llm_settings, dict) else {}
    raw_temperature = settings.get("temperature")
    temperature = 0.2
    if raw_temperature is not None:
        try:
            temperature = float(raw_temperature)
        except (TypeError, ValueError):
            temperature = 0.2

    translator_key = str(selected_model_key or "custom").strip() or "custom"
    if _is_ollama_cloud_host(resolved["api_base"]):
        if not resolved["api_key"]:
            raise RuntimeError(
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
