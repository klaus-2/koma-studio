"""Segmentation engine registry and process-wide LRU cache."""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from types import MappingProxyType
from typing import Literal, TypedDict

from core.device import (
    FrozenOnnxProviderSpec,
    OnnxProviderSpec,
    freeze_provider_specs,
    get_device_info,
    get_onnx_execution_providers,
    register_gpu_cache_releaser,
)
from core.engine_idle import register_idle_cache
from core.models_store import model_is_installed
from models.engine_cache import LruEngineCache
from models.errors import (
    MODEL_NOT_IMPLEMENTED_WIRE_CODE,
    UNKNOWN_MODEL_WIRE_CODE,
    ModelNotInstalledError,
    UnimplementedModelSelectionError,
)
from models.segmentation.base_segmenter import BaseSegmenter
from models.segmentation.storage import (
    COMIC_TEXT_MASK_MODEL_ID,
    CTD_SEGMENTATION_MODEL_ID,
    segmentation_runtime_ready,
)

logger = logging.getLogger(__name__)

type DeviceSupport = Literal["cpu", "gpu", "cpu_gpu"]

DEFAULT_SEGMENTATION_MODEL_KEY = "baka_content_cc"
AUTO_SEGMENTATION_PREFERENCE: tuple[str, ...] = (
    COMIC_TEXT_MASK_MODEL_ID,
    CTD_SEGMENTATION_MODEL_ID,
    DEFAULT_SEGMENTATION_MODEL_KEY,
)


@dataclass(frozen=True, slots=True)
class SegmentationModelMeta:
    key: str
    name: str
    device: DeviceSupport
    use_case: str
    implemented: bool

    def runs_on(self, has_gpu: bool) -> bool:
        return has_gpu or self.device != "gpu"


SEGMENTATION_MODELS: Mapping[str, SegmentationModelMeta] = MappingProxyType(
    {
        DEFAULT_SEGMENTATION_MODEL_KEY: SegmentationModelMeta(
            key=DEFAULT_SEGMENTATION_MODEL_KEY,
            name="Baka Content CC",
            device="cpu_gpu",
            use_case="Zero-download heuristic mask (Otsu + connected components) for high-contrast B&W bubbles",
            implemented=True,
        ),
        CTD_SEGMENTATION_MODEL_ID: SegmentationModelMeta(
            key=CTD_SEGMENTATION_MODEL_ID,
            name="CTD Text Mask (ONNX)",
            device="cpu_gpu",
            use_case="Recommended neural U-Net pixel text mask (reuses Comic Text Detector weights)",
            implemented=True,
        ),
        COMIC_TEXT_MASK_MODEL_ID: SegmentationModelMeta(
            key=COMIC_TEXT_MASK_MODEL_ID,
            name="Comic Text Mask (ONNX)",
            device="cpu_gpu",
            use_case="Standalone lightweight ResNet18 U-Net crop text mask for colored/multilingual pages",
            implemented=True,
        ),
        "sam2_text": SegmentationModelMeta(
            key="sam2_text",
            name="SAM2 Text",
            device="gpu",
            use_case="Advanced semantic segmentation (roadmap)",
            implemented=False,
        ),
    }
)


def _build_baka_content_segmenter(
    providers: Sequence[OnnxProviderSpec] | None = None,
) -> BaseSegmenter:
    """Build the OpenCV fallback segmenter, importing its engine lazily."""
    del providers
    import models.segmentation.baka_segmenter as _mod

    segmenter_class: type[BaseSegmenter] = _mod.BakaContentSegmenter
    return segmenter_class()


def _build_ctd_text_segmenter(
    providers: Sequence[OnnxProviderSpec] | None = None,
) -> BaseSegmenter:
    import models.segmentation.ctd_segmenter as _mod

    segmenter_class: type[BaseSegmenter] = _mod.CtdTextSegmenter
    return segmenter_class(providers=providers)


def _build_comic_text_mask_segmenter(
    providers: Sequence[OnnxProviderSpec] | None = None,
) -> BaseSegmenter:
    import models.segmentation.comic_text_mask_segmenter as _mod

    segmenter_class: type[BaseSegmenter] = _mod.ComicTextMaskSegmenter
    return segmenter_class(providers=providers)


type SegmenterBuilder = Callable[[Sequence[OnnxProviderSpec] | None], BaseSegmenter]

_BUILDERS: Mapping[str, SegmenterBuilder] = MappingProxyType(
    {
        DEFAULT_SEGMENTATION_MODEL_KEY: _build_baka_content_segmenter,
        CTD_SEGMENTATION_MODEL_ID: _build_ctd_text_segmenter,
        COMIC_TEXT_MASK_MODEL_ID: _build_comic_text_mask_segmenter,
    }
)

