from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx

from core.http_retry import post_with_429_retry

_REDIRECT_STATUSES = {301, 302, 307, 308}
_HUGGINGFACE_ROUTER_API_BASE = "https://router.huggingface.co/v1"
_AUTH_ERROR_STATUSES = frozenset({401, 403})


def _normalized_hostname(url: str) -> str:
    return (urlparse(url).hostname or "").strip().lower()


@dataclass(frozen=True)
class KnownProvider:
    key: str
    hosts: frozenset[str]
    auth_error_detail: str                       # appended on 401/403
    model_error_statuses: frozenset[int] = frozenset()
    model_error_detail: str = ""                 # appended on model_error_statuses


# Hosts must be pairwise disjoint (add a unit test asserting that);
# build_custom_provider_http_error_detail relies on it so registry order is
# irrelevant. aiplatform.googleapis.com is deliberately under "gemini" — the
# Vertex OpenAI endpoint is a *path* check on that host and is handled first.
KNOWN_PROVIDERS: tuple[KnownProvider, ...] = (
    KnownProvider("groq", frozenset({"api.groq.com"}), "Groq requires a valid API key."),
    KnownProvider("openrouter", frozenset({"openrouter.ai"}), "OpenRouter requires a valid API key."),
    KnownProvider("cerebras", frozenset({"api.cerebras.ai"}), "Cerebras requires a valid API key."),
    KnownProvider(
        "huggingface",
        frozenset({"router.huggingface.co", "api-inference.huggingface.co"}),
        "Hugging Face Router requires a valid Bearer token.",
    ),
    KnownProvider(
        "airforce",
        frozenset({"api.airforce"}),
        "Airforce requires a valid API key.",
        model_error_statuses=frozenset({400, 404}),
        model_error_detail="Model ID not recognized by the Airforce provider; check the provider catalog.",
    ),
    KnownProvider(
        "gemini",
        frozenset({"generativelanguage.googleapis.com", "aiplatform.googleapis.com"}),
        "Gemini requires a valid API key.",
    ),
    KnownProvider("nlp_cloud", frozenset({"api.nlpcloud.io"}), "NLP Cloud requires a valid token in the Authorization header."),
    KnownProvider("zhipu", frozenset({"open.bigmodel.cn"}), "Zhipu AI requires a valid API key."),
    KnownProvider("kluster", frozenset({"api.kluster.ai"}), "Kluster AI requires a valid API key."),
    KnownProvider("llm7", frozenset({"api.llm7.io"}), "LLM7.io requires a valid token/API key."),
    KnownProvider("siliconflow", frozenset({"api.siliconflow.cn"}), "SiliconFlow requires a valid API key."),
    KnownProvider("ollama_cloud", frozenset({"ollama.com", "api.ollama.com"}), "Ollama Cloud requires a valid Bearer token."),
)
_HOST_TO_PROVIDER: dict[str, KnownProvider] = {
    host: provider for provider in KNOWN_PROVIDERS for host in provider.hosts
}
_PROVIDER_BY_KEY: dict[str, KnownProvider] = {p.key: p for p in KNOWN_PROVIDERS}


def known_provider_for(api_base: str) -> KnownProvider | None:
    return _HOST_TO_PROVIDER.get(_normalized_hostname(api_base))


def _is_provider_host(api_base: str, key: str) -> bool:
    return _normalized_hostname(api_base) in _PROVIDER_BY_KEY[key].hosts


# Predicates kept as one-liners for callers/tests; delete any that grep shows unused.
def is_groq_host(api_base: str) -> bool:        return _is_provider_host(api_base, "groq")
def is_openrouter_host(api_base: str) -> bool:  return _is_provider_host(api_base, "openrouter")
def is_cerebras_host(api_base: str) -> bool:    return _is_provider_host(api_base, "cerebras")
def is_huggingface_host(api_base: str) -> bool: return _is_provider_host(api_base, "huggingface")
def is_airforce_host(api_base: str) -> bool:    return _is_provider_host(api_base, "airforce")
def is_gemini_host(api_base: str) -> bool:      return _is_provider_host(api_base, "gemini")
def is_nlp_cloud_host(api_base: str) -> bool:   return _is_provider_host(api_base, "nlp_cloud")
def is_zhipu_host(api_base: str) -> bool:       return _is_provider_host(api_base, "zhipu")
def is_kluster_host(api_base: str) -> bool:     return _is_provider_host(api_base, "kluster")
def is_llm7_host(api_base: str) -> bool:        return _is_provider_host(api_base, "llm7")
def is_siliconflow_host(api_base: str) -> bool: return _is_provider_host(api_base, "siliconflow")
def is_ollama_cloud_host(api_base: str) -> bool: return _is_provider_host(api_base, "ollama_cloud")


def is_vertex_openai_endpoint(api_base: str) -> bool:
    normalized = normalize_openai_compatible_api_base(api_base)
    parsed = urlparse(normalized)
    hostname = (parsed.hostname or "").strip().lower()
    path = (parsed.path or "").strip().lower()
    return hostname == "aiplatform.googleapis.com" and "/endpoints/openapi" in path


