from __future__ import annotations

from models.translation.json_types import JsonValue
from models.translation.parsing import extract_claude_text
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

_ANTHROPIC_VERSION = "2023-06-01"


class ClaudeTranslatorEngine(LLMTranslatorBase):
    name = "Anthropic Claude"
    provider_label = "Claude"

    def __init__(
        self,
        model_name: str,
        key: str,
        *,
        api_key_envs: tuple[str, ...] = ("MINI_BACKEND_ANTHROPIC_API_KEY",),
        endpoint_envs: tuple[str, ...] = ("MINI_BACKEND_ANTHROPIC_API_URL",),
        default_endpoint: str = "https://api.anthropic.com/v1/messages",
    ) -> None:
        super().__init__(key=key, model_name=model_name, temperature=env_llm_temperature())
        self._endpoint = resolve_env_endpoint(
            api_key_envs=api_key_envs,
            base_url_envs=endpoint_envs,
            default_base_url=default_endpoint,
        )
        self.api_key = self._endpoint.api_key
        self.endpoint = self._endpoint.base_url

    def _ensure_configured(self) -> None:
        require_api_key(self._endpoint, self.provider_label)

    def _build_http_request(self, system_prompt: str, user_prompt: str) -> LLMHttpRequest:
        return LLMHttpRequest(
            url=self.endpoint,
            payload={
                "model": self.model_name,
                "system": system_prompt,
                "temperature": self.temperature,
                "max_tokens": LLM_MAX_OUTPUT_TOKENS,
                "messages": [
                    {"role": "user", "content": [{"type": "text", "text": user_prompt}]}
                ],
            },
            headers={"x-api-key": self.api_key, "anthropic-version": _ANTHROPIC_VERSION},
        )

    def _extract_text(self, response: JsonValue) -> str | None:
        return extract_claude_text(response)
