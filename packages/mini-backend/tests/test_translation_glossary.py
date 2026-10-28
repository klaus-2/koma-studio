"""Glossary term base: settings clamp, prompt block, stage wiring and cache key."""

from __future__ import annotations

import asyncio
import dataclasses
from pathlib import Path
import sys
import unittest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.config import (  # noqa: E402
    GlossaryTerm,
    LLMRequestSettings,
    clamp_llm_request_settings,
)
from models.translation.base_translator import (  # noqa: E402
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.prompts import (  # noqa: E402
    compose_translation_extra_context,
    format_glossary_block,
)
from pipelines.cache_manager import CacheManager  # noqa: E402
from pipelines.translation_stage import (  # noqa: E402
    CachedTranslationRequest,
    run_cached_translation,
    seed_from_request,
)
from schemas.translation import TranslationRegionRequest  # noqa: E402


def _terms(*pairs: tuple[str, str]) -> list[dict[str, str]]:
    return [{"source": source, "target": target} for source, target in pairs]


class GlossaryClampTests(unittest.TestCase):
    def test_missing_settings_yield_no_terms(self) -> None:
        self.assertEqual(clamp_llm_request_settings(None).glossary, ())

    def test_non_list_glossary_yields_no_terms(self) -> None:
        self.assertEqual(clamp_llm_request_settings({"glossary": "先輩=senpai"}).glossary, ())
        self.assertEqual(
            clamp_llm_request_settings({"glossary": {"source": "先輩", "target": "senpai"}}).glossary,
            (),
        )

    def test_trims_and_drops_incomplete_or_non_dict_entries(self) -> None:
        settings = clamp_llm_request_settings(
            {
                "glossary": [
                    {"source": "  先輩  ", "target": "  senpai  "},
                    {"source": "", "target": "orphan"},
                    {"source": "orphan", "target": ""},
                    {"source": "   ", "target": "y"},
                    "not-a-dict",
                    {"source": None, "target": "y"},
                ]
            }
        )
        self.assertEqual(settings.glossary, (GlossaryTerm("先輩", "senpai"),))

    def test_deduplicates_by_exact_source_keeping_the_first_pair(self) -> None:
        settings = clamp_llm_request_settings(
            {
                "glossary": _terms(
                    ("先輩", "senpai"),
                    ("先輩", "senior"),
                    ("先輩", "elder"),
                )
            }
        )
        self.assertEqual(settings.glossary, (GlossaryTerm("先輩", "senpai"),))

    def test_source_matching_is_case_sensitive(self) -> None:
        settings = clamp_llm_request_settings(
            {"glossary": _terms(("GLOSSARY", "a"), ("glossary", "b"))}
        )
        self.assertEqual(
            settings.glossary,
            (GlossaryTerm("GLOSSARY", "a"), GlossaryTerm("glossary", "b")),
        )

    def test_caps_the_list_at_200_terms(self) -> None:
        entries = _terms(*[(f"source-{index}", f"target-{index}") for index in range(250)])
        settings = clamp_llm_request_settings({"glossary": entries})
        self.assertEqual(len(settings.glossary), 200)
        self.assertEqual(settings.glossary[-1], GlossaryTerm("source-199", "target-199"))

    def test_truncates_source_at_120_and_target_at_240_characters(self) -> None:
        settings = clamp_llm_request_settings(
            {"glossary": _terms(("s" * 500, "t" * 500))}
        )
        term = settings.glossary[0]
        self.assertEqual(len(term.source), 120)
        self.assertEqual(len(term.target), 240)


class GlossaryPromptTests(unittest.TestCase):
    def test_empty_glossary_emits_no_block(self) -> None:
        self.assertEqual(format_glossary_block(()), "")

    def test_block_lists_one_line_per_term_in_input_order(self) -> None:
        block = format_glossary_block(
            (GlossaryTerm("先輩", "senpai"), GlossaryTerm("部長", "manager"))
        )
        self.assertIn("Glossary", block)
        self.assertLess(block.index("- 先輩 => senpai"), block.index("- 部長 => manager"))

    def test_context_order_is_user_then_glossary_then_image_then_neighbor(self) -> None:
        composed = compose_translation_extra_context(
            "keep tone",
            "page ctx",
            "neighbor ctx",
            glossary=(GlossaryTerm("先輩", "senpai"),),
        )
        self.assertTrue(composed.startswith("keep tone"))
        self.assertLess(composed.index("keep tone"), composed.index("- 先輩 => senpai"))
        self.assertLess(composed.index("- 先輩 => senpai"), composed.index("page ctx"))
        self.assertLess(composed.index("page ctx"), composed.index("neighbor ctx"))

    def test_empty_blocks_are_dropped(self) -> None:
        composed = compose_translation_extra_context(
            "",
            "",
            "",
            glossary=(GlossaryTerm("先輩", "senpai"),),
        )
        self.assertEqual(
            composed,
            "Glossary — when a source term below appears, translate it exactly as given:"
            "\n- 先輩 => senpai",
        )


class _RecordingEngine:
    def __init__(self, key: str) -> None:
        self.key = key
        self.contexts: list[str] = []

    async def translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = source_language, target_language
        _ = translation_notes_enabled, translation_mode
        self.contexts.append(extra_context)
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
    def __init__(self, engines: dict[str, _RecordingEngine]) -> None:
        self._engines = engines

    def __call__(self, model_key: str | None = None) -> _RecordingEngine:
        key = (model_key or "").strip() or "google_translate"
        return self._engines[key]


def _request(*, settings: LLMRequestSettings | None = None) -> CachedTranslationRequest:
    region = TranslationRegionRequest(
        id="r1",
        text="konnichiwa",
        source="model",
        detector_model_key="det",
        ocr_model_key="ocr",
    )
    return CachedTranslationRequest(
        model_key="fake",
        source_language="ja",
        target_language="en",
        seeds=(seed_from_request(region),),
        translation_mode="default",
        settings=settings if settings is not None else clamp_llm_request_settings({}),
        custom_llm=None,
    )


class GlossaryStageAndCacheTests(unittest.TestCase):
    def test_stage_passes_the_glossary_block_to_the_engine(self) -> None:
        engine = _RecordingEngine("fake")
        asyncio.run(
            run_cached_translation(
                _request(
                    settings=clamp_llm_request_settings(
                        {"glossary": _terms(("先輩", "senpai"))}
                    )
                ),
                cache=CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2),
                resolve_engine=_Resolver({"fake": engine}),
            )
        )
        self.assertEqual(len(engine.contexts), 1)
        self.assertIn("- 先輩 => senpai", engine.contexts[0])

    def test_glossary_changes_the_translation_cache_key(self) -> None:
        cache = CacheManager(ttl_seconds=60, max_entries=8, bbox_tolerance_px=2)
        base_settings = dataclasses.asdict(clamp_llm_request_settings({}))
        glossary_settings = dataclasses.asdict(
            clamp_llm_request_settings({"glossary": _terms(("先輩", "senpai"))})
        )

        def key(llm_settings: dict[str, object]) -> str:
            return cache.build_translation_cache_key(
                model_key="fake",
                source_language="ja",
                target_language="en",
                extra_context="",
                llm_settings=llm_settings,
                custom_llm=None,
                translation_mode="default",
            )

        self.assertNotEqual(key(base_settings), key(glossary_settings))


if __name__ == "__main__":
    unittest.main()
