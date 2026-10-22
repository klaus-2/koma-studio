from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation import local_transformers as local_transformers_module
from models.translation.base_translator import TranslationInputRegion
from models.translation.errors import LocalModelError, UnsupportedLanguagePairError
from models.translation.local_transformers import MAX_NEW_TOKENS, Nllb200Translator

EXPECTED_CODES: dict[str, str] = {
    "en": "eng_Latn",
    "pt": "por_Latn",
    "pt-br": "por_Latn",
    "ja": "jpn_Jpan",
    "zh": "zho_Hans",
    "zh-cn": "zho_Hans",
    "zh-tw": "zho_Hant",
    "ko": "kor_Hang",
    "fr": "fra_Latn",
    "de": "deu_Latn",
    "es": "spa_Latn",
    "it": "ita_Latn",
    "ru": "rus_Cyrl",
    "tr": "tur_Latn",
    "pl": "pol_Latn",
    "vi": "vie_Latn",
    "id": "ind_Latn",
    "hu": "hun_Latn",
    "fi": "fin_Latn",
    "ar": "arb_Arab",
    "th": "tha_Thai",
    "nl": "nld_Latn",
}
_TOKEN_IDS: dict[str, int] = {
    code: 1000 + index for index, code in enumerate(dict.fromkeys(EXPECTED_CODES.values()))
}
PARTIAL_FIXTURE_DIR = Path(__file__).parent / "fixtures" / "tiny_nllb"


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


def _loaded_nllb(
    monkeypatch: pytest.MonkeyPatch, outputs: list[str]
) -> tuple[Nllb200Translator, _StubNllbTokenizer, _StubModel]:
    translator = Nllb200Translator(model_dir=Path.cwd())
    tokenizer = _StubNllbTokenizer(outputs)
    model = _StubModel()
    monkeypatch.setattr(translator, "_ensure_runtime", lambda: None)
    monkeypatch.setattr(translator, "_tokenizer", tokenizer)
    monkeypatch.setattr(translator, "_model", model)
    return translator, tokenizer, model


@pytest.mark.parametrize(("language", "expected"), sorted(EXPECTED_CODES.items()))
def test_nllb_source_language_sets_tokenizer_src_lang(
    monkeypatch: pytest.MonkeyPatch, language: str, expected: str
) -> None:
    translator, tokenizer, _model = _loaded_nllb(monkeypatch, ["translated"])

    asyncio.run(
        translator.translate([TranslationInputRegion(id="r", text="text")], language, "en")
    )

    assert tokenizer.src_lang == expected


@pytest.mark.parametrize(("language", "expected"), sorted(EXPECTED_CODES.items()))
def test_nllb_target_language_forces_bos_token(
    monkeypatch: pytest.MonkeyPatch, language: str, expected: str
) -> None:
    translator, tokenizer, model = _loaded_nllb(monkeypatch, ["translated"])

    asyncio.run(
        translator.translate([TranslationInputRegion(id="r", text="text")], "en", language)
    )

    assert tokenizer.src_lang == "eng_Latn"
    assert model.generate_calls[0]["forced_bos_token_id"] == _TOKEN_IDS[expected]


def test_nllb_preserves_region_order_and_skips_blank_regions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    translator, tokenizer, model = _loaded_nllb(monkeypatch, ["First", "Third"])

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
    assert model.generate_calls[0]["max_new_tokens"] == MAX_NEW_TOKENS
    assert model.generate_calls[0]["do_sample"] is False


@pytest.mark.parametrize(
    ("source", "target"),
    [("xx", "en"), ("en", "xx"), ("auto", "en")],
)
def test_nllb_unknown_language_is_a_typed_error(
    monkeypatch: pytest.MonkeyPatch, source: str, target: str
) -> None:
    translator, tokenizer, model = _loaded_nllb(monkeypatch, ["translated"])

    with pytest.raises(UnsupportedLanguagePairError):
        asyncio.run(
            translator.translate(
                [TranslationInputRegion(id="r", text="text")], source, target
            )
        )

    assert tokenizer.calls == []
    assert model.generate_calls == []


def test_nllb_partial_shard_install_is_a_typed_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(local_transformers_module, "_import_torch", lambda: object())
    monkeypatch.setattr(
        local_transformers_module,
        "_import_transformers_classes",
        lambda: (object(), object()),
    )
    translator = Nllb200Translator(model_dir=PARTIAL_FIXTURE_DIR)

    with pytest.raises(LocalModelError) as error:
        translator._ensure_runtime()

    message = str(error.value)
    assert str(PARTIAL_FIXTURE_DIR) in message
    assert "pytorch_model-00001-of-00002.bin" in message
    assert "pytorch_model-00002-of-00002.bin" in message
