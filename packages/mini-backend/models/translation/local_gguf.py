"""Local GGUF-based translation models using llama-cpp-python.

Supports the following models from the koharu pipeline:
  - vntl_llama3_8b_v2       (JA → EN)
  - lfm2_350m_enjp_mt       (JA → EN)
  - sakura_galtransl_7b_v3_7 (JA → ZH-CN)
  - sakura_1_5b_qwen2_5_v1_0 (JA → ZH-CN)
  - hunyuan_7b_mt_v1_0       (JA → 44 languages)
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any

from models.translation.base_translator import (
    BaseTranslator,
    TranslationInputRegion,
    TranslationTextResult,
)
from models.translation.local_storage import resolve_local_translation_model_dir

logger = logging.getLogger(__name__)

# ── Model-specific configuration ────────────────────────────────────────────

_MODEL_CONFIGS: dict[str, dict[str, Any]] = {
    "vntl_llama3_8b_v2": {
        "gguf_file": "vntl-llama3-8b-v2-hf-q8_0.gguf",
        "source_languages": {"ja"},
        "target_languages": {"en"},
        "n_ctx": 2048,
        "n_gpu_layers": -1,
    },
    "lfm2_350m_enjp_mt": {
        "gguf_file": "LFM2-350M-ENJP-MT-Q4_0.gguf",
        "source_languages": {"ja", "en"},
        "target_languages": {"en", "ja"},
        "n_ctx": 1024,
        "n_gpu_layers": -1,
    },
    "sakura_galtransl_7b_v3_7": {
        "gguf_file": "Sakura-Galtransl-7B-v3.7-IQ4_XS.gguf",
        "source_languages": {"ja"},
        "target_languages": {"zh", "zh-cn"},
        "n_ctx": 2048,
        "n_gpu_layers": -1,
    },
    "sakura_1_5b_qwen2_5_v1_0": {
        "gguf_file": "sakura-1.5b-qwen2.5-v1.0-Q5KS.gguf",
        "source_languages": {"ja"},
        "target_languages": {"zh", "zh-cn"},
        "n_ctx": 2048,
        "n_gpu_layers": -1,
    },
    "hunyuan_7b_mt_v1_0": {
        "gguf_file": "Hunyuan-MT-7B-q4_k_m.gguf",
        "source_languages": {
            "zh",
            "zh-cn",
            "zh-tw",
            "en",
            "fr",
            "pt",
            "pt-br",
            "es",
            "ja",
            "tr",
            "ru",
            "ar",
            "ko",
            "th",
            "it",
            "de",
            "vi",
            "ms",
            "id",
            "tl",
            "hi",
            "pl",
            "nl",
            "km",
            "my",
            "fa",
            "gu",
            "ur",
            "te",
            "mr",
            "he",
            "bn",
            "ta",
            "uk",
            "bo",
            "kk",
            "mn",
            "ug",
            "yue",
            "cs",
        },
        "target_languages": {
            "zh",
            "zh-cn",
            "zh-tw",
            "en",
            "fr",
            "pt",
            "pt-br",
            "es",
            "ja",
            "tr",
            "ru",
            "ar",
            "ko",
            "th",
            "it",
            "de",
            "vi",
            "ms",
            "id",
            "tl",
            "hi",
            "pl",
            "nl",
            "km",
            "my",
            "fa",
            "gu",
            "ur",
            "te",
            "mr",
            "he",
            "bn",
            "ta",
            "uk",
            "bo",
            "kk",
            "mn",
            "ug",
            "yue",
            "cs",
        },
        "n_ctx": 2048,
        "n_gpu_layers": -1,
    },
}


# ── Prompt formatting ────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "You are a professional manga translator. "
    "Translate Japanese manga dialogue into natural {target_language} "
    "that fits inside speech bubbles. "
    "Preserve character voice, emotional tone, relationship nuance, emphasis, "
    "and sound effects naturally. Keep the wording concise. "
    "Do not add notes, explanations, or romanization. "
    'If the input contains <block id="N">...</block>, translate only the text '
    "inside each block. Keep every block tag exactly unchanged, including ids, "
    "order, and block count. Do not merge blocks, split blocks, or add any text "
    "outside the blocks."
)

_LANGUAGE_NAMES: dict[str, str] = {
    "en": "English",
    "zh-cn": "Simplified Chinese",
    "zh": "Chinese",
    "zh-tw": "Traditional Chinese",
    "fr": "French",
    "pt": "Portuguese",
    "pt-br": "Brazilian Portuguese",
    "es": "Spanish",
    "de": "German",
    "ru": "Russian",
    "ko": "Korean",
    "it": "Italian",
    "ar": "Arabic",
    "tr": "Turkish",
    "th": "Thai",
    "vi": "Vietnamese",
    "id": "Indonesian",
    "hi": "Hindi",
    "nl": "Dutch",
    "pl": "Polish",
}


def _format_blocks(regions: list[TranslationInputRegion]) -> str:
    parts: list[str] = []
    for region in regions:
        text = str(region.text or "").strip()
        if text:
            parts.append(f'<block id="{region.id}">{text}</block>')
    return "\n".join(parts)


def _parse_block_translations(
    raw: str, regions: list[TranslationInputRegion]
) -> dict[str, str]:
    results: dict[str, str] = {}
    for match in re.finditer(
        r'<block\s+id="([^"]+)">(.*?)</block>', raw, flags=re.DOTALL
    ):
        results[match.group(1)] = match.group(2).strip()

    if not results and regions:
        lines = [line.strip() for line in raw.strip().splitlines() if line.strip()]
        for idx, region in enumerate(regions):
            if idx < len(lines):
                results[region.id] = lines[idx]
    return results


# ── Translator ───────────────────────────────────────────────────────────────


class GGUFLocalTranslator(BaseTranslator):
    """Translation engine backed by a local GGUF model via llama-cpp-python."""

    def __init__(self, model_key: str, model_dir: str | Path | None = None) -> None:
        config = _MODEL_CONFIGS.get(model_key)
        if config is None:
            raise RuntimeError(f"Modelo GGUF desconhecido: {model_key}")

        self.key = model_key
        self.name = model_key.replace("_", " ").title()
        self._config = config
        self._model_dir = (
            Path(model_dir).expanduser().resolve()
            if model_dir
            else resolve_local_translation_model_dir(model_key)
        )
        if self._model_dir is None:
            raise RuntimeError(
                f"Managed models directory is not configured for {model_key}."
            )
        self._llm = None

    def _ensure_runtime(self) -> None:
        if self._llm is not None:
            return
        try:
            from llama_cpp import Llama  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "llama-cpp-python is not installed. "
                "Instale com: pip install llama-cpp-python"
            ) from exc

        gguf_path = self._model_dir / self._config["gguf_file"]
        if not gguf_path.exists():
            raise FileNotFoundError(f"GGUF model not found: {gguf_path}")

        logger.info("loading GGUF model from %s", gguf_path)
        self._llm = Llama(
            model_path=str(gguf_path),
            n_ctx=self._config.get("n_ctx", 2048),
            n_gpu_layers=self._config.get("n_gpu_layers", -1),
            verbose=False,
        )

    def _translate(
        self,
        regions: list[TranslationInputRegion],
        source_language: str,
        target_language: str,
        extra_context: str = "",
        translation_notes_enabled: bool = True,
        translation_mode: str = "default",
    ) -> list[TranslationTextResult]:
        _ = extra_context, translation_notes_enabled, translation_mode

        if not regions:
            return []

        self._ensure_runtime()
        assert self._llm is not None

        target_name = _LANGUAGE_NAMES.get(target_language.lower(), target_language)
        system_prompt = _SYSTEM_PROMPT.format(target_language=target_name)
        user_content = _format_blocks(regions)

        output = self._llm.create_chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0.1,
            max_tokens=1000,
        )

        raw_text = ""
        if isinstance(output, dict):
            choices = output.get("choices", [])
            if choices:
                raw_text = str(choices[0].get("message", {}).get("content", ""))

        translations = _parse_block_translations(raw_text, regions)

        results: list[TranslationTextResult] = []
        for region in regions:
            translated = translations.get(region.id, "")
            results.append(
                TranslationTextResult(
                    id=region.id,
                    source_text=region.text,
                    translated_text=translated,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    ocr_model_key=region.ocr_model_key,
                    translator_model_key=self.key,
                )
            )
        return results
