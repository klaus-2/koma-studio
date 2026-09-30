from __future__ import annotations

from collections.abc import Sequence

import cv2
import numpy as np
import numpy.typing as npt

from models.inpainting.base_inpainter import BaseInpainter, ImageU8, InpaintConfig, MaskU8
from models.onnx_utils import (
    ONNX_RUNTIME_ERRORS,
    ImageMaskOnnxModel,
    translate_inference_error,
)


def _denormalize_output(output: npt.NDArray[np.float32]) -> ImageU8:
    """Map model output to uint8.

    LaMa ONNX exports in the wild use three conventions and the graphs carry no
    metadata about it: [0, 1] (original LaMa), [-1, 1] (GAN-style exports) and
    [0, 255] (exports with the scale baked in). The value range of a single
    inference is enough to tell them apart because a real image never fits two
    of these ranges simultaneously except at the degenerate all-gray extreme.
    """
    lo, hi = float(output.min()), float(output.max())
    if hi > 2.0:
        scaled = output
    elif lo >= -0.05:
        scaled = output * 255.0
    else:
        scaled = (output + 1.0) * 127.5
    return np.clip(np.rint(scaled), 0, 255).astype(np.uint8)


class LaMaInpainter(BaseInpainter):
    key = "lama_manga"
    name = "LaMa Manga Dynamic (ONNX)"
    pad_mod = 8

    def __init__(
        self,
        model_path: str,
        providers: Sequence[str],
        *,
        key: str | None = None,
        name: str | None = None,
    ) -> None:
        if key:
            self.key = key
        if name:
            self.name = name
        self._onnx = ImageMaskOnnxModel(model_path, providers, model_key=self.key)

    def forward(self, image: ImageU8, mask: MaskU8, config: InpaintConfig) -> ImageU8:
        h, w = image.shape[:2]
        run_image, run_mask = image, mask

        loaded = self._onnx.load()
        if loaded.fixed_hw is not None and loaded.fixed_hw != (h, w):
            target_h, target_w = loaded.fixed_hw
            run_image = np.asarray(
                cv2.resize(image, (target_w, target_h), interpolation=cv2.INTER_CUBIC), dtype=np.uint8
            )
            run_mask = np.asarray(
                cv2.resize(mask, (target_w, target_h), interpolation=cv2.INTER_NEAREST), dtype=np.uint8
            )

        image_tensor = (run_image.astype(np.float32) / 255.0).transpose(2, 0, 1)[np.newaxis]
        mask_tensor = (run_mask > 0).astype(np.float32)[np.newaxis, np.newaxis]

        try:
            outputs = loaded.session.run(
                None, {loaded.image_input: image_tensor, loaded.mask_input: mask_tensor}
            )
        except ONNX_RUNTIME_ERRORS as exc:
            raise translate_inference_error(exc, model_key=self.key) from exc
        if not outputs:
            from models.errors import InvalidModelOutputError

            raise InvalidModelOutputError(f"{self.key}: model returned no output")

        output = np.asarray(outputs[0], dtype=np.float32)
        if output.ndim == 4:
            output = output[0].transpose(1, 2, 0)
        elif output.ndim == 3 and output.shape[0] == 3:
            output = output.transpose(1, 2, 0)

        result = _denormalize_output(np.asarray(output, dtype=np.float32))
        if result.shape[:2] != (h, w):
            result = np.asarray(
                cv2.resize(result, (w, h), interpolation=cv2.INTER_CUBIC), dtype=np.uint8
            )
        return result
