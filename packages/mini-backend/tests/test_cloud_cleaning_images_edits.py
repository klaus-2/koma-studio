from __future__ import annotations

import base64
import json
import sys
from pathlib import Path

import httpx
import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from services.cloud_cleaning import (  # noqa: E402
    CloudCleanProviderError,
    _call_custom_clean_with_protocol,
    _call_images_edits_clean,
    _CLEAN_CUSTOM_PROTOCOL_CACHE,
    _upstream_error_detail,
    build_clean_provider_http_error_detail,
)
from services.openai_compatible import (  # noqa: E402
    resolve_openai_compatible_images_edits_endpoint,
)

_1X1_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
_1X1_PNG_BYTES = base64.b64decode(_1X1_PNG_B64)

_MAGPIE_400_BODY = (
    '{"error":{"code":null,"message":"WorkBuddy AI: Backend [maas] is not supported '
    '(HTTP 400, 11103, request id 6fe072d7)","param":null,"type":"invalid_request_error"}}'
)


@pytest.fixture(autouse=True)
def _reset_protocol_cache() -> None:
    _CLEAN_CUSTOM_PROTOCOL_CACHE.clear()


def test_images_edits_endpoint_resolution() -> None:
    assert (
        resolve_openai_compatible_images_edits_endpoint("http://127.0.0.1:3425/v1")
        == "http://127.0.0.1:3425/v1/images/edits"
    )
    assert (
        resolve_openai_compatible_images_edits_endpoint("https://api.example.com")
        == "https://api.example.com/images/edits"
    )
    assert (
        resolve_openai_compatible_images_edits_endpoint("https://api.example.com/images/edits")
        == "https://api.example.com/images/edits"
    )


@pytest.mark.asyncio
async def test_images_edits_b64_json_payload_and_result() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["auth"] = request.headers.get("authorization")
        captured["payload"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"data": [{"b64_json": _1X1_PNG_B64}]})

    result = await _call_images_edits_clean(
        api_base="http://127.0.0.1:3425/v1",
        api_key="magpie",
        model_name="workbuddy-ai/hy-image-3.5",
        system_prompt="system-prompt",
        user_prompt="user-prompt",
        image_bytes=_1X1_PNG_BYTES,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )

    assert result == _1X1_PNG_BYTES
    assert captured["url"] == "http://127.0.0.1:3425/v1/images/edits"
    assert captured["auth"] == "Bearer magpie"
    payload = captured["payload"]
    assert isinstance(payload, dict)
    assert payload["model"] == "workbuddy-ai/hy-image-3.5"
    assert payload["response_format"] == "b64_json"
    assert "system-prompt" in payload["prompt"] and "user-prompt" in payload["prompt"]
    images = payload["images"]
    assert isinstance(images, list) and len(images) == 1
    image_url = images[0]["image_url"]
    assert image_url.startswith("data:image/png;base64,")
    assert image_url.endswith(base64.b64encode(_1X1_PNG_BYTES).decode("utf-8"))


