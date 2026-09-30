from __future__ import annotations

from models.translation.json_types import JsonValue
from models.translation.parsing import extract_ollama_text, extract_openai_chat_text
from models.translation.providers._llm_base import (
    LLM_MAX_OUTPUT_TOKENS,
    LLMHttpRequest,
    LLMTranslatorBase,
    build_openai_chat_payload,
)
from models.translation.urls import (
    _normalize_openai_compatible_api_base,
    _resolve_ollama_chat_url,
    _resolve_openai_compatible_chat_url,
)

_MIN_TIMEOUT_SECONDS = 5.0


def _bearer_headers(api_key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


class RequestScopedOpenAICompatibleTranslatorEngine(LLMTranslatorBase):
    name = "Request Scoped OpenAI-Compatible"
    provider_label = "Custom AI"

    def __init__(
        self,
        *,
        key: str,
        model_name: str,
        api_base: str,
        api_key: str = "",
        temperature: float = 0.2,
        timeout: float = 90.0,
    ) -> None:
        super().__init__(key=key, model_name=model_name, temperature=temperature)
        self.api_base = _normalize_openai_compatible_api_base(api_base)
        self.api_key = api_key.strip()
        self.timeout_seconds = max(_MIN_TIMEOUT_SECONDS, timeout)

    def _build_http_request(self, system_prompt: str, user_prompt: str) -> LLMHttpRequest:
        return LLMHttpRequest(
            url=_resolve_openai_compatible_chat_url(self.api_base),
            payload=build_openai_chat_payload(
                model_name=self.model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=self.temperature,
            ),
            headers=_bearer_headers(self.api_key),
        )

    def _extract_text(self, response: JsonValue) -> str | None:
        return extract_openai_chat_text(response)


class RequestScopedOllamaNativeTranslatorEngine(LLMTranslatorBase):
    name = "Request Scoped Ollama Native"
    provider_label = "Custom AI Ollama"

    def __init__(
        self,
        *,
        key: str,
        model_name: str,
        api_base: str,
        api_key: str = "",
        temperature: float = 0.2,
        timeout: float = 90.0,
    ) -> None:
        super().__init__(key=key, model_name=model_name, temperature=temperature)
        self.api_base = api_base.strip().rstrip("/")
        self.api_key = api_key.strip()
        self.timeout_seconds = max(_MIN_TIMEOUT_SECONDS, timeout)

    def _build_http_request(self, system_prompt: str, user_prompt: str) -> LLMHttpRequest:
        return LLMHttpRequest(
            url=_resolve_ollama_chat_url(self.api_base),
            payload={
                "model": self.model_name,
                "stream": False,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "options": {
                    "temperature": self.temperature,
                    "num_predict": LLM_MAX_OUTPUT_TOKENS,
                },
            },
            headers=_bearer_headers(self.api_key),
        )

    def _extract_text(self, response: JsonValue) -> str | None:
        return extract_ollama_text(response)
