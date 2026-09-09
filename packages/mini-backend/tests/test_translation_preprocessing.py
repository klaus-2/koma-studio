from __future__ import annotations

from pathlib import Path
import sys
import unittest
from unittest.mock import patch


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation.base_translator import TranslationInputRegion
from models.translation import providers


class TranslationPreprocessingTests(unittest.IsolatedAsyncioTestCase):
    def test_system_prompt_uses_language_labels_and_notes_contract(self) -> None:
        prompt = providers._llm_system_prompt("ko", "pt-br", True)

        self.assertIn("publishes in Brazilian Portuguese", prompt)
        self.assertIn('"notes":["NT: <note 1>"', prompt)
        self.assertIn("Translator notes are enabled", prompt)
        self.assertIn("If the target language is Brazilian Portuguese, include an approximate BRL conversion", prompt)
        self.assertIn("Do not repeat the same translator note", prompt)
        self.assertIn("never for editor-facing commentary", prompt)
        self.assertIn("written entirely in Brazilian Portuguese", prompt)

    def test_user_prompt_applies_notes_rules_to_custom_instructions(self) -> None:
        prompt = providers._llm_user_prompt(
            [TranslationInputRegion(id="r1", text="안녕")],
            "Always keep character names unchanged.",
            True,
        )

        self.assertIn("User custom instructions / context:", prompt)
        self.assertIn("Always keep character names unchanged.", prompt)
        self.assertIn("keep them only in the `notes` array", prompt)

    def test_parse_llm_translation_map_extracts_inline_notes(self) -> None:
        mapping = providers._parse_llm_translation_map(
            '{"translations":[{"id":"r1","text":"Olá mundo. (NT: Contexto cultural)","notes":["NT: Honorífico coreano"]}]}',
            [TranslationInputRegion(id="r1", text="안녕")],
        )

        self.assertEqual(mapping["r1"]["text"], "Olá mundo.")
        self.assertEqual(
            mapping["r1"]["notes"],
            ["NT: Honorífico coreano", "NT: Contexto cultural"],
        )

    def test_parse_llm_translation_map_accepts_single_region_translation_field(self) -> None:
        mapping = providers._parse_llm_translation_map(
            '{"translation":"Olá","notes":["NT: Saudação simples"]}',
            [TranslationInputRegion(id="r1", text="안녕")],
        )

        self.assertEqual(mapping["r1"]["text"], "Olá")
        self.assertEqual(mapping["r1"]["notes"], ["NT: Saudação simples"])

    def test_build_current_image_translation_context_requires_multiple_regions(self) -> None:
        context = providers.build_current_image_translation_context(
            [
                TranslationInputRegion(id="r1", text="Olá"),
                TranslationInputRegion(id="r2", text="Tudo bem?"),
            ]
        )

        self.assertIn("Current page balloon context:", context)
        self.assertIn("id=r1", context)
        self.assertIn("id=r2", context)

    def test_dedupe_translation_notes_across_regions_preserves_first_occurrence(self) -> None:
        deduped = providers.dedupe_translation_notes_across_regions(
            {
                "r1": {"text": "A", "notes": ["NT: termo cultural"]},
                "r2": {"text": "B", "notes": ["NT: termo cultural", "NT: outra nota"]},
            }
        )

        self.assertEqual(deduped["r1"]["notes"], ["NT: termo cultural"])
        self.assertEqual(deduped["r2"]["notes"], ["NT: outra nota"])

    def test_preprocess_translation_text_matches_example_behavior(self) -> None:
        self.assertEqual(
            providers._preprocess_translation_text(" こ ん\r\nに ち は ", "ja"),
            "こんにちは",
        )
        self.assertEqual(
            providers._preprocess_translation_text(" 안 녕\r\n하 세 요 ", "ko"),
            "안 녕하 세 요",
        )

    async def test_openai_translator_preprocesses_regions_before_batch_translation(self) -> None:
        engine = providers.OpenAIGPTTranslatorEngine(model_name="gpt-4.1-mini", key="gpt_4_1_mini")
        captured_regions: list[list[TranslationInputRegion]] = []

        def fake_translate_batch(
            *,
            regions: list[TranslationInputRegion],
            source_language: str,
            target_language: str,
            extra_context: str,
            translation_notes_enabled: bool,
        ) -> dict[str, dict[str, object]]:
            _ = source_language, target_language, extra_context, translation_notes_enabled
            captured_regions.append(regions)
            return {"r1": {"text": "hello", "notes": []}}

        with patch.object(engine, "_translate_batch", side_effect=fake_translate_batch):
            results = await engine.translate(
                regions=[TranslationInputRegion(id="r1", text=" こ ん\r\nに ち は ", source="model")],
                source_language="ja",
                target_language="en",
                extra_context="",
            )

        self.assertEqual(captured_regions[0][0].text, "こんにちは")
        self.assertEqual(results[0].source_text, "こ ん\r\nに ち は")
        self.assertEqual(results[0].translated_text, "hello")


if __name__ == "__main__":
    unittest.main()
