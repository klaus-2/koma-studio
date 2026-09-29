from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Final, Literal, TypedDict

from core.device import (
    register_gpu_cache_releaser,
    DeviceInfo,
    build_cpu_device_info,
    get_device_info,
    get_onnx_execution_providers,
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

logger = logging.getLogger(__name__)

DEFAULT_DETECTOR_KEY: Final = "font_rtdetr_v2"
_CACHE_MAX_SIZE: Final = 4

type DeviceSupport = Literal["cpu", "cpu_gpu"]
type DetectorBuilder = Callable[[DeviceInfo, float | None, float | None], BaseDetector]
type ReadinessCheck = Callable[[], bool]
type FallbackReason = Literal["unknown_model", "not_implemented", "not_installed"]
type _CacheKey = tuple[str, str, float, float]


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
    # A manifest left as "incomplete" by an interrupted install is repaired in
    # place when the payload is actually on disk, instead of forcing a reinstall.
    return model_is_installed(DEFAULT_DETECTOR_KEY) or repair_font_detector_manifest_if_payload_present()


def _pp_doclayout_weights_ready() -> bool:
    return model_is_installed("pp_doclayout_v3") and detection_runtime_ready("pp_doclayout_v3")


def _bundled_weights_ready() -> bool:
    return True


def _not_installable() -> bool:
    return False


def _build_font_detector(
    device_info: DeviceInfo, confidence: float | None, nms_threshold: float | None
) -> BaseDetector:
    providers = get_onnx_execution_providers(device_info)
    return FontRTDetrV2Detector(
        confidence_threshold=confidence,
        nms_threshold=nms_threshold,
        providers=providers,
    )


def _build_comic_detector(
    device_info: DeviceInfo, confidence: float | None, nms_threshold: float | None
) -> BaseDetector:
    providers = get_onnx_execution_providers(device_info)
    return ComicTextDetector(
        confidence_threshold=confidence,
        nms_threshold=nms_threshold,
        providers=providers,
    )


def _build_pp_doclayout_detector(
    device_info: DeviceInfo, confidence: float | None, nms_threshold: float | None
) -> BaseDetector:
    providers = get_onnx_execution_providers(device_info)
    return PPDocLayoutV3Detector(
        confidence_threshold=confidence,
        nms_threshold=nms_threshold,
        providers=providers,
    )


DETECTION_MODELS: Final[Mapping[str, DetectionModelSpec]] = {
    spec.key: spec
    for spec in (
        DetectionModelSpec(
            key="font_rtdetr_v2",
            name="RT-DETR v2 (ONNX)",
            device="cpu_gpu",
            source="huggingface:ogkalu/comic-text-and-bubble-detector/detector.onnx",
            use_case="Text detection (same logic as the Baka AI Translator)",
            builder=_build_font_detector,
            weights_ready=_font_weights_ready,
        ),
        DetectionModelSpec(
            key="craft",
            name="CRAFT",
            device="cpu",
            source="pip:craft-text-detector",
            use_case="General-purpose text, fast on CPU",
            builder=None,
            weights_ready=_not_installable,
        ),
        DetectionModelSpec(
            key="comic_text_detector",
            name="Comic Text Detector",
            device="cpu_gpu",
            source="dmMaze/comic-text-detector",
            use_case="Alternative fallback (not used by default in AIO)",
            builder=_build_comic_detector,
            weights_ready=_bundled_weights_ready,
        ),
        DetectionModelSpec(
            key="yolo_bubble",
            name="YOLO Bubble Seg",
            device="cpu_gpu",
            source="huyvux3005/manga109-segmentation-bubble",
            use_case="Speech-bubble segmentation (mAP@50: 99.10%)",
            builder=None,
            weights_ready=_not_installable,
        ),
        DetectionModelSpec(
            key="pp_doclayout_v3",
            name="PP-DocLayout V3",
            device="cpu_gpu",
            source="PaddlePaddle/PP-DocLayoutV3_safetensors",
            use_case="Layout and text detection via PP-DocLayout V3 (high accuracy for page analysis).",
            builder=_build_pp_doclayout_detector,
            weights_ready=_pp_doclayout_weights_ready,
        ),
    )
}


def list_detection_models(has_gpu: bool) -> list[DetectionModelOption]:
    del has_gpu  # every registered model runs on CPU; GPU only changes the ONNX provider.
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
    key: str, registry: Mapping[str, DetectionModelSpec]
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
    """Pick a usable detector, falling back to the default with an explicit reason.

    Raises ``DetectionModelNotInstalledError`` only when the default itself is unusable.
    """
    effective_registry = DETECTION_MODELS if registry is None else registry
    requested = requested_key or DEFAULT_DETECTOR_KEY
    reason, spec = _rejection_reason(requested, effective_registry)
    if reason is None and spec is not None:
        return DetectorResolution(requested, spec, None)

    default_reason, default_spec = _rejection_reason(DEFAULT_DETECTOR_KEY, effective_registry)
    if default_reason is not None or default_spec is None or default_spec.builder is None:
        raise DetectionModelNotInstalledError(DEFAULT_DETECTOR_KEY)
    return DetectorResolution(requested, default_spec, reason)


class _DetectorCache:
    """Bounded LRU keyed by (model, provider, thresholds). Safe across threads."""

    def __init__(self, max_size: int) -> None:
        self._max_size = max_size
        self._entries: OrderedDict[_CacheKey, BaseDetector] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: _CacheKey) -> BaseDetector | None:
        with self._lock:
            detector = self._entries.get(key)
            if detector is not None:
                self._entries.move_to_end(key)
            return detector

    def put(self, key: _CacheKey, detector: BaseDetector) -> BaseDetector:
        """Insert ``detector`` unless a concurrent build won; returns the canonical one."""
        with self._lock:
            existing = self._entries.get(key)
            if existing is not None:
                self._entries.move_to_end(key)
                return existing
            self._entries[key] = detector
            while len(self._entries) > self._max_size:
                self._entries.popitem(last=False)
            return detector

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


