from __future__ import annotations

import asyncio
from typing import Any

import httpx

_MIN_RETRY_AFTER_SECONDS = 1.0
_MAX_RETRY_AFTER_SECONDS = 10.0


def retry_delay_seconds(retry_after: str | None, attempt: int) -> float:
    """Delay before retry *attempt* (0-based), honoring a numeric Retry-After."""
    fallback = float(attempt + 1)
    if not retry_after:
        return fallback
    try:
        return max(_MIN_RETRY_AFTER_SECONDS, min(_MAX_RETRY_AFTER_SECONDS, float(retry_after)))
    except ValueError:
        return fallback


async def post_with_429_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_retries: int = 3,
    # `Any` is deliberate: kwargs are forwarded verbatim to httpx so callers keep
    # their exact wire format (content= / json= / data=); httpx types them itself.
    **request_kwargs: Any,  # noqa: ANN401
) -> httpx.Response:
    """POST with 429 back-off. Returns the final response un-raised so callers
    keep their own raise_for_status / redirect handling."""
    attempts = max(1, max_retries)
    attempt = 0
    while True:
        response = await client.post(url, **request_kwargs)
        attempt += 1
        if response.status_code != 429 or attempt >= attempts:
            return response
        await asyncio.sleep(
            retry_delay_seconds(response.headers.get("retry-after"), attempt - 1)
        )
