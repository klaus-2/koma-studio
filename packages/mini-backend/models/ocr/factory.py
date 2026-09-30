from __future__ import annotations

from collections.abc import Callable, Iterator, Mapping
from dataclasses import dataclass
from functools import cache
from importlib.util import find_spec
from typing import Any

from core.languages import normalize_language_code
from core.device import (
    register_gpu_cache_releaser,
    DeviceInfo,
    build_cpu_device_info,
    get_device_info,
    get_onnx_execution_providers,
)
from core.models_store import model_is_installed
from models.engine_cache import LruEngineCache
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


AUTO_KEY = "auto"
_MULTI = "multi"
_LATIN_LANGUAGE_CODES: tuple[str, ...] = (
    "fr", "de", "nl", "es", "it", "pt", "pt-br", "tr", "pl", "vi", "id", "hu", "fi",
)


@cache
def _module_importable(name: str) -> bool:
    # find_spec is microseconds; importing torch to "check" it costs seconds per call.
    return find_spec(name) is not None


def _torch_stack_available() -> bool:
    return _module_importable("torch") and _module_importable("transformers")


type _ReadyCheck = Callable[[str], bool]


def _language_agnostic(ready: Callable[[], bool]) -> _ReadyCheck:
    def check(_language: str) -> bool:
        return ready()

    return check


def _with_torch(ready: Callable[[], bool]) -> _ReadyCheck:
    def check(_language: str) -> bool:
        return _torch_stack_available() and ready()

    return check


def _easyocr_ready(language: str) -> bool:
    return _module_importable("easyocr") and easyocr_runtime_ready(
        resolve_easyocr_languages_for_source(language)
    )


def _pororo_ready(_language: str) -> bool:
    return _module_importable("torch") and _module_importable("torchvision") and pororo_runtime_ready()


_RUNTIME_READY: Mapping[str, _ReadyCheck] = {
    "manga_ocr": _language_agnostic(manga_ocr_runtime_ready),
    "meiki_ocr": _language_agnostic(meiki_runtime_ready),
    "paddleocr": _language_agnostic(lambda: paddleocr_runtime_ready("paddleocr")),
    "paddleocr_latin_v5": _language_agnostic(lambda: paddleocr_runtime_ready("paddleocr_latin_v5")),
    "paddleocr_ch_v5": _language_agnostic(lambda: paddleocr_runtime_ready("paddleocr_ch_v5")),
    "paddleocr_en_v5": _language_agnostic(lambda: paddleocr_runtime_ready("paddleocr_en_v5")),
    "easyocr": _easyocr_ready,
    "pororo": _pororo_ready,
    "paddleocr_vl_manga": _with_torch(paddleocr_vl_manga_runtime_ready),
    "glm_ocr_onnx": _with_torch(glm_ocr_onnx_runtime_ready),
    "got_ocr2": _with_torch(lambda: transformers_vlm_runtime_ready("got_ocr2")),
    "qwen2_5_vl_3b": _with_torch(lambda: transformers_vlm_runtime_ready("qwen2_5_vl_3b")),
    "mangalmm": _with_torch(lambda: transformers_vlm_runtime_ready("mangalmm")),
    "rolmocr": _with_torch(lambda: transformers_vlm_runtime_ready("rolmocr")),
    "paddleocr_vl_1_5": _with_torch(lambda: transformers_vlm_runtime_ready("paddleocr_vl_1_5")),
}


@dataclass(frozen=True, slots=True)
class _OcrModelSpec:
    key: str
    name: str
    languages: tuple[str, ...]
    device: str
    quality: str
    use_case: str
    implemented: bool = True


