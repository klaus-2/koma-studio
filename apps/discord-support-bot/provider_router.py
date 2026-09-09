"""Provider routing and automatic failover for KŌMA's free cloud AI catalog."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from time import monotonic
import os
import re

import httpx

from config import Settings
from utils.logger import get_logger


FREE_PROVIDER_IDS_FALLBACK = (
    "openrouter",
    "groq",
    "huggingface_router",
    "cerebras",
    "google_ai_studio",
    "nvidia_nim",
    "mistral_plateforme",
    "mistral_codestral",
    "vercel_ai_gateway",
    "cohere",
    "github_models",
    "cloudflare_workers_ai",
    "zhipu_ai",
    "llm7_io",
    "kluster_ai",
    "siliconflow",
    "ollama_cloud",
    "google_cloud_vertex_ai",
    "fireworks",
    "baseten",
    "nebius",
    "novita",
    "ai21",
    "upstage",
    "nlp_cloud",
    "alibaba_model_studio",
    "modal",
    "inference_net",
    "hyperbolic",
    "sambanova_cloud",
    "scaleway_generative_apis",
)
SPECIAL_TRANSPORTS = {
    "google_ai_studio": "gemini_native",
    "nlp_cloud": "nlp_cloud_chatbot",
    "ollama_cloud": "ollama_native",
}
FREE_PROVIDERS_SET_PATTERN = re.compile(
    r"const FREE_PROVIDER_TRANSLATION_IDS = \[(?P<body>.*?)\] as const;",
    re.DOTALL,
)
TOP_LEVEL_PROVIDER_PATTERN = re.compile(
    r"^  \{\n(?P<body>.*?)(?=^  \},\n^  \{|^  \},\n^\];)",
    re.DOTALL | re.MULTILINE,
)


@dataclass(slots=True, frozen=True)
class ProviderCatalogEntry:
    """Minimal provider metadata extracted from the KŌMA frontend catalog."""

    provider_id: str
    name: str
    docs_url: str
    setup_url: str
    transport: str
    default_api_base: str
    default_model: str


@dataclass(slots=True, frozen=True)
class ProviderRuntimeConfig:
    """Effective provider configuration loaded from the environment."""

    provider_id: str
    name: str
    transport: str
    api_base: str
    model: str
    api_key: str


@dataclass(slots=True, frozen=True)
class RouterResult:
    """Response returned by the active provider."""

    text: str
    provider_id: str
    provider_name: str
    model: str
    failover_count: int


class ProviderRateLimitError(RuntimeError):
    """Raised when a provider hits rate or quota limits."""


class ProviderTemporaryError(RuntimeError):
    """Raised for provider-side temporary failures."""


class ProviderRouter:
    """Route answer generation across configured free-cloud providers."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.logger = get_logger(__name__)
        self._cooldowns: dict[str, float] = {}
        self.catalog = self._load_catalog()

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> RouterResult:
        """Generate text using the configured provider chain with failover."""
        candidates = self._load_configured_providers()
        if not candidates:
            raise RuntimeError(
                "No cloud AI provider configured for responses. Configure at least one provider in .env."
            )

        errors: list[str] = []
        failover_count = 0
        for provider in candidates:
            if self._is_in_cooldown(provider.provider_id):
                continue
            try:
                text = self._call_provider(
                    provider=provider,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
                return RouterResult(
                    text=text,
                    provider_id=provider.provider_id,
                    provider_name=provider.name,
                    model=provider.model,
                    failover_count=failover_count,
                )
            except ProviderRateLimitError as exc:
                failover_count += 1
                self._cooldowns[provider.provider_id] = monotonic() + self.settings.provider_rate_limit_cooldown_seconds
                message = f"{provider.provider_id}: rate-limit/quota ({exc})"
                errors.append(message)
                self.logger.warning(
                    "Provider hit rate limit, rotating to next candidate",
                    extra={"provider_id": provider.provider_id, "model": provider.model, "error": str(exc)},
                )
                continue
            except ProviderTemporaryError as exc:
                failover_count += 1
                message = f"{provider.provider_id}: temporary error ({exc})"
                errors.append(message)
                self.logger.warning(
                    "Provider temporary failure, rotating to next candidate",
                    extra={"provider_id": provider.provider_id, "model": provider.model, "error": str(exc)},
                )
                continue
            except Exception as exc:  # noqa: BLE001
                failover_count += 1
                message = f"{provider.provider_id}: unrecoverable error ({exc})"
                errors.append(message)
                self.logger.warning(
                    "Provider failed, trying next candidate",
                    extra={"provider_id": provider.provider_id, "model": provider.model, "error": str(exc)},
                )
                continue

        raise RuntimeError(
            "All configured providers failed. "
            + (" | ".join(errors[:5]) if errors else "No additional details.")
        )

    def list_configured_provider_ids(self) -> list[str]:
        """Return the configured provider ids in routing order."""
        return [provider.provider_id for provider in self._load_configured_providers()]

    def _load_catalog(self) -> dict[str, ProviderCatalogEntry]:
        """Parse the KŌMA frontend catalog to build provider metadata.

        The catalog is authored in TypeScript under
        packages/interface/src/models/. If it cannot be read or the format
        drifts, log a warning and return an empty catalog so routing falls
        back to FREE_PROVIDER_IDS_FALLBACK instead of crashing at startup.
        """
        models_dir = (
            Path(self.settings.codebase_path) / "packages" / "interface" / "src" / "models"
        )
        try:
            provider_ids = self._parse_free_provider_ids(models_dir / "officialModelCatalog.ts")
            catalog: dict[str, ProviderCatalogEntry] = {}
            for data_file in (
                "freeAiProviderCatalogCoreData.ts",
                "freeAiProviderCatalogExtendedData.ts",
            ):
                text = (models_dir / data_file).read_text(encoding="utf-8")
                for match in TOP_LEVEL_PROVIDER_PATTERN.finditer(text):
                    block = match.group("body")
                    provider_id_match = re.search(r'^\s{6}id: "([^"]+)",$', block, re.MULTILINE)
                    name_match = re.search(r'^\s{6}name: "([^"]+)",$', block, re.MULTILINE)
                    docs_match = re.search(r'^\s{6}docsUrl: "([^"]+)",$', block, re.MULTILINE)
                    setup_match = re.search(r'^\s{6}setupUrl: "([^"]+)",$', block, re.MULTILINE)
                    if not provider_id_match or not name_match or not docs_match or not setup_match:
                        continue
                    provider_id = provider_id_match.group(1)
                    if provider_id not in provider_ids:
                        continue
                    translation_match = re.search(
                        r'translation:\s*createTranslationStage\(\s*"([^"]+)",\s*"([^"]+)"',
                        block,
                        re.DOTALL,
                    )
                    if not translation_match:
                        continue
                    catalog[provider_id] = ProviderCatalogEntry(
                        provider_id=provider_id,
                        name=name_match.group(1),
                        docs_url=docs_match.group(1),
                        setup_url=setup_match.group(1),
                        transport=SPECIAL_TRANSPORTS.get(provider_id, "openai_compatible"),
                        default_api_base=translation_match.group(1),
                        default_model=translation_match.group(2),
                    )
            return catalog
        except OSError:
            self.logger.warning(
                "Free-provider catalog files not readable; using static fallback list",
                extra={"models_dir": str(models_dir)},
            )
            return {}

    def _parse_free_provider_ids(self, official_models_file: Path) -> set[str]:
        """Extract the free translation-capable provider ids from the frontend model catalog."""
        text = official_models_file.read_text(encoding="utf-8")
        match = FREE_PROVIDERS_SET_PATTERN.search(text)
        if not match:
            return set(FREE_PROVIDER_IDS_FALLBACK)
        return set(re.findall(r'"([^"]+)"', match.group("body")))

    def _load_configured_providers(self) -> list[ProviderRuntimeConfig]:
        """Build the provider chain from environment variables."""
        configured: list[ProviderRuntimeConfig] = []
        for provider_id in self._provider_priority():
            catalog_entry = self.catalog.get(provider_id)
            if catalog_entry is None:
                continue
            prefix = self._env_prefix(provider_id)
            enabled = self._parse_bool(os.getenv(f"{prefix}_ENABLED"), default=False)
            api_key = (os.getenv(f"{prefix}_API_KEY") or "").strip()
            if not enabled and not api_key:
                continue

            api_base = (os.getenv(f"{prefix}_API_BASE") or catalog_entry.default_api_base).strip()
            if not api_base or "{" in api_base:
                self.logger.info(
                    "Skipping provider with unresolved API base",
                    extra={"provider_id": provider_id, "api_base": api_base},
                )
                continue
            model = (os.getenv(f"{prefix}_MODEL") or catalog_entry.default_model).strip()
            if not model:
                continue
            configured.append(
                ProviderRuntimeConfig(
                    provider_id=provider_id,
                    name=catalog_entry.name,
                    transport=catalog_entry.transport,
                    api_base=api_base.rstrip("/"),
                    model=model,
                    api_key=api_key,
                )
            )
        return configured

    def _provider_priority(self) -> tuple[str, ...]:
        """Resolve the provider routing order from env or project defaults."""
        if self.settings.llm_provider_priority:
            return self.settings.llm_provider_priority
        raw = os.getenv("LLM_PROVIDER_PRIORITY", "").strip()
        if not raw:
            return tuple(FREE_PROVIDER_IDS_FALLBACK)
        entries = [item.strip().lower() for item in raw.split(",") if item.strip()]
        return tuple(entries) if entries else tuple(FREE_PROVIDER_IDS_FALLBACK)

    def _call_provider(self, *, provider: ProviderRuntimeConfig, system_prompt: str, user_prompt: str) -> str:
        """Dispatch the request to the transport-specific provider client."""
        if provider.transport == "gemini_native":
            return self._call_gemini_native(provider, system_prompt, user_prompt)
        if provider.transport == "nlp_cloud_chatbot":
            return self._call_nlp_cloud(provider, system_prompt, user_prompt)
        if provider.transport == "ollama_native":
            return self._call_ollama(provider, system_prompt, user_prompt)
        return self._call_openai_compatible(provider, system_prompt, user_prompt)

    def _call_openai_compatible(self, provider: ProviderRuntimeConfig, system_prompt: str, user_prompt: str) -> str:
        """Call an OpenAI-compatible chat completion endpoint."""
        payload = {
            "model": provider.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "top_p": 0.95,
            "max_tokens": 1200,
        }
        headers = {"Content-Type": "application/json"}
        if provider.api_key:
            headers["Authorization"] = f"Bearer {provider.api_key}"
        response_json = self._post_json(
            f"{provider.api_base}/chat/completions",
            headers=headers,
            payload=payload,
        )
        return self._extract_openai_text(response_json)

    def _call_gemini_native(self, provider: ProviderRuntimeConfig, system_prompt: str, user_prompt: str) -> str:
        """Call Google AI Studio / Gemini native API."""
        if not provider.api_key:
            raise RuntimeError("Google AI Studio requires an API key.")
        payload = {
            "systemInstruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "topP": 0.95,
                "maxOutputTokens": 1200,
            },
        }
        url = f"{provider.api_base}/{provider.model}:generateContent?key={provider.api_key}"
        response_json = self._post_json(url, headers={"Content-Type": "application/json"}, payload=payload)
        candidates = response_json.get("candidates") or []
        if not candidates:
            raise ProviderTemporaryError("Gemini returned no candidates.")
        parts = candidates[0].get("content", {}).get("parts", [])
        text = "\n".join(str(part.get("text") or "").strip() for part in parts if isinstance(part, dict)).strip()
        if not text:
            raise ProviderTemporaryError("Gemini returned an empty response.")
        return text

    def _call_nlp_cloud(self, provider: ProviderRuntimeConfig, system_prompt: str, user_prompt: str) -> str:
        """Call NLP Cloud chatbot API."""
        if not provider.api_key:
            raise RuntimeError("NLP Cloud requires a token/API key.")
        url = f"{provider.api_base}/gpu/{provider.model}/chatbot"
        payload = {
            "input": user_prompt,
            "context": system_prompt,
            "temperature": 0.2,
            "max_length": 1200,
        }
        headers = {
            "Authorization": f"Bearer {provider.api_key}",
            "Content-Type": "application/json",
        }
        response_json = self._post_json(url, headers=headers, payload=payload)
        text = str(
            response_json.get("response")
            or response_json.get("generated_text")
            or response_json.get("text")
            or ""
        ).strip()
        if not text:
            raise ProviderTemporaryError("NLP Cloud returned an empty response.")
        return text

    def _call_ollama(self, provider: ProviderRuntimeConfig, system_prompt: str, user_prompt: str) -> str:
        """Call Ollama Cloud native chat API."""
        payload = {
            "model": provider.model,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "options": {
                "temperature": 0.2,
                "top_p": 0.95,
                "num_predict": 1200,
            },
        }
        headers = {"Content-Type": "application/json"}
        if provider.api_key:
            headers["Authorization"] = f"Bearer {provider.api_key}"
        response_json = self._post_json(
            self._resolve_ollama_chat_endpoint(provider.api_base),
            headers=headers,
            payload=payload,
        )
        message = response_json.get("message") or {}
        text = str(message.get("content") or response_json.get("response") or "").strip()
        if not text:
            raise ProviderTemporaryError("Ollama Cloud returned an empty response.")
        return text

    def _post_json(self, url: str, *, headers: dict[str, str], payload: dict[str, object]) -> dict[str, object]:
        """Perform a POST request and classify provider failures."""
        try:
            with httpx.Client(timeout=self.settings.request_timeout_seconds) as client:
                response = client.post(url, headers=headers, json=payload)
            if response.status_code == 429:
                raise ProviderRateLimitError(self._short_error_detail(response))
            if response.status_code in {500, 502, 503, 504}:
                raise ProviderTemporaryError(self._short_error_detail(response))
            if response.status_code >= 400:
                detail = self._short_error_detail(response)
                if self._looks_like_rate_limit_text(detail):
                    raise ProviderRateLimitError(detail)
                raise RuntimeError(detail or f"HTTP {response.status_code}")
            data = response.json()
            if not isinstance(data, dict):
                raise ProviderTemporaryError("Provider returned invalid JSON.")
            return data
        except httpx.HTTPError as exc:
            raise ProviderTemporaryError(str(exc)) from exc

    def _short_error_detail(self, response: httpx.Response) -> str:
        """Extract compact error details from provider responses."""
        text = response.text[:500].strip()
        try:
            payload = response.json()
            if isinstance(payload, dict):
                if isinstance(payload.get("error"), dict):
                    message = payload["error"].get("message") or payload["error"].get("code")
                    if message:
                        return str(message)
                if payload.get("message"):
                    return str(payload["message"])
        except Exception:
            pass
        return text or f"HTTP {response.status_code}"

    def _extract_openai_text(self, payload: dict[str, object]) -> str:
        """Extract text from an OpenAI-compatible payload."""
        choices = payload.get("choices") or []
        if not isinstance(choices, list) or not choices:
            raise ProviderTemporaryError("Provider returned no choices.")
        message = choices[0].get("message") if isinstance(choices[0], dict) else {}
        if isinstance(message, dict):
            content = message.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
            if isinstance(content, list):
                text = "\n".join(
                    str(item.get("text") or "").strip()
                    for item in content
                    if isinstance(item, dict)
                ).strip()
                if text:
                    return text
        raise ProviderTemporaryError("Provider returned an empty response.")

    def _looks_like_rate_limit_text(self, detail: str) -> bool:
        """Best-effort classifier for non-429 quota/rate-limit messages."""
        lowered = detail.lower()
        signals = (
            "rate limit",
            "too many requests",
            "quota",
            "resource_exhausted",
            "credit",
            "tpm",
            "rpm",
            "tokens per minute",
            "requests per day",
        )
        return any(signal in lowered for signal in signals)

    def _is_in_cooldown(self, provider_id: str) -> bool:
        """Return whether a provider is still cooling down after a limit hit."""
        cooldown_until = self._cooldowns.get(provider_id, 0.0)
        return monotonic() < cooldown_until

    def _env_prefix(self, provider_id: str) -> str:
        """Create the provider env prefix."""
        normalized = provider_id.upper()
        normalized = re.sub(r"[^A-Z0-9]+", "_", normalized)
        return f"LLM_PROVIDER_{normalized}"

    def _parse_bool(self, value: str | None, default: bool = False) -> bool:
        """Parse booleans from env vars."""
        if value is None:
            return default
        return value.strip().lower() in {"1", "true", "yes", "on"}

    def _resolve_ollama_chat_endpoint(self, api_base: str) -> str:
        """Normalize Ollama chat endpoints to the OpenAI-compatible form."""
        normalized = api_base.rstrip("/")
        lowered = normalized.lower()
        if lowered.endswith("/api/chat"):
            return normalized
        if lowered.endswith("/api"):
            return f"{normalized}/chat"
        return f"{normalized}/api/chat"
