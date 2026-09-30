"""Shared, pooled HTTP client for translation providers with uniform error mapping."""

from __future__ import annotations

import asyncio
import json
from collections.abc import Awaitable, Callable, Mapping, Sequence
from typing import Any

import httpx

from core.http_retry import post_with_429_retry
from models.translation.errors import (
    TranslatorResponseError,
    TranslatorUnavailableError,
)
from models.translation.json_types import JsonValue

type JsonPayload = Mapping[str, object] | Sequence[Mapping[str, object]]
type FormFields = Mapping[str, str | list[str]]

_ERROR_DETAIL_MAX_CHARS = 512
_DEFAULT_TIMEOUT = httpx.Timeout(35.0)
_POOL_LIMITS = httpx.Limits(max_connections=32, max_keepalive_connections=16)


class _SharedClient:
    """One pooled client per event loop.

    Pooled connections are bound to the loop that opened them; keying on the
    running loop keeps test runners that spin a fresh loop per test safe.
    """

    __slots__ = ("_client", "_loop")

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def get(self) -> httpx.AsyncClient:
        loop = asyncio.get_running_loop()
        if self._client is None or self._client.is_closed or self._loop is not loop:
            self._client = httpx.AsyncClient(
                timeout=_DEFAULT_TIMEOUT,
                limits=_POOL_LIMITS,
                follow_redirects=False,
            )
            self._loop = loop
        return self._client

    async def aclose(self) -> None:
        client, self._client, self._loop = self._client, None, None
        if client is not None and not client.is_closed:
            await client.aclose()


_shared_client = _SharedClient()


def get_http_client() -> httpx.AsyncClient:
    return _shared_client.get()


async def aclose_http_client() -> None:
    """Call from the application lifespan shutdown."""
    await _shared_client.aclose()


def _truncate_detail(detail: str) -> str:
    compact = " ".join(detail.split())
    if len(compact) <= _ERROR_DETAIL_MAX_CHARS:
        return compact
    return f"{compact[:_ERROR_DETAIL_MAX_CHARS]}…"


async def _send(
    provider_label: str,
    send: Callable[[httpx.AsyncClient], Awaitable[httpx.Response]],
) -> JsonValue:
    client = get_http_client()
    try:
        response = await send(client)
        response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        raise TranslatorResponseError(
            provider_label, exc.response.status_code, _truncate_detail(exc.response.text)
        ) from exc
    except httpx.RequestError as exc:
        # Only the exception class is surfaced: request URLs may carry credentials.
        raise TranslatorUnavailableError(provider_label, type(exc).__name__) from exc
    try:
        decoded: JsonValue = response.json()
    except ValueError as exc:
        raise TranslatorResponseError(
            provider_label, response.status_code, "response body is not valid JSON"
        ) from exc
    return decoded


async def post_json(
    *,
    provider_label: str,
    url: str,
    payload: JsonPayload,
    headers: Mapping[str, str] | None = None,
    timeout: float,
    max_retries: int = 3,
) -> JsonValue:
    body = json.dumps(payload).encode("utf-8")
    request_headers = {"Content-Type": "application/json", **(headers or {})}
    return await _send(
        provider_label,
        lambda client: post_with_429_retry(
            client,
            url,
            max_retries=max_retries,
            headers=request_headers,
            content=body,
            timeout=httpx.Timeout(timeout),
        ),
    )


async def post_form(
    *,
    provider_label: str,
    url: str,
    fields: FormFields,
    headers: Mapping[str, str] | None = None,
    timeout: float,
    max_retries: int = 3,
) -> JsonValue:
    return await _send(
        provider_label,
        lambda client: post_with_429_retry(
            client,
            url,
            max_retries=max_retries,
            headers=dict(headers or {}),
            data=dict(fields),
            timeout=httpx.Timeout(timeout),
        ),
    )


async def get_json(
    *,
    provider_label: str,
    url: str,
    headers: Mapping[str, str] | None = None,
    timeout: float = 20.0,
) -> JsonValue:
    return await _send(
        provider_label,
        lambda client: client.get(
            url, headers=dict(headers or {}), timeout=httpx.Timeout(timeout)
        ),
    )


# --- legacy one-shot helpers (pre-pool). Engines use post_json/post_form/get_json;
# these remain for external callers and keep the historical error messages. ----


async def _http_json_post(
    url: str,
    payload: JsonPayload,
    headers: Mapping[str, str] | None = None,
    timeout: float = 35,
    max_retries: int = 3,
) -> Any:
    return await post_json(
        provider_label="LLM",
        url=url,
        payload=payload,
        headers=headers,
        timeout=timeout,
        max_retries=max_retries,
    )


async def _http_form_post(
    url: str,
    fields: FormFields,
    headers: Mapping[str, str] | None = None,
    timeout: float = 35,
    max_retries: int = 3,
) -> Any:
    return await post_form(
        provider_label="MT",
        url=url,
        fields=fields,
        headers=headers,
        timeout=timeout,
        max_retries=max_retries,
    )


async def _http_get_json(
    url: str,
    headers: Mapping[str, str] | None = None,
    timeout: float = 20,
) -> Any:
    return await get_json(provider_label="HTTP", url=url, headers=headers, timeout=timeout)
