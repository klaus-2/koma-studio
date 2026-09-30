from __future__ import annotations

from collections.abc import Sequence

from models.translation import http as http_mod
from models.translation.errors import (
    TranslatorConfigurationError,
    UnsupportedLanguagePairError,
)
from models.translation.lang_codes import _deepl_source_lang, _deepl_target_lang
from models.translation.providers._batch_base import (
    IndexedBatchTranslatorBase,
    texts_from_list,
)
from models.translation.providers._common import first_env

_API_KEY_ENV = "MINI_BACKEND_DEEPL_API_KEY"
_TIMEOUT_SECONDS = 35.0


class DeepLTranslatorEngine(IndexedBatchTranslatorBase):
    key = "deepl"
    name = "DeepL"
    provider_label = "DeepL"

    def __init__(self) -> None:
        self.api_key = first_env(_API_KEY_ENV)
        self.endpoint = first_env(
            "MINI_BACKEND_DEEPL_ENDPOINT", default="https://api-free.deepl.com/v2/translate"
        )

    def _ensure_configured(self) -> None:
        if not self.api_key:
            raise TranslatorConfigurationError(f"DeepL requires {_API_KEY_ENV}")

    def _resolve_language_pair(self, source_language: str, target_language: str) -> tuple[str, str]:
        target = _deepl_target_lang(target_language)
        if not target:
            raise UnsupportedLanguagePairError(self.key, source_language, target_language)
        return _deepl_source_lang(source_language), target

    async def _translate_texts(self, texts: Sequence[str], source: str, target: str) -> list[str]:
        fields: dict[str, str | list[str]] = {"target_lang": target, "text": list(texts)}
        if source:
            fields["source_lang"] = source
        # Key in the Authorization header (never a form field): it stays out of
        # provider-side request logging bodies.
        response = await http_mod.post_form(
            provider_label=self.provider_label,
            url=self.endpoint,
            fields=fields,
            headers={"Authorization": f"DeepL-Auth-Key {self.api_key}"},
            timeout=_TIMEOUT_SECONDS,
        )
        return texts_from_list(response, "translations")