type SegmentationCacheKey = tuple[str, tuple[FrozenOnnxProviderSpec, ...]]

_CACHE: LruEngineCache[SegmentationCacheKey, BaseSegmenter] = LruEngineCache(max_size=4)


class SegmentationModelOption(TypedDict):
    key: str
    name: str
    device: DeviceSupport
    use_case: str
    implemented: bool
    available: bool


def _is_installed(meta: SegmentationModelMeta) -> bool:
    if not meta.implemented:
        return False
    ready = segmentation_runtime_ready(meta.key)
    if not ready:
        return False
    if meta.key == CTD_SEGMENTATION_MODEL_ID:
        return model_is_installed(meta.key) or model_is_installed("comic_text_detector")
    return model_is_installed(meta.key)


def list_segmentation_models(has_gpu: bool) -> list[SegmentationModelOption]:
    return [
        SegmentationModelOption(
            key=meta.key,
            name=meta.name,
            device=meta.device,
            use_case=meta.use_case,
            implemented=meta.implemented,
            available=meta.runs_on(has_gpu) and _is_installed(meta),
        )
        for meta in SEGMENTATION_MODELS.values()
    ]


def _resolve_auto_key(has_gpu: bool) -> str:
    for candidate in AUTO_SEGMENTATION_PREFERENCE:
        meta = SEGMENTATION_MODELS.get(candidate)
        if meta is not None and meta.runs_on(has_gpu) and _is_installed(meta):
            return candidate
    return DEFAULT_SEGMENTATION_MODEL_KEY


def resolve_segmentation_model_key(model_key: str | None, has_gpu: bool) -> str:
    """Resolve to a servable key, falling back to the default with a logged reason.

    ``"auto"`` prefers the highest-quality installed neural segmenter
    (``comic_text_mask`` -> ``ctd_text_seg`` -> ``baka_content_cc``).
    Empty/None preserves the deterministic default (``baka_content_cc``).
    Any explicit selection of an unknown or unimplemented model refuses with
    ``UnimplementedModelSelectionError``.
    """
    requested = (model_key or "").strip()
    if not requested:
        return DEFAULT_SEGMENTATION_MODEL_KEY
    if requested == "auto":
        return _resolve_auto_key(has_gpu)

    meta = SEGMENTATION_MODELS.get(requested)
    if meta is None:
        reason = "unknown model key"
    elif not meta.implemented:
        reason = "model not implemented"
    elif not meta.runs_on(has_gpu):
        reason = "model requires a GPU"
    elif requested not in _BUILDERS:
        reason = "no engine builder registered"
    else:
        return requested

    if reason != "model requires a GPU":
        alternatives = tuple(
            key for key, item in SEGMENTATION_MODELS.items() if item.implemented
        )
        raise UnimplementedModelSelectionError(
            model_key=requested,
            stage="segment",
            code=(
                UNKNOWN_MODEL_WIRE_CODE
                if meta is None
                else MODEL_NOT_IMPLEMENTED_WIRE_CODE
            ),
            alternatives=alternatives,
            message=(
                f"Segmentation model '{requested}' is not available ({reason}). "
                f"Available models: {', '.join(alternatives)}"
            ),
        )

    logger.warning(
        "segmentation model fallback",
        extra={
            "requested": requested,
            "fallback": DEFAULT_SEGMENTATION_MODEL_KEY,
            "reason": reason,
        },
    )
    return DEFAULT_SEGMENTATION_MODEL_KEY


def get_segmenter(has_gpu: bool, model_key: str | None = None) -> BaseSegmenter:
    key = resolve_segmentation_model_key(model_key, has_gpu)
    meta = SEGMENTATION_MODELS[key]
    if not _is_installed(meta):
        raise ModelNotInstalledError(
            f"Segmentation model '{key}' is not installed. "
            "Install it in the Model Manager before continuing."
        )
    device = get_device_info()
    if (
        key == DEFAULT_SEGMENTATION_MODEL_KEY
        or meta.device == "cpu"
        or (not has_gpu and device.has_gpu)
    ):
        providers: tuple[OnnxProviderSpec, ...] = ("CPUExecutionProvider",)
    else:
        providers = tuple(get_onnx_execution_providers(device))
    cache_key: SegmentationCacheKey = (key, freeze_provider_specs(providers))
    return _CACHE.get_or_build(cache_key, lambda: _BUILDERS[key](providers))


@register_gpu_cache_releaser
def clear_segmenter_cache() -> None:
    _CACHE.clear()


register_idle_cache("segmentation", _CACHE)


def get_segmenter_cache_size() -> int:
    return len(_CACHE)
