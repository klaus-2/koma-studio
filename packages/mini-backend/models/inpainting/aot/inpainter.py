from __future__ import annotations

from collections.abc import Sequence
from typing import ClassVar

import cv2
import numpy as np

from models.inpainting.base_inpainter import (
    BaseInpainter,
    ImageU8,
    InpaintConfig,
    MaskU8,
    resize_max_size,
)
from models.errors import InvalidModelOutputError
from models.onnx_utils import (
    ONNX_RUNTIME_ERRORS,
    ImageMaskOnnxModel,
    translate_inference_error,
)


class AOTInpainter(BaseInpainter):
    key = "aot"
    name = "AOT (ONNX)"
    pad_mod = 8
    min_size = 128
    max_size: ClassVar[int] = 1024

    def __init__(self, model_path: str, providers: Sequence[str]) -> None:
        # Lazy session: the factory may construct this on the event loop; the
        # multi-second ONNX load happens inside the to_thread inference call.
        self._onnx = ImageMaskOnnxModel(model_path, providers, model_key=self.key)

    def forward(self, image: ImageU8, mask: MaskU8, config: InpaintConfig) -> ImageU8:
        h, w = image.shape[:2]
        run_image, run_mask = image, mask
        if max(h, w) > self.max_size:
            run_image = resize_max_size(image, self.max_size, cv2.INTER_LINEAR)
            run_mask = resize_max_size(mask, self.max_size, cv2.INTER_NEAREST)

        mask_f = (run_mask >= 128).astype(np.float32)
        image_f = (run_image.astype(np.float32) / 127.5 - 1.0) * (1.0 - mask_f[:, :, np.newaxis])

        loaded = self._onnx.load()
        try:
            outputs = loaded.session.run(
                None,
                {
                    loaded.image_input: image_f.transpose(2, 0, 1)[np.newaxis],
                    loaded.mask_input: mask_f[np.newaxis, np.newaxis],
                },
            )
        except ONNX_RUNTIME_ERRORS as exc:
            raise translate_inference_error(exc, model_key=self.key) from exc
        if not outputs:
            raise InvalidModelOutputError(f"{self.key}: model returned no output")

        output = np.asarray(outputs[0], dtype=np.float32)
        if output.ndim == 4:
            output = output[0].transpose(1, 2, 0)
        elif output.ndim == 3 and output.shape[0] == 3:
            output = output.transpose(1, 2, 0)

        inpainted = np.clip(np.rint((output + 1.0) * 127.5), 0, 255).astype(np.uint8)
        if inpainted.shape[:2] != (h, w):
            inpainted = np.asarray(
                cv2.resize(inpainted, (w, h), interpolation=cv2.INTER_LINEAR), dtype=np.uint8
            )
        return inpainted

