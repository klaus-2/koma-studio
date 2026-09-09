from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import json
import os
import re


_MODEL_NAME_PATTERN = re.compile(r"[^a-z0-9]+")


TRANSLATOR_MODEL_ALIASES: dict[str, str] = {
    "gpt_4o": "gpt_4_1",
    "gpt_4o_mini": "gpt_4_1_mini",
    "gemini_2_0_flash": "gemini_2_5_flash",
    "gemini_2_0_pro": "gemini_2_5_flash",
    "gemini_2_5_pro": "gemini_2_5_pro",
    "claude_3_opus": "claude_3_7_sonnet",
    "claude_3_7_sonnet": "claude_3_7_sonnet",
    "claude_3_5_haiku": "claude_3_5_haiku",
    "deepseek_v3": "deepseek_v3",
    "gpt_4_1": "gpt_4_1",
    "gpt_4_1_mini": "gpt_4_1_mini",
    "gemini_2_5_flash": "gemini_2_5_flash",
    "grok_2_vision": "grok_2_vision",
    "z_ai_glm_4_5v": "z_ai_glm_4_5v",
    "custom": "custom",
}

OCR_MODEL_ALIASES: dict[str, str] = {
    "gpt_4o": "gpt_4_1_mini_ocr",
    "gemini_2_5_flash": "gemini_2_0_flash_ocr",
    "gpt_4_1_mini": "gpt_4_1_mini_ocr",
    "gpt_4_1_mini_ocr": "gpt_4_1_mini_ocr",
    "gemini_2_0_flash": "gemini_2_0_flash_ocr",
    "gemini_2_0_flash_ocr": "gemini_2_0_flash_ocr",
    "google_cloud_vision": "google_cloud_vision",
    "google_ocr": "google_cloud_vision",
    "microsoft_ocr": "microsoft_vision",
    "microsoft_vision": "microsoft_vision",
    "grok_2_vision": "grok_2_vision_ocr",
    "grok_2_vision_ocr": "grok_2_vision_ocr",
    "z_ai_glm_4_5v": "z_ai_glm_4_5v_ocr",
    "z_ai_glm_4_5v_ocr": "z_ai_glm_4_5v_ocr",
    "custom_ocr": "custom_ocr",
}

CLEAN_MODEL_ALIASES: dict[str, str] = {
    "gpt_4_1_mini_ocr": "gpt_4_1_mini_ocr",
    "gemini_2_0_flash_ocr": "gemini_2_0_flash_ocr",
    "grok_2_vision_ocr": "grok_2_vision_ocr",
    "z_ai_glm_4_5v_ocr": "z_ai_glm_4_5v_ocr",
    "custom_clean": "custom_clean",
}


def _slugify_model_name(value: str | None) -> str:
    normalized = (value or "").strip().lower().replace("/", "_")
    normalized = _MODEL_NAME_PATTERN.sub("_", normalized)
    return re.sub(r"_+", "_", normalized).strip("_")


def normalize_stage_model_key(stage: str, value: str | None) -> str:
    raw = (value or "").strip()
    if raw.startswith(("custom:", "custom_ocr:", "custom_clean:")):
        return raw

    slug = _slugify_model_name(raw)
    if stage == "ocr":
        return OCR_MODEL_ALIASES.get(slug, slug)
    if stage == "clean":
        return CLEAN_MODEL_ALIASES.get(slug, slug)
    return TRANSLATOR_MODEL_ALIASES.get(slug, slug)


def _as_float(
    value: str | None, fallback: float, minimum: float, maximum: float
) -> float:
    if value is None:
        return fallback
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(parsed, maximum))


def _as_int(value: str | None, fallback: int, minimum: int, maximum: int) -> int:
    if value is None:
        return fallback
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return max(minimum, min(parsed, maximum))


@dataclass(frozen=True)
class MiniBackendConfig:
    environment: str
    default_detection_model: str
    detection_conf_threshold: float
    detection_nms_threshold: float
    detection_input_size: int
    pipeline_cache_ttl_seconds: int
    pipeline_cache_max_entries: int
    pipeline_cache_bbox_tolerance_px: float
    batch_default_concurrency: int
    batch_max_concurrency: int
    batch_max_images: int


