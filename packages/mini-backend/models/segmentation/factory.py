from __future__ import annotations

from collections import OrderedDict
from typing import Any

from core.models_store import model_is_installed
from models.segmentation.baka_segmenter import BakaContentSegmenter
from models.segmentation.base_segmenter import BaseSegmenter
from models.segmentation.storage import segmentation_runtime_ready


SEGMENTATION_MODELS: dict[str, dict[str, Any]] = {
    "baka_content_cc": {
        "name": "Baka Content CC",
        "device": "cpu_gpu",
        "use_case": "Baka-style text segmentation (Otsu + connected components)",
        "implemented": True,
    },
    "sam2_text": {
        "name": "SAM2 Text",
        "device": "gpu",
        "use_case": "Advanced semantic segmentation (roadmap)",
        "implemented": False,
    },
}

_SEGMENTER_MAX_SIZE = 2
_SEGMENTER_CACHE: OrderedDict[str, BaseSegmenter] = OrderedDict()


def _evict_segmenter_cache() -> None:
    while len(_SEGMENTER_CACHE) > _SEGMENTER_MAX_SIZE:
        _SEGMENTER_CACHE.popitem(last=False)


def _supports_device(model_device: str, has_gpu: bool) -> bool:
    _ = model_device, has_gpu
    return True


def list_segmentation_models(has_gpu: bool) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for key, meta in SEGMENTATION_MODELS.items():
        device_supported = _supports_device(str(meta.get("device", "cpu_gpu")), has_gpu)
        options.append(
            {
                "key": key,
                "name": meta.get("name", key),
                "device": meta.get("device", "cpu_gpu"),
                "use_case": meta.get("use_case", ""),
                "implemented": bool(meta.get("implemented", False)),
                "available": bool(
                    device_supported
                    and meta.get("implemented", False)
                    and model_is_installed(key)
                    and segmentation_runtime_ready(key)
                ),
            }
        )
    return options


def get_segmenter(
    has_gpu: bool,
    model_key: str | None = None,
) -> BaseSegmenter:
    selected_key = (model_key or "baka_content_cc").strip() or "baka_content_cc"
    meta = SEGMENTATION_MODELS.get(selected_key)
    if meta is None:
        selected_key = "baka_content_cc"
        meta = SEGMENTATION_MODELS[selected_key]

    if not _supports_device(str(meta.get("device", "cpu_gpu")), has_gpu):
        selected_key = "baka_content_cc"
        meta = SEGMENTATION_MODELS[selected_key]

    if not bool(meta.get("implemented", False)):
        selected_key = "baka_content_cc"

    if not model_is_installed(selected_key) or not segmentation_runtime_ready(
        selected_key
    ):
        raise RuntimeError(
            f"Segmentation model '{selected_key}' is not installed. "
            "Install it in the Model Manager before continuing.",
        )

    cached = _SEGMENTER_CACHE.get(selected_key)
    if cached is not None:
        _SEGMENTER_CACHE.move_to_end(selected_key)
        return cached

    # For now all implemented keys map to the Baka-style engine.
    segmenter = BakaContentSegmenter()
    _SEGMENTER_CACHE[selected_key] = segmenter
    _evict_segmenter_cache()
    return segmenter


def clear_segmenter_cache() -> None:
    _SEGMENTER_CACHE.clear()


def get_segmenter_cache_size() -> int:
    return len(_SEGMENTER_CACHE)