def extract_huggingface_model_from_legacy_api_base(api_base: str) -> str | None:
    parsed = urlparse(api_base)
    if (parsed.hostname or "").strip().lower() != "api-inference.huggingface.co":
        return None

    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 4 or parts[0] != "models":
        return None

    try:
        v1_index = parts.index("v1")
    except ValueError:
        return None

    repo_parts = parts[1:v1_index]
    if not repo_parts:
        return None

    return "/".join(repo_parts)


def is_huggingface_legacy_model_endpoint(api_base: str) -> bool:
    return extract_huggingface_model_from_legacy_api_base(api_base) is not None


def normalize_openai_compatible_api_base(api_base: str) -> str:
    normalized = (api_base or "").strip().rstrip("/")
    if is_huggingface_legacy_model_endpoint(normalized):
        return _HUGGINGFACE_ROUTER_API_BASE
    return normalized


def requires_api_key_for_known_provider(api_base: str) -> bool:
    return known_provider_for(normalize_openai_compatible_api_base(api_base)) is not None


def build_custom_provider_http_error_detail(
    status_code: int, api_base: str, model_name: str
) -> str:
    detail = f"Provider respondeu {status_code}"
    normalized = normalize_openai_compatible_api_base(api_base)
    _ = model_name

    # Vertex shares aiplatform.googleapis.com with the gemini entry and was
    # checked before gemini in the original chain; keep it ahead of the table.
    if is_vertex_openai_endpoint(normalized):
        if status_code in _AUTH_ERROR_STATUSES:
            return (
                f"{detail}. The Vertex AI OpenAI endpoint requires a valid IAM access token "
                "(Bearer) in the API key field."
            )
        if status_code == 404:
            return (
                f"{detail}. Check project_id/location and whether the endpoint "
                "`.../endpoints/openapi` is correct."
            )

    provider = known_provider_for(normalized)
    if provider is not None:
        if status_code in _AUTH_ERROR_STATUSES:
            return f"{detail}. {provider.auth_error_detail}"
        if status_code in provider.model_error_statuses:
            return f"{detail}. {provider.model_error_detail}"

    if status_code == 404:
        return (
            f"{detail}. Check that the API Base points to an OpenAI-compatible endpoint "
            "(`/v1` ou `/chat/completions`)."
        )
    if status_code == 503:
        return f"{detail}. The custom provider is unavailable or rejected the given model."

    return detail


def build_openai_compatible_headers(api_key: str | None) -> dict[str, str]:
    normalized = (api_key or "").strip()
    if not normalized:
        return {}
    return {"Authorization": f"Bearer {normalized}"}


def _resolve_openai_compatible_endpoint(api_base: str, suffix: str) -> str:
    normalized = normalize_openai_compatible_api_base(api_base)
    if normalized.lower().endswith(suffix):
        return normalized
    return f"{normalized}{suffix}"


def _resolve_ollama_endpoint(api_base: str, leaf: str) -> str:
    normalized = (api_base or "").strip().rstrip("/")
    lowered = normalized.lower()
    if lowered.endswith(f"/api/{leaf}"):
        return normalized
    if lowered.endswith("/api"):
        return f"{normalized}/{leaf}"
    return f"{normalized}/api/{leaf}"


def resolve_openai_compatible_chat_endpoint(api_base: str) -> str:
    return _resolve_openai_compatible_endpoint(api_base, "/chat/completions")


def resolve_openai_compatible_models_endpoint(api_base: str) -> str:
    return _resolve_openai_compatible_endpoint(api_base, "/models")


def resolve_ollama_chat_endpoint(api_base: str) -> str:
    return _resolve_ollama_endpoint(api_base, "chat")


def resolve_ollama_tags_endpoint(api_base: str) -> str:
    return _resolve_ollama_endpoint(api_base, "tags")


async def _get_json(
    *,
    url: str,
    headers: dict[str, str],
    timeout: float,
    follow_redirects: bool,
    none_on_404: bool,
) -> Any:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            url, headers=headers or None, follow_redirects=follow_redirects
        )
        if none_on_404 and response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()


def _list_field(data: Any, key: str) -> list[Any]:
    if not isinstance(data, dict):
        return []
    value = data.get(key, [])
    return value if isinstance(value, list) else []


async def fetch_openai_compatible_models(
    *,
    api_base: str,
    api_key: str | None,
    timeout: float = 15.0,
) -> list[dict[str, Any]]:
    data = await _get_json(
        url=resolve_openai_compatible_models_endpoint(api_base),
        headers=build_openai_compatible_headers(api_key),
        timeout=timeout,
        follow_redirects=False,   # differs from Ollama on purpose
        none_on_404=True,         # differs from Ollama on purpose
    )
    return [
        item
        for item in _list_field(data, "data")
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    ]


