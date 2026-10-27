"""Stubbed contract for the nllb-200-1.3b transformers runtime.

The distilled 1.3B checkpoint is a single plain ``pytorch_model.bin`` — no
index, no shards. These tests pin that shape (plus the shared src_lang /
forced_bos inference flow) without loading the 5.5 GB weights.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
import sys
import tempfile

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation.base_translator import TranslationInputRegion
from models.translation.local_transformers import (
    MAX_NEW_TOKENS,
    Nllb200Distilled13BTranslator,
)

REQUIRED_FILES: tuple[str, ...] = (
    "config.json",
    "generation_config.json",
    "pytorch_model.bin",
    "sentencepiece.bpe.model",
    "special_tokens_map.json",
    "tokenizer.json",
    "tokenizer_config.json",
)
EXPECTED_CODES: dict[str, str] = {
    "en": "eng_Latn",
    "ja": "jpn_Jpan",
    "pt-br": "por_Latn",
    "zh-tw": "zho_Hant",
}
_TOKEN_IDS: dict[str, int] = {
    "eng_Latn": 100,
    "por_Latn": 101,
    "jpn_Jpan": 102,
    "zho_Hant": 103,
}


class _StubNllbTokenizer:
    def __init__(self, outputs: list[str]) -> None:
        self.src_lang = ""
        self._outputs = outputs
        self.calls: list[str] = []

    def __call__(self, text: str, *, return_tensors: str) -> dict[str, object]:
        self.calls.append(text)
        return {"input_ids": [1], "attention_mask": [1]}

    def convert_tokens_to_ids(self, token: str) -> int:
        return _TOKEN_IDS[token]

    def batch_decode(self, sequences: object, *, skip_special_tokens: bool) -> list[str]:
        return [self._outputs.pop(0)]


class _StubModel:
    def __init__(self) -> None:
        self.generate_calls: list[dict[str, object]] = []

    def to(self, device: object) -> "_StubModel":
        return self

    def float(self) -> "_StubModel":
        return self

    def eval(self) -> "_StubModel":
        return self

    def generate(
        self,
        *,
        input_ids: object,
        attention_mask: object,
        forced_bos_token_id: int | None,
        max_new_tokens: int,
        do_sample: bool,
    ) -> object:
        self.generate_calls.append(
            {
                "forced_bos_token_id": forced_bos_token_id,
                "max_new_tokens": max_new_tokens,
                "do_sample": do_sample,
            }
        )
        return object()


def _loaded_nllb_13b(
    monkeypatch: pytest.MonkeyPatch, outputs: list[str]
) -> tuple[Nllb200Distilled13BTranslator, _StubNllbTokenizer, _StubModel]:
    translator = Nllb200Distilled13BTranslator(model_dir=Path.cwd())
    tokenizer = _StubNllbTokenizer(outputs)
    model = _StubModel()
    monkeypatch.setattr(translator, "_ensure_runtime", lambda: None)
    monkeypatch.setattr(translator, "_tokenizer", tokenizer)
    monkeypatch.setattr(translator, "_model", model)
    return translator, tokenizer, model


def test_distilled_13b_declares_the_single_file_checkpoint() -> None:
    translator = Nllb200Distilled13BTranslator(model_dir=Path.cwd())

    assert translator.key == "nllb-200-1.3b"
    assert translator.name == "NLLB-200 1.3B"
    assert translator.required_files == REQUIRED_FILES
    assert not any("index" in name for name in translator.required_files)
    assert not any("of-000" in name for name in translator.required_files)


def test_required_files_ignore_a_directory_without_an_index() -> None:
    with tempfile.TemporaryDirectory() as directory:
        translator = Nllb200Distilled13BTranslator(model_dir=Path(directory))

        assert translator._required_files() == REQUIRED_FILES


@pytest.mark.parametrize(("language", "expected"), sorted(EXPECTED_CODES.items()))
def test_distilled_13b_sets_tokenizer_src_lang(
    monkeypatch: pytest.MonkeyPatch, language: str, expected: str
) -> None:
    translator, tokenizer, _model = _loaded_nllb_13b(monkeypatch, ["translated"])

    asyncio.run(
        translator.translate(
            [TranslationInputRegion(id="r", text="text")], language, "pt"
        )
    )

    assert tokenizer.src_lang == expected


@pytest.mark.parametrize(("language", "expected"), sorted(EXPECTED_CODES.items()))
def test_distilled_13b_forces_bos_for_the_target_language(
    monkeypatch: pytest.MonkeyPatch, language: str, expected: str
) -> None:
    translator, tokenizer, model = _loaded_nllb_13b(monkeypatch, ["translated"])

    asyncio.run(
        translator.translate(
            [TranslationInputRegion(id="r", text="text")], "en", language
        )
    )

    assert tokenizer.src_lang == "eng_Latn"
    assert model.generate_calls[0]["forced_bos_token_id"] == _TOKEN_IDS[expected]
    assert model.generate_calls[0]["max_new_tokens"] == MAX_NEW_TOKENS
    assert model.generate_calls[0]["do_sample"] is False


def test_distilled_13b_preserves_region_order_and_skips_blank_regions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    translator, tokenizer, model = _loaded_nllb_13b(monkeypatch, ["First", "Third"])

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
    assert [result.translated_text for result in results] == ["First", "", "Third"]
    assert tokenizer.calls == ["一", "三"]
    assert len(model.generate_calls) == 2
    assert model.generate_calls[0]["forced_bos_token_id"] == _TOKEN_IDS["por_Latn"]
