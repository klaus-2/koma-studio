from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import clamp_llm_request_settings  # noqa: E402
from models.translation import fallback as translation_fallback  # noqa: E402
from models.translation.base_translator import (  # noqa: E402
    TranslationInputRegion,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.errors import TranslatorUnavailableError  # noqa: E402
from models.translation.factory import TranslationModelOption  # noqa: E402
from models.translation.local_base import LocalTranslatorBase  # noqa: E402
from pipelines.cache_manager import CacheManager  # noqa: E402
from pipelines.translation_masking import (  # noqa: E402
    plan_masked_segment,
    reassemble_masked,
)
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


def _plan(text: str, terms: list[str]):
    return plan_masked_segment(text, terms)


class MaskPlanTests(unittest.TestCase):
    def test_longest_term_wins_overlapping_matches(self) -> None:
        segment = _plan("Nao Bisco run", ["Nao", "Nao Bisco"])
        kinds = [step.kind for step in segment.steps]
        self.assertEqual(kinds, ["term", "run"])
        self.assertEqual(segment.steps[0].text, "Nao Bisco")
        self.assertEqual(segment.run_texts, ("run",))

    def test_whitespace_parity_is_preserved_end_to_end(self) -> None:
        segment = _plan("  Hello WORLD  ", ["world"])
        self.assertEqual(segment.steps[0].kind, "run")
        self.assertEqual(segment.steps[0].text, "Hello")
        self.assertEqual(segment.steps[0].pre, "  ")
        self.assertEqual(segment.steps[0].post, " ")
        self.assertEqual(segment.steps[1].text, "WORLD")
        self.assertEqual(segment.steps[2].kind, "literal")
        reassembled = reassemble_masked(segment.steps, ["TRADUCIDO"])
        self.assertEqual(reassembled, "  TRADUCIDO WORLD  ")

    def test_free_runs_without_alnum_become_literals(self) -> None:
        segment = _plan("Word, ... Term end", ["Word", "Term"])
        kinds = [step.kind for step in segment.steps]
        self.assertEqual(kinds, ["term", "literal", "term", "run"])
        self.assertEqual(segment.steps[1].text, ", ... ")
        self.assertEqual(segment.run_texts, ("end",))

    def test_runs_are_deduplicated_by_first_index(self) -> None:
        segment = _plan("dog A dog B dog", ["A", "B"])
        self.assertEqual(segment.run_texts, ("dog",))
        reassembled = reassemble_masked(segment.steps, ["CANINE"])
        self.assertEqual(reassembled, "CANINE A CANINE B CANINE")

    def test_term_keeps_the_original_occurrence_casing(self) -> None:
        segment = _plan("kaito said", ["Kaito"])
        self.assertEqual(segment.steps[0].kind, "term")
        self.assertEqual(segment.steps[0].text, "kaito")
        # The protected occurrence stays verbatim; the rest is a translated run.
        self.assertEqual(reassemble_masked(segment.steps, ["X"]), "kaito X")

    def test_no_terms_plans_a_single_run(self) -> None:
        segment = _plan("plain text", [])
        self.assertEqual(segment.run_texts, ("plain text",))
        self.assertEqual(
            reassemble_masked(segment.steps, ["out"]), "out"
        )


class _FakeLocalEngine(LocalTranslatorBase):
    key = "fake_local"

    def __init__(self) -> None:
        super().__init__(key="fake_local", model_dir=Path(tempfile.mkdtemp()))
        self.received_texts: list[str] = []

    def _ensure_runtime(self) -> None:
        return None

    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]:
        self.received_texts.extend(region.text for region in request.regions)
        return [self._result(region, f"tr[{region.text}]") for region in request.regions]


