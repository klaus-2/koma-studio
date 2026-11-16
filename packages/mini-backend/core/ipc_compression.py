"""Pure-ASGI gzip middleware scoped to application/json responses.

Compresses only when the response content-type is application/json, no
content-encoding is set, and the request accepts gzip; non-JSON and
pre-compressed responses (including the streamed batch ZIP) pass through
byte-for-byte.
"""

from __future__ import annotations

import gzip
from typing import Final

from starlette.datastructures import Headers, MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_COMPRESS_LEVEL: Final = 6
_MINIMUM_BYTES: Final = 1024
_JSON_MEDIA_TYPE: Final = "application/json"
_GZIP_TOKENS: Final[frozenset[str]] = frozenset({"gzip", "x-gzip"})


def _accepts_gzip(scope: Scope) -> bool:
    header = Headers(scope=scope).get("accept-encoding", "").lower()
    for element in header.split(","):
        token = element.split(";", 1)[0].strip()
        if token not in _GZIP_TOKENS:
            continue
        if _is_q_zero(element):
            continue
        return True
    return False


def _is_q_zero(element: str) -> bool:
    for param in element.split(";")[1:]:
        name, _, value = param.strip().partition("=")
        if name.strip().lower() != "q":
            continue
        try:
            return float(value.strip()) == 0.0
        except ValueError:
            return False
    return False


def _is_compressible(message: Message) -> bool:
    headers = Headers(raw=message["headers"])
    return headers.get("content-type", "").startswith(_JSON_MEDIA_TYPE) and (
        "content-encoding" not in headers
    )


class _JsonGzipSender:
    """Buffers one compressible JSON response. A second start (an error
    response replacing an aborted attempt) restarts buffering; messages
    after the flushed body are dropped, never re-sent downstream."""

    __slots__ = (
        "_chunks",
        "_completed",
        "_downstream",
        "_passthrough",
        "_start_message",
    )

    def __init__(self, downstream: Send) -> None:
        self._downstream = downstream
        self._passthrough = False
        self._completed = False
        self._start_message: Message | None = None
        self._chunks: list[bytes] = []

    async def __call__(self, message: Message) -> None:
        if self._passthrough:
            await self._downstream(message)
            return
        if self._completed:
            return
        if message["type"] == "http.response.start":
            if self._start_message is not None:
                self._chunks.clear()
            if _is_compressible(message):
                self._start_message = message
            else:
                self._start_message = None
                self._passthrough = True
                await self._downstream(message)
            return
        if message["type"] != "http.response.body":
            await self._downstream(message)
            return
        start_message = self._start_message
        if start_message is None:
            await self._downstream(message)
            return
        self._chunks.append(bytes(message.get("body", b"")))
        if bool(message.get("more_body", False)):
            return
        self._completed = True
        body = b"".join(self._chunks)
        if len(body) >= _MINIMUM_BYTES:
            body = gzip.compress(body, compresslevel=_COMPRESS_LEVEL)
            headers = MutableHeaders(raw=start_message["headers"])
            headers["content-encoding"] = "gzip"
            headers["content-length"] = str(len(body))
            headers.add_vary_header("Accept-Encoding")
        await self._downstream(start_message)
        await self._downstream({"type": "http.response.body", "body": body})


class IpcGzipMiddleware:
    """Gzip-compress application/json responses when the client accepts gzip."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not _accepts_gzip(scope):
            await self.app(scope, receive, send)
            return
        await self.app(scope, receive, _JsonGzipSender(send))
