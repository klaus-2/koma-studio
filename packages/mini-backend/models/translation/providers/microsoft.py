from __future__ import annotations

import os
from urllib import parse

from models.translation import http as http_mod
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.lang_codes import _microsoft_source_lang, _microsoft_target_lang
from models.translation.providers._common import _preprocess_translation_text


class MicrosoftTranslatorEngine(BaseTranslator):
    key = "microsoft_translator"
    name = "Microsoft Translator"

    def __init__(self) -> None:
        self.api_key = (os.getenv("MINI_BACKEND_MS_TRANSLATOR_KEY") or "").strip()
        self.region = (os.getenv("MINI_BACKEND_MS_TRANSLATOR_REGION") or "").strip()
        self.endpoint = (
            os.getenv("MINI_BACKEND_MS_TRANSLATOR_ENDPOINT")
            or "https://api.cognitive.microsofttranslator.com"
        ).rstrip("/")

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = extra_context
        _ = translation_notes_enabled
        _ = translation_mode
        if not self.api_key or not self.region:
            raise RuntimeError(
                "Microsoft Translator requires MINI_BACKEND_MS_TRANSLATOR_KEY and MINI_BACKEND_MS_TRANSLATOR_REGION"
            )

        source = _microsoft_source_lang(source_language)
        target = _microsoft_target_lang(target_language)
        if not target:
            raise RuntimeError("Invalid target language for Microsoft Translator")

        non_empty: list[tuple[int, TranslationInputRegion]] = []
        body: list[dict[str, str]] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            if not source_text:
                continue
            prepared_text = _preprocess_translation_text(source_text, source_language)
            if not prepared_text:
                continue
            non_empty.append((idx, region))
            body.append({"text": prepared_text})

        translated_by_idx: dict[int, str] = {}
        if body:
            params = {"api-version": "3.0", "to": target}
            if source:
                params["from"] = source
            query = parse.urlencode(params)
            url = f"{self.endpoint}/translate?{query}"
            headers = {
                "Ocp-Apim-Subscription-Key": self.api_key,
                "Ocp-Apim-Subscription-Region": self.region,
            }
            payload = await http_mod._http_json_post(
                url=url, payload=body, headers=headers, timeout=35
            )
            if isinstance(payload, list):
                for pos, item in enumerate(payload):
                    if pos >= len(non_empty):
                        break
                    text = ""
                    if isinstance(item, dict):
                        translations = item.get("translations", [])
                        if isinstance(translations, list) and translations:
                            first = translations[0]
                            if isinstance(first, dict):
                                text = str(first.get("text") or "")
                    translated_by_idx[non_empty[pos][0]] = text

        results: list[TranslationTextResult] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=translated_by_idx.get(idx, ""),
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results
