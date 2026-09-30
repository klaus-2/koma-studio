from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation import http as http_mod
from models.translation.base_translator import TranslationInputRegion
from models.translation.errors import (
    TranslatorConfigurationError,
    UnsupportedLanguagePairError,
)
from models.translation.json_types import JsonValue
from models.translation.providers._batch_base import IndexedBatchTranslatorBase
from models.translation.providers._llm_base import LLMHttpRequest, LLMTranslatorBase


class _FakeLLM(LLMTranslatorBase):
    provider_label = "Fake"

    def __init__(self, *, configured: bool = True) -> None:
        super().__init__(key="fake_llm", model_name="fake", temperature=0.2)
        self._configured = configured

    def _ensure_configured(self) -> None:
        if not self._configured:
            raise TranslatorConfigurationError("Fake requires FAKE_KEY")

    def _build_http_request(self, system_prompt: str, user_prompt: str) -> LLMHttpRequest:
        return LLMHttpRequest(url="https://fake/chat", payload={"u": user_prompt})

    def _extract_text(self, response: JsonValue) -> str | None:
        if isinstance(response, dict):
            text = response.get("text")
            return text if isinstance(text, str) else None
        return None


class _FakeBatch(IndexedBatchTranslatorBase):
    key = "fake_batch"
    provider_label = "FakeBatch"

    def __init__(self) -> None:
        self.received: list[str] = []

    def _resolve_language_pair(self, source_language: str, target_language: str) -> tuple[str, str]:
        if target_language == "xx":
            raise UnsupportedLanguagePairError(self.key, source_language, target_language)
        return "", target_language.upper()

    async def _translate_texts(self, texts: list[str], source: str, target: str) -> list[str]:
        self.received = list(texts)
        return [f"{target}:{text}" for text in texts]


def _regions() -> list[TranslationInputRegion]:
    return [
        TranslationInputRegion(id="a", text="こんにちは"),
        TranslationInputRegion(id="b", text="   "),
        TranslationInputRegion(id="c", text="ありがとう"),
    ]


class LLMBaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_maps_ids_and_dedupes_notes(self) -> None:
        captured: dict[str, object] = {}

        async def fake_post_json(**kwargs: object) -> JsonValue:
            captured.update(kwargs)
            return {
                "text": '{"translations":[{"id":"a","text":"Hello","notes":["NT: greeting"]},'
                '{"id":"c","text":"Thanks","notes":["NT: greeting"]}]}'
            }

        with patch.object(http_mod, "post_json", side_effect=fake_post_json):
            results = await _FakeLLM().translate(_regions(), "ja", "en")

        # Blank region passes through empty; duplicate note kept only on its first occurrence.
        self.assertEqual([r.translated_text for r in results], ["Hello", "", "Thanks"])
        self.assertEqual(results[0].translation_notes, ["NT: greeting"])
        self.assertEqual(results[2].translation_notes, [])
        self.assertEqual(captured["url"], "https://fake/chat")

    async def test_unconfigured_engine_raises_configuration_error(self) -> None:
        with patch.object(http_mod, "post_json", side_effect=AssertionError("must not send")):
            with self.assertRaises(TranslatorConfigurationError):
                await _FakeLLM(configured=False).translate(_regions(), "ja", "en")

    async def test_blank_regions_skip_the_http_call(self) -> None:
        async def fake_post_json(**kwargs: object) -> JsonValue:
            raise AssertionError("must not send for blank-only regions")

        with patch.object(http_mod, "post_json", side_effect=fake_post_json):
            results = await _FakeLLM().translate([_regions()[1]], "ja", "en")
        self.assertEqual(results[0].translated_text, "")


class BatchBaseTests(unittest.IsolatedAsyncioTestCase):
    async def test_positional_mapping_skips_blank_regions(self) -> None:
        engine = _FakeBatch()
        results = await engine.translate(_regions(), "auto", "en")

        self.assertEqual(engine.received, ["こんにちは", "ありがとう"])
        self.assertEqual([r.translated_text for r in results], ["EN:こんにちは", "", "EN:ありがとう"])

    async def test_unsupported_language_pair_raises(self) -> None:
        engine = _FakeBatch()
        with self.assertRaises(UnsupportedLanguagePairError):
            await engine.translate(_regions(), "auto", "xx")

    async def test_count_mismatch_degrades_to_empty(self) -> None:
        class _ShortBatch(_FakeBatch):
            async def _translate_texts(self, texts: list[str], source: str, target: str) -> list[str]:
                return ["EN:only"]  # fewer than sent

        results = await _ShortBatch().translate(_regions(), "auto", "en")
        self.assertEqual(results[0].translated_text, "EN:only")
        self.assertEqual(results[2].translated_text, "")


if __name__ == "__main__":
    unittest.main()
