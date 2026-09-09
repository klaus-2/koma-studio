from __future__ import annotations

from copy import deepcopy
import os
from typing import Any


def _normalize_gemini_model_name(model_name: str, *, usage: str) -> str:
    normalized = str(model_name or "").strip()
    if not normalized:
        return normalized

    lowered = normalized.lower()
    if usage == "ocr":
        if lowered in {
            "gemini-2.5-flash-image-preview",
            "gemini-2.5-flash-image",
        }:
            return "gemini-2.5-flash"
        return normalized

    if usage == "image":
        if lowered in {
            "gemini-2.5-flash-image-preview",
            "gemini-2.5-flash-image",
        }:
            return "gemini-3.1-flash-image-preview"
        return normalized

    return normalized


def get_env_value(*names: str, default: str = "") -> str:
    for name in names:
        value = name and os.getenv(name)
        if value and str(value).strip():
            return str(value).strip()
    return default


OCR_CLOUD_MODELS: dict[str, dict[str, Any]] = {
    "gpt_4_1_mini_ocr": {
        "key": "gpt_4_1_mini_ocr",
        "name": "GPT-4.1-mini OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "OCR multimodal via OpenAI GPT.",
        "implemented": True,
        "provider": "openai_compatible_vision",
        "model": get_env_value(
            "MINI_BACKEND_OPENAI_OCR_MODEL",
            default="gpt-4.1-mini",
        ),
        "api_key_envs": ("MINI_BACKEND_OPENAI_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_OPENAI_API_BASE",),
        "default_api_base": "https://api.openai.com/v1",
    },
    "gemini_2_0_flash_ocr": {
        "key": "gemini_2_0_flash_ocr",
        "name": "Gemini-2.5-Flash OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "OCR multimodal via Gemini 2.5 Flash.",
        "implemented": True,
        "provider": "gemini_vision",
        "model": _normalize_gemini_model_name(
            get_env_value(
                "MINI_BACKEND_GEMINI_OCR_MODEL",
                default="gemini-2.5-flash",
            ),
            usage="ocr",
        ),
        "api_key_envs": ("MINI_BACKEND_GEMINI_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_GEMINI_API_BASE",),
        "default_api_base": "https://generativelanguage.googleapis.com/v1beta/models",
    },
    "google_cloud_vision": {
        "key": "google_cloud_vision",
        "name": "Google OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "OCR via Google Cloud Vision.",
        "implemented": True,
        "provider": "google_cloud_vision",
        "api_key_envs": ("MINI_BACKEND_GOOGLE_CLOUD_VISION_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_GOOGLE_CLOUD_VISION_API_BASE",),
        "default_api_base": "https://vision.googleapis.com/v1",
    },
    "microsoft_vision": {
        "key": "microsoft_vision",
        "name": "Microsoft OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "OCR via Azure AI Vision.",
        "implemented": True,
        "provider": "microsoft_vision",
        "api_key_envs": ("MINI_BACKEND_MICROSOFT_VISION_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_MICROSOFT_VISION_API_BASE",),
        "default_api_base": "",
    },
    "grok_2_vision_ocr": {
        "key": "grok_2_vision_ocr",
        "name": "Grok-4 OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "OCR multimodal via xAI Grok 4.",
        "implemented": True,
        "provider": "openai_compatible_vision",
        "model": get_env_value(
            "MINI_BACKEND_GROK_OCR_MODEL",
            default="grok-4",
        ),
        "api_key_envs": ("MINI_BACKEND_GROK_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_GROK_API_BASE",),
        "default_api_base": "https://api.x.ai/v1",
    },
    "z_ai_glm_4_5v_ocr": {
        "key": "z_ai_glm_4_5v_ocr",
        "name": "Z.AI GLM-4.5V OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "OCR multimodal via Z.AI.",
        "implemented": True,
        "provider": "openai_compatible_vision",
        "model": get_env_value(
            "MINI_BACKEND_ZAI_OCR_MODEL", default="glm-4.5v"
        ),
        "api_key_envs": ("MINI_BACKEND_ZAI_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_ZAI_API_BASE",),
        "default_api_base": "https://api.z.ai/api/paas/v4",
    },
    "custom_ocr": {
        "key": "custom_ocr",
        "name": "Custom AI OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "OCR multimodal via endpoint custom OpenAI-compatible.",
        "implemented": True,
        "provider": "custom_openai_compatible_vision",
        "request_config_required": True,
    },
}

