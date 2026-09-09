from __future__ import annotations

from collections import OrderedDict
from typing import Any

from core.device import (
    DeviceInfo,
    build_cpu_device_info,
    get_device_info,
    get_onnx_execution_providers,
)
from core.models_store import model_is_installed
from models.inpainting.aot import AOTInpainter
from models.inpainting.base_inpainter import BaseInpainter
from models.inpainting.lama import LaMaInpainter
from models.inpainting.storage import (
    inpainting_runtime_ready,
    resolve_inpainting_model_path,
)


INPAINT_MODELS: dict[str, dict[str, Any]] = {
    "aot": {
        "name": "AOT (ONNX)",
        "device": "cpu_gpu",
        "quality": "★★★★ manga-specific",
        "use_case": "Same AOT model used by Baka for text cleaning",
        "implemented": True,
    },
    "lama_manga": {
        "name": "LaMa Manga Dynamic (ONNX)",
        "device": "cpu_gpu",
        "quality": "★★★★ context-aware",
        "use_case": "Same LaMa model used by Baka for contextual inpainting",
        "implemented": True,
    },
    "opencv_lama": {
        "name": "OpenCV LaMa (ONNX)",
        "device": "cpu_gpu",
        "quality": "★★★ lightweight",
        "use_case": "Lightweight LaMa model from the OpenCV Zoo, good for CPU and fast workloads",
        "implemented": True,
    },
    "lama_fp32": {
        "name": "LaMa FP32 512 (ONNX)",
        "device": "cpu_gpu",
        "quality": "★★★★ classic-lama",
        "use_case": "Recommended ONNX port of big-lama at 512x512 for CPU/GPU",
        "implemented": True,
    },
}

_INPAINTER_MAX_SIZE = 4
_INPAINTER_CACHE: OrderedDict[tuple[str, str], BaseInpainter] = OrderedDict()
_CPU_PREFERRED_MODEL_KEYS = {"opencv_lama", "lama_fp32"}


def _evict_inpainter_cache() -> None:
    while len(_INPAINTER_CACHE) > _INPAINTER_MAX_SIZE:
        _INPAINTER_CACHE.popitem(last=False)


def _supports_device(model_device: str, has_gpu: bool) -> bool:
    _ = model_device, has_gpu
    return True


def _path_exists(model_key: str) -> bool:
    return inpainting_runtime_ready(model_key)


def _available_model_keys(has_gpu: bool) -> list[str]:
    available: list[str] = []
    for key, meta in INPAINT_MODELS.items():
        if not _supports_device(str(meta.get("device", "cpu_gpu")), has_gpu):
            continue
        if not bool(meta.get("implemented", False)):
            continue
        if not model_is_installed(key):
            continue
        if not _path_exists(key):
            continue
        available.append(key)
    return available


def list_inpainting_models(has_gpu: bool) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for key, meta in INPAINT_MODELS.items():
        device_supported = _supports_device(str(meta.get("device", "cpu_gpu")), has_gpu)
        implemented = bool(meta.get("implemented", False))
        installed = model_is_installed(key)
        model_present = _path_exists(key)
        options.append(
            {
                "key": key,
                "name": meta.get("name", key),
                "device": meta.get("device", "cpu_gpu"),
                "use_case": meta.get("use_case", ""),
                "quality": meta.get("quality", ""),
                "implemented": implemented,
                "available": bool(
                    device_supported
                    and implemented
                    and installed
                    and model_present
                ),
            }
        )
    return options


def _resolve_model_key(has_gpu: bool, model_key: str | None) -> str:
    available = _available_model_keys(has_gpu=has_gpu)
    if not available:
        raise FileNotFoundError(
            "No installed inpainting model is available. "
            "Install a model in the Model Manager.",
        )

    requested = (model_key or "aot").strip().lower()
    if requested in available:
        return requested
    if requested in {"", "auto"}:
        if "lama_manga" in available:
            return "lama_manga"
        if "lama_fp32" in available:
            return "lama_fp32"
        if "opencv_lama" in available:
            return "opencv_lama"
    if "aot" in available:
        return "aot"
    return available[0]


def get_inpainter(
    has_gpu: bool,
    image_complexity: str | None = None,
    model_key: str | None = None,
    device_info: DeviceInfo | None = None,
) -> BaseInpainter:
    _ = image_complexity  # Compatibilidade com chamadas antigas.
    device = device_info or get_device_info()
    if not has_gpu and device.has_gpu:
        device = build_cpu_device_info(
            device, fallback_reason="gpu_disabled_for_inpainting_stage"
        )
    selected_key = _resolve_model_key(
        has_gpu=device.has_gpu or has_gpu, model_key=model_key
    )
    if not model_is_installed(selected_key):
        raise RuntimeError(
            f"Inpainting model '{selected_key}' is not installed. "
            "Install it in the Model Manager before continuing.",
        )

    provider_key = device.onnx_provider or (
        "CUDAExecutionProvider" if device.has_gpu else "CPUExecutionProvider"
    )
    cache_key = (selected_key, provider_key)
    cached = _INPAINTER_CACHE.get(cache_key)
    if cached is not None:
        _INPAINTER_CACHE.move_to_end(cache_key)
        return cached

    providers = get_onnx_execution_providers(device)
    if selected_key in _CPU_PREFERRED_MODEL_KEYS:
        providers = ["CPUExecutionProvider"]
    model_path_obj = resolve_inpainting_model_path(selected_key)
    if model_path_obj is None or not model_path_obj.exists():
        raise RuntimeError(
            f"Inpainting model file '{selected_key}' was not found in local storage.",
        )
    model_path = str(model_path_obj)
    if selected_key == "aot":
        inpainter = AOTInpainter(model_path=model_path, providers=providers)
    else:
        model_meta = INPAINT_MODELS.get(selected_key, {})
        inpainter = LaMaInpainter(
            model_path=model_path,
            providers=providers,
            key=selected_key,
            name=str(model_meta.get("name", selected_key)),
        )

    _INPAINTER_CACHE[cache_key] = inpainter
    _evict_inpainter_cache()
    return inpainter


def clear_inpainter_cache() -> None:
    _INPAINTER_CACHE.clear()


def get_inpainter_cache_size() -> int:
    return len(_INPAINTER_CACHE)
