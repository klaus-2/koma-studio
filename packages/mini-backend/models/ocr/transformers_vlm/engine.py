from __future__ import annotations

import logging
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Final, Protocol, cast

from PIL import Image

from core.device import get_device_info
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from models.ocr.common import (
    LazyRuntime,
    ModelFilesMissingError,
    ModelLoadError,
    RuntimeDependencyMissingError,
    build_result,
    crop_region,
    normalize_generated_text,
)

if TYPE_CHECKING:
    import torch

logger = logging.getLogger(__name__)

type PromptBuilder = Callable[[str], str]  # language -> prompt

_MIN_NEW_TOKENS: Final = 32
# Ordered by specificity; transformers raises ValueError when a config is not
# registered for a given auto-class, which is the only signal that we should
# try the next one.
_AUTO_MODEL_CLASSES: Final[tuple[str, ...]] = (
    "AutoModelForImageTextToText",
    "AutoModelForVision2Seq",
    "AutoModelForCausalLM",
)


class _GenerationConfig(Protocol):
    pad_token_id: int | None
    eos_token_id: int | list[int] | None


class _GenerateOutput(Protocol):
    sequences: "torch.Tensor"
    scores: "tuple[torch.Tensor, ...] | None"


class VlmModel(Protocol):
    generation_config: _GenerationConfig

    def to(self, device: str) -> VlmModel: ...
    def eval(self) -> VlmModel: ...
    def generate(self, **kwargs: object) -> _GenerateOutput: ...
    def compute_transition_scores(
        self,
        sequences: "torch.Tensor",
        scores: "tuple[torch.Tensor, ...]",
        *,
        normalize_logits: bool,
    ) -> "torch.Tensor": ...


class VlmProcessor(Protocol):
    chat_template: str | None
    tokenizer: object

    def __call__(self, **kwargs: object) -> Mapping[str, object]: ...
    def apply_chat_template(
        self,
        conversation: Sequence[Mapping[str, object]],
        *,
        tokenize: bool,
        add_generation_prompt: bool,
    ) -> str: ...
    def batch_decode(self, sequences: "torch.Tensor", *, skip_special_tokens: bool) -> list[str]: ...


@dataclass(frozen=True, slots=True)
class VlmProfile:
    prompt: PromptBuilder
    trust_remote_code: bool = False
    # GOT-OCR2's processor renders its own prompt and rejects `text=`.
    image_only_inputs: bool = False
    stop_strings: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class _LoadedRuntime:
    model: VlmModel
    processor: VlmProcessor
    device: str


def _generic_prompt(language: str) -> str:
    return (
        f"Perform OCR on this image region. The source language is {language}. "
        "Return only the recognized text."
    )


VLM_PROFILES: Final[Mapping[str, VlmProfile]] = {
    "rolmocr": VlmProfile(
        prompt=lambda _: (
            "Return the plain text representation of this image region as if you were reading it naturally."
        ),
    ),
    "mangalmm": VlmProfile(
        prompt=lambda _: (
            "Read all visible text in this manga image region and return only the recognized text in reading order."
        ),
    ),
    "got_ocr2": VlmProfile(
        prompt=lambda _: "OCR the provided image region and return only the recognized text in reading order.",
        image_only_inputs=True,
        stop_strings=("<|im_end|>",),
    ),
    "paddleocr_vl_1_5": VlmProfile(
        prompt=lambda _: "OCR:",
        trust_remote_code=True,
    ),
}
_DEFAULT_PROFILE: Final = VlmProfile(prompt=_generic_prompt)


def _token_ids(value: int | list[int] | None) -> frozenset[int]:
    if value is None:
        return frozenset()
    return frozenset([value]) if isinstance(value, int) else frozenset(value)


def _mean_token_probability(
    log_probs: "torch.Tensor",
    tokens: "torch.Tensor",
    ignored_token_ids: frozenset[int],
) -> float:
    import torch

    length = min(int(log_probs.shape[0]), int(tokens.shape[0]))
    if length == 0:
        return 0.0
    log_probs = log_probs[:length]
    tokens = tokens[:length]
    if ignored_token_ids:
        ignored = torch.tensor(sorted(ignored_token_ids), device=tokens.device)
        log_probs = log_probs[~torch.isin(tokens, ignored)]
    if log_probs.numel() == 0:
        return 0.0
    return float(log_probs.exp().mean().item())