CLEAN_CLOUD_MODELS: dict[str, dict[str, Any]] = {
    "gpt_4_1_mini_ocr": {
        "key": "gpt_4_1_mini_ocr",
        "name": "GPT-4.1-mini OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "Multimodal automatic cleaning via OpenAI using the same vision catalog as OCR.",
        "implemented": True,
        "provider": "openai_compatible_image",
        "model": get_env_value(
            "MINI_BACKEND_OPENAI_OCR_MODEL",
            default="gpt-4.1-mini",
        ),
        "api_key_envs": ("MINI_BACKEND_OPENAI_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_OPENAI_API_BASE",),
        "default_api_base": "https://api.openai.com/v1",
    },
    "gemini_2_0_flash_ocr": {
        "key": "gemini_2_0_flash_ocr",
        "name": "Gemini-2.5-Flash Clean",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "Multimodal automatic cleaning via Gemini with the current image model.",
        "implemented": True,
        "provider": "gemini_image",
        "model": _normalize_gemini_model_name(
            get_env_value(
                "MINI_BACKEND_GEMINI_IMAGE_CLEAN_MODEL",
                default="gemini-3.1-flash-image-preview",
            ),
            usage="image",
        ),
        "api_key_envs": ("MINI_BACKEND_GEMINI_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_GEMINI_API_BASE",),
        "default_api_base": "https://generativelanguage.googleapis.com/v1beta/models",
    },
    "grok_2_vision_ocr": {
        "key": "grok_2_vision_ocr",
        "name": "Grok-4 OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "Multimodal automatic cleaning via xAI Grok 4.",
        "implemented": True,
        "provider": "openai_compatible_image",
        "model": get_env_value(
            "MINI_BACKEND_GROK_OCR_MODEL",
            default="grok-4",
        ),
        "api_key_envs": ("MINI_BACKEND_GROK_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_GROK_API_BASE",),
        "default_api_base": "https://api.x.ai/v1",
    },
    "z_ai_glm_4_5v_ocr": {
        "key": "z_ai_glm_4_5v_ocr",
        "name": "Z.AI GLM-4.5V OCR",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "Multimodal automatic cleaning via Z.AI.",
        "implemented": True,
        "provider": "openai_compatible_image",
        "model": get_env_value(
            "MINI_BACKEND_ZAI_OCR_MODEL", default="glm-4.5v"
        ),
        "api_key_envs": ("MINI_BACKEND_ZAI_API_KEY",),
        "api_base_envs": ("MINI_BACKEND_ZAI_API_BASE",),
        "default_api_base": "https://api.z.ai/api/paas/v4",
    },
    "custom_clean": {
        "key": "custom_clean",
        "name": "AI Custom",
        "device": "cloud",
        "languages": ["multi"],
        "use_case": "Automatic cleaning via a custom OpenAI-compatible or Gemini endpoint.",
        "implemented": True,
        "provider": "custom_image",
        "request_config_required": True,
    },
}


def _is_available(meta: dict[str, Any]) -> bool:
    if not bool(meta.get("implemented", False)):
        return False
    if meta.get("request_config_required"):
        return True
    env_names = tuple(
        str(item) for item in meta.get("api_key_envs", ()) if str(item).strip()
    )
    return bool(get_env_value(*env_names)) if env_names else True


def list_cloud_ocr_models() -> list[dict[str, Any]]:
    return [
        {
            "key": key,
            "name": meta.get("name", key),
            "device": meta.get("device", "cloud"),
            "languages": meta.get("languages", ["multi"]),
            "use_case": meta.get("use_case", ""),
            "implemented": bool(meta.get("implemented", False)),
            "available": _is_available(meta),
        }
        for key, meta in OCR_CLOUD_MODELS.items()
    ]


def get_ocr_model_spec(model_key: str) -> dict[str, Any] | None:
    if model_key.startswith("custom_ocr:"):
        spec = deepcopy(OCR_CLOUD_MODELS["custom_ocr"])
        spec["key"] = model_key
        return spec
    spec = OCR_CLOUD_MODELS.get(model_key)
    return deepcopy(spec) if spec else None


def get_clean_model_spec(model_key: str) -> dict[str, Any] | None:
    if model_key.startswith("custom_clean:"):
        spec = deepcopy(CLEAN_CLOUD_MODELS["custom_clean"])
        spec["key"] = model_key
        return spec
    spec = CLEAN_CLOUD_MODELS.get(model_key)
    return deepcopy(spec) if spec else None
