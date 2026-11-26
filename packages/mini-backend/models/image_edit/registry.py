from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

LOCAL_IMAGE_EDIT_MODEL_PREFIX: Final = "local_image_edit:"

LocalImageEditPipelineKind = Literal[
    "sd15_instruct_pix2pix",
    "sdxl_instruct_pix2pix",
    "flux2_klein",
    "flux2_klein_gguf",
    "longcat_image_edit",
    "qwen_image_edit_plus",
    "qwen_image_edit_plus_gguf",
]

LocalImageEditCompatibility = Literal["clean_only", "clean_and_aio_ai"]


@dataclass(frozen=True)
class HfAssetGroup:

    hf_repo: str
    files: tuple[str, ...]
    targets: tuple[tuple[str, str], ...] = ()

    def target_for(self, repo_path: str) -> str:
        for src, dst in self.targets:
            if src == repo_path:
                return dst
        return repo_path


@dataclass(frozen=True)
class LocalImageEditModelSpec:

    key: str
    name: str
    pipeline_kind: LocalImageEditPipelineKind
    compatibility: LocalImageEditCompatibility
    hf_repo: str
    gguf_repo: str | None
    gguf_filename: str | None
    license: str
    min_vram_gb: int
    recommended_ram_gb: int
    default_steps: int
    default_guidance_scale: float
    default_image_guidance_scale: float | None
    max_edge_px: int
    use_case: str
    assets: tuple[HfAssetGroup, ...]

    def required_local_paths(self) -> tuple[str, ...]:
        paths: list[str] = []
        for group in self.assets:
            for repo_path in group.files:
                paths.append(group.target_for(repo_path))
        return tuple(paths)

    @property
    def gguf_local_rel_path(self) -> str | None:
        if not self.gguf_filename:
            return None
        return f"gguf/{self.gguf_filename}"


_FLUX2_KLEIN_BASE_FILES: Final[tuple[str, ...]] = (
    "model_index.json",
    "scheduler/scheduler_config.json",
    "text_encoder/config.json",
    "text_encoder/generation_config.json",
    "text_encoder/model-00001-of-00002.safetensors",
    "text_encoder/model-00002-of-00002.safetensors",
    "text_encoder/model.safetensors.index.json",
    "tokenizer/added_tokens.json",
    "tokenizer/chat_template.jinja",
    "tokenizer/merges.txt",
    "tokenizer/special_tokens_map.json",
    "tokenizer/tokenizer.json",
    "tokenizer/tokenizer_config.json",
    "tokenizer/vocab.json",
    "transformer/config.json",
    "vae/config.json",
    "vae/diffusion_pytorch_model.safetensors",
)

_QWEN_EDIT_BASE_FILES: Final[tuple[str, ...]] = (
    "model_index.json",
    "processor/added_tokens.json",
    "processor/chat_template.jinja",
    "processor/merges.txt",
    "processor/preprocessor_config.json",
    "processor/special_tokens_map.json",
    "processor/tokenizer.json",
    "processor/tokenizer_config.json",
    "processor/video_preprocessor_config.json",
    "processor/vocab.json",
    "scheduler/scheduler_config.json",
    "text_encoder/config.json",
    "text_encoder/generation_config.json",
    "text_encoder/model-00001-of-00004.safetensors",
    "text_encoder/model-00002-of-00004.safetensors",
    "text_encoder/model-00003-of-00004.safetensors",
    "text_encoder/model-00004-of-00004.safetensors",
    "text_encoder/model.safetensors.index.json",
    "tokenizer/added_tokens.json",
    "tokenizer/chat_template.jinja",
    "tokenizer/merges.txt",
    "tokenizer/special_tokens_map.json",
    "tokenizer/tokenizer_config.json",
    "tokenizer/vocab.json",
    "transformer/config.json",
    "vae/config.json",
    "vae/diffusion_pytorch_model.safetensors",
)

_QWEN_TRANSFORMER_FILES: Final[tuple[str, ...]] = (
    "transformer/diffusion_pytorch_model-00001-of-00005.safetensors",
    "transformer/diffusion_pytorch_model-00002-of-00005.safetensors",
    "transformer/diffusion_pytorch_model-00003-of-00005.safetensors",
    "transformer/diffusion_pytorch_model-00004-of-00005.safetensors",
    "transformer/diffusion_pytorch_model-00005-of-00005.safetensors",
    "transformer/diffusion_pytorch_model.safetensors.index.json",
)


