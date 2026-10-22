from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.translation import local_transformers as local_transformers_module
from models.translation.base_translator import TranslationInputRegion, TranslationRequest
from models.translation.errors import LocalModelError, UnsupportedLanguagePairError
from models.translation.local_transformers import (
    MAX_NEW_TOKENS,
    Nllb200Translator,
    OpusMtTranslator,
)


class _StubTokenizer:
    def __init__(self, outputs: list[str]) -> None:
        self._outputs = outputs
        self.calls: list[str] = []

    def __call__(self, text: str, *, return_tensors: str) -> dict[str, object]:
        self.calls.append(text)
        return {"input_ids": [1], "attention_mask": [1]}

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
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "forced_bos_token_id": forced_bos_token_id,
                "max_new_tokens": max_new_tokens,
                "do_sample": do_sample,
            }
        )
        return object()


def _stub_opus(
    monkeypatch: pytest.MonkeyPatch,
    model_key: str,
    outputs: list[str],
) -> tuple[OpusMtTranslator, _StubTokenizer, _StubModel]:
    translator = OpusMtTranslator(model_key=model_key, model_dir=Path.cwd())
    tokenizer = _StubTokenizer(outputs)
    model = _StubModel()
    monkeypatch.setattr(translator, "_ensure_runtime", lambda: None)
    monkeypatch.setattr(translator, "_tokenizer", tokenizer)
    monkeypatch.setattr(translator, "_model", model)
    return translator, tokenizer, model


def test_emits_one_result_per_input_region_in_order(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    translator, tokenizer, model = _stub_opus(
        monkeypatch, "opus-mt-ja-en", ["  Hello\u2581world  ", "Second   line"]
    )

    results = asyncio.run(
        translator.translate(
            [
                TranslationInputRegion(id="r1", text="こんにちは"),
                TranslationInputRegion(id="r2", text="   "),
                TranslationInputRegion(id="r3", text="二番目"),
            ],
            "ja",
            "en",
        )
    )

    assert [result.id for result in results] == ["r1", "r2", "r3"]
    assert results[0].translated_text == "Hello world"
    assert results[1].translated_text == ""
    assert results[2].translated_text == "Second line"
    assert results[0].source_text == "こんにちは"
    assert results[0].translator_model_key == "opus-mt-ja-en"
    assert tokenizer.calls == ["こんにちは", "二番目"]
    assert len(model.generate_calls) == 2
    assert model.generate_calls[0]["max_new_tokens"] == MAX_NEW_TOKENS
    assert model.generate_calls[0]["do_sample"] is False


def test_missing_torch_is_a_typed_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    translator = OpusMtTranslator(model_key="opus-mt-ja-en", model_dir=Path.cwd())
    monkeypatch.setitem(sys.modules, "torch", None)

    with pytest.raises(LocalModelError, match="'torch'"):
        translator._ensure_runtime()


def test_missing_transformers_is_a_typed_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    translator = OpusMtTranslator(model_key="opus-mt-ja-en", model_dir=Path.cwd())
    monkeypatch.setattr(local_transformers_module, "_import_torch", lambda: object())
    monkeypatch.setitem(sys.modules, "transformers", None)

    with pytest.raises(LocalModelError, match="'transformers'"):
        translator._ensure_runtime()


def test_missing_weights_name_the_model_directory(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    translator = OpusMtTranslator(model_key="opus-mt-ja-en", model_dir=tmp_path)
    monkeypatch.setattr(local_transformers_module, "_import_torch", lambda: object())
    monkeypatch.setattr(
        local_transformers_module,
        "_import_transformers_classes",
        lambda: (object(), object()),
    )

    with pytest.raises(LocalModelError) as error:
        translator._ensure_runtime()

    assert str(tmp_path) in str(error.value)
    assert "pytorch_model.bin" in str(error.value)


def _request(source: str, target: str) -> TranslationRequest:
    return TranslationRequest(
        regions=(TranslationInputRegion(id="r", text="x"),),
        source_language=source,
        target_language=target,
    )


def test_opus_accepts_declared_language_pairs() -> None:
    ja = OpusMtTranslator(model_key="opus-mt-ja-en", model_dir=Path.cwd())
    zh = OpusMtTranslator(model_key="opus-mt-zh-en", model_dir=Path.cwd())

    for source, target in (("ja", "en"), ("JA", "EN")):
        ja._validate_language_pair(_request(source, target))

    for source in ("zh", "zh-cn", "zh-tw", "ZH_CN", "zh_TW"):
        zh._validate_language_pair(_request(source, "en"))


@pytest.mark.parametrize(
    ("model_key", "source", "target"),
    [
        ("opus-mt-ja-en", "en", "ja"),
        ("opus-mt-ja-en", "zh", "en"),
        ("opus-mt-zh-en", "ja", "en"),
        ("opus-mt-zh-en", "zh", "ja"),
        ("opus-mt-zh-en", "zh", "en-us"),
    ],
)
def test_opus_rejects_unsupported_pairs(
    model_key: str, source: str, target: str
) -> None:
    translator = OpusMtTranslator(model_key=model_key, model_dir=Path.cwd())

    with pytest.raises(UnsupportedLanguagePairError):
        translator._validate_language_pair(_request(source, target))


def test_unknown_opus_model_key_is_a_typed_error(tmp_path: Path) -> None:
    with pytest.raises(LocalModelError, match="Unknown OPUS-MT model"):
        OpusMtTranslator(model_key="opus-mt-fr-en", model_dir=tmp_path)


def test_nllb_unknown_language_raises_before_inference() -> None:
    translator = Nllb200Translator(model_dir=Path.cwd())

    with pytest.raises(UnsupportedLanguagePairError):
        asyncio.run(
            translator.translate(
                [TranslationInputRegion(id="r", text="x")], "xx", "en"
            )
        )
