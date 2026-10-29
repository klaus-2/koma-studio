from __future__ import annotations

import asyncio
from typing import Any

import httpx

_MIN_RETRY_AFTER_SECONDS = 1.0
_MAX_RETRY_AFTER_SECONDS = 10.0

# Statuses worth another POST: rate limiting plus the transient gateway codes
# (bad gateway / unavailable / gateway timeout). 500 is deliberately excluded —
# it is just as likely a deterministic server bug as a blip, and retrying it
# only adds latency to a request that will fail again.
_TRANSIENT_STATUS_CODES = frozenset({429, 502, 503, 504})


def retry_delay_seconds(retry_after: str | None, attempt: int) -> float:
    """Delay before retry *attempt* (0-based), honoring a numeric Retry-After."""
    fallback = float(attempt + 1)
    if not retry_after:
        return fallback
    try:
        return max(_MIN_RETRY_AFTER_SECONDS, min(_MAX_RETRY_AFTER_SECONDS, float(retry_after)))
    except ValueError:
        return fallback


async def post_with_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_retries: int = 3,
    # `Any` is deliberate: kwargs are forwarded verbatim to httpx so callers keep
    # their exact wire format (content= / json= / data=); httpx types them itself.
    **request_kwargs: Any,  # noqa: ANN401
) -> httpx.Response:
    """POST with back-off on 429 and the transient gateway codes (502/503/504).

    Returns the final response un-raised so callers keep their own
    raise_for_status / redirect handling.
    """
    attempts = max(1, max_retries)
    attempt = 0
    while True:
        response = await client.post(url, **request_kwargs)
        attempt += 1
        if response.status_code not in _TRANSIENT_STATUS_CODES or attempt >= attempts:
            return response
        await asyncio.sleep(
            retry_delay_seconds(response.headers.get("retry-after"), attempt - 1)
        )
