from __future__ import annotations

import sys
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from services.cloud_cleaning import (  # noqa: E402
    CloudCleanProviderError,
    _call_gemini_clean,
    _call_openai_compatible_clean,
    _text_failure_detail,
)

_DETECTION_JSON = """```json
[ {"box_2d": [183, 345, 268, 417], "label": "text"},
  {"box_2d": [48, 567, 107, 667], "label": "text"} ]
```"""


def test_text_failure_detail_collapses_and_bounds() -> None:
    long_prose = "The user wants me to clean the page.  \n\n" * 60
    detail = _text_failure_detail(long_prose)
    assert len(detail) <= 240
    assert "\n" not in detail
    assert detail.endswith("…")
    assert _text_failure_detail("") == ""
    assert _text_failure_detail("  short   reply  ") == "short reply"


def test_text_failure_detail_respects_short_text() -> None:
    detail = _text_failure_detail(_DETECTION_JSON)
    assert detail == " ".join(_DETECTION_JSON.split())
    assert "box_2d" in detail
    assert "…" not in detail


class _StubGeminiResponse:
    def __init__(self, payload: dict[str, object]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self._payload


@pytest.mark.asyncio
async def test_openai_text_reply_raises_bounded_actionable_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _stub_post(**_kwargs: object) -> dict[str, object]:
        return {
            "choices": [
                {"message": {"content": _DETECTION_JSON}},
            ]
        }

    monkeypatch.setattr(
        "services.cloud_cleaning.post_openai_compatible_json", _stub_post
    )
    with pytest.raises(CloudCleanProviderError) as exc_info:
        await _call_openai_compatible_clean(
            api_base="https://example.invalid/v1",
            api_key="k",
            model_name="text-only-model",
            system_prompt="system",
            user_prompt="user",
            image_bytes=b"png-bytes",
        )
    message = str(exc_info.value)
    assert "returned text instead of an edited image" in message
    assert "image-capable" in message
    assert len(message) < 400
    assert _DETECTION_JSON not in message


@pytest.mark.asyncio
async def test_gemini_text_reply_raises_bounded_actionable_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    long_prose = "The user wants me to clean the comic page. " * 80

    async def _stub_post(
        client: object, url: str, payload: dict[str, object]
    ) -> _StubGeminiResponse:
        return _StubGeminiResponse(
            {
                "candidates": [
                    {
                        "content": {
                            "parts": [{"text": long_prose}],
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(
        "services.cloud_cleaning._post_gemini_with_retry", _stub_post
    )
    with pytest.raises(CloudCleanProviderError) as exc_info:
        await _call_gemini_clean(
            api_base="https://generativelanguage.googleapis.com/v1beta/models",
            api_key="k",
            model_name="thinking-model",
            system_prompt="system",
            user_prompt="user",
            image_bytes=b"png-bytes",
            client=object(),
        )
    message = str(exc_info.value)
    assert "returned text instead of an edited image" in message
    assert "image-capable" in message
    assert len(message) < 400
    assert "…" in message


@pytest.mark.asyncio
async def test_openai_empty_reply_keeps_provider_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def _stub_post(**_kwargs: object) -> dict[str, object]:
        return {"choices": [{"message": {"content": ""}}]}

    monkeypatch.setattr(
        "services.cloud_cleaning.post_openai_compatible_json", _stub_post
    )
    with pytest.raises(CloudCleanProviderError) as exc_info:
        await _call_openai_compatible_clean(
            api_base="https://example.invalid/v1",
            api_key="k",
            model_name="text-only-model",
            system_prompt="system",
            user_prompt="user",
            image_bytes=b"png-bytes",
        )
    assert "did not return an edited image" in str(exc_info.value)
