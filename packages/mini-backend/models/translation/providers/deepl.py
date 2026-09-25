from __future__ import annotations

import os
from typing import Any

from models.translation import http as http_mod
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.lang_codes import _deepl_source_lang, _deepl_target_lang
from models.translation.providers._common import _preprocess_translation_text


class DeepLTranslatorEngine(BaseTranslator):
    key = "deepl"
    name = "DeepL"

    def __init__(self) -> None:
        self.api_key = (os.getenv("MINI_BACKEND_DEEPL_API_KEY") or "").strip()
        self.endpoint = (
            os.getenv("MINI_BACKEND_DEEPL_ENDPOINT")
            or "https://api-free.deepl.com/v2/translate"
        ).strip()

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
        if not self.api_key:
            raise RuntimeError("DeepL requires MINI_BACKEND_DEEPL_API_KEY")

        source = _deepl_source_lang(source_language)
        target = _deepl_target_lang(target_language)
        if not target:
            raise RuntimeError("Invalid target language for DeepL")

        non_empty: list[tuple[int, TranslationInputRegion]] = []
        texts: list[str] = []
        for idx, region in enumerate(regions):
            source_text = (region.text or "").strip()
            if not source_text:
                continue
            prepared_text = _preprocess_translation_text(source_text, source_language)
            if not prepared_text:
                continue
            non_empty.append((idx, region))
            texts.append(prepared_text)

        translated_by_idx: dict[int, str] = {}
        if texts:
            fields: dict[str, Any] = {
                "auth_key": self.api_key,
                "target_lang": target,
                "text": texts,
            }
            if source and source != "AUTO":
                fields["source_lang"] = source
            response = await http_mod._http_form_post(
                url=self.endpoint, fields=fields, timeout=35
            )
            translations = (
                response.get("translations", []) if isinstance(response, dict) else []
            )
            if isinstance(translations, list):
                for pos, item in enumerate(translations):
                    if pos >= len(non_empty):
                        break
                    text = ""
                    if isinstance(item, dict):
                        text = str(item.get("text") or "")
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