_SPECS: tuple[_OcrModelSpec, ...] = (
    _OcrModelSpec(
        AUTO_KEY, "Auto (Default)", (_MULTI,), "cpu_gpu", "Adaptive per language",
        "Picks the OCR engine by language (ja->manga_ocr, ko->pororo, en->paddleocr_en_v5, "
        "zh->paddleocr_ch_v5, ru->paddleocr, latin->paddleocr_latin_v5).",
    ),
    _OcrModelSpec("manga_ocr", "Manga OCR (ONNX)", ("ja",), "cpu_gpu", "Alta para japones",
                  "Japanese OCR (same base used by Baka)"),
    _OcrModelSpec("meiki_ocr", "Meiki OCR", ("ja",), "cpu_gpu", "Alta para japones renderizado",
                  "OCR japones especializado com modelos horizontal/vertical em ONNX."),
    _OcrModelSpec("paddleocr", "PaddleOCR v5 East Slavic (ONNX)", ("ru",), "cpu_gpu",
                  "Alta para russo/eslavo", "OCR russo com rec model East Slavic (eslav_PP-OCRv5)."),
    _OcrModelSpec("paddleocr_latin_v5", "PaddleOCR v5 Latin (ONNX)", _LATIN_LANGUAGE_CODES, "cpu_gpu",
                  "High for Latin-script languages",
                  "OCR for Latin-script languages (including Dutch) via latin_PP-OCRv5."),
    _OcrModelSpec("paddleocr_ch_v5", "PaddleOCR v5 Chinese (ONNX)", ("zh", "zh-cn", "zh-tw"), "cpu_gpu",
                  "High for Chinese", "Chinese OCR with ch_PP-OCRv5_rec_mobile_infer."),
    _OcrModelSpec("paddleocr_en_v5", "PaddleOCR v5 English (ONNX)", ("en",), "cpu_gpu",
                  "High for English", "English OCR with en_PP-OCRv5_mobile_rec (updated model)"),
    _OcrModelSpec("easyocr", "EasyOCR", ("en", "ko", "ja", "zh", "zh-cn", "zh-tw", "ru"), "cpu_gpu",
                  "Fallback", "Local multi-language OCR"),
    _OcrModelSpec("pororo", "Pororo OCR", ("ko",), "cpu_gpu", "Alta para coreano",
                  "OCR coreano (estilo Example/comic-translate)"),
    _OcrModelSpec("paddleocr_vl_manga", "PaddleOCR-VL Manga", ("ja",), "gpu", "VLM manga",
                  "OCR local VLM focado em manga japonesa."),
    _OcrModelSpec("got_ocr2", "GOT-OCR2", (_MULTI,), "gpu", "VLM OCR geral",
                  "OCR local multimodal via GOT-OCR 2.0."),
    _OcrModelSpec("qwen2_5_vl_3b", "Qwen2.5-VL 3B", (_MULTI,), "gpu_8gb+", "VLM OCR geral",
                  "OCR local via Qwen2.5-VL-3B-Instruct."),
    _OcrModelSpec("mangalmm", "MangaLMM", ("ja",), "gpu_8gb+", "VLM manga",
                  "OCR/entendimento multimodal especializado em manga."),
    _OcrModelSpec("rolmocr", "RolmOCR", (_MULTI,), "gpu_8gb+", "VLM documento/OCR",
                  "OCR local robusto com base Qwen2.5-VL."),
    _OcrModelSpec("glm_ocr_onnx", "GLM-OCR", ("zh", "en", "fr", "es", "ru", "de", "ja", "ko"), "gpu_8gb+",
                  "VLM OCR geral", "OCR local GLM com foco em layout complexo."),
    _OcrModelSpec("paddleocr_vl_1_5", "PaddleOCR-VL 1.5", (_MULTI,), "gpu", "VLM OCR multilingue",
                  "OCR VLM multilingue de alta qualidade (PaddleOCR-VL 1.5)."),
)


class _OcrModelsMapping(Mapping[str, dict[str, Any]]):
    """Read-only dict-shaped view of the spec table.

    ``OCR_MODELS`` historically was ``dict[str, dict[str, Any]]``; tests and
    the routers read ``meta["name"]``-style keys. The spec dataclass keeps
    typos out of new code while the view preserves every existing reader.
    """

    def __iter__(self) -> Iterator[str]:
        return iter(spec.key for spec in _SPECS)

    def __len__(self) -> int:
        return len(_SPECS)

    def __getitem__(self, key: str) -> dict[str, Any]:
        for spec in _SPECS:
            if spec.key == key:
                return {
                    "name": spec.name,
                    "languages": list(spec.languages),
                    "device": spec.device,
                    "quality": spec.quality,
                    "use_case": spec.use_case,
                    "implemented": spec.implemented,
                }
        raise KeyError(key)


