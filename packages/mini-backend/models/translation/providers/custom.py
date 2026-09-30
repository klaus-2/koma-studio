import logging

from models.translation import http as http_mod
from models.translation.base_translator import (
    EMPTY_PAYLOAD,
    BaseTranslator,
    TranslationPayload,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.errors import TranslationError
from models.translation.json_types import JsonValue
from models.translation.parsing import _translation_payload
from models.translation.providers._common import (
    env_int,
    first_env,
    payload_from_parsed,
    preprocess_text,
)

logger = logging.getLogger(__name__)

_TEXT_KEYS = ("translated_text", "text")
_NOTES_KEYS = ("translation_notes", "notes", "note", "nt")


def _first_present(item: dict[str, JsonValue], keys: tuple[str, ...]) -> JsonValue:
    for key in keys:
        value = item.get(key)
        if value:
            return value
    return None


def _payload_from_item(item: JsonValue) -> TranslationPayload:
    if isinstance(item, dict):
        raw = _translation_payload(
            _first_present(item, _TEXT_KEYS) or "", _first_present(item, _NOTES_KEYS)
        )
    else:
        raw = _translation_payload(item)
    return payload_from_parsed(raw)


def _extract_translations(response: JsonValue) -> list[TranslationPayload]:
    if not isinstance(response, dict):
        return []
    items = response.get("translations")
    if not isinstance(items, list):
        items = response.get("data")
    if not isinstance(items, list):
        return []
    return [_payload_from_item(item) for item in items]


class CustomTranslatorEngine(BaseTranslator):
    key = "custom"
    name = "Custom"
    provider_label = "Custom"

    def __init__(self) -> None:
        self.endpoint = first_env("MINI_BACKEND_CUSTOM_TRANSLATOR_URL")
        self.api_key = first_env("MINI_BACKEND_CUSTOM_TRANSLATOR_API_KEY")
        self.model = first_env("MINI_BACKEND_CUSTOM_TRANSLATOR_MODEL")
        self.timeout_seconds = env_int(
            "MINI_BACKEND_CUSTOM_TRANSLATOR_TIMEOUT", default=45, minimum=5
        )

    def _passthrough(self, request: TranslationRequest) -> list[TranslationTextResult]:
        return [self._result(region, region.text.strip()) for region in request.regions]

    async def _translate(self, request: TranslationRequest) -> list[TranslationTextResult]:
        if not self.endpoint:
            # Documented offline behaviour: no endpoint configured → source text is kept verbatim.
            return self._passthrough(request)

        payload: dict[str, object] = {
            "source_language": request.source_language,
            "target_language": request.target_language,
            "texts": [
                preprocess_text(region.text, request.source_language)
                for region in request.regions
            ],
            "extra_context": request.extra_context,
            "translation_notes_enabled": request.translation_notes_enabled,
            "translation_mode": request.translation_mode,
        }
        if self.model:
            payload["model"] = self.model
        headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}

        try:
            response = await http_mod.post_json(
                provider_label=self.provider_label,
                url=self.endpoint,
                payload=payload,
                headers=headers,
                timeout=self.timeout_seconds,
            )
        except TranslationError as exc:
            # Documented degraded mode: endpoint failures fall back to the
            # source text, but they are logged instead of vanishing.
            logger.warning(
                "translation.custom.fallback_to_source",
                extra={"translator": self.key, "error": type(exc).__name__, "detail": str(exc)},
            )
            return self._passthrough(request)

        translations = _extract_translations(response)
        results: list[TranslationTextResult] = []
        for index, region in enumerate(request.regions):
            item = translations[index] if index < len(translations) else EMPTY_PAYLOAD
            notes = item.notes if request.notes_allowed else ()
            results.append(self._result(region, item.text, notes))
        return results