class _FakeCloudEngine:
    key = "fake_cloud"

    def __init__(self, *, error: Exception | None = None) -> None:
        self.error = error
        self.received_texts: list[str] = []

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
        if self.error is not None:
            raise self.error
        self.received_texts.extend(region.text for region in regions)
        return [
            TranslationTextResult(
                id=region.id,
                source_text=region.text.strip(),
                translated_text=f"cloud[{region.text}]",
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


def _settings() -> object:
    return clamp_llm_request_settings(
        {
            "glossary": [
                {"source": "Kaito", "target": "Kaito", "never_translate": True},
                {"source": "Nao", "target": "Nao", "never_translate": True},
                {"source": "Bisco", "target": "Bisco", "never_translate": True},
            ]
        }
    )


def _request(
    *,
    settings: object = None,
    mode: str = "default",
    text: str = "Kaito, Nao e Bisco juntos",
    model_key: str = "fake_local",
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
        target_language="pt-br",
        seeds=(seed_from_request(region),),
        translation_mode=mode,
        settings=(
            settings
            if settings is not None
            else clamp_llm_request_settings({})
        ),
        custom_llm=None,
    )


def _run(request: CachedTranslationRequest, engine: object, store: TranslationStore):
    import asyncio

    return asyncio.run(
        run_cached_translation(
            request,
            cache=CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2),
            resolve_engine=lambda model_key=None: engine,
            store=store,
        )
    )


class MaskingStageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = TranslationStore(Path(self.tmp.name) / "store.sqlite3")
        self.addCleanup(self.store.close)

    def test_local_engine_receives_only_runs_and_terms_survive(self) -> None:
        engine = _FakeLocalEngine()
        result = _run(_request(settings=_settings()), engine, self.store)

        self.assertEqual(engine.received_texts, ["e", "juntos"])
        record = result.records[0]
        self.assertEqual(record["translated_text"], "Kaito, Nao tr[e] Bisco tr[juntos]")
        for term in ("Kaito", "Nao", "Bisco"):
            self.assertIn(term, record["translated_text"])

    def test_no_masking_without_never_translate_terms(self) -> None:
        engine = _FakeLocalEngine()
        result = _run(_request(), engine, self.store)

        self.assertEqual(engine.received_texts, ["Kaito, Nao e Bisco juntos"])
        self.assertEqual(
            result.records[0]["translated_text"],
            "tr[Kaito, Nao e Bisco juntos]",
        )

    def test_sfx_mode_still_masks(self) -> None:
        engine = _FakeLocalEngine()
        result = _run(
            _request(settings=_settings(), mode="sfx"), engine, self.store
        )

        self.assertEqual(engine.received_texts, ["e", "juntos"])
        self.assertIn("Kaito", result.records[0]["translated_text"])
        self.assertIn("Nao", result.records[0]["translated_text"])
        self.assertIn("Bisco", result.records[0]["translated_text"])

    def test_cloud_engine_is_never_masked(self) -> None:
        engine = _FakeCloudEngine()
        result = _run(_request(settings=_settings()), engine, self.store)

        self.assertEqual(engine.received_texts, ["Kaito, Nao e Bisco juntos"])
        self.assertEqual(
            result.records[0]["translated_text"],
            "cloud[Kaito, Nao e Bisco juntos]",
        )

    def test_fallback_chain_masks_whichever_local_engine_answers(self) -> None:
        cloud = _FakeCloudEngine(error=TranslatorUnavailableError("cloud_a", "down"))
        local = _FakeLocalEngine()
        engines = {"cloud_a": cloud, "fake_local": local}
        request = _request(
            settings=clamp_llm_request_settings(
                {
                    "glossary": [
                        {
                            "source": "Kaito",
                            "target": "Kaito",
                            "never_translate": True,
                        }
                    ],
                    "translation_fallback_chain": ["cloud_a", "fake_local"],
                }
            )
        )

        with patch.object(
            translation_fallback,
            "list_translation_models",
            return_value=[_option("cloud_a"), _option("fake_local")],
        ):
            import asyncio

            result = asyncio.run(
                run_cached_translation(
                    request,
                    cache=CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2),
                    resolve_engine=lambda model_key=None: engines[
                        (model_key or "").strip()
                    ],
                    store=self.store,
                )
            )

        self.assertEqual(cloud.received_texts, [])
        # The chunk after the term keeps its leading comma (stripped core).
        self.assertEqual(local.received_texts, [", Nao e Bisco juntos"])
        self.assertIn("Kaito", result.records[0]["translated_text"])
        self.assertEqual(result.records[0]["translator_model_key"], "fake_local")

    def test_local_hit_missing_term_is_discarded_and_rerun_masked(self) -> None:
        request = _request(settings=_settings())
        gloss = glossary_hash(
            [
                (term.source, term.target, term.never_translate)
                for term in request.settings.glossary
            ]
        )
        key = persistent_cache_key(
            "fake_local",
            "ja",
            "pt-br",
            "default",
            normalize_source_text("Kaito, Nao e Bisco juntos"),
            gloss,
        )
        self.store.put_cached(
            [
                CacheRow(
                    key=key,
                    translated_text="traducao sem os termos protegidos",
                    notes=(),
                    engine_key="sugoi_v4_ja_en_ct2",
                )
            ]
        )
        engine = _FakeLocalEngine()

        result = _run(request, engine, self.store)

        self.assertEqual(engine.received_texts, ["e", "juntos"])
        record = result.records[0]
        self.assertIn("Kaito", record["translated_text"])
        self.assertIn("Nao", record["translated_text"])
        self.assertIn("Bisco", record["translated_text"])
        rows = self.store.get_cached([key])
        self.assertEqual(rows[key].engine_key, "fake_local")
        self.assertIn("Kaito", rows[key].translated_text)


if __name__ == "__main__":
    unittest.main()
