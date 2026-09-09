from __future__ import annotations

import asyncio
import base64
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx


_REDIRECT_STATUSES = {301, 302, 307, 308}
_HUGGINGFACE_ROUTER_API_BASE = "https://router.huggingface.co/v1"


def _normalized_hostname(url: str) -> str:
    return (urlparse(url).hostname or "").strip().lower()


def is_groq_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "api.groq.com"


def is_openrouter_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "openrouter.ai"


def is_cerebras_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "api.cerebras.ai"


def is_huggingface_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) in {
        "router.huggingface.co",
        "api-inference.huggingface.co",
    }


def is_airforce_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "api.airforce"


def is_gemini_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) in {
        "generativelanguage.googleapis.com",
        "aiplatform.googleapis.com",
    }


def is_vertex_openai_endpoint(api_base: str) -> bool:
    normalized = normalize_openai_compatible_api_base(api_base)
    parsed = urlparse(normalized)
    hostname = (parsed.hostname or "").strip().lower()
    path = (parsed.path or "").strip().lower()
    return hostname == "aiplatform.googleapis.com" and "/endpoints/openapi" in path


def is_nlp_cloud_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "api.nlpcloud.io"


def is_zhipu_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "open.bigmodel.cn"


def is_kluster_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "api.kluster.ai"


def is_llm7_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "api.llm7.io"


def is_siliconflow_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) == "api.siliconflow.cn"


def is_ollama_cloud_host(api_base: str) -> bool:
    return _normalized_hostname(api_base) in {"ollama.com", "api.ollama.com"}


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
    normalized = normalize_openai_compatible_api_base(api_base)
    return (
        is_groq_host(normalized)
        or is_openrouter_host(normalized)
        or is_cerebras_host(normalized)
        or is_huggingface_host(normalized)
        or is_airforce_host(normalized)
        or is_gemini_host(normalized)
        or is_nlp_cloud_host(normalized)
        or is_zhipu_host(normalized)
        or is_kluster_host(normalized)
        or is_llm7_host(normalized)
        or is_siliconflow_host(normalized)
        or is_ollama_cloud_host(normalized)
    )


def build_custom_provider_http_error_detail(
    status_code: int, api_base: str, model_name: str
) -> str:
    detail = f"Provider respondeu {status_code}"
    normalized = normalize_openai_compatible_api_base(api_base)
    _ = model_name

    if is_airforce_host(normalized):
        if status_code in {401, 403}:
            return f"{detail}. Airforce requires a valid API key."
        if status_code in {400, 404}:
            return f"{detail}. Model ID not recognized by the Airforce provider; check the provider catalog."

    if is_huggingface_host(normalized) and status_code in {401, 403}:
        return f"{detail}. Hugging Face Router requires a valid Bearer token."

    if is_groq_host(normalized) and status_code in {401, 403}:
        return f"{detail}. Groq requires a valid API key."

    if is_openrouter_host(normalized) and status_code in {401, 403}:
        return f"{detail}. OpenRouter requires a valid API key."

    if is_cerebras_host(normalized) and status_code in {401, 403}:
        return f"{detail}. Cerebras requires a valid API key."

    if is_vertex_openai_endpoint(normalized):
        if status_code in {401, 403}:
            return (
                f"{detail}. The Vertex AI OpenAI endpoint requires a valid IAM access token "
                "(Bearer) in the API key field."
            )
        if status_code == 404:
            return (
                f"{detail}. Check project_id/location and whether the endpoint "
                "`.../endpoints/openapi` is correct."
            )

    if is_gemini_host(normalized) and status_code in {401, 403}:
        return f"{detail}. Gemini requires a valid API key."

    if is_nlp_cloud_host(normalized) and status_code in {401, 403}:
        return f"{detail}. NLP Cloud requires a valid token in the Authorization header."

    if is_zhipu_host(normalized) and status_code in {401, 403}:
        return f"{detail}. Zhipu AI requires a valid API key."

    if is_kluster_host(normalized) and status_code in {401, 403}:
        return f"{detail}. Kluster AI requires a valid API key."

    if is_llm7_host(normalized) and status_code in {401, 403}:
        return f"{detail}. LLM7.io requires a valid token/API key."

    if is_siliconflow_host(normalized) and status_code in {401, 403}:
        return f"{detail}. SiliconFlow requires a valid API key."

    if is_ollama_cloud_host(normalized) and status_code in {401, 403}:
        return f"{detail}. Ollama Cloud requires a valid Bearer token."

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


