from __future__ import annotations

import os
from collections import OrderedDict
from collections.abc import Callable
from typing import NotRequired, TypedDict

from core.config import normalize_stage_model_key
from core.device import register_gpu_cache_releaser
from core.models_store import model_is_installed
from models.translation.base_translator import BaseTranslator
from models.translation.errors import TranslatorConfigurationError
from models.translation.local_ctranslate2 import M2M100LocalTranslator, SugoiLocalTranslator
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


class TranslationModelMeta(TypedDict):
    name: str
    device: str
    use_case: str
    implemented: bool
    kind: str
    requires: list[str]
    model: NotRequired[str]


class TranslationModelOption(TypedDict):
    key: str
    name: str
    device: str
    use_case: str
    implemented: bool
    available: bool


DEFAULT_TRANSLATION_MODEL = "google_translate"
_LOCAL_KINDS = frozenset({"local_ctranslate2", "local_gguf"})

TRANSLATION_MODELS: dict[str, TranslationModelMeta] = {
    "google_translate": {
        "name": "Google Translate", "device": "cpu",
        "use_case": "Free machine translation (no API key)",
        "implemented": True, "kind": "traditional", "requires": [],
    },
    "microsoft_translator": {
        "name": "Microsoft Translator", "device": "cpu",
        "use_case": "Translation via Azure Translator (free/paid plan)",
        "implemented": True, "kind": "traditional",
        "requires": ["MINI_BACKEND_MS_TRANSLATOR_KEY", "MINI_BACKEND_MS_TRANSLATOR_REGION"],
    },
    "yandex_translate": {
        "name": "Yandex Translate", "device": "cpu",
        "use_case": "Translation via Yandex Cloud Translate",
        "implemented": True, "kind": "traditional",
        "requires": ["MINI_BACKEND_YANDEX_API_KEY", "MINI_BACKEND_YANDEX_FOLDER_ID"],
    },
    "deepl": {
        "name": "DeepL", "device": "cpu",
        "use_case": "Translation with the DeepL API (Free/Pro)",
        "implemented": True, "kind": "traditional", "requires": ["MINI_BACKEND_DEEPL_API_KEY"],
    },
    "custom": {
        "name": "Custom", "device": "cpu",
        "use_case": "Endpoint custom (OpenAI-compatible ou API propria)",
        "implemented": True, "kind": "custom", "requires": [],
    },
    "sugoi_v4_ja_en_ct2": {
        "name": "Sugoi v4 JA→EN (CT2)", "device": "cpu_gpu",
        "use_case": "Offline local Japanese translation via CTranslate2.",
        "implemented": True, "kind": "local_ctranslate2", "requires": [],
    },
    "m2m100_1_2b_ct2": {
        "name": "M2M100 1.2B (CT2)", "device": "cpu_gpu",
        "use_case": "Local multi-language translation via CTranslate2.",
        "implemented": True, "kind": "local_ctranslate2", "requires": [],
    },
    "vntl_llama3_8b_v2": {
        "name": "VNTL Llama3 8B v2", "device": "cpu_gpu",
        "use_case": "High-quality local JA->EN translation via GGUF (~8.5GB Q8_0).",
        "implemented": True, "kind": "local_gguf", "requires": [],
    },
    "lfm2_350m_enjp_mt": {
        "name": "LFM2 350M EN-JP MT", "device": "cpu_gpu",
        "use_case": "Lightweight local JA->EN translation via GGUF (~400MB). Good for CPU.",
        "implemented": True, "kind": "local_gguf", "requires": [],
    },
    "sakura_galtransl_7b_v3_7": {
        "name": "Sakura GalTransl 7B v3.7", "device": "cpu_gpu",
        "use_case": "Local JA->ZH-CN translation via GGUF (~6.3GB).",
        "implemented": True, "kind": "local_gguf", "requires": [],
    },
    "sakura_1_5b_qwen2_5_v1_0": {
        "name": "Sakura 1.5B Qwen2.5 v1.0", "device": "cpu_gpu",
        "use_case": "Lightweight local JA->ZH-CN translation via GGUF (~1.5GB).",
        "implemented": True, "kind": "local_gguf", "requires": [],
    },
    "hunyuan_7b_mt_v1_0": {
        "name": "Hunyuan MT 7B v1.0", "device": "cpu_gpu",
        "use_case": "Local multilingual translation (44 languages) via GGUF (~6.3GB).",
        "implemented": True, "kind": "local_gguf", "requires": [],
    },
    "gpt_4_1": {
        "name": "GPT-4.1", "device": "cpu_gpu",
        "use_case": "Cloud AI for contextual translation",
        "implemented": True, "kind": "llm", "model": "gpt-4.1",
        "requires": ["MINI_BACKEND_OPENAI_API_KEY"],
    },
    "gpt_4_1_mini": {
        "name": "GPT-4.1-mini", "device": "cpu_gpu",
        "use_case": "IA na nuvem com menor custo/latencia",
        "implemented": True, "kind": "llm", "model": "gpt-4.1-mini",
        "requires": ["MINI_BACKEND_OPENAI_API_KEY"],
    },
    "gemini_2_5_flash": {
        "name": "Gemini 2.5 Flash", "device": "cpu_gpu",
        "use_case": "IA multimodal na nuvem (Google Gemini)",
        "implemented": True, "kind": "llm", "model": "gemini-2.5-flash",
        "requires": ["MINI_BACKEND_GEMINI_API_KEY"],
    },
    "gemini_2_5_pro": {
        "name": "Gemini 2.5 Pro", "device": "cpu_gpu",
        "use_case": "IA na nuvem com contexto ampliado (Google Gemini)",
        "implemented": True, "kind": "llm", "model": "gemini-2.5-pro",
        "requires": ["MINI_BACKEND_GEMINI_API_KEY"],
    },
    "claude_3_5_haiku": {
        "name": "Claude Haiku 4.5", "device": "cpu_gpu",
        "use_case": "IA na nuvem (Anthropic Claude)",
        "implemented": True, "kind": "llm", "model": "claude-haiku-4-5",
        "requires": ["MINI_BACKEND_ANTHROPIC_API_KEY"],
    },
    "claude_3_7_sonnet": {
        "name": "Claude Sonnet 4.6", "device": "cpu_gpu",
        "use_case": "IA na nuvem com melhor raciocinio contextual (Anthropic Claude)",
        "implemented": True, "kind": "llm", "model": "claude-sonnet-4-6",
        "requires": ["MINI_BACKEND_ANTHROPIC_API_KEY"],
    },
    "deepseek_v3": {
        "name": "Deepseek-v3", "device": "cpu_gpu",
        "use_case": "Cloud translation via DeepSeek's OpenAI-compatible endpoint.",
        "implemented": True, "kind": "llm", "model": "deepseek-chat",
        "requires": ["MINI_BACKEND_DEEPSEEK_API_KEY"],
    },
    "grok_2_vision": {
        "name": "Grok 4", "device": "cpu_gpu",
        "use_case": "Cloud translation via xAI Grok with an OpenAI-compatible endpoint.",
        "implemented": True, "kind": "llm", "model": "grok-4",
        "requires": ["MINI_BACKEND_GROK_API_KEY"],
    },
    "z_ai_glm_4_5v": {
        "name": "Z.AI GLM-4.5V", "device": "cpu_gpu",
        "use_case": "Multimodal cloud translation via Z.AI.",
        "implemented": True, "kind": "llm", "model": "glm-4.5v",
        "requires": ["MINI_BACKEND_ZAI_API_KEY"],
    },
}

