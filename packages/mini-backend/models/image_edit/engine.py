from __future__ import annotations

import inspect
import logging
from io import BytesIO
from pathlib import Path
from typing import Any, Sequence

from PIL import Image

from core.device import release_gpu_memory
from models.errors import GpuOutOfMemoryError, InferenceError
from models.execution import run_inference
from models.image_edit.registry import LocalImageEditModelSpec, get_local_image_edit_spec
from models.image_edit.storage import (
    missing_local_image_edit_files,
    resolve_local_image_edit_model_dir,
)
from models.ocr.common import (
    LazyRuntime,
    ModelFilesMissingError,
    RuntimeDependencyMissingError,
)
from schemas.image_edit import AioAiOptions, ImageEditModelConfig

logger = logging.getLogger(__name__)

_ALIGNMENT_PX = 16
_LOW_VRAM_THRESHOLD_BYTES = 16 * 1024**3


class LocalImageEditError(InferenceError):
    pass


def _is_oom_exception(exc: BaseException) -> bool:
    name = type(exc).__name__.lower()
    message = str(exc).lower()
    return "outofmemory" in name or "out of memory" in message or "cuda error: out of memory" in message


def _compact_words(text: str, max_words: int) -> str:
    words = text.split()
    if len(words) <= max_words:
        return " ".join(words)
    return " ".join(words[:max_words])


def _region_bbox_labels(regions: Sequence[dict[str, Any]], limit: int = 8) -> list[str]:
    labels: list[str] = []
    for region in regions[:limit]:
        bbox = region.get("bbox")
        if isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
            labels.append(f"[{int(bbox[0])},{int(bbox[1])},{int(bbox[2])},{int(bbox[3])}]")
    return labels


def _clean_prompt_for_local_model(
    *,
    spec: LocalImageEditModelSpec,
    regions: Sequence[dict[str, Any]],
    additional_instructions: str,
) -> str:
    extra = " ".join(additional_instructions.split())
    if spec.pipeline_kind in {"sd15_instruct_pix2pix", "sdxl_instruct_pix2pix"}:
        base = (
            "Remove all comic text and sound effects inside speech balloons cleanly "
            "while keeping characters, artwork, line art, and bubble borders unchanged."
        )
        if extra:
            base = f"{base} {extra}"
        return _compact_words(base, 64)

    coords = _region_bbox_labels(regions)
    region_hint = f" Focus on regions {', '.join(coords)}." if coords else ""
    base = (
        "Remove only the existing text, lettering, and sound effects on this comic page. "
        "Reconstruct clean balloon interiors and underlying artwork seamlessly without "
        "altering characters, panel borders, or bubble outlines."
        f"{region_hint}"
    )
    if spec.pipeline_kind == "longcat_image_edit":
        base = (
            "Erase all existing text and lettering cleanly without changing characters, "
            "bubble borders, or panel artwork."
            f"{region_hint}"
        )
    if extra:
        return f"{base} Additional instructions: {extra}"
    return base


