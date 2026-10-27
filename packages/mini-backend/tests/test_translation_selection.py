"""Selection-time routing: an explicit local key never degrades to Google silently."""

from __future__ import annotations

from contextlib import ExitStack
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation import factory as translation_factory  # noqa: E402
from models.translation.base_translator import BaseTranslator  # noqa: E402
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

    def test_unknown_and_custom_keys_keep_the_google_default(self) -> None:
        spy = _GoogleEngineSpy()
        with patch.object(translation_factory, "GoogleTranslatorEngine", spy):
            unknown = translation_factory.get_translation_engine("not_a_registered_engine")
            custom = translation_factory.get_translation_engine("custom:vendor:model")

        self.assertEqual(unknown.key, "google_translate")
        self.assertEqual(custom.key, "google_translate")
        self.assertEqual(spy.calls, 1)

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


if __name__ == "__main__":
    unittest.main()
