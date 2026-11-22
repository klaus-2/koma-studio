from __future__ import annotations

import base64
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

import services.cloud_cleaning as cloud_cleaning  # noqa: E402
from services.cloud_cleaning import (  # noqa: E402
    _CLEAN_CUSTOM_PROTOCOL_CACHE,
    _IMAGE_EDIT_CLEAN_ADAPTERS,
    _build_segment_alpha,
    _execute_clean_call,
    _resolve_custom_clean_provider,
    clean_image_with_ai,
    CloudCleanConfigError,
    CloudCleanProviderError,
)
from services.image_edit_protocols import ImageEditProtocolError  # noqa: E402


def _reference(width: int, height: int, fade_in: int, fade_out: int) -> np.ndarray:
    # The original per-pixel loop, kept only as the oracle for this test.
    out = np.full((height, width), 255, dtype=np.int64)
    for y in range(height):
        alpha = 255
        if fade_in > 0 and y < fade_in:
            alpha = min(alpha, int((y / max(1, fade_in)) * 255))
        if fade_out > 0 and y >= height - fade_out:
            alpha = min(alpha, int(((height - y - 1) / max(1, fade_out)) * 255))
        out[y, :] = max(0, min(255, alpha))
    return out


def test_vectorized_alpha_matches_reference() -> None:
    for fade_in, fade_out in ((0, 0), (160, 0), (0, 160), (160, 160), (500, 500), (5, 900)):
        got = np.asarray(_build_segment_alpha(7, 300, fade_in=fade_in, fade_out=fade_out))
        assert np.array_equal(got, _reference(7, 300, fade_in, fade_out)), (fade_in, fade_out)


_1X1_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ"
    "AAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)
_1X1_PNG_BYTES = base64.b64decode(_1X1_PNG_B64)


@pytest.fixture(autouse=True)
def _reset_protocol_cache() -> None:
    _CLEAN_CUSTOM_PROTOCOL_CACHE.clear()


def test_resolve_custom_clean_provider_defaults_protocol_to_none() -> None:
    resolved = _resolve_custom_clean_provider(
        {"api_base": "http://127.0.0.1:3425/v1", "model": "m", "apiKey": "k"}
    )
    assert resolved["protocol"] is None
    assert resolved["api_base"] == "http://127.0.0.1:3425/v1"
    assert resolved["model"] == "m"


@pytest.mark.parametrize("raw_protocol", [None, "", "auto", "AUTO"])
def test_resolve_custom_clean_provider_treats_missing_as_auto(raw_protocol: str | None) -> None:
    resolved = _resolve_custom_clean_provider(
        {
            "api_base": "http://127.0.0.1:3425/v1",
            "model": "m",
            "apiKey": "k",
            "protocol": raw_protocol,
        }
    )
    assert resolved["protocol"] is None


@pytest.mark.parametrize(
    "protocol",
    ["replicate", "fal", "stability", "cloudflare", "gemini", "openai_chat", "openai_images_edits"],
)
def test_resolve_custom_clean_provider_keeps_known_protocols(protocol: str) -> None:
    resolved = _resolve_custom_clean_provider(
        {
            "api_base": "http://127.0.0.1:3425/v1",
            "model": "m",
            "apiKey": "k",
            "protocol": protocol.upper(),
        }
    )
    assert resolved["protocol"] == protocol


def test_resolve_custom_clean_provider_rejects_unknown_protocol() -> None:
    with pytest.raises(CloudCleanConfigError) as exc_info:
        _resolve_custom_clean_provider(
            {
                "api_base": "http://127.0.0.1:3425/v1",
                "model": "m",
                "apiKey": "k",
                "protocol": "midjourney",
            }
        )
    message = str(exc_info.value)
    assert "midjourney" in message


# Routing inside _execute_clean_call
def _clean_call_kwargs(api_base: str) -> dict[str, Any]:
    return {
        "provider": "custom_image",
        "api_base": api_base,
        "api_key": "tok",
        "model_name": "m",
        "system_prompt": "s",
        "user_prompt": "u",
        "image_bytes": _1X1_PNG_BYTES,
    }


