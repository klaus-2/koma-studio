from __future__ import annotations

import sqlite3
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
    TMWrite,
    TranslationStore,
    tm_key,
)
from schemas.translation import TranslationRegionRequest  # noqa: E402


class _FakeEngine:
    def __init__(self, key: str, *, translated_text: str | None = None) -> None:
        self.key = key
        self.translated_text = translated_text
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
                source_text=region.text.strip(),
                translated_text=(
                    self.translated_text
                    if self.translated_text is not None
                    else f"ok-{region.text.strip()}"
                ),
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
    settings: object = None,
    text: str = "konnichiwa",
    mode: str = "default",
) -> CachedTranslationRequest:
    region = TranslationRegionRequest(
        id="r1",
        text=text,
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
    )
    return CachedTranslationRequest(
        model_key="fake",
        source_language="ja",
        target_language="en",
        seeds=(seed_from_request(region),),
        translation_mode=mode,
        settings=(
            settings
            if settings is not None
            else clamp_llm_request_settings({})
        ),
        custom_llm=None,
    )


def _run(request: CachedTranslationRequest, engine: _FakeEngine, store: TranslationStore):
    import asyncio

    return asyncio.run(
        run_cached_translation(
            request,
            cache=CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2),
            resolve_engine=_Resolver(engine),
            store=store,
        )
    )


class TranslationMemoryClampTests(unittest.TestCase):
    def test_toggle_defaults_to_off_and_clamps_to_strict_bool(self) -> None:
        self.assertFalse(clamp_llm_request_settings({}).translation_memory_enabled)
        self.assertTrue(
            clamp_llm_request_settings({"translation_memory_enabled": True}).translation_memory_enabled
        )
        self.assertFalse(
            clamp_llm_request_settings({"translation_memory_enabled": "off"}).translation_memory_enabled
        )


class TranslationMemoryStageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.db_path = Path(self.tmp.name) / "store.sqlite3"
        self.store = TranslationStore(self.db_path)
        self.addCleanup(self.store.close)

    def _tm_hits(self) -> int:
        raw = sqlite3.connect(str(self.db_path))
        try:
            row = raw.execute("SELECT hits FROM tm WHERE nfkc_key = ?", (tm_key("konnichiwa"),)).fetchone()
        finally:
            raw.close()
        return int(row[0]) if row is not None else 0

    def test_reads_are_opt_in_default_off(self) -> None:
        self.store.put_tm(
            [TMWrite(tm_key("konnichiwa"), "ja", "en", "TM translation", "m2m100_1_2b_ct2")]
        )
        engine = _FakeEngine("fake")
        settings = clamp_llm_request_settings({"translation_memory_enabled": False})

        result = _run(_request(settings=settings), engine, self.store)

        self.assertEqual(engine.calls, 1)
        self.assertEqual(result.records[0]["translated_text"], "ok-konnichiwa")

    def test_opt_in_read_serves_tm_without_engine_call_and_bumps(self) -> None:
        self.store.put_tm(
            [TMWrite(tm_key("konnichiwa"), "ja", "en", "TM translation", "m2m100_1_2b_ct2")]
        )
        engine = _FakeEngine("fake")
        settings = clamp_llm_request_settings({"translation_memory_enabled": True})

        result = _run(_request(settings=settings), engine, self.store)

        self.assertEqual(engine.calls, 0)
        self.assertEqual(result.records[0]["translated_text"], "TM translation")
        self.assertEqual(
            result.records[0]["translator_model_key"], "m2m100_1_2b_ct2"
        )
        self.assertEqual(self._tm_hits(), 1)

    def test_writes_are_always_on_outside_sfx_even_when_reads_off(self) -> None:
        engine = _FakeEngine("fake")
        settings = clamp_llm_request_settings({"translation_memory_enabled": False})

        _run(_request(settings=settings), engine, self.store)

        entry = self.store.lookup_tm([(tm_key("konnichiwa"), "ja", "en")]).get(
            (tm_key("konnichiwa"), "ja", "en")
        )
        self.assertIsNotNone(entry)
        self.assertEqual(entry.translation, "ok-konnichiwa")
        self.assertEqual(entry.model_key, "fake")

    def test_sfx_mode_skips_tm_writes(self) -> None:
        engine = _FakeEngine("fake")
        settings = clamp_llm_request_settings({})

        _run(_request(settings=settings, mode="sfx"), engine, self.store)

        self.assertEqual(
            self.store.lookup_tm([(tm_key("konnichiwa"), "ja", "en")]), {}
        )

    def test_identical_to_source_results_are_never_written(self) -> None:
        engine = _FakeEngine("fake", translated_text="konnichiwa")
        settings = clamp_llm_request_settings({})

        _run(_request(settings=settings, text="konnichiwa"), engine, self.store)

        self.assertEqual(
            self.store.lookup_tm([(tm_key("konnichiwa"), "ja", "en")]), {}
        )

    def test_echo_repaired_results_are_never_written(self) -> None:
        engine = _FakeEngine("fake", translated_text="SIM SIM")
        settings = clamp_llm_request_settings({})

        _run(_request(settings=settings, text="はい"), engine, self.store)

        self.assertEqual(self.store.lookup_tm([(tm_key("はい"), "ja", "en")]), {})

    def test_echo_flagged_results_are_never_written(self) -> None:
        engine = _FakeEngine(
            "fake", translated_text="ALPHA BETA ALPHA BETA ALPHA BETA"
        )
        settings = clamp_llm_request_settings({})

        _run(_request(settings=settings, text="テスト"), engine, self.store)

        self.assertEqual(self.store.lookup_tm([(tm_key("テスト"), "ja", "en")]), {})

    def test_local_tm_hit_missing_protected_term_is_discarded(self) -> None:
        settings = clamp_llm_request_settings(
            {
                "glossary": [
                    {"source": "Kaito", "target": "Kaito", "never_translate": True}
                ],
                "translation_memory_enabled": True,
            }
        )
        self.store.put_tm(
            [
                TMWrite(
                    tm_key("Kaito greets"), "ja", "en", "someone greets", "nllb-200-600m-int8"
                )
            ]
        )
        engine = _FakeEngine("fake")

        result = _run(_request(settings=settings, text="Kaito greets"), engine, self.store)

        self.assertEqual(engine.calls, 1)
        self.assertEqual(result.records[0]["translated_text"], "ok-Kaito greets")
        self.assertIn("Kaito", result.records[0]["translated_text"])

    def test_cloud_tm_hit_passes_the_parity_guard_unchecked(self) -> None:
        settings = clamp_llm_request_settings(
            {
                "glossary": [
                    {"source": "Kaito", "target": "Kaito", "never_translate": True}
                ],
                "translation_memory_enabled": True,
            }
        )
        self.store.put_tm(
            [
                TMWrite(
                    tm_key("Kaito greets"), "ja", "en", "someone greets", "google_translate"
                )
            ]
        )
        engine = _FakeEngine("fake")

        result = _run(_request(settings=settings, text="Kaito greets"), engine, self.store)

        self.assertEqual(engine.calls, 0)
        self.assertEqual(result.records[0]["translated_text"], "someone greets")
        self.assertEqual(result.records[0]["translator_model_key"], "google_translate")


if __name__ == "__main__":
    unittest.main()
