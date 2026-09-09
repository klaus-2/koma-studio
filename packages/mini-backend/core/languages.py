from __future__ import annotations

from typing import TypedDict


class LanguageOption(TypedDict):
    value: str
    label: str


# Canonical language registry.
# Codes are normalized to lowercase for transport consistency.
_LANGUAGE_REGISTRY: tuple[dict[str, str], ...] = (
    {"name": "Korean", "code": "ko"},
    {"name": "Japanese", "code": "ja"},
    {"name": "Chinese", "code": "zh"},
    {"name": "Simplified Chinese", "code": "zh-cn"},
    {"name": "Traditional Chinese", "code": "zh-tw"},
    {"name": "English", "code": "en"},
    {"name": "Russian", "code": "ru"},
    {"name": "French", "code": "fr"},
    {"name": "German", "code": "de"},
    {"name": "Dutch", "code": "nl"},
    {"name": "Spanish", "code": "es"},
    {"name": "Italian", "code": "it"},
    {"name": "Turkish", "code": "tr"},
    {"name": "Polish", "code": "pl"},
    {"name": "Portuguese", "code": "pt"},
    {"name": "Brazilian Portuguese", "code": "pt-br"},
    {"name": "Thai", "code": "th"},
    {"name": "Vietnamese", "code": "vi"},
    {"name": "Indonesian", "code": "id"},
    {"name": "Hungarian", "code": "hu"},
    {"name": "Finnish", "code": "fi"},
    {"name": "Arabic", "code": "ar"},
)

# Mirrors supported_source_languages.
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

# Mirrors supported_target_languages.
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


_NAME_TO_CODE: dict[str, str] = {
    item["name"].lower(): item["code"]
    for item in _LANGUAGE_REGISTRY
}
_CODE_SET: set[str] = {item["code"] for item in _LANGUAGE_REGISTRY}

_ALIAS_TO_CODE: dict[str, str] = {
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


def _code_to_name(code: str) -> str:
    for item in _LANGUAGE_REGISTRY:
        if item["code"] == code:
            return item["name"]
    return code