OCR_MODELS: Mapping[str, dict[str, Any]] = _OcrModelsMapping()

_OCR_CACHE: LruEngineCache[tuple[str, str, str], BaseOCR] = LruEngineCache(6)


def _model_supports_language(
    model_languages: list[str] | tuple[str, ...], language: str | None
) -> bool:
    if not language:
        return True
    normalized = normalize_language_code(language, default="en", allow_auto=True).lower()
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


def _model_is_implemented(model_key: str, meta: Mapping[str, Any]) -> bool:
    if model_key == AUTO_KEY:
        return True
    if not bool(meta.get("implemented", False)):
        return False
    if not model_is_installed(model_key):
        return False
    check = _RUNTIME_READY.get(model_key)
    if check is None:
        return True
    return check(str(meta.get("_runtime_language") or "en"))


def _default_model_candidates_for_language(language: str) -> list[str]:
    normalized = normalize_language_code(language, default="en", allow_auto=False)
    if normalized == "ja":
        return ["meiki_ocr", "manga_ocr", "paddleocr_latin_v5", "paddleocr_ch_v5", "easyocr"]
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
        if _model_is_implemented(candidate, {**meta, "_runtime_language": language}):
            return candidate
    return None


def _cache_key(model_key: str, device_info: DeviceInfo, language: str) -> tuple[str, str, str]:
    provider = device_info.onnx_provider or ("CUDA" if device_info.has_gpu else "CPU")
    if model_key in {"easyocr", "pororo"}:
        return (
            model_key,
            provider,
            normalize_language_code(language, default="en", allow_auto=False),
        )
    return model_key, provider, "multi"


def _plain_providers(device: DeviceInfo) -> list[str]:
    return [str(p) for p in get_onnx_execution_providers(device)]


def _build_ocr_engine(model_key: str, device_info: DeviceInfo, language: str) -> BaseOCR:
    providers = _plain_providers(device_info)

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
        resolved_key = _resolve_auto_model(language=language, has_gpu=effective_gpu)
        if not resolved_key:
            raise RuntimeError(
                "No installed OCR model is available for this language. "
                "Install at least one OCR model in the Model Manager.",
            )
        selected_key = resolved_key
    else:
        selected_key = requested_key
        meta = OCR_MODELS.get(selected_key)
        if meta is None or selected_key == AUTO_KEY:
            raise RuntimeError(f"Invalid OCR model: {selected_key}")
        if not _model_is_implemented(selected_key, {**meta, "_runtime_language": language}):
            raise RuntimeError(
                f"OCR model '{selected_key}' is not installed. "
                "Install it in the Model Manager before using it.",
            )

    key = _cache_key(selected_key, device_info, language)
    return _OCR_CACHE.get_or_build(
        key,
        lambda: _build_ocr_engine(selected_key, device_info=device_info, language=language),
    )


def list_ocr_models(has_gpu: bool, language: str | None = None) -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for key, meta in OCR_MODELS.items():
        model_languages = [str(item) for item in meta["languages"]]
        if not _model_supports_language(model_languages, language):
            continue
        if key == AUTO_KEY:
            probe_language = language or "en"
            auto_resolved_model = _resolve_auto_model(
                language=probe_language,
                has_gpu=has_gpu,
            )
            implemented = True
            available = auto_resolved_model is not None
        else:
            implemented = _model_is_implemented(key, {**meta, "_runtime_language": language or "en"})
            available = implemented
        options.append(
            {
                "key": key,
                "name": meta["name"],
                "device": meta["device"],
                "use_case": meta["use_case"],
                "languages": model_languages,
                "available": available,
                "implemented": implemented,
            }
        )
    return options


@register_gpu_cache_releaser
def clear_ocr_cache() -> None:
    _OCR_CACHE.clear()


def get_ocr_cache_size() -> int:
    return len(_OCR_CACHE)