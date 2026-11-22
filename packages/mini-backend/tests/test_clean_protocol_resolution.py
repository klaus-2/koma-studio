from __future__ import annotations

import sys
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from services.openai_compatible import (  # noqa: E402
    KNOWN_CLEAN_PROTOCOLS,
    resolve_clean_protocol,
)


def test_known_clean_protocols_match_c1_union() -> None:
    assert KNOWN_CLEAN_PROTOCOLS == frozenset(
        {
            "replicate",
            "fal",
            "stability",
            "cloudflare",
            "gemini",
            "openai_chat",
            "openai_images_edits",
        }
    )


@pytest.mark.parametrize(
    ("api_base", "expected"),
    [
        ("https://api.replicate.com", "replicate"),
        ("https://api.replicate.com/v1", "replicate"),
        ("https://fal.run", "fal"),
        ("https://fal.run/fal-ai/nano-banana/edit", "fal"),
        ("https://queue.fal.run", "fal"),
        ("https://falrun.com", "fal"),
        ("https://api.stability.ai", "stability"),
        ("https://api.stability.ai/v1", "stability"),
        (
            "https://api.cloudflare.com/client/v4/accounts/abc123/ai/run",
            "cloudflare",
        ),
        (
            "https://api.cloudflare.com/client/v4/accounts/abc123/ai/run/@cf/black-forest-labs/flux-2-klein-9b",
            "cloudflare",
        ),
        ("https://generativelanguage.googleapis.com/v1beta/models", "gemini"),
        ("https://aiplatform.googleapis.com", "gemini"),
        ("https://aiplatform.googleapis.com/v1", "gemini"),
        ("https://provider.example/v1", "auto"),
        ("https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1", "auto"),
        # Vertex OpenAI-compat endpoint: must stay on the current negotiation,
        # never collapse into the Gemini protocol.
        (
            "https://aiplatform.googleapis.com/v1/projects/p/locations/us-central1/endpoints/openapi/chat/completions",
            "auto",
        ),
    ],
)
def test_auto_resolution_follows_host_map(api_base: str, expected: str) -> None:
    assert resolve_clean_protocol(api_base, None) == expected


def test_vertex_openai_endpoint_never_resolves_to_gemini() -> None:
    resolved = resolve_clean_protocol(
        "https://aiplatform.googleapis.com/v1/projects/p/locations/us-central1/endpoints/openapi",
        None,
    )
    assert resolved != "gemini"
    assert resolved == "auto"


@pytest.mark.parametrize(
    "override",
    ["replicate", "fal", "stability", "cloudflare", "gemini", "openai_chat", "openai_images_edits"],
)
def test_explicit_override_wins_over_host_map(override: str) -> None:
    assert resolve_clean_protocol("https://provider.example/v1", override) == override


def test_override_is_case_insensitive() -> None:
    assert resolve_clean_protocol("https://provider.example/v1", "Replicate") == "replicate"


def test_auto_override_falls_back_to_host_map() -> None:
    assert resolve_clean_protocol("https://api.replicate.com", "auto") == "replicate"
    assert resolve_clean_protocol("https://provider.example/v1", "auto") == "auto"


def test_blank_override_falls_back_to_host_map() -> None:
    assert resolve_clean_protocol("https://fal.run", "   ") == "fal"
    assert resolve_clean_protocol("https://provider.example/v1", "") == "auto"


def test_unknown_override_raises_value_error() -> None:
    with pytest.raises(ValueError) as exc_info:
        resolve_clean_protocol("https://api.replicate.com", "midjourney")
    assert "midjourney" in str(exc_info.value)