_CACHE: Final = _DetectorCache(_CACHE_MAX_SIZE)


@register_gpu_cache_releaser
def clear_detector_cache() -> None:
    _CACHE.clear()


def get_detector_cache_size() -> int:
    return len(_CACHE)


def _quantize(value: float | None) -> float:
    return -1.0 if value is None else round(float(value), 4)


def get_detector(
    task: str,
    has_gpu: bool,
    model_key: str | None = None,
    confidence: float | None = None,
    nms_threshold: float | None = None,
    device_info: DeviceInfo | None = None,
) -> BaseDetector:
    """Resolve and build (or reuse) a detector.

    Building an ONNX session takes seconds; call this from async code via
    ``asyncio.to_thread`` — the cache lookup itself is cheap.
    """
    _ = task
    resolved_device = device_info or get_device_info()
    if not has_gpu and resolved_device.has_gpu:
        resolved_device = build_cpu_device_info(
            resolved_device, fallback_reason="gpu_disabled_for_detection_stage"
        )

    resolution = resolve_detector_key(model_key)
    if resolution.fallback_reason is not None:
        logger.warning(
            "detection.model_fallback",
            extra={
                "requested_model": resolution.requested_key,
                "selected_model": resolution.spec.key,
                "fallback_reason": resolution.fallback_reason,
            },
        )

    provider = resolved_device.onnx_provider or ("CUDA" if resolved_device.has_gpu else "CPU")
    cache_key: _CacheKey = (
        resolution.spec.key,
        provider,
        _quantize(confidence),
        _quantize(nms_threshold),
    )
    cached = _CACHE.get(cache_key)
    if cached is not None:
        return cached

    # Built outside the lock on purpose: session creation is slow and must not
    # serialize unrelated model builds. A rare duplicate build is discarded by ``put``.
    assert resolution.spec.builder is not None  # resolve_detector_key guarantees it
    detector = resolution.spec.builder(resolved_device, confidence, nms_threshold)
    logger.info(
        "detection.model_loaded",
        extra={"selected_model": resolution.spec.key, "provider": provider},
    )
    return _CACHE.put(cache_key, detector)
