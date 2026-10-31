from __future__ import annotations

import os
from pathlib import Path
import sys
import tempfile
import unittest


os.environ["MINI_BACKEND_WARMUP_DETECTOR"] = "0"

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

IMPORT_ERROR: Exception | None = None
try:
    import app as mini_app
except Exception as exc:  # pragma: no cover - optional runtime deps
    IMPORT_ERROR = exc

from core.config import LLMRequestSettings, clamp_llm_request_settings  # noqa: E402
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
    CacheRow,
    TranslationStore,
    glossary_hash,
    normalize_source_text,
    persistent_cache_key,
)
from schemas.translation import TranslationRegionRequest  # noqa: E402


class _FakeEngine:
    def __init__(self, key: str, *, empty_ids: frozenset[str] = frozenset()) -> None:
        self.key = key
        self.empty_ids = empty_ids
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
        return [
            TranslationTextResult(
                id=region.id,
                source_text=region.text,
                translated_text=(
                    "" if region.id in self.empty_ids else f"ok-{region.text}"
                ),
                translation_notes=[] if region.id in self.empty_ids else ["NT: fake note"],
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=self.key,
            )
            for region in regions
        ]


class _Resolver:
    def __init__(self, engine: _FakeEngine) -> None:
        self._engine = engine

    def __call__(self, model_key: str | None = None) -> _FakeEngine:
        _ = model_key
        return self._engine


def _request(
    *,
    settings: LLMRequestSettings | None = None,
    text: str = "konnichiwa",
    model_key: str = "fake",
) -> CachedTranslationRequest:
    region = TranslationRegionRequest(
        id="r1",
        text=text,
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
    )
    return CachedTranslationRequest(
        model_key=model_key,
        source_language="ja",
        target_language="en",
        seeds=(seed_from_request(region),),
        translation_mode="default",
        settings=settings if settings is not None else clamp_llm_request_settings({}),
        custom_llm=None,
    )


def _persistent_key(request: CachedTranslationRequest, text: str) -> str:
    gloss = glossary_hash(
        [
            (term.source, term.target, term.never_translate)
            for term in request.settings.glossary
        ]
    )
    return persistent_cache_key(
        (request.model_key or "").strip() or "fake",
        request.source_language,
        request.target_language,
        (request.translation_mode or "").strip().lower() or "default",
        normalize_source_text(text),
        gloss,
    )


class PersistentCacheStageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_path = Path(self.tmp.name) / "store.sqlite3"
        self.cache = CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2)
        self.engine = _FakeEngine("fake")
        self.resolver = _Resolver(self.engine)

    def _run(
        self, request: CachedTranslationRequest, store: TranslationStore
    ):
        import asyncio

        return asyncio.run(
            run_cached_translation(
                request,
                cache=self.cache,
                resolve_engine=self.resolver,
                store=store,
            )
        )

    def test_first_call_persists_engine_answers(self) -> None:
        request = _request()
        store = TranslationStore(self.db_path)
        try:
            result = self._run(request, store)
            self.assertEqual(self.engine.calls, 1)
            self.assertEqual(result.records[0]["translated_text"], "ok-konnichiwa")

            key = _persistent_key(request, "konnichiwa")
            rows = store.get_cached([key])
            self.assertEqual(rows[key].translated_text, "ok-konnichiwa")
            self.assertEqual(rows[key].notes, ("NT: fake note",))
            self.assertEqual(rows[key].engine_key, "fake")
        finally:
            store.close()

    def test_reopen_serves_hits_without_engine_calls(self) -> None:
        request = _request()
        first = TranslationStore(self.db_path)
        try:
            first_result = self._run(request, first)
        finally:
            first.close()

        # A NEW store instance on the same file: what a restarted process does.
        second = TranslationStore(self.db_path)
        try:
            fresh_engine = _FakeEngine("fake")
            self.resolver = _Resolver(fresh_engine)
            second_result = self._run(request, second)
            self.assertEqual(fresh_engine.calls, 0)
            self.assertEqual(
                second_result.records[0]["translated_text"],
                first_result.records[0]["translated_text"],
            )
            self.assertEqual(
                second_result.records[0]["translation_notes"],
                first_result.records[0]["translation_notes"],
            )
            self.assertEqual(second_result.records[0]["translator_model_key"], "fake")
        finally:
            second.close()

    def test_empty_engine_results_are_not_persisted(self) -> None:
        engine = _FakeEngine("fake", empty_ids=frozenset({"r1"}))
        self.resolver = _Resolver(engine)
        empty_seed = seed_from_request(
            TranslationRegionRequest(
                id="r1",
                text="vazio",
                source="model",
                detector_model_key="det",
                ocr_model_key="ocr",
            )
        )
        ok_seed = seed_from_request(
            TranslationRegionRequest(
                id="r2",
                text="konnichiwa",
                source="model",
                detector_model_key="det",
                ocr_model_key="ocr",
            )
        )
        request = CachedTranslationRequest(
            model_key="fake",
            source_language="ja",
            target_language="en",
            seeds=(empty_seed, ok_seed),
            translation_mode="default",
            settings=clamp_llm_request_settings({}),
            custom_llm=None,
        )
        store = TranslationStore(self.db_path)
        try:
            result = self._run(request, store)
            self.assertEqual(engine.calls, 1)
            self.assertEqual(result.records[0]["translated_text"], "")
            self.assertEqual(result.records[1]["translated_text"], "ok-konnichiwa")
            self.assertEqual(store.get_cached([_persistent_key(request, "vazio")]), {})
            self.assertIn(
                _persistent_key(request, "konnichiwa"),
                store.get_cached([_persistent_key(request, "konnichiwa")]),
            )
        finally:
            store.close()

    @unittest.skipIf(
        IMPORT_ERROR is not None,
        f"optional runtime dependencies missing: {IMPORT_ERROR}",
    )
    def test_clear_all_caches_leaves_persistent_rows_intact(self) -> None:
        request = _request()
        store = TranslationStore(self.db_path)
        try:
            self._run(request, store)
            key = _persistent_key(request, "konnichiwa")
            mini_app._clear_all_caches()
            self.assertIn(key, store.get_cached([key]))
        finally:
            store.close()

    def test_local_hit_missing_protected_term_is_discarded_and_reruns(self) -> None:
        settings = clamp_llm_request_settings(
            {
                "glossary": [
                    {"source": "Kaito", "target": "Kaito", "never_translate": True}
                ]
            }
        )
        request = _request(settings=settings)
        key = _persistent_key(request, "konnichiwa")
        store = TranslationStore(self.db_path)
        try:
            store.put_cached(
                [
                    CacheRow(
                        key=key,
                        translated_text="ok-konnichiwa",
                        notes=(),
                        engine_key="sugoi_v4_ja_en_ct2",
                    )
                ]
            )
            result = self._run(request, store)
            self.assertEqual(self.engine.calls, 1)
            self.assertEqual(result.records[0]["translated_text"], "ok-konnichiwa")
            # The fresh answer replaced the rejected row.
            rows = store.get_cached([key])
            self.assertEqual(rows[key].engine_key, "fake")
        finally:
            store.close()

    def test_cloud_hit_passes_the_parity_guard_unchecked(self) -> None:
        settings = clamp_llm_request_settings(
            {
                "glossary": [
                    {"source": "Kaito", "target": "Kaito", "never_translate": True}
                ]
            }
        )
        request = _request(settings=settings)
        key = _persistent_key(request, "konnichiwa")
        store = TranslationStore(self.db_path)
        try:
            store.put_cached(
                [
                    CacheRow(
                        key=key,
                        translated_text="ok-konnichiwa",
                        notes=("NT: guardado",),
                        engine_key="google_translate",
                    )
                ]
            )
            result = self._run(request, store)
            self.assertEqual(self.engine.calls, 0)
            self.assertEqual(result.records[0]["translated_text"], "ok-konnichiwa")
            self.assertEqual(result.records[0]["translation_notes"], ["NT: guardado"])
            self.assertEqual(
                result.records[0]["translator_model_key"], "google_translate"
            )
        finally:
            store.close()


if __name__ == "__main__":
    unittest.main()
