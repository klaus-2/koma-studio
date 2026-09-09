from __future__ import annotations

from collections import OrderedDict
from typing import Any

from core.languages import normalize_language_code
from core.device import (
    DeviceInfo,
    build_cpu_device_info,
    get_device_info,
    get_onnx_execution_providers,
)
from core.models_store import model_is_installed
from models.ocr.base_ocr import BaseOCR
from models.ocr.easyocr import EasyOCREngine
from models.ocr.easyocr.storage import (
    easyocr_runtime_ready,
    resolve_easyocr_languages_for_source,
)
from models.ocr.glm_ocr_onnx import GlmOcrOnnxEngine
from models.ocr.glm_ocr_onnx.storage import (
    glm_ocr_onnx_runtime_ready,
    resolve_glm_ocr_onnx_model_dir,
)
from models.ocr.meiki import MeikiOcrEngine
from models.ocr.meiki.storage import meiki_runtime_ready, resolve_meiki_model_dir
from models.ocr.manga_ocr import MangaOCROnnxEngine
from models.ocr.manga_ocr.storage import (
    manga_ocr_runtime_ready,
    resolve_manga_ocr_model_dir,
)
from models.ocr.paddleocr_vl_manga import PaddleOcrVlMangaEngine
from models.ocr.paddleocr_vl_manga.storage import (
    paddleocr_vl_manga_runtime_ready,
    resolve_paddleocr_vl_manga_model_dir,
)
from models.ocr.paddleocr import (
    PPOCRV5ChineseRecEngine,
    PPOCRV5EnglishRecEngine,
    PPOCRV5LatinRecEngine,
    PPOCRV5RecEngine,
)
from models.ocr.paddleocr.storage import (
    paddleocr_runtime_ready,
    resolve_paddleocr_model_dir,
)
from models.ocr.pororo.storage import pororo_runtime_ready
from models.ocr.pororo_engine import PororoOCREngine
from models.ocr.transformers_vlm import TransformersVlmOcrEngine
from models.ocr.transformers_vlm.storage import (
    resolve_transformers_vlm_model_dir,
    transformers_vlm_runtime_ready,
)


