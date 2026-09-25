from __future__ import annotations

import asyncio
from typing import Any

import httpx


def retry_delay_seconds(retry_after: str | None, attempt: int) -> float:
    # Identical to the inlined logic previously duplicated in
    # models/translation/providers.py (_http_json_post, _http_form_post) and
    # services/openai_compatible.py (post_openai_compatible_json).
    try:
        return (
            max(1.0, min(10.0, float(retry_after)))
            if retry_after
            else float(attempt + 1)
        )
    except (TypeError, ValueError):
        return float(attempt + 1)


async def post_with_429_retry(
    client: httpx.AsyncClient,
    url: str,
    *,
    max_retries: int = 3,
    **request_kwargs: Any,
) -> httpx.Response:
    """POST with the project's 429 back-off. Returns the final response
    un-raised so callers keep their own raise_for_status / redirect handling.

    ``request_kwargs`` is passed straight to ``client.post`` so callers keep
    their exact wire format (``content=`` vs ``json=`` vs ``data=``).
    """
    response: httpx.Response | None = None
    for attempt in range(max_retries):
        response = await client.post(url, **request_kwargs)
        if response.status_code != 429 or attempt == max_retries - 1:
            break
        await asyncio.sleep(
            retry_delay_seconds(response.headers.get("retry-after"), attempt)
        )
    assert response is not None
    return response