@pytest.mark.asyncio
@pytest.mark.parametrize("protocol", ["replicate", "fal", "stability", "cloudflare"])
async def test_execute_clean_call_routes_native_adapters(
    protocol: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    captured: dict[str, Any] = {}

    async def _stub_adapter(**kwargs: Any) -> bytes:
        captured.update(kwargs)
        return _1X1_PNG_BYTES

    monkeypatch.setitem(_IMAGE_EDIT_CLEAN_ADAPTERS, protocol, _stub_adapter)
    result = await _execute_clean_call(**_clean_call_kwargs("https://provider.example"), protocol=protocol)
    assert result == _1X1_PNG_BYTES
    assert captured["api_key"] == "tok"
    assert captured["model_name"] == "m"
    assert captured["image_bytes"] == _1X1_PNG_BYTES


@pytest.mark.asyncio
async def test_execute_clean_call_wraps_protocol_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _stub_adapter(**_kwargs: Any) -> bytes:
        raise ImageEditProtocolError("provider returned no usable output")

    monkeypatch.setitem(_IMAGE_EDIT_CLEAN_ADAPTERS, "replicate", _stub_adapter)
    with pytest.raises(CloudCleanProviderError) as exc_info:
        await _execute_clean_call(**_clean_call_kwargs("https://api.replicate.com"), protocol="replicate")
    assert "provider returned no usable output" in str(exc_info.value)


@pytest.mark.asyncio
async def test_execute_clean_call_images_edits_override_skips_negotiation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    images_calls: list[int] = []

    async def _stub_images(**_kwargs: Any) -> bytes:
        images_calls.append(1)
        return _1X1_PNG_BYTES

    async def _fail_negotiation(**_kwargs: Any) -> bytes:
        raise AssertionError("negotiation must not run for an explicit protocol")

    monkeypatch.setattr(cloud_cleaning, "_call_images_edits_clean", _stub_images)
    monkeypatch.setattr(cloud_cleaning, "_call_custom_clean_with_protocol", _fail_negotiation)
    result = await _execute_clean_call(
        **_clean_call_kwargs("http://127.0.0.1:3425/v1"), protocol="openai_images_edits"
    )
    assert result == _1X1_PNG_BYTES
    assert images_calls == [1]
    assert _CLEAN_CUSTOM_PROTOCOL_CACHE == {}


@pytest.mark.asyncio
async def test_execute_clean_call_openai_chat_override_skips_negotiation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _stub_chat(**_kwargs: Any) -> bytes:
        return _1X1_PNG_BYTES

    async def _fail_images(**_kwargs: Any) -> bytes:
        raise AssertionError("images/edits must not run for an explicit openai_chat protocol")

    monkeypatch.setattr(cloud_cleaning, "_call_openai_compatible_clean", _stub_chat)
    monkeypatch.setattr(cloud_cleaning, "_call_images_edits_clean", _fail_images)
    result = await _execute_clean_call(
        **_clean_call_kwargs("http://127.0.0.1:3425/v1"), protocol="openai_chat"
    )
    assert result == _1X1_PNG_BYTES


@pytest.mark.asyncio
async def test_execute_clean_call_auto_negotiates_unknown_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    negotiation_calls: list[int] = []

    async def _stub_negotiation(**_kwargs: Any) -> bytes:
        negotiation_calls.append(1)
        return _1X1_PNG_BYTES

    monkeypatch.setattr(cloud_cleaning, "_call_custom_clean_with_protocol", _stub_negotiation)
    result = await _execute_clean_call(**_clean_call_kwargs("https://provider.example/v1"))
    assert result == _1X1_PNG_BYTES
    assert negotiation_calls == [1]


@pytest.mark.asyncio
async def test_execute_clean_call_auto_routes_replicate_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _stub_adapter(**_kwargs: Any) -> bytes:
        return _1X1_PNG_BYTES

    monkeypatch.setitem(_IMAGE_EDIT_CLEAN_ADAPTERS, "replicate", _stub_adapter)
    result = await _execute_clean_call(**_clean_call_kwargs("https://api.replicate.com/v1"))
    assert result == _1X1_PNG_BYTES


@pytest.mark.asyncio
async def test_execute_clean_call_auto_gemini_host_without_key_raises() -> None:
    with pytest.raises(CloudCleanConfigError) as exc_info:
        await _execute_clean_call(
            **{
                **_clean_call_kwargs("https://generativelanguage.googleapis.com/v1beta/models"),
                "api_key": None,
            }
        )
    assert "valid API key" in str(exc_info.value)


@pytest.mark.asyncio
async def test_execute_clean_call_auto_gemini_host_calls_gemini(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    gemini_calls: list[int] = []

    async def _stub_gemini(**_kwargs: Any) -> bytes:
        gemini_calls.append(1)
        return _1X1_PNG_BYTES

    monkeypatch.setattr(cloud_cleaning, "_call_gemini_clean", _stub_gemini)
    result = await _execute_clean_call(
        **_clean_call_kwargs("https://generativelanguage.googleapis.com/v1beta/models")
    )
    assert result == _1X1_PNG_BYTES
    assert gemini_calls == [1]


@pytest.mark.asyncio
async def test_execute_clean_call_explicit_gemini_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _stub_gemini(**_kwargs: Any) -> bytes:
        return _1X1_PNG_BYTES

    monkeypatch.setattr(cloud_cleaning, "_call_gemini_clean", _stub_gemini)
    result = await _execute_clean_call(
        **_clean_call_kwargs("https://provider.example/v1"), protocol="gemini"
    )
    assert result == _1X1_PNG_BYTES


@pytest.mark.asyncio
async def test_execute_clean_call_managed_provider_stays_on_chat(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _stub_chat(**_kwargs: Any) -> bytes:
        return _1X1_PNG_BYTES

    async def _fail_adapter(**_kwargs: Any) -> bytes:
        raise AssertionError("managed provider must not use the native adapters")

    monkeypatch.setattr(cloud_cleaning, "_call_openai_compatible_clean", _stub_chat)
    monkeypatch.setitem(_IMAGE_EDIT_CLEAN_ADAPTERS, "replicate", _fail_adapter)
    result = await _execute_clean_call(
        **{**_clean_call_kwargs("https://api.replicate.com/v1"), "provider": "openai_compatible_image"}
    )
    assert result == _1X1_PNG_BYTES


# End-to-end threading through clean_image_with_ai
def _custom_llm_payload(protocol: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "api_base": "http://127.0.0.1:3425/v1",
        "model": "acme/eraser",
        "apiKey": "tok",
    }
    if protocol is not None:
        payload["protocol"] = protocol
    return payload


@pytest.mark.asyncio
async def test_clean_image_with_ai_threads_protocol_to_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, Any] = {}

    async def _stub_adapter(**kwargs: Any) -> bytes:
        captured.update(kwargs)
        return _1X1_PNG_BYTES

    monkeypatch.setitem(_IMAGE_EDIT_CLEAN_ADAPTERS, "replicate", _stub_adapter)
    model_used, cleaned_png = await clean_image_with_ai(
        image_bytes=_1X1_PNG_BYTES,
        model_key="custom_clean:profile-1",
        regions_payload=None,
        additional_instructions=None,
        custom_llm=_custom_llm_payload(protocol="replicate"),
    )
    assert model_used == "custom_clean:profile-1"
    assert cleaned_png.startswith(b"\x89PNG")
    assert captured["model_name"] == "acme/eraser"
    assert captured["api_key"] == "tok"
    assert captured["image_bytes"]


@pytest.mark.asyncio
async def test_clean_image_with_ai_rejects_unknown_protocol_before_adapter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _fail_adapter(**_kwargs: Any) -> bytes:
        raise AssertionError("adapter must not be reached for an unknown protocol")

    monkeypatch.setitem(_IMAGE_EDIT_CLEAN_ADAPTERS, "replicate", _fail_adapter)
    with pytest.raises(CloudCleanConfigError):
        await clean_image_with_ai(
            image_bytes=_1X1_PNG_BYTES,
            model_key="custom_clean:profile-1",
            regions_payload=None,
            additional_instructions=None,
            custom_llm=_custom_llm_payload(protocol="bogus-protocol"),
        )


@pytest.mark.asyncio
async def test_clean_image_with_ai_auto_detects_replicate_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    adapter_calls: list[dict[str, Any]] = []

    async def _stub_adapter(**kwargs: Any) -> bytes:
        adapter_calls.append(dict(kwargs))
        return _1X1_PNG_BYTES

    monkeypatch.setitem(_IMAGE_EDIT_CLEAN_ADAPTERS, "replicate", _stub_adapter)
    _, cleaned_png = await clean_image_with_ai(
        image_bytes=_1X1_PNG_BYTES,
        model_key="custom_clean:profile-1",
        regions_payload=None,
        additional_instructions=None,
        custom_llm={
            "api_base": "https://api.replicate.com/v1",
            "model": "acme/eraser",
            "apiKey": "r8_token",
        },
    )
    assert cleaned_png.startswith(b"\x89PNG")
    assert len(adapter_calls) == 1
    assert adapter_calls[0]["api_base"] == "https://api.replicate.com/v1"
    assert adapter_calls[0]["model_name"] == "acme/eraser"