type EngineBuilder = Callable[[str], BaseTranslator]


def _openai(model_name: str) -> EngineBuilder:
    return lambda key: OpenAIGPTTranslatorEngine(model_name=model_name, key=key)


def _openai_compatible(
    model_name: str, *, api_key_env: str, api_base_env: str, default_api_base: str
) -> EngineBuilder:
    return lambda key: OpenAIGPTTranslatorEngine(
        model_name=model_name,
        key=key,
        api_key_envs=(api_key_env,),
        api_base_envs=(api_base_env,),
        default_api_base=default_api_base,
    )


def _gemini(model_name: str) -> EngineBuilder:
    return lambda key: GeminiTranslatorEngine(model_name=model_name, key=key)


def _claude(model_name: str) -> EngineBuilder:
    return lambda key: ClaudeTranslatorEngine(model_name=model_name, key=key)


def _gguf(key: str) -> BaseTranslator:
    return GGUFLocalTranslator(model_key=key, model_dir=resolve_local_translation_model_dir(key))


_ENGINE_BUILDERS: dict[str, EngineBuilder] = {
    "google_translate": lambda _key: GoogleTranslatorEngine(),
    "microsoft_translator": lambda _key: MicrosoftTranslatorEngine(),
    "yandex_translate": lambda _key: YandexTranslatorEngine(),
    "deepl": lambda _key: DeepLTranslatorEngine(),
    "custom": lambda _key: CustomTranslatorEngine(),
    "sugoi_v4_ja_en_ct2": lambda key: SugoiLocalTranslator(
        model_dir=resolve_local_translation_model_dir(key)
    ),
    "m2m100_1_2b_ct2": lambda key: M2M100LocalTranslator(
        model_dir=resolve_local_translation_model_dir(key)
    ),
    "vntl_llama3_8b_v2": _gguf,
    "lfm2_350m_enjp_mt": _gguf,
    "sakura_galtransl_7b_v3_7": _gguf,
    "sakura_1_5b_qwen2_5_v1_0": _gguf,
    "hunyuan_7b_mt_v1_0": _gguf,
    "gpt_4_1": _openai("gpt-4.1"),
    "gpt_4_1_mini": _openai("gpt-4.1-mini"),
    "gemini_2_5_flash": _gemini("gemini-2.5-flash"),
    "gemini_2_5_pro": _gemini("gemini-2.5-pro"),
    "claude_3_5_haiku": _claude("claude-haiku-4-5"),
    "claude_3_7_sonnet": _claude("claude-sonnet-4-6"),
    "deepseek_v3": _openai_compatible(
        "deepseek-chat",
        api_key_env="MINI_BACKEND_DEEPSEEK_API_KEY",
        api_base_env="MINI_BACKEND_DEEPSEEK_API_BASE",
        default_api_base="https://api.deepseek.com/v1",
    ),
    "grok_2_vision": _openai_compatible(
        "grok-4",
        api_key_env="MINI_BACKEND_GROK_API_KEY",
        api_base_env="MINI_BACKEND_GROK_API_BASE",
        default_api_base="https://api.x.ai/v1",
    ),
    "z_ai_glm_4_5v": _openai_compatible(
        "glm-4.5v",
        api_key_env="MINI_BACKEND_ZAI_API_KEY",
        api_base_env="MINI_BACKEND_ZAI_API_BASE",
        default_api_base="https://api.z.ai/api/paas/v4",
    ),
}

