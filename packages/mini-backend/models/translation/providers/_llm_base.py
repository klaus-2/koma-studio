import logging
from abc import abstractmethod
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import ClassVar

from models.translation import http as http_mod
from models.translation.base_translator import (
    EMPTY_PAYLOAD,
    BaseTranslator,
    TranslationInputRegion,
    TranslationMap,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.json_types import JsonValue
from models.translation.parsing import (
    _parse_llm_translation_map,
    dedupe_translation_notes_across_regions,
)
from models.translation.prompts import _llm_system_prompt, _llm_user_prompt
from models.translation.providers._common import (
    clamp_temperature,
    payload_from_parsed,
    preprocess_regions,
)

logger = logging.getLogger(__name__)

LLM_MAX_OUTPUT_TOKENS = 4096


@dataclass(frozen=True, slots=True)
class LLMHttpRequest:
    url: str
    payload: Mapping[str, object]
    headers: Mapping[str, str] = field(default_factory=dict)


def build_openai_chat_payload(
    *, model_name: str, system_prompt: str, user_prompt: str, temperature: float
) -> dict[str, object]:
    return {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }


class LLMTranslatorBase(BaseTranslator):
    """Template for chat-completion providers.

    Subclasses provide the wire format (``_build_http_request``) and the
    response-to-text extractor (``_extract_text``); everything else —
    preprocessing, prompting, parsing, note dedupe, result assembly — is shared.
    """

    provider_label: ClassVar[str] = "LLM"
    timeout_seconds: float = 90.0

    def __init__(self, *, key: str, model_name: str, temperature: float) -> None:
        self.key = key
        self.model_name = model_name
        self.temperature = clamp_temperature(temperature)

    def _ensure_configured(self) -> None:
        """Raise TranslatorConfigurationError when credentials are missing."""
        return None

    @abstractmethod
    def _build_http_request(self, system_prompt: str, user_prompt: str) -> LLMHttpRequest: ...

    @abstractmethod
    def _extract_text(self, response: JsonValue) -> str | None:
        """Return the model's text, or None when the provider returned no candidates."""

    async def _translate(self, request: TranslationRequest) -> list[TranslationTextResult]:
        non_empty = request.non_empty_regions()
        if not non_empty:
            return self._empty_results(request.regions)
        self._ensure_configured()

        prepared = preprocess_regions(non_empty, request.source_language)
        system_prompt = _llm_system_prompt(
            request.source_language,
            request.target_language,
            request.translation_notes_enabled,
            request.translation_mode,
        )
        user_prompt = _llm_user_prompt(
            prepared,
            request.extra_context,
            request.translation_notes_enabled,
            request.translation_mode,
        )
        http_request = self._build_http_request(system_prompt, user_prompt)
        response = await http_mod.post_json(
            provider_label=self.provider_label,
            url=http_request.url,
            payload=http_request.payload,
            headers=http_request.headers,
            timeout=self.timeout_seconds,
        )
        translated = self._parse_response(response, prepared)
        return self._build_results(request, translated)

    def _parse_response(
        self, response: JsonValue, regions: list[TranslationInputRegion]
    ) -> TranslationMap:
        raw_text = self._extract_text(response)
        if raw_text is None:
            logger.warning(
                "translation.llm.empty_response",
                extra={"translator": self.key, "provider": self.provider_label},
            )
            return {}
        raw_map = dedupe_translation_notes_across_regions(
            _parse_llm_translation_map(raw_text, regions)
        )
        translated = {
            region_id: payload_from_parsed(payload) for region_id, payload in raw_map.items()
        }
        missing = [region.id for region in regions if region.id not in translated]
        if missing:
            logger.warning(
                "translation.llm.missing_regions",
                extra={
                    "translator": self.key,
                    "provider": self.provider_label,
                    "missing_count": len(missing),
                    "expected_count": len(regions),
                },
            )
        return translated

    def _build_results(
        self, request: TranslationRequest, translated: TranslationMap
    ) -> list[TranslationTextResult]:
        results: list[TranslationTextResult] = []
        for region in request.regions:
            payload = translated.get(region.id, EMPTY_PAYLOAD) if region.text.strip() else EMPTY_PAYLOAD
            notes = payload.notes if request.notes_allowed else ()
            results.append(self._result(region, payload.text, notes))
        return results
