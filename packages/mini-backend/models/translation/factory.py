from __future__ import annotations

import os
from collections import OrderedDict
from typing import Any

from core.config import normalize_stage_model_key
from core.models_store import model_is_installed
from models.translation.base_translator import BaseTranslator
from models.translation.local_ctranslate2 import (
    M2M100LocalTranslator,
    SugoiLocalTranslator,
)
from models.translation.local_gguf import GGUFLocalTranslator
from models.translation.local_storage import (
    local_translation_runtime_ready,
    resolve_local_translation_model_dir,
)
from models.translation.providers import (
    ClaudeTranslatorEngine,
    CustomTranslatorEngine,
    DeepLTranslatorEngine,
    GeminiTranslatorEngine,
    GoogleTranslatorEngine,
    MicrosoftTranslatorEngine,
    OpenAIGPTTranslatorEngine,
    YandexTranslatorEngine,
)


TRANSLATION_MODELS: dict[str, dict[str, Any]] = {
    "google_translate": {
        "name": "Google Translate",
        "device": "cpu",
        "use_case": "Free machine translation (no API key)",
        "implemented": True,
        "kind": "traditional",
        "requires": [],
    },
    "microsoft_translator": {
        "name": "Microsoft Translator",
        "device": "cpu",
        "use_case": "Translation via Azure Translator (free/paid plan)",
        "implemented": True,
        "kind": "traditional",
        "requires": [
            "MINI_BACKEND_MS_TRANSLATOR_KEY",
            "MINI_BACKEND_MS_TRANSLATOR_REGION",
        ],
    },
    "yandex_translate": {
        "name": "Yandex Translate",
        "device": "cpu",
        "use_case": "Translation via Yandex Cloud Translate",
        "implemented": True,
        "kind": "traditional",
        "requires": ["MINI_BACKEND_YANDEX_API_KEY", "MINI_BACKEND_YANDEX_FOLDER_ID"],
    },
    "deepl": {
        "name": "DeepL",
        "device": "cpu",
        "use_case": "Translation with the DeepL API (Free/Pro)",
        "implemented": True,
        "kind": "traditional",
        "requires": ["MINI_BACKEND_DEEPL_API_KEY"],
    },
    "custom": {
        "name": "Custom",
        "device": "cpu",
        "use_case": "Endpoint custom (OpenAI-compatible ou API propria)",
        "implemented": True,
        "kind": "custom",
        "requires": [],
    },
    "sugoi_v4_ja_en_ct2": {
        "name": "Sugoi v4 JA→EN (CT2)",
        "device": "cpu_gpu",
        "use_case": "Offline local Japanese translation via CTranslate2.",
        "implemented": True,
        "kind": "local_ctranslate2",
        "requires": [],
    },
    "m2m100_1_2b_ct2": {
        "name": "M2M100 1.2B (CT2)",
        "device": "cpu_gpu",
        "use_case": "Local multi-language translation via CTranslate2.",
        "implemented": True,
        "kind": "local_ctranslate2",
        "requires": [],
    },
    "vntl_llama3_8b_v2": {
        "name": "VNTL Llama3 8B v2",
        "device": "cpu_gpu",
        "use_case": "High-quality local JA->EN translation via GGUF (~8.5GB Q8_0).",
        "implemented": True,
        "kind": "local_gguf",
        "requires": [],
    },
    "lfm2_350m_enjp_mt": {
        "name": "LFM2 350M EN-JP MT",
        "device": "cpu_gpu",
        "use_case": "Lightweight local JA->EN translation via GGUF (~400MB). Good for CPU.",
        "implemented": True,
        "kind": "local_gguf",
        "requires": [],
    },
    "sakura_galtransl_7b_v3_7": {
        "name": "Sakura GalTransl 7B v3.7",
        "device": "cpu_gpu",
        "use_case": "Local JA->ZH-CN translation via GGUF (~6.3GB).",
        "implemented": True,
        "kind": "local_gguf",
        "requires": [],
    },
    "sakura_1_5b_qwen2_5_v1_0": {
        "name": "Sakura 1.5B Qwen2.5 v1.0",
        "device": "cpu_gpu",
        "use_case": "Lightweight local JA->ZH-CN translation via GGUF (~1.5GB).",
        "implemented": True,
        "kind": "local_gguf",
        "requires": [],
    },
    "hunyuan_7b_mt_v1_0": {
        "name": "Hunyuan MT 7B v1.0",
        "device": "cpu_gpu",
        "use_case": "Local multilingual translation (44 languages) via GGUF (~6.3GB).",
        "implemented": True,
        "kind": "local_gguf",
        "requires": [],
    },
    "gpt_4_1": {
        "name": "GPT-4.1",
        "device": "cpu_gpu",
        "use_case": "Cloud AI for contextual translation",
        "implemented": True,
        "kind": "llm",
        "model": "gpt-4.1",
        "requires": ["MINI_BACKEND_OPENAI_API_KEY"],
    },
    "gpt_4_1_mini": {
        "name": "GPT-4.1-mini",
        "device": "cpu_gpu",
        "use_case": "IA na nuvem com menor custo/latencia",
        "implemented": True,
        "kind": "llm",
        "model": "gpt-4.1-mini",
        "requires": ["MINI_BACKEND_OPENAI_API_KEY"],
    },
    "gemini_2_5_flash": {
        "name": "Gemini 2.5 Flash",
        "device": "cpu_gpu",
        "use_case": "IA multimodal na nuvem (Google Gemini)",
        "implemented": True,
        "kind": "llm",
        "model": "gemini-2.5-flash",
        "requires": ["MINI_BACKEND_GEMINI_API_KEY"],
    },
    "gemini_2_5_pro": {
        "name": "Gemini 2.5 Pro",
        "device": "cpu_gpu",
        "use_case": "IA na nuvem com contexto ampliado (Google Gemini)",
        "implemented": True,
        "kind": "llm",
        "model": "gemini-2.5-pro",
        "requires": ["MINI_BACKEND_GEMINI_API_KEY"],
    },
    "claude_3_5_haiku": {
        "name": "Claude Haiku 4.5",
        "device": "cpu_gpu",
        "use_case": "IA na nuvem (Anthropic Claude)",
        "implemented": True,
        "kind": "llm",
        "model": "claude-haiku-4-5",
        "requires": ["MINI_BACKEND_ANTHROPIC_API_KEY"],
    },
    "claude_3_7_sonnet": {
        "name": "Claude Sonnet 4.6",
        "device": "cpu_gpu",
        "use_case": "IA na nuvem com melhor raciocinio contextual (Anthropic Claude)",
        "implemented": True,
        "kind": "llm",
        "model": "claude-sonnet-4-6",
        "requires": ["MINI_BACKEND_ANTHROPIC_API_KEY"],
    },
    "deepseek_v3": {
        "name": "Deepseek-v3",
        "device": "cpu_gpu",
        "use_case": "Cloud translation via DeepSeek's OpenAI-compatible endpoint.",
        "implemented": True,
        "kind": "llm",
        "model": "deepseek-chat",
        "requires": ["MINI_BACKEND_DEEPSEEK_API_KEY"],
    },
    "grok_2_vision": {
        "name": "Grok 4",
        "device": "cpu_gpu",
        "use_case": "Cloud translation via xAI Grok with an OpenAI-compatible endpoint.",
        "implemented": True,
        "kind": "llm",
        "model": "grok-4",
        "requires": ["MINI_BACKEND_GROK_API_KEY"],
    },
    "z_ai_glm_4_5v": {
        "name": "Z.AI GLM-4.5V",
        "device": "cpu_gpu",
        "use_case": "Multimodal cloud translation via Z.AI.",
        "implemented": True,
        "kind": "llm",
        "model": "glm-4.5v",
        "requires": ["MINI_BACKEND_ZAI_API_KEY"],
    },
}

