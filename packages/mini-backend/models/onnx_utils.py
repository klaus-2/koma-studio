"""Validated ONNX image/mask sessions and inference error translation.

Extends the shared-helpers module with declared output ranges (ONNX
``inpainting.output_range`` metadata), stricter input/output validation and
selected-output runs. ``translate_inference_error``/``ONNX_RUNTIME_ERRORS``
keep their historical signatures for the OCR engine consumers.
"""

from __future__ import annotations

import importlib
import logging
import threading
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Protocol, cast

from core.device import OnnxProviderSpec
from core.threads import (
    INTER_OP_THREADS_ENV,
    INTRA_OP_THREADS_ENV,
    env_thread_limit,
)

import numpy as np
import onnxruntime as ort
from numpy.typing import NDArray

from models.errors import (
    GpuOutOfMemoryError,
    IncompatibleModelError,
    InferenceError,
    InvalidModelOutputError,
    ModelNotInstalledError,
)
from models.onnx_graph_cache import (
    apply_graph_cache,
    is_final_graph_cache,
    load_guard_and_purge,
    promote_graph_cache,
)

logger = logging.getLogger(__name__)

type FloatArray = NDArray[np.float32]
type SpatialShape = tuple[int, int]

_ORT_ERROR_NAMES: tuple[str, ...] = (
    "Fail",
    "InvalidArgument",
    "NoSuchFile",
    "NoModel",
    "EngineError",
    "RuntimeException",
    "InvalidProtobuf",
    "ModelLoaded",
    "NotImplemented",
    "InvalidGraph",
    "EPFail",
)

_OOM_MARKERS: tuple[str, ...] = (
    "allocate memory",
    "out of memory",
    "bfc_arena",
    "cuda_error_out_of_memory",
    "cudnn_status_alloc_failed",
)


def _runtime_error_types() -> tuple[type[Exception], ...]:
    module = importlib.import_module(
        "onnxruntime.capi.onnxruntime_pybind11_state"
    )
    errors: list[type[Exception]] = []

    for name in _ORT_ERROR_NAMES:
        candidate: object = getattr(module, name, None)
        if isinstance(candidate, type) and issubclass(candidate, Exception):
            errors.append(cast(type[Exception], candidate))

    return tuple(errors)


ONNX_RUNTIME_ERRORS: tuple[type[Exception], ...] = _runtime_error_types()


class OutputRange(StrEnum):
    ZERO_ONE = "zero_one"
    MINUS_ONE_ONE = "minus_one_one"
    ZERO_255 = "zero_255"


class OnnxInputLike(Protocol):
    @property
    def name(self) -> str: ...

    @property
    def shape(self) -> Sequence[int | str | None]: ...


class OnnxTensorMetadata(OnnxInputLike, Protocol):
    @property
    def type(self) -> str: ...


class OnnxModelMetadata(Protocol):
    @property
    def custom_metadata_map(self) -> Mapping[str, str]: ...


class OnnxSession(Protocol):
    def get_inputs(self) -> Sequence[OnnxTensorMetadata]: ...

    def get_outputs(self) -> Sequence[OnnxTensorMetadata]: ...

    def get_modelmeta(self) -> OnnxModelMetadata: ...

    def run(
        self,
        output_names: Sequence[str] | None,
        input_feed: Mapping[str, FloatArray],
    ) -> Sequence[object]: ...


def is_out_of_memory_error(exc: BaseException) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _OOM_MARKERS)


def translate_inference_error(
    exc: Exception,
    *,
    model_key: str,
) -> InferenceError:
    if is_out_of_memory_error(exc):
        return GpuOutOfMemoryError(
            f"{model_key}: memory allocation failed during inference"
        )
    return InferenceError(f"{model_key}: ONNX inference failed")


def _channels_of(shape: Sequence[int | str | None]) -> int | None:
    if len(shape) != 4:
        return None
    channels = shape[1]
    return channels if isinstance(channels, int) else None


