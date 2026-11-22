from __future__ import annotations

import base64
import json
import sys
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

import services.image_edit_protocols as protocols  # noqa: E402
from services.image_edit_protocols import (  # noqa: E402
    ImageEditProtocolError,
    call_cloudflare_clean,
    call_fal_clean,
    call_replicate_clean,
    call_stability_clean,
)

_1X1_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
_1X1_PNG = base64.b64decode(_1X1_PNG_B64)
_HEX_VERSION = "ab" * 32
_FAL_MODEL = "fal-ai/nano-banana/edit"


def _data_uri(data: bytes) -> str:
    return f"data:image/png;base64,{base64.b64encode(data).decode('utf-8')}"


@pytest.fixture(autouse=True)
def _reset_replicate_version_cache() -> None:
    protocols._REPLICATE_VERSION_CACHE.clear()


@pytest.fixture(autouse=True)
def _instant_poll_sleep(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _instant(_seconds: float) -> None:
        return None

    monkeypatch.setattr(protocols, "_polite_sleep", _instant)


@pytest.fixture(autouse=True)
def _allow_download_hosts(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _public(_host: str) -> bool:
        return True

    monkeypatch.setattr(protocols, "_resolves_to_public_ip", _public)


def _use_client(
    monkeypatch: pytest.MonkeyPatch,
    handler: Callable[[httpx.Request], httpx.Response],
) -> None:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(protocols, "get_shared_client", lambda: client)


# --------------------------------------------------------------------------- #
# Replicate
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_replicate_success_with_explicit_hex_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/predictions":
            captured["auth"] = request.headers.get("authorization")
            captured["prefer"] = request.headers.get("prefer")
            captured["payload"] = json.loads(request.content.decode("utf-8"))
            return httpx.Response(
                200,
                json={"id": "p1", "status": "succeeded", "output": ["https://cdn.example.com/out.png"]},
            )
        return httpx.Response(200, content=_1X1_PNG, headers={"content-type": "image/png"})

    _use_client(monkeypatch, handler)
    result = await call_replicate_clean(
        api_base="https://api.replicate.com/v1",
        api_key="r8_token",
        model_name=f"acme/eraser:{_HEX_VERSION}",
        system_prompt="system-prompt",
        user_prompt="user-prompt",
        image_bytes=_1X1_PNG,
    )

    assert result == _1X1_PNG
    assert captured["auth"] == "Bearer r8_token"
    assert captured["prefer"] == "wait"
    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["version"] == _HEX_VERSION
    image_value = payload["input"]["image"]
    assert image_value == _data_uri(_1X1_PNG)
    assert "system-prompt" in payload["input"]["prompt"]
    assert "user-prompt" in payload["input"]["prompt"]


@pytest.mark.asyncio
async def test_replicate_community_model_resolves_latest_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    model_gets: list[str] = []
    prediction_versions: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/models/acme/eraser":
            model_gets.append(str(request.url))
            return httpx.Response(
                200, json={"latest_version": {"id": "ver123abc"}}
            )
        if request.url.path == "/v1/predictions":
            prediction_versions.append(json.loads(request.content)["version"])
            return httpx.Response(
                200,
                json={"status": "succeeded", "output": ["https://cdn.example.com/out.png"]},
            )
        return httpx.Response(200, content=_1X1_PNG, headers={"content-type": "image/png"})

    _use_client(monkeypatch, handler)
    for _ in range(2):
        result = await call_replicate_clean(
            api_base="https://api.replicate.com",
            api_key="r8_token",
            model_name="acme/eraser",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
        assert result == _1X1_PNG
    assert prediction_versions == ["ver123abc", "ver123abc"]
    assert len(model_gets) == 1  # latest_version is cached per model


@pytest.mark.asyncio
async def test_replicate_non_hex_suffix_resolves_latest_version(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    prediction_versions: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/models/acme/eraser":
            return httpx.Response(200, json={"latest_version": {"id": "ver123abc"}})
        if request.url.path == "/v1/predictions":
            prediction_versions.append(json.loads(request.content)["version"])
            return httpx.Response(
                200,
                json={"status": "succeeded", "output": "https://cdn.example.com/out.png"},
            )
        return httpx.Response(200, content=_1X1_PNG, headers={"content-type": "image/png"})

    _use_client(monkeypatch, handler)
    result = await call_replicate_clean(
        api_base="https://api.replicate.com",
        api_key="r8_token",
        model_name="acme/eraser:dev",
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG
    assert prediction_versions == ["ver123abc"]


@pytest.mark.asyncio
async def test_replicate_polls_until_succeeded(monkeypatch: pytest.MonkeyPatch) -> None:
    poll_bodies: list[dict[str, object]] = [
        {"status": "processing"},
        {"status": "succeeded", "output": "https://cdn.example.com/out.png"},
    ]

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST" and request.url.path == "/v1/predictions":
            return httpx.Response(
                200,
                json={
                    "id": "p1",
                    "status": "starting",
                    "urls": {"get": "https://api.replicate.com/v1/predictions/p1"},
                },
            )
        if request.url.path == "/v1/predictions/p1":
            return httpx.Response(200, json=poll_bodies.pop(0))
        return httpx.Response(200, content=_1X1_PNG, headers={"content-type": "image/png"})

    _use_client(monkeypatch, handler)
    result = await call_replicate_clean(
        api_base="https://api.replicate.com",
        api_key="r8_token",
        model_name=f"acme/eraser:{_HEX_VERSION}",
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "poll_origin",
    ["https://evil.example/poll", "http://127.0.0.1:9/poll"],
    ids=["cross-origin", "loopback"],
)
async def test_replicate_polling_refuses_off_provider_hosts(
    monkeypatch: pytest.MonkeyPatch, poll_origin: str
) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        if request.method == "POST" and request.url.path == "/v1/predictions":
            return httpx.Response(
                200,
                json={"id": "p1", "status": "starting", "urls": {"get": poll_origin}},
            )
        return httpx.Response(200, json={"status": "succeeded"})

    _use_client(monkeypatch, handler)
    with pytest.raises(ImageEditProtocolError, match="must stay on the configured provider host"):
        await call_replicate_clean(
            api_base="https://api.replicate.com",
            api_key="r8_token",
            model_name=f"acme/eraser:{_HEX_VERSION}",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    # The Authorization header never reached the rejected origin.
    assert all(request.url.host != httpx.URL(poll_origin).host for request in seen)


@pytest.mark.asyncio
async def test_fal_queue_polling_refuses_cross_origin_status_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(
            200,
            json={
                "status_url": "https://evil.example/requests/r1/status",
                "response_url": "https://queue.fal.run/requests/r1",
            },
        )

    _use_client(monkeypatch, handler)
    with pytest.raises(ImageEditProtocolError, match="must stay on the configured provider host"):
        await call_fal_clean(
            api_base="https://fal.run",
            api_key="fal_key",
            model_name="fal-ai/nano-banana/edit",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert all(request.url.host != "evil.example" for request in seen)


@pytest.mark.asyncio
async def test_replicate_failed_prediction_reports_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "failed", "error": "model billing issue"})

    _use_client(monkeypatch, handler)
    with pytest.raises(ImageEditProtocolError) as exc_info:
        await call_replicate_clean(
            api_base="https://api.replicate.com",
            api_key="r8_token",
            model_name=f"acme/eraser:{_HEX_VERSION}",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert "failed" in str(exc_info.value)
    assert "model billing issue" in str(exc_info.value)


@pytest.mark.asyncio
async def test_replicate_polling_deadline_exceeded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(protocols, "_POLL_DEADLINE_SECONDS", 0.0)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(
                200,
                json={
                    "status": "starting",
                    "urls": {"get": "https://api.replicate.com/v1/predictions/p1"},
                },
            )
        return httpx.Response(200, json={"status": "processing"})

    _use_client(monkeypatch, handler)
    with pytest.raises(ImageEditProtocolError) as exc_info:
        await call_replicate_clean(
            api_base="https://api.replicate.com",
            api_key="r8_token",
            model_name=f"acme/eraser:{_HEX_VERSION}",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert "did not finish within" in str(exc_info.value)


@pytest.mark.asyncio
async def test_replicate_large_image_uploads_via_files(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    big_image = b"\x89PNG\r\n\x1a\n" + b"0" * (700 * 1024 + 16)
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/files":
            assert b'name="content"' in request.content
            return httpx.Response(
                200, json={"id": "f1", "urls": {"get": "https://api.replicate.com/v1/files/f1"}}
            )
        if request.url.path == "/v1/predictions":
            payload = json.loads(request.content)
            captured["input_image"] = payload["input"]["image"]
            return httpx.Response(
                200,
                json={"status": "succeeded", "output": ["https://cdn.example.com/out.png"]},
            )
        return httpx.Response(200, content=_1X1_PNG, headers={"content-type": "image/png"})

    _use_client(monkeypatch, handler)
    result = await call_replicate_clean(
        api_base="https://api.replicate.com",
        api_key="r8_token",
        model_name=f"acme/eraser:{_HEX_VERSION}",
        system_prompt="s",
        user_prompt="u",
        image_bytes=big_image,
    )
    assert result == _1X1_PNG
    assert captured["input_image"] == "https://api.replicate.com/v1/files/f1"


@pytest.mark.asyncio
async def test_replicate_401_propagates_as_status_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "Invalid token."})

    _use_client(monkeypatch, handler)
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await call_replicate_clean(
            api_base="https://api.replicate.com",
            api_key="bad-token",
            model_name="acme/eraser",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert exc_info.value.response.status_code == 401


# --------------------------------------------------------------------------- #
# fal.ai
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_fal_sync_inline_data_uri(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["payload"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(
            200, json={"images": [{"url": _data_uri(_1X1_PNG)}]}
        )

    _use_client(monkeypatch, handler)
    result = await call_fal_clean(
        api_base="https://fal.run",
        api_key="fal-key",
        model_name=_FAL_MODEL,
        system_prompt="system-prompt",
        user_prompt="user-prompt",
        image_bytes=_1X1_PNG,
    )

    assert result == _1X1_PNG
    assert captured["url"] == f"https://fal.run/{_FAL_MODEL}"
    assert captured["auth"] == "Key fal-key"
    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["sync_mode"] is True
    assert payload["image_urls"][0] == _data_uri(_1X1_PNG)
    assert "system-prompt" in payload["prompt"]
    assert "user-prompt" in payload["prompt"]


@pytest.mark.asyncio
async def test_fal_sync_url_downloads(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "v3.fal.media":
            return httpx.Response(200, content=_1X1_PNG, headers={"content-type": "image/png"})
        return httpx.Response(200, json={"images": [{"url": "https://v3.fal.media/out.png"}]})

    _use_client(monkeypatch, handler)
    result = await call_fal_clean(
        api_base="https://fal.run",
        api_key="fal-key",
        model_name=_FAL_MODEL,
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG


@pytest.mark.asyncio
async def test_fal_queue_mode_polls_until_completed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    status_bodies: list[dict[str, object]] = [
        {"status": "IN_QUEUE"},
        {"status": "IN_PROGRESS"},
        {"status": "COMPLETED"},
    ]
    status_auths: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/status"):
            status_auths.append(request.headers.get("authorization", ""))
            return httpx.Response(200, json=status_bodies.pop(0))
        if request.url.path == "/requests/r1":
            return httpx.Response(
                200, json={"images": [{"url": "https://v3.fal.media/ok.png"}]}
            )
        if request.url.host == "v3.fal.media":
            return httpx.Response(200, content=_1X1_PNG, headers={"content-type": "image/png"})
        return httpx.Response(
            200,
            json={
                "status_url": "https://queue.fal.run/requests/r1/status",
                "response_url": "https://queue.fal.run/requests/r1",
            },
        )

    _use_client(monkeypatch, handler)
    result = await call_fal_clean(
        api_base="https://queue.fal.run",
        api_key="fal-key",
        model_name=_FAL_MODEL,
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG
    assert status_auths == ["Key fal-key"] * 3


@pytest.mark.asyncio
async def test_fal_queue_error_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/status"):
            return httpx.Response(
                200, json={"status": "IN_QUEUE", "error": "spending limit reached"}
            )
        return httpx.Response(
            200, json={"status_url": "https://queue.fal.run/requests/r1/status"}
        )

    _use_client(monkeypatch, handler)
    with pytest.raises(ImageEditProtocolError) as exc_info:
        await call_fal_clean(
            api_base="https://queue.fal.run",
            api_key="fal-key",
            model_name=_FAL_MODEL,
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert "spending limit" in str(exc_info.value)


@pytest.mark.asyncio
async def test_fal_422_propagates_as_status_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            422,
            json={"detail": [{"loc": ["prompt"], "msg": "field required", "type": "missing"}]},
        )

    _use_client(monkeypatch, handler)
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await call_fal_clean(
            api_base="https://fal.run",
            api_key="fal-key",
            model_name=_FAL_MODEL,
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert exc_info.value.response.status_code == 422


@pytest.mark.asyncio
async def test_fal_missing_images_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    _use_client(monkeypatch, lambda _request: httpx.Response(200, json={}))
    with pytest.raises(ImageEditProtocolError) as exc_info:
        await call_fal_clean(
            api_base="https://fal.run",
            api_key="fal-key",
            model_name=_FAL_MODEL,
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert "did not return an edited image" in str(exc_info.value)


# --------------------------------------------------------------------------- #
# Stability AI
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_stability_multipart_binary_and_json_response(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["accept"] = request.headers.get("accept")
        captured["auth"] = request.headers.get("authorization")
        body = request.read()
        captured["has_image_field"] = b'name="image"' in body
        captured["has_png_bytes"] = _1X1_PNG in body
        captured["has_prompt"] = b"system-prompt" in body and b"user-prompt" in body
        captured["has_output_format"] = b'name="output_format"' in body and b"png" in body
        return httpx.Response(
            200, json={"image": _1X1_PNG_B64, "finish_reason": "SUCCESS"}
        )

    _use_client(monkeypatch, handler)
    result = await call_stability_clean(
        api_base="https://api.stability.ai",
        api_key="sk-stability",
        model_name="search-and-replace",
        system_prompt="system-prompt",
        user_prompt="user-prompt",
        image_bytes=_1X1_PNG,
    )

    assert result == _1X1_PNG
    assert captured["url"] == "https://api.stability.ai/v2beta/stable-image/edit/search-and-replace"
    assert captured["accept"] == "application/json"
    assert captured["auth"] == "Bearer sk-stability"
    assert captured["has_image_field"]
    assert captured["has_png_bytes"]
    assert captured["has_prompt"]
    assert captured["has_output_format"]


@pytest.mark.asyncio
async def test_stability_binary_content_type_returns_bytes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=_1X1_PNG, headers={"content-type": "image/png"})

    _use_client(monkeypatch, handler)
    result = await call_stability_clean(
        api_base="https://api.stability.ai",
        api_key="sk-stability",
        model_name="inpaint",
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG


@pytest.mark.asyncio
async def test_stability_trailing_v1_is_stripped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen_urls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        return httpx.Response(
            200, json={"image": _1X1_PNG_B64, "finish_reason": "SUCCESS"}
        )

    _use_client(monkeypatch, handler)
    result = await call_stability_clean(
        api_base="https://api.stability.ai/v1",
        api_key="sk-stability",
        model_name="inpaint",
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG
    assert seen_urls == ["https://api.stability.ai/v2beta/stable-image/edit/inpaint"]


@pytest.mark.asyncio
async def test_stability_402_propagates_as_status_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(402, json={"errors": ["insufficient credits"]})

    _use_client(monkeypatch, handler)
    with pytest.raises(httpx.HTTPStatusError) as exc_info:
        await call_stability_clean(
            api_base="https://api.stability.ai",
            api_key="sk-stability",
            model_name="search-and-replace",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert exc_info.value.response.status_code == 402


@pytest.mark.asyncio
async def test_stability_missing_image_mentions_finish_reason(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"finish_reason": "CONTENT_FILTERED"})

    _use_client(monkeypatch, handler)
    with pytest.raises(ImageEditProtocolError) as exc_info:
        await call_stability_clean(
            api_base="https://api.stability.ai",
            api_key="sk-stability",
            model_name="search-and-replace",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert "CONTENT_FILTERED" in str(exc_info.value)


# --------------------------------------------------------------------------- #
# Cloudflare Workers AI
# --------------------------------------------------------------------------- #
_CLOUDFLARE_RUN_BASE = "https://api.cloudflare.com/client/v4/accounts/acc/ai/run"
_CLOUDFLARE_MODEL = "@cf/black-forest-labs/flux-2-klein-9b"


def _cloudflare_ok() -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "result": {"image": _1X1_PNG_B64},
            "success": True,
            "errors": [],
            "messages": [],
        },
    )


@pytest.mark.asyncio
async def test_cloudflare_json_envelope_from_multipart(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        body = request.read()
        captured["has_image_field"] = b'name="image"' in body
        captured["has_png_bytes"] = _1X1_PNG in body
        captured["has_prompt"] = b"system-prompt" in body and b"user-prompt" in body
        return _cloudflare_ok()

    _use_client(monkeypatch, handler)
    result = await call_cloudflare_clean(
        api_base=_CLOUDFLARE_RUN_BASE,
        api_key="cf-token",
        model_name=_CLOUDFLARE_MODEL,
        system_prompt="system-prompt",
        user_prompt="user-prompt",
        image_bytes=_1X1_PNG,
    )

    assert result == _1X1_PNG
    assert captured["url"] == f"{_CLOUDFLARE_RUN_BASE}/{_CLOUDFLARE_MODEL}"
    assert captured["has_image_field"]
    assert captured["has_png_bytes"]
    assert captured["has_prompt"]


@pytest.mark.asyncio
async def test_cloudflare_model_embedded_in_base_uses_url_as_is(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen_urls: list[str] = []
    embedded_base = f"{_CLOUDFLARE_RUN_BASE}/@cf/black-forest-labs/flux-2-dev"

    def handler(request: httpx.Request) -> httpx.Response:
        seen_urls.append(str(request.url))
        return _cloudflare_ok()

    _use_client(monkeypatch, handler)
    result = await call_cloudflare_clean(
        api_base=embedded_base,
        api_key="cf-token",
        model_name=_CLOUDFLARE_MODEL,
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG
    assert seen_urls == [embedded_base]


@pytest.mark.asyncio
async def test_cloudflare_multipart_falls_back_to_json(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    json_payloads: list[dict[str, object]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            return httpx.Response(
                400, json={"errors": [{"code": 3003, "message": "multipart validation failed"}]}
            )
        json_payloads.append(json.loads(request.content.decode("utf-8")))
        return _cloudflare_ok()

    _use_client(monkeypatch, handler)
    result = await call_cloudflare_clean(
        api_base=_CLOUDFLARE_RUN_BASE,
        api_key="cf-token",
        model_name=_CLOUDFLARE_MODEL,
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG
    assert json_payloads[0]["image_b64"] == _1X1_PNG_B64
    assert json_payloads[0]["prompt"] == "s\n\nu"


@pytest.mark.asyncio
async def test_cloudflare_both_formats_rejected_reports_both_details(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            return httpx.Response(
                400, json={"errors": [{"code": 3003, "message": "multipart-side failure"}]}
            )
        return httpx.Response(
            422, json={"errors": [{"code": 3006, "message": "json-side failure"}]}
        )

    _use_client(monkeypatch, handler)
    with pytest.raises(ImageEditProtocolError) as exc_info:
        await call_cloudflare_clean(
            api_base=_CLOUDFLARE_RUN_BASE,
            api_key="cf-token",
            model_name=_CLOUDFLARE_MODEL,
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    message = str(exc_info.value)
    assert "multipart" in message and "multipart-side failure" in message
    assert "JSON" in message and "json-side failure" in message


@pytest.mark.asyncio
async def test_cloudflare_binary_response_returns_bytes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _use_client(
        monkeypatch,
        lambda _request: httpx.Response(
            200, content=_1X1_PNG, headers={"content-type": "image/png"}
        ),
    )
    result = await call_cloudflare_clean(
        api_base=_CLOUDFLARE_RUN_BASE,
        api_key="cf-token",
        model_name=_CLOUDFLARE_MODEL,
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG,
    )
    assert result == _1X1_PNG


@pytest.mark.asyncio
async def test_cloudflare_410_reports_deprecated_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _use_client(
        monkeypatch,
        lambda _request: httpx.Response(410, json={"errors": [{"code": 5028, "message": "model deprecated"}]}),
    )
    with pytest.raises(ImageEditProtocolError) as exc_info:
        await call_cloudflare_clean(
            api_base=_CLOUDFLARE_RUN_BASE,
            api_key="cf-token",
            model_name="@cf/runwayml/stable-diffusion-v1-5-inpainting",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    message = str(exc_info.value)
    assert "deprecated" in message
    assert "flux-2-klein-9b" in message


@pytest.mark.asyncio
async def test_cloudflare_error_envelope_raises(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "result": {},
                "success": False,
                "errors": [{"code": 3036, "message": "daily neurons quota exceeded"}],
                "messages": [],
            },
        )

    _use_client(monkeypatch, handler)
    with pytest.raises(ImageEditProtocolError) as exc_info:
        await call_cloudflare_clean(
            api_base=_CLOUDFLARE_RUN_BASE,
            api_key="cf-token",
            model_name=_CLOUDFLARE_MODEL,
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG,
        )
    assert "quota" in str(exc_info.value)
