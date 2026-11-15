"""Persisted provider configuration for external translation services.

Stored by the backend itself (``KOMA_APP_DATA_DIR``) so both desktop shells
see the same settings without any shell-side plumbing. The JSON file lives at
the ROOT of the app-data dir — outside the ``logs/`` folders the bug-report
collectors scan — and its secret values are never logged nor included in
environment snapshots.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)

CONFIG_FILENAME = "translation-provider-config.json"
LIBRETRANSLATE_URL_ENV = "MINI_BACKEND_LIBRETRANSLATE_URL"
LIBRETRANSLATE_API_KEY_ENV = "MINI_BACKEND_LIBRETRANSLATE_API_KEY"
DEEPL_API_KEY_ENV = "MINI_BACKEND_DEEPL_API_KEY"

_CONFIG_KEYS = ("libretranslate_url", "libretranslate_api_key", "deepl_api_key")


def _clean_secret(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


@dataclass(frozen=True)
class TranslationProviderConfig:
    libretranslate_url: str | None = None
    libretranslate_api_key: str | None = None
    deepl_api_key: str | None = None

    def to_json_dict(self) -> dict[str, str | None]:
        return {
            "libretranslate_url": _clean_secret(self.libretranslate_url),
            "libretranslate_api_key": _clean_secret(self.libretranslate_api_key),
            "deepl_api_key": _clean_secret(self.deepl_api_key),
        }


def app_data_dir() -> str:
    return os.getenv("KOMA_APP_DATA_DIR") or os.path.join(
        os.path.expanduser("~"), ".koma-studio"
    )


def config_file_path() -> str:
    return os.path.join(app_data_dir(), CONFIG_FILENAME)


def _parse_config(raw: object) -> TranslationProviderConfig:
    if not isinstance(raw, dict):
        return TranslationProviderConfig()
    values: dict[str, str | None] = {}
    for key in _CONFIG_KEYS:
        value = raw.get(key)
        values[key] = value.strip() if isinstance(value, str) and value.strip() else None
    return TranslationProviderConfig(
        libretranslate_url=values["libretranslate_url"],
        libretranslate_api_key=values["libretranslate_api_key"],
        deepl_api_key=values["deepl_api_key"],
    )


def load_provider_config() -> TranslationProviderConfig:
    """Fail-open read: a missing or corrupted file answers an empty config."""
    path = config_file_path()
    try:
        with open(path, encoding="utf-8") as handle:
            return _parse_config(json.load(handle))
    except FileNotFoundError:
        return TranslationProviderConfig()
    except (OSError, ValueError) as exc:
        logger.warning("translation provider config unreadable: %s", type(exc).__name__)
        return TranslationProviderConfig()


def save_provider_config(config: TranslationProviderConfig) -> None:
    path = config_file_path()
    directory = os.path.dirname(path) or "."
    os.makedirs(directory, exist_ok=True)
    body = json.dumps(config.to_json_dict(), ensure_ascii=False, indent=2)
    # Mode 0o600 is best-effort: POSIX honors it, Windows stores the attribute
    # but user-profile ACLs already restrict access to the same account.
    try:
        os.chmod(directory, 0o700)
    except OSError:
        pass
    try:
        if os.path.exists(path):
            os.chmod(path, 0o600)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(body)
        os.chmod(path, 0o600)
    except OSError as exc:
        logger.error("translation provider config not saved: %s", type(exc).__name__)
        raise


def _stored_or_env(value: str | None, env_name: str) -> str | None:
    if value:
        return value
    env_value = os.getenv(env_name, "").strip()
    return env_value or None


def resolve_libretranslate_url(config: TranslationProviderConfig | None = None) -> str | None:
    stored = (config or load_provider_config()).libretranslate_url
    return _stored_or_env(stored, LIBRETRANSLATE_URL_ENV)


def resolve_libretranslate_api_key(config: TranslationProviderConfig | None = None) -> str | None:
    stored = (config or load_provider_config()).libretranslate_api_key
    return _stored_or_env(stored, LIBRETRANSLATE_API_KEY_ENV)


def resolve_deepl_api_key(config: TranslationProviderConfig | None = None) -> str | None:
    stored = (config or load_provider_config()).deepl_api_key
    return _stored_or_env(stored, DEEPL_API_KEY_ENV)
