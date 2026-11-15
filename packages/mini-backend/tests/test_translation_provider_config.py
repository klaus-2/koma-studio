"""Persisted translation provider config + LibreTranslate HTTP engine."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core import translation_provider_config as provider_config
from models.translation import http as http_mod
from models.translation.errors import (
    TranslatorConfigurationError,
    TranslatorResponseError,
    TranslatorUnavailableError,
)
from models.translation.providers.libretranslate import LibreTranslateEngine


class TranslationProviderConfigStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._original_app_data = os.environ.get("KOMA_APP_DATA_DIR")
        os.environ["KOMA_APP_DATA_DIR"] = self._tmp.name

    def tearDown(self) -> None:
        if self._original_app_data is None:
            os.environ.pop("KOMA_APP_DATA_DIR", None)
        else:
            os.environ["KOMA_APP_DATA_DIR"] = self._original_app_data
        self._tmp.cleanup()

    def test_save_then_load_round_trip(self) -> None:
        config = provider_config.TranslationProviderConfig(
            libretranslate_url="http://127.0.0.1:5000",
            libretranslate_api_key="lt-key",
            deepl_api_key="deepl-key",
        )
        provider_config.save_provider_config(config)

        loaded = provider_config.load_provider_config()
        self.assertEqual(loaded, config)

    def test_failed_save_keeps_the_previous_config_intact(self) -> None:
        first = provider_config.TranslationProviderConfig(deepl_api_key="keep-me")
        provider_config.save_provider_config(first)

        with patch.object(provider_config.os, "replace", side_effect=OSError("disk full")):
            with self.assertRaises(OSError):
                provider_config.save_provider_config(
                    provider_config.TranslationProviderConfig(deepl_api_key="lost")
                )

        self.assertEqual(provider_config.load_provider_config(), first)
        self.assertFalse(
            Path(provider_config.config_file_path() + ".tmp").exists(),
            "a failed save must not leave the temp file behind",
        )

    def test_missing_file_answers_an_empty_config(self) -> None:
        self.assertEqual(provider_config.load_provider_config(), provider_config.TranslationProviderConfig())

    def test_corrupted_file_fails_open_with_empty_config(self) -> None:
        path = Path(provider_config.config_file_path())
        path.write_text("{not json", encoding="utf-8")
        self.assertEqual(provider_config.load_provider_config(), provider_config.TranslationProviderConfig())

    def test_config_file_lives_outside_any_logs_dir(self) -> None:
        path = Path(provider_config.config_file_path())
        self.assertEqual(path.parent, Path(self._tmp.name))
        self.assertNotIn("logs", path.parts)
        self.assertEqual(path.name, "translation-provider-config.json")

    def test_resolvers_prefer_the_store_over_the_env(self) -> None:
        provider_config.save_provider_config(
            provider_config.TranslationProviderConfig(
                libretranslate_url="http://stored:5000",
                deepl_api_key="stored-deepl-key",
            )
        )
        env = dict(os.environ)
        env["MINI_BACKEND_LIBRETRANSLATE_URL"] = "http://env:5000"
        env["MINI_BACKEND_DEEPL_API_KEY"] = "env-deepl-key"
        with patch.dict("os.environ", env):
            self.assertEqual(provider_config.resolve_libretranslate_url(), "http://stored:5000")
            self.assertEqual(provider_config.resolve_deepl_api_key(), "stored-deepl-key")

    def test_resolvers_fall_back_to_the_env_without_a_store(self) -> None:
        env = dict(os.environ)
        env["MINI_BACKEND_LIBRETRANSLATE_URL"] = "http://env:5000"
        env["MINI_BACKEND_DEEPL_API_KEY"] = "env-deepl-key"
        with patch.dict("os.environ", env, clear=True):
            self.assertEqual(provider_config.resolve_libretranslate_url(), "http://env:5000")
            self.assertEqual(provider_config.resolve_libretranslate_api_key(), None)
            self.assertEqual(provider_config.resolve_deepl_api_key(), "env-deepl-key")

    def test_blank_strings_are_normalized_to_none(self) -> None:
        config = provider_config.TranslationProviderConfig(
            libretranslate_url="   ", deepl_api_key=""
        )
        self.assertIsNone(config.to_json_dict()["libretranslate_url"])
        provider_config.save_provider_config(config)
        self.assertEqual(provider_config.load_provider_config(), provider_config.TranslationProviderConfig())


class _FakeResponse:
    def __init__(self, payload: object) -> None:
        self._payload = payload


class LibreTranslateEngineTests(unittest.IsolatedAsyncioTestCase):
    def _engine(self) -> LibreTranslateEngine:
        return LibreTranslateEngine(
            server_url="http://127.0.0.1:5000", api_key="secret-lt-key"
        )

    def test_missing_server_url_raises_configuration_error(self) -> None:
        engine = LibreTranslateEngine(server_url=None)
        with self.assertRaises(TranslatorConfigurationError):
            engine._ensure_configured()

    async def test_batch_translate_posts_the_provider_contract(self) -> None:
        captured: dict[str, object] = {}

        async def fake_post_json(**kwargs: object) -> object:
            captured.update(kwargs)
            return {"translatedText": ["Hola!", "Bonjour!"]}

        with patch.object(http_mod, "post_json", side_effect=fake_post_json):
            texts = await self._engine()._translate_texts(
                ["Hello!", "Hi!"], "en", "es"
            )

        self.assertEqual(texts, ["Hola!", "Bonjour!"])
        self.assertEqual(captured["url"], "http://127.0.0.1:5000/translate")
        payload = captured["payload"]
        assert isinstance(payload, dict)
        self.assertEqual(payload["q"], ["Hello!", "Hi!"])
        self.assertEqual(payload["source"], "en")
        self.assertEqual(payload["target"], "es")
        self.assertEqual(payload["format"], "text")
        self.assertEqual(payload["api_key"], "secret-lt-key")
        self.assertEqual(captured["redact"], ("secret-lt-key",))

    def test_error_detail_redacts_the_api_key(self) -> None:
        from models.translation.http import _truncate_detail

        detail = _truncate_detail(
            'hostile provider echoed: {"error": "Invalid API key secret-lt-key"}',
            ("secret-lt-key",),
        )
        self.assertNotIn("secret-lt-key", detail)
        self.assertIn("[redacted]", detail)

    async def test_single_string_response_is_positional(self) -> None:
        async def fake_post_json(**kwargs: object) -> object:
            return {"translatedText": "Hola!"}

        with patch.object(http_mod, "post_json", side_effect=fake_post_json):
            texts = await self._engine()._translate_texts(["Hello!"], "en", "es")

        self.assertEqual(texts, ["Hola!"])

    async def test_auto_source_is_sent_for_auto_detection(self) -> None:
        captured: dict[str, object] = {}

        async def fake_post_json(**kwargs: object) -> object:
            captured.update(kwargs)
            return {"translatedText": ["Hello!"]}

        with patch.object(http_mod, "post_json", side_effect=fake_post_json):
            await self._engine()._translate_texts(["Bonjour!"], "", "en")

        payload = captured["payload"]
        assert isinstance(payload, dict)
        self.assertEqual(payload["source"], "auto")

    async def test_http_403_surfaces_the_invalid_api_key_detail(self) -> None:
        async def fake_post_json(**kwargs: object) -> object:
            raise TranslatorResponseError("LibreTranslate", 403, '{"error": "Invalid API key"}')

        with patch.object(http_mod, "post_json", side_effect=fake_post_json):
            with self.assertRaises(TranslatorResponseError) as ctx:
                await self._engine()._translate_texts(["Hello!"], "en", "es")

        self.assertIn("403", str(ctx.exception))

    async def test_http_400_surfaces_the_server_error_detail(self) -> None:
        async def fake_post_json(**kwargs: object) -> object:
            raise TranslatorResponseError(
                "LibreTranslate", 400, '{"error": "Invalid request: missing q parameter"}'
            )

        with patch.object(http_mod, "post_json", side_effect=fake_post_json):
            with self.assertRaises(TranslatorResponseError) as ctx:
                await self._engine()._translate_texts(["Hello!"], "en", "es")

        self.assertIn("missing q parameter", str(ctx.exception))

    async def test_connection_failure_maps_to_unavailable(self) -> None:
        async def fake_post_json(**kwargs: object) -> object:
            raise TranslatorUnavailableError("LibreTranslate", "ConnectError")

        with patch.object(http_mod, "post_json", side_effect=fake_post_json):
            with self.assertRaises(TranslatorUnavailableError):
                await self._engine()._translate_texts(["Hello!"], "en", "es")

    def test_regional_codes_fold_to_the_base_language(self) -> None:
        from models.translation.lang_codes import (
            _libretranslate_source_lang,
            _libretranslate_target_lang,
        )

        self.assertEqual(_libretranslate_source_lang("pt-br"), "pt")
        self.assertEqual(_libretranslate_source_lang("zh-cn"), "zh")
        self.assertEqual(_libretranslate_source_lang("auto"), "auto")
        self.assertEqual(_libretranslate_target_lang("zh-tw"), "zh")
        self.assertEqual(_libretranslate_target_lang("ja"), "ja")


IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from models.translation import factory as translation_factory
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationProviderConfigRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._original_app_data = os.environ.get("KOMA_APP_DATA_DIR")
        os.environ["KOMA_APP_DATA_DIR"] = self._tmp.name
        self._original_session_secret = mini_app.LOCAL_API_SESSION_SECRET
        self._original_environment = mini_app.ENVIRONMENT
        mini_app.LOCAL_API_SESSION_SECRET = "test-secret"
        mini_app.ENVIRONMENT = "production"

    def tearDown(self) -> None:
        mini_app.LOCAL_API_SESSION_SECRET = self._original_session_secret
        mini_app.ENVIRONMENT = self._original_environment
        if self._original_app_data is None:
            os.environ.pop("KOMA_APP_DATA_DIR", None)
        else:
            os.environ["KOMA_APP_DATA_DIR"] = self._original_app_data
        translation_factory.clear_translator_cache()
        self._tmp.cleanup()

    def _headers(self) -> dict[str, str]:
        from app import LOCAL_API_SESSION_HEADER

        return {LOCAL_API_SESSION_HEADER: "test-secret"}

    def test_get_returns_the_persisted_config(self) -> None:
        from fastapi.testclient import TestClient

        provider_config.save_provider_config(
            provider_config.TranslationProviderConfig(
                libretranslate_url="http://127.0.0.1:5000",
                deepl_api_key="deepl-key",
            )
        )
        client = TestClient(mini_app.app)
        response = client.get("/translate/provider-config", headers=self._headers())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["providerConfig"],
            {
                "libretranslate_url": "http://127.0.0.1:5000",
                "libretranslate_api_key": None,
                "deepl_api_key": "deepl-key",
            },
        )

    def test_put_persists_and_answers_the_saved_config(self) -> None:
        from fastapi.testclient import TestClient

        client = TestClient(mini_app.app)
        response = client.put(
            "/translate/provider-config",
            headers=self._headers(),
            json={
                "libretranslate_url": "http://127.0.0.1:5000",
                "libretranslate_api_key": "lt-key",
                "deepl_api_key": "deepl-key",
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["providerConfig"],
            {
                "libretranslate_url": "http://127.0.0.1:5000",
                "libretranslate_api_key": "lt-key",
                "deepl_api_key": "deepl-key",
            },
        )
        stored = provider_config.load_provider_config()
        self.assertEqual(stored.deepl_api_key, "deepl-key")
        with open(provider_config.config_file_path(), encoding="utf-8") as handle:
            self.assertEqual(json.load(handle)["deepl_api_key"], "deepl-key")

    def test_put_without_the_session_header_is_refused(self) -> None:
        from fastapi.testclient import TestClient

        client = TestClient(mini_app.app)
        response = client.put(
            "/translate/provider-config",
            json={"libretranslate_url": "http://127.0.0.1:5000"},
        )
        self.assertEqual(response.status_code, 403)

    def test_put_drops_cached_engines(self) -> None:
        from fastapi.testclient import TestClient

        client = TestClient(mini_app.app)
        with patch.object(
            __import__("routers.translation", fromlist=["clear_translator_cache"]),
            "clear_translator_cache",
            wraps=translation_factory.clear_translator_cache,
        ) as spy:
            response = client.put(
                "/translate/provider-config",
                headers=self._headers(),
                json={"deepl_api_key": "deepl-key"},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(spy.call_count, 1)


@unittest.skipIf(IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}")
class TranslationProviderAvailabilityTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self._original_app_data = os.environ.get("KOMA_APP_DATA_DIR")
        os.environ["KOMA_APP_DATA_DIR"] = self._tmp.name

    def tearDown(self) -> None:
        if self._original_app_data is None:
            os.environ.pop("KOMA_APP_DATA_DIR", None)
        else:
            os.environ["KOMA_APP_DATA_DIR"] = self._original_app_data
        self._tmp.cleanup()

    def test_libretranslate_availability_follows_the_provider_config(self) -> None:
        meta = translation_factory.TRANSLATION_MODELS["libretranslate"]
        self.assertFalse(translation_factory._is_available("libretranslate", meta))

        provider_config.save_provider_config(
            provider_config.TranslationProviderConfig(libretranslate_url="http://127.0.0.1:5000")
        )
        self.assertTrue(translation_factory._is_available("libretranslate", meta))

    def test_deepl_availability_follows_the_provider_config(self) -> None:
        meta = translation_factory.TRANSLATION_MODELS["deepl"]
        env = {name: value for name, value in os.environ.items() if name != "MINI_BACKEND_DEEPL_API_KEY"}
        with patch.dict("os.environ", env, clear=True):
            self.assertFalse(translation_factory._is_available("deepl", meta))
            provider_config.save_provider_config(
                provider_config.TranslationProviderConfig(deepl_api_key="stored-key")
            )
            self.assertTrue(translation_factory._is_available("deepl", meta))

    def test_list_translation_models_exposes_libretranslate(self) -> None:
        options = {option["key"]: option for option in translation_factory.list_translation_models()}
        self.assertIn("libretranslate", options)
        self.assertTrue(options["libretranslate"]["implemented"])

    def test_deepl_builder_receives_the_resolved_key(self) -> None:
        provider_config.save_provider_config(
            provider_config.TranslationProviderConfig(deepl_api_key="stored-key")
        )
        built: list[str | None] = []

        class _SpyEngine(translation_factory.DeepLTranslatorEngine):
            def __init__(self, api_key: str | None = None) -> None:
                built.append(api_key)

        with patch.object(translation_factory, "DeepLTranslatorEngine", _SpyEngine):
            translation_factory._ENGINE_BUILDERS["deepl"]("deepl")

        self.assertEqual(built, ["stored-key"])


if __name__ == "__main__":
    unittest.main()
