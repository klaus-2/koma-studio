from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import Protocol, cast

from models.translation.base_translator import TranslationRequest, TranslationTextResult
from models.translation.errors import LocalModelError, UnsupportedLanguagePairError
from models.translation.local_base import LocalTranslatorBase, normalize_output_whitespace


class _TranslationResult(Protocol):
    hypotheses: Sequence[Sequence[str]]


class _CT2Translator(Protocol):
    def translate_batch(
        self,
        source: Sequence[Sequence[str]],
        *,
        target_prefix: Sequence[Sequence[str]] | None = None,
    ) -> Sequence[_TranslationResult]: ...


class _SentencePieceProcessor(Protocol):
    def encode(
        self,
        input: Sequence[str],  # noqa: A002 — mirrors sentencepiece's parameter name
        *,
        out_type: type[str],
        enable_sampling: bool,
        alpha: float,
        nbest_size: int,
    ) -> list[list[str]]: ...


class _M2M100Tokenizer(Protocol):
    src_lang: str
    lang_code_to_token: dict[str, str]

    def encode(self, text: str) -> list[int]: ...
    def convert_ids_to_tokens(self, ids: Sequence[int]) -> list[str]: ...
    def convert_tokens_to_ids(self, tokens: Sequence[str]) -> list[int]: ...
    def decode(self, token_ids: Sequence[int]) -> str: ...


def _first_hypothesis(result: _TranslationResult) -> str:
    return "".join(result.hypotheses[0]) if result.hypotheses else ""


class SugoiLocalTranslator(LocalTranslatorBase):
    key = "sugoi_v4_ja_en_ct2"
    name = "Sugoi v4 JA→EN (CT2)"

    def __init__(self, model_dir: str | Path | None = None, device: str = "cpu") -> None:
        super().__init__(key=self.key, model_dir=model_dir)
        self.device = device
        self._translator: _CT2Translator | None = None
        self._tokenizer: _SentencePieceProcessor | None = None

    def _validate_language_pair(self, request: TranslationRequest) -> None:
        if (request.source_language, request.target_language) != ("ja", "en"):
            raise UnsupportedLanguagePairError(
                self.key, request.source_language, request.target_language
            )

    def _ensure_runtime(self) -> None:
        if self._translator is not None and self._tokenizer is not None:
            return
        try:
            import ctranslate2  # pyright: ignore[reportMissingImports, reportMissingTypeStubs]
            import sentencepiece  # pyright: ignore[reportMissingImports, reportMissingTypeStubs]
        except ImportError as exc:
            raise LocalModelError(
                "Local translation dependencies (ctranslate2/sentencepiece) are not installed."
            ) from exc

        tokenizer_path = self.model_dir / "spm" / "spm.ja.nopretok.model"
        if not tokenizer_path.is_file():
            raise LocalModelError(f"Sugoi tokenizer not found in {self.model_dir}")

        self._translator = cast(
            _CT2Translator, ctranslate2.Translator(str(self.model_dir), device=self.device)
        )
        self._tokenizer = cast(
            _SentencePieceProcessor,
            sentencepiece.SentencePieceProcessor(model_file=str(tokenizer_path)),  # pyright: ignore[reportCallIssue] - real signature takes model_file; stubs are wrong
        )

    def _runtime(self) -> tuple[_CT2Translator, _SentencePieceProcessor]:
        if self._translator is None or self._tokenizer is None:
            raise LocalModelError("Sugoi runtime is not loaded.")
        return self._translator, self._tokenizer

    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]:
        translator, tokenizer = self._runtime()
        # Sugoi's SentencePiece model mistreats periods; the upstream recipe swaps them around inference.
        normalized = [region.text.replace(".", "@").replace("．", "@") for region in request.regions]
        tokenized = tokenizer.encode(
            normalized, out_type=str, enable_sampling=True, alpha=0.1, nbest_size=-1
        )
        outputs = translator.translate_batch(tokenized)
        translated = [
            normalize_output_whitespace(_first_hypothesis(result).replace("@", "."))
            for result in outputs
        ]
        return [
            self._result(region, text)
            for region, text in zip(request.regions, translated, strict=True)
        ]


class M2M100LocalTranslator(LocalTranslatorBase):
    key = "m2m100_1_2b_ct2"
    name = "M2M100 1.2B (CT2)"

    def __init__(self, model_dir: str | Path | None = None, device: str = "cpu") -> None:
        super().__init__(key=self.key, model_dir=model_dir)
        self.device = device
        self._translator: _CT2Translator | None = None
        self._tokenizer: _M2M100Tokenizer | None = None

    def _ensure_runtime(self) -> None:
        if self._translator is not None and self._tokenizer is not None:
            return
        try:
            import ctranslate2  # pyright: ignore[reportMissingImports, reportMissingTypeStubs]
            from transformers import (  # pyright: ignore[reportMissingImports, reportMissingTypeStubs]
                AutoTokenizer,
            )
        except ImportError as exc:
            raise LocalModelError(
                "Local translation dependencies (ctranslate2/transformers) are not installed."
            ) from exc

        if not (self.model_dir / "model.bin").is_file():
            raise LocalModelError(f"M2M100 model not found in {self.model_dir}")

        self._translator = cast(
            _CT2Translator, ctranslate2.Translator(str(self.model_dir), device=self.device)
        )
        self._tokenizer = cast(
            _M2M100Tokenizer,
            AutoTokenizer.from_pretrained(str(self.model_dir), clean_up_tokenization_spaces=True),
        )

    def _runtime(self) -> tuple[_CT2Translator, _M2M100Tokenizer]:
        if self._translator is None or self._tokenizer is None:
            raise LocalModelError("M2M100 runtime is not loaded.")
        return self._translator, self._tokenizer

    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]:
        translator, tokenizer = self._runtime()
        target_token = tokenizer.lang_code_to_token.get(request.target_language)
        if target_token is None:
            raise UnsupportedLanguagePairError(
                self.key, request.source_language, request.target_language
            )

        tokenizer.src_lang = request.source_language
        tokenized = [
            tokenizer.convert_ids_to_tokens(tokenizer.encode(region.text))
            for region in request.regions
        ]
        outputs = translator.translate_batch(
            tokenized, target_prefix=[[target_token]] * len(tokenized)
        )
        translated = [
            normalize_output_whitespace(
                tokenizer.decode(
                    tokenizer.convert_tokens_to_ids(result.hypotheses[0][1:])
                )
            )
            if result.hypotheses
            else ""
            for result in outputs
        ]
        return [
            self._result(region, text)
            for region, text in zip(request.regions, translated, strict=True)
        ]
