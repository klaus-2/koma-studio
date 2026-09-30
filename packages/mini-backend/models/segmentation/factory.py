"""Segmentation engine registry and process-wide LRU cache."""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Literal, TypedDict

from core.device import register_gpu_cache_releaser
from core.models_store import model_is_installed
from models.engine_cache import LruEngineCache
from models.errors import ModelNotInstalledError
from models.segmentation.baka_segmenter import BakaContentSegmenter
from models.segmentation.base_segmenter import BaseSegmenter
from models.segmentation.storage import segmentation_runtime_ready

logger = logging.getLogger(__name__)

type DeviceSupport = Literal["cpu", "gpu", "cpu_gpu"]

DEFAULT_SEGMENTATION_MODEL_KEY = "baka_content_cc"


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
            use_case="Baka-style text segmentation (Otsu + connected components)",
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

_BUILDERS: Mapping[str, Callable[[], BaseSegmenter]] = MappingProxyType(
    {DEFAULT_SEGMENTATION_MODEL_KEY: BakaContentSegmenter}
)

_CACHE: LruEngineCache[str, BaseSegmenter] = LruEngineCache(max_size=2)


class SegmentationModelOption(TypedDict):
    key: str
    name: str
    device: DeviceSupport
    use_case: str
    implemented: bool
    available: bool


def _is_installed(meta: SegmentationModelMeta) -> bool:
    return (
        meta.implemented
        and model_is_installed(meta.key)
        and segmentation_runtime_ready(meta.key)
    )


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


def resolve_segmentation_model_key(model_key: str | None, has_gpu: bool) -> str:
    """Resolve to a servable key, falling back to the default with a logged reason."""
    requested = (model_key or "").strip()
    if not requested:
        return DEFAULT_SEGMENTATION_MODEL_KEY

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
    if not model_is_installed(key) or not segmentation_runtime_ready(key):
        raise ModelNotInstalledError(
            f"Segmentation model '{key}' is not installed. "
            "Install it in the Model Manager before continuing."
        )
    return _CACHE.get_or_build(key, _BUILDERS[key])


@register_gpu_cache_releaser
def clear_segmenter_cache() -> None:
    _CACHE.clear()


def get_segmenter_cache_size() -> int:
    return len(_CACHE)
