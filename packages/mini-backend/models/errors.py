"""Domain exception hierarchy for model management and inference.

``ModelError`` inherits from ``RuntimeError`` deliberately: HTTP boundaries
that still catch ``RuntimeError`` keep working while they migrate to
``except ModelError``.
"""

from __future__ import annotations


class ModelError(RuntimeError):
    """Base class for every model-related failure."""


class ModelConfigurationError(ModelError):
    """Managed models root or model directory is not configured."""


class ModelNotInstalledError(ModelError):
    """Model files are missing from local storage."""


class InvalidModelSelectionError(ModelError):
    """Requested model key does not exist or cannot serve the request."""


class MissingDependencyError(ModelError):
    """An optional runtime dependency (torch, transformers, easyocr) is absent."""


class IncompatibleModelError(ModelError):
    """Model file exists but does not match the expected graph contract."""


class InferenceError(ModelError):
    """Inference failed for a reason unrelated to memory pressure."""


class GpuOutOfMemoryError(InferenceError):
    """Device ran out of memory; callers may retry on CPU."""

    def __init__(self, message: str) -> None:
        # Keep the historic substring so message-based OOM fallbacks at HTTP
        # boundaries keep matching during the migration to typed errors.
        if "out of memory" not in message.lower():
            message = f"{message} (out of memory)"
        super().__init__(message)


class InvalidModelOutputError(InferenceError):
    """Model produced an output with unexpected shape or content."""


class InvalidInputImageError(ModelError):
    """Caller supplied bytes that do not decode to an image."""