OCR_MODELS: dict[str, dict[str, Any]] = {
    "auto": {
        "name": "Auto (Default)",
        "languages": ["multi"],
        "device": "cpu_gpu",
        "quality": "Adaptive per language",
        "use_case": "Picks the OCR engine by language (ja->manga_ocr, ko->pororo, en->paddleocr_en_v5, zh->paddleocr_ch_v5, ru->paddleocr, latin->paddleocr_latin_v5).",
        "implemented": True,
    },
    "manga_ocr": {
        "name": "Manga OCR (ONNX)",
        "languages": ["ja"],
        "device": "cpu_gpu",
        "quality": "Alta para japones",
        "use_case": "Japanese OCR (same base used by Baka)",
        "implemented": True,
    },
    "meiki_ocr": {
        "name": "Meiki OCR",
        "languages": ["ja"],
        "device": "cpu_gpu",
        "quality": "Alta para japones renderizado",
        "use_case": "OCR japones especializado com modelos horizontal/vertical em ONNX.",
        "implemented": True,
    },
    "paddleocr": {
        "name": "PaddleOCR v5 East Slavic (ONNX)",
        "languages": ["ru"],
        "device": "cpu_gpu",
        "quality": "Alta para russo/eslavo",
        "use_case": "OCR russo com rec model East Slavic (eslav_PP-OCRv5).",
        "implemented": True,
    },
    "paddleocr_latin_v5": {
        "name": "PaddleOCR v5 Latin (ONNX)",
        "languages": [
            "fr",
            "de",
            "nl",
            "es",
            "it",
            "pt",
            "pt-br",
            "tr",
            "pl",
            "vi",
            "id",
            "hu",
            "fi",
        ],
        "device": "cpu_gpu",
        "quality": "High for Latin-script languages",
        "use_case": "OCR for Latin-script languages (including Dutch) via latin_PP-OCRv5.",
        "implemented": True,
    },
    "paddleocr_ch_v5": {
        "name": "PaddleOCR v5 Chinese (ONNX)",
        "languages": ["zh", "zh-cn", "zh-tw"],
        "device": "cpu_gpu",
        "quality": "High for Chinese",
        "use_case": "Chinese OCR with ch_PP-OCRv5_rec_mobile_infer.",
        "implemented": True,
    },
    "paddleocr_en_v5": {
        "name": "PaddleOCR v5 English (ONNX)",
        "languages": ["en"],
        "device": "cpu_gpu",
        "quality": "High for English",
        "use_case": "English OCR with en_PP-OCRv5_mobile_rec (updated model)",
        "implemented": True,
    },
    "easyocr": {
        "name": "EasyOCR",
        "languages": ["en", "ko", "ja", "zh", "zh-cn", "zh-tw", "ru"],
        "device": "cpu_gpu",
        "quality": "Fallback",
        "use_case": "Local multi-language OCR",
        "implemented": True,
    },
    "pororo": {
        "name": "Pororo OCR",
        "languages": ["ko"],
        "device": "cpu_gpu",
        "quality": "Alta para coreano",
        "use_case": "OCR coreano",
        "implemented": True,
    },
    "paddleocr_vl_manga": {
        "name": "PaddleOCR-VL Manga",
        "languages": ["ja"],
        "device": "gpu",
        "quality": "VLM manga",
        "use_case": "OCR local VLM focado em manga japonesa.",
        "implemented": True,
    },
    "got_ocr2": {
        "name": "GOT-OCR2",
        "languages": ["multi"],
        "device": "gpu",
        "quality": "VLM OCR geral",
        "use_case": "OCR local multimodal via GOT-OCR 2.0.",
        "implemented": True,
    },
    "qwen2_5_vl_3b": {
        "name": "Qwen2.5-VL 3B",
        "languages": ["multi"],
        "device": "gpu_8gb+",
        "quality": "VLM OCR geral",
        "use_case": "OCR local via Qwen2.5-VL-3B-Instruct.",
        "implemented": True,
    },
    "mangalmm": {
        "name": "MangaLMM",
        "languages": ["ja"],
        "device": "gpu_8gb+",
        "quality": "VLM manga",
        "use_case": "OCR/entendimento multimodal especializado em manga.",
        "implemented": True,
    },
    "rolmocr": {
        "name": "RolmOCR",
        "languages": ["multi"],
        "device": "gpu_8gb+",
        "quality": "VLM documento/OCR",
        "use_case": "OCR local robusto com base Qwen2.5-VL.",
        "implemented": True,
    },
    "glm_ocr_onnx": {
        "name": "GLM-OCR",
        "languages": ["zh", "en", "fr", "es", "ru", "de", "ja", "ko"],
        "device": "gpu_8gb+",
        "quality": "VLM OCR geral",
        "use_case": "OCR local GLM com foco em layout complexo.",
        "implemented": True,
    },
    "paddleocr_vl_1_5": {
        "name": "PaddleOCR-VL 1.5",
        "languages": ["multi"],
        "device": "gpu",
        "quality": "VLM OCR multilingue",
        "use_case": "OCR VLM multilingue de alta qualidade (PaddleOCR-VL 1.5).",
        "implemented": True,
    },
}

_OCR_MAX_SIZE = 6
_OCR_CACHE: OrderedDict[tuple[str, str, str], BaseOCR] = OrderedDict()


def _evict_ocr_cache() -> None:
    while len(_OCR_CACHE) > _OCR_MAX_SIZE:
        _OCR_CACHE.popitem(last=False)


def _supports_device(model_device: str, has_gpu: bool) -> bool:
    _ = model_device, has_gpu
    return True


