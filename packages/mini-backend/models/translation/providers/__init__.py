"""Compat surface: everything that lived in the old providers.py module.

Underscore names are re-exported on purpose — tests import them. Note that
monkeypatching *here* no longer affects engines; patch models.translation.http.
"""
from __future__ import annotations

import logging

from models.translation.http import (  # noqa: F401
    _http_form_post, _http_get_json, _http_json_post, post_llm_json,
)
from models.translation.lang_codes import (  # noqa: F401
    _deepl_source_lang, _deepl_target_lang, _google_lang,
    _microsoft_source_lang, _microsoft_target_lang, _normalize_language_code,
    _yandex_source_lang, _yandex_target_lang,
)
from models.translation.parsing import (  # noqa: F401
    _coerce_translation_notes, _dedupe_translation_notes, _extract_inline_translation_notes,
    _extract_json_payload, _extract_single_region_translation_payload,
    _normalize_translation_note, _parse_llm_translation_map, _strip_markdown_code_fence,
    _translation_payload, dedupe_translation_notes_across_regions,
)
from models.translation.prompts import (  # noqa: F401
    _language_label, _llm_system_prompt, _llm_user_prompt, _money_notes_instruction,
    _notes_mode_instruction, _truncate_context_lines,
    build_current_image_translation_context, compose_translation_extra_context,
)
from models.translation.urls import (  # noqa: F401
    _HUGGINGFACE_ROUTER_API_BASE, _extract_huggingface_model_from_legacy_api_base,
    _is_loopback_host, _is_ollama_cloud_host, _is_private_or_internal_host,
    _normalize_openai_compatible_api_base, _resolve_ollama_chat_url,
    _resolve_openai_compatible_chat_url, resolve_request_custom_openai_config,
)
from models.translation.providers._common import (  # noqa: F401
    _empty_translation_results, _first_env, _preprocess_translation_regions,
    _preprocess_translation_text,
)
from models.translation.providers.claude import ClaudeTranslatorEngine
from models.translation.providers.custom import CustomTranslatorEngine
from models.translation.providers.deepl import DeepLTranslatorEngine
from models.translation.providers.factory import build_request_scoped_custom_translation_engine
from models.translation.providers.gemini import GeminiTranslatorEngine
from models.translation.providers.google import GoogleTranslatorEngine
from models.translation.providers.microsoft import MicrosoftTranslatorEngine
from models.translation.providers.openai_gpt import OpenAIGPTTranslatorEngine
from models.translation.providers.request_scoped import (
    RequestScopedOllamaNativeTranslatorEngine,
    RequestScopedOpenAICompatibleTranslatorEngine,
)
from models.translation.providers.yandex import YandexTranslatorEngine

logger = logging.getLogger(__name__)  # same name as before: models.translation.providers

__all__ = [
    "ClaudeTranslatorEngine", "CustomTranslatorEngine", "DeepLTranslatorEngine",
    "GeminiTranslatorEngine", "GoogleTranslatorEngine", "MicrosoftTranslatorEngine",
    "OpenAIGPTTranslatorEngine", "RequestScopedOllamaNativeTranslatorEngine",
    "RequestScopedOpenAICompatibleTranslatorEngine", "YandexTranslatorEngine",
    "build_request_scoped_custom_translation_engine",
    "build_current_image_translation_context", "compose_translation_extra_context",
    "dedupe_translation_notes_across_regions", "resolve_request_custom_openai_config",
]