def resolve_image_and_mask_inputs(
    inputs: Sequence[OnnxInputLike],
) -> tuple[str, str]:
    if len(inputs) != 2:
        raise IncompatibleModelError(
            "Inpainting requires exactly two NCHW inputs"
        )

    names = [meta.name for meta in inputs]
    if len(set(names)) != 2 or any(not name for name in names):
        raise IncompatibleModelError("ONNX input names must be distinct")

    def role(meta: OnnxInputLike) -> str | None:
        lowered = meta.name.lower()
        named_role: str | None = None

        if "mask" in lowered:
            named_role = "mask"
        elif "image" in lowered or "img" in lowered:
            named_role = "image"

        channels = _channels_of(meta.shape)
        channel_role = (
            {1: "mask", 3: "image"}.get(channels) if channels is not None else None
        )

        if (
            named_role is not None
            and channel_role is not None
            and named_role != channel_role
        ):
            raise IncompatibleModelError(
                "ONNX input name conflicts with its channel count"
            )

        return named_role or channel_role

    first_role, second_role = role(inputs[0]), role(inputs[1])

    if first_role == "image" and second_role in {"mask", None}:
        return names[0], names[1]
    if first_role == "mask" and second_role in {"image", None}:
        return names[1], names[0]
    if first_role is None and second_role == "mask":
        return names[0], names[1]
    if first_role is None and second_role == "image":
        return names[1], names[0]

    raise IncompatibleModelError(
        "Cannot unambiguously identify image and mask inputs"
    )


def fixed_spatial_shape(
    inputs: Sequence[OnnxInputLike],
    input_name: str,
) -> SpatialShape | None:
    for meta in inputs:
        if meta.name != input_name:
            continue

        if len(meta.shape) != 4:
            raise IncompatibleModelError("Expected a rank-four NCHW input")

        height, width = meta.shape[2], meta.shape[3]
        height_fixed = isinstance(height, int)
        width_fixed = isinstance(width, int)

        if height_fixed != width_fixed:
            raise IncompatibleModelError(
                "Partially fixed spatial dimensions are unsupported"
            )

        if isinstance(height, int) and isinstance(width, int):
            if height <= 0 or width <= 0:
                raise IncompatibleModelError(
                    "Fixed spatial dimensions must be positive"
                )
            return height, width

        return None

    raise IncompatibleModelError("Requested ONNX input does not exist")


def chw_output_to_hwc(output: FloatArray) -> FloatArray:
    if output.dtype != np.float32:
        raise InvalidModelOutputError("Model output must be float32")

    if output.ndim == 4:
        if output.shape[0] != 1 or output.shape[1] != 3:
            raise InvalidModelOutputError(
                f"Expected output (1, 3, H, W); got {output.shape}"
            )
        result = output[0].transpose(1, 2, 0)
    elif output.ndim == 3:
        is_chw = output.shape[0] == 3
        is_hwc = output.shape[2] == 3

        if is_chw == is_hwc:
            raise InvalidModelOutputError(
                f"Ambiguous or invalid output layout: {output.shape}"
            )

        result = output.transpose(1, 2, 0) if is_chw else output
    else:
        raise InvalidModelOutputError(
            f"Unsupported model output shape: {output.shape}"
        )

    if result.shape[0] == 0 or result.shape[1] == 0:
        raise InvalidModelOutputError("Model output has empty dimensions")
    if not np.isfinite(result).all():
        raise InvalidModelOutputError("Model output contains NaN or infinity")

    return np.ascontiguousarray(result)


def output_to_u8(output: FloatArray, output_range: OutputRange) -> NDArray[np.uint8]:
    if output.size == 0 or not np.isfinite(output).all():
        raise InvalidModelOutputError("Model output is empty or non-finite")

    scaled = output.copy()
    if output_range is OutputRange.ZERO_ONE:
        np.clip(scaled, 0.0, 1.0, out=scaled)
        scaled *= np.float32(255.0)
    elif output_range is OutputRange.MINUS_ONE_ONE:
        np.clip(scaled, -1.0, 1.0, out=scaled)
        scaled += np.float32(1.0)
        scaled *= np.float32(127.5)
    else:
        np.clip(scaled, 0.0, 255.0, out=scaled)

    np.rint(scaled, out=scaled)
    return scaled.astype(np.uint8)