def _aio_ai_prompt_for_local_model(
    *,
    spec: LocalImageEditModelSpec,
    regions: Sequence[dict[str, Any]],
    aio_options: AioAiOptions | None,
    source_language: str | None = None,
    target_language: str | None = None,
    additional_instructions: str,
) -> str:
    if spec.compatibility == "clean_only":
        raise LocalImageEditError(
            f"Local model '{spec.name}' ({spec.key}) supports AI Clean only and cannot perform "
            "full AIO IA OCR, translation, and typesetting. Choose FLUX.2 Klein 4B, "
            "LongCat-Image-Edit Turbo, Qwen-Image-Edit 2511, or FireRed-Image-Edit 1.1."
        )

    source_lang = (source_language or "").strip() or "auto"
    target_lang = (target_language or "").strip() or "pt-BR"
    style_mode = aio_options.style_mode if aio_options else "match_original"
    sfx_mode = aio_options.sfx_mode if aio_options else "translate"
    refine_alignment = aio_options.refine_alignment if aio_options else True

    quoted_entries: list[str] = []
    for idx, region in enumerate(regions[:8], start=1):
        bbox = region.get("bbox")
        raw_text = region.get("translated_text") or region.get("target_text") or ""
        target_text = str(raw_text).strip().replace('"', "'")
        if isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
            box_str = f"[{int(bbox[0])},{int(bbox[1])},{int(bbox[2])},{int(bbox[3])}]"
        else:
            box_str = f"region_{idx}"
        if target_text:
            quoted_entries.append(f'in {box_str} replace text with "{target_text}"')
        else:
            quoted_entries.append(f"translate and typeset text inside {box_str}")

    sfx_hint = (
        "Translate sound effects too."
        if sfx_mode == "translate"
        else "Keep original sound effects untouched."
        if sfx_mode == "keep"
        else "Erase sound effects cleanly without replacing them."
    )
    alignment_hint = (
        "Center text cleanly inside each bubble safe interior contour without overlapping borders or tails."
        if refine_alignment
        else "Keep translated text aligned cleanly inside each balloon."
    )

    if spec.pipeline_kind == "longcat_image_edit":
        edits = "; ".join(quoted_entries) if quoted_entries else (
            f'translate all comic text from {source_lang} into "{target_lang}" inside each balloon'
        )
        prompt = (
            f"On this comic page, replace the original text cleanly and render crisp typeset text: "
            f"{edits}. {sfx_hint} {alignment_hint} Preserve characters, backgrounds, and bubble borders."
        )
    else:
        style_hint = (
            "Match original font weight, stroke, color, and centering inside each balloon."
            if style_mode == "match_original"
            else "Use clean, legible comic lettering centered inside each balloon."
            if style_mode == "clean_comic"
            else "Follow custom typesetting style carefully inside each balloon."
        )
        region_block = (
            "; ".join(quoted_entries)
            if quoted_entries
            else "translate all visible speech bubbles and sound effects cleanly."
        )
        prompt = (
            f"Translate all comic/manga text on this page from {source_lang} into {target_lang}, "
            f"clean original text completely, and typeset the translated text inside each balloon. "
            f"{style_hint} {sfx_hint} {alignment_hint} "
            f"Preserve all characters, line art, and bubble borders exactly. Edits: {region_block}"
        )

    extra = " ".join(additional_instructions.split())
    if extra:
        prompt = f"{prompt} Additional instructions: {extra}"
    return prompt


def prepare_local_edit_prompt(
    *,
    spec: LocalImageEditModelSpec,
    mode: str,
    regions: Sequence[dict[str, Any]],
    additional_instructions: str = "",
    aio_options: AioAiOptions | None = None,
    source_language: str | None = None,
    target_language: str | None = None,
) -> str:
    if mode == "aio_ai":
        return _aio_ai_prompt_for_local_model(
            spec=spec,
            regions=regions,
            aio_options=aio_options,
            source_language=source_language,
            target_language=target_language,
            additional_instructions=additional_instructions,
        )
    return _clean_prompt_for_local_model(
        spec=spec,
        regions=regions,
        additional_instructions=additional_instructions,
    )


def _sample_border_color(image: Image.Image) -> tuple[int, int, int]:
    rgb = image.convert("RGB")
    corners = (
        rgb.getpixel((0, 0)),
        rgb.getpixel((max(0, rgb.width - 1), 0)),
        rgb.getpixel((0, max(0, rgb.height - 1))),
        rgb.getpixel((max(0, rgb.width - 1), max(0, rgb.height - 1))),
    )
    r = sum(int(c[0]) for c in corners) // 4
    g = sum(int(c[1]) for c in corners) // 4
    b = sum(int(c[2]) for c in corners) // 4
    return (r, g, b)