def _easyocr_is_available(language: str) -> bool:
    try:
        import easyocr  # type: ignore  # noqa: F401

        return easyocr_runtime_ready(resolve_easyocr_languages_for_source(language))
    except Exception:
        return False


def _pororo_is_available() -> bool:
    try:
        import torch  # type: ignore  # noqa: F401
        import torchvision  # type: ignore  # noqa: F401
        from models.ocr.pororo.main import PororoOcr  # noqa: F401

        return pororo_runtime_ready()
    except Exception:
        return False


def _manga_ocr_runtime_ready() -> bool:
    return manga_ocr_runtime_ready()


def _meiki_runtime_ready() -> bool:
    return meiki_runtime_ready()


def _paddleocr_model_is_available(model_id: str) -> bool:
    return paddleocr_runtime_ready(model_id)


def _paddleocr_en_v5_is_available() -> bool:
    return paddleocr_runtime_ready("paddleocr_en_v5")


def _transformers_vlm_model_is_available(model_id: str) -> bool:
    try:
        import torch  # type: ignore  # noqa: F401
        import transformers  # type: ignore  # noqa: F401
    except Exception:
        return False
    return transformers_vlm_runtime_ready(model_id)


def _paddleocr_vl_manga_is_available() -> bool:
    try:
        import torch  # type: ignore  # noqa: F401
        import transformers  # type: ignore  # noqa: F401
    except Exception:
        return False
    return paddleocr_vl_manga_runtime_ready()


def _glm_ocr_runtime_ready() -> bool:
    try:
        import torch  # type: ignore  # noqa: F401
        import transformers  # type: ignore  # noqa: F401
    except Exception:
        return False
    return glm_ocr_onnx_runtime_ready()


def _model_supports_language(model_languages: list[str], language: str | None) -> bool:
    if not language:
        return True
    normalized = normalize_language_code(
        language, default="en", allow_auto=True
    ).lower()
    if normalized in {"", "auto"}:
        return True

    supported = {item.lower() for item in model_languages}
    if "multi" in supported:
        return True
    if normalized in supported:
        return True
    if normalized == "zh" and ("zh-cn" in supported or "zh-tw" in supported):
        return True
    if normalized in {"zh-cn", "zh-tw"} and "zh" in supported:
        return True
    if normalized == "pt-br" and "pt" in supported:
        return True
    return False


def _model_is_implemented(model_key: str, meta: dict[str, Any]) -> bool:
    if model_key == "auto":
        return True

    if not bool(meta.get("implemented", False)):
        return False

    # Main rule: only available when installed through the Model Manager.
    if not model_is_installed(model_key):
        return False

    if model_key == "pororo":
        return _pororo_is_available()
    if model_key == "paddleocr_en_v5":
        return _paddleocr_en_v5_is_available()
    if model_key == "meiki_ocr":
        return _meiki_runtime_ready()
    if model_key == "paddleocr_vl_manga":
        return _paddleocr_vl_manga_is_available()
    if model_key in {"got_ocr2", "qwen2_5_vl_3b", "mangalmm", "rolmocr"}:
        return _transformers_vlm_model_is_available(model_key)
    if model_key == "glm_ocr_onnx":
        return _glm_ocr_runtime_ready()
    if model_key == "paddleocr_vl_1_5":
        return _transformers_vlm_model_is_available("paddleocr_vl_1_5")
    if model_key == "easyocr":
        runtime_language = str(meta.get("_runtime_language") or "en")
        return _easyocr_is_available(runtime_language)
    if model_key in {"paddleocr", "paddleocr_latin_v5", "paddleocr_ch_v5"}:
        return _paddleocr_model_is_available(model_key)
    if model_key == "manga_ocr":
        return _manga_ocr_runtime_ready()
    return True


_LATIN_LANGUAGE_CODES: set[str] = {
    "fr",
    "de",
    "nl",
    "es",
    "it",
    "pt",
    "pt-br",
    "tr",
    "pl",
    "vi",
    "id",
    "hu",
    "fi",
}