def _validate_input_metadata(
    meta: OnnxTensorMetadata,
    *,
    expected_channels: int,
) -> None:
    if meta.type != "tensor(float)" or len(meta.shape) != 4:
        raise IncompatibleModelError("Inputs must be float32 NCHW tensors")

    batch, channels = meta.shape[:2]
    if isinstance(batch, int) and batch != 1:
        raise IncompatibleModelError("Only batch size one is supported")
    if isinstance(channels, int) and channels != expected_channels:
        raise IncompatibleModelError("Unexpected ONNX input channel count")


@dataclass(frozen=True, slots=True)
class LoadedImageMaskModel:
    session: OnnxSession
    image_input: str
    mask_input: str
    fixed_hw: SpatialShape | None
    output_name: str
    output_range: OutputRange


_TENSORRT_PROVIDER = "TensorrtExecutionProvider"


def _provider_name(spec: OnnxProviderSpec) -> str:
    return spec if isinstance(spec, str) else spec[0]


_DENORMAL_AS_ZERO_CONFIG_KEY = "session.set_denormal_as_zero"


def build_default_session_options() -> ort.SessionOptions:
    """Fresh SessionOptions with env-configured thread limits.

    ``MINI_BACKEND_INTRA_OP_THREADS`` / ``MINI_BACKEND_INTER_OP_THREADS``
    are read at call time; absent, malformed, or non-positive values leave
    ORT's defaults untouched. A new instance is returned per call, so every
    session creation is independent.
    """
    options = ort.SessionOptions()
    options.add_session_config_entry(_DENORMAL_AS_ZERO_CONFIG_KEY, "1")
    intra = env_thread_limit(INTRA_OP_THREADS_ENV)
    if intra is not None:
        options.intra_op_num_threads = intra
    inter = env_thread_limit(INTER_OP_THREADS_ENV)
    if inter is not None:
        options.inter_op_num_threads = inter
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return options


_CPU_PROVIDER = "CPUExecutionProvider"


def _unavailable_providers(
    requested: Sequence[OnnxProviderSpec], session: object
) -> list[str] | None:
    get_providers = getattr(session, "get_providers", None)
    if not callable(get_providers):
        return None
    active = {str(name) for name in get_providers()}
    return [
        name
        for name in (_provider_name(spec) for spec in requested)
        if name != _CPU_PROVIDER and name not in active
    ]


def _settle_graph_cache(
    graph_cache_file: Path | None,
    requested: Sequence[OnnxProviderSpec],
    session: object,
) -> None:
    if graph_cache_file is None or is_final_graph_cache(graph_cache_file):
        return
    if _unavailable_providers(requested, session):
        load_guard_and_purge(graph_cache_file)
        return
    promote_graph_cache(graph_cache_file)


def _log_session_created(
    model_path: str,
    load_path: str,
    requested: Sequence[OnnxProviderSpec],
    session: object,
) -> None:
    missing = _unavailable_providers(requested, session)
    if missing is None:
        return
    get_providers = getattr(session, "get_providers")
    payload = {
        "model_path": model_path,
        "graph_cache_hit": load_path != model_path,
        "requested_providers": [_provider_name(spec) for spec in requested],
        "active_providers": [str(name) for name in get_providers()],
    }
    logger.info("onnx.session_created", extra=payload)
    if missing:
        logger.warning(
            "onnx.session_provider_unavailable",
            extra={**payload, "unavailable_providers": missing},
        )


