from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

import cv2
import numpy as np

from core.device import OnnxProviderSpec
from models.errors import IncompatibleModelError
from models.inpainting.base_inpainter import (
    BaseInpainter,
    ImageU8,
    InpaintConfig,
    MaskU8,
    pad_to_modulo,
    resize_max_size,
)
from models.onnx_utils import ImageMaskOnnxModel, OutputRange, output_to_u8


class AOTInpainter(BaseInpainter):
    key: str = "aot"
    name: str = "AOT (ONNX)"
    pad_mod: ClassVar[int] = 8
    min_size: ClassVar[int | None] = 128
    max_size: ClassVar[int] = 1024

    def __init__(self, model_path: Path | str, providers: Sequence[OnnxProviderSpec]) -> None:
        # Lazy session: the factory may construct this on the event loop; the
        # multi-second ONNX load happens inside the inference worker call.
        self._onnx = ImageMaskOnnxModel(
            model_path,
            providers,
            model_key=self.key,
            output_range=OutputRange.MINUS_ONE_ONE,
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

        if loaded.output_range is not OutputRange.MINUS_ONE_ONE:
            raise IncompatibleModelError(
                "AOT requires minus_one_one output normalization"
            )

        if loaded.fixed_hw is not None:
            target_h, target_w = loaded.fixed_hw
            if max(target_h, target_w) > self.max_size:
                raise IncompatibleModelError(
                    "AOT fixed dimensions exceed its configured execution limit"
                )

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
            content_h, content_w = target_h, target_w
        else:
            run_image = resize_max_size(
                image,
                self.max_size,
                cv2.INTER_AREA,
            )
            content_h, content_w = run_image.shape[:2]

            coverage = np.asarray(
                cv2.resize(
                    mask,
                    (content_w, content_h),
                    interpolation=cv2.INTER_AREA,
                ),
                dtype=np.uint8,
            )
            run_mask = np.where(coverage > 0, np.uint8(255), np.uint8(0))

            run_image = pad_to_modulo(
                run_image,
                self.pad_mod,
                min_size=self.min_size,
            )
            run_mask = pad_to_modulo(
                run_mask,
                self.pad_mod,
                min_size=self.min_size,
            )

        mask_f = (run_mask >= 128).astype(np.float32)
        image_f = run_image.astype(np.float32)
        image_f *= np.float32(1.0 / 127.5)
        image_f -= np.float32(1.0)
        image_f *= np.float32(1.0) - mask_f[:, :, np.newaxis]

        output = self._onnx.run(
            np.ascontiguousarray(image_f.transpose(2, 0, 1)[np.newaxis]),
            np.ascontiguousarray(mask_f[np.newaxis, np.newaxis]),
            loaded=loaded,
        )
        result = output_to_u8(
            output[:content_h, :content_w],
            loaded.output_range,
        )

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
