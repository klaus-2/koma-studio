from __future__ import annotations

from collections.abc import Sequence

from models.translation import http as http_mod
from models.translation.errors import TranslatorConfigurationError
from models.translation.json_types import JsonValue
from models.translation.lang_codes import (
    _libretranslate_source_lang,
    _libretranslate_target_lang,
)
from models.translation.providers._batch_base import IndexedBatchTranslatorBase

_TIMEOUT_SECONDS = 35.0


def _texts_from_translated(response: JsonValue) -> list[str]:
    """``{"translatedText": [...] | "..."}`` → texts, positional.

    LibreTranslate echoes a list when ``q`` is a list (batch) and a plain
    string when it is a single value; both shapes answer here.
    """
    if not isinstance(response, dict):
        return []
    translated = response.get("translatedText")
    if isinstance(translated, list):
        return [item if isinstance(item, str) else "" for item in translated]
    if isinstance(translated, str):
        return [translated]
    return []


class LibreTranslateEngine(IndexedBatchTranslatorBase):
    key = "libretranslate"
    name = "LibreTranslate"
    provider_label = "LibreTranslate"

    def __init__(self, server_url: str | None, api_key: str | None = None) -> None:
        self.server_url = (server_url or "").rstrip("/")
        self.api_key = api_key or None

    def _ensure_configured(self) -> None:
        if not self.server_url:
            raise TranslatorConfigurationError(
                "LibreTranslate requires a server URL "
                "(Settings → Integrations, or MINI_BACKEND_LIBRETRANSLATE_URL)"
            )

    def _resolve_language_pair(
        self, source_language: str, target_language: str
    ) -> tuple[str, str]:
        source = _libretranslate_source_lang(source_language)
        target = _libretranslate_target_lang(target_language)
        if not target:
            raise TranslatorConfigurationError(
                f"LibreTranslate target language {target_language!r} is not supported"
            )
        return source, target

    async def _translate_texts(
        self, texts: Sequence[str], source: str, target: str
    ) -> list[str]:
        payload: dict[str, object] = {
            "q": list(texts),
            "source": source or "auto",
            "target": target,
            "format": "text",
        }
        if self.api_key:
            payload["api_key"] = self.api_key
        response = await http_mod.post_json(
            provider_label=self.provider_label,
            url=f"{self.server_url}/translate",
            payload=payload,
            timeout=_TIMEOUT_SECONDS,
        )
        return _texts_from_translated(response)