def resolve_openai_compatible_chat_endpoint(api_base: str) -> str:
    normalized = normalize_openai_compatible_api_base(api_base)
    if normalized.lower().endswith("/chat/completions"):
        return normalized
    return f"{normalized}/chat/completions"


def resolve_openai_compatible_models_endpoint(api_base: str) -> str:
    normalized = normalize_openai_compatible_api_base(api_base)
    if normalized.lower().endswith("/models"):
        return normalized
    return f"{normalized}/models"


def resolve_ollama_chat_endpoint(api_base: str) -> str:
    normalized = (api_base or "").strip().rstrip("/")
    if normalized.lower().endswith("/api/chat"):
        return normalized
    if normalized.lower().endswith("/api"):
        return f"{normalized}/chat"
    return f"{normalized}/api/chat"


def resolve_ollama_tags_endpoint(api_base: str) -> str:
    normalized = (api_base or "").strip().rstrip("/")
    if normalized.lower().endswith("/api/tags"):
        return normalized
    if normalized.lower().endswith("/api"):
        return f"{normalized}/tags"
    return f"{normalized}/api/tags"


async def fetch_openai_compatible_models(
    *,
    api_base: str,
    api_key: str | None,
    timeout: float = 15.0,
) -> list[dict[str, Any]]:
    request_url = resolve_openai_compatible_models_endpoint(api_base)
    headers = build_openai_compatible_headers(api_key)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            request_url,
            headers=headers or None,
            follow_redirects=False,
        )
        if response.status_code == 404:
            return []
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            return []
        models_list = data.get("data", [])
        if not isinstance(models_list, list):
            return []
        return [
            item
            for item in models_list
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        ]


async def fetch_ollama_models(
    *,
    api_base: str,
    api_key: str | None,
    timeout: float = 15.0,
) -> list[dict[str, Any]]:
    request_url = resolve_ollama_tags_endpoint(api_base)
    headers = build_openai_compatible_headers(api_key)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(
            request_url,
            headers=headers or None,
            follow_redirects=True,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            return []
        models_list = data.get("models", [])
        if not isinstance(models_list, list):
            return []

        parsed_models: list[dict[str, Any]] = []
        for model in models_list:
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
            response = None
            for attempt in range(3):
                response = await client.post(
                    request_url,
                    headers=headers or None,
                    json=payload,
                    follow_redirects=False,
                )
                if response.status_code != 429 or attempt == 2:
                    break
                retry_after = response.headers.get("retry-after")
                try:
                    retry_delay = (
                        max(1.0, min(10.0, float(retry_after)))
                        if retry_after
                        else float(attempt + 1)
                    )
                except (TypeError, ValueError):
                    retry_delay = float(attempt + 1)
                await asyncio.sleep(retry_delay)
            assert response is not None
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


async def probe_vision_capability(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    timeout: float = 30.0,
) -> bool:
    tiny_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
        b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    encoded = base64.b64encode(tiny_png).decode("utf-8")
    payload = {
        "model": model_name,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Reply with exactly: VISION_OK"},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{encoded}"},
                    },
                ],
            },
        ],
        "max_tokens": 10,
        "temperature": 0,
    }
    try:
        response = await post_openai_compatible_json(
            api_base=api_base,
            api_key=api_key,
            payload=payload,
            timeout=timeout,
        )
        choices = response.get("choices", [])
        if not isinstance(choices, list) or not choices:
            return False
        first = choices[0] if isinstance(choices[0], dict) else {}
        message = first.get("message", {}) if isinstance(first, dict) else {}
        content = message.get("content", "") if isinstance(message, dict) else ""
        return isinstance(content, str) and "VISION_OK" in content
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in {400, 415, 422}:
            return False
        raise
    except Exception:
        return False


async def probe_ollama_vision_capability(
    *,
    api_base: str,
    api_key: str | None,
    model_name: str,
    timeout: float = 30.0,
) -> bool:
    tiny_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f"
        b"\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    payload = {
        "model": model_name,
        "stream": False,
        "messages": [
            {
                "role": "user",
                "content": "Reply with exactly: VISION_OK",
                "images": [base64.b64encode(tiny_png).decode("utf-8")],
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
