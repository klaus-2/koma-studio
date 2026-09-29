from __future__ import annotations

from collections.abc import Mapping
from typing import NamedTuple, TypedDict


class LanguageOption(TypedDict):
    value: str
    label: str


class _Language(NamedTuple):
    name: str
    code: str


# Canonical language registry. Codes are normalized to lowercase for
# transport consistency.
_LANGUAGE_REGISTRY: tuple[_Language, ...] = (
    _Language("Korean", "ko"),
    _Language("Japanese", "ja"),
    _Language("Chinese", "zh"),
    _Language("Simplified Chinese", "zh-cn"),
    _Language("Traditional Chinese", "zh-tw"),
    _Language("English", "en"),
    _Language("Russian", "ru"),
    _Language("French", "fr"),
    _Language("German", "de"),
    _Language("Dutch", "nl"),
    _Language("Spanish", "es"),
    _Language("Italian", "it"),
    _Language("Turkish", "tr"),
    _Language("Polish", "pl"),
    _Language("Portuguese", "pt"),
    _Language("Brazilian Portuguese", "pt-br"),
    _Language("Thai", "th"),
    _Language("Vietnamese", "vi"),
    _Language("Indonesian", "id"),
    _Language("Hungarian", "hu"),
    _Language("Finnish", "fi"),
    _Language("Arabic", "ar"),
)

_SOURCE_LANGUAGE_CODES: tuple[str, ...] = (
    "ko",
    "ja",
    "fr",
    "zh",
    "en",
    "ru",
    "de",
    "nl",
    "es",
    "it",
)

_TARGET_LANGUAGE_CODES: tuple[str, ...] = (
    "en",
    "ko",
    "ja",
    "fr",
    "zh-cn",
    "zh-tw",
    "ru",
    "de",
    "nl",
    "es",
    "it",
    "tr",
    "pl",
    "pt",
    "pt-br",
    "th",
    "vi",
    "hu",
    "id",
    "fi",
    "ar",
)


_NAME_TO_CODE: Mapping[str, str] = {item.name.lower(): item.code for item in _LANGUAGE_REGISTRY}
_CODE_TO_NAME: Mapping[str, str] = {item.code: item.name for item in _LANGUAGE_REGISTRY}
_CODE_SET: frozenset[str] = frozenset(item.code for item in _LANGUAGE_REGISTRY)

_ALIAS_TO_CODE: Mapping[str, str] = {
    "pt_br": "pt-br",
    "pt-br": "pt-br",
    "ptbr": "pt-br",
    "portuguese (br)": "pt-br",
    "portuguese (brazil)": "pt-br",
    "brazilian portuguese": "pt-br",
    "zh_cn": "zh-cn",
    "zh-cn": "zh-cn",
    "zh-hans": "zh-cn",
    "chinese (simplified)": "zh-cn",
    "simplified chinese": "zh-cn",
    "zh_tw": "zh-tw",
    "zh-tw": "zh-tw",
    "zh-hant": "zh-tw",
    "chinese (traditional)": "zh-tw",
    "traditional chinese": "zh-tw",
    "chinese": "zh",
    "detect": "auto",
    "auto-detect": "auto",
    "automatic": "auto",
    "automatico": "auto",
    "detectar": "auto",
}


def _code_to_name(code: str) -> str:
    return _CODE_TO_NAME.get(code, code)


def normalize_language_code(
    value: str | None,
    default: str = "en",
    allow_auto: bool = False,
) -> str:
    fallback = (default or "en").strip().lower().replace("_", "-")
    if not fallback:
        fallback = "auto" if allow_auto else "en"

    raw = (value or "").strip()
    if not raw:
        if allow_auto and fallback == "auto":
            return "auto"
        return fallback

    normalized = raw.lower().replace("_", "-")
    if allow_auto and normalized in {"auto", "detect", "automatic", "automatico", "detectar"}:
        return "auto"

    if normalized in _ALIAS_TO_CODE:
        mapped = _ALIAS_TO_CODE[normalized]
        if mapped == "auto" and not allow_auto:
            return fallback
        return mapped

    if normalized in _NAME_TO_CODE:
        return _NAME_TO_CODE[normalized]

    if normalized in _CODE_SET:
        return normalized

    # Graceful normalization for chinese variants.
    if normalized.startswith("zh"):
        if "tw" in normalized or "hant" in normalized:
            return "zh-tw"
        if "cn" in normalized or "hans" in normalized:
            return "zh-cn"
        return "zh"

    # Keep simple ISO language codes.
    if len(normalized) == 2 and normalized.isalpha():
        return normalized

    return fallback


def get_source_language_options() -> list[LanguageOption]:
    return [
        {"value": code, "label": _code_to_name(code)}
        for code in _SOURCE_LANGUAGE_CODES
    ]


def is_no_space_lang(code: str | None) -> bool:
    if not code:
        return False
    normalized = normalize_language_code(code, default="", allow_auto=True)
    if not normalized or normalized == "auto":
        normalized = str(code).strip().lower().replace("_", "-")
    return normalized.startswith(("zh", "ja", "th"))


def get_target_language_options() -> list[LanguageOption]:
    return [
        {"value": code, "label": _code_to_name(code)}
        for code in _TARGET_LANGUAGE_CODES
    ]


def get_language_label(code: str) -> str:
    return _code_to_name(code)