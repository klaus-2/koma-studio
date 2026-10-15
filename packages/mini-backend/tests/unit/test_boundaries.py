from __future__ import annotations

import sys
from pathlib import Path

import httpx
import pytest
from pydantic import ValidationError

MINI_BACKEND_DIR = Path(__file__).resolve().parents[2]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from mini_backend_tools.dependencies import load_settings  # noqa: E402
from mini_backend_tools.memory import (  # noqa: E402
    MemoryReport,
    Options,
    fetch_report,
    growth_findings,
)
from utils.photoshop_text_layers import TextLayerEntry, TextLayerStyle  # noqa: E402


def test_environment_validation() -> None:
    settings = load_settings({"MINI_BACKEND_ACCELERATION_PROFILE": " CPU "})
    assert settings.profile == "cpu"

    with pytest.raises(ValidationError):
        load_settings({"MINI_DEPS_OUTER_ATTEMPTS": "-1"})


def test_memory_options_reject_secrets_and_nonfinite_interval() -> None:
    with pytest.raises(ValidationError):
        Options(base_url="http://user:secret@localhost")
    with pytest.raises(ValidationError):
        Options(interval_seconds=float("nan"))


def test_memory_cache_comparison_uses_names() -> None:
    first = MemoryReport.model_validate(
        {
            "process": {"rss_mb": 100},
            "caches": [
                {"name": "first", "entries": 2},
                {"name": "second", "entries": 1},
            ],
        }
    )
    last = MemoryReport.model_validate(
        {
            "process": {"rss_mb": 250},
            "caches": [
                {"name": "second", "entries": 1},
                {"name": "first", "entries": 3},
                {"name": "new", "entries": 0},
            ],
        }
    )
    findings = growth_findings(first, last)
    assert any(item.severity == "CRITICAL" for item in findings)
    assert any("first: 2 -> 3" in item.message for item in findings)


class _ReportStream(httpx.AsyncByteStream):
    async def __aiter__(self):
        yield b'{"process": {"rss_mb": 12}, "caches": []}'


async def test_http_report_boundary() -> None:
    def respond(_request: httpx.Request) -> httpx.Response:
        # a bytes body is pre-consumed in httpx>=0.28 and breaks aiter_raw();
        # an AsyncByteStream keeps the mock response streamable
        return httpx.Response(200, content=_ReportStream())

    async with httpx.AsyncClient(
        base_url="http://localhost/",
        transport=httpx.MockTransport(respond),
    ) as client:
        report = await fetch_report(client, deep=False)
    assert report.process.rss_mb == 12


def test_photoshop_style_normalization() -> None:
    style = TextLayerStyle.model_validate(
        {"alignment": "middle", "color": "#abc", "fontSize": "24"}
    )
    assert style.alignment == "center"
    assert style.color == "#aabbcc"
    assert style.effective_font_size == 24


@pytest.mark.parametrize(
    "payload",
    [
        {"fontSize": float("nan")},
        {"outlineWidth": -1},
        {"color": "rgb(999, 0, 0)"},
        {"color": "rgba(0, 0, 0, 0.5)"},
    ],
)
def test_photoshop_style_rejects_invalid_values(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        TextLayerStyle.model_validate(payload)


def test_photoshop_text_and_gradient_policy() -> None:
    entry = TextLayerEntry(text="hello\r\nsecond")
    assert "\r" not in entry.resolved_text
    assert entry.is_editable
    gradient = TextLayerEntry.model_validate(
        {"text": "text", "style": {"gradientEnabled": True}}
    )
    assert not gradient.is_editable
