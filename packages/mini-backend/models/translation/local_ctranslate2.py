from __future__ import annotations

from pathlib import Path
from typing import Iterable

from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.local_storage import resolve_local_translation_model_dir


def _normalize_output_whitespace(text: str) -> str:
    return " ".join(str(text or "").replace("\u2581", " ").split())


class SugoiLocalTranslator(BaseTranslator):
    key = "sugoi_v4_ja_en_ct2"
    name = "Sugoi v4 JA→EN (CT2)"

    def __init__(self, model_dir: str | Path | None = None, device: str = "cpu") -> None:
        self.model_dir = Path(model_dir).expanduser().resolve() if model_dir else resolve_local_translation_model_dir(self.key)
        if self.model_dir is None:
            raise RuntimeError(
                "Managed models directory is not configured for Sugoi.",
            )
        self.device = device
        self.translator = None
        self.tokenizer = None

    def _ensure_runtime(self) -> None:
        if self.translator is not None and self.tokenizer is not None:
            return
        try:
            import ctranslate2  # type: ignore
            import sentencepiece as spm  # type: ignore
        except Exception as exc:
            raise RuntimeError("Local translation dependencies (ctranslate2/sentencepiece) are not installed.") from exc

        tokenizer_path = self.model_dir / "spm" / "spm.ja.nopretok.model"
        if not tokenizer_path.exists():
            raise FileNotFoundError(f"Sugoi model/tokenizer not found in {self.model_dir}")

        self.translator = ctranslate2.Translator(str(self.model_dir), device=self.device)
        self.tokenizer = spm.SentencePieceProcessor(model_file=str(tokenizer_path))

    def _translate_tokens(self, texts: Iterable[str]) -> list[str]:
        assert self.translator is not None
        assert self.tokenizer is not None
        normalized = [str(item or "").replace(".", "@").replace("．", "@") for item in texts]
        tokenized = self.tokenizer.encode(normalized, out_type=str, enable_sampling=True, alpha=0.1, nbest_size=-1)
        translated = self.translator.translate_batch(tokenized)
        outputs: list[str] = []
        for batch_item in translated:
            if hasattr(batch_item, "hypotheses"):
                tokens = batch_item.hypotheses[0]
            elif isinstance(batch_item, list) and batch_item:
                first = batch_item[0]
                tokens = first.get("tokens", []) if isinstance(first, dict) else []
            else:
                tokens = []
            outputs.append(_normalize_output_whitespace("".join(tokens).replace("@", ".")))
        return outputs

    def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = extra_context
        _ = translation_notes_enabled
        _ = translation_mode
        if source_language != "ja" or target_language != "en":
            raise RuntimeError("Local Sugoi only supports JA->EN.")
        self._ensure_runtime()
        translated_texts = self._translate_tokens(region.text for region in regions)
        results: list[TranslationTextResult] = []
        for region, translated_text in zip(regions, translated_texts, strict=False):
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=region.text,
                    translated_text=translated_text,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                )
            )
        return results


class M2M100LocalTranslator(BaseTranslator):
    key = "m2m100_1_2b_ct2"
    name = "M2M100 1.2B (CT2)"

    def __init__(self, model_dir: str | Path | None = None, device: str = "cpu") -> None:
        self.model_dir = Path(model_dir).expanduser().resolve() if model_dir else resolve_local_translation_model_dir(self.key)
        if self.model_dir is None:
            raise RuntimeError(
                "Managed models directory is not configured for M2M100.",
            )
        self.device = device
        self.translator = None
        self.tokenizer = None

    def _ensure_runtime(self) -> None:
        if self.translator is not None and self.tokenizer is not None:
            return
        try:
            import ctranslate2  # type: ignore
            from transformers import AutoTokenizer  # type: ignore
        except Exception as exc:
            raise RuntimeError("Local translation dependencies (ctranslate2/transformers) are not installed.") from exc

        if not (self.model_dir / "model.bin").exists():
            raise FileNotFoundError(f"M2M100 model not found in {self.model_dir}")

        self.translator = ctranslate2.Translator(str(self.model_dir), device=self.device)
        self.tokenizer = AutoTokenizer.from_pretrained(str(self.model_dir), clean_up_tokenization_spaces=True)

    def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = extra_context
        _ = translation_notes_enabled
        _ = translation_mode
        self._ensure_runtime()
        assert self.translator is not None
        assert self.tokenizer is not None

        self.tokenizer.src_lang = source_language
        tokenized = [
            self.tokenizer.convert_ids_to_tokens(self.tokenizer.encode(region.text))
            for region in regions
        ]
        try:
            target_prefix = [self.tokenizer.lang_code_to_token[target_language]]
        except Exception as exc:
            raise RuntimeError(f"Target language not supported by local M2M100: {target_language}") from exc

        translated = self.translator.translate_batch(tokenized, target_prefix=[target_prefix] * len(tokenized))
        outputs = [
            _normalize_output_whitespace(
                self.tokenizer.decode(
                    self.tokenizer.convert_tokens_to_ids(item.hypotheses[0][1:])
                )
            )
            for item in translated
        ]

        results: list[TranslationTextResult] = []
        for region, translated_text in zip(regions, outputs, strict=False):
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=region.text,
                    translated_text=translated_text,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                )
            )
        return results