def _default_model_candidates_for_language(language: str) -> list[str]:
    normalized = normalize_language_code(language, default="en", allow_auto=False)
    if normalized == "ja":
        return [
            "meiki_ocr",
            "manga_ocr",
            "paddleocr_latin_v5",
            "paddleocr_ch_v5",
            "easyocr",
        ]
    if normalized == "ko":
        return ["pororo", "paddleocr_latin_v5", "easyocr"]
    if normalized == "en":
        return ["paddleocr_en_v5", "paddleocr_latin_v5", "easyocr"]
    if normalized in {"zh", "zh-cn", "zh-tw"}:
        return ["paddleocr_ch_v5", "paddleocr_latin_v5", "easyocr"]
    if normalized == "ru":
        return ["paddleocr", "paddleocr_latin_v5", "easyocr"]
    if normalized in _LATIN_LANGUAGE_CODES:
        return ["paddleocr_latin_v5", "paddleocr_en_v5", "easyocr", "paddleocr"]
    # Generic scenario: try the broader local OCRs first, then fall back to the multi-language engine.
    return [
        "paddleocr_latin_v5",
        "paddleocr_en_v5",
        "paddleocr",
        "paddleocr_ch_v5",
        "easyocr",
    ]


def _resolve_auto_model(language: str, has_gpu: bool) -> str | None:
    for candidate in _default_model_candidates_for_language(language):
        meta = OCR_MODELS.get(candidate)
        if meta is None:
            continue
        if not _supports_device(str(meta.get("device", "cpu_gpu")), has_gpu):
            continue
        if _model_is_implemented(candidate, meta):
            return candidate
    return None


def _cache_key(
    model_key: str, device_info: DeviceInfo, language: str
) -> tuple[str, str, str]:
    provider = device_info.onnx_provider or ("CUDA" if device_info.has_gpu else "CPU")
    if model_key in {"easyocr", "pororo"}:
        return (
            model_key,
            provider,
            normalize_language_code(language, default="en", allow_auto=False),
        )
    return model_key, provider, "multi"


def _build_ocr_engine(
    model_key: str, device_info: DeviceInfo, language: str
) -> BaseOCR:
    providers = get_onnx_execution_providers(device_info)

    if model_key == "manga_ocr":
        model_dir = resolve_manga_ocr_model_dir()
        return MangaOCROnnxEngine(providers=providers, model_dir=model_dir)
    if model_key == "meiki_ocr":
        model_dir = resolve_meiki_model_dir()
        return MeikiOcrEngine(providers=providers, model_dir=model_dir)
    if model_key == "paddleocr_vl_manga":
        model_dir = resolve_paddleocr_vl_manga_model_dir()
        return PaddleOcrVlMangaEngine(model_dir=model_dir, use_gpu=device_info.has_gpu)
    if model_key == "glm_ocr_onnx":
        model_dir = resolve_glm_ocr_onnx_model_dir()
        return GlmOcrOnnxEngine(model_dir=model_dir, use_gpu=device_info.has_gpu)
    if model_key == "paddleocr_vl_1_5":
        model_dir = resolve_transformers_vlm_model_dir("paddleocr_vl_1_5")
        return TransformersVlmOcrEngine(
            key="paddleocr_vl_1_5",
            name="PaddleOCR-VL 1.5",
            model_dir=model_dir or "",
            max_new_tokens=128,
            use_gpu=device_info.has_gpu,
        )
    if model_key in {"got_ocr2", "qwen2_5_vl_3b", "mangalmm", "rolmocr"}:
        model_dir = resolve_transformers_vlm_model_dir(model_key)
        return TransformersVlmOcrEngine(
            key=model_key,
            name=str(OCR_MODELS[model_key]["name"]),
            model_dir=model_dir or "",
            max_new_tokens=384 if model_key == "got_ocr2" else 256,
            use_gpu=device_info.has_gpu,
        )
    if model_key == "pororo":
        return PororoOCREngine(language="ko")
    if model_key == "paddleocr_en_v5":
        model_dir = resolve_paddleocr_model_dir("paddleocr_en_v5")
        return PPOCRV5EnglishRecEngine(providers=providers, model_dir=model_dir)
    if model_key == "paddleocr_latin_v5":
        model_dir = resolve_paddleocr_model_dir("paddleocr_latin_v5")
        return PPOCRV5LatinRecEngine(providers=providers, model_dir=model_dir)
    if model_key == "paddleocr_ch_v5":
        model_dir = resolve_paddleocr_model_dir("paddleocr_ch_v5")
        return PPOCRV5ChineseRecEngine(providers=providers, model_dir=model_dir)
    if model_key == "easyocr":
        languages = resolve_easyocr_languages_for_source(language)
        return EasyOCREngine(languages=languages, use_gpu=device_info.has_gpu)
    model_dir = resolve_paddleocr_model_dir("paddleocr")
    return PPOCRV5RecEngine(providers=providers, model_dir=model_dir)


