from __future__ import annotations

import sys
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from services.openai_compatible import (  # noqa: E402
    KNOWN_PROVIDERS,
    build_custom_provider_http_error_detail,
)

_CF_BASE = "https://api.cloudflare.com/client/v4/accounts/some-account/ai/v1"


def test_known_provider_hosts_are_pairwise_disjoint() -> None:
    seen: dict[str, str] = {}
    for provider in KNOWN_PROVIDERS:
        for host in provider.hosts:
            assert host not in seen, (
                f"host {host!r} is claimed by both "
                f"{seen[host]!r} and {provider.key!r}"
            )
            seen[host] = provider.key


def test_cloudflare_404_explains_image_models_are_not_served() -> None:
    detail = build_custom_provider_http_error_detail(404, _CF_BASE, "model")
    assert "Provider respondeu 404" in detail
    assert "/v1/images/generations" in detail
    assert "@cf/black-forest-labs/*" in detail
    assert "/v1/chat/completions" in detail


def test_cloudflare_401_uses_auth_detail() -> None:
    detail = build_custom_provider_http_error_detail(401, _CF_BASE, "model")
    assert "valid API token" in detail


def test_unknown_host_404_keeps_generic_openai_detail() -> None:
    detail = build_custom_provider_http_error_detail(
        404, "https://provider.example/v1", "model"
    )
    assert detail == (
        "Provider respondeu 404. Check that the API Base points to an "
        "OpenAI-compatible endpoint (`/v1` ou `/chat/completions`)."
    )


@pytest.mark.parametrize("status", [500, 502])
def test_cloudflare_other_statuses_stay_generic(status: int) -> None:
    detail = build_custom_provider_http_error_detail(status, _CF_BASE, "model")
    assert detail == f"Provider respondeu {status}"
