from __future__ import annotations

from models.translation.json_types import JsonValue
from models.translation.parsing import extract_gemini_text
from models.translation.providers._common import (
    env_llm_temperature,
    require_api_key,
    resolve_env_endpoint,
)
from models.translation.providers._llm_base import (
    LLM_MAX_OUTPUT_TOKENS,
    LLMHttpRequest,
    LLMTranslatorBase,
)

_GEMINI_SAFETY_SETTINGS: tuple[dict[str, str], ...] = (
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
)


class GeminiTranslatorEngine(LLMTranslatorBase):
    name = "Google Gemini"
    provider_label = "Gemini"

    def __init__(
        self,
        model_name: str,
        key: str,
        *,
        api_key_envs: tuple[str, ...] = ("MINI_BACKEND_GEMINI_API_KEY",),
        api_base_envs: tuple[str, ...] = ("MINI_BACKEND_GEMINI_API_BASE",),
        default_api_base: str = "https://generativelanguage.googleapis.com/v1beta/models",
    ) -> None:
        super().__init__(key=key, model_name=model_name, temperature=env_llm_temperature())
        self._endpoint = resolve_env_endpoint(
            api_key_envs=api_key_envs,
            base_url_envs=api_base_envs,
            default_base_url=default_api_base,
        )
        self.api_key = self._endpoint.api_key
        self.api_base = self._endpoint.base_url

    def _ensure_configured(self) -> None:
        require_api_key(self._endpoint, self.provider_label)

    def _build_http_request(self, system_prompt: str, user_prompt: str) -> LLMHttpRequest:
        # Key travels in a header, never in the query string (access logs, proxies).
        return LLMHttpRequest(
            url=f"{self.api_base}/{self.model_name}:generateContent",
            payload={
                "systemInstruction": {"parts": [{"text": system_prompt}]},
                "contents": [{"parts": [{"text": user_prompt}]}],
                "generationConfig": {
                    "temperature": self.temperature,
                    "maxOutputTokens": LLM_MAX_OUTPUT_TOKENS,
                    "topP": 0.95,
                    "responseMimeType": "application/json",
                },
                "safetySettings": list(_GEMINI_SAFETY_SETTINGS),
            },
            headers={"x-goog-api-key": self.api_key},
        )

    def _extract_text(self, response: JsonValue) -> str | None:
        return extract_gemini_text(response)
