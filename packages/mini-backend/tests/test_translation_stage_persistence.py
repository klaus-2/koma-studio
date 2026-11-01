from __future__ import annotations

import logging
import os
from collections.abc import Sequence
from pathlib import Path
import sqlite3
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch


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
from pipelines import translation_stage  # noqa: E402
from pipelines.cache_manager import CacheManager  # noqa: E402
from pipelines.translation_stage import (  # noqa: E402
    CachedTranslationRequest,
    run_cached_translation,
    seed_from_request,
)
from pipelines.translation_store import (  # noqa: E402
    CacheRow,
    TMEntry,
    TMWrite,
    TranslationStore,
    TranslationStoreError,
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
    custom_llm: dict[str, str] | None = None,
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
        custom_llm=custom_llm,
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


class _RaisingStore(TranslationStore):
    """A store whose every operation fails (unreadable/corrupt sqlite file).

    Bypasses the real __init__: every overridden operation raises before the
    connection would be touched.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._closed = False

    def get_cached(self, keys: Sequence[str]) -> dict[str, CacheRow]:
        raise sqlite3.OperationalError("disk I/O error")

    def put_cached(self, rows: Sequence[CacheRow]) -> int:
        raise sqlite3.OperationalError("disk I/O error")

    def lookup_tm(
        self, keys: Sequence[tuple[str, str, str]]
    ) -> dict[tuple[str, str, str], TMEntry]:
        raise sqlite3.OperationalError("disk I/O error")

    def put_tm(self, rows: Sequence[TMWrite]) -> None:
        raise sqlite3.OperationalError("disk I/O error")

    def bump_tm_hits(self, keys: Sequence[tuple[str, str, str]]) -> None:
        raise sqlite3.OperationalError("disk I/O error")

    def prune(self, max_rows: int = 200_000) -> int:
        raise sqlite3.OperationalError("disk I/O error")

    def close(self) -> None:
        return None


class PersistentCacheStageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_path = Path(self.tmp.name) / "store.sqlite3"
        self.cache = CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2)
        self.engine = _FakeEngine("fake")
        self.resolver = _Resolver(self.engine)
        # The degrade-to-memory warning is once per process; start clean.
        translation_stage._store_degradation_warned = False  # noqa: SLF001
        self.addCleanup(setattr, translation_stage, "_store_degradation_warned", False)

    def _run(
        self, request: CachedTranslationRequest, store: TranslationStore | None
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

    def test_failing_store_degrades_to_memory_and_warns_once(self) -> None:
        request = _request()
        raising_store = _RaisingStore()

        with self.assertLogs(
            "pipelines.translation_stage", level="WARNING"
        ) as logs:
            result = self._run(request, raising_store)

        self.assertEqual(self.engine.calls, 1)
        self.assertEqual(result.records[0]["translated_text"], "ok-konnichiwa")
        warnings = [
            record for record in logs.records if record.levelno == logging.WARNING
        ]
        self.assertEqual(len(warnings), 1)
        self.assertEqual(
            warnings[0].getMessage(), "translation.store.degraded_to_memory"
        )

        # Second request also succeeds and stays silent (once per process);
        # a fresh text forces the degraded store to be consulted again.
        with self.assertNoLogs("pipelines.translation_stage", level="WARNING"):
            second = self._run(_request(text="sayonara"), raising_store)
        self.assertEqual(self.engine.calls, 2)
        self.assertEqual(second.records[0]["translated_text"], "ok-sayonara")

    def test_unopenable_store_resolution_degrades_to_memory(self) -> None:
        request = _request()

        with (
            patch.object(
                translation_stage,
                "get_translation_store",
                side_effect=TranslationStoreError("schema version 99"),
            ),
            self.assertLogs("pipelines.translation_stage", level="WARNING"),
        ):
            result = self._run(request, None)

        self.assertEqual(self.engine.calls, 1)
        self.assertEqual(result.records[0]["translated_text"], "ok-konnichiwa")

    def test_custom_profile_identity_keys_the_persistent_cache(self) -> None:
        """Same uuid + edited model must NOT be served the old profile's row;
        same uuid + same identity (restart) must be."""
        store = TranslationStore(self.db_path)
        try:
            profile = {"api_base": "http://127.0.0.1:11434", "model": "old-model"}
            first = _FakeEngine("custom:uuid-1")
            second = _FakeEngine("custom:uuid-1")
            third = _FakeEngine("custom:uuid-1")
            engines = [first, second, third]

            def run(custom_llm: dict[str, str]):
                import asyncio

                return asyncio.run(
                    run_cached_translation(
                        _request(
                            model_key="custom:uuid-1", custom_llm=dict(custom_llm)
                        ),
                        # Fresh CacheManager per run: every run must cross the
                        # persistent layer, like a restarted process.
                        cache=CacheManager(
                            ttl_seconds=60, max_entries=8, bbox_tolerance_px=2
                        ),
                        resolve_engine=self.resolver,
                        store=store,
                    )
                )

            with patch.object(
                translation_stage,
                "build_request_scoped_custom_translation_engine",
                side_effect=lambda **_kwargs: engines.pop(0),
            ):
                run(profile)
                self.assertEqual(first.calls, 1)

                rerun = run(profile)
                self.assertEqual(second.calls, 0)  # built, but the row answered
                self.assertEqual(rerun.records[0]["translated_text"], "ok-konnichiwa")

                edited = run({**profile, "model": "new-model"})
                self.assertEqual(third.calls, 1)
                self.assertEqual(edited.records[0]["translated_text"], "ok-konnichiwa")
        finally:
            store.close()


if __name__ == "__main__":
    unittest.main()
