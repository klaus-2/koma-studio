from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class TranslationInputRegion:
    id: str
    text: str
    source: str = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    detected_render_mode: str = ""
    structural_type: str = ""
    sfx_requires_redraw: bool = False


@dataclass(frozen=True)
class TranslationTextResult:
    id: str
    source_text: str
    translated_text: str
    translation_notes: list[str] = field(default_factory=list)
    source: str = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""


class BaseTranslator(ABC):
    key: str = "base"
    name: str = "Base Translator"

    async def translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        return await self._translate(
            regions=regions,
            source_language=source_language,
            target_language=target_language,
            extra_context=extra_context,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=translation_mode,
        )

    @abstractmethod
    async def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        raise NotImplementedError
