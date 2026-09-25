from __future__ import annotations

import json
from typing import Any

import httpx

from core.http_retry import post_with_429_retry


async def _http_json_post(
    url: str,
    payload: dict[str, Any] | list[dict[str, str]],
    headers: dict[str, str] | None = None,
    timeout: int = 35,
    max_retries: int = 3,
) -> Any:
    body = json.dumps(payload).encode("utf-8")
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await post_with_429_retry(
            client, url, max_retries=max_retries, headers=req_headers, content=body
        )
        response.raise_for_status()
        return response.json()


async def _http_form_post(
    url: str,
    fields: dict[str, Any],
    headers: dict[str, str] | None = None,
    timeout: int = 35,
    max_retries: int = 3,
) -> Any:
    req_headers: dict[str, str] = {}
    if headers:
        req_headers.update(headers)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await post_with_429_retry(
            client, url, max_retries=max_retries, headers=req_headers, data=fields
        )
        response.raise_for_status()
        return response.json()


async def _http_get_json(
    url: str,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
) -> Any:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()


async def post_llm_json(
    *,
    provider_label: str,
    url: str,
    payload: dict[str, Any],
    headers: dict[str, str] | None = None,
    timeout: int,
) -> Any:
    """The ``try/except HTTPStatusError/RequestError → RuntimeError`` wrapper
    that was copy-pasted into five LLM engines. Messages are unchanged:
    ``"{label} HTTP {status}: {body}"`` / ``"{label} unavailable: {exc}"``.
    """
    try:
        return await _http_json_post(
            url=url, payload=payload, headers=headers, timeout=timeout
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise RuntimeError(
            f"{provider_label} HTTP {exc.response.status_code}: {detail}"
        ) from exc
    except httpx.RequestError as exc:
        raise RuntimeError(f"{provider_label} unavailable: {exc}") from exc
