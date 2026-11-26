from __future__ import annotations

import logging
from typing import Final, TypedDict

from core.device import register_gpu_cache_releaser, release_gpu_memory
from core.engine_idle import register_idle_cache
from core.models_store import model_is_installed
from models.engine_cache import LruEngineCache
from models.image_edit.engine import LocalImageEditEngine
from models.image_edit.registry import (
    LOCAL_IMAGE_EDIT_SPECS,
    LocalImageEditCompatibility,
    extract_local_image_edit_model_id,
    get_local_image_edit_spec,
)
from models.image_edit.storage import local_image_edit_runtime_ready

logger = logging.getLogger(__name__)


class LocalImageEditOption(TypedDict):
    key: str
    name: str
    device: str
    use_case: str
    implemented: bool
    available: bool
    min_vram_gb: int
    hf_repo: str
    compatibility: LocalImageEditCompatibility
    license: str
    default_steps: int
    default_guidance_scale: float


_ENGINE_CACHE: Final[LruEngineCache[LocalImageEditEngine]] = LruEngineCache(max_size=1)
register_idle_cache("image_edit", _ENGINE_CACHE)


@register_gpu_cache_releaser
def clear_image_edit_cache() -> None:
    _ENGINE_CACHE.clear()
    release_gpu_memory(force=True)


def get_local_image_edit_cache_size() -> int:
    return len(_ENGINE_CACHE)


def get_local_image_edit_engine(model_key: str) -> LocalImageEditEngine:
    model_id = extract_local_image_edit_model_id(model_key)
    if model_id is None:
        raise ValueError(f"Unsupported local image-edit model: {model_key!r}")
    return _ENGINE_CACHE.get_or_build(model_id, lambda: LocalImageEditEngine(model_id))


def list_local_image_edit_models(*, has_gpu: bool) -> list[LocalImageEditOption]:
    device = "cuda" if has_gpu else "cpu"
    items: list[LocalImageEditOption] = []
    for spec in LOCAL_IMAGE_EDIT_SPECS.values():
        available = model_is_installed(spec.key) and local_image_edit_runtime_ready(spec.key)
        items.append(
            LocalImageEditOption(
                key=spec.key,
                name=spec.name,
                device=device,
                use_case=spec.use_case,
                implemented=True,
                available=available,
                min_vram_gb=spec.min_vram_gb,
                hf_repo=spec.hf_repo,
                compatibility=spec.compatibility,
                license=spec.license,
                default_steps=spec.default_steps,
                default_guidance_scale=spec.default_guidance_scale,
            )
        )
    return items
