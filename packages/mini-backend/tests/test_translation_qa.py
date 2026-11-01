from __future__ import annotations

from pathlib import Path
import sys
import tempfile
import unittest


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import GlossaryTerm, clamp_llm_request_settings  # noqa: E402
from models.translation.base_translator import (  # noqa: E402
    TranslationInputRegion,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.local_base import LocalTranslatorBase  # noqa: E402
from pipelines.cache_manager import CacheManager  # noqa: E402
from pipelines.translation_qa import (  # noqa: E402
    glossary_missing,
    run_translation_qa,
)
from pipelines.translation_stage import (  # noqa: E402
    CachedTranslationRequest,
    run_cached_translation,
    seed_from_request,
)
from pipelines.translation_store import TranslationStore  # noqa: E402
from schemas.translation import TranslationRegionRequest  # noqa: E402


def _qa(
    source: str,
    target: str,
    *,
    target_language: str = "pt-br",
    translation_mode: str = "default",
):
    return run_translation_qa(
        source,
        target,
        target_language=target_language,
        translation_mode=translation_mode,
    )


class EchoCollapseTests(unittest.TestCase):
    def test_whole_phrase_doubling_at_count_two_is_flagged(self) -> None:
        """R1's exact X+X structure with every word at count 2 is exactly the
        emphatic-reduplication shape — flagged for review, never rewritten."""
        outcome = _qa("ブラック猫", "BLACK CAT BLACK CAT")
        self.assertFalse(outcome.repaired)
        self.assertEqual(outcome.text, "BLACK CAT BLACK CAT")
        self.assertIn("repeated_word", outcome.flags)

    def test_r2_collapses_adjacent_duplicates(self) -> None:
        outcome = _qa("システム", "O SISTEMA SISTEMA SISTEMA")
        self.assertTrue(outcome.repaired)
        self.assertEqual(outcome.text, "O SISTEMA")

    def test_repair_rejected_when_candidate_still_echoes(self) -> None:
        outcome = _qa("テスト", "ALPHA ALPHA BETA ALPHA ALPHA BETA")
        self.assertFalse(outcome.repaired)
        self.assertEqual(outcome.text, "ALPHA ALPHA BETA ALPHA ALPHA BETA")
        self.assertIn("repeated_word", outcome.flags)
        self.assertIn("NT: ", outcome.notes[0])

    def test_source_repetition_is_not_echo(self) -> None:
        outcome = _qa("no no no", "não não não")
        self.assertFalse(outcome.repaired)
        self.assertNotIn("repeated_word", outcome.flags)
        self.assertEqual(outcome.text, "não não não")

    def test_function_word_repetition_is_exempt(self) -> None:
        outcome = _qa("No, I'm not very hungry.", "Não, não estou com muita fome.")
        self.assertNotIn("repeated_word", outcome.flags)

    def test_degenerate_single_word_repetition_is_flagged(self) -> None:
        outcome = _qa("No.", "Não. Não.")
        self.assertFalse(outcome.repaired)
        self.assertEqual(outcome.text, "Não. Não.")
        self.assertIn("repeated_word", outcome.flags)

    def test_double_repetition_is_flagged_not_repaired(self) -> None:
        """PT-BR emphatic reduplication ("Devagar devagar", "Nunca, nunca")
        is honest: flagged for review, never rewritten."""
        for target in ("Devagar devagar", "Nunca, nunca"):
            outcome = _qa("Vá com calma", target)
            self.assertFalse(outcome.repaired, target)
            self.assertEqual(outcome.text, target, target)
            self.assertIn("repeated_word", outcome.flags, target)

    def test_triple_repetition_is_repaired(self) -> None:
        outcome = _qa("はい", "SIM SIM SIM")
        self.assertTrue(outcome.repaired)
        self.assertEqual(outcome.text, "SIM")
        self.assertNotIn("repeated_word", outcome.flags)


class DetectorTests(unittest.TestCase):
    def test_empty_target_is_flagged(self) -> None:
        outcome = _qa("こんにちは", "   ")
        self.assertIn("empty", outcome.flags)
        self.assertTrue(all(note.startswith("NT: ") for note in outcome.notes))

    def test_fullwidth_identity_is_flagged_as_identical(self) -> None:
        outcome = _qa("Ｔｈａｔ'ｓ　ｒｉｇｈｔ", "That's right")
        self.assertIn("identical", outcome.flags)
        self.assertEqual(outcome.text, "That's right")

    def test_plain_translation_is_not_identical(self) -> None:
        outcome = _qa("こんにちは、世界です。", "Olá, mundo.")
        self.assertNotIn("identical", outcome.flags)

    def test_foreign_residue_ko_to_en_is_flagged(self) -> None:
        outcome = _qa("안녕하세요 반갑습니다", "안녕하세요 hello", target_language="en")
        self.assertIn("foreign_residue", outcome.flags)
        self.assertIn("안녕하세요", outcome.notes[0])

    def test_foreign_residue_skipped_for_cjk_target(self) -> None:
        outcome = _qa("hello there", "こんにちは hello", target_language="ja")
        self.assertNotIn("foreign_residue", outcome.flags)

    def test_latin_to_latin_ratio_bounds(self) -> None:
        self.assertNotIn("length_ratio", _qa("hello world", "hi there").flags)
        flagged = _qa("hello world", "hi")
        self.assertIn("length_ratio", flagged.flags)
        self.assertIn("0.18x", flagged.notes[-1])
        inflated = _qa("hello world", "hi there my dear friend how are you doing today fine")
        self.assertIn("length_ratio", inflated.flags)

    def test_cjk_to_latin_ratio_bounds(self) -> None:
        self.assertNotIn("length_ratio", _qa("こんにちは、世界です", "Hello").flags)
        self.assertIn("length_ratio", _qa("こんにちは、世界です", "Hi").flags)

    def test_short_source_is_not_judged(self) -> None:
        self.assertNotIn("length_ratio", _qa("hi man", "x").flags)

    def test_sfx_mode_skips_heuristic_detectors(self) -> None:
        outcome = _qa(
            "Ｔｅｓｔｉｎｇ",
            "Ｔｅｓｔｉｎｇ",
            translation_mode="sfx",
        )
        self.assertNotIn("identical", outcome.flags)
        self.assertNotIn("repeated_word", outcome.flags)
        self.assertNotIn("length_ratio", outcome.flags)
        residue = _qa(
            "testing one two",
            "テスト sound",
            translation_mode="sfx",
        )
        self.assertIn("foreign_residue", residue.flags)
        echoed = _qa(
            "テスト",
            "SISTEMA SISTEMA",
            translation_mode="sfx",
        )
        self.assertFalse(echoed.repaired)
        self.assertNotIn("repeated_word", echoed.flags)


class _EchoEngine:
    def __init__(self, key: str) -> None:
        self.key = key
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
                translated_text="안녕하세요 hello",
                translation_notes=["NT: nota do motor"],
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=self.key,
            )
            for region in regions
        ]


