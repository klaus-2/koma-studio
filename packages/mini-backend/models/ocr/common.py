"""Shared infrastructure for managed OCR engines: typed errors, geometry,
result building, install payloads and thread-safe lazy runtimes."""

from __future__ import annotations

import threading
from collections.abc import Callable, Iterable, Sequence
from pathlib import Path
from typing import Final, TypedDict

from PIL import Image

from models.ocr.base_ocr import OCRInputRegion, OCRTextResult

type BBox = tuple[int, int, int, int]


class OcrEngineError(RuntimeError):
    """Root of every failure raised by OCR engines and their storage helpers.

    Extends ``RuntimeError``: the HTTP boundary historically maps engine
    configuration failures to 400 via ``except RuntimeError``.
    """


class ModelsRootNotConfiguredError(OcrEngineError):
    def __init__(self, model_id: str) -> None:
        super().__init__(
            f"KOMA_MODELS_ROOT is not configured; cannot resolve managed model '{model_id}'."
        )
        self.model_id = model_id


class UnknownManagedModelError(OcrEngineError):
    def __init__(self, model_id: str) -> None:
        super().__init__(f"'{model_id}' is not a managed OCR model.")
        self.model_id = model_id


class ModelFilesMissingError(OcrEngineError):
    def __init__(self, model_dir: Path, missing: Sequence[str]) -> None:
        super().__init__(f"Missing model files in {model_dir}: {', '.join(missing)}")
        self.model_dir = model_dir
        self.missing = tuple(missing)


class RuntimeDependencyMissingError(OcrEngineError):
    def __init__(self, engine_key: str, dependency: str) -> None:
        super().__init__(f"'{dependency}' is required by OCR engine '{engine_key}' but is not installed.")
        self.engine_key = engine_key
        self.dependency = dependency


class ModelLoadError(OcrEngineError):
    """The model directory exists but the runtime could not instantiate the model."""


class ModelDownloadError(OcrEngineError):
    def __init__(self, target: str, failures: Sequence[str]) -> None:
        super().__init__(f"Failed to download '{target}' from every configured URL: {' | '.join(failures)}")
        self.target = target
        self.failures = tuple(failures)


class ChecksumMismatchError(OcrEngineError):
    def __init__(self, target: str, *, expected: str, actual: str) -> None:
        super().__init__(f"SHA256 mismatch for '{target}': expected {expected}, got {actual}")
        self.target = target
        self.expected = expected
        self.actual = actual


class InstalledFilePayload(TypedDict):
    target: str
    source: str
    sha256: str
    downloaded: bool


class InstallPayload(TypedDict):
    modelId: str
    directory: str
    fileCount: int
    files: list[InstalledFilePayload]
    repo: str


_GENERATION_SPECIAL_TOKENS: Final[tuple[str, ...]] = ("<|im_end|>", "<|endoftext|>")
_DEFAULT_ANSWER_PREFIXES: Final[tuple[str, ...]] = (
    "assistant\n",
    "assistant:",
    "Assistant:",
    "OCR:",
    "Text Recognition:",
)


def clamp_bbox(bbox: BBox, width: int, height: int) -> BBox | None:
    x1, y1, x2, y2 = bbox
    left, right = max(0, min(x1, x2)), min(width, max(x1, x2))
    top, bottom = max(0, min(y1, y2)), min(height, max(y1, y2))
    if right <= left or bottom <= top:
        return None
    return left, top, right, bottom


def crop_region(image: Image.Image, region: OCRInputRegion) -> Image.Image | None:
    """Returns the RGB crop, or None when the region has no area inside the image."""
    width, height = image.size
    clamped = clamp_bbox(region.bbox, width, height)
    if clamped is None:
        return None
    return image.crop(clamped).convert("RGB")


def build_result(
    region: OCRInputRegion,
    *,
    model_key: str,
    text: str = "",
    score: float = 0.0,
) -> OCRTextResult:
    return OCRTextResult.from_region(region, text=text, score=score, model_key=model_key)


def missing_files(model_dir: Path, filenames: Iterable[str]) -> tuple[str, ...]:
    return tuple(name for name in filenames if not (model_dir / name).is_file())


def normalize_generated_text(
    raw_text: str,
    *,
    answer_prefixes: Sequence[str] = _DEFAULT_ANSWER_PREFIXES,
) -> str:
    cleaned = str(raw_text or "")
    for token in _GENERATION_SPECIAL_TOKENS:
        cleaned = cleaned.replace(token, "")
    cleaned = cleaned.strip()
    for prefix in answer_prefixes:
        if cleaned.startswith(prefix):
            cleaned = cleaned.removeprefix(prefix).strip()
    return " ".join(cleaned.split())


class LazyRuntime[T]:
    """Thread-safe, load-once holder for expensive runtime objects (ONNX sessions, torch models)."""

    __slots__ = ("_factory", "_lock", "_value")

    def __init__(self, factory: Callable[[], T]) -> None:
        self._factory = factory
        self._lock = threading.Lock()
        self._value: T | None = None

    @property
    def is_loaded(self) -> bool:
        return self._value is not None

    def get(self) -> T:
        value = self._value
        if value is not None:
            return value
        with self._lock:
            if self._value is None:
                self._value = self._factory()
            return self._value
