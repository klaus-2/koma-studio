from __future__ import annotations

from models.translation.json_types import JsonValue
from models.translation.parsing import extract_openai_chat_text
from models.translation.providers._common import (
    env_llm_temperature,
    require_api_key,
    resolve_env_endpoint,
)
from models.translation.providers._llm_base import (
    LLMHttpRequest,
    LLMTranslatorBase,
    build_openai_chat_payload,
)


class OpenAIGPTTranslatorEngine(LLMTranslatorBase):
    name = "OpenAI GPT"
    provider_label = "OpenAI"

    def __init__(
        self,
        model_name: str,
        key: str,
        *,
        api_key_envs: tuple[str, ...] = ("MINI_BACKEND_OPENAI_API_KEY",),
        api_base_envs: tuple[str, ...] = ("MINI_BACKEND_OPENAI_API_BASE",),
        default_api_base: str = "https://api.openai.com/v1",
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
        return LLMHttpRequest(
            url=f"{self.api_base}/chat/completions",
            payload=build_openai_chat_payload(
                model_name=self.model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=self.temperature,
            ),
            headers={"Authorization": f"Bearer {self.api_key}"},
        )

    def _extract_text(self, response: JsonValue) -> str | None:
        return extract_openai_chat_text(response)