def create_session_with_trt_fallback(
    model_path: str,
    providers: Sequence[OnnxProviderSpec],
    sess_options: ort.SessionOptions | None = None,
    session_factory: Callable[..., ort.InferenceSession] | None = None,
) -> ort.InferenceSession:
    """Create an ONNX session, degrading TensorRT once on failure.

    The device layer trusts ORT's provider list, so a stock install without
    a usable TensorRT runtime can fail here even though CUDA would work.
    When TensorRT is requested and creation fails, retry exactly once with
    it filtered out; any other failure — or a failed retry — propagates the
    original error. Broad ``Exception`` is deliberate: provider
    unavailability surfaces as errors outside ONNX_RUNTIME_ERRORS too.
    ``session_factory`` lets a caller keep the construction resolved through
    its own patchable ``ort`` name (consumer-module monkeypatch seams).

    When ``sess_options`` is None a default SessionOptions with the
    env-configured thread limits and ``ORT_ENABLE_ALL`` graph optimization
    (``build_default_session_options``) is passed to both the primary
    construction and the degraded retry, so every session-creation site
    inherits CPU thread control without per-site edits. With no explicit
    options, CPU and CUDA loads also get a compiled-graph cache path assigned
    (``apply_graph_cache``); a failed construct with that path retries once
    without it after purging the cache entry, and a second failure raises
    the original error — same doctrine as the TRT degradation below.
    """
    construct = (
        session_factory if session_factory is not None else ort.InferenceSession
    )
    resolved_options = (
        sess_options if sess_options is not None else build_default_session_options()
    )
    model_file = Path(model_path)
    if sess_options is None:
        apply_graph_cache(model_file, providers, resolved_options)
    assigned_cache: str = getattr(resolved_options, "optimized_model_filepath", "")
    graph_cache_file = Path(assigned_cache) if assigned_cache else None
    load_path = model_path
    original_level = getattr(resolved_options, "graph_optimization_level", None)
    if graph_cache_file is not None and is_final_graph_cache(graph_cache_file):
        load_path = str(graph_cache_file)
        resolved_options.optimized_model_filepath = ""
        resolved_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
    try:
        session = construct(
            load_path,
            sess_options=resolved_options,
            providers=list(providers),
        )
        _settle_graph_cache(graph_cache_file, providers, session)
        _log_session_created(model_path, load_path, providers, session)
        return session
    except Exception as exc:
        if graph_cache_file is not None and graph_cache_file.exists():
            load_guard_and_purge(graph_cache_file)
            logger.warning(
                "onnx.graph_cache.load_retried_without_cache",
                extra={
                    "model_path": model_path,
                    "cache_file": str(graph_cache_file),
                    "error": str(exc),
                },
            )
            resolved_options.optimized_model_filepath = ""
            if original_level is not None:
                resolved_options.graph_optimization_level = original_level
            try:
                session = construct(
                    model_path,
                    sess_options=resolved_options,
                    providers=list(providers),
                )
                _log_session_created(model_path, model_path, providers, session)
                return session
            except Exception as retry_exc:
                raise exc from retry_exc
        if _TENSORRT_PROVIDER not in {_provider_name(spec) for spec in providers}:
            raise
        degraded = [
            spec for spec in providers if _provider_name(spec) != _TENSORRT_PROVIDER
        ]
        if not degraded:
            raise
        logger.warning(
            "onnx.session_provider_degraded",
            extra={
                "model_path": model_path,
                "dropped_provider": _TENSORRT_PROVIDER,
                "degraded_providers": degraded,
                "error": str(exc),
            },
        )
        try:
            session = construct(
                model_path,
                sess_options=resolved_options,
                providers=degraded,
            )
            _log_session_created(model_path, model_path, degraded, session)
            return session
        except Exception as retry_exc:
            raise exc from retry_exc