class _EchoResolver:
    def __init__(self, engine: _EchoEngine) -> None:
        self._engine = engine

    def __call__(self, model_key: str | None = None) -> _EchoEngine:
        _ = model_key
        return self._engine


class StageQaIntegrationTests(unittest.TestCase):
    def test_flagged_note_reaches_the_record_with_text_unchanged(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        store = TranslationStore(Path(tmp.name) / "store.sqlite3")
        self.addCleanup(store.close)
        region = TranslationRegionRequest(
            id="r1",
            text="안녕하세요 반갑습니다",
            source="model",
            detector_model_key="det",
            ocr_model_key="ocr",
        )
        request = CachedTranslationRequest(
            model_key="fake",
            source_language="ko",
            target_language="en",
            seeds=(seed_from_request(region),),
            translation_mode="default",
            settings=clamp_llm_request_settings({}),
            custom_llm=None,
        )
        engine = _EchoEngine("fake")

        import asyncio

        result = asyncio.run(
            run_cached_translation(
                request,
                cache=CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2),
                resolve_engine=_EchoResolver(engine),
                store=store,
            )
        )

        self.assertEqual(engine.calls, 1)
        record = result.records[0]
        self.assertEqual(record["translated_text"], "안녕하세요 hello")
        self.assertIn("NT: nota do motor", record["translation_notes"])
        self.assertTrue(
            any("Resíduo" in note for note in record["translation_notes"]),
            record["translation_notes"],
        )


