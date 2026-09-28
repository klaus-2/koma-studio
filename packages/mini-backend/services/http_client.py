"""Shared httpx client: pools TLS/keep-alive connections across provider calls."""

from __future__ import annotations

import httpx

_SHARED_CLIENT: httpx.AsyncClient | None = None


def get_shared_client() -> httpx.AsyncClient:
    global _SHARED_CLIENT
    if _SHARED_CLIENT is None or _SHARED_CLIENT.is_closed:
        _SHARED_CLIENT = httpx.AsyncClient(
            timeout=httpx.Timeout(180.0),
            limits=httpx.Limits(max_connections=20),
        )
    return _SHARED_CLIENT


async def close_shared_client() -> None:
    global _SHARED_CLIENT
    if _SHARED_CLIENT is not None and not _SHARED_CLIENT.is_closed:
        await _SHARED_CLIENT.aclose()
    _SHARED_CLIENT = None
