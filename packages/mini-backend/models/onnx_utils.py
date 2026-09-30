"""Shared ONNX Runtime helpers: lazy image/mask sessions, input resolution, error translation.

Merges the two prior copies of this logic (detection ``onnx_io``-style helpers
and the inpainting ``_resolve_onnx_inputs`` duplicates) into one module.
"""

from __future__ import annotations

import gc
import logging
import threading
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import numpy as np
import onnxruntime as ort
from numpy.typing import NDArray
from onnxruntime.capi import onnxruntime_pybind11_state as ort_errors  # pyright: ignore[reportAttributeAccessIssue]

from models.errors import (
    GpuOutOfMemoryError,
    IncompatibleModelError,
    InferenceError,
    InvalidModelOutputError,
    ModelNotInstalledError,
)

logger = logging.getLogger(__name__)

ONNX_RUNTIME_ERRORS: tuple[type[Exception], ...] = (
    ort_errors.Fail,
    ort_errors.InvalidArgument,
    ort_errors.NoSuchFile,
    ort_errors.NoModel,
    ort_errors.EngineError,
    ort_errors.RuntimeException,
    ort_errors.InvalidProtobuf,
    ort_errors.ModelLoaded,
    ort_errors.NotImplemented,
    ort_errors.InvalidGraph,
    ort_errors.EPFail,
)

_OOM_MARKERS: tuple[str, ...] = (
    "allocate memory",
    "out of memory",
    "bfc_arena",
    "cuda_error_out_of_memory",
    "cudnn_status_alloc_failed",
)


class OnnxInputLike(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def shape(self) -> Sequence[int | str | None]: ...


def is_out_of_memory_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _OOM_MARKERS)


def translate_inference_error(exc: Exception, *, model_key: str) -> InferenceError:
    """Map a backend exception onto the domain hierarchy.

    Forces a GC pass on OOM so freed buffers are actually returned before the
    caller retries on CPU.
    """
    if is_out_of_memory_error(exc):
        gc.collect()
        return GpuOutOfMemoryError(f"{model_key}: out of memory during inference: {exc}")
    return InferenceError(f"{model_key}: inference failed: {exc}")


def _channels_of(shape: Sequence[int | str | None]) -> int | None:
    if len(shape) < 2:
        return None
    channels = shape[1]
    return channels if isinstance(channels, int) else None


def resolve_image_and_mask_inputs(inputs: Sequence[OnnxInputLike]) -> tuple[str, str]:
    """Identify (image, mask) input names by name, then by channel count, then by position."""
    if len(inputs) < 2:
        raise IncompatibleModelError("Inpainting model must expose two inputs (image, mask)")

    image_name: str | None = None
    mask_name: str | None = None
    for meta in inputs:
        lowered = meta.name.lower()
        if "mask" in lowered:
            mask_name = mask_name or meta.name
        elif "image" in lowered or "img" in lowered:
            image_name = image_name or meta.name

    if image_name is None or mask_name is None:
        for meta in inputs:
            channels = _channels_of(meta.shape)
            if channels == 1 and mask_name is None:
                mask_name = meta.name
            elif channels == 3 and image_name is None:
                image_name = meta.name

    if image_name is None:
        image_name = inputs[0].name
    if mask_name is None:
        mask_name = next(meta.name for meta in inputs if meta.name != image_name)
    return image_name, mask_name


def fixed_spatial_shape(inputs: Sequence[OnnxInputLike], input_name: str) -> tuple[int, int] | None:
    """Return static ``(H, W)`` of an NCHW input, or ``None`` when dynamic."""
    for meta in inputs:
        if meta.name != input_name:
            continue
        shape = meta.shape
        if len(shape) >= 4 and isinstance(shape[2], int) and isinstance(shape[3], int):
            return (shape[2], shape[3])
        return None
    return None


def chw_output_to_hwc(output: NDArray[np.float32]) -> NDArray[np.float32]:
    if output.ndim == 4:
        return output[0].transpose(1, 2, 0)
    if output.ndim == 3 and output.shape[0] == 3:
        return output.transpose(1, 2, 0)
    if output.ndim == 3 and output.shape[2] == 3:
        return output
    raise InvalidModelOutputError(f"Unsupported model output shape {output.shape}")


@dataclass(frozen=True, slots=True)
class LoadedImageMaskModel:
    session: ort.InferenceSession
    image_input: str
    mask_input: str
    fixed_hw: tuple[int, int] | None


class ImageMaskOnnxModel:
    """Lazily-loaded, thread-safe ONNX session with (image, mask) inputs.

    Loading is deferred to the first ``run``/``load`` so that constructing an
    inpainter inside a request handler never blocks the event loop.
    """

    __slots__ = ("_loaded", "_lock", "_model_key", "_path", "_providers")

    def __init__(self, path: Path | str, providers: Sequence[str], *, model_key: str) -> None:
        path = Path(path)
        if not path.is_file():
            raise ModelNotInstalledError(f"{model_key}: model file not found at {path}")
        self._path = path
        self._providers = tuple(providers)
        self._model_key = model_key
        self._lock = threading.Lock()
        self._loaded: LoadedImageMaskModel | None = None

    def load(self) -> LoadedImageMaskModel:
        loaded = self._loaded
        if loaded is not None:
            return loaded
        with self._lock:
            if self._loaded is None:
                logger.info(
                    "onnx session loading",
                    extra={"model_key": self._model_key, "providers": list(self._providers)},
                )
                try:
                    session = ort.InferenceSession(str(self._path), providers=list(self._providers))
                except ONNX_RUNTIME_ERRORS as exc:
                    raise IncompatibleModelError(
                        f"{self._model_key}: failed to load ONNX graph: {exc}"
                    ) from exc
                inputs = session.get_inputs()
                image_input, mask_input = resolve_image_and_mask_inputs(inputs)
                self._loaded = LoadedImageMaskModel(
                    session=session,
                    image_input=image_input,
                    mask_input=mask_input,
                    fixed_hw=fixed_spatial_shape(inputs, image_input),
                )
            return self._loaded

    def run(
        self, image_nchw: NDArray[np.float32], mask_nchw: NDArray[np.float32]
    ) -> NDArray[np.float32]:
        loaded = self.load()
        try:
            outputs = loaded.session.run(
                None,
                {loaded.image_input: image_nchw, loaded.mask_input: mask_nchw},
            )
        except ONNX_RUNTIME_ERRORS as exc:
            raise translate_inference_error(exc, model_key=self._model_key) from exc
        if not outputs:
            raise InvalidModelOutputError(f"{self._model_key}: model returned no output")
        return chw_output_to_hwc(np.asarray(outputs[0], dtype=np.float32))

    def release(self) -> None:
        with self._lock:
            self._loaded = None
        gc.collect()
