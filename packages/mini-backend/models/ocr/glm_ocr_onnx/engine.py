from __future__ import annotations

from pathlib import Path

from models.ocr.glm_ocr_onnx.storage import resolve_glm_ocr_onnx_model_dir
from models.ocr.transformers_vlm.engine import TransformersVlmOcrEngine


class GlmOcrOnnxEngine(TransformersVlmOcrEngine):
    key = "glm_ocr_onnx"
    name = "GLM-OCR"

    def __init__(self, model_dir: str | Path | None = None, max_new_tokens: int = 256, *, use_gpu: bool | None = None) -> None:
        resolved_dir = Path(model_dir).expanduser().resolve() if model_dir else resolve_glm_ocr_onnx_model_dir()
        if resolved_dir is None:
            raise RuntimeError(
                "Managed models directory is not configured for GLM-OCR.",
            )
        super().__init__(
            key=self.key,
            name=self.name,
            model_dir=resolved_dir,
            max_new_tokens=max_new_tokens,
            use_gpu=use_gpu,
        )
