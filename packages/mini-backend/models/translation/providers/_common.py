from __future__ import annotations

import os
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, replace

from core.languages import is_no_space_lang
from models.translation.base_translator import (
    TranslationInputRegion,
    TranslationPayload,
)
from models.translation.errors import TranslatorConfigurationError
from models.translation.json_types import JsonValue

LLM_TEMPERATURE_ENV = "MINI_BACKEND_LLM_TEMPERATURE"
DEFAULT_LLM_TEMPERATURE = 0.2
_MIN_TEMPERATURE = 0.0
_MAX_TEMPERATURE = 2.0


def first_env(*names: str, default: str = "") -> str:
    for name in names:
        value = os.getenv(name, "").strip()
        if value:
            return value
    return default


# Historical name, kept for the providers compat surface (tests import it).
_first_env = first_env


def env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError as exc:
        raise TranslatorConfigurationError(f"{name} must be a number, got {raw!r}") from exc


def env_int(name: str, default: int, *, minimum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return max(minimum, default)
    try:
        return max(minimum, int(raw))
    except ValueError as exc:
        raise TranslatorConfigurationError(f"{name} must be an integer, got {raw!r}") from exc


def clamp_temperature(value: float) -> float:
    return min(_MAX_TEMPERATURE, max(_MIN_TEMPERATURE, value))


def env_llm_temperature() -> float:
    return clamp_temperature(env_float(LLM_TEMPERATURE_ENV, DEFAULT_LLM_TEMPERATURE))


# Historical name (unclamped variant) kept on the compat surface.
def _env_llm_temperature() -> float:
    return env_llm_temperature()


@dataclass(frozen=True, slots=True)
class EnvEndpoint:
    api_key: str
    base_url: str
    api_key_env_hint: str


def resolve_env_endpoint(
    *,
    api_key_envs: tuple[str, ...],
    base_url_envs: tuple[str, ...],
    default_base_url: str,
) -> EnvEndpoint:
    return EnvEndpoint(
        api_key=first_env(*api_key_envs),
        base_url=first_env(*base_url_envs, default=default_base_url).rstrip("/"),
        api_key_env_hint=api_key_envs[0],
    )


def require_api_key(endpoint: EnvEndpoint, provider_label: str) -> None:
    if not endpoint.api_key:
        raise TranslatorConfigurationError(
            f"{provider_label} requires {endpoint.api_key_env_hint}"
        )


def preprocess_text(text: str, source_language: str) -> str:
    cleaned = text.replace("\r", "").replace("\n", "")
    if is_no_space_lang(source_language):
        cleaned = cleaned.replace(" ", "")
    return cleaned.strip()


# Historical names kept for the compat surface.
_preprocess_translation_text = preprocess_text


def preprocess_regions(
    regions: Iterable[TranslationInputRegion], source_language: str
) -> list[TranslationInputRegion]:
    return [
        replace(region, text=preprocess_text(region.text, source_language))
        for region in regions
    ]


_preprocess_translation_regions = preprocess_regions


def payload_from_parsed(raw: Mapping[str, JsonValue]) -> TranslationPayload:
    """Adapter from parsing.py's ``{"text": ..., "notes": [...]}`` dicts."""
    text = raw.get("text")
    notes = raw.get("notes")
    note_values = notes if isinstance(notes, list) else []
    return TranslationPayload(
        text=text if isinstance(text, str) else "",
        notes=tuple(note for note in note_values if isinstance(note, str) and note),
    )
