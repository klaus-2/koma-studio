from __future__ import annotations

import ipaddress
from typing import Any
from urllib import parse


_HUGGINGFACE_ROUTER_API_BASE = "https://router.huggingface.co/v1"


def _extract_huggingface_model_from_legacy_api_base(api_base: str) -> str | None:
    parsed = parse.urlparse(api_base)
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


def _normalize_openai_compatible_api_base(api_base: str) -> str:
    normalized = str(api_base or "").strip().rstrip("/")
    if _extract_huggingface_model_from_legacy_api_base(normalized):
        return _HUGGINGFACE_ROUTER_API_BASE
    return normalized


def _resolve_openai_compatible_chat_url(api_base: str) -> str:
    normalized = _normalize_openai_compatible_api_base(api_base)
    if normalized.lower().endswith("/chat/completions"):
        return normalized
    return f"{normalized}/chat/completions"


def _is_ollama_cloud_host(api_base: str) -> bool:
    hostname = (parse.urlparse(api_base).hostname or "").strip().lower()
    return hostname in {"ollama.com", "api.ollama.com"}


def _resolve_ollama_chat_url(api_base: str) -> str:
    normalized = str(api_base or "").strip().rstrip("/")
    if normalized.lower().endswith("/api/chat"):
        return normalized
    if normalized.lower().endswith("/api"):
        return f"{normalized}/chat"
    return f"{normalized}/api/chat"


def _is_loopback_host(hostname: str) -> bool:
    host = str(hostname or "").strip().lower()
    if host in {"localhost", "::1"}:
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _is_private_or_internal_host(hostname: str) -> bool:
    host = str(hostname or "").strip().lower()
    if not host:
        return True
    if host.endswith(".local") or host.endswith(".internal"):
        return True
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return (
        ip.is_private
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def resolve_request_custom_openai_config(
    custom_llm: dict[str, Any] | None,
) -> dict[str, str]:
    payload = custom_llm or {}
    api_key = str(payload.get("api_key") or payload.get("apiKey") or "").strip()
    api_base = str(
        payload.get("api_base")
        or payload.get("apiBase")
        or payload.get("base_url")
        or payload.get("baseUrl")
        or ""
    ).strip()
    model = str(payload.get("model") or "").strip()

    if not api_base or not model:
        raise RuntimeError("Custom AI requires api_base and model.")

    parsed = parse.urlparse(api_base)
    if parsed.scheme not in {"http", "https"}:
        raise RuntimeError("Custom AI requires an http:// or https:// URL.")
    if not parsed.hostname:
        raise RuntimeError("Invalid host for Custom AI.")
    if parsed.username or parsed.password:
        raise RuntimeError(
            "Credentials embedded in the Custom AI URL are not allowed."
        )

    hostname = (parsed.hostname or "").strip().lower()
    if _is_loopback_host(hostname):
        normalized_loopback = parsed._replace(
            params="", query="", fragment="", path=(parsed.path or "").rstrip("/")
        )
        return {
            "api_key": api_key,
            "api_base": parse.urlunparse(normalized_loopback),
            "model": model,
        }

    if _is_private_or_internal_host(hostname):
        raise RuntimeError(
            "Private/internal hosts are not allowed for local Custom AI. Use loopback (localhost/127.0.0.1/::1)."
        )
    if parsed.scheme != "https":
        raise RuntimeError("Remote Custom AI requires HTTPS.")

    normalized_remote = parsed._replace(
        params="", query="", fragment="", path=(parsed.path or "").rstrip("/")
    )
    return {
        "api_key": api_key,
        "api_base": parse.urlunparse(normalized_remote),
        "model": model,
    }
