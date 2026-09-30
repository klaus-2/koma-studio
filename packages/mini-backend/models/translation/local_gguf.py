"""Local GGUF translation via llama-cpp-python."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, cast

from core.languages import get_language_label
from models.translation.base_translator import (
    TranslationInputRegion,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.errors import LocalModelError, UnsupportedLanguagePairError
from models.translation.json_types import JsonValue
from models.translation.local_base import LocalTranslatorBase

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class GGUFModelConfig:
    gguf_file: str
    source_languages: frozenset[str]
    target_languages: frozenset[str]
    n_ctx: int = 2048
    n_gpu_layers: int = -1


_JA = frozenset({"ja"})
_EN = frozenset({"en"})
_ZH_CN = frozenset({"zh", "zh-cn"})
_HUNYUAN_LANGUAGES = frozenset(
    "zh zh-cn zh-tw en fr pt pt-br es ja tr ru ar ko th it de vi ms id tl hi pl nl "
    "km my fa gu ur te mr he bn ta uk bo kk mn ug yue cs".split()
)

GGUF_MODEL_CONFIGS: dict[str, GGUFModelConfig] = {
    "vntl_llama3_8b_v2": GGUFModelConfig("vntl-llama3-8b-v2-hf-q8_0.gguf", _JA, _EN),
    "lfm2_350m_enjp_mt": GGUFModelConfig(
        "LFM2-350M-ENJP-MT-Q4_0.gguf", _JA | _EN, _EN | _JA, n_ctx=1024
    ),
    "sakura_galtransl_7b_v3_7": GGUFModelConfig("Sakura-Galtransl-7B-v3.7-IQ4_XS.gguf", _JA, _ZH_CN),
    "sakura_1_5b_qwen2_5_v1_0": GGUFModelConfig("sakura-1.5b-qwen2.5-v1.0-Q5KS.gguf", _JA, _ZH_CN),
    "hunyuan_7b_mt_v1_0": GGUFModelConfig(
        "Hunyuan-MT-7B-q4_k_m.gguf", _HUNYUAN_LANGUAGES, _HUNYUAN_LANGUAGES
    ),
}

_SYSTEM_PROMPT = (
    "You are a professional manga translator. "
    "Translate {source_language} manga dialogue into natural {target_language} "
    "that fits inside speech bubbles. "
    "Preserve character voice, emotional tone, relationship nuance, emphasis, "
    "and sound effects naturally. Keep the wording concise. "
    "Do not add notes, explanations, or romanization. "
    'If the input contains <block id="N">...</block>, translate only the text '
    "inside each block. Keep every block tag exactly unchanged, including ids, "
    "order, and block count. Do not merge blocks, split blocks, or add any text "
    "outside the blocks."
)
_BLOCK_PATTERN = re.compile(r'<block\s+id="([^"]+)">(.*?)</block>', re.DOTALL)
_TEMPERATURE = 0.1
_MAX_TOKENS = 1000


class _ChatModel(Protocol):
    def create_chat_completion(
        self, *, messages: list[dict[str, str]], temperature: float, max_tokens: int
    ) -> JsonValue: ...


def _format_blocks(regions: tuple[TranslationInputRegion, ...]) -> str:
    return "\n".join(
        f'<block id="{region.id}">{region.text.strip()}</block>'
        for region in regions
        if region.text.strip()
    )


def _parse_block_translations(
    raw: str, regions: tuple[TranslationInputRegion, ...]
) -> dict[str, str]:
    results = {match.group(1): match.group(2).strip() for match in _BLOCK_PATTERN.finditer(raw)}
    if results or not regions:
        return results
    # Small models sometimes drop the tags; fall back to one line per region.
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    return {region.id: line for region, line in zip(regions, lines, strict=False)}


def _completion_text(output: JsonValue) -> str:
    if not isinstance(output, dict):
        return ""
    choices = output.get("choices")
    if not isinstance(choices, list) or not choices:
        return ""
    first = choices[0]
    if not isinstance(first, dict):
        return ""
    message = first.get("message")
    if not isinstance(message, dict):
        return ""
    content = message.get("content")
    return content.strip() if isinstance(content, str) else ""


class GGUFLocalTranslator(LocalTranslatorBase):
    def __init__(self, model_key: str, model_dir: str | Path | None = None) -> None:
        config = GGUF_MODEL_CONFIGS.get(model_key)
        if config is None:
            raise LocalModelError(f"Unknown GGUF model: {model_key}")
        super().__init__(key=model_key, model_dir=model_dir)
        self.key = model_key
        self.name = model_key.replace("_", " ").title()
        self._config = config
        self._llm: _ChatModel | None = None

    def _validate_language_pair(self, request: TranslationRequest) -> None:
        source = request.source_language.lower()
        target = request.target_language.lower()
        if source not in self._config.source_languages or target not in self._config.target_languages:
            raise UnsupportedLanguagePairError(
                self.key, request.source_language, request.target_language
            )

    def _ensure_runtime(self) -> None:
        if self._llm is not None:
            return
        try:
            from llama_cpp import Llama  # pyright: ignore[reportMissingImports]
        except ImportError as exc:
            raise LocalModelError("llama-cpp-python is not installed.") from exc

        gguf_path = self.model_dir / self._config.gguf_file
        if not gguf_path.is_file():
            raise LocalModelError(f"GGUF model not found: {gguf_path}")

        logger.info("translation.gguf.loading", extra={"translator": self.key, "path": str(gguf_path)})
        self._llm = cast(
            _ChatModel,
            Llama(
                model_path=str(gguf_path),
                n_ctx=self._config.n_ctx,
                n_gpu_layers=self._config.n_gpu_layers,
                verbose=False,
            ),
        )

    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]:
        if self._llm is None:
            raise LocalModelError(f"{self.key} runtime is not loaded.")
        system_prompt = _SYSTEM_PROMPT.format(
            source_language=get_language_label(request.source_language),
            target_language=get_language_label(request.target_language),
        )
        output = self._llm.create_chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": _format_blocks(request.regions)},
            ],
            temperature=_TEMPERATURE,
            max_tokens=_MAX_TOKENS,
        )
        translations = _parse_block_translations(_completion_text(output), request.regions)
        return [self._result(region, translations.get(region.id, "")) for region in request.regions]
