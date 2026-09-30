from __future__ import annotations

from pathlib import Path
from typing import Final

from models.ocr.common import ModelsRootNotConfiguredError
from models.ocr.paddleocr_vl_manga.storage import (
    PADDLEOCR_VL_MANGA_MODEL_ID,
    resolve_paddleocr_vl_manga_model_dir,
)
from models.ocr.transformers_vlm.engine import TransformersVlmOcrEngine, VlmProfile

_PROFILE: Final = VlmProfile(prompt=lambda _: "OCR:", trust_remote_code=True)


class PaddleOcrVlMangaEngine(TransformersVlmOcrEngine):
    key = "paddleocr_vl_manga"
    name = "PaddleOCRVLManga"

    def __init__(
        self,
        model_dir: str | Path | None = None,
        max_new_tokens: int = 512,
        *,
        use_gpu: bool | None = None,
    ) -> None:
        resolved = (
            Path(model_dir).expanduser().resolve()
            if model_dir
            else resolve_paddleocr_vl_manga_model_dir()
        )
        if resolved is None:
            raise ModelsRootNotConfiguredError(PADDLEOCR_VL_MANGA_MODEL_ID)
        super().__init__(
            key=self.key,
            name=self.name,
            model_dir=resolved,
            max_new_tokens=max_new_tokens,
            profile=_PROFILE,
            use_gpu=use_gpu,
        )
