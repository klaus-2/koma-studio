from __future__ import annotations

from pathlib import Path
import sys
import time
import unittest


MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from pipelines.cache_manager import CacheManager


class PipelineCacheManagerTests(unittest.TestCase):
    def test_ocr_cache_supports_exact_and_fuzzy_bbox_matching(self) -> None:
        manager = CacheManager(ttl_seconds=1800, max_entries=16, bbox_tolerance_px=5)
        key = manager.build_ocr_cache_key(
            image_bytes=b"image-a",
            language="ja",
            model_key="easyocr",
        )

        cached_count = manager.cache_ocr_results(
            key,
            [
                {
                    "id": "det-1",
                    "bbox": [10, 20, 30, 40],
                    "text": "hello",
                    "score": 0.9,
                    "source": "model",
                    "detector_model_key": "detector-a",
                    "ocr_model_key": "easyocr",
                },
            ],
        )
        self.assertEqual(cached_count, 1)

        exact_hits, exact_missing = manager.get_cached_ocr_for_regions(
            key,
            [
                {
                    "id": "det-exact",
                    "bbox": [10, 20, 30, 40],
                    "source": "model",
                    "detector_model_key": "detector-a",
                },
            ],
        )
        self.assertEqual(exact_missing, [])
        self.assertEqual(exact_hits["det-exact"]["text"], "hello")

        fuzzy_hits, fuzzy_missing = manager.get_cached_ocr_for_regions(
            key,
            [
                {
                    "id": "det-fuzzy",
                    "bbox": [13, 24, 32, 42],
                    "source": "model",
                    "detector_model_key": "detector-a",
                },
            ],
        )
        self.assertEqual(fuzzy_missing, [])
        self.assertEqual(fuzzy_hits["det-fuzzy"]["text"], "hello")

    def test_translation_cache_validates_source_text(self) -> None:
        manager = CacheManager(ttl_seconds=1800, max_entries=16, bbox_tolerance_px=5)
        key = manager.build_translation_cache_key(
            model_key="gpt_4_1_mini",
            source_language="ja",
            target_language="en",
            extra_context="context",
        )
        cached_count = manager.cache_translation_results(
            key,
            [
                {
                    "id": "r1",
                    "source_text": "こんにちは",
                    "translated_text": "hello",
                    "translation_notes": ["NT: saudação casual"],
                    "source": "model",
                    "detector_model_key": "",
                    "ocr_model_key": "easyocr",
                    "translator_model_key": "gpt_4_1_mini",
                },
            ],
        )
        self.assertEqual(cached_count, 1)

        hits, missing = manager.get_cached_translations_for_regions(
            key,
            [
                {
                    "id": "r1",
                    "text": "こんにちは",
                    "source": "model",
                    "detector_model_key": "",
                    "ocr_model_key": "easyocr",
                },
            ],
        )
        self.assertEqual(missing, [])
        self.assertEqual(hits["r1"]["translated_text"], "hello")
        self.assertEqual(hits["r1"]["translation_notes"], ["NT: saudação casual"])

        hits_after_change, missing_after_change = manager.get_cached_translations_for_regions(
            key,
            [
                {
                    "id": "r1",
                    "text": "こんばんは",
                    "source": "model",
                    "detector_model_key": "",
                    "ocr_model_key": "easyocr",
                },
            ],
        )
        self.assertEqual(hits_after_change, {})
        self.assertEqual(len(missing_after_change), 1)

    def test_cache_entry_expires_by_ttl(self) -> None:
        manager = CacheManager(ttl_seconds=1800, max_entries=16, bbox_tolerance_px=5)
        key = manager.build_translation_cache_key(
            model_key="gpt_4_1_mini",
            source_language="ja",
            target_language="en",
            extra_context="",
        )
        manager.cache_translation_results(
            key,
            [
                {
                    "id": "r1",
                    "source_text": "a",
                    "translated_text": "b",
                    "translation_notes": ["NT: cached"],
                    "source": "model",
                    "detector_model_key": "",
                    "ocr_model_key": "",
                    "translator_model_key": "gpt_4_1_mini",
                },
            ],
        )

        manager._translation_cache[key].cached_at = time.time() - 9999  # noqa: SLF001
        hits, missing = manager.get_cached_translations_for_regions(
            key,
            [{"id": "r1", "text": "a", "source": "model", "detector_model_key": "", "ocr_model_key": ""}],
        )
        self.assertEqual(hits, {})
        self.assertEqual(len(missing), 1)

    def test_translation_cache_key_changes_when_notes_toggle_changes(self) -> None:
        manager = CacheManager(ttl_seconds=1800, max_entries=16, bbox_tolerance_px=5)
        base_key = manager.build_translation_cache_key(
            model_key="gpt_4_1_mini",
            source_language="ja",
            target_language="pt-br",
            extra_context="ctx",
            llm_settings={"translation_notes_enabled": True},
        )
        notes_off_key = manager.build_translation_cache_key(
            model_key="gpt_4_1_mini",
            source_language="ja",
            target_language="pt-br",
            extra_context="ctx",
            llm_settings={"translation_notes_enabled": False},
        )

        self.assertNotEqual(base_key, notes_off_key)

    def test_cache_evicts_oldest_entries_when_limit_is_exceeded(self) -> None:
        manager = CacheManager(ttl_seconds=1800, max_entries=1, bbox_tolerance_px=5)
        key_a = manager.build_ocr_cache_key(
            image_bytes=b"image-a",
            language="ja",
            model_key="easyocr",
        )
        key_b = manager.build_ocr_cache_key(
            image_bytes=b"image-b",
            language="ja",
            model_key="easyocr",
        )

        manager.cache_ocr_results(
            key_a,
            [{"id": "a", "bbox": [1, 1, 2, 2], "text": "x", "score": 1.0, "source": "model", "detector_model_key": "", "ocr_model_key": "easyocr"}],
        )
        manager.cache_ocr_results(
            key_b,
            [{"id": "b", "bbox": [3, 3, 4, 4], "text": "y", "score": 1.0, "source": "model", "detector_model_key": "", "ocr_model_key": "easyocr"}],
        )

        self.assertEqual(len(manager._ocr_cache), 1)  # noqa: SLF001
        self.assertIn(key_b, manager._ocr_cache)  # noqa: SLF001
        self.assertNotIn(key_a, manager._ocr_cache)  # noqa: SLF001


if __name__ == "__main__":
    unittest.main()
