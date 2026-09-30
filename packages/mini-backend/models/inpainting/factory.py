from __future__ import annotations

from core.device import (
    register_gpu_cache_releaser,
    DeviceInfo,
    build_cpu_device_info,
    get_device_info,
    get_onnx_execution_providers,
)
from core.models_store import model_is_installed
from models.engine_cache import LruEngineCache
from models.inpainting.aot import AOTInpainter
from models.inpainting.base_inpainter import BaseInpainter
from models.inpainting.lama import LaMaInpainter
from models.inpainting.registry import AUTO_PREFERENCE, INPAINT_MODEL_SPECS, InpaintModelSpec
from models.inpainting.storage import inpainting_runtime_ready, resolve_inpainting_model_path

_CPU_PROVIDERS: tuple[str, ...] = ("CPUExecutionProvider",)
type CacheKey = tuple[str, tuple[str, ...]]
_cache: LruEngineCache[CacheKey, BaseInpainter] = LruEngineCache(4)


class NoInpaintModelAvailableError(FileNotFoundError):
    """No installed inpainting model has its weights present on disk."""


def _is_available(spec: InpaintModelSpec) -> bool:
    return model_is_installed(spec.key) and inpainting_runtime_ready(spec.key)


def list_inpainting_models(has_gpu: bool) -> list[dict[str, str | bool]]:
    del has_gpu  # every registered model runs on CPU; GPU only changes the ONNX provider.
    return [
        {
            "key": spec.key,
            "name": spec.name,
            "device": spec.device,
            "use_case": spec.use_case,
            "quality": spec.quality,
            "implemented": True,
            "available": _is_available(spec),
        }
        for spec in INPAINT_MODEL_SPECS.values()
    ]


def _resolve_model_key(requested: str | None) -> str:
    available = [key for key, spec in INPAINT_MODEL_SPECS.items() if _is_available(spec)]
    if not available:
        raise NoInpaintModelAvailableError(
            "No installed inpainting model is available. Install a model in the Model Manager."
        )
    normalized = (requested or "auto").strip().lower()
    if normalized in available:
        return normalized
    available_set = set(available)
    if normalized in {"", "auto"}:
        for candidate in AUTO_PREFERENCE:
            if candidate in available_set:
                return candidate
    return "aot" if "aot" in available_set else available[0]


def _plain_providers(device: DeviceInfo) -> tuple[str, ...]:
    return tuple(str(p) for p in get_onnx_execution_providers(device))


def _build(spec: InpaintModelSpec, providers: tuple[str, ...]) -> BaseInpainter:
    model_path = resolve_inpainting_model_path(spec.key)
    if model_path is None or not model_path.is_file():
        raise FileNotFoundError(
            f"Inpainting model file for '{spec.key}' was not found in local storage."
        )
    if spec.key == "aot":
        return AOTInpainter(model_path=str(model_path), providers=providers)
    return LaMaInpainter(
        model_path=str(model_path), providers=providers, key=spec.key, name=spec.name
    )


def get_inpainter(
    has_gpu: bool,
    image_complexity: str | None = None,
    model_key: str | None = None,
    device_info: DeviceInfo | None = None,
) -> BaseInpainter:
    del image_complexity  # Kept for call-site compatibility; never influenced the choice.
    device = device_info or get_device_info()
    if not has_gpu and device.has_gpu:
        device = build_cpu_device_info(
            device, fallback_reason="gpu_disabled_for_inpainting_stage"
        )

    spec = INPAINT_MODEL_SPECS[_resolve_model_key(model_key)]
    # cpu_only keys are forced to CPU *before* the cache key: the key must
    # describe what is actually in the cache (the old code cached under the
    # CUDA provider key while building a CPU engine).
    providers: tuple[str, ...] = (
        _CPU_PROVIDERS if spec.cpu_only else _plain_providers(device)
    )
    cache_key: CacheKey = (spec.key, providers)
    return _cache.get_or_build(cache_key, lambda: _build(spec, providers))


@register_gpu_cache_releaser
def clear_inpainter_cache() -> None:
    _cache.clear()


def get_inpainter_cache_size() -> int:
    return len(_cache)