@pytest.mark.asyncio
async def test_images_edits_url_result_downloads(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import services.cloud_cleaning as cloud_cleaning

    async def _stub_download(url: str, _client: object) -> bytes | None:
        assert url == "https://cdn.example.com/out.png"
        return _1X1_PNG_BYTES

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": [{"url": "https://cdn.example.com/out.png"}]})

    monkeypatch.setattr(cloud_cleaning, "_download_remote_image", _stub_download)
    result = await _call_images_edits_clean(
        api_base="https://api.example.com/v1",
        api_key=None,
        model_name="workbuddy-ai/hy-image-3.5",
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG_BYTES,
        client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    assert result == _1X1_PNG_BYTES


@pytest.mark.asyncio
async def test_images_edits_item_error_raises() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200, json={"data": [{"error": {"message": "quota exhausted for model"}}]}
        )

    with pytest.raises(CloudCleanProviderError) as exc_info:
        await _call_images_edits_clean(
            api_base="https://api.example.com/v1",
            api_key="k",
            model_name="m",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG_BYTES,
            client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )
    assert "quota exhausted" in str(exc_info.value)


@pytest.mark.asyncio
async def test_images_edits_missing_data_raises() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": []})

    with pytest.raises(CloudCleanProviderError) as exc_info:
        await _call_images_edits_clean(
            api_base="https://api.example.com/v1",
            api_key="k",
            model_name="m",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG_BYTES,
            client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )
    assert "did not return an edited image" in str(exc_info.value)


@pytest.mark.asyncio
async def test_images_edits_never_retries_transient_failures() -> None:
    calls: list[int] = []

    def handler(_request: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(503, json={"error": {"message": "upstream busy"}})

    with pytest.raises(httpx.HTTPStatusError):
        await _call_images_edits_clean(
            api_base="https://api.example.com/v1",
            api_key="k",
            model_name="m",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG_BYTES,
            client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )
    assert len(calls) == 1


def _status_error(status_code: int) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "https://gateway.test/v1/chat/completions")
    response = httpx.Response(status_code, request=request)
    return httpx.HTTPStatusError(f"HTTP {status_code}", request=request, response=response)


@pytest.mark.asyncio
async def test_custom_clean_negotiates_images_edits_on_400(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import services.cloud_cleaning as cloud_cleaning

    chat_calls: list[int] = []
    images_calls: list[int] = []

    async def _stub_chat(**_kwargs: object) -> bytes:
        chat_calls.append(1)
        raise _status_error(400)

    async def _stub_images(**_kwargs: object) -> bytes:
        images_calls.append(1)
        return _1X1_PNG_BYTES

    monkeypatch.setattr(cloud_cleaning, "_call_openai_compatible_clean", _stub_chat)
    monkeypatch.setattr(cloud_cleaning, "_call_images_edits_clean", _stub_images)

    kwargs = {
        "api_base": "http://127.0.0.1:3425/v1",
        "api_key": "magpie",
        "model_name": "workbuddy-ai/hy-image-3.5",
        "system_prompt": "s",
        "user_prompt": "u",
        "image_bytes": _1X1_PNG_BYTES,
    }
    first = await _call_custom_clean_with_protocol(**kwargs)
    assert first == _1X1_PNG_BYTES
    assert len(chat_calls) == 1 and len(images_calls) == 1
    cache_key = ("http://127.0.0.1:3425/v1", "workbuddy-ai/hy-image-3.5")
    assert _CLEAN_CUSTOM_PROTOCOL_CACHE[cache_key] == "images_edits"

    second = await _call_custom_clean_with_protocol(**kwargs)
    assert second == _1X1_PNG_BYTES
    assert len(chat_calls) == 1 and len(images_calls) == 2


@pytest.mark.asyncio
async def test_custom_clean_401_propagates_without_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import services.cloud_cleaning as cloud_cleaning

    async def _stub_chat(**_kwargs: object) -> bytes:
        raise _status_error(401)

    async def _fail_images(**_kwargs: object) -> bytes:
        raise AssertionError("images/edits must not be tried for auth failures")

    monkeypatch.setattr(cloud_cleaning, "_call_openai_compatible_clean", _stub_chat)
    monkeypatch.setattr(cloud_cleaning, "_call_images_edits_clean", _fail_images)

    with pytest.raises(httpx.HTTPStatusError):
        await _call_custom_clean_with_protocol(
            api_base="https://api.example.com/v1",
            api_key="bad",
            model_name="m",
            system_prompt="s",
            user_prompt="u",
            image_bytes=_1X1_PNG_BYTES,
        )
    assert _CLEAN_CUSTOM_PROTOCOL_CACHE == {}


@pytest.mark.asyncio
async def test_custom_clean_chat_success_stays_on_chat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import services.cloud_cleaning as cloud_cleaning

    async def _stub_chat(**_kwargs: object) -> bytes:
        return _1X1_PNG_BYTES

    async def _fail_images(**_kwargs: object) -> bytes:
        raise AssertionError("images/edits must not be tried when chat succeeds")

    monkeypatch.setattr(cloud_cleaning, "_call_openai_compatible_clean", _stub_chat)
    monkeypatch.setattr(cloud_cleaning, "_call_images_edits_clean", _fail_images)

    result = await _call_custom_clean_with_protocol(
        api_base="https://api.example.com/v1",
        api_key="k",
        model_name="m",
        system_prompt="s",
        user_prompt="u",
        image_bytes=_1X1_PNG_BYTES,
    )
    assert result == _1X1_PNG_BYTES
    assert _CLEAN_CUSTOM_PROTOCOL_CACHE == {}


def test_upstream_detail_reaches_clean_error_message() -> None:
    detail = build_clean_provider_http_error_detail(
        400,
        "custom_clean:profile-1",
        {"api_base": "http://127.0.0.1:3425/v1", "model": "workbuddy-ai/hy-image-3.5"},
        _MAGPIE_400_BODY,
    )
    assert "Provider respondeu 400" in detail
    assert "Backend [maas] is not supported" in detail

    plain = build_clean_provider_http_error_detail(
        400,
        "custom_clean:profile-1",
        {"api_base": "http://127.0.0.1:3425/v1", "model": "workbuddy-ai/hy-image-3.5"},
        None,
    )
    assert plain == "Provider respondeu 400"


def test_upstream_error_detail_extracts_openai_error_message() -> None:
    detail = _upstream_error_detail(_MAGPIE_400_BODY)
    assert detail.startswith("WorkBuddy AI: Backend [maas] is not supported")
    assert "{" not in detail
    assert _upstream_error_detail(None) == ""
    assert _upstream_error_detail("   ") == ""