def get_ocr_engine(
    language: str,
    has_gpu: bool,
    model_key: str | None = None,
    device_info: DeviceInfo | None = None,
) -> BaseOCR:
    device_info = device_info or get_device_info()
    if not has_gpu and device_info.has_gpu:
        device_info = build_cpu_device_info(
            device_info, fallback_reason="gpu_disabled_for_ocr_stage"
        )
    effective_gpu = device_info.has_gpu or has_gpu

    requested_key = (model_key or "").strip().lower()
    if requested_key in {"", "auto", "default"}:
        resolved_key = _resolve_auto_model(
            language=language, has_gpu=effective_gpu
        )
        if not resolved_key:
            raise RuntimeError(
                "No installed OCR model is available for this language. "
                "Install at least one OCR model in the Model Manager.",
            )
        selected_key = resolved_key
        meta = OCR_MODELS[selected_key]
    else:
        selected_key = requested_key
        meta = OCR_MODELS.get(selected_key)
        if meta is None or selected_key == "auto":
            raise RuntimeError(f"Invalid OCR model: {selected_key}")

        implemented = _model_is_implemented(
            selected_key,
            {**meta, "_runtime_language": language},
        )
        if not implemented:
            raise RuntimeError(
                f"OCR model '{selected_key}' is not installed. "
                "Install it in the Model Manager before using it.",
            )

    key = _cache_key(selected_key, device_info, language)
    cached = _OCR_CACHE.get(key)
    if cached is not None:
        _OCR_CACHE.move_to_end(key)
        return cached

    engine = _build_ocr_engine(selected_key, device_info=device_info, language=language)
    _OCR_CACHE[key] = engine
    _evict_ocr_cache()
    return engine


def list_ocr_models(
    has_gpu: bool, language: str | None = None
) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for key, meta in OCR_MODELS.items():
        model_languages = [str(item) for item in meta.get("languages", [])]
        if not _model_supports_language(model_languages, language):
            continue
        device_supported = _supports_device(str(meta.get("device", "cpu_gpu")), has_gpu)
        if key == "auto":
            probe_language = language or "en"
            auto_resolved_model = _resolve_auto_model(
                language=probe_language,
                has_gpu=has_gpu,
            )
            implemented = True
            available = bool(device_supported and auto_resolved_model is not None)
        else:
            implemented = _model_is_implemented(
                key, {**meta, "_runtime_language": language or "en"}
            )
            available = bool(device_supported and implemented)
        options.append(
            {
                "key": key,
                "name": meta.get("name", key),
                "device": meta.get("device", "cpu_gpu"),
                "use_case": meta.get("use_case", ""),
                "languages": model_languages,
                "available": available,
                "implemented": implemented,
            }
        )
    return options


def clear_ocr_cache() -> None:
    _OCR_CACHE.clear()


def get_ocr_cache_size() -> int:
    return len(_OCR_CACHE)
