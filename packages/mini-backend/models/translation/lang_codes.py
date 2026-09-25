from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping

from core.languages import normalize_language_code


def _normalize_language_code(language: str) -> str:
    # kept for import compatibility
    return normalize_language_code(language, default="auto", allow_auto=True)


def _identity(code: str) -> str:
    return code


@dataclass(frozen=True)
class LangCodeMap:
    """Provider language-code mapping.

    Resolution order mirrors the original if/elif chains exactly:
      1. normalize_language_code(default="auto"|"en", allow_auto) then .lower()
      2. exact match
      3. prefix rules, first match wins
      4. fallback transform (identity or str.upper)
    """

    allow_auto: bool
    exact: Mapping[str, str]
    prefixes: tuple[tuple[str, str], ...] = ()
    fallback: Callable[[str], str] = _identity

    def __call__(self, language: str) -> str:
        code = normalize_language_code(
            language,
            default="auto" if self.allow_auto else "en",
            allow_auto=self.allow_auto,
        ).lower()
        mapped = self.exact.get(code)
        if mapped is not None:
            return mapped
        for prefix, prefixed in self.prefixes:
            if code.startswith(prefix):
                return prefixed
        return self.fallback(code)


_SOURCE_AUTO_EMPTY = {"auto": "", "": ""}

_google_lang = LangCodeMap(
    allow_auto=True,
    exact={"auto": "auto", "": "auto", "pt-br": "pt",
           "zh": "zh-CN", "zh-cn": "zh-CN", "zh-tw": "zh-TW"},
)
_microsoft_source_lang = LangCodeMap(
    allow_auto=True,
    exact={**_SOURCE_AUTO_EMPTY, "zh": "zh-Hans", "zh-cn": "zh-Hans", "zh-tw": "zh-Hant"},
)
_microsoft_target_lang = LangCodeMap(
    allow_auto=False,
    exact={"zh": "zh-Hans", "zh-cn": "zh-Hans", "zh-tw": "zh-Hant",
           "pt": "pt-pt", "pt-br": "pt"},
)
_yandex_source_lang = LangCodeMap(
    allow_auto=True,
    exact={**_SOURCE_AUTO_EMPTY, "zh-cn": "zh", "zh-tw": "zh"},
)
_yandex_target_lang = LangCodeMap(
    allow_auto=False,
    exact={"zh": "zh", "zh-cn": "zh", "zh-tw": "zh", "pt-br": "pt-BR"},
)
_deepl_source_lang = LangCodeMap(
    allow_auto=True,
    exact={**_SOURCE_AUTO_EMPTY, "pt-br": "PT-BR"},
    prefixes=(("zh", "ZH"),),          # original: lang.startswith("zh")
    fallback=str.upper,
)
_deepl_target_lang = LangCodeMap(
    allow_auto=False,
    exact={"pt-br": "PT-BR", "pt": "PT-PT", "zh-cn": "ZH-HANS", "zh": "ZH-HANS",
           "zh-tw": "ZH-HANT", "en": "EN-US"},
    fallback=str.upper,                # note: no zh-prefix rule here — "zh-hk" → "ZH-HK", as before
)
