from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from models.inpainting.base_inpainter import BaseInpainter, InpaintConfig, resize_max_size


def _resolve_onnx_inputs(session: ort.InferenceSession) -> tuple[str, str]:
    inputs = list(session.get_inputs())
    if len(inputs) < 2:
        raise RuntimeError("The AOT model requires 2 inputs (image and mask)")

    image_name: str | None = None
    mask_name: str | None = None

    for input_meta in inputs:
        lname = input_meta.name.lower()
        if "mask" in lname:
            mask_name = input_meta.name
        elif "image" in lname or "img" in lname:
            image_name = input_meta.name

    if image_name is None or mask_name is None:
        for input_meta in inputs:
            shape = input_meta.shape
            channels = shape[1] if len(shape) > 1 and isinstance(shape[1], int) else None
            if channels == 1 and mask_name is None:
                mask_name = input_meta.name
            elif channels == 3 and image_name is None:
                image_name = input_meta.name

    if image_name is None:
        image_name = inputs[0].name
    if mask_name is None:
        mask_name = inputs[1].name if inputs[1].name != image_name else inputs[-1].name

    return image_name, mask_name


class AOTInpainter(BaseInpainter):
    key = "aot"
    name = "AOT (ONNX)"
    pad_mod = 8
    min_size = 128
    max_size = 1024

    def __init__(self, model_path: str, providers: list[str]):
        resolved_path = Path(model_path)
        if not resolved_path.exists():
            raise FileNotFoundError(f"AOT model not found: {resolved_path}")

        self.session = ort.InferenceSession(str(resolved_path), providers=providers)
        self.input_image_name, self.input_mask_name = _resolve_onnx_inputs(self.session)

    def forward(self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig) -> np.ndarray:
        original_h, original_w = image.shape[:2]
        run_image = image
        run_mask = mask

        if max(original_h, original_w) > self.max_size:
            run_image = resize_max_size(run_image, self.max_size, interpolation=cv2.INTER_LINEAR)
            run_mask = resize_max_size(run_mask, self.max_size, interpolation=cv2.INTER_NEAREST)

        img_np = (run_image.astype(np.float32) / 127.5) - 1.0
        mask_np = (run_mask.astype(np.float32) / 255.0)
        mask_np = (mask_np >= 0.5).astype(np.float32)
        img_np = img_np * (1.0 - mask_np[:, :, np.newaxis])

        image_nchw = np.transpose(img_np, (2, 0, 1))[np.newaxis, ...]
        mask_nchw = mask_np[np.newaxis, np.newaxis, ...]

        outputs = self.session.run(
            None,
            {
                self.input_image_name: image_nchw,
                self.input_mask_name: mask_nchw,
            },
        )
        if not outputs:
            raise RuntimeError("The AOT model returned no output")

        output = outputs[0]
        if output.ndim == 4:
            output = output[0].transpose(1, 2, 0)
        elif output.ndim == 3 and output.shape[0] == 3:
            output = output.transpose(1, 2, 0)

        inpainted = ((output + 1.0) * 127.5)
        inpainted = np.clip(np.round(inpainted), 0, 255).astype(np.uint8)

        if inpainted.shape[:2] != (original_h, original_w):
            inpainted = cv2.resize(inpainted, (original_w, original_h), interpolation=cv2.INTER_LINEAR)

        return inpainted
