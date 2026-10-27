"""Stubbed inference contract for the NLLB CT2 runtime (600M int8 and 1.3B int8).

Both CT2 models share one parameterized adapter: the NLLB language code comes
from the static map shared with the transformers runtime, the target code is
forced via ``target_prefix``, and the forced token is dropped before decode.
"""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from pathlib import Path
import sys

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation.base_translator import TranslationInputRegion
from models.translation.errors import LocalModelError, UnsupportedLanguagePairError
from models.translation.local_ctranslate2 import NllbCt2LocalTranslator

CT2_MODEL_KEYS = ("nllb-200-600m-int8", "nllb-200-1.3b-int8-ct2")
EXPECTED_CODES: dict[str, str] = {
    "en": "eng_Latn",
    "ja": "jpn_Jpan",
    "pt-br": "por_Latn",
    "zh-tw": "zho_Hant",
}
_TOKEN_IDS: dict[str, int] = {
    "eng_Latn": 101,
    "por_Latn": 102,
    "out": 103,
    "text": 104,
}
_ID_TO_TOKEN: dict[int, str] = {token_id: token for token, token_id in _TOKEN_IDS.items()}


class _StubCt2Tokenizer:
    def __init__(self) -> None:
        self.src_lang = ""
        self.encode_calls: list[str] = []

    def encode(self, text: str) -> list[int]:
        self.encode_calls.append(text)
        return [1]

    def convert_ids_to_tokens(self, ids: Sequence[int]) -> list[str]:
        return [f"tok-{index}" for index, _ in enumerate(ids)]

    def convert_tokens_to_ids(self, tokens: Sequence[str]) -> list[int]:
        return [_TOKEN_IDS[token] for token in tokens]

    def decode(self, token_ids: Sequence[int]) -> str:
        return " ".join(_ID_TO_TOKEN[token_id] for token_id in token_ids)


class _StubCt2Result:
    def __init__(self, hypotheses: list[list[str]]) -> None:
        self.hypotheses = hypotheses


class _StubCt2Translator:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def translate_batch(
        self,
        source: Sequence[Sequence[str]],
        *,
        target_prefix: Sequence[Sequence[str]] | None = None,
    ) -> list[_StubCt2Result]:
        self.calls.append(
            {
                "source": [list(batch) for batch in source],
                "target_prefix": [list(prefix) for prefix in (target_prefix or [])],
            }
        )
        return [_StubCt2Result([["por_Latn", "out", "text"]]) for _ in source]


def _loaded_nllb_ct2(
    monkeypatch: pytest.MonkeyPatch, model_key: str
) -> tuple[NllbCt2LocalTranslator, _StubCt2Tokenizer, _StubCt2Translator]:
    translator = NllbCt2LocalTranslator(model_key=model_key, model_dir=Path.cwd())
    tokenizer = _StubCt2Tokenizer()
    ct2 = _StubCt2Translator()
    monkeypatch.setattr(translator, "_ensure_runtime", lambda: None)
    monkeypatch.setattr(translator, "_tokenizer", tokenizer)
    monkeypatch.setattr(translator, "_translator", ct2)
    return translator, tokenizer, ct2


@pytest.mark.parametrize(("language", "expected"), sorted(EXPECTED_CODES.items()))
def test_ct2_source_language_sets_tokenizer_src_lang(
    monkeypatch: pytest.MonkeyPatch, language: str, expected: str
) -> None:
    translator, tokenizer, _ct2 = _loaded_nllb_ct2(monkeypatch, "nllb-200-600m-int8")

    asyncio.run(
        translator.translate(
            [TranslationInputRegion(id="r", text="text")], language, "pt"
        )
    )

    assert tokenizer.src_lang == expected


@pytest.mark.parametrize("model_key", CT2_MODEL_KEYS)
def test_ct2_forces_the_target_code_and_drops_it_from_the_output(
    monkeypatch: pytest.MonkeyPatch, model_key: str
) -> None:
    translator, tokenizer, ct2 = _loaded_nllb_ct2(monkeypatch, model_key)

    results = asyncio.run(
        translator.translate(
            [TranslationInputRegion(id="r", text="Hello")], "en", "pt"
        )
    )

    assert translator.key == model_key
    assert tokenizer.src_lang == "eng_Latn"
    assert ct2.calls[0]["target_prefix"] == [["por_Latn"]]
    assert results[0].translated_text == "out text"


def test_ct2_batches_all_regions_in_one_call_preserving_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Order is preserved; blank regions ride the batch like any other region
    (m2m100 adapter parity — blank-skipping is the transformers path's job)."""
    translator, tokenizer, ct2 = _loaded_nllb_ct2(monkeypatch, "nllb-200-600m-int8")

    results = asyncio.run(
        translator.translate(
            [
                TranslationInputRegion(id="r1", text="一"),
                TranslationInputRegion(id="r2", text="  "),
                TranslationInputRegion(id="r3", text="三"),
            ],
            "ja",
            "pt-br",
        )
    )

    assert [result.id for result in results] == ["r1", "r2", "r3"]
    assert [result.translated_text for result in results] == [
        "out text",
        "out text",
        "out text",
    ]
    assert tokenizer.encode_calls == ["一", "  ", "三"]
    assert len(ct2.calls) == 1
    assert ct2.calls[0]["source"] == [["tok-0"], ["tok-0"], ["tok-0"]]


@pytest.mark.parametrize(
    ("source", "target"),
    [("xx", "en"), ("en", "xx"), ("auto", "en")],
)
def test_ct2_unknown_language_is_a_typed_error(
    monkeypatch: pytest.MonkeyPatch, source: str, target: str
) -> None:
    translator, tokenizer, ct2 = _loaded_nllb_ct2(monkeypatch, "nllb-200-600m-int8")

    with pytest.raises(UnsupportedLanguagePairError):
        asyncio.run(
            translator.translate(
                [TranslationInputRegion(id="r", text="text")], source, target
            )
        )

    assert tokenizer.encode_calls == []
    assert ct2.calls == []


@pytest.mark.parametrize(
    ("model_key", "name"),
    [
        ("nllb-200-600m-int8", "NLLB-200 600M int8 (CT2)"),
        ("nllb-200-1.3b-int8-ct2", "NLLB-200 1.3B int8 (CT2)"),
    ],
)
def test_ct2_variants_construct_with_their_registry_key(model_key: str, name: str) -> None:
    translator = NllbCt2LocalTranslator(model_key=model_key, model_dir=Path.cwd())

    assert translator.key == model_key
    assert translator.name == name


def test_ct2_unknown_model_key_is_a_typed_error() -> None:
    with pytest.raises(LocalModelError):
        NllbCt2LocalTranslator(model_key="not-a-ct2-model", model_dir=Path.cwd())
