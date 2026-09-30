import logging
from abc import abstractmethod
from collections.abc import Sequence
from typing import ClassVar

from models.translation.base_translator import (
    BaseTranslator,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.json_types import JsonValue
from models.translation.providers._common import preprocess_text

logger = logging.getLogger(__name__)


def text_field(item: JsonValue) -> str:
    if isinstance(item, dict):
        text = item.get("text")
        if isinstance(text, str):
            return text
    return ""


def texts_from_list(response: JsonValue, key: str) -> list[str]:
    """``{key: [{"text": ...}, ...]}`` → texts, positional."""
    items = response.get(key) if isinstance(response, dict) else None
    if not isinstance(items, list):
        return []
    return [text_field(item) for item in items]


class IndexedBatchTranslatorBase(BaseTranslator):
    """Template for MT APIs that translate a positional list of strings."""

    provider_label: ClassVar[str] = "MT"

    def _ensure_configured(self) -> None:
        return None

    @abstractmethod
    def _resolve_language_pair(
        self, source_language: str, target_language: str
    ) -> tuple[str, str]:
        """Return provider codes ``(source, target)``; empty source means auto-detect."""

    @abstractmethod
    async def _translate_texts(
        self, texts: Sequence[str], source: str, target: str
    ) -> list[str]: ...

    async def _translate(self, request: TranslationRequest) -> list[TranslationTextResult]:
        self._ensure_configured()
        source, target = self._resolve_language_pair(
            request.source_language, request.target_language
        )

        positions: list[int] = []
        texts: list[str] = []
        for index, region in enumerate(request.regions):
            prepared = preprocess_text(region.text, request.source_language)
            if prepared:
                positions.append(index)
                texts.append(prepared)

        translated_by_position: dict[int, str] = {}
        if texts:
            translations = await self._translate_texts(texts, source, target)
            if len(translations) != len(texts):
                logger.warning(
                    "translation.batch.count_mismatch",
                    extra={
                        "translator": self.key,
                        "sent": len(texts),
                        "received": len(translations),
                    },
                )
            translated_by_position = dict(zip(positions, translations, strict=False))

        return [
            self._result(region, translated_by_position.get(index, ""))
            for index, region in enumerate(request.regions)
        ]