LOCAL_IMAGE_EDIT_SPECS: Final[dict[str, LocalImageEditModelSpec]] = {
    "instruct_pix2pix": LocalImageEditModelSpec(
        key="instruct_pix2pix",
        name="InstructPix2Pix (FP16)",
        pipeline_kind="sd15_instruct_pix2pix",
        compatibility="clean_only",
        hf_repo="timbrooks/instruct-pix2pix",
        gguf_repo=None,
        gguf_filename=None,
        license="MIT",
        min_vram_gb=4,
        recommended_ram_gb=8,
        default_steps=20,
        default_guidance_scale=7.5,
        default_image_guidance_scale=1.5,
        max_edge_px=768,
        use_case="Lightweight local img-to-img editing for AI Clean (4 GB VRAM)",
        assets=(
            HfAssetGroup(
                hf_repo="timbrooks/instruct-pix2pix",
                files=(
                    "model_index.json",
                    "scheduler/scheduler_config.json",
                    "text_encoder/config.json",
                    "text_encoder/model.fp16.safetensors",
                    "tokenizer/merges.txt",
                    "tokenizer/special_tokens_map.json",
                    "tokenizer/tokenizer_config.json",
                    "tokenizer/vocab.json",
                    "unet/config.json",
                    "unet/diffusion_pytorch_model.fp16.safetensors",
                    "vae/config.json",
                    "vae/diffusion_pytorch_model.fp16.safetensors",
                ),
            ),
        ),
    ),
    "sdxl_instruct_pix2pix": LocalImageEditModelSpec(
        key="sdxl_instruct_pix2pix",
        name="SDXL InstructPix2Pix 768",
        pipeline_kind="sdxl_instruct_pix2pix",
        compatibility="clean_only",
        hf_repo="diffusers/sdxl-instructpix2pix-768",
        gguf_repo=None,
        gguf_filename=None,
        license="OpenRAIL++",
        min_vram_gb=8,
        recommended_ram_gb=16,
        default_steps=20,
        default_guidance_scale=7.5,
        default_image_guidance_scale=1.5,
        max_edge_px=1024,
        use_case="Higher-resolution local SDXL img-to-img cleaning (AI Clean only, 8 GB VRAM)",
        assets=(
            HfAssetGroup(
                hf_repo="diffusers/sdxl-instructpix2pix-768",
                files=(
                    "model_index.json",
                    "scheduler/scheduler_config.json",
                    "text_encoder/config.json",
                    "text_encoder/model.safetensors",
                    "text_encoder_2/config.json",
                    "text_encoder_2/model.safetensors",
                    "tokenizer/merges.txt",
                    "tokenizer/special_tokens_map.json",
                    "tokenizer/tokenizer_config.json",
                    "tokenizer/vocab.json",
                    "tokenizer_2/merges.txt",
                    "tokenizer_2/special_tokens_map.json",
                    "tokenizer_2/tokenizer_config.json",
                    "tokenizer_2/vocab.json",
                    "unet/config.json",
                    "unet/diffusion_pytorch_model.safetensors",
                    "vae/config.json",
                    "vae/diffusion_pytorch_model.safetensors",
                ),
            ),
        ),
    ),
    "flux2_klein_4b_gguf_q4": LocalImageEditModelSpec(
        key="flux2_klein_4b_gguf_q4",
        name="FLUX.2 Klein 4B (GGUF Q4_K_M)",
        pipeline_kind="flux2_klein_gguf",
        compatibility="clean_and_aio_ai",
        hf_repo="black-forest-labs/FLUX.2-klein-4B",
        gguf_repo="unsloth/FLUX.2-klein-4B-GGUF",
        gguf_filename="flux-2-klein-4b-Q4_K_M.gguf",
        license="Apache-2.0",
        min_vram_gb=8,
        recommended_ram_gb=16,
        default_steps=4,
        default_guidance_scale=1.0,
        default_image_guidance_scale=None,
        max_edge_px=1024,
        use_case="Recommended 4-step local GGUF model for AI Clean & AIO IA (8 GB VRAM)",
        assets=(
            HfAssetGroup(
                hf_repo="black-forest-labs/FLUX.2-klein-4B",
                files=_FLUX2_KLEIN_BASE_FILES,
            ),
            HfAssetGroup(
                hf_repo="unsloth/FLUX.2-klein-4B-GGUF",
                files=("flux-2-klein-4b-Q4_K_M.gguf",),
                targets=(
                    ("flux-2-klein-4b-Q4_K_M.gguf", "gguf/flux-2-klein-4b-Q4_K_M.gguf"),
                ),
            ),
        ),
    ),
    "flux2_klein_4b": LocalImageEditModelSpec(
        key="flux2_klein_4b",
        name="FLUX.2 Klein 4B (BF16)",
        pipeline_kind="flux2_klein",
        compatibility="clean_and_aio_ai",
        hf_repo="black-forest-labs/FLUX.2-klein-4B",
        gguf_repo=None,
        gguf_filename=None,
        license="Apache-2.0",
        min_vram_gb=12,
        recommended_ram_gb=24,
        default_steps=4,
        default_guidance_scale=1.0,
        default_image_guidance_scale=None,
        max_edge_px=1280,
        use_case="Fast 4-step BF16 local model with strong typography for AI Clean & AIO IA",
        assets=(
            HfAssetGroup(
                hf_repo="black-forest-labs/FLUX.2-klein-4B",
                files=(*_FLUX2_KLEIN_BASE_FILES, "transformer/diffusion_pytorch_model.safetensors"),
            ),
        ),
    ),
    "longcat_image_edit_turbo": LocalImageEditModelSpec(
        key="longcat_image_edit_turbo",
        name="LongCat-Image-Edit Turbo",
        pipeline_kind="longcat_image_edit",
        compatibility="clean_and_aio_ai",
        hf_repo="meituan-longcat/LongCat-Image-Edit-Turbo",
        gguf_repo=None,
        gguf_filename=None,
        license="Apache-2.0",
        min_vram_gb=16,
        recommended_ram_gb=32,
        default_steps=8,
        default_guidance_scale=1.0,
        default_image_guidance_scale=None,
        max_edge_px=1280,
        use_case="8-step bilingual local image editor with quoted text rendering (16 GB VRAM)",
        assets=(
            HfAssetGroup(
                hf_repo="meituan-longcat/LongCat-Image-Edit-Turbo",
                files=(
                    "config.json",
                    "model_index.json",
                    "scheduler/scheduler_config.json",
                    "text_encoder/config.json",
                    "text_encoder/generation_config.json",
                    "text_encoder/model-00001-of-00005.safetensors",
                    "text_encoder/model-00002-of-00005.safetensors",
                    "text_encoder/model-00003-of-00005.safetensors",
                    "text_encoder/model-00004-of-00005.safetensors",
                    "text_encoder/model-00005-of-00005.safetensors",
                    "text_encoder/model.safetensors.index.json",
                    "text_encoder/preprocessor_config.json",
                    "text_processor/chat_template.json",
                    "text_processor/config.json",
                    "text_processor/merges.txt",
                    "text_processor/preprocessor_config.json",
                    "text_processor/special_tokens_map.json",
                    "text_processor/tokenizer.json",
                    "text_processor/tokenizer_config.json",
                    "text_processor/vocab.json",
                    "tokenizer/chat_template.json",
                    "tokenizer/config.json",
                    "tokenizer/merges.txt",
                    "tokenizer/preprocessor_config.json",
                    "tokenizer/tokenizer.json",
                    "tokenizer/tokenizer_config.json",
                    "tokenizer/vocab.json",
                    "transformer/config.json",
                    "transformer/diffusion_pytorch_model.safetensors",
                    "vae/config.json",
                    "vae/diffusion_pytorch_model.safetensors",
                ),
            ),
        ),
    ),
    "qwen_image_edit_2511_gguf_q4": LocalImageEditModelSpec(
        key="qwen_image_edit_2511_gguf_q4",
        name="Qwen-Image-Edit 2511 (GGUF Q4_K_M)",
        pipeline_kind="qwen_image_edit_plus_gguf",
        compatibility="clean_and_aio_ai",
        hf_repo="Qwen/Qwen-Image-Edit-2511",
        gguf_repo="unsloth/Qwen-Image-Edit-2511-GGUF",
        gguf_filename="qwen-image-edit-2511-Q4_K_M.gguf",
        license="Apache-2.0",
        min_vram_gb=12,
        recommended_ram_gb=32,
        default_steps=24,
        default_guidance_scale=4.0,
        default_image_guidance_scale=None,
        max_edge_px=1280,
        use_case="Quantized Qwen-Image-Edit 2511 GGUF for AI Clean & AIO IA (12 GB VRAM)",
        assets=(
            HfAssetGroup(
                hf_repo="Qwen/Qwen-Image-Edit-2511",
                files=_QWEN_EDIT_BASE_FILES,
            ),
            HfAssetGroup(
                hf_repo="unsloth/Qwen-Image-Edit-2511-GGUF",
                files=("qwen-image-edit-2511-Q4_K_M.gguf",),
                targets=(
                    ("qwen-image-edit-2511-Q4_K_M.gguf", "gguf/qwen-image-edit-2511-Q4_K_M.gguf"),
                ),
            ),
        ),
    ),
    "qwen_image_edit_2511": LocalImageEditModelSpec(
        key="qwen_image_edit_2511",
        name="Qwen-Image-Edit 2511 (BF16)",
        pipeline_kind="qwen_image_edit_plus",
        compatibility="clean_and_aio_ai",
        hf_repo="Qwen/Qwen-Image-Edit-2511",
        gguf_repo=None,
        gguf_filename=None,
        license="Apache-2.0",
        min_vram_gb=24,
        recommended_ram_gb=64,
        default_steps=24,
        default_guidance_scale=4.0,
        default_image_guidance_scale=None,
        max_edge_px=1536,
        use_case="Flagship local BF16 Qwen editor with CPU offload for AI Clean & AIO IA",
        assets=(
            HfAssetGroup(
                hf_repo="Qwen/Qwen-Image-Edit-2511",
                files=(*_QWEN_EDIT_BASE_FILES, *_QWEN_TRANSFORMER_FILES),
            ),
        ),
    ),
    "firered_image_edit_1_1": LocalImageEditModelSpec(
        key="firered_image_edit_1_1",
        name="FireRed-Image-Edit 1.1 (BF16)",
        pipeline_kind="qwen_image_edit_plus",
        compatibility="clean_and_aio_ai",
        hf_repo="FireRedTeam/FireRed-Image-Edit-1.1",
        gguf_repo=None,
        gguf_filename=None,
        license="Apache-2.0",
        min_vram_gb=24,
        recommended_ram_gb=64,
        default_steps=28,
        default_guidance_scale=4.0,
        default_image_guidance_scale=None,
        max_edge_px=1536,
        use_case="Heavyweight instruction image editor built on Qwen pipeline (24 GB VRAM)",
        assets=(
            HfAssetGroup(
                hf_repo="FireRedTeam/FireRed-Image-Edit-1.1",
                files=(*_QWEN_EDIT_BASE_FILES, *_QWEN_TRANSFORMER_FILES),
            ),
        ),
    ),
}

LOCAL_IMAGE_EDIT_MODEL_IDS: Final[frozenset[str]] = frozenset(LOCAL_IMAGE_EDIT_SPECS.keys())


def is_local_image_edit_model_key(model_key: str | None) -> bool:
    return extract_local_image_edit_model_id(model_key) is not None


def extract_local_image_edit_model_id(model_key: str | None) -> str | None:
    raw = str(model_key or "").strip()
    if not raw:
        return None
    if raw.startswith(LOCAL_IMAGE_EDIT_MODEL_PREFIX):
        candidate = raw[len(LOCAL_IMAGE_EDIT_MODEL_PREFIX) :].strip().lower()
    else:
        candidate = raw.lower()
    if candidate in LOCAL_IMAGE_EDIT_MODEL_IDS:
        return candidate
    return None


def get_local_image_edit_spec(model_key: str | None) -> LocalImageEditModelSpec | None:
    model_id = extract_local_image_edit_model_id(model_key)
    if model_id is None:
        return None
    return LOCAL_IMAGE_EDIT_SPECS.get(model_id)
