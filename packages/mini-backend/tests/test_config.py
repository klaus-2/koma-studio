"""``get_config()`` env parsing for the runtime tunables delivered through
the desktop override chain: engine idle timeout (0 = disabled), the
working-resolution MP clamp and the OCR/clean policy flag.
"""

from __future__ import annotations

from pathlib import Path
import sys

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import get_config  # noqa: E402


def test_engine_idle_timeout_env_parsing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    get_config.cache_clear()
    try:
        monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "0")
        get_config.cache_clear()
        assert get_config().engine_idle_timeout_seconds == 0

        monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "-5")
        get_config.cache_clear()
        assert get_config().engine_idle_timeout_seconds == 0

        monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "999999")
        get_config.cache_clear()
        assert get_config().engine_idle_timeout_seconds == 86400

        monkeypatch.delenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS")
        get_config.cache_clear()
        assert get_config().engine_idle_timeout_seconds == 600
    finally:
        get_config.cache_clear()


def test_working_resolution_megapixels_env_clamped(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    get_config.cache_clear()
    try:
        monkeypatch.delenv("MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS", raising=False)
        get_config.cache_clear()
        assert get_config().working_resolution_megapixels == 24.0

        monkeypatch.setenv("MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS", "2")
        get_config.cache_clear()
        assert get_config().working_resolution_megapixels == 4.0

        monkeypatch.setenv("MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS", "100")
        get_config.cache_clear()
        assert get_config().working_resolution_megapixels == 64.0

        monkeypatch.setenv("MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS", "12")
        get_config.cache_clear()
        assert get_config().working_resolution_megapixels == 12.0

        monkeypatch.setenv("MINI_BACKEND_WORKING_RESOLUTION_MEGAPIXELS", "not-a-number")
        get_config.cache_clear()
        assert get_config().working_resolution_megapixels == 24.0
    finally:
        get_config.cache_clear()


def test_working_resolution_ocr_clean_env_parsed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    get_config.cache_clear()
    try:
        monkeypatch.delenv("MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN", raising=False)
        get_config.cache_clear()
        assert get_config().working_resolution_ocr_clean_enabled is False

        for enabled_value in ("1", "true", "yes", "on"):
            monkeypatch.setenv(
                "MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN", enabled_value
            )
            get_config.cache_clear()
            assert get_config().working_resolution_ocr_clean_enabled is True

        for disabled_value in ("0", "false", "no", "off", ""):
            monkeypatch.setenv(
                "MINI_BACKEND_WORKING_RESOLUTION_OCR_CLEAN", disabled_value
            )
            get_config.cache_clear()
            assert get_config().working_resolution_ocr_clean_enabled is False
    finally:
        get_config.cache_clear()
