from __future__ import annotations

import asyncio
import logging
from urllib import parse

import httpx

from models.translation import http as http_mod
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.lang_codes import _google_lang
from models.translation.providers._common import _preprocess_translation_text

# Pin the pre-split logger name so existing logging config/filters and
# caplog assertions keep matching "[translation] %s: region %s failed: %s: %s".
logger = logging.getLogger("models.translation.providers")


class GoogleTranslatorEngine(BaseTranslator):
    key = "google_translate"
    name = "Google Translate"

    @staticmethod
    async def _translate_text(
        text: str, source_language: str, target_language: str
    ) -> str:
        params = {
            "client": "gtx",
            "sl": _google_lang(source_language),
            "tl": _google_lang(target_language),
            "dt": "t",
            "q": text,
        }
        query = parse.urlencode(params)
        url = f"https://translate.googleapis.com/translate_a/single?{query}"

        # The free endpoint applies rate limit (429) in bursts — retry with
        # backoff; without this, regions silently come back empty.
        payload = None
        delays = (1.0, 2.0, 4.0, 8.0)
        for attempt, delay in enumerate(delays):
            try:
                payload = await http_mod._http_get_json(url)
                break
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code != 429 or attempt == len(delays) - 1:
                    raise
                await asyncio.sleep(delay)
            except httpx.HTTPError:
                if attempt == len(delays) - 1:
                    raise
                await asyncio.sleep(delay)

        if (
            not isinstance(payload, list)
            or not payload
            or not isinstance(payload[0], list)
        ):
            return ""
        parts: list[str] = []
        for item in payload[0]:
            if isinstance(item, list) and item:
                parts.append(str(item[0]))
        return "".join(parts).strip()

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = translation_mode
        results: list[TranslationTextResult] = []
        for index, region in enumerate(regions):
            source_text = (region.text or "").strip()
            translated = ""
            if source_text:
                if index:
                    await asyncio.sleep(0.3)
                try:
                    translated = await self._translate_text(
                        _preprocess_translation_text(source_text, source_language),
                        source_language,
                        target_language,
                    )
                except Exception as exc:
                    logger.warning(
                        "[translation] %s: region %s failed: %s: %s",
                        self.key,
                        region.id,
                        type(exc).__name__,
                        exc,
                    )
                    translated = ""
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=translated,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results
