"""Ordered provider-fallback routing tests (plan T2)."""

from __future__ import annotations

from collections.abc import Callable, Sequence
import datetime
from pathlib import Path
import sys
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation import fallback  # noqa: E402
from models.translation.base_translator import (  # noqa: E402
    BaseTranslator,
    TranslationInputRegion,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.errors import (  # noqa: E402
    LocalModelError,
    TranslatorConfigurationError,
    TranslatorResponseError,
    TranslatorUnavailableError,
)
from models.translation.factory import TranslationModelOption  # noqa: E402
from models.translation.fallback import (  # noqa: E402
    QuotaBlocklist,
    TranslationFallbackError,
    translate_with_fallback,
    validate_translation_chain_keys,
)


class _StubTranslator(BaseTranslator):
    """Minimal engine: echoes a prefixed translation, or raises the wired error."""

    def __init__(self, key: str, error: Exception | None = None) -> None:
        self.key = key
        self.error = error
        self.calls = 0

    async def _translate(
        self, request: TranslationRequest
    ) -> list[TranslationTextResult]:
        self.calls += 1
        if self.error is not None:
            raise self.error
        return [
            self._result(region, f"translated-{region.text}")
            for region in request.regions
        ]


def _option(
    key: str, *, implemented: bool = True, available: bool = True
) -> TranslationModelOption:
    return {
        "key": key,
        "name": key,
        "device": "cpu",
        "use_case": "test",
        "implemented": implemented,
        "available": available,
    }


async def _run_translate(engine: BaseTranslator) -> list[TranslationTextResult]:
    regions: Sequence[TranslationInputRegion] = [
        TranslationInputRegion(id="r1", text="konnichiwa")
    ]
    return await engine.translate(
        regions=regions, source_language="ja", target_language="en"
    )


class TranslationFallbackTests(unittest.IsolatedAsyncioTestCase):
    def _resolver(
        self, engines: dict[str, BaseTranslator]
    ) -> tuple[Callable[[str], BaseTranslator], list[str]]:
        """Resolver double that records which keys were asked to be built."""
        resolved: list[str] = []

        def resolve(key: str) -> BaseTranslator:
            resolved.append(key)
            return engines[key]

        return resolve, resolved

    async def test_first_unavailable_engine_falls_back_to_the_next_one(self) -> None:
        first = _StubTranslator("a", TranslatorUnavailableError("a", "connection refused"))
        second = _StubTranslator("b")
        resolve, resolved = self._resolver({"a": first, "b": second})

        result = await translate_with_fallback(
            ["a", "b"], resolve=resolve, translate=_run_translate
        )

        self.assertEqual(result.engine_key, "b")
        self.assertEqual([attempt.model_key for attempt in result.attempts], ["a", "b"])
        self.assertEqual([attempt.ok for attempt in result.attempts], [False, True])
        self.assertEqual(result.attempts[0].error_class, "TranslatorUnavailableError")
        self.assertEqual(result.attempts[1].error_class, None)
        self.assertEqual(result.value[0].translated_text, "translated-konnichiwa")
        self.assertEqual(resolved, ["a", "b"])
        self.assertEqual(second.calls, 1)

    async def test_configuration_error_is_re_raised_without_touching_next_engine(self) -> None:
        boom = TranslatorConfigurationError("missing API key")
        first = _StubTranslator("a", boom)
        second = _StubTranslator("b")
        resolve, resolved = self._resolver({"a": first, "b": second})

        with self.assertRaises(TranslatorConfigurationError) as ctx:
            await translate_with_fallback(
                ["a", "b"], resolve=resolve, translate=_run_translate
            )

        self.assertIs(ctx.exception, boom)
        self.assertEqual(resolved, ["a"])
        self.assertEqual(second.calls, 0)

    async def test_exhausted_chain_raises_with_every_attempt_and_last_cause(self) -> None:
        first_error = TranslatorResponseError("a", 429, "rate limited")
        last_error = LocalModelError("b model files are missing")
        resolve, _resolved = self._resolver(
            {
                "a": _StubTranslator("a", first_error),
                "b": _StubTranslator("b", last_error),
            }
        )

        with self.assertRaises(TranslationFallbackError) as ctx:
            await translate_with_fallback(
                ["a", "b"], resolve=resolve, translate=_run_translate
            )

        error = ctx.exception
        self.assertEqual([attempt.model_key for attempt in error.attempts], ["a", "b"])
        self.assertFalse(all(attempt.ok for attempt in error.attempts))
        self.assertIs(error.__cause__, last_error)
        self.assertIsInstance(error, RuntimeError)

    async def test_quota_blocked_key_is_skipped_and_only_unavailability_blocks(self) -> None:
        blocklist = QuotaBlocklist()
        blocklist.block("a")
        second = _StubTranslator("b")
        resolve, resolved = self._resolver({"b": second})

        result = await translate_with_fallback(
            ["a", "b"],
            resolve=resolve,
            translate=_run_translate,
            quota_blocklist=blocklist,
        )

        self.assertEqual(result.engine_key, "b")
        self.assertEqual(resolved, ["b"])
        self.assertEqual([attempt.model_key for attempt in result.attempts], ["b"])

        day_blocklist = QuotaBlocklist()
        unavailable = _StubTranslator("c", TranslatorUnavailableError("c", "dns failure"))
        resolve_c, _resolved_c = self._resolver({"c": unavailable})
        with self.assertRaises(TranslationFallbackError):
            await translate_with_fallback(
                ["c"],
                resolve=resolve_c,
                translate=_run_translate,
                quota_blocklist=day_blocklist,
            )
        self.assertTrue(day_blocklist.is_blocked("c"))

        refused = _StubTranslator("d", TranslatorResponseError("d", 500, "boom"))
        resolve_d, _resolved_d = self._resolver({"d": refused})
        with self.assertRaises(TranslationFallbackError):
            await translate_with_fallback(
                ["d"],
                resolve=resolve_d,
                translate=_run_translate,
                quota_blocklist=day_blocklist,
            )
        self.assertFalse(day_blocklist.is_blocked("d"))

    async def test_chain_key_validation_rejects_unknown_and_unavailable(self) -> None:
        options = [
            _option("google_translate"),
            _option("deepl", available=False),
            _option("future_engine", implemented=False, available=False),
        ]
        with patch.object(fallback, "list_translation_models", return_value=options):
            self.assertEqual(
                validate_translation_chain_keys(["google_translate"]),
                ("google_translate",),
            )
            for rejected in ("not_a_real_engine", "deepl", "future_engine"):
                with self.assertRaises(TranslatorConfigurationError):
                    validate_translation_chain_keys([rejected])

    async def test_quota_blocklist_resets_on_the_next_local_day(self) -> None:
        today = [datetime.date(2026, 9, 15)]
        with patch.object(fallback, "_today", lambda: today[0]):
            blocklist = QuotaBlocklist()
            blocklist.block("a")
            self.assertTrue(blocklist.is_blocked("a"))
            self.assertFalse(blocklist.is_blocked("never-blocked"))

            today[0] = datetime.date(2026, 9, 16)
            self.assertFalse(blocklist.is_blocked("a"))
            blocklist.block("b")
            self.assertTrue(blocklist.is_blocked("b"))


if __name__ == "__main__":
    unittest.main()
