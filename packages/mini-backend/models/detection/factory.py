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
from models.detection.base_detector import BaseDetector
from models.detection.comic_text_detector import ComicTextDetector
from models.detection.font import (
    FontRTDetrV2Detector,
    font_detector_payload_available,
    repair_font_detector_manifest_if_payload_present,
)
from models.detection.pp_doclayout_v3 import PPDocLayoutV3Detector
from models.detection.storage import detection_runtime_ready


_DETECTOR_MAX_SIZE = 4
_DETECTOR_CACHE: OrderedDict[tuple[str, str, float, float], BaseDetector] = (
    OrderedDict()
)


DETECTION_MODELS: dict[str, dict[str, Any]] = {
    "font_rtdetr_v2": {
        "name": "RT-DETR v2 (ONNX)",
        "class": "FontRTDetrV2Detector",
        "device": "cpu_gpu",
        "path": "huggingface:ogkalu/comic-text-and-bubble-detector/detector.onnx",
        "use_case": "Text detection (same logic as the Baka AI Translator)",
        "implemented": True,
    },
    "craft": {
        "name": "CRAFT",
        "class": "CRAFTDetector",
        "device": "cpu",
        "pip": "craft-text-detector",
        "use_case": "General-purpose text, fast on CPU",
        "implemented": False,
    },
    "comic_text_detector": {
        "name": "Comic Text Detector",
        "class": "ComicTextDetector",
        "device": "cpu_gpu",
        "source": "dmMaze/comic-text-detector",
        "use_case": "Alternative fallback (not used by default in AIO)",
        "implemented": True,
    },
    "yolo_bubble": {
        "name": "YOLO Bubble Seg",
        "class": "YOLOBubbleDetector",
        "device": "cpu_gpu",
        "source": "huyvux3005/manga109-segmentation-bubble",
        "use_case": "Speech-bubble segmentation (mAP@50: 99.10%)",
        "implemented": False,
    },
    "pp_doclayout_v3": {
        "name": "PP-DocLayout V3",
        "class": "PPDocLayoutV3Detector",
        "device": "cpu_gpu",
        "source": "PaddlePaddle/PP-DocLayoutV3_safetensors",
        "use_case": "Layout and text detection via PP-DocLayout V3 (high accuracy for page analysis).",
        "implemented": True,
    },
}


def clear_detector_cache() -> None:
    _DETECTOR_CACHE.clear()


def get_detector_cache_size() -> int:
    return len(_DETECTOR_CACHE)


def _evict_detector_cache() -> None:
    while len(_DETECTOR_CACHE) > _DETECTOR_MAX_SIZE:
        _DETECTOR_CACHE.popitem(last=False)


def _supports_device(model_device: str, has_gpu: bool) -> bool:
    _ = model_device, has_gpu
    return True


def list_detection_models(has_gpu: bool) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for key, meta in DETECTION_MODELS.items():
        device_supported = _supports_device(str(meta.get("device", "cpu_gpu")), has_gpu)
        option = {
            "key": key,
            "name": meta.get("name", key),
            "device": meta.get("device", "cpu_gpu"),
            "use_case": meta.get("use_case", ""),
            "implemented": bool(meta.get("implemented", False)),
            "available": bool(
                device_supported
                and meta.get("implemented", False)
                and (key == "comic_text_detector" or model_is_installed(key))
            ),
        }
        options.append(option)
    return options


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


def _cache_key(
    model_key: str,
    device_info: DeviceInfo,
    confidence: float | None,
    nms_threshold: float | None,
) -> tuple[str, str, float, float]:
    provider = device_info.onnx_provider or ("CUDA" if device_info.has_gpu else "CPU")
    conf = float(confidence) if confidence is not None else -1.0
    nms = float(nms_threshold) if nms_threshold is not None else -1.0
    return model_key, provider, round(conf, 4), round(nms, 4)


_BUILDERS: dict[str, Any] = {
    "font_rtdetr_v2": _build_font_detector,
    "comic_text_detector": _build_comic_detector,
    "pp_doclayout_v3": _build_pp_doclayout_detector,
}


def get_detector(
    task: str,
    has_gpu: bool,
    model_key: str | None = None,
    confidence: float | None = None,
    nms_threshold: float | None = None,
    device_info: DeviceInfo | None = None,
) -> BaseDetector:
    device_info = device_info or get_device_info()
    if not has_gpu and device_info.has_gpu:
        device_info = build_cpu_device_info(
            device_info, fallback_reason="gpu_disabled_for_detection_stage"
        )
    effective_gpu = device_info.has_gpu or has_gpu
    selected_key = model_key or "font_rtdetr_v2"

    meta = DETECTION_MODELS.get(selected_key)
    if meta is None:
        selected_key = "font_rtdetr_v2"
        meta = DETECTION_MODELS[selected_key]

    if not _supports_device(str(meta.get("device", "cpu_gpu")), effective_gpu):
        selected_key = "font_rtdetr_v2"
        meta = DETECTION_MODELS[selected_key]

    if not bool(meta.get("implemented", False)):
        selected_key = "font_rtdetr_v2"

    if selected_key not in _BUILDERS:
        selected_key = "font_rtdetr_v2"

    # Verify model files are installed (skip for comic_text_detector which is always bundled)
    if selected_key != "comic_text_detector" and not model_is_installed(selected_key):
        if selected_key == "font_rtdetr_v2" and font_detector_payload_available():
            repair_font_detector_manifest_if_payload_present()
        if selected_key != "font_rtdetr_v2":
            # Fall back to default if the selected model isn't installed
            selected_key = "font_rtdetr_v2"
        if not model_is_installed("font_rtdetr_v2"):
            if font_detector_payload_available():
                repair_font_detector_manifest_if_payload_present()
        if (
            not model_is_installed("font_rtdetr_v2")
            and not font_detector_payload_available()
        ):
            raise RuntimeError(
                "Detection model 'font_rtdetr_v2' is not installed. "
                "Install it in the Model Manager before continuing.",
            )

    # For pp_doclayout_v3 also check that runtime files exist
    if selected_key == "pp_doclayout_v3" and not detection_runtime_ready(
        "pp_doclayout_v3"
    ):
        selected_key = "font_rtdetr_v2"

    key = _cache_key(selected_key, device_info, confidence, nms_threshold)
    cached = _DETECTOR_CACHE.get(key)
    if cached is not None:
        _DETECTOR_CACHE.move_to_end(key)
        return cached

    builder = _BUILDERS.get(selected_key, _build_font_detector)
    detector = builder(device_info, confidence=confidence, nms_threshold=nms_threshold)
    _DETECTOR_CACHE[key] = detector
    _evict_detector_cache()
    return detector
