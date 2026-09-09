from __future__ import annotations

from pathlib import Path
from typing import Any, Callable

from PIL import Image

from core.device import get_device_info
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult


def _normalize_generated_text(raw_text: str) -> str:
    cleaned = str(raw_text or "").strip()
    for prefix in ("assistant\n", "assistant:", "Assistant:", "OCR:", "Text Recognition:"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    cleaned = cleaned.replace("<|im_end|>", "").replace("<|endoftext|>", "").strip()
    return " ".join(cleaned.split())


def _default_prompt(model_key: str, language: str) -> str:
    if model_key == "rolmocr":
        return "Return the plain text representation of this image region as if you were reading it naturally."
    if model_key == "mangalmm":
        return "Read all visible text in this manga image region and return only the recognized text in reading order."
    if model_key == "got_ocr2":
        return "OCR the provided image region and return only the recognized text in reading order."
    return f"Perform OCR on this image region. The source language is {language}. Return only the recognized text."


class TransformersVlmOcrEngine(BaseOCR):
    def __init__(
        self,
        *,
        key: str,
        name: str,
        model_dir: str | Path,
        max_new_tokens: int = 256,
        prompt_builder: Callable[[str, str], str] | None = None,
        use_gpu: bool | None = None,
    ) -> None:
        self.key = key
        self.name = name
        self.model_dir = Path(model_dir).expanduser().resolve()
        self.max_new_tokens = max(32, int(max_new_tokens))
        self.prompt_builder = prompt_builder or _default_prompt
        self._use_gpu = use_gpu
        self.model: Any = None
        self.processor: Any = None
        self.device: str | None = None

    def _ensure_runtime(self) -> None:
        if self.model is not None and self.processor is not None:
            return
        try:
            import torch  # type: ignore
            import transformers  # type: ignore
        except Exception as exc:
            raise RuntimeError("OCR VLM dependencies (torch/transformers) are not installed.") from exc

        if not self.model_dir.exists():
            raise FileNotFoundError(f"VLM model not found in {self.model_dir}")

        force_gpu = self._use_gpu if self._use_gpu is not None else get_device_info().has_gpu
        self.device = "cuda" if force_gpu and torch.cuda.is_available() else "cpu"
        torch_dtype = torch.float16 if self.device == "cuda" else torch.float32

        auto_processor = getattr(transformers, "AutoProcessor")
        self.processor = auto_processor.from_pretrained(
            str(self.model_dir),
            local_files_only=True,
        )

        model_error: Exception | None = None
        for class_name in ("AutoModelForImageTextToText", "AutoModelForVision2Seq", "AutoModelForCausalLM"):
            model_cls = getattr(transformers, class_name, None)
            if model_cls is None:
                continue
            try:
                self.model = model_cls.from_pretrained(
                    str(self.model_dir),
                    local_files_only=True,
                    torch_dtype=torch_dtype,
                    low_cpu_mem_usage=True,
                )
                break
            except Exception as exc:
                model_error = exc
                self.model = None
        if self.model is None:
            raise RuntimeError(
                f"Could not load the local VLM model '{self.key}' with the available auto-classes."
            ) from model_error
        self.model.to(self.device)
        self.model.eval()

    @staticmethod
    def _crop_region(image: Image.Image, region: OCRInputRegion) -> Image.Image:
        width, height = image.size
        x1, y1, x2, y2 = region.bbox
        left = max(0, min(x1, x2))
        top = max(0, min(y1, y2))
        right = min(width, max(x1, x2))
        bottom = min(height, max(y1, y2))
        if right <= left or bottom <= top:
            return Image.new("RGB", (8, 8), "white")
        return image.crop((left, top, right, bottom)).convert("RGB")

    @staticmethod
    def _resolve_input_length(inputs: dict[str, Any]) -> int:
        input_ids = inputs.get("input_ids")
        shape = getattr(input_ids, "shape", None)
        if shape is not None and len(shape) > 1:
            return int(shape[1])
        if isinstance(input_ids, list) and input_ids:
            first_item = input_ids[0]
            if isinstance(first_item, list):
                return len(first_item)
        return 0

    def _build_inputs(self, crop: Image.Image, prompt: str) -> tuple[dict[str, Any], int]:
        assert self.processor is not None
        if hasattr(self.processor, "apply_chat_template"):
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "image": crop},
                        {"type": "text", "text": prompt},
                    ],
                }
            ]
            try:
                rendered_prompt = self.processor.apply_chat_template(
                    messages,
                    tokenize=False,
                    add_generation_prompt=True,
                )
                inputs = self.processor(
                    text=[rendered_prompt],
                    images=[crop],
                    padding=True,
                    return_tensors="pt",
                )
                input_length = self._resolve_input_length(inputs)
                return inputs, input_length
            except Exception as exc:
                if "chat template" not in str(exc).lower():
                    raise

        if self.key == "got_ocr2":
            inputs = self.processor(
                images=crop,
                return_tensors="pt",
            )
        else:
            inputs = self.processor(
                text=prompt,
                images=crop,
                return_tensors="pt",
            )
        input_length = self._resolve_input_length(inputs)
        return inputs, input_length

    def _generate_text(self, crop: Image.Image, prompt: str) -> str:
        self._ensure_runtime()
        assert self.model is not None
        assert self.processor is not None
        assert self.device is not None

        try:
            import torch  # type: ignore
        except Exception as exc:
            raise RuntimeError("torch is not available for OCR VLM.") from exc

        inputs, input_length = self._build_inputs(crop, prompt)
        prepared_inputs = {
            key: value.to(self.device) if hasattr(value, "to") else value
            for key, value in inputs.items()
        }

        with torch.inference_mode():
            generation_kwargs = {
                **prepared_inputs,
                "max_new_tokens": self.max_new_tokens,
                "do_sample": False,
                "use_cache": True,
            }
            if self.key == "got_ocr2" and getattr(self.processor, "tokenizer", None) is not None:
                generation_kwargs["tokenizer"] = self.processor.tokenizer
                generation_kwargs["stop_strings"] = "<|im_end|>"
            generated = self.model.generate(
                **generation_kwargs,
            )

        generated_tokens = generated[:, input_length:] if input_length > 0 else generated
        decoded = self.processor.batch_decode(
            generated_tokens,
            skip_special_tokens=True,
        )[0]
        return _normalize_generated_text(decoded)

    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        prompt = self.prompt_builder(self.key, language)
        results: list[OCRTextResult] = []
        for region in regions:
            crop = self._crop_region(image, region)
            text = self._generate_text(crop, prompt)
            results.append(
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text=text,
                    score=0.95 if text else 0.0,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key=self.key,
                )
            )
        return results