class TransformersVlmOcrEngine(BaseOCR):
    def __init__(
        self,
        *,
        key: str,
        name: str,
        model_dir: str | Path,
        max_new_tokens: int = 256,
        profile: VlmProfile | None = None,
        use_gpu: bool | None = None,
    ) -> None:
        self.key = key
        self.name = name
        self.model_dir: Path = Path(model_dir).expanduser().resolve()
        self.max_new_tokens: int = max(_MIN_NEW_TOKENS, max_new_tokens)
        self.profile: VlmProfile = profile or VLM_PROFILES.get(key, _DEFAULT_PROFILE)
        self._use_gpu = use_gpu
        self._runtime: LazyRuntime[_LoadedRuntime] = LazyRuntime(self._load_runtime)

    def _load_runtime(self) -> _LoadedRuntime:
        try:
            import torch
            import transformers
        except ImportError as exc:
            raise RuntimeDependencyMissingError(self.key, "torch/transformers") from exc

        if not self.model_dir.is_dir():
            raise ModelFilesMissingError(self.model_dir, ("config.json",))

        use_gpu = self._use_gpu if self._use_gpu is not None else get_device_info().has_gpu
        device = "cuda" if use_gpu and torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if device == "cuda" else torch.float32

        processor = cast(
            VlmProcessor,
            transformers.AutoProcessor.from_pretrained(
                str(self.model_dir),
                local_files_only=True,
                trust_remote_code=self.profile.trust_remote_code,
            ),
        )
        model = self._instantiate_model(transformers, dtype)
        model.to(device)
        model.eval()
        logger.info(
            "vlm_runtime_loaded",
            extra={"engine": self.key, "device": device, "model_dir": str(self.model_dir)},
        )
        return _LoadedRuntime(model=model, processor=processor, device=device)

    def _instantiate_model(self, transformers: object, dtype: "torch.dtype") -> VlmModel:
        last_error: ValueError | None = None
        for class_name in _AUTO_MODEL_CLASSES:
            auto_cls = getattr(transformers, class_name, None)
            if auto_cls is None:
                continue
            try:
                return cast(
                    VlmModel,
                    auto_cls.from_pretrained(
                        str(self.model_dir),
                        local_files_only=True,
                        torch_dtype=dtype,
                        low_cpu_mem_usage=True,
                        trust_remote_code=self.profile.trust_remote_code,
                    ),
                )
            except ValueError as exc:
                last_error = exc
                logger.debug(
                    "vlm_auto_class_rejected", extra={"engine": self.key, "auto_class": class_name}
                )
        raise ModelLoadError(
            f"No transformers auto-class accepts the model at {self.model_dir} for engine '{self.key}'."
        ) from last_error

    def _build_inputs(
        self, processor: VlmProcessor, crop: Image.Image, prompt: str
    ) -> Mapping[str, object]:
        if self.profile.image_only_inputs:
            return processor(images=crop, return_tensors="pt")
        if processor.chat_template is None:
            return processor(text=prompt, images=crop, return_tensors="pt")
        conversation = [
            {
                "role": "user",
                "content": [{"type": "image", "image": crop}, {"type": "text", "text": prompt}],
            }
        ]
        rendered = processor.apply_chat_template(
            conversation, tokenize=False, add_generation_prompt=True
        )
        return processor(text=[rendered], images=[crop], padding=True, return_tensors="pt")

    def _generate(self, runtime: _LoadedRuntime, crop: Image.Image, prompt: str) -> tuple[str, float]:
        import torch

        inputs = self._build_inputs(runtime.processor, crop, prompt)
        batch: dict[str, object] = {
            name: value.to(runtime.device) if isinstance(value, torch.Tensor) else value
            for name, value in inputs.items()
        }
        input_ids = batch.get("input_ids")
        input_length = int(input_ids.shape[1]) if isinstance(input_ids, torch.Tensor) else 0

        generation_kwargs: dict[str, object] = {
            **batch,
            "max_new_tokens": self.max_new_tokens,
            "do_sample": False,
            "use_cache": True,
            "return_dict_in_generate": True,
            "output_scores": True,
        }
        if self.profile.stop_strings:
            generation_kwargs["stop_strings"] = list(self.profile.stop_strings)
            generation_kwargs["tokenizer"] = runtime.processor.tokenizer

        with torch.inference_mode():
            output = runtime.model.generate(**generation_kwargs)
            new_tokens = output.sequences[:, input_length:]
            confidence = 0.0
            if output.scores:
                transition = runtime.model.compute_transition_scores(
                    output.sequences, output.scores, normalize_logits=True
                )
                config = runtime.model.generation_config
                ignored = _token_ids(config.pad_token_id) | _token_ids(config.eos_token_id)
                confidence = _mean_token_probability(transition[0], new_tokens[0], ignored)

        decoded = runtime.processor.batch_decode(new_tokens, skip_special_tokens=True)[0]
        text = normalize_generated_text(decoded)
        return text, (confidence if text else 0.0)

    def _recognize(
        self,
        image: Image.Image,
        regions: Sequence[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        prompt = self.profile.prompt(language)
        runtime = self._runtime.get()
        results: list[OCRTextResult] = []
        for region in regions:
            crop = crop_region(image, region)
            if crop is None:
                # Degenerate region: empty result, no inference on fake pixels.
                results.append(build_result(region, model_key=self.key))
                continue
            text, score = self._generate(runtime, crop, prompt)
            results.append(build_result(region, model_key=self.key, text=text, score=score))
        return results
