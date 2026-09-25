from __future__ import annotations

import os
from typing import Any

from models.translation import http as http_mod
from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.parsing import _translation_payload
from models.translation.providers._common import _preprocess_translation_text


class CustomTranslatorEngine(BaseTranslator):
    key = "custom"
    name = "Custom"

    def __init__(self) -> None:
        self.endpoint = (os.getenv("MINI_BACKEND_CUSTOM_TRANSLATOR_URL") or "").strip()
        self.api_key = (
            os.getenv("MINI_BACKEND_CUSTOM_TRANSLATOR_API_KEY") or ""
        ).strip()
        self.model = (os.getenv("MINI_BACKEND_CUSTOM_TRANSLATOR_MODEL") or "").strip()
        self.timeout = int(
            (os.getenv("MINI_BACKEND_CUSTOM_TRANSLATOR_TIMEOUT") or "45").strip()
        )

    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        if not self.endpoint:
            # Fallback local: keep text as-is, useful when there is no network/API key configured.
            return [
                TranslationTextResult(
                    id=region.id,
                    source_text=(region.text or "").strip(),
                    translated_text=(region.text or "").strip(),
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                )
                for region in regions
            ]

        texts = [(region.text or "").strip() for region in regions]
        prepared_texts = [
            _preprocess_translation_text(text, source_language) for text in texts
        ]
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        payload = {
            "source_language": source_language,
            "target_language": target_language,
            "texts": prepared_texts,
            "extra_context": extra_context,
            "translation_notes_enabled": translation_notes_enabled,
            "translation_mode": translation_mode,
        }
        if self.model:
            payload["model"] = self.model

        translated: list[dict[str, Any]] = [{"text": "", "notes": []} for _ in texts]
        try:
            response = await http_mod._http_json_post(
                url=self.endpoint,
                payload=payload,
                headers=headers,
                timeout=max(5, self.timeout),
            )
            translations = []
            if isinstance(response, dict):
                if isinstance(response.get("translations"), list):
                    translations = response["translations"]
                elif isinstance(response.get("data"), list):
                    translations = response["data"]
            if isinstance(translations, list):
                for idx, item in enumerate(translations):
                    if idx >= len(translated):
                        break
                    if isinstance(item, dict):
                        translated[idx] = _translation_payload(
                            item.get("translated_text") or item.get("text") or "",
                            item.get("translation_notes")
                            or item.get("notes")
                            or item.get("note")
                            or item.get("nt"),
                        )
                    else:
                        translated[idx] = _translation_payload(item)
        except Exception:
            translated = [{"text": text, "notes": []} for text in texts]

        results: list[TranslationTextResult] = []
        for idx, region in enumerate(regions):
            source_text = texts[idx]
            payload_item = (
                translated[idx] if idx < len(translated) else {"text": "", "notes": []}
            )
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=source_text,
                    translated_text=str(payload_item.get("text") or ""),
                    translation_notes=list(payload_item.get("notes") or [])
                    if translation_notes_enabled and translation_mode != "sfx"
                    else [],
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                ),
            )
        return results
