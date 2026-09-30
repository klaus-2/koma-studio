from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Literal

type TranslationMode = Literal["default", "sfx"]


@dataclass(frozen=True, slots=True)
class TranslationInputRegion:
    id: str
    text: str
    source: str = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    detected_render_mode: str = ""
    structural_type: str = ""
    sfx_requires_redraw: bool = False


@dataclass(frozen=True, slots=True)
class TranslationTextResult:
    id: str
    source_text: str
    translated_text: str
    translation_notes: list[str] = field(default_factory=list)
    source: str = "model"
    detector_model_key: str = ""
    ocr_model_key: str = ""
    translator_model_key: str = ""


@dataclass(frozen=True, slots=True)
class TranslationPayload:
    text: str = ""
    notes: tuple[str, ...] = ()


EMPTY_PAYLOAD = TranslationPayload()

type TranslationMap = dict[str, TranslationPayload]


def normalize_translation_mode(value: str) -> TranslationMode:
    return "sfx" if value.strip().lower() == "sfx" else "default"


@dataclass(frozen=True, slots=True)
class TranslationRequest:
    regions: tuple[TranslationInputRegion, ...]
    source_language: str
    target_language: str
    extra_context: str = ""
    translation_notes_enabled: bool = True
    translation_mode: TranslationMode = "default"

    @property
    def notes_allowed(self) -> bool:
        return self.translation_notes_enabled and self.translation_mode != "sfx"

    def non_empty_regions(self) -> list[TranslationInputRegion]:
        return [region for region in self.regions if region.text.strip()]


class BaseTranslator(ABC):
    key: str = "base"
    name: str = "Base Translator"

    async def translate(
        self,
        regions: Sequence[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        request = TranslationRequest(
            regions=tuple(regions),
            source_language=source_language,
            target_language=target_language,
            extra_context=extra_context,
            translation_notes_enabled=translation_notes_enabled,
            translation_mode=normalize_translation_mode(translation_mode),
        )
        return await self._translate(request)

    @abstractmethod
    async def _translate(
        self, request: TranslationRequest
    ) -> list[TranslationTextResult]: ...

    def _result(
        self,
        region: TranslationInputRegion,
        translated_text: str,
        notes: Sequence[str] = (),
    ) -> TranslationTextResult:
        return TranslationTextResult(
            id=region.id,
            source_text=region.text.strip(),
            translated_text=translated_text,
            translation_notes=list(notes),
            source=region.source,
            detector_model_key=region.detector_model_key,
            ocr_model_key=region.ocr_model_key,
            translator_model_key=self.key,
        )

    def _empty_results(
        self, regions: Sequence[TranslationInputRegion]
    ) -> list[TranslationTextResult]:
        return [self._result(region, "") for region in regions]
