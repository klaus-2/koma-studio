"""run_cached_translation seam tests — inject engines/cache, no module patches."""

from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import clamp_llm_request_settings  # noqa: E402
from models.translation import fallback  # noqa: E402
from models.translation.base_translator import (  # noqa: E402
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.errors import TranslatorUnavailableError  # noqa: E402
from models.translation.factory import TranslationModelOption  # noqa: E402
from models.translation.fallback import QuotaBlocklist  # noqa: E402
from pipelines.translation_stage import (  # noqa: E402
    CachedTranslationRequest,
    run_cached_translation,
    seed_from_request,
)
from pipelines.cache_manager import CacheManager  # noqa: E402
from schemas.translation import TranslationRegionRequest  # noqa: E402


class _FakeEngine:
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
                translated_text=f"ok-{region.text}",
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=self.key,
            )
            for region in regions
        ]


class _Resolver:
    def __init__(self, engines: dict[str, _FakeEngine]) -> None:
        self._engines = engines
        self.resolved: list[str] = []

    def __call__(self, model_key: str | None = None) -> _FakeEngine:
        key = (model_key or "").strip() or "google_translate"
        self.resolved.append(key)
        return self._engines[key]


def _option(key: str) -> TranslationModelOption:
    return {
        "key": key,
        "name": key,
        "device": "cpu",
        "use_case": "test",
        "implemented": True,
        "available": True,
    }


def _request(**overrides: object) -> CachedTranslationRequest:
    region = TranslationRegionRequest(
        id="r1",
        text="konnichiwa",
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
    )
    base: dict[str, object] = {
        "model_key": "fake",
        "source_language": "ja",
        "target_language": "en",
        "seeds": (seed_from_request(region),),
        "translation_mode": "default",
        "settings": clamp_llm_request_settings({}),
        "custom_llm": None,
    }
    base.update(overrides)
    return CachedTranslationRequest(**base)  # pyright: ignore[reportCallIssue]


class RunCachedTranslationSeamTests(unittest.TestCase):
    def setUp(self) -> None:
        self.cache = CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2)
        self.quota = QuotaBlocklist()

    def test_single_engine_is_resolved_injected_and_answers(self) -> None:
        engine = _FakeEngine("fake")
        resolver = _Resolver({"fake": engine})

        result = self._run(resolver)

        self.assertEqual(resolver.resolved, ["fake"])
        self.assertEqual(engine.calls, 1)
        self.assertEqual(result.engine_key, "fake")
        self.assertEqual(
            result.records[0]["translated_text"],
            "ok-konnichiwa",
        )

    def test_chain_falls_back_via_injected_resolver(self) -> None:
        first = _FakeEngine("a", TranslatorUnavailableError("a", "down"))
        second = _FakeEngine("b")
        resolver = _Resolver({"a": first, "b": second})

        with patch.object(
            fallback,
            "list_translation_models",
            return_value=[_option("a"), _option("b")],
        ):
            result = self._run(
                resolver,
                model_key="a",
                settings=clamp_llm_request_settings(
                    {"translation_fallback_chain": ["a", "b"]}
                ),
            )

        self.assertEqual(resolver.resolved, ["a", "b"])
        self.assertEqual(first.calls, 1)
        self.assertEqual(second.calls, 1)
        self.assertEqual(result.engine_key, "b")
        self.assertEqual(result.model_used, "b")

    def test_second_call_is_served_from_cache_without_resolver(self) -> None:
        engine = _FakeEngine("fake")
        resolver = _Resolver({"fake": engine})

        self._run(resolver)
        self._run(resolver)

        self.assertEqual(engine.calls, 1)
        self.assertEqual(resolver.resolved, ["fake"])

    def test_neighbor_and_user_extra_context_reach_the_engine(self) -> None:
        seen: list[str] = []

        class _Capture(_FakeEngine):
            async def translate(self, *args: object, **kwargs: object):  # type: ignore[override]
                seen.append(str(kwargs.get("extra_context") or ""))
                return await super().translate(*args, **kwargs)  # type: ignore[arg-type]

        self._run(
            _Resolver({"fake": _Capture("fake")}),
            settings=clamp_llm_request_settings({"extra_context": "batch-glossary"}),
            neighbor_context="Next page context: …",
        )

        self.assertEqual(len(seen), 1)
        self.assertIn("batch-glossary", seen[0])
        self.assertIn("Next page context", seen[0])

    def test_result_exposes_records_for_the_batch_adapter(self) -> None:
        engine = _FakeEngine("fake")
        result = self._run(_Resolver({"fake": engine}))
        self.assertEqual(len(result.records), 1)
        self.assertEqual(result.records[0]["translated_text"], "ok-konnichiwa")

    def _run(
        self,
        resolver: _Resolver,
        **overrides: object,
    ):
        import asyncio

        return asyncio.run(
            run_cached_translation(
                _request(**overrides),
                cache=self.cache,
                quota_blocklist=self.quota,
                resolve_engine=resolver,
            )
        )


if __name__ == "__main__":
    unittest.main()
