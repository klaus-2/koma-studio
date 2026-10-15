from __future__ import annotations

import logging
from pathlib import Path
from typing import TypedDict

from core.device import (
    DeviceInfo,
    build_cpu_device_info,
    get_device_info,
    register_gpu_cache_releaser,
    get_provider_specs,
    OnnxProviderSpec,
)
from core.models_store import model_is_installed
from models.engine_cache import LruEngineCache
from models.inpainting.aot import AOTInpainter
from models.inpainting.base_inpainter import BaseInpainter
from models.inpainting.lama import LaMaInpainter
from models.inpainting.registry import (
    AUTO_PREFERENCE,
    INPAINT_MODEL_SPECS,
    InpaintModelSpec,
)
from models.inpainting.storage import (
    inpainting_runtime_ready,
    resolve_inpainting_model_path,
)

logger = logging.getLogger(__name__)

_CPU_PROVIDERS: tuple[str, ...] = ("CPUExecutionProvider",)

type CacheKey = tuple[
    str, tuple[OnnxProviderSpec, ...], Path, int, int, int, int
]

_cache: LruEngineCache[CacheKey, BaseInpainter] = LruEngineCache(4)


class InpaintingModelOption(TypedDict):
    key: str
    name: str
    device: str
    use_case: str
    quality: str
    implemented: bool
    available: bool


class NoInpaintModelAvailableError(FileNotFoundError):
    """No installed inpainting model has an available runtime payload."""


def _is_available(spec: InpaintModelSpec) -> bool:
    return model_is_installed(spec.key) and inpainting_runtime_ready(spec.key)


def list_inpainting_models(has_gpu: bool) -> list[InpaintingModelOption]:
    del has_gpu
    return [
        InpaintingModelOption(
            key=spec.key,
            name=spec.name,
            device=spec.device,
            use_case=spec.use_case,
            quality=spec.quality,
            implemented=True,
            available=_is_available(spec),
        )
        for spec in INPAINT_MODEL_SPECS.values()
    ]


def _resolve_model_key(requested: str | None) -> str:
    available = {
        key
        for key, spec in INPAINT_MODEL_SPECS.items()
        if _is_available(spec)
    }
    if not available:
        raise NoInpaintModelAvailableError(
            "No installed inpainting model is available"
        )

    normalized = (requested or "auto").strip().lower() or "auto"
    if normalized in available:
        return normalized

    selected = next(
        (candidate for candidate in AUTO_PREFERENCE if candidate in available),
        min(available),
    )
    if normalized != "auto":
        logger.warning(
            "inpainting.model_fallback",
            extra={
                "selected_model": selected,
                "fallback_reason": (
                    "not_installed"
                    if normalized in INPAINT_MODEL_SPECS
                    else "unknown_model"
                ),
            },
        )
    return selected


def _plain_providers(
    device: DeviceInfo,
) -> tuple[OnnxProviderSpec, ...]:
    # Includes the (CUDAExecutionProvider, options) tuple form on the
    # CUDA-legacy profile — pass it straight to ORT, never stringify.
    return get_provider_specs(device)


def _build(
    spec: InpaintModelSpec,
    model_path: Path,
    providers: tuple[OnnxProviderSpec, ...],
) -> BaseInpainter:
    if spec.key == "aot":
        return AOTInpainter(model_path=model_path, providers=providers)

    return LaMaInpainter(
        model_path=model_path,
        providers=providers,
        key=spec.key,
        name=spec.name,
    )


def get_inpainter(
    has_gpu: bool,
    image_complexity: str | None = None,
    model_key: str | None = None,
    device_info: DeviceInfo | None = None,
) -> BaseInpainter:
    """Synchronous factory; invoke from a worker when called by async code."""
    del image_complexity

    device = device_info if device_info is not None else get_device_info()
    if not has_gpu and device.has_gpu:
        device = build_cpu_device_info(
            device,
            fallback_reason="gpu_disabled_for_inpainting_stage",
        )

    spec = INPAINT_MODEL_SPECS[_resolve_model_key(model_key)]
    providers = _CPU_PROVIDERS if spec.cpu_only else _plain_providers(device)
    model_path = resolve_inpainting_model_path(spec.key)

    if model_path is None:
        raise NoInpaintModelAvailableError(
            f"{spec.key}: model payload is unavailable"
        )

    try:
        resolved_path = model_path.resolve(strict=True)
        if not resolved_path.is_file():
            raise NoInpaintModelAvailableError(
                f"{spec.key}: model payload is not a regular file"
            )
        stat = resolved_path.stat()
    except OSError as exc:
        raise NoInpaintModelAvailableError(
            f"{spec.key}: model payload cannot be accessed"
        ) from exc

    cache_key: CacheKey = (
        spec.key,
        providers,
        resolved_path,
        stat.st_dev,
        stat.st_ino,
        stat.st_mtime_ns,
        stat.st_size,
    )
    return _cache.get_or_build(
        cache_key,
        lambda: _build(spec, resolved_path, providers),
    )


@register_gpu_cache_releaser
def clear_inpainter_cache() -> None:
    _cache.clear()


def get_inpainter_cache_size() -> int:
    return len(_cache)
