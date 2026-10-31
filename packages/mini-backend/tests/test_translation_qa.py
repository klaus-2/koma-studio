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
from pipelines.translation_qa import (  # noqa: E402
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
    def test_r1_collapses_exact_doubled_halves(self) -> None:
        outcome = _qa("ブラック猫", "BLACK CAT BLACK CAT")
        self.assertTrue(outcome.repaired)
        self.assertEqual(outcome.text, "BLACK CAT")
        self.assertEqual(
            outcome.notes, ("NT: Eco do modelo reparado (colapso de duplicatas)",)
        )
        self.assertNotIn("repeated_word", outcome.flags)

    def test_r2_collapses_adjacent_duplicates(self) -> None:
        outcome = _qa("システム", "O SISTEMA SISTEMA")
        self.assertTrue(outcome.repaired)
        self.assertEqual(outcome.text, "O SISTEMA")

    def test_repair_rejected_when_candidate_still_echoes(self) -> None:
        outcome = _qa("テスト", "ALPHA BETA ALPHA BETA ALPHA BETA")
        self.assertFalse(outcome.repaired)
        self.assertEqual(outcome.text, "ALPHA BETA ALPHA BETA ALPHA BETA")
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

    def test_degenerate_single_word_repetition_is_repaired(self) -> None:
        outcome = _qa("No.", "Não. Não.")
        self.assertTrue(outcome.repaired)
        self.assertEqual(outcome.text, "Não.")
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


if __name__ == "__main__":
    unittest.main()
