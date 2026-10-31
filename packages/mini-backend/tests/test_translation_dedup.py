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
        self.regions: list[TranslationInputRegion] = []

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
        self.regions.extend(regions)
        return [
            TranslationTextResult(
                id=region.id,
                source_text=region.text.strip(),
                translated_text=f"en:{region.text.strip()}",
                translation_notes=["NT: dedup note"],
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


def _region(
    region_id: str, text: str, detector: str = "det", ocr: str = "ocr"
) -> TranslationRegionRequest:
    return TranslationRegionRequest(
        id=region_id,
        text=text,
        source="model",
        detector_model_key=detector,
        ocr_model_key=ocr,
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


class DedupIdenticalSeedsTests(unittest.TestCase):
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

    def test_three_identical_seeds_translate_once_with_own_metadata(self) -> None:
        request = _request(
            [
                _region("r1", "konnichiwa", detector="det-1", ocr="ocr-1"),
                _region("r2", "konnichiwa", detector="det-2", ocr="ocr-2"),
                _region("r3", " konnichiwa ", detector="det-3", ocr="ocr-3"),
            ]
        )

        result = self._run(request)

        self.assertEqual(self.engine.calls, 1)
        self.assertEqual(len(self.engine.regions), 1)
        self.assertEqual(self.engine.regions[0].id, "r1")
        self.assertEqual(len(result.records), 3)
        for index, record in enumerate(result.records, start=1):
            self.assertEqual(record["id"], f"r{index}")
            self.assertEqual(record["translated_text"], "en:konnichiwa")
            self.assertEqual(record["source_text"], "konnichiwa".strip())
            self.assertEqual(record["detector_model_key"], f"det-{index}")
            self.assertEqual(record["ocr_model_key"], f"ocr-{index}")
            self.assertEqual(record["translator_model_key"], "fake")
            self.assertEqual(record["translation_notes"], ["NT: dedup note"])
        # Persistent write: one row for the unique text, engine key attached.
        rows = self.store.get_cached([_persistent_key("konnichiwa")])
        self.assertEqual(rows[_persistent_key("konnichiwa")].translated_text, "en:konnichiwa")
        self.assertEqual(rows[_persistent_key("konnichiwa")].engine_key, "fake")

    def test_mixed_batch_sends_two_regions_and_keeps_distinct_text(self) -> None:
        request = _request(
            [
                _region("r1", "konnichiwa", detector="det-1"),
                _region("r2", " konnichiwa ", detector="det-2"),
                _region("r3", "sayonara", detector="det-3"),
            ]
        )

        result = self._run(request)

        self.assertEqual(self.engine.calls, 1)
        self.assertEqual(len(self.engine.regions), 2)
        self.assertEqual(
            [region.id for region in self.engine.regions], ["r1", "r3"]
        )
        self.assertEqual(result.records[0]["translated_text"], "en:konnichiwa")
        self.assertEqual(result.records[1]["translated_text"], "en:konnichiwa")
        self.assertEqual(result.records[2]["translated_text"], "en:sayonara")
        self.assertEqual(result.records[1]["detector_model_key"], "det-2")
        self.assertEqual(result.records[1]["source_text"], "konnichiwa")

    def test_second_identical_request_needs_no_engine_call(self) -> None:
        request = _request(
            [
                _region("r1", "konnichiwa"),
                _region("r2", "konnichiwa"),
            ]
        )

        self._run(request)
        second = self._run(request)

        self.assertEqual(self.engine.calls, 1)
        self.assertEqual(
            [record["translated_text"] for record in second.records],
            ["en:konnichiwa", "en:konnichiwa"],
        )


if __name__ == "__main__":
    unittest.main()
