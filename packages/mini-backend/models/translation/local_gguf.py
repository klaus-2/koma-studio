"""Local GGUF translation via llama-cpp-python."""

from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import Protocol, cast

from core.languages import get_language_label
from core.threads import INTRA_OP_THREADS_ENV, env_thread_limit
from models.translation.base_translator import (
    TranslationInputRegion,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.chunking import estimate_tokens, split_regions_by_token_budget
from models.translation.errors import LocalModelError, UnsupportedLanguagePairError
from models.translation.gguf_manifests import (
    GGUFModelConfig,
    load_custom_gguf_configs,
)
from models.translation.json_types import JsonValue
from models.translation.llama_server import (
    GGUF_BACKEND_ENV,
    LLAMA_SERVER_URL_ENV,
    LlamaServerChatModel,
    resolve_llama_server_binary,
)
from models.translation.local_base import LocalTranslatorBase

logger = logging.getLogger(__name__)

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
        config = GGUF_MODEL_CONFIGS.get(model_key) or load_custom_gguf_configs().get(
            model_key
        )
        if config is None:
            raise LocalModelError(f"Unknown GGUF model: {model_key}")
        super().__init__(key=model_key, model_dir=model_dir)
        self.key = model_key
        self.name = config.name or model_key.replace("_", " ").title()
        self._config = config
        self._llm: _ChatModel | None = None

    def _validate_language_pair(self, request: TranslationRequest) -> None:
        source = request.source_language.lower()
        target = request.target_language.lower()
        if source not in self._config.source_languages or target not in self._config.target_languages:
            raise UnsupportedLanguagePairError(
                self.key, request.source_language, request.target_language
            )

    def _build_llama_cpp(
        self, gguf_path: Path, n_threads: int | None
    ) -> _ChatModel:
        from llama_cpp import Llama  # pyright: ignore[reportMissingImports]

        if n_threads is not None:
            return cast(
                _ChatModel,
                Llama(
                    model_path=str(gguf_path),
                    n_ctx=self._config.n_ctx,
                    n_gpu_layers=self._config.n_gpu_layers,
                    n_threads=n_threads,
                    verbose=False,
                ),
            )
        return cast(
            _ChatModel,
            Llama(
                model_path=str(gguf_path),
                n_ctx=self._config.n_ctx,
                n_gpu_layers=self._config.n_gpu_layers,
                verbose=False,
            ),
        )

    def _build_llama_server(
        self, gguf_path: Path, n_threads: int | None
    ) -> _ChatModel:
        binary_path = resolve_llama_server_binary()
        if binary_path is None:
            raise LocalModelError(
                "llama-server binary is not installed and KOMA_LLAMA_SERVER_URL is not set."
            )
        if not gguf_path.is_file():
            raise LocalModelError(f"GGUF model not found: {gguf_path}")
        return LlamaServerChatModel(
            binary_path=binary_path,
            model_path=gguf_path,
            n_ctx=self._config.n_ctx,
            n_gpu_layers=self._config.n_gpu_layers,
            n_threads=n_threads,
        )

    def _ensure_runtime(self) -> None:
        if self._llm is not None:
            return
        backend = os.getenv(GGUF_BACKEND_ENV, "").strip().lower()
        external_url = os.getenv(LLAMA_SERVER_URL_ENV, "").strip()
        n_threads = env_thread_limit(INTRA_OP_THREADS_ENV)
        gguf_path = self.model_dir / self._config.gguf_file

        if backend and backend not in {"auto", "llama-server", "llama_cpp"}:
            raise LocalModelError(f"Unsupported {GGUF_BACKEND_ENV}: {backend!r}")

        if backend != "llama_cpp" and external_url:
            logger.info(
                "translation.gguf.loading",
                extra={"translator": self.key, "backend": "llama-server-url"},
            )
            self._llm = LlamaServerChatModel(base_url=external_url)
            return

        if backend == "llama-server":
            logger.info(
                "translation.gguf.loading",
                extra={"translator": self.key, "path": str(gguf_path), "backend": "llama-server"},
            )
            self._llm = self._build_llama_server(gguf_path, n_threads)
            return

        try:
            import llama_cpp  # noqa: F401  # pyright: ignore[reportMissingImports]
        except ImportError as exc:
            if backend == "llama_cpp" or resolve_llama_server_binary() is None:
                raise LocalModelError("llama-cpp-python is not installed.") from exc
            logger.info(
                "translation.gguf.loading",
                extra={"translator": self.key, "path": str(gguf_path), "backend": "llama-server"},
            )
            self._llm = self._build_llama_server(gguf_path, n_threads)
            return

        if not gguf_path.is_file():
            raise LocalModelError(f"GGUF model not found: {gguf_path}")

        logger.info("translation.gguf.loading", extra={"translator": self.key, "path": str(gguf_path)})
        self._llm = self._build_llama_cpp(gguf_path, n_threads)

    def close(self) -> None:
        with self._inference_lock:
            llm = self._llm
            self._llm = None
        if llm is None:
            return
        close_fn = getattr(llm, "close", None)
        if callable(close_fn):
            close_fn()

    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]:
        if self._llm is None:
            raise LocalModelError(f"{self.key} runtime is not loaded.")
        non_empty = tuple(region for region in request.regions if region.text.strip())
        if not non_empty:
            return [self._result(region, "") for region in request.regions]
        system_prompt = _SYSTEM_PROMPT.format(
            source_language=get_language_label(request.source_language),
            target_language=get_language_label(request.target_language),
        )
        output_budget = min(_MAX_TOKENS, max(128, self._config.n_ctx // 2))
        chunks = split_regions_by_token_budget(
            non_empty,
            context_window=self._config.n_ctx,
            max_output_tokens=output_budget,
            system_tokens=estimate_tokens(system_prompt),
            safety_margin=64,
            region_text_fn=lambda region: f'<block id="{region.id}">{region.text.strip()}</block>',
        )
        translations: dict[str, str] = {}
        for chunk in chunks:
            output = self._llm.create_chat_completion(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": _format_blocks(chunk.regions)},
                ],
                temperature=_TEMPERATURE,
                max_tokens=output_budget,
            )
            translations.update(
                _parse_block_translations(_completion_text(output), chunk.regions)
            )
        return [self._result(region, translations.get(region.id, "")) for region in request.regions]
