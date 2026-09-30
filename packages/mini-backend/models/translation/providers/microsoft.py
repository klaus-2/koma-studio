from __future__ import annotations

from collections.abc import Sequence
from urllib import parse

from models.translation import http as http_mod
from models.translation.errors import (
    TranslatorConfigurationError,
    UnsupportedLanguagePairError,
)
from models.translation.json_types import JsonValue
from models.translation.lang_codes import _microsoft_source_lang, _microsoft_target_lang
from models.translation.providers._batch_base import (
    IndexedBatchTranslatorBase,
    text_field,
)
from models.translation.providers._common import first_env

_API_KEY_ENV = "MINI_BACKEND_MS_TRANSLATOR_KEY"
_REGION_ENV = "MINI_BACKEND_MS_TRANSLATOR_REGION"
_TIMEOUT_SECONDS = 35.0


def _first_translation_texts(response: JsonValue) -> list[str]:
    """``[{"translations": [{"text": ...}]}, ...]`` → texts, positional."""
    if not isinstance(response, list):
        return []
    texts: list[str] = []
    for item in response:
        translations = item.get("translations") if isinstance(item, dict) else None
        first = translations[0] if isinstance(translations, list) and translations else None
        texts.append(text_field(first))
    return texts


class MicrosoftTranslatorEngine(IndexedBatchTranslatorBase):
    key = "microsoft_translator"
    name = "Microsoft Translator"
    provider_label = "Microsoft Translator"

    def __init__(self) -> None:
        self.api_key = first_env(_API_KEY_ENV)
        self.region = first_env(_REGION_ENV)
        self.endpoint = first_env(
            "MINI_BACKEND_MS_TRANSLATOR_ENDPOINT",
            default="https://api.cognitive.microsofttranslator.com",
        ).rstrip("/")

    def _ensure_configured(self) -> None:
        if not self.api_key or not self.region:
            raise TranslatorConfigurationError(
                f"Microsoft Translator requires {_API_KEY_ENV} and {_REGION_ENV}"
            )

    def _resolve_language_pair(self, source_language: str, target_language: str) -> tuple[str, str]:
        target = _microsoft_target_lang(target_language)
        if not target:
            raise UnsupportedLanguagePairError(self.key, source_language, target_language)
        return _microsoft_source_lang(source_language), target

    async def _translate_texts(self, texts: Sequence[str], source: str, target: str) -> list[str]:
        params = {"api-version": "3.0", "to": target}
        if source:
            params["from"] = source
        response = await http_mod.post_json(
            provider_label=self.provider_label,
            url=f"{self.endpoint}/translate?{parse.urlencode(params)}",
            payload=[{"text": text} for text in texts],
            headers={
                "Ocp-Apim-Subscription-Key": self.api_key,
                "Ocp-Apim-Subscription-Region": self.region,
            },
            timeout=_TIMEOUT_SECONDS,
        )
        return _first_translation_texts(response)
