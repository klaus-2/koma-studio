"""IPC gzip middleware: the JSON/accept-encoding/content-encoding gates, the
1 KiB threshold, byte-for-byte pass-through for streaming non-JSON responses,
and the wiring into the real local-api app.

Uses the ASYNC ASGI client for the middleware contract tests and the sync
TestClient (guarded on optional runtime deps) for the real-app wiring.
"""

from __future__ import annotations

import gzip
import json
import os
import sys
from collections.abc import Iterator
from pathlib import Path
from typing import Final

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from starlette.datastructures import Headers
from starlette.types import Message, Scope

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.ipc_compression import IpcGzipMiddleware, _JsonGzipSender, _accepts_gzip  # noqa: E402

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

_LARGE_PAYLOAD: Final[dict[str, list[dict[str, str]]]] = {
    "items": [
        {"id": f"region-{index:04d}", "text": "onomatopoeia-mask-" * 3}
        for index in range(24)
    ]
}
_LARGE_BODY: Final[bytes] = JSONResponse(_LARGE_PAYLOAD).body
_SMALL_BODY: Final[bytes] = JSONResponse({"healthy": True}).body
_ZIP_CHUNKS: Final[tuple[bytes, ...]] = (
    b"PK\x03\x04" + bytes(range(256)),
    bytes(range(256)) * 3,
    b"PK\x05\x06" + b"\x00" * 18,
)
_ZIP_BODY: Final[bytes] = b"".join(_ZIP_CHUNKS)


def _zip_stream() -> Iterator[bytes]:
    yield from _ZIP_CHUNKS


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(IpcGzipMiddleware)

    @app.get("/large-json")
    async def large_json() -> JSONResponse:
        return JSONResponse(_LARGE_PAYLOAD)

    @app.get("/small-json")
    async def small_json() -> JSONResponse:
        return JSONResponse({"healthy": True})

    @app.get("/batch-zip")
    async def batch_zip() -> StreamingResponse:
        return StreamingResponse(_zip_stream(), media_type="application/zip")

    @app.get("/precompressed-json")
    async def precompressed_json() -> JSONResponse:
        return JSONResponse(_LARGE_PAYLOAD, headers={"content-encoding": "identity"})

    return app


_APP: Final[FastAPI] = _build_app()


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=_APP), base_url="http://test")


async def test_large_json_is_gzipped_when_accepted() -> None:
    async with _client() as client:
        response = await client.get(
            "/large-json", headers={"accept-encoding": "gzip"}
        )
    assert response.status_code == 200
    assert response.headers["content-encoding"] == "gzip"
    assert response.content == _LARGE_BODY
    assert int(response.headers["content-length"]) < len(_LARGE_BODY)
    assert "accept-encoding" in response.headers.get("vary", "").lower()


async def test_large_json_without_gzip_accept_is_unchanged() -> None:
    async with _client() as client:
        response = await client.get(
            "/large-json", headers={"accept-encoding": "identity"}
        )
    assert response.status_code == 200
    assert "content-encoding" not in response.headers
    assert "vary" not in response.headers
    assert int(response.headers["content-length"]) == len(_LARGE_BODY)
    assert response.content == _LARGE_BODY


async def test_small_json_below_threshold_is_not_compressed() -> None:
    async with _client() as client:
        response = await client.get(
            "/small-json", headers={"accept-encoding": "gzip"}
        )
    assert response.status_code == 200
    assert "content-encoding" not in response.headers
    assert "vary" not in response.headers
    assert response.content == _SMALL_BODY


async def test_streaming_zip_passes_through_byte_for_byte() -> None:
    async with _client() as client:
        response = await client.get(
            "/batch-zip", headers={"accept-encoding": "gzip"}
        )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "content-encoding" not in response.headers
    assert "vary" not in response.headers
    assert response.content == _ZIP_BODY


async def test_precompressed_json_response_is_untouched() -> None:
    async with _client() as client:
        response = await client.get(
            "/precompressed-json", headers={"accept-encoding": "gzip"}
        )
    assert response.status_code == 200
    assert response.headers["content-encoding"] == "identity"
    assert "vary" not in response.headers
    assert response.content == _LARGE_BODY


