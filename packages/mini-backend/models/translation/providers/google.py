import asyncio
import logging
from urllib import parse

from models.translation import http as http_mod
from models.translation.base_translator import (
    BaseTranslator,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.errors import (
    TranslationError,
    TranslatorResponseError,
    TranslatorUnavailableError,
)
from models.translation.json_types import JsonValue
from models.translation.lang_codes import _google_lang
from models.translation.providers._common import preprocess_text

logger = logging.getLogger(__name__)

_ENDPOINT = "https://translate.googleapis.com/translate_a/single"
# The free endpoint rate-limits in bursts (429); backoff is mandatory or regions come back empty.
_RETRY_DELAYS_SECONDS = (1.0, 2.0, 4.0, 8.0)
_INTER_REGION_DELAY_SECONDS = 0.3
_REQUEST_TIMEOUT_SECONDS = 20.0
_HTTP_TOO_MANY_REQUESTS = 429


def _join_segments(payload: JsonValue) -> str:
    if not isinstance(payload, list) or not payload:
        return ""
    sentences = payload[0]
    if not isinstance(sentences, list):
        return ""
    parts = [
        segment[0]
        for segment in sentences
        if isinstance(segment, list) and segment and isinstance(segment[0], str)
    ]
    return "".join(parts).strip()


class GoogleTranslatorEngine(BaseTranslator):
    key = "google_translate"
    name = "Google Translate"

    async def _fetch_translation(self, text: str, source_language: str, target_language: str) -> str:
        query = parse.urlencode(
            {
                "client": "gtx",
                "sl": _google_lang(source_language),
                "tl": _google_lang(target_language),
                "dt": "t",
                "q": text,
            }
        )
        url = f"{_ENDPOINT}?{query}"
        last_attempt = len(_RETRY_DELAYS_SECONDS) - 1
        for attempt, delay in enumerate(_RETRY_DELAYS_SECONDS):
            try:
                payload = await http_mod.get_json(
                    provider_label=self.name, url=url, timeout=_REQUEST_TIMEOUT_SECONDS
                )
            except TranslatorResponseError as exc:
                if exc.status_code != _HTTP_TOO_MANY_REQUESTS or attempt == last_attempt:
                    raise
            except TranslatorUnavailableError:
                if attempt == last_attempt:
                    raise
            else:
                return _join_segments(payload)
            await asyncio.sleep(delay)
        raise TranslatorUnavailableError(self.name, "retry budget exhausted")

    async def _translate(self, request: TranslationRequest) -> list[TranslationTextResult]:
        results: list[TranslationTextResult] = []
        for index, region in enumerate(request.regions):
            prepared = preprocess_text(region.text, request.source_language)
            translated = ""
            if prepared:
                if index:
                    await asyncio.sleep(_INTER_REGION_DELAY_SECONDS)
                try:
                    translated = await self._fetch_translation(
                        prepared, request.source_language, request.target_language
                    )
                except TranslationError as exc:
                    logger.warning(
                        "[translation] %s: region %s failed: %s: %s",
                        self.key,
                        region.id,
                        type(exc).__name__,
                        exc,
                        extra={"translator": self.key, "region_id": region.id},
                    )
            results.append(self._result(region, translated))
        return results