_unbuildable = TRANSLATION_MODELS.keys() ^ _ENGINE_BUILDERS.keys()
if _unbuildable:
    raise TranslatorConfigurationError(
        f"Translation registry and engine builders diverge: {sorted(_unbuildable)}"
    )

_TRANSLATOR_MAX_SIZE = 4
_TRANSLATOR_CACHE: OrderedDict[str, BaseTranslator] = OrderedDict()


@register_gpu_cache_releaser
def clear_translator_cache() -> None:
    _TRANSLATOR_CACHE.clear()


def get_translator_cache_size() -> int:
    return len(_TRANSLATOR_CACHE)


def _has_required_env(required: list[str]) -> bool:
    for item in required:
        options = [part.strip() for part in item.split("|") if part.strip()]
        if options and not any(os.getenv(option, "").strip() for option in options):
            return False
    return True


def _is_available(key: str, meta: TranslationModelMeta) -> bool:
    if not meta["implemented"]:
        return False
    if meta["kind"] in _LOCAL_KINDS:
        return model_is_installed(key) and local_translation_runtime_ready(key)
    return _has_required_env(meta["requires"])


def get_translation_engine(model_key: str | None = None) -> BaseTranslator:
    requested = (model_key or "").strip() or DEFAULT_TRANSLATION_MODEL
    selected_key = normalize_stage_model_key("translation", requested)
    meta = TRANSLATION_MODELS.get(selected_key)
    if meta is None or not _is_available(selected_key, meta):
        selected_key = DEFAULT_TRANSLATION_MODEL

    cached = _TRANSLATOR_CACHE.get(selected_key)
    if cached is not None:
        _TRANSLATOR_CACHE.move_to_end(selected_key)
        return cached

    engine = _ENGINE_BUILDERS[selected_key](selected_key)
    _TRANSLATOR_CACHE[selected_key] = engine
    while len(_TRANSLATOR_CACHE) > _TRANSLATOR_MAX_SIZE:
        _TRANSLATOR_CACHE.popitem(last=False)
    return engine


def list_translation_models() -> list[TranslationModelOption]:
    return [
        {
            "key": key,
            "name": meta["name"],
            "device": meta["device"],
            "use_case": meta["use_case"],
            "implemented": meta["implemented"],
            "available": _is_available(key, meta),
        }
        for key, meta in TRANSLATION_MODELS.items()
    ]