def _scope_with_accept_encoding(value: str) -> Scope:
    return {
        "type": "http",
        "headers": [(b"accept-encoding", value.encode("ascii"))],
    }


def test_bare_gzip_is_accepted() -> None:
    assert _accepts_gzip(_scope_with_accept_encoding("gzip")) is True


def test_q_zero_is_refusal() -> None:
    assert _accepts_gzip(_scope_with_accept_encoding("gzip;q=0")) is False
    assert _accepts_gzip(_scope_with_accept_encoding("gzip;q=0.0")) is False
    assert _accepts_gzip(_scope_with_accept_encoding("gzip;q=0.000")) is False


def test_positive_q_value_compresses() -> None:
    assert _accepts_gzip(_scope_with_accept_encoding("gzip;q=0.5, br")) is True


def test_other_codings_alone_do_not_compress() -> None:
    assert _accepts_gzip(_scope_with_accept_encoding("br")) is False
    assert _accepts_gzip(_scope_with_accept_encoding("identity")) is False
    assert _accepts_gzip(_scope_with_accept_encoding("gzip;q=0, br")) is False


def test_x_gzip_alias_is_accepted() -> None:
    assert _accepts_gzip(_scope_with_accept_encoding("x-gzip")) is True


def test_missing_header_does_not_compress() -> None:
    assert _accepts_gzip({"type": "http", "headers": []}) is False


async def test_gzip_q_zero_request_is_not_compressed() -> None:
    async with _client() as client:
        response = await client.get(
            "/large-json", headers={"accept-encoding": "gzip;q=0, br"}
        )
    assert response.status_code == 200
    assert "content-encoding" not in response.headers
    assert response.content == _LARGE_BODY


async def test_second_start_replaces_aborted_buffered_response() -> None:
    downstream: list[Message] = []

    async def send(message: Message) -> None:
        downstream.append(message)

    first_start: Message = {
        "type": "http.response.start",
        "status": 200,
        "headers": [(b"content-type", b"application/json")],
    }
    error_start: Message = {
        "type": "http.response.start",
        "status": 500,
        "headers": [(b"content-type", b"application/json")],
    }
    error_body = json.dumps({"detail": "boom " * 250}).encode("utf-8")

    sender = _JsonGzipSender(send)
    await sender(first_start)
    await sender({"type": "http.response.body", "body": b"partial", "more_body": True})
    await sender(error_start)
    await sender({"type": "http.response.body", "body": error_body})

    starts = [message for message in downstream if message["type"] == "http.response.start"]
    assert len(starts) == 1
    assert starts[0]["status"] == 500
    bodies = [message for message in downstream if message["type"] == "http.response.body"]
    assert len(bodies) == 1
    assert gzip.decompress(bodies[0]["body"]) == error_body
    headers = Headers(raw=starts[0]["headers"])
    assert headers["content-encoding"] == "gzip"


async def test_messages_after_flushed_response_are_dropped() -> None:
    downstream: list[Message] = []

    async def send(message: Message) -> None:
        downstream.append(message)

    start: Message = {
        "type": "http.response.start",
        "status": 200,
        "headers": [(b"content-type", b"application/json")],
    }
    late_start: Message = {
        "type": "http.response.start",
        "status": 500,
        "headers": [(b"content-type", b"application/json")],
    }
    small_body = b'{"ok": true}'

    sender = _JsonGzipSender(send)
    await sender(start)
    await sender({"type": "http.response.body", "body": small_body})
    await sender(late_start)
    await sender({"type": "http.response.body", "body": b"late"})

    assert [message["type"] for message in downstream] == [
        "http.response.start",
        "http.response.body",
    ]
    bodies = [message for message in downstream if message["type"] == "http.response.body"]
    assert bodies[0]["body"] == small_body


@pytest.mark.skipif(
    IMPORT_ERROR is not None,
    reason=f"optional runtime dependencies missing: {IMPORT_ERROR}",
)
def test_local_api_app_registers_ipc_gzip_middleware() -> None:
    assert any(
        middleware.cls is IpcGzipMiddleware
        for middleware in mini_app.app.user_middleware
    )
    client = TestClient(mini_app.app)
    response = client.get("/health")
    assert response.status_code == 200
    assert "content-encoding" not in response.headers
