"""Catalog of cloud OCR/CLEAN models. Env-dependent fields resolve lazily at
query time (materialize), never at import — reloading env in tests or changing
MINI_BACKEND_* between boot and first request now behaves correctly."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal, NotRequired, TypedDict

type GeminiUsage = Literal["ocr", "image"]

_RETIRED_GEMINI_IMAGE_MODELS = frozenset(
    {"gemini-2.5-flash-image-preview", "gemini-2.5-flash-image"}
)
_GEMINI_REPLACEMENT: Mapping[GeminiUsage, str] = {
    "ocr": "gemini-2.5-flash",
    "image": "gemini-3.1-flash-image-preview",
}


def get_env_value(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name, "").strip() if name else ""
        if value:
            return value
    return default


def _normalize_gemini_model_name(model_name: str, *, usage: GeminiUsage) -> str:
    normalized = model_name.strip()
    if normalized.lower() in _RETIRED_GEMINI_IMAGE_MODELS:
        return _GEMINI_REPLACEMENT[usage]
    return normalized


class CloudModelSpec(TypedDict):
    key: str
    name: str
    device: Literal["cloud"]
    languages: list[str]
    use_case: str
    implemented: bool
    provider: str
    model: NotRequired[str]
    api_key_envs: NotRequired[tuple[str, ...]]
    api_base_envs: NotRequired[tuple[str, ...]]
    default_api_base: NotRequired[str]
    request_config_required: NotRequired[bool]


class CloudModelListing(TypedDict):
    key: str
    name: str
    device: Literal["cloud"]
    languages: list[str]
    use_case: str
    implemented: bool
    available: bool


@dataclass(frozen=True, slots=True)
class _ProviderAccount:
    api_key_env: str
    api_base_env: str
    default_api_base: str


_OPENAI = _ProviderAccount(
    "MINI_BACKEND_OPENAI_API_KEY", "MINI_BACKEND_OPENAI_API_BASE", "https://api.openai.com/v1"
)
_GEMINI = _ProviderAccount(
    "MINI_BACKEND_GEMINI_API_KEY",
    "MINI_BACKEND_GEMINI_API_BASE",
    "https://generativelanguage.googleapis.com/v1beta/models",
)
_GOOGLE_VISION = _ProviderAccount(
    "MINI_BACKEND_GOOGLE_CLOUD_VISION_API_KEY",
    "MINI_BACKEND_GOOGLE_CLOUD_VISION_API_BASE",
    "https://vision.googleapis.com/v1",
)
_MICROSOFT_VISION = _ProviderAccount(
    "MINI_BACKEND_MICROSOFT_VISION_API_KEY", "MINI_BACKEND_MICROSOFT_VISION_API_BASE", ""
)
_GROK = _ProviderAccount(
    "MINI_BACKEND_GROK_API_KEY", "MINI_BACKEND_GROK_API_BASE", "https://api.x.ai/v1"
)
_ZAI = _ProviderAccount(
    "MINI_BACKEND_ZAI_API_KEY", "MINI_BACKEND_ZAI_API_BASE", "https://api.z.ai/api/paas/v4"
)


@dataclass(frozen=True, slots=True)
class _CloudModelDefinition:
    """Static catalog entry; env-dependent fields resolve in ``materialize``."""

    key: str
    name: str
    use_case: str
    provider: str
    account: _ProviderAccount | None = None
    model_env: str | None = None
    model_default: str = ""
    gemini_usage: GeminiUsage | None = None
    request_config_required: bool = False

    def is_available(self) -> bool:
        if self.request_config_required or self.account is None:
            return True
        return bool(get_env_value(self.account.api_key_env))

    def materialize(self) -> CloudModelSpec:
        spec: CloudModelSpec = {
            "key": self.key,
            "name": self.name,
            "device": "cloud",
            "languages": ["multi"],
            "use_case": self.use_case,
            "implemented": True,
            "provider": self.provider,
        }
        if self.model_env is not None:
            model = get_env_value(self.model_env, default=self.model_default)
            if self.gemini_usage is not None:
                model = _normalize_gemini_model_name(model, usage=self.gemini_usage)
            spec["model"] = model
        if self.account is not None:
            spec["api_key_envs"] = (self.account.api_key_env,)
            spec["api_base_envs"] = (self.account.api_base_env,)
            spec["default_api_base"] = self.account.default_api_base
        if self.request_config_required:
            spec["request_config_required"] = True
        return spec


# Keys are wire-stable identifiers shared with the frontend; several predate
# the models they now point to (gemini_2_0_* → 2.5, grok_2_* → Grok 4).
_OCR_DEFINITIONS: tuple[_CloudModelDefinition, ...] = (
    _CloudModelDefinition(
        "gpt_4_1_mini_ocr", "GPT-4.1-mini OCR", "OCR multimodal via OpenAI GPT.",
        "openai_compatible_vision", _OPENAI, "MINI_BACKEND_OPENAI_OCR_MODEL", "gpt-4.1-mini",
    ),
    _CloudModelDefinition(
        "gemini_2_0_flash_ocr", "Gemini-2.5-Flash OCR", "OCR multimodal via Gemini 2.5 Flash.",
        "gemini_vision", _GEMINI, "MINI_BACKEND_GEMINI_OCR_MODEL", "gemini-2.5-flash",
        gemini_usage="ocr",
    ),
    _CloudModelDefinition(
        "google_cloud_vision", "Google OCR", "OCR via Google Cloud Vision.",
        "google_cloud_vision", _GOOGLE_VISION,
    ),
    _CloudModelDefinition(
        "microsoft_vision", "Microsoft OCR", "OCR via Azure AI Vision.",
        "microsoft_vision", _MICROSOFT_VISION,
    ),
    _CloudModelDefinition(
        "grok_2_vision_ocr", "Grok-4 OCR", "OCR multimodal via xAI Grok 4.",
        "openai_compatible_vision", _GROK, "MINI_BACKEND_GROK_OCR_MODEL", "grok-4",
    ),
    _CloudModelDefinition(
        "z_ai_glm_4_5v_ocr", "Z.AI GLM-4.5V OCR", "OCR multimodal via Z.AI.",
        "openai_compatible_vision", _ZAI, "MINI_BACKEND_ZAI_OCR_MODEL", "glm-4.5v",
    ),
    _CloudModelDefinition(
        "custom_ocr", "Custom AI OCR", "OCR multimodal via endpoint custom OpenAI-compatible.",
        "custom_openai_compatible_vision", request_config_required=True,
    ),
)

_CLEAN_DEFINITIONS: tuple[_CloudModelDefinition, ...] = (
    _CloudModelDefinition(
        "gpt_4_1_mini_ocr", "GPT-4.1-mini OCR",
        "Multimodal automatic cleaning via OpenAI using the same vision catalog as OCR.",
        "openai_compatible_image", _OPENAI, "MINI_BACKEND_OPENAI_OCR_MODEL", "gpt-4.1-mini",
    ),
    _CloudModelDefinition(
        "gemini_2_0_flash_ocr", "Gemini-2.5-Flash Clean",
        "Multimodal automatic cleaning via Gemini with the current image model.",
        "gemini_image", _GEMINI, "MINI_BACKEND_GEMINI_IMAGE_CLEAN_MODEL",
        "gemini-3.1-flash-image-preview", gemini_usage="image",
    ),
    _CloudModelDefinition(
        "grok_2_vision_ocr", "Grok-4 OCR", "Multimodal automatic cleaning via xAI Grok 4.",
        "openai_compatible_image", _GROK, "MINI_BACKEND_GROK_OCR_MODEL", "grok-4",
    ),
    _CloudModelDefinition(
        "z_ai_glm_4_5v_ocr", "Z.AI GLM-4.5V OCR", "Multimodal automatic cleaning via Z.AI.",
        "openai_compatible_image", _ZAI, "MINI_BACKEND_ZAI_OCR_MODEL", "glm-4.5v",
    ),
    _CloudModelDefinition(
        "custom_clean", "AI Custom",
        "Automatic cleaning via a custom OpenAI-compatible or Gemini endpoint.",
        "custom_image", request_config_required=True,
    ),
)

_OCR_BY_KEY: Mapping[str, _CloudModelDefinition] = {d.key: d for d in _OCR_DEFINITIONS}
_CLEAN_BY_KEY: Mapping[str, _CloudModelDefinition] = {d.key: d for d in _CLEAN_DEFINITIONS}


def list_cloud_ocr_models() -> list[CloudModelListing]:
    return [
        {
            "key": d.key,
            "name": d.name,
            "device": "cloud",
            "languages": ["multi"],
            "use_case": d.use_case,
            "implemented": True,
            "available": d.is_available(),
        }
        for d in _OCR_DEFINITIONS
    ]


def _lookup(
    registry: Mapping[str, _CloudModelDefinition],
    model_key: str,
    *,
    custom_key: str,
) -> CloudModelSpec | None:
    if model_key.startswith(f"{custom_key}:"):
        spec = registry[custom_key].materialize()
        spec["key"] = model_key
        return spec
    definition = registry.get(model_key)
    return definition.materialize() if definition is not None else None


def get_ocr_model_spec(model_key: str) -> CloudModelSpec | None:
    return _lookup(_OCR_BY_KEY, model_key, custom_key="custom_ocr")


def get_clean_model_spec(model_key: str) -> CloudModelSpec | None:
    return _lookup(_CLEAN_BY_KEY, model_key, custom_key="custom_clean")
