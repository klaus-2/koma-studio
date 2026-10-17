"""POST /translate fallback-chain tests (plan T3)."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
    from models.translation import fallback as translation_fallback
    from models.translation.base_translator import (
        TranslationInputRegion,
        TranslationTextResult,
    )
    from models.translation.errors import (
        TranslatorUnavailableError,
        UnsupportedLanguagePairError,
    )
    from models.translation.factory import TranslationModelOption
    from models.translation.fallback import QuotaBlocklist
    from pipelines.cache_manager import get_pipeline_cache
    from routers import translation as translation_router
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc


class _FakeEngine:
    """Duck-typed translation engine: echoes a prefixed text, or raises."""

    def __init__(self, key: str, error: Exception | None = None) -> None:
        self.key = key
        self.error = error
        self.calls = 0

    async def translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = source_language, target_language, extra_context
        _ = translation_notes_enabled, translation_mode
        self.calls += 1
        if self.error is not None:
            raise self.error
        return [
            TranslationTextResult(
                id=region.id,
                source_text=region.text,
                translated_text=f"translated-{region.text}",
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=self.key,
            )
            for region in regions
        ]


def _option(key: str) -> TranslationModelOption:
    return {
        "key": key,
        "name": key,
        "device": "cpu",
        "use_case": "test",
        "implemented": True,
        "available": True,
    }


def _regions(text: str = "konnichiwa") -> str:
    return json.dumps(
        [
            {
                "id": "r1",
                "text": text,
                "source": "model",
                "detector_model_key": "det-a",
                "ocr_model_key": "ocr-a",
            }
        ]
    )


class _Resolver:
    """Stand-in for get_translation_engine; records the keys it was asked for."""

    def __init__(
        self, engines: dict[str, _FakeEngine], default_key: str = "google_translate"
    ) -> None:
        self._engines = engines
        self._default_key = default_key
        self.resolved: list[str] = []

    def __call__(self, model_key: str | None = None) -> _FakeEngine:
        key = (model_key or "").strip() or self._default_key
        self.resolved.append(key)
        return self._engines[key]


@unittest.skipIf(
    IMPORT_ERROR is not None, f"optional runtime dependencies missing: {IMPORT_ERROR}"
)
class TranslationFallbackRouteTests(unittest.TestCase):
    def setUp(self) -> None:
        # The handler always reads the process-wide singleton; the router module
        # attribute can be rebound by other test modules, so clear the instance.
        get_pipeline_cache().clear()
        translation_router._TRANSLATION_QUOTA = QuotaBlocklist()  # noqa: SLF001

    @staticmethod
    def _registry(*keys: str) -> patch:
        options = [_option(key) for key in keys]
        return patch.object(
            translation_fallback, "list_translation_models", return_value=options
        )

    @staticmethod
    def _client() -> TestClient:
        return TestClient(mini_app.app)

    def test_empty_chain_resolves_exactly_one_engine(self) -> None:
        client = self._client()
        engine = _FakeEngine("fake_translation_model")
        resolver = _Resolver({"fake": engine})

        with patch.object(translation_router, "get_translation_engine", side_effect=resolver):
            response = client.post(
                "/translate",
                data={
                    "model_key": "fake",
                    "source_language": "ja",
                    "target_language": "en",
                    "regions": _regions(),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(resolver.resolved, ["fake"])
        self.assertEqual(engine.calls, 1)
        self.assertEqual(response.json()["model_used"], "fake")

        unrequested = _FakeEngine("fake_translation_model")
        bare_resolver = _Resolver({"google_translate": unrequested})
        with patch.object(
            translation_router, "get_translation_engine", side_effect=bare_resolver
        ):
            bare = client.post(
                "/translate",
                data={
                    "source_language": "ja",
                    "target_language": "en",
                    "regions": _regions("sayonara"),
                },
            )

        self.assertEqual(bare.status_code, 200)
        self.assertEqual(bare_resolver.resolved, ["google_translate"])
        self.assertEqual(bare.json()["model_used"], "fake_translation_model")

    def test_chain_falls_back_to_next_engine_and_warns(self) -> None:
        client = self._client()
        first = _FakeEngine("a", TranslatorUnavailableError("a", "connection refused"))
        second = _FakeEngine("b")
        resolver = _Resolver({"a": first, "b": second})

        with (
            self._registry("a", "b"),
            patch.object(translation_router, "get_translation_engine", side_effect=resolver),
            self.assertLogs(translation_router.logger, level="WARNING") as logs,
        ):
            response = client.post(
                "/translate",
                data={
                    "model_key": "a",
                    "source_language": "ja",
                    "target_language": "en",
                    "regions": _regions(),
                    "llm_settings": json.dumps({"translation_fallback_chain": ["a", "b"]}),
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(resolver.resolved, ["a", "b"])
        self.assertEqual(first.calls, 1)
        self.assertEqual(second.calls, 1)
        body = response.json()
        self.assertEqual(body["model_used"], "b")
        self.assertEqual(body["regions"][0]["translated_text"], "translated-konnichiwa")
        self.assertEqual(body["regions"][0]["translator_model_key"], "b")
        self.assertTrue(
            any("translation fallback" in record.getMessage() for record in logs.records),
            logs.output,
        )

    def test_fail_fast_error_from_first_engine_is_not_retried(self) -> None:
        client = self._client()
        boom = UnsupportedLanguagePairError("a", "ja", "en")
        first = _FakeEngine("a", boom)
        second = _FakeEngine("b")
        resolver = _Resolver({"a": first, "b": second})

        with (
            self._registry("a", "b"),
            patch.object(translation_router, "get_translation_engine", side_effect=resolver),
        ):
            response = client.post(
                "/translate",
                data={
                    "model_key": "a",
                    "source_language": "ja",
                    "target_language": "en",
                    "regions": _regions(),
                    "llm_settings": json.dumps({"translation_fallback_chain": ["a", "b"]}),
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"detail": str(boom)})
        self.assertEqual(resolver.resolved, ["a"])
        self.assertEqual(second.calls, 0)

    def test_unknown_chain_key_fails_before_any_engine_is_resolved(self) -> None:
        client = self._client()
        resolver = _Resolver({"a": _FakeEngine("a")})

        with (
            self._registry("a"),
            patch.object(translation_router, "get_translation_engine", side_effect=resolver),
        ):
            response = client.post(
                "/translate",
                data={
                    "model_key": "a",
                    "source_language": "ja",
                    "target_language": "en",
                    "regions": _regions(),
                    "llm_settings": json.dumps(
                        {"translation_fallback_chain": ["a", "not_a_real_engine"]}
                    ),
                },
            )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(resolver.resolved, [])
        self.assertIn("not_a_real_engine", str(response.json()["detail"]))


if __name__ == "__main__":
    unittest.main()
