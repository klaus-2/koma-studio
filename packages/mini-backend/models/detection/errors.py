from __future__ import annotations

from pathlib import Path


class DetectionError(RuntimeError):
    """Root of every error raised by ``models.detection``.

    Extends ``RuntimeError``: routers historically caught ``RuntimeError``
    around detection calls, and the typed hierarchy keeps that contract.
    """


class DetectionModelNotInstalledError(DetectionError):
    def __init__(self, model_key: str) -> None:
        self.model_key = model_key
        super().__init__(
            f"Detection model {model_key!r} is not installed. "
            "Install it in the Model Manager before continuing."
        )


class DetectionModelCorruptedError(DetectionError):
    def __init__(self, model_key: str, model_path: Path, detail: str) -> None:
        self.model_key = model_key
        self.model_path = model_path
        super().__init__(
            f"Detection model {model_key!r} at {model_path} is invalid or corrupted. "
            f"Uninstall and reinstall it in the Model Manager. Detail: {detail}"
        )


class DetectionRuntimeError(DetectionError):
    def __init__(self, model_key: str, detail: str) -> None:
        self.model_key = model_key
        super().__init__(f"onnxruntime failed to open a session for {model_key!r}: {detail}")
