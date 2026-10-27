"""Local translation through HuggingFace transformers (Marian OPUS-MT and NLLB).

torch/transformers are imported lazily so the module itself stays importable in
the default test suite and in installations without the heavy runtime.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path
from typing import Protocol, cast

from models.translation.base_translator import (
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.errors import LocalModelError, UnsupportedLanguagePairError
from models.translation.local_base import LocalTranslatorBase, normalize_output_whitespace

MAX_NEW_TOKENS = 256
_DEVICE = "cpu"


class _TorchRuntime(Protocol):
    device: Callable[[str], object]


class _TokenBatch(Protocol):
    def __getitem__(self, key: str) -> object: ...


class _TokenizerFactory(Protocol):
    def from_pretrained(self, pretrained_model_name_or_path: str) -> object: ...


class _ModelFactory(Protocol):
    def from_pretrained(self, pretrained_model_name_or_path: str) -> object: ...


class _TransformersTokenizer(Protocol):
    def __call__(self, text: str, *, return_tensors: str) -> _TokenBatch: ...
    def batch_decode(
        self, sequences: object, *, skip_special_tokens: bool
    ) -> list[str]: ...


class _NllbTokenizer(_TransformersTokenizer, Protocol):
    src_lang: str
    def convert_tokens_to_ids(self, token: str) -> int: ...


class _TransformersModel(Protocol):
    def to(self, device: object) -> _TransformersModel: ...
    def float(self) -> _TransformersModel: ...
    def eval(self) -> _TransformersModel: ...
    def generate(
        self,
        *,
        input_ids: object,
        attention_mask: object,
        forced_bos_token_id: int | None,
        max_new_tokens: int,
        do_sample: bool,
    ) -> object: ...


def _import_torch() -> _TorchRuntime:
    try:
        import torch  # pyright: ignore[reportMissingImports]
    except ImportError as exc:
        raise LocalModelError(
            "Local translation dependency 'torch' is not installed."
        ) from exc
    return torch


def _import_transformers_classes() -> tuple[_TokenizerFactory, _ModelFactory]:
    try:
        from transformers import (  # pyright: ignore[reportMissingImports, reportMissingTypeStubs]
            AutoModelForSeq2SeqLM,
            AutoTokenizer,
        )
    except ImportError as exc:
        raise LocalModelError(
            "Local translation dependency 'transformers' is not installed."
        ) from exc
    return (
        cast(_TokenizerFactory, AutoTokenizer),
        cast(_ModelFactory, AutoModelForSeq2SeqLM),
    )


def canonical_language(value: str) -> str:
    return value.strip().lower().replace("_", "-")


class LocalTransformersTranslator(LocalTranslatorBase):
    """Seq2seq inference shared by the Marian and NLLB adapters."""

    required_files: tuple[str, ...] = ()

    def __init__(self, *, key: str, model_dir: str | Path | None = None) -> None:
        super().__init__(key=key, model_dir=model_dir)
        self.key = key
        self._tokenizer: _TransformersTokenizer | None = None
        self._model: _TransformersModel | None = None

    def _required_files(self) -> tuple[str, ...]:
        return self.required_files

    def _ensure_runtime(self) -> None:
        if self._tokenizer is not None and self._model is not None:
            return

        torch = _import_torch()
        tokenizer_factory, model_factory = _import_transformers_classes()

        missing = [
            name for name in self._required_files() if not (self.model_dir / name).is_file()
        ]
        if missing:
            raise LocalModelError(
                f"{self.key} runtime is incomplete at {self.model_dir}: "
                f"missing {', '.join(missing)}"
            )

        # Auto classes resolve to the Marian/NLLB classes named in the local
        # config.json; the directory path is the only source, never the repo id.
        tokenizer = cast(
            _TransformersTokenizer,
            tokenizer_factory.from_pretrained(str(self.model_dir)),
        )
        model = cast(
            _TransformersModel, model_factory.from_pretrained(str(self.model_dir))
        )
        # CPU fp32 unconditionally: 3.3B needs ~13 GB of weights, so a GPU path
        # would need a VRAM check this runtime does not implement.
        self._model = model.to(torch.device(_DEVICE)).float().eval()
        self._tokenizer = tokenizer

    def _require_runtime(self) -> tuple[_TransformersTokenizer, _TransformersModel]:
        if self._tokenizer is None or self._model is None:
            raise LocalModelError(f"{self.key} runtime is not loaded.")
        return self._tokenizer, self._model

    def _generate(
        self,
        tokenizer: _TransformersTokenizer,
        model: _TransformersModel,
        text: str,
        *,
        forced_bos_token_id: int | None,
    ) -> str:
        encoded = tokenizer(text, return_tensors="pt")
        output = model.generate(
            input_ids=encoded["input_ids"],
            attention_mask=encoded["attention_mask"],
            forced_bos_token_id=forced_bos_token_id,
            max_new_tokens=MAX_NEW_TOKENS,
            do_sample=False,
        )
        decoded = tokenizer.batch_decode(output, skip_special_tokens=True)
        return normalize_output_whitespace(decoded[0]) if decoded else ""

    def _results_in_order(
        self, request: TranslationRequest, translations: list[str]
    ) -> list[TranslationTextResult]:
        """One result per input region; blank regions never reach the model."""
        pending = iter(translations)
        return [
            self._result(region, next(pending) if region.text.strip() else "")
            for region in request.regions
        ]


_OPUS_SOURCE_LANGUAGES: dict[str, frozenset[str]] = {
    "opus-mt-ja-en": frozenset({"ja"}),
    "opus-mt-zh-en": frozenset({"zh", "zh-cn", "zh-tw"}),
}

_OPUS_REQUIRED_FILES: tuple[str, ...] = (
    "config.json",
    "generation_config.json",
    "pytorch_model.bin",
    "source.spm",
    "target.spm",
    "tokenizer_config.json",
    "vocab.json",
)


class OpusMtTranslator(LocalTransformersTranslator):
    """Helsinki-NLP Marian model with a fixed source->English direction."""

    required_files = _OPUS_REQUIRED_FILES

    def __init__(self, model_key: str, model_dir: str | Path | None = None) -> None:
        source_languages = _OPUS_SOURCE_LANGUAGES.get(model_key)
        if source_languages is None:
            raise LocalModelError(f"Unknown OPUS-MT model: {model_key}")
        super().__init__(key=model_key, model_dir=model_dir)
        self.name = f"OPUS-MT {model_key.removeprefix('opus-mt-').replace('-', '→').upper()}"
        self._source_languages = source_languages

    def _validate_language_pair(self, request: TranslationRequest) -> None:
        if (
            canonical_language(request.source_language) not in self._source_languages
            or canonical_language(request.target_language) != "en"
        ):
            raise UnsupportedLanguagePairError(
                self.key, request.source_language, request.target_language
            )

    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]:
        tokenizer, model = self._require_runtime()
        translations = [
            self._generate(
                tokenizer, model, region.text.strip(), forced_bos_token_id=None
            )
            for region in request.non_empty_regions()
        ]
        return self._results_in_order(request, translations)


_NLLB_LANGUAGE_CODES: dict[str, str] = {
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


class Nllb200Translator(LocalTransformersTranslator):
    key = "nllb-200-3.3b"
    name = "NLLB-200 3.3B"
    required_files: tuple[str, ...] = (
        "config.json",
        "generation_config.json",
        "pytorch_model.bin.index.json",
        "sentencepiece.bpe.model",
        "special_tokens_map.json",
        "tokenizer.json",
        "tokenizer_config.json",
    )

    def __init__(self, model_dir: str | Path | None = None) -> None:
        super().__init__(key=self.key, model_dir=model_dir)

    def _required_files(self) -> tuple[str, ...]:
        """The sharded checkpoint's shard names come from its index.json."""
        files = super()._required_files()
        index_path = self.model_dir / "pytorch_model.bin.index.json"
        try:
            payload: object = json.loads(index_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return files
        if not isinstance(payload, dict):
            return files
        weight_map = payload.get("weight_map")
        if not isinstance(weight_map, dict):
            return files
        shards = tuple(
            sorted({path for path in weight_map.values() if isinstance(path, str)})
        )
        return (*files, *shards)

    def _validate_language_pair(self, request: TranslationRequest) -> None:
        if (
            canonical_language(request.source_language) not in _NLLB_LANGUAGE_CODES
            or canonical_language(request.target_language) not in _NLLB_LANGUAGE_CODES
        ):
            raise UnsupportedLanguagePairError(
                self.key, request.source_language, request.target_language
            )

    def _nllb_code(self, language: str, request: TranslationRequest) -> str:
        code = _NLLB_LANGUAGE_CODES.get(canonical_language(language))
        if code is None:
            raise UnsupportedLanguagePairError(
                self.key, request.source_language, request.target_language
            )
        return code

    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]:
        tokenizer, model = self._require_runtime()
        nllb_tokenizer = cast(_NllbTokenizer, tokenizer)
        nllb_tokenizer.src_lang = self._nllb_code(request.source_language, request)
        forced_bos_token_id = nllb_tokenizer.convert_tokens_to_ids(
            self._nllb_code(request.target_language, request)
        )
        translations = [
            self._generate(
                tokenizer,
                model,
                region.text.strip(),
                forced_bos_token_id=forced_bos_token_id,
            )
            for region in request.non_empty_regions()
        ]
        return self._results_in_order(request, translations)


class Nllb200Distilled13BTranslator(Nllb200Translator):
    """Single-file checkpoint, no index — the upstream repo ships one plain
    ``pytorch_model.bin`` instead of the 3.3B's shards plus index."""

    key = "nllb-200-1.3b"
    name = "NLLB-200 1.3B"
    required_files: tuple[str, ...] = (
        "config.json",
        "generation_config.json",
        "pytorch_model.bin",
        "sentencepiece.bpe.model",
        "special_tokens_map.json",
        "tokenizer.json",
        "tokenizer_config.json",
    )

    def _required_files(self) -> tuple[str, ...]:
        return self.required_files
