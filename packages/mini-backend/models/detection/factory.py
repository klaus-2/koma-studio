from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from types import MappingProxyType
from typing import Annotated, Final, Literal, TypedDict

from pydantic import BaseModel, ConfigDict, Field

from core.device import (
    DeviceInfo,
    build_cpu_device_info,
    get_device_info,
    get_onnx_execution_providers,
    register_gpu_cache_releaser,
)
from core.models_store import model_is_installed
from models.detection.base_detector import BaseDetector
from models.detection.comic_text_detector import ComicTextDetector
from models.detection.errors import DetectionModelNotInstalledError
from models.detection.font import (
    FontRTDetrV2Detector,
    repair_font_detector_manifest_if_payload_present,
)
from models.detection.pp_doclayout_v3 import PPDocLayoutV3Detector
from models.detection.storage import detection_runtime_ready
from models.engine_cache import LruEngineCache

logger = logging.getLogger(__name__)

DEFAULT_DETECTOR_KEY: Final[str] = "font_rtdetr_v2"

type DeviceSupport = Literal["cpu", "cpu_gpu"]
type DetectorBuilder = Callable[[DeviceInfo, float | None, float | None], BaseDetector]
type ReadinessCheck = Callable[[], bool]
type FallbackReason = Literal["unknown_model", "not_implemented", "not_installed"]
type CacheKey = tuple[str, tuple[str, ...], float | None, float | None]