@dataclass(frozen=True)
class LLMRequestSettings:
    extra_context: str = ""
    image_input_enabled: bool = True
    temperature: float = 0.2
    top_p: float = 0.95
    max_tokens: int = 4096
    translation_notes_enabled: bool = True
    neighbor_image_context_enabled: bool = False


def clamp_llm_request_settings(
    value: str | dict[str, object] | None,
) -> LLMRequestSettings:
    raw: dict[str, object] = {}
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            parsed = {}
        if isinstance(parsed, dict):
            raw = parsed
    elif isinstance(value, dict):
        raw = value

    extra_context = str(raw.get("extra_context") or "").strip()
    image_input_enabled = bool(raw.get("image_input_enabled", True))
    translation_notes_enabled = bool(raw.get("translation_notes_enabled", True))
    neighbor_image_context_enabled = bool(
        raw.get("neighbor_image_context_enabled", False)
    )
    temperature = _as_float(
        str(raw.get("temperature")) if raw.get("temperature") is not None else None,
        0.2,
        0.0,
        2.0,
    )
    top_p = _as_float(
        str(raw.get("top_p")) if raw.get("top_p") is not None else None, 0.95, 0.0, 1.0
    )
    max_tokens = _as_int(
        str(raw.get("max_tokens")) if raw.get("max_tokens") is not None else None,
        4096,
        128,
        8192,
    )

    return LLMRequestSettings(
        extra_context=extra_context,
        image_input_enabled=image_input_enabled,
        temperature=temperature,
        top_p=top_p,
        max_tokens=max_tokens,
        translation_notes_enabled=translation_notes_enabled,
        neighbor_image_context_enabled=neighbor_image_context_enabled,
    )


@lru_cache(maxsize=1)
def get_config() -> MiniBackendConfig:
    return MiniBackendConfig(
        environment=os.getenv("NODE_ENV", "development"),
        default_detection_model=os.getenv(
            "MINI_BACKEND_DETECTION_MODEL", "font_rtdetr_v2"
        ),
        detection_conf_threshold=_as_float(
            os.getenv("MINI_BACKEND_DETECTION_CONF"),
            fallback=0.35,
            minimum=0.01,
            maximum=0.99,
        ),
        detection_nms_threshold=_as_float(
            os.getenv("MINI_BACKEND_DETECTION_NMS"),
            fallback=0.45,
            minimum=0.01,
            maximum=0.99,
        ),
        detection_input_size=_as_int(
            os.getenv("MINI_BACKEND_DETECTION_SIZE"),
            fallback=512,
            minimum=128,
            maximum=2048,
        ),
        pipeline_cache_ttl_seconds=_as_int(
            os.getenv("MINI_BACKEND_PIPELINE_CACHE_TTL_SECONDS"),
            fallback=1800,
            minimum=30,
            maximum=86400,
        ),
        pipeline_cache_max_entries=_as_int(
            os.getenv("MINI_BACKEND_PIPELINE_CACHE_MAX_ENTRIES"),
            fallback=256,
            minimum=1,
            maximum=50000,
        ),
        pipeline_cache_bbox_tolerance_px=_as_float(
            os.getenv("MINI_BACKEND_PIPELINE_CACHE_BBOX_TOLERANCE_PX"),
            fallback=5.0,
            minimum=0.0,
            maximum=100.0,
        ),
        batch_default_concurrency=_as_int(
            os.getenv("MINI_BACKEND_BATCH_DEFAULT_CONCURRENCY"),
            fallback=1,
            minimum=1,
            maximum=32,
        ),
        batch_max_concurrency=_as_int(
            os.getenv("MINI_BACKEND_BATCH_MAX_CONCURRENCY"),
            fallback=4,
            minimum=1,
            maximum=64,
        ),
        batch_max_images=_as_int(
            os.getenv("MINI_BACKEND_BATCH_MAX_IMAGES"),
            fallback=20,
            minimum=1,
            maximum=200,
        ),
    )