def _prepare_working_image(
    image: Image.Image,
    *,
    max_edge_px: int,
) -> tuple[Image.Image, tuple[int, int], tuple[int, int]]:
    rgb = image.convert("RGB")
    orig_w, orig_h = rgb.size
    max_dim = max(orig_w, orig_h)
    if max_dim > max_edge_px and max_dim > 0:
        scale = max_edge_px / float(max_dim)
        scaled_w = max(_ALIGNMENT_PX, int(round(orig_w * scale)))
        scaled_h = max(_ALIGNMENT_PX, int(round(orig_h * scale)))
        work = rgb.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
    else:
        scaled_w, scaled_h = orig_w, orig_h
        work = rgb

    aligned_w = ((scaled_w + _ALIGNMENT_PX - 1) // _ALIGNMENT_PX) * _ALIGNMENT_PX
    aligned_h = ((scaled_h + _ALIGNMENT_PX - 1) // _ALIGNMENT_PX) * _ALIGNMENT_PX
    if aligned_w != scaled_w or aligned_h != scaled_h:
        canvas = Image.new("RGB", (aligned_w, aligned_h), _sample_border_color(work))
        canvas.paste(work, (0, 0))
        return canvas, (scaled_w, scaled_h), (orig_w, orig_h)
    return work, (scaled_w, scaled_h), (orig_w, orig_h)


def _restore_edited_image(
    edited: Image.Image,
    *,
    scaled_size: tuple[int, int],
    orig_size: tuple[int, int],
) -> Image.Image:
    rgb = edited.convert("RGB")
    scaled_w, scaled_h = scaled_size
    if rgb.width > scaled_w or rgb.height > scaled_h:
        if rgb.width >= scaled_w and rgb.height >= scaled_h:
            rgb = rgb.crop((0, 0, scaled_w, scaled_h))
    if rgb.size != orig_size:
        rgb = rgb.resize(orig_size, Image.Resampling.LANCZOS)
    return rgb


def _detect_free_vram_bytes(torch_mod: Any) -> int | None:
    try:
        if torch_mod.cuda.is_available():
            free_bytes, _total_bytes = torch_mod.cuda.mem_get_info(0)
            return int(free_bytes)
    except Exception:  # noqa: BLE001
        return None
    return None


def _select_device_and_dtype(
    torch_mod: Any,
    spec: LocalImageEditModelSpec,
) -> tuple[str, Any, int | None]:
    if torch_mod.cuda.is_available():
        free_vram = _detect_free_vram_bytes(torch_mod)
        if spec.pipeline_kind == "sd15_instruct_pix2pix":
            return "cuda", torch_mod.float16, free_vram
        bf16_ok = False
        try:
            bf16_ok = bool(torch_mod.cuda.is_bf16_supported())
        except Exception:  # noqa: BLE001
            bf16_ok = False
        dtype = torch_mod.bfloat16 if bf16_ok else torch_mod.float16
        return "cuda", dtype, free_vram

    mps = getattr(getattr(torch_mod, "backends", None), "mps", None)
    if mps is not None and mps.is_available():
        return "mps", torch_mod.float16, None

    return "cpu", torch_mod.float32, None


def _apply_memory_optimizations(
    pipe: Any,
    *,
    spec: LocalImageEditModelSpec,
    device: str,
    free_vram_bytes: int | None,
) -> None:
    vae_slicing = getattr(pipe, "enable_vae_slicing", None)
    if callable(vae_slicing):
        vae_slicing()
    vae_tiling = getattr(pipe, "enable_vae_tiling", None)
    if callable(vae_tiling) and spec.min_vram_gb >= 8:
        vae_tiling()

    if device != "cuda":
        to_fn = getattr(pipe, "to", None)
        if callable(to_fn):
            to_fn(device)
        return

    free_gb = (free_vram_bytes / (1024**3)) if free_vram_bytes is not None else 0.0
    if spec.pipeline_kind in {"qwen_image_edit_plus", "longcat_image_edit"} and free_gb < spec.min_vram_gb:
        seq_offload = getattr(pipe, "enable_sequential_cpu_offload", None)
        if callable(seq_offload):
            seq_offload()
            return

    if free_vram_bytes is None or free_gb < (spec.min_vram_gb + 4):
        model_offload = getattr(pipe, "enable_model_cpu_offload", None)
        if callable(model_offload):
            model_offload()
            return

    if spec.pipeline_kind in {"sd15_instruct_pix2pix", "sdxl_instruct_pix2pix"} and (
        free_vram_bytes is not None and free_vram_bytes < _LOW_VRAM_THRESHOLD_BYTES
    ):
        attn_slicing = getattr(pipe, "enable_attention_slicing", None)
        if callable(attn_slicing):
            attn_slicing()

    to_fn = getattr(pipe, "to", None)
    if callable(to_fn):
        to_fn("cuda")


def _load_diffusers_pipeline(spec: LocalImageEditModelSpec, model_dir: Path) -> tuple[Any, Any, str]:
    try:
        import torch  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeDependencyMissingError(spec.key, "torch>=2.5.0") from exc

    try:
        import diffusers  # noqa: PLC0415
    except ImportError as exc:
        raise RuntimeDependencyMissingError(
            spec.key,
            "diffusers>=0.37.0 (with accelerate, safetensors, gguf)",
        ) from exc

    missing = missing_local_image_edit_files(spec.key, model_dir)
    if missing:
        raise ModelFilesMissingError(model_dir, missing)

    release_gpu_memory(force=True)
    device, dtype, free_vram = _select_device_and_dtype(torch, spec)
    kind = spec.pipeline_kind

    try:
        if kind == "sd15_instruct_pix2pix":
            pipe = diffusers.StableDiffusionInstructPix2PixPipeline.from_pretrained(
                str(model_dir),
                torch_dtype=dtype,
                variant="fp16",
                safety_checker=None,
                requires_safety_checker=False,
                local_files_only=True,
            )
            pipe.scheduler = diffusers.EulerAncestralDiscreteScheduler.from_config(
                pipe.scheduler.config
            )
        elif kind == "sdxl_instruct_pix2pix":
            pipe = diffusers.StableDiffusionXLInstructPix2PixPipeline.from_pretrained(
                str(model_dir),
                torch_dtype=dtype,
                safety_checker=None,
                requires_safety_checker=False,
                local_files_only=True,
            )
        elif kind == "flux2_klein":
            pipe = diffusers.Flux2KleinPipeline.from_pretrained(
                str(model_dir),
                torch_dtype=dtype,
                local_files_only=True,
            )
        elif kind == "flux2_klein_gguf":
            gguf_rel = spec.gguf_local_rel_path
            if not gguf_rel:
                raise LocalImageEditError(f"Missing GGUF path metadata for {spec.key}.")
            gguf_cfg = diffusers.GGUFQuantizationConfig(compute_dtype=dtype)
            transformer = diffusers.Flux2Transformer2DModel.from_single_file(
                str(model_dir / gguf_rel),
                quantization_config=gguf_cfg,
                config=str(model_dir / "transformer"),
                torch_dtype=dtype,
                local_files_only=True,
            )
            pipe = diffusers.Flux2KleinPipeline.from_pretrained(
                str(model_dir),
                transformer=transformer,
                torch_dtype=dtype,
                local_files_only=True,
            )
        elif kind == "longcat_image_edit":
            pipe = diffusers.LongCatImageEditPipeline.from_pretrained(
                str(model_dir),
                torch_dtype=dtype,
                local_files_only=True,
            )
        elif kind == "qwen_image_edit_plus":
            pipe = diffusers.QwenImageEditPlusPipeline.from_pretrained(
                str(model_dir),
                torch_dtype=dtype,
                local_files_only=True,
            )
        elif kind == "qwen_image_edit_plus_gguf":
            gguf_rel = spec.gguf_local_rel_path
            if not gguf_rel:
                raise LocalImageEditError(f"Missing GGUF path metadata for {spec.key}.")
            gguf_cfg = diffusers.GGUFQuantizationConfig(compute_dtype=dtype)
            transformer = diffusers.QwenImageTransformer2DModel.from_single_file(
                str(model_dir / gguf_rel),
                quantization_config=gguf_cfg,
                config=str(model_dir / "transformer"),
                torch_dtype=dtype,
                local_files_only=True,
            )
            pipe = diffusers.QwenImageEditPlusPipeline.from_pretrained(
                str(model_dir),
                transformer=transformer,
                torch_dtype=dtype,
                local_files_only=True,
            )
        else:
            raise LocalImageEditError(f"Unsupported pipeline kind: {kind!r}")

        _apply_memory_optimizations(
            pipe,
            spec=spec,
            device=device,
            free_vram_bytes=free_vram,
        )
    except (RuntimeDependencyMissingError, ModelFilesMissingError, LocalImageEditError):
        raise
    except Exception as exc:  # noqa: BLE001
        if _is_oom_exception(exc):
            release_gpu_memory(force=True)
            raise GpuOutOfMemoryError(
                f"Insufficient GPU memory while loading {spec.name}. Close other GPU apps or "
                "select a lighter quantized model."
            ) from exc
        raise LocalImageEditError(f"Failed to load local model {spec.name}: {exc}") from exc

    return pipe, torch, device


class LocalImageEditEngine:

    def __init__(self, model_id: str) -> None:
        spec = get_local_image_edit_spec(model_id)
        if spec is None:
            raise ValueError(f"Unsupported local image-edit model: {model_id!r}")
        self.spec: LocalImageEditModelSpec = spec
        self._runtime: LazyRuntime[tuple[Any, Any, str]] = LazyRuntime(self._build_runtime)

    def _build_runtime(self) -> tuple[Any, Any, str]:
        model_dir = resolve_local_image_edit_model_dir(self.spec.key)
        if model_dir is None:
            raise LocalImageEditError(
                f"KOMA_MODELS_ROOT is not configured for local model '{self.spec.key}'."
            )
        return _load_diffusers_pipeline(self.spec, model_dir)

    def close(self) -> None:
        self._runtime = LazyRuntime(self._build_runtime)
        release_gpu_memory(force=True)

    def _build_call_kwargs(
        self,
        *,
        pipe: Any,
        torch_mod: Any,
        work_image: Image.Image,
        prompt: str,
        model_config: ImageEditModelConfig | None,
    ) -> dict[str, Any]:
        steps = (
            model_config.num_inference_steps
            if model_config is not None and model_config.num_inference_steps is not None
            else self.spec.default_steps
        )
        guidance = (
            model_config.guidance_scale
            if model_config is not None and model_config.guidance_scale is not None
            else self.spec.default_guidance_scale
        )
        fidelity = model_config.input_fidelity if model_config is not None else "high"
        seed = model_config.seed if model_config is not None else None

        image_arg: Any = (
            [work_image]
            if self.spec.pipeline_kind in {"qwen_image_edit_plus", "qwen_image_edit_plus_gguf"}
            else work_image
        )
        candidate: dict[str, Any] = {
            "prompt": prompt,
            "image": image_arg,
            "num_inference_steps": steps,
            "width": work_image.width,
            "height": work_image.height,
        }
        if self.spec.pipeline_kind in {"qwen_image_edit_plus", "qwen_image_edit_plus_gguf"}:
            candidate["true_cfg_scale"] = guidance
            candidate["guidance_scale"] = 1.0
            candidate["negative_prompt"] = " "
        else:
            candidate["guidance_scale"] = guidance

        if self.spec.default_image_guidance_scale is not None:
            candidate["image_guidance_scale"] = 2.0 if fidelity == "high" else 1.2

        if seed is not None:
            candidate["generator"] = torch_mod.Generator(device="cpu").manual_seed(int(seed))

        try:
            sig = inspect.signature(pipe.__call__)
            params = sig.parameters
            accepts_var_kw = any(
                p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values()
            )
            if not accepts_var_kw:
                candidate = {k: v for k, v in candidate.items() if k in params}
        except (TypeError, ValueError):
            pass

        return candidate

    def edit_image_sync(
        self,
        *,
        image: Image.Image,
        mode: str,
        regions: Sequence[dict[str, Any]],
        additional_instructions: str = "",
        aio_options: AioAiOptions | None = None,
        model_config: ImageEditModelConfig | None = None,
        source_language: str | None = None,
        target_language: str | None = None,
    ) -> bytes:
        prompt = prepare_local_edit_prompt(
            spec=self.spec,
            mode=mode,
            regions=regions,
            additional_instructions=additional_instructions,
            aio_options=aio_options,
            source_language=source_language,
            target_language=target_language,
        )
        work_image, scaled_size, orig_size = _prepare_working_image(
            image,
            max_edge_px=self.spec.max_edge_px,
        )
        pipe, torch_mod, _device = self._runtime.get()
        call_kwargs = self._build_call_kwargs(
            pipe=pipe,
            torch_mod=torch_mod,
            work_image=work_image,
            prompt=prompt,
            model_config=model_config,
        )

        try:
            with torch_mod.inference_mode():
                result = pipe(**call_kwargs)
        except Exception as exc:  # noqa: BLE001
            if _is_oom_exception(exc):
                release_gpu_memory(force=True)
                raise GpuOutOfMemoryError(
                    f"Out of GPU memory during {self.spec.name} inference. Enable segmentation or "
                    "choose a GGUF/smaller model."
                ) from exc
            raise LocalImageEditError(f"{self.spec.name} inference failed: {exc}") from exc

        images = getattr(result, "images", None)
        if not isinstance(images, Sequence) or not images:
            raise LocalImageEditError(f"{self.spec.name} returned no edited image.")

        edited = _restore_edited_image(
            images[0],
            scaled_size=scaled_size,
            orig_size=orig_size,
        )
        buffer = BytesIO()
        edited.save(buffer, format="PNG")
        return buffer.getvalue()

    async def edit_image_async(
        self,
        *,
        image: Image.Image,
        mode: str,
        regions: Sequence[dict[str, Any]],
        additional_instructions: str = "",
        aio_options: AioAiOptions | None = None,
        model_config: ImageEditModelConfig | None = None,
        source_language: str | None = None,
        target_language: str | None = None,
    ) -> bytes:
        return await run_inference(
            lambda: self.edit_image_sync(
                image=image,
                mode=mode,
                regions=regions,
                additional_instructions=additional_instructions,
                aio_options=aio_options,
                model_config=model_config,
                source_language=source_language,
                target_language=target_language,
            )
        )
