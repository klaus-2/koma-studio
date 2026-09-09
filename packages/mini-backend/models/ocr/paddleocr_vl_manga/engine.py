from __future__ import annotations

import importlib
import sys
from pathlib import Path
from typing import Any

from PIL import Image

from core.device import get_device_info
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from models.ocr.paddleocr_vl_manga.storage import resolve_paddleocr_vl_manga_model_dir


def _normalize_generated_text(raw_text: str) -> str:
    cleaned = str(raw_text or "").strip()
    for prefix in ("assistant\n", "assistant:", "Assistant:", "OCR:"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    return " ".join(cleaned.split())


class PaddleOcrVlMangaEngine(BaseOCR):
    key = "paddleocr_vl_manga"
    name = "PaddleOCRVLManga"

    def __init__(self, model_dir: str | Path | None = None, max_new_tokens: int = 512, *, use_gpu: bool | None = None) -> None:
        resolved_dir = Path(model_dir).expanduser().resolve() if model_dir else resolve_paddleocr_vl_manga_model_dir()
        if resolved_dir is None:
            raise RuntimeError(
                "Managed models directory is not configured for PaddleOCRVLManga.",
            )
        self.model_dir = Path(resolved_dir)
        self.max_new_tokens = max(64, int(max_new_tokens))
        self._use_gpu = use_gpu
        self.model: Any = None
        self.processor: Any = None
        self.device: str | None = None

    def _ensure_runtime(self) -> None:
        if self.model is not None and self.processor is not None:
            return
        try:
            import torch  # type: ignore
        except Exception as exc:
            raise RuntimeError("PaddleOCRVLManga dependencies (torch) are not installed.") from exc

        if not self.model_dir.exists():
            raise FileNotFoundError(f"PaddleOCRVLManga model not found in {self.model_dir}")

        parent = str(self.model_dir.parent)
        if parent not in sys.path:
            sys.path.insert(0, parent)

        package_name = self.model_dir.name
        processing_module = importlib.import_module(f"{package_name}.processing_paddleocr_vl")
        modeling_module = importlib.import_module(f"{package_name}.modeling_paddleocr_vl")

        processor_cls = getattr(processing_module, "PaddleOCRVLProcessor")
        model_cls = getattr(modeling_module, "PaddleOCRVLForConditionalGeneration")

        force_gpu = self._use_gpu if self._use_gpu is not None else get_device_info().has_gpu
        self.device = "cuda" if force_gpu and torch.cuda.is_available() else "cpu"
        torch_dtype = torch.float16 if self.device == "cuda" else torch.float32

        self.processor = processor_cls.from_pretrained(str(self.model_dir), local_files_only=True)
        self.model = model_cls.from_pretrained(
            str(self.model_dir),
            local_files_only=True,
            torch_dtype=torch_dtype,
            low_cpu_mem_usage=True,
        )
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

    def _generate_text(self, crop: Image.Image) -> str:
        self._ensure_runtime()
        assert self.model is not None
        assert self.processor is not None
        assert self.device is not None

        try:
            import torch  # type: ignore
        except Exception as exc:
            raise RuntimeError("torch is not available for PaddleOCRVLManga.") from exc

        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": crop},
                    {"type": "text", "text": "OCR:"},
                ],
            }
        ]
        prompt = self.processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = self.processor(text=[prompt], images=[crop], return_tensors="pt")
        prepared_inputs = {
            key: value.to(self.device) if hasattr(value, "to") else value
            for key, value in inputs.items()
        }

        with torch.inference_mode():
            generated = self.model.generate(
                **prepared_inputs,
                max_new_tokens=self.max_new_tokens,
                do_sample=False,
                use_cache=True,
            )

        input_length = int(prepared_inputs["input_ids"].shape[1]) if "input_ids" in prepared_inputs else 0
        generated_tokens = generated[:, input_length:] if input_length > 0 else generated
        decoded = self.processor.batch_decode(generated_tokens, skip_special_tokens=True)[0]
        return _normalize_generated_text(decoded)

    def _recognize(self, image: Image.Image, regions: list[OCRInputRegion], language: str = "ja") -> list[OCRTextResult]:
        _ = language
        results: list[OCRTextResult] = []
        for region in regions:
            crop = self._crop_region(image, region)
            text = self._generate_text(crop)
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