class ImageMaskOnnxModel:
    """Lazily-loaded, thread-safe ONNX session with (image, mask) inputs.

    Loading (including file existence) is deferred to the first
    ``load``/``run`` so that constructing an inpainter inside a request
    handler never blocks the event loop.
    """

    __slots__ = (
        "_default_output_range",
        "_loaded",
        "_lock",
        "_model_key",
        "_path",
        "_providers",
    )

    def __init__(
        self,
        path: Path | str,
        providers: Sequence[OnnxProviderSpec],
        *,
        model_key: str,
        output_range: OutputRange = OutputRange.ZERO_ONE,
    ) -> None:
        if not providers or any(not provider for provider in providers):
            raise ValueError("At least one non-empty ONNX provider is required")

        self._path = Path(path)
        self._providers = tuple(providers)
        self._model_key = model_key
        self._default_output_range = output_range
        self._lock = threading.Lock()
        self._loaded: LoadedImageMaskModel | None = None

    def load(self) -> LoadedImageMaskModel:
        with self._lock:
            if self._loaded is not None:
                return self._loaded

            if not self._path.is_file():
                raise ModelNotInstalledError(
                    f"{self._model_key}: model file is unavailable"
                )

            try:
                session = cast(
                    OnnxSession,
                    create_session_with_trt_fallback(
                        str(self._path),
                        self._providers,
                    ),
                )
            except ONNX_RUNTIME_ERRORS as exc:
                if is_out_of_memory_error(exc):
                    raise GpuOutOfMemoryError(
                        f"{self._model_key}: memory allocation failed while loading"
                    ) from exc
                raise IncompatibleModelError(
                    f"{self._model_key}: failed to load ONNX graph"
                ) from exc

            inputs = session.get_inputs()
            image_input, mask_input = resolve_image_and_mask_inputs(inputs)
            by_name = {meta.name: meta for meta in inputs}

            _validate_input_metadata(
                by_name[image_input],
                expected_channels=3,
            )
            _validate_input_metadata(
                by_name[mask_input],
                expected_channels=1,
            )

            image_hw = fixed_spatial_shape(inputs, image_input)
            mask_hw = fixed_spatial_shape(inputs, mask_input)

            if image_hw is not None and mask_hw is not None and image_hw != mask_hw:
                raise IncompatibleModelError(
                    "Image and mask fixed dimensions do not match"
                )

            metadata = session.get_modelmeta().custom_metadata_map
            output_name = metadata.get("inpainting.output_name")
            outputs = session.get_outputs()

            if output_name is None:
                if len(outputs) != 1:
                    raise IncompatibleModelError(
                        "Multiple outputs require inpainting.output_name metadata"
                    )
                output_name = outputs[0].name

            output_meta = next(
                (meta for meta in outputs if meta.name == output_name),
                None,
            )
            if output_meta is None or output_meta.type != "tensor(float)":
                raise IncompatibleModelError(
                    "Selected model output must be a float32 tensor"
                )

            declared_range = metadata.get(
                "inpainting.output_range",
                self._default_output_range.value,
            )
            try:
                output_range = OutputRange(declared_range)
            except ValueError as exc:
                raise IncompatibleModelError(
                    "Invalid inpainting.output_range metadata"
                ) from exc

            loaded = LoadedImageMaskModel(
                session=session,
                image_input=image_input,
                mask_input=mask_input,
                fixed_hw=image_hw or mask_hw,
                output_name=output_name,
                output_range=output_range,
            )
            self._loaded = loaded

            logger.info(
                "onnx.session_loaded",
                extra={
                    "model_key": self._model_key,
                    "providers": self._providers,
                },
            )
            return loaded

    def run(
        self,
        image_nchw: FloatArray,
        mask_nchw: FloatArray,
        *,
        loaded: LoadedImageMaskModel | None = None,
    ) -> FloatArray:
        active = loaded if loaded is not None else self.load()

        if (
            image_nchw.dtype != np.float32
            or mask_nchw.dtype != np.float32
            or image_nchw.ndim != 4
            or mask_nchw.ndim != 4
            or image_nchw.shape[:2] != (1, 3)
            or mask_nchw.shape[:2] != (1, 1)
            or image_nchw.shape[2:] != mask_nchw.shape[2:]
            or min(image_nchw.shape[2:]) <= 0
        ):
            raise InferenceError("Invalid image/mask inference tensor contract")

        spatial_shape = (image_nchw.shape[2], image_nchw.shape[3])
        if active.fixed_hw is not None and spatial_shape != active.fixed_hw:
            raise InferenceError("Inference dimensions do not match the ONNX graph")

        try:
            outputs = active.session.run(
                [active.output_name],
                {
                    active.image_input: np.ascontiguousarray(image_nchw),
                    active.mask_input: np.ascontiguousarray(mask_nchw),
                },
            )
        except ONNX_RUNTIME_ERRORS as exc:
            raise translate_inference_error(
                exc,
                model_key=self._model_key,
            ) from exc

        if len(outputs) != 1:
            raise InvalidModelOutputError(
                f"{self._model_key}: expected one selected output"
            )

        raw = outputs[0]
        if not isinstance(raw, np.ndarray):
            raise InvalidModelOutputError(
                f"{self._model_key}: output is not a NumPy tensor"
            )

        output = chw_output_to_hwc(cast(FloatArray, raw))
        if output.shape[:2] != spatial_shape:
            raise InvalidModelOutputError(
                f"{self._model_key}: output spatial dimensions changed"
            )
        return output

    def release(self) -> None:
        """Drop this owner's session reference without invalidating active snapshots."""
        with self._lock:
            previous = self._loaded
            self._loaded = None
        del previous