async def fetch_ollama_models(
    *,
    api_base: str,
    api_key: str | None,
    timeout: float = 15.0,
) -> list[dict[str, Any]]:
    data = await _get_json(
        url=resolve_ollama_tags_endpoint(api_base),
        headers=build_openai_compatible_headers(api_key),
        timeout=timeout,
        follow_redirects=True,
        none_on_404=False,
    )
    parsed_models: list[dict[str, Any]] = []
    for model in _list_field(data, "models"):
        if not isinstance(model, dict):
            continue
        model_id = str(model.get("model") or model.get("name") or "").strip()
        if not model_id:
            continue
        parsed_models.append(
            {
                "id": model_id,
                "object": "model",
                "created": 0,
                "name": str(model.get("name") or model_id),
            }
        )
    return parsed_models


def _normalized_origin(url: str) -> tuple[str, str, int | None]:
    parsed = urlparse(url)
    scheme = parsed.scheme.strip().lower()
    host = (parsed.hostname or "").strip().lower()
    port = parsed.port
    if port is None:
        if scheme == "https":
            port = 443
        elif scheme == "http":
            port = 80
    return scheme, host, port


def _is_same_origin(left_url: str, right_url: str) -> bool:
    return _normalized_origin(left_url) == _normalized_origin(right_url)


async def post_openai_compatible_json(
    *,
    api_base: str,
    api_key: str | None,
    payload: dict[str, Any],
    timeout: float = 90.0,
    max_same_origin_redirects: int = 2,
) -> dict[str, Any]:
    request_url = resolve_openai_compatible_chat_endpoint(api_base)
    headers = build_openai_compatible_headers(api_key)

    async with httpx.AsyncClient(timeout=timeout) as client:
        redirects_followed = 0
        while True:
            response = await post_with_429_retry(
                client,
                request_url,
                max_retries=3,
                headers=headers or None,
                json=payload,               # keep httpx json encoding (≠ providers' content=)
                follow_redirects=False,
            )
            if response.status_code not in _REDIRECT_STATUSES:
                response.raise_for_status()
                payload_data = response.json()
                return payload_data if isinstance(payload_data, dict) else {}

            redirect_target = response.headers.get("location")
            if not redirect_target:
                raise RuntimeError(
                    "Provider custom respondeu redirect sem cabecalho Location."
                )

            next_url = urljoin(request_url, redirect_target)
            if not _is_same_origin(request_url, next_url):
                raise RuntimeError(
                    "Cross-origin redirects are not allowed for custom providers."
                )

            redirects_followed += 1
            if redirects_followed > max_same_origin_redirects:
                raise RuntimeError("Provider custom excedeu o limite de redirects.")

            request_url = next_url


async def post_ollama_chat_json(
    *,
    api_base: str,
    api_key: str | None,
    payload: dict[str, Any],
    timeout: float = 90.0,
) -> dict[str, Any]:
    request_url = resolve_ollama_chat_endpoint(api_base)
    headers = build_openai_compatible_headers(api_key)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            request_url,
            headers=headers or None,
            json=payload,
            follow_redirects=True,
        )
        response.raise_for_status()
        payload_data = response.json()
        return payload_data if isinstance(payload_data, dict) else {}


def extract_ollama_content(response: dict[str, Any]) -> str:
    if not isinstance(response, dict):
        return str(response or "").strip()
    message = response.get("message")
    if isinstance(message, dict):
        return str(message.get("content") or "").strip()
    return str(response.get("response") or "").strip()


_TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
    b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)
_TINY_PNG_B64 = base64.b64encode(_TINY_PNG).decode("utf-8")
_VISION_PROBE_PROMPT = "Reply with exactly: VISION_OK"


def extract_openai_compatible_message_content(response: dict[str, Any]) -> Any:
    """Raw ``choices[0].message.content`` (str, list, or "" when absent).
    Returns the raw value, not a joined string: the vision probe intentionally
    treats list-typed content as "not str → False".
    """
    choices = response.get("choices", []) if isinstance(response, dict) else []
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0] if isinstance(choices[0], dict) else {}
    message = first.get("message", {}) if isinstance(first, dict) else {}
    return message.get("content", "") if isinstance(message, dict) else ""


async def probe_vision_capability(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    timeout: float = 30.0,
) -> bool:
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _VISION_PROBE_PROMPT},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{_TINY_PNG_B64}"}},
                ],
            },
        ],
        "max_tokens": 10,
        "temperature": 0,
    }
    try:
        response = await post_openai_compatible_json(api_base=api_base, api_key=api_key, payload=payload, timeout=timeout)
        content = extract_openai_compatible_message_content(response)
        return isinstance(content, str) and "VISION_OK" in content
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {400, 415, 422}:
            return False
        raise
    except Exception:
        return False          # NB: Ollama probe does NOT do this; kept asymmetric


async def probe_ollama_vision_capability(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    timeout: float = 30.0,
) -> bool:
    payload = {
        "model": model_name,
        "stream": False,
        "messages": [
            {
                "role": "user",
                "content": _VISION_PROBE_PROMPT,
                "images": [_TINY_PNG_B64],
            }
        ],
        "options": {"temperature": 0, "num_predict": 16},
    }
    try:
        response_payload = await post_ollama_chat_json(
            api_base=api_base,
            api_key=api_key,
            payload=payload,
            timeout=timeout,
        )
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {400, 415, 422}:
            return False
        raise
    return "VISION_OK" in extract_ollama_content(response_payload)