_TRANSLATOR_MAX_SIZE = 4
_TRANSLATOR_CACHE: OrderedDict[str, BaseTranslator] = OrderedDict()


def _evict_translator_cache() -> None:
    while len(_TRANSLATOR_CACHE) > _TRANSLATOR_MAX_SIZE:
        _TRANSLATOR_CACHE.popitem(last=False)


def clear_translator_cache() -> None:
    _TRANSLATOR_CACHE.clear()


def get_translator_cache_size() -> int:
    return len(_TRANSLATOR_CACHE)


def _has_required_env(required: list[str]) -> bool:
    if not required:
        return True
    for item in required:
        options = [part.strip() for part in str(item).split("|") if part.strip()]
        if not options:
            continue
        if not any((os.getenv(option) or "").strip() for option in options):
            return False
    return True


def _is_available(meta: dict[str, Any]) -> bool:
    if not bool(meta.get("implemented", False)):
        return False
    kind = str(meta.get("kind") or "").strip().lower()
    if kind in {"local_ctranslate2", "local_gguf"}:
        model_key = str(meta.get("key") or "").strip().lower()
        if not model_key:
            return False
        return model_is_installed(model_key) and local_translation_runtime_ready(
            model_key
        )
    return _has_required_env(meta.get("requires", []))


