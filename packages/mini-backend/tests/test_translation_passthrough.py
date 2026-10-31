from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import clamp_llm_request_settings  # noqa: E402
from models.translation.base_translator import (  # noqa: E402
    TranslationInputRegion,
    TranslationTextResult,
)
from pipelines.cache_manager import CacheManager  # noqa: E402
from pipelines.translation_stage import (  # noqa: E402
    CachedTranslationRequest,
    run_cached_translation,
    seed_from_request,
)
from pipelines.translation_store import (  # noqa: E402
    TranslationStore,
    glossary_hash,
    normalize_source_text,
    persistent_cache_key,
)
from schemas.translation import TranslationRegionRequest  # noqa: E402


class _RecordingEngine:
    def __init__(self, key: str) -> None:
        self.key = key
        self.calls = 0
        self.texts: list[str] = []

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
        self.texts.extend(region.text for region in regions)
        return [
            TranslationTextResult(
                id=region.id,
                source_text=region.text.strip(),
                translated_text=f"en:{region.text.strip()}",
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=self.key,
            )
            for region in regions
        ]


class _Resolver:
    def __init__(self, engine: _RecordingEngine) -> None:
        self._engine = engine

    def __call__(self, model_key: str | None = None) -> _RecordingEngine:
        _ = model_key
        return self._engine


def _region(region_id: str, text: str) -> TranslationRegionRequest:
    return TranslationRegionRequest(
        id=region_id,
        text=text,
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
    )


def _request(regions: list[TranslationRegionRequest]) -> CachedTranslationRequest:
    return CachedTranslationRequest(
        model_key="fake",
        source_language="ja",
        target_language="en",
        seeds=tuple(seed_from_request(region) for region in regions),
        translation_mode="default",
        settings=clamp_llm_request_settings({}),
        custom_llm=None,
    )


def _persistent_key(text: str) -> str:
    settings = clamp_llm_request_settings({})
    return persistent_cache_key(
        "fake",
        "ja",
        "en",
        "default",
        normalize_source_text(text),
        glossary_hash(
            [(t.source, t.target, t.never_translate) for t in settings.glossary]
        ),
    )


class SymbolPassthroughTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = TranslationStore(Path(self.tmp.name) / "store.sqlite3")
        self.addCleanup(self.store.close)
        self.cache = CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2)
        self.engine = _RecordingEngine("fake")
        self.resolver = _Resolver(self.engine)

    def _run(self, request: CachedTranslationRequest):
        import asyncio

        return asyncio.run(
            run_cached_translation(
                request,
                cache=self.cache,
                resolve_engine=self.resolver,
                store=self.store,
            )
        )

    def test_symbol_only_batch_reaches_no_engine_and_no_store(self) -> None:
        request = _request(
            [
                _region("r1", "..."),
                _region("r2", "!!!"),
            ]
        )

        result = self._run(request)

        self.assertEqual(self.engine.calls, 0)
        self.assertEqual(self.engine.texts, [])
        self.assertEqual(result.records[0]["translated_text"], "...")
        self.assertEqual(result.records[1]["translated_text"], "!!!")
        for record in result.records:
            self.assertEqual(record["translation_notes"], [])
            self.assertEqual(record["translator_model_key"], "fake")
            self.assertEqual(record["source_text"], record["translated_text"])
        self.assertEqual(
            self.store.get_cached([_persistent_key("..."), _persistent_key("!!!")]),
            {},
        )

    def test_mixed_batch_sends_only_letter_bearing_regions(self) -> None:
        request = _request(
            [
                _region("r1", "..."),
                _region("r2", "hello"),
                _region("r3", "?!"),
            ]
        )

        result = self._run(request)

        self.assertEqual(self.engine.calls, 1)
        self.assertEqual(self.engine.texts, ["hello"])
        self.assertEqual(result.records[0]["translated_text"], "...")
        self.assertEqual(result.records[1]["translated_text"], "en:hello")
        self.assertEqual(result.records[2]["translated_text"], "?!")
        self.assertIn(
            _persistent_key("hello"), self.store.get_cached([_persistent_key("hello")])
        )
        self.assertEqual(
            self.store.get_cached([_persistent_key("..."), _persistent_key("?!")]),
            {},
        )

    def test_whitespace_only_seed_passes_through_empty(self) -> None:
        request = _request([_region("r1", "   ")])

        result = self._run(request)

        self.assertEqual(self.engine.calls, 0)
        self.assertEqual(result.records[0]["translated_text"], "   ")
        self.assertEqual(result.records[0]["translator_model_key"], "fake")


if __name__ == "__main__":
    unittest.main()
