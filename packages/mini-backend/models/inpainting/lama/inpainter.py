from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

import cv2
import numpy as np
import numpy.typing as npt

from core.device import OnnxProviderSpec
from models.inpainting.base_inpainter import (
    BaseInpainter,
    ImageU8,
    InpaintConfig,
    MaskU8,
)
from models.onnx_utils import ImageMaskOnnxModel, OutputRange, output_to_u8


def _denormalize_output(
    output: npt.NDArray[np.float32],
    output_range: OutputRange = OutputRange.ZERO_ONE,
) -> ImageU8:
    """Apply the export contract; pixel statistics never select normalization."""
    return output_to_u8(output, output_range)


class LaMaInpainter(BaseInpainter):
    key: str = "lama_manga"
    name: str = "LaMa Manga Dynamic (ONNX)"
    pad_mod: ClassVar[int] = 8

    def __init__(
        self,
        model_path: Path | str,
        providers: Sequence[OnnxProviderSpec],
        *,
        key: str | None = None,
        name: str | None = None,
        output_range: OutputRange = OutputRange.ZERO_ONE,
    ) -> None:
        if key is not None:
            if not key.strip():
                raise ValueError("Model key must not be blank")
            self.key = key

        if name is not None:
            if not name.strip():
                raise ValueError("Model name must not be blank")
            self.name = name

        self._onnx = ImageMaskOnnxModel(
            model_path,
            providers,
            model_key=self.key,
            output_range=output_range,
        )

    def forward(
        self,
        image: ImageU8,
        mask: MaskU8,
        config: InpaintConfig,
    ) -> ImageU8:
        del config
        height, width = image.shape[:2]
        loaded = self._onnx.load()
        run_image, run_mask = image, mask

        if loaded.fixed_hw is not None and loaded.fixed_hw != (height, width):
            target_h, target_w = loaded.fixed_hw
            run_image = np.asarray(
                cv2.resize(
                    image,
                    (target_w, target_h),
                    interpolation=cv2.INTER_LINEAR,
                ),
                dtype=np.uint8,
            )
            coverage = np.asarray(
                cv2.resize(
                    mask,
                    (target_w, target_h),
                    interpolation=cv2.INTER_AREA,
                ),
                dtype=np.uint8,
            )
            run_mask = np.where(coverage > 0, np.uint8(255), np.uint8(0))

        image_f = run_image.astype(np.float32)
        image_f *= np.float32(1.0 / 255.0)

        image_tensor = np.ascontiguousarray(
            image_f.transpose(2, 0, 1)[np.newaxis]
        )
        mask_tensor = np.ascontiguousarray(
            (run_mask >= 128).astype(np.float32)[np.newaxis, np.newaxis]
        )

        output = self._onnx.run(
            image_tensor,
            mask_tensor,
            loaded=loaded,
        )
        result = _denormalize_output(output, loaded.output_range)

        if result.shape[:2] != (height, width):
            result = np.asarray(
                cv2.resize(
                    result,
                    (width, height),
                    interpolation=cv2.INTER_LINEAR,
                ),
                dtype=np.uint8,
            )
        return result
