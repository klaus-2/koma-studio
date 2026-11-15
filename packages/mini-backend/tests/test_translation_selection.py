"""Selection-time routing: an explicit local key never degrades to Google silently."""

from __future__ import annotations

import os
from contextlib import ExitStack
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation import factory as translation_factory  # noqa: E402
from models.translation.base_translator import (  # noqa: E402
    BaseTranslator,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.errors import InvalidModelSelectionError  # noqa: E402
from models.translation.providers import GoogleTranslatorEngine  # noqa: E402

NLLB_RUNNABLE_MODEL_IDS = (
    "nllb-200-600m-int8",
    "nllb-200-1.3b",
    "nllb-200-1.3b-int8-ct2",
)


class _GoogleEngineSpy:
    """Counts how many times the factory constructs the cloud engine."""

    def __init__(self) -> None:
        self.calls = 0
        self.last_engine: BaseTranslator | None = None

    def __call__(self) -> BaseTranslator:
        self.calls += 1
        engine = GoogleTranslatorEngine()
        self.last_engine = engine
        return engine


class TranslationSelectionTests(unittest.TestCase):
    def setUp(self) -> None:
        translation_factory.clear_translator_cache()

    def tearDown(self) -> None:
        translation_factory.clear_translator_cache()

    def _unavailable_local(
        self, spy: _GoogleEngineSpy
    ) -> ExitStack:
        stack = ExitStack()
        stack.enter_context(
            patch.object(translation_factory, "GoogleTranslatorEngine", spy)
        )
        stack.enter_context(
            patch.object(translation_factory, "model_is_installed", return_value=False)
        )
        stack.enter_context(
            patch.object(
                translation_factory,
                "local_translation_runtime_ready",
                return_value=False,
            )
        )
        return stack

    def test_explicit_uninstalled_nllb_keys_raise_without_a_cloud_call(self) -> None:
        for key in NLLB_RUNNABLE_MODEL_IDS:
            spy = _GoogleEngineSpy()
            with self._unavailable_local(spy):
                with self.assertRaises(InvalidModelSelectionError) as ctx:
                    translation_factory.get_translation_engine(key)

            self.assertEqual(ctx.exception.model_key, key)
            self.assertIn("not installed", ctx.exception.reason)
            self.assertEqual(spy.calls, 0)
            self.assertEqual(translation_factory.get_translator_cache_size(), 0)

    def test_explicit_uninstalled_local_key_raises_without_a_cloud_call(self) -> None:
        spy = _GoogleEngineSpy()
        with self._unavailable_local(spy):
            with self.assertRaises(InvalidModelSelectionError) as ctx:
                translation_factory.get_translation_engine("opus-mt-ja-en")

        self.assertEqual(ctx.exception.model_key, "opus-mt-ja-en")
        self.assertIn("not installed", ctx.exception.reason)
        self.assertEqual(spy.calls, 0)

    def test_default_selection_builds_google_once(self) -> None:
        spy = _GoogleEngineSpy()
        with patch.object(translation_factory, "GoogleTranslatorEngine", spy):
            first = translation_factory.get_translation_engine()
            second = translation_factory.get_translation_engine("")

        self.assertEqual(spy.calls, 1)
        self.assertIs(first, spy.last_engine)
        self.assertIs(second, first)

    def test_unknown_and_custom_slugs_refuse_without_a_cloud_call(self) -> None:
        spy = _GoogleEngineSpy()
        with patch.object(translation_factory, "GoogleTranslatorEngine", spy):
            with self.assertRaises(InvalidModelSelectionError) as unknown_ctx:
                translation_factory.get_translation_engine("not_a_registered_engine")
            with self.assertRaises(InvalidModelSelectionError) as custom_ctx:
                translation_factory.get_translation_engine("custom:vendor:model")

        self.assertEqual(unknown_ctx.exception.model_key, "not_a_registered_engine")
        self.assertIn("unknown translation model key", unknown_ctx.exception.reason)
        self.assertEqual(custom_ctx.exception.model_key, "custom:vendor:model")
        self.assertIn("unknown translation model key", custom_ctx.exception.reason)
        self.assertEqual(spy.calls, 0)

    def test_auto_request_resolves_to_the_default_engine(self) -> None:
        spy = _GoogleEngineSpy()
        with patch.object(translation_factory, "GoogleTranslatorEngine", spy):
            engine = translation_factory.get_translation_engine("auto")

        self.assertEqual(engine.key, "google_translate")
        self.assertEqual(spy.calls, 1)

    def test_explicit_unconfigured_deepl_names_the_missing_env(self) -> None:
        spy = _GoogleEngineSpy()
        env = dict(os.environ)
        env.pop("MINI_BACKEND_DEEPL_API_KEY", None)
        with (
            patch.object(translation_factory, "GoogleTranslatorEngine", spy),
            patch.dict("os.environ", env, clear=True),
        ):
            with self.assertRaises(InvalidModelSelectionError) as ctx:
                translation_factory.get_translation_engine("deepl")

        self.assertEqual(ctx.exception.model_key, "deepl")
        self.assertIn("MINI_BACKEND_DEEPL_API_KEY", ctx.exception.reason)
        self.assertIn("not configured", ctx.exception.reason)
        self.assertEqual(spy.calls, 0)

    def test_available_local_key_builds_its_own_engine(self) -> None:
        spy = _GoogleEngineSpy()
        local_engine = GoogleTranslatorEngine()
        with (
            patch.object(translation_factory, "GoogleTranslatorEngine", spy),
            patch.object(translation_factory, "model_is_installed", return_value=True),
            patch.object(
                translation_factory, "local_translation_runtime_ready", return_value=True
            ),
            patch.dict(
                translation_factory._ENGINE_BUILDERS,
                {"opus-mt-ja-en": lambda _key: local_engine},
            ),
        ):
            engine = translation_factory.get_translation_engine("opus-mt-ja-en")

        self.assertIs(engine, local_engine)
        self.assertEqual(spy.calls, 0)


class TranslationDeepLAliasTests(unittest.TestCase):
    """Pin: the UI key ``deepl_translate`` routes to the backend ``deepl`` engine."""

    def setUp(self) -> None:
        translation_factory.clear_translator_cache()

    def tearDown(self) -> None:
        translation_factory.clear_translator_cache()

    def test_ui_key_normalizes_to_the_deepl_engine_key(self) -> None:
        from core.config import normalize_stage_model_key

        self.assertEqual(
            normalize_stage_model_key("translation", "deepl_translate"), "deepl"
        )

    def test_deepl_translate_selection_builds_the_deepl_engine(self) -> None:
        class _DeepLStub(BaseTranslator):
            def __init__(self, api_key: str | None = None) -> None:
                self.api_key = api_key

            async def _translate(
                self, request: TranslationRequest
            ) -> list[TranslationTextResult]:
                raise AssertionError("not exercised in this test")

        env = dict(os.environ)
        env["MINI_BACKEND_DEEPL_API_KEY"] = "test-key"
        with (
            patch.object(translation_factory, "DeepLTranslatorEngine", _DeepLStub),
            patch.dict("os.environ", env),
        ):
            engine = translation_factory.get_translation_engine("deepl_translate")

        self.assertIsInstance(engine, _DeepLStub)

    def test_deepl_translate_without_key_refuses_with_the_env_name(self) -> None:
        spy = _GoogleEngineSpy()
        env = dict(os.environ)
        env.pop("MINI_BACKEND_DEEPL_API_KEY", None)
        with (
            patch.object(translation_factory, "GoogleTranslatorEngine", spy),
            patch.dict("os.environ", env, clear=True),
        ):
            with self.assertRaises(InvalidModelSelectionError) as ctx:
                translation_factory.get_translation_engine("deepl_translate")

        self.assertEqual(ctx.exception.model_key, "deepl")
        self.assertIn("MINI_BACKEND_DEEPL_API_KEY", ctx.exception.reason)
        self.assertEqual(spy.calls, 0)


class TranslationRefusalBoundaryTests(unittest.TestCase):
    """Pin: the translation router enriches refusals with the 1.1 wire shape."""

    def test_refusal_body_names_the_missing_configuration(self) -> None:
        from routers.translation import _refusal_detail

        exc = InvalidModelSelectionError(
            "deepl", "required configuration is missing: MINI_BACKEND_DEEPL_API_KEY"
        )
        detail = _refusal_detail(exc)
        self.assertEqual(detail["code"], "MODEL_NOT_CONFIGURED")
        self.assertEqual(detail["stage"], "translate")
        self.assertEqual(detail["model_key"], "deepl")
        self.assertIn("MINI_BACKEND_DEEPL_API_KEY", str(detail["error"]))
        self.assertIsInstance(detail["available_keys"], list)

    def test_refusal_body_marks_unknown_keys(self) -> None:
        from routers.translation import _refusal_detail

        exc = InvalidModelSelectionError(
            "not_a_registered_engine", "unknown translation model key"
        )
        detail = _refusal_detail(exc)
        self.assertEqual(detail["code"], "UNKNOWN_MODEL")
        self.assertEqual(detail["model_key"], "not_a_registered_engine")


if __name__ == "__main__":
    unittest.main()
