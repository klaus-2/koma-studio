"""Retry behavior of the shared translation HTTP layer (core.http_retry).

The local LLM routers providers talk to re-arm their own failover budget per
request, so a 502 is frequently transient: one retry is a real second chance.
429 keeps its Retry-After back-off; 500 stays non-retryable because it is just
as likely a deterministic server bug as a blip.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import httpx
import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.http_retry import post_with_retry, retry_delay_seconds  # noqa: E402

REQUEST_URL = "https://unit.test/v1/chat/completions"


def _response(status: int, retry_after: str | None = None) -> httpx.Response:
    headers = {"retry-after": retry_after} if retry_after else {}
    return httpx.Response(status, headers=headers, request=httpx.Request("POST", REQUEST_URL))


class _FakeClient:
    """Replays a scripted sequence of responses, recording every POST."""

    def __init__(self, *scripted: httpx.Response) -> None:
        self._scripted = list(scripted)
        self.calls: list[dict[str, Any]] = []

    async def post(self, url: str, **kwargs: Any) -> httpx.Response:
        self.calls.append({"url": url, **kwargs})
        return self._scripted.pop(0)


@pytest.fixture
def recorded_sleeps(monkeypatch: pytest.MonkeyPatch) -> list[float]:
    delays: list[float] = []

    async def _fake_sleep(seconds: float) -> None:
        delays.append(seconds)

    monkeypatch.setattr("core.http_retry.asyncio.sleep", _fake_sleep)
    return delays


async def test_retries_a_502_and_returns_the_next_response(
    recorded_sleeps: list[float],
) -> None:
    client = _FakeClient(_response(502), _response(200))

    response = await post_with_retry(client, REQUEST_URL, max_retries=3)

    assert response.status_code == 200
    assert len(client.calls) == 2
    assert recorded_sleeps == [1.0]


async def test_retries_every_transient_gateway_code(
    recorded_sleeps: list[float],
) -> None:
    client = _FakeClient(
        _response(502), _response(503), _response(504), _response(200)
    )

    response = await post_with_retry(client, REQUEST_URL, max_retries=4)

    assert response.status_code == 200
    assert len(client.calls) == 4
    assert recorded_sleeps == [1.0, 2.0, 3.0]


async def test_honors_a_numeric_retry_after_header(
    recorded_sleeps: list[float],
) -> None:
    client = _FakeClient(_response(429, retry_after="2.5"), _response(200))

    response = await post_with_retry(client, REQUEST_URL, max_retries=3)

    assert response.status_code == 200
    assert recorded_sleeps == [2.5]


async def test_returns_the_last_response_once_attempts_are_exhausted(
    recorded_sleeps: list[float],
) -> None:
    client = _FakeClient(_response(502), _response(503), _response(502))

    response = await post_with_retry(client, REQUEST_URL, max_retries=3)

    assert response.status_code == 502
    assert len(client.calls) == 3
    assert recorded_sleeps == [1.0, 2.0]


async def test_a_500_is_returned_without_retrying(recorded_sleeps: list[float]) -> None:
    client = _FakeClient(_response(500), _response(200))

    response = await post_with_retry(client, REQUEST_URL, max_retries=3)

    assert response.status_code == 500
    assert len(client.calls) == 1, "500 may be a deterministic server bug"
    assert recorded_sleeps == []


async def test_max_retries_of_one_never_sleeps(recorded_sleeps: list[float]) -> None:
    client = _FakeClient(_response(502))

    response = await post_with_retry(client, REQUEST_URL, max_retries=1)

    assert response.status_code == 502
    assert len(client.calls) == 1
    assert recorded_sleeps == []


def test_retry_delay_clamps_the_retry_after_header() -> None:
    assert retry_delay_seconds(None, 0) == 1.0
    assert retry_delay_seconds(None, 4) == 5.0
    assert retry_delay_seconds("0.2", 0) == 1.0, "sub-second values clamp to the minimum"
    assert retry_delay_seconds("99", 0) == 10.0, "huge values clamp to the maximum"
    assert retry_delay_seconds("soon", 2) == 3.0, "garbage falls back to attempt spacing"


async def test_request_kwargs_reach_the_client_verbatim() -> None:
    client = _FakeClient(_response(200))

    await post_with_retry(
        client,
        REQUEST_URL,
        max_retries=2,
        headers={"Authorization": "Bearer k"},
        content=b"{}",
        timeout=httpx.Timeout(5.0),
    )

    call = client.calls[0]
    assert call["headers"] == {"Authorization": "Bearer k"}
    assert call["content"] == b"{}"


async def test_post_json_retries_a_gateway_502_from_the_local_router(
    recorded_sleeps: list[float],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The reported failure mode: the local LLM router answers 502 once and the
    same request succeeds when the router's own failover chain gets another run."""
    from models.translation import http as translation_http

    requests_seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests_seen.append(request)
        if len(requests_seen) == 1:
            return httpx.Response(
                502,
                json={"error": {"message": "All 2 routed attempt(s) failed with upstream provider errors"}},
            )
        return httpx.Response(200, json={"choices": [{"message": {"content": "olá"}}]})

    transport_client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(translation_http, "get_http_client", lambda: transport_client)

    try:
        result = await translation_http.post_json(
            provider_label="Custom AI",
            url="http://127.0.0.1:31415/v1/chat/completions",
            payload={"model": "test-model", "messages": []},
            timeout=5.0,
        )
    finally:
        await transport_client.aclose()

    assert result == {"choices": [{"message": {"content": "olá"}}]}
    assert len(requests_seen) == 2, "the 502 must be retried once before success"
    assert recorded_sleeps == [1.0]
