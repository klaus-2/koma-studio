"""IPC gzip middleware: the JSON/accept-encoding/content-encoding gates, the
1 KiB threshold, byte-for-byte pass-through for streaming non-JSON responses,
and the wiring into the real local-api app.

Uses the ASYNC ASGI client for the middleware contract tests and the sync
TestClient (guarded on optional runtime deps) for the real-app wiring.
"""

from __future__ import annotations

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

os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.ipc_compression import IpcGzipMiddleware  # noqa: E402

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
