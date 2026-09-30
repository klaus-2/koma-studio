import asyncio
import threading
from abc import abstractmethod
from pathlib import Path

from models.translation.base_translator import (
    BaseTranslator,
    TranslationRequest,
    TranslationTextResult,
)
from models.translation.errors import LocalModelError
from models.translation.local_storage import resolve_local_translation_model_dir


def normalize_output_whitespace(text: str) -> str:
    return " ".join(text.replace("\u2581", " ").split())


class LocalTranslatorBase(BaseTranslator):
    """Runs blocking local inference off the event loop.

    One lock per instance: ctranslate2/llama.cpp handles must not be driven
    concurrently from several threads, and the lazy model load must also be
    serialized so two first-callers do not load the weights twice.
    """

    def __init__(self, *, key: str, model_dir: str | Path | None) -> None:
        resolved = (
            Path(model_dir).expanduser().resolve()
            if model_dir
            else resolve_local_translation_model_dir(key)
        )
        if resolved is None:
            raise LocalModelError(f"Managed models directory is not configured for {key}.")
        self.model_dir: Path = resolved
        self._inference_lock = threading.Lock()

    def _validate_language_pair(self, request: TranslationRequest) -> None:
        return None

    @abstractmethod
    def _ensure_runtime(self) -> None: ...

    @abstractmethod
    def _infer(self, request: TranslationRequest) -> list[TranslationTextResult]: ...

    def _translate_blocking(self, request: TranslationRequest) -> list[TranslationTextResult]:
        with self._inference_lock:
            self._ensure_runtime()
            return self._infer(request)

    async def _translate(self, request: TranslationRequest) -> list[TranslationTextResult]:
        if not request.regions:
            return []
        self._validate_language_pair(request)
        return await asyncio.to_thread(self._translate_blocking, request)
