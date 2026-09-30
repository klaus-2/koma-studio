"""Single source of truth for inpainting models: metadata, download source and runtime hints.

Previously the metadata lived in ``factory.INPAINT_MODELS`` and the download
sources in ``storage._INPAINTING_MODEL_SOURCES`` — the same registry twice,
which drifted independently.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

# Hashes/repos copied verbatim from the historical storage registry — they are
# wire contracts with HuggingFace and must not change in a refactor.
_SHA_AOT = "ffd39ed8e2a275869d3b49180d030f0d8b8b9c2c20ed0e099ecd207201f0eada"
_SHA_LAMA_MANGA = "de31ffa5ba26916b8ea35319f6c12151ff9654d4261bccf0583a69bb095315f9"
_SHA_OPENCV_LAMA = "7df918ac3921d3daf0aae1d219776cf0dc4e4935f035af81841b40adcf74fdf2"
_SHA_LAMA_FP32 = "1faef5301d78db7dda502fe59966957ec4b79dd64e16f03ed96913c7a4eb68d6"


@dataclass(frozen=True, slots=True)
class InpaintModelSpec:
    key: str
    name: str
    quality: str
    use_case: str
    repo: str
    target_file: str
    source_candidates: tuple[str, ...]
    sha256: str
    # Small LaMa exports are faster on CPU than paying the CUDA transfer cost per tile.
    cpu_only: bool = False
    device: str = "cpu_gpu"


INPAINT_MODEL_SPECS: Mapping[str, InpaintModelSpec] = {
    spec.key: spec
    for spec in (
        InpaintModelSpec(
            key="aot",
            name="AOT (ONNX)",
            quality="★★★★ manga-specific",
            use_case="Same AOT model used by Baka for text cleaning",
            repo="ogkalu/aot-inpainting",
            target_file="aot.onnx",
            source_candidates=("aot.onnx", "model.onnx"),
            sha256=_SHA_AOT,
        ),
        InpaintModelSpec(
            key="lama_manga",
            name="LaMa Manga Dynamic (ONNX)",
            quality="★★★★ context-aware",
            use_case="Same LaMa model used by Baka for contextual inpainting",
            repo="ogkalu/lama-manga-onnx-dynamic",
            target_file="lama-manga-dynamic.onnx",
            source_candidates=("lama-manga-dynamic.onnx", "model.onnx", "lama_manga.onnx", "lama.onnx"),
            sha256=_SHA_LAMA_MANGA,
        ),
        InpaintModelSpec(
            key="opencv_lama",
            name="OpenCV LaMa (ONNX)",
            quality="★★★ lightweight",
            use_case="Lightweight LaMa model from the OpenCV Zoo, good for CPU and fast workloads",
            repo="opencv/inpainting_lama",
            target_file="inpainting_lama_2025jan.onnx",
            source_candidates=("inpainting_lama_2025jan.onnx", "lama.onnx", "model.onnx"),
            sha256=_SHA_OPENCV_LAMA,
            cpu_only=True,
        ),
        InpaintModelSpec(
            key="lama_fp32",
            name="LaMa FP32 512 (ONNX)",
            quality="★★★★ classic-lama",
            use_case="Recommended ONNX port of big-lama at 512x512 for CPU/GPU",
            repo="Carve/LaMa-ONNX",
            target_file="lama_fp32.onnx",
            source_candidates=("lama_fp32.onnx",),
            sha256=_SHA_LAMA_FP32,
            cpu_only=True,
        ),
    )
}

AUTO_PREFERENCE: tuple[str, ...] = ("lama_manga", "lama_fp32", "opencv_lama", "aot")


class UnknownInpaintModelError(KeyError):
    """Requested model key is not part of the registry."""


def get_spec(model_key: str) -> InpaintModelSpec:
    normalized = model_key.strip().lower()
    try:
        return INPAINT_MODEL_SPECS[normalized]
    except KeyError as exc:
        raise UnknownInpaintModelError(f"Invalid inpainting model: {model_key!r}") from exc