def _build_engine(model_key: str) -> BaseTranslator:
    if model_key == "microsoft_translator":
        return MicrosoftTranslatorEngine()
    if model_key == "yandex_translate":
        return YandexTranslatorEngine()
    if model_key == "deepl":
        return DeepLTranslatorEngine()
    if model_key == "custom":
        return CustomTranslatorEngine()
    if model_key == "sugoi_v4_ja_en_ct2":
        return SugoiLocalTranslator(
            model_dir=resolve_local_translation_model_dir(model_key)
        )
    if model_key == "m2m100_1_2b_ct2":
        return M2M100LocalTranslator(
            model_dir=resolve_local_translation_model_dir(model_key)
        )
    if model_key == "gpt_4_1":
        return OpenAIGPTTranslatorEngine(model_name="gpt-4.1", key=model_key)
    if model_key == "gpt_4_1_mini":
        return OpenAIGPTTranslatorEngine(model_name="gpt-4.1-mini", key=model_key)
    if model_key == "deepseek_v3":
        return OpenAIGPTTranslatorEngine(
            model_name="deepseek-chat",
            key=model_key,
            api_key_envs=("MINI_BACKEND_DEEPSEEK_API_KEY",),
            api_base_envs=("MINI_BACKEND_DEEPSEEK_API_BASE",),
            default_api_base="https://api.deepseek.com/v1",
        )
    if model_key == "gemini_2_5_flash":
        return GeminiTranslatorEngine(model_name="gemini-2.5-flash", key=model_key)
    if model_key == "gemini_2_5_pro":
        return GeminiTranslatorEngine(model_name="gemini-2.5-pro", key=model_key)
    if model_key == "claude_3_5_haiku":
        return ClaudeTranslatorEngine(
            model_name="claude-haiku-4-5", key=model_key
        )
    if model_key == "claude_3_7_sonnet":
        return ClaudeTranslatorEngine(
            model_name="claude-sonnet-4-6", key=model_key
        )
    if model_key == "grok_2_vision":
        return OpenAIGPTTranslatorEngine(
            model_name="grok-4",
            key=model_key,
            api_key_envs=("MINI_BACKEND_GROK_API_KEY",),
            api_base_envs=("MINI_BACKEND_GROK_API_BASE",),
            default_api_base="https://api.x.ai/v1",
        )
    if model_key == "z_ai_glm_4_5v":
        return OpenAIGPTTranslatorEngine(
            model_name="glm-4.5v",
            key=model_key,
            api_key_envs=("MINI_BACKEND_ZAI_API_KEY",),
            api_base_envs=("MINI_BACKEND_ZAI_API_BASE",),
            default_api_base="https://api.z.ai/api/paas/v4",
        )
    if model_key in {
        "vntl_llama3_8b_v2",
        "lfm2_350m_enjp_mt",
        "sakura_galtransl_7b_v3_7",
        "sakura_1_5b_qwen2_5_v1_0",
        "hunyuan_7b_mt_v1_0",
    }:
        return GGUFLocalTranslator(
            model_key=model_key,
            model_dir=resolve_local_translation_model_dir(model_key),
        )
    return GoogleTranslatorEngine()


DEFAULT_TRANSLATION_MODEL = "google_translate"


def get_translation_engine(model_key: str | None = None) -> BaseTranslator:
    selected_key = normalize_stage_model_key(
        "translation",
        (model_key or DEFAULT_TRANSLATION_MODEL).strip() or DEFAULT_TRANSLATION_MODEL,
    )
    meta = TRANSLATION_MODELS.get(selected_key)
    if meta is None or not _is_available({**meta, "key": selected_key}):
        selected_key = DEFAULT_TRANSLATION_MODEL

    cached = _TRANSLATOR_CACHE.get(selected_key)
    if cached is not None:
        _TRANSLATOR_CACHE.move_to_end(selected_key)
        return cached

    engine = _build_engine(selected_key)
    _TRANSLATOR_CACHE[selected_key] = engine
    _evict_translator_cache()
    return engine


def list_translation_models() -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for key, meta in TRANSLATION_MODELS.items():
        meta_with_key = {
            **meta,
            "key": key,
        }
        options.append(
            {
                "key": key,
                "name": meta.get("name", key),
                "device": meta.get("device", "cpu"),
                "use_case": meta.get("use_case", ""),
                "implemented": bool(meta.get("implemented", False)),
                "available": _is_available(meta_with_key),
            }
        )
    return options