class _Thresholds(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid", allow_inf_nan=False)

    confidence: Annotated[float, Field(strict=True, ge=0.0, le=1.0)] | None = None
    nms_threshold: Annotated[float, Field(strict=True, ge=0.0, le=1.0)] | None = None


@dataclass(frozen=True, slots=True)
class DetectionModelSpec:
    key: str
    name: str
    device: DeviceSupport
    source: str
    use_case: str
    builder: DetectorBuilder | None
    weights_ready: ReadinessCheck

    @property
    def implemented(self) -> bool:
        return self.builder is not None


class DetectionModelOption(TypedDict):
    key: str
    name: str
    device: DeviceSupport
    use_case: str
    implemented: bool
    available: bool


def _font_weights_ready() -> bool:
    # font_rtdetr_v2 has no entry in _DETECTION_MODEL_SOURCES, so
    # detection_runtime_ready would always be False here; the repaired
    # manifest plus payload check IS the readiness contract for this model.
    installed = model_is_installed(DEFAULT_DETECTOR_KEY)
    if not installed:
        installed = repair_font_detector_manifest_if_payload_present()
    return installed


def _pp_doclayout_weights_ready() -> bool:
    return (
        model_is_installed("pp_doclayout_v3")
        and detection_runtime_ready("pp_doclayout_v3")
    )


def _bundled_weights_ready() -> bool:
    return detection_runtime_ready("comic_text_detector")


def _not_installable() -> bool:
    return False


def _plain_providers(device_info: DeviceInfo) -> tuple[str, ...]:
    raw = get_onnx_execution_providers(device_info)
    plain = tuple(provider for provider in raw if isinstance(provider, str))
    if len(plain) != len(raw):
        raise TypeError("Expected plain ONNX execution-provider names")
    if not plain:
        raise ValueError("The selected device has no ONNX execution providers")
    return plain


def _build_font_detector(
    device_info: DeviceInfo,
    confidence: float | None,
    nms_threshold: float | None,
) -> BaseDetector:
    return FontRTDetrV2Detector(
        confidence_threshold=confidence,
        nms_threshold=nms_threshold,
        providers=_plain_providers(device_info),
    )


def _build_comic_detector(
    device_info: DeviceInfo,
    confidence: float | None,
    nms_threshold: float | None,
) -> BaseDetector:
    return ComicTextDetector(
        confidence_threshold=confidence,
        nms_threshold=nms_threshold,
        providers=_plain_providers(device_info),
    )


def _build_pp_doclayout_detector(
    device_info: DeviceInfo,
    confidence: float | None,
    nms_threshold: float | None,
) -> BaseDetector:
    return PPDocLayoutV3Detector(
        confidence_threshold=confidence,
        nms_threshold=nms_threshold,
        providers=_plain_providers(device_info),
    )


DETECTION_MODELS: Final[Mapping[str, DetectionModelSpec]] = MappingProxyType(
    {
        spec.key: spec
        for spec in (
            DetectionModelSpec(
                key="font_rtdetr_v2",
                name="RT-DETR v2 (ONNX)",
                device="cpu_gpu",
                source="huggingface:ogkalu/comic-text-and-bubble-detector/detector.onnx",
                use_case="Text detection",
                builder=_build_font_detector,
                weights_ready=_font_weights_ready,
            ),
            DetectionModelSpec(
                key="craft",
                name="CRAFT",
                device="cpu",
                source="pip:craft-text-detector",
                use_case="General-purpose text detection",
                builder=None,
                weights_ready=_not_installable,
            ),
            DetectionModelSpec(
                key="comic_text_detector",
                name="Comic Text Detector",
                device="cpu_gpu",
                source="dmMaze/comic-text-detector",
                use_case="Alternative comic text detector",
                builder=_build_comic_detector,
                weights_ready=_bundled_weights_ready,
            ),
            DetectionModelSpec(
                key="yolo_bubble",
                name="YOLO Bubble Seg",
                device="cpu_gpu",
                source="huyvux3005/manga109-segmentation-bubble",
                use_case="Speech-bubble segmentation",
                builder=None,
                weights_ready=_not_installable,
            ),
            DetectionModelSpec(
                key="pp_doclayout_v3",
                name="PP-DocLayout V3",
                device="cpu_gpu",
                source="PaddlePaddle/PP-DocLayoutV3_safetensors",
                use_case="Layout and text detection",
                builder=_build_pp_doclayout_detector,
                weights_ready=_pp_doclayout_weights_ready,
            ),
        )
    }
)

_CACHE: Final[LruEngineCache[CacheKey, BaseDetector]] = LruEngineCache(4)


def list_detection_models(has_gpu: bool) -> list[DetectionModelOption]:
    del has_gpu
    return [
        DetectionModelOption(
            key=spec.key,
            name=spec.name,
            device=spec.device,
            use_case=spec.use_case,
            implemented=spec.implemented,
            available=spec.implemented and spec.weights_ready(),
        )
        for spec in DETECTION_MODELS.values()
    ]


def _rejection_reason(
    key: str,
    registry: Mapping[str, DetectionModelSpec],
) -> tuple[FallbackReason | None, DetectionModelSpec | None]:
    spec = registry.get(key)
    if spec is None:
        return "unknown_model", None
    if spec.builder is None:
        return "not_implemented", spec
    if not spec.weights_ready():
        return "not_installed", spec
    return None, spec


@dataclass(frozen=True, slots=True)
class DetectorResolution:
    requested_key: str
    spec: DetectionModelSpec
    fallback_reason: FallbackReason | None


def resolve_detector_key(
    requested_key: str | None,
    *,
    registry: Mapping[str, DetectionModelSpec] | None = None,
) -> DetectorResolution:
    effective_registry = DETECTION_MODELS if registry is None else registry
    requested = (requested_key or DEFAULT_DETECTOR_KEY).strip().lower()
    if requested in {"", "auto"}:
        requested = DEFAULT_DETECTOR_KEY

    reason, spec = _rejection_reason(requested, effective_registry)
    if reason is None and spec is not None:
        return DetectorResolution(requested, spec, None)

    if requested == DEFAULT_DETECTOR_KEY:
        raise DetectionModelNotInstalledError(DEFAULT_DETECTOR_KEY)

    default_reason, default_spec = _rejection_reason(
        DEFAULT_DETECTOR_KEY,
        effective_registry,
    )
    if default_reason is not None or default_spec is None:
        raise DetectionModelNotInstalledError(DEFAULT_DETECTOR_KEY)

    return DetectorResolution(requested, default_spec, reason)


@register_gpu_cache_releaser
def clear_detector_cache() -> None:
    _CACHE.clear()


def get_detector_cache_size() -> int:
    return len(_CACHE)


def get_detector(
    task: str,
    has_gpu: bool,
    model_key: str | None = None,
    confidence: float | None = None,
    nms_threshold: float | None = None,
    device_info: DeviceInfo | None = None,
) -> BaseDetector:
    """Synchronous factory; invoke from a worker when called by async code."""
    del task
    thresholds = _Thresholds(
        confidence=confidence,
        nms_threshold=nms_threshold,
    )
    resolution = resolve_detector_key(model_key)
    device = device_info if device_info is not None else get_device_info()

    if (not has_gpu or resolution.spec.device == "cpu") and device.has_gpu:
        device = build_cpu_device_info(
            device,
            fallback_reason="gpu_disabled_for_detection_stage",
        )

    providers = _plain_providers(device)
    if not providers:
        raise ValueError("The selected device has no ONNX execution providers")

    if resolution.fallback_reason is not None:
        logger.warning(
            "detection.model_fallback",
            extra={
                "selected_model": resolution.spec.key,
                "fallback_reason": resolution.fallback_reason,
            },
        )

    builder = resolution.spec.builder
    if builder is None:
        raise DetectionModelNotInstalledError(resolution.spec.key)

    cache_key: CacheKey = (
        resolution.spec.key,
        providers,
        thresholds.confidence,
        thresholds.nms_threshold,
    )

    def build() -> BaseDetector:
        detector = builder(
            device,
            thresholds.confidence,
            thresholds.nms_threshold,
        )
        logger.info(
            "detection.model_loaded",
            extra={
                "selected_model": resolution.spec.key,
                "providers": providers,
            },
        )
        return detector

    return _CACHE.get_or_build(cache_key, build)