class GlossaryMissingTests(unittest.TestCase):
    def test_term_in_source_absent_from_target_is_reported(self) -> None:
        notes = glossary_missing(
            "Kaito fala com o time",
            "O time conversa",
            [GlossaryTerm("Kaito", "Kaito")],
        )
        self.assertEqual(
            notes,
            ["NT: Glossário: termo 'Kaito' ausente (esperado 'Kaito')"],
        )

    def test_term_present_in_target_passes(self) -> None:
        self.assertEqual(
            glossary_missing(
                "Kaito fala com o time",
                "Kaito conversa com o time",
                [GlossaryTerm("Kaito", "Kaito")],
            ),
            [],
        )

    def test_matching_is_case_insensitive_and_word_bounded(self) -> None:
        self.assertEqual(
            glossary_missing(
                "kaito appears here",
                "KAITO stays",
                [GlossaryTerm("Kaito", "Kaito")],
            ),
            [],
        )
        notes = glossary_missing(
            "kaito appears here",
            "kaito2 stays",
            [GlossaryTerm("Kaito", "Kaito")],
        )
        self.assertEqual(len(notes), 1)

    def test_never_translate_terms_are_excluded(self) -> None:
        self.assertEqual(
            glossary_missing(
                "Kaito fala",
                "ninguem traduziu",
                [GlossaryTerm("Kaito", "Kaito", True)],
            ),
            [],
        )


class _GlossaryLocalEngine(LocalTranslatorBase):
    key = "fake_local"

    def __init__(self) -> None:
        import tempfile as _tempfile

        super().__init__(
            key="fake_local", model_dir=Path(_tempfile.mkdtemp())
        )
        self.calls = 0

    def _ensure_runtime(self) -> None:
        return None

    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]:
        self.calls += 1
        return [
            self._result(region, "O time conversa") for region in request.regions
        ]


class _GlossaryCloudEngine:
    key = "fake_cloud"

    def __init__(self) -> None:
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
                translated_text="O time conversa",
                source=region.source,
                detector_model_key=region.detector_model_key,
                ocr_model_key=region.ocr_model_key,
                translator_model_key=self.key,
            )
            for region in regions
        ]


class GlossaryStageWiringTests(unittest.TestCase):
    def _request(self, settings: object, mode: str = "default"):
        region = TranslationRegionRequest(
            id="r1",
            text="Kaito fala com o time",
            source="model",
            detector_model_key="det",
            ocr_model_key="ocr",
        )
        return CachedTranslationRequest(
            model_key="fake",
            source_language="ja",
            target_language="pt-br",
            seeds=(seed_from_request(region),),
            translation_mode=mode,
            settings=settings,
            custom_llm=None,
        )

    def _run(self, request: CachedTranslationRequest, engine: object):
        import asyncio

        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        store = TranslationStore(Path(tmp.name) / "store.sqlite3")
        self.addCleanup(store.close)
        return asyncio.run(
            run_cached_translation(
                request,
                cache=CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2),
                resolve_engine=lambda model_key=None: engine,
                store=store,
            )
        )

    def test_local_engine_gets_the_missing_term_note(self) -> None:
        settings = clamp_llm_request_settings(
            {"glossary": [{"source": "Kaito", "target": "Kaito"}]}
        )
        engine = _GlossaryLocalEngine()

        result = self._run(self._request(settings), engine)

        self.assertEqual(engine.calls, 1)
        notes = result.records[0]["translation_notes"]
        self.assertTrue(
            any("Glossário: termo 'Kaito' ausente" in note for note in notes),
            notes,
        )

    def test_cloud_engine_is_not_checked(self) -> None:
        settings = clamp_llm_request_settings(
            {"glossary": [{"source": "Kaito", "target": "Kaito"}]}
        )
        engine = _GlossaryCloudEngine()

        result = self._run(self._request(settings), engine)

        notes = result.records[0]["translation_notes"]
        self.assertFalse(any("Glossário" in note for note in notes), notes)

    def test_sfx_mode_skips_the_check(self) -> None:
        settings = clamp_llm_request_settings(
            {"glossary": [{"source": "Kaito", "target": "Kaito"}]}
        )
        engine = _GlossaryLocalEngine()

        result = self._run(self._request(settings, mode="sfx"), engine)

        notes = result.records[0]["translation_notes"]
        self.assertFalse(any("Glossário" in note for note in notes), notes)


if __name__ == "__main__":
    unittest.main()
