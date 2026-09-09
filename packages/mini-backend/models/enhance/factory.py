from __future__ import annotations

from typing import Any

from core.device import DeviceInfo, build_cpu_device_info, get_device_info, get_onnx_execution_providers
from core.models_store import model_is_installed

from .base_engine import BaseEnhancer
from .engine import OnnxImageEnhancer
from .storage import (
    enhance_runtime_ready,
    get_enhance_model_spec,
    list_enhance_model_specs,
    resolve_enhance_model_path,
)


_ENHANCER_CACHE: dict[tuple[str, str], BaseEnhancer] = {}


def list_enhancement_models(has_gpu: bool) -> list[dict[str, Any]]:
    _ = has_gpu
    options: list[dict[str, Any]] = []
    for item in list_enhance_model_specs():
        key = str(item["key"])
        options.append({
            "key": key,
            "name": item["name"],
            "scale": item["scale"],
            "profile": item["profile"],
            "runtime_family": item["runtime_family"],
            "install_strategy": item["install_strategy"],
            "recommended": bool(item.get("recommended", False)),
            "available": bool(model_is_installed(key) and enhance_runtime_ready(key)),
        })
    return options


def _resolve_model_key(model_key: str | None) -> str:
    requested = (model_key or "waifu2x_swin_unet_art_scan_2x").strip().lower()
    spec = get_enhance_model_spec(requested)
    if spec["install_strategy"] == "manual_import" and not model_is_installed(requested):
        raise FileNotFoundError(
            f"Model '{requested}' has not been imported yet. Import a local ONNX file before using it.",
        )
    if not model_is_installed(requested) or not enhance_runtime_ready(requested):
        raise FileNotFoundError(
            f"Enhance model '{requested}' is not installed. Install it in the Model Manager before continuing.",
        )
    return requested


def get_enhancer(
    has_gpu: bool,
    model_key: str | None = None,
    device_info: DeviceInfo | None = None,
) -> BaseEnhancer:
    device = device_info or get_device_info()
    if not has_gpu and device.has_gpu:
        device = build_cpu_device_info(device, fallback_reason="gpu_disabled_for_enhance_stage")
    selected_key = _resolve_model_key(model_key)
    provider_key = device.onnx_provider or ("CUDAExecutionProvider" if device.has_gpu else "CPUExecutionProvider")
    cache_key = (selected_key, provider_key)
    cached = _ENHANCER_CACHE.get(cache_key)
    if cached is not None:
        return cached

    model_path = resolve_enhance_model_path(selected_key)
    if model_path is None or not model_path.exists():
        raise FileNotFoundError(f"ONNX file for model '{selected_key}' was not found.")

    spec = get_enhance_model_spec(selected_key)
    enhancer = OnnxImageEnhancer(
        key=selected_key,
        model_path=model_path,
        scale=int(spec["scale"]),
        providers=get_onnx_execution_providers(device),
    )
    _ENHANCER_CACHE[cache_key] = enhancer
    return enhancer
