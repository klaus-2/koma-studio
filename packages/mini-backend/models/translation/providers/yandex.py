from __future__ import annotations

from collections.abc import Sequence

from models.translation import http as http_mod
from models.translation.errors import (
    TranslatorConfigurationError,
    UnsupportedLanguagePairError,
)
from models.translation.lang_codes import _yandex_source_lang, _yandex_target_lang
from models.translation.providers._batch_base import (
    IndexedBatchTranslatorBase,
    texts_from_list,
)
from models.translation.providers._common import first_env

_API_KEY_ENV = "MINI_BACKEND_YANDEX_API_KEY"
_FOLDER_ID_ENV = "MINI_BACKEND_YANDEX_FOLDER_ID"
_TIMEOUT_SECONDS = 35.0


class YandexTranslatorEngine(IndexedBatchTranslatorBase):
    key = "yandex_translate"
    name = "Yandex Translate"
    provider_label = "Yandex"

    def __init__(self) -> None:
        self.api_key = first_env(_API_KEY_ENV)
        self.folder_id = first_env(_FOLDER_ID_ENV)
        self.endpoint = first_env(
            "MINI_BACKEND_YANDEX_ENDPOINT",
            default="https://translate.api.cloud.yandex.net/translate/v2/translate",
        )

    def _ensure_configured(self) -> None:
        if not self.api_key or not self.folder_id:
            raise TranslatorConfigurationError(
                f"Yandex requires {_API_KEY_ENV} and {_FOLDER_ID_ENV}"
            )

    def _resolve_language_pair(self, source_language: str, target_language: str) -> tuple[str, str]:
        target = _yandex_target_lang(target_language)
        if not target:
            raise UnsupportedLanguagePairError(self.key, source_language, target_language)
        return _yandex_source_lang(source_language), target

    async def _translate_texts(self, texts: Sequence[str], source: str, target: str) -> list[str]:
        payload: dict[str, object] = {
            "texts": list(texts),
            "targetLanguageCode": target,
            "folderId": self.folder_id,
            "format": "PLAIN_TEXT",
        }
        if source:
            payload["sourceLanguageCode"] = source
        response = await http_mod.post_json(
            provider_label=self.provider_label,
            url=self.endpoint,
            payload=payload,
            headers={"Authorization": f"Api-Key {self.api_key}"},
            timeout=_TIMEOUT_SECONDS,
        )
        return texts_from_list(response, "translations")
