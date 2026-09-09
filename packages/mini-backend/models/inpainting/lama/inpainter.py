from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from models.inpainting.base_inpainter import BaseInpainter, InpaintConfig


def _resolve_onnx_inputs(session: ort.InferenceSession) -> tuple[str, str]:
    inputs = list(session.get_inputs())
    if len(inputs) < 2:
        raise RuntimeError("The LaMa model requires 2 inputs (image and mask)")

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


def _norm_img(np_img: np.ndarray) -> np.ndarray:
    if np_img.ndim == 2:
        np_img = np_img[:, :, np.newaxis]
    np_img = np.transpose(np_img, (2, 0, 1))
    return np_img.astype("float32") / 255.0


class LaMaInpainter(BaseInpainter):
    key = "lama_manga"
    name = "LaMa Manga Dynamic (ONNX)"
    pad_mod = 8

    def __init__(
        self,
        model_path: str,
        providers: list[str],
        *,
        key: str | None = None,
        name: str | None = None,
    ):
        resolved_path = Path(model_path)
        if not resolved_path.exists():
            raise FileNotFoundError(f"LaMa model not found: {resolved_path}")

        if key:
            self.key = key
        if name:
            self.name = name
        self.session = ort.InferenceSession(str(resolved_path), providers=providers)
        self.input_image_name, self.input_mask_name = _resolve_onnx_inputs(self.session)
        self.fixed_input_hw: tuple[int, int] | None = None
        for input_meta in self.session.get_inputs():
            if input_meta.name != self.input_image_name:
                continue
            shape = list(input_meta.shape)
            if len(shape) >= 4 and isinstance(shape[2], int) and isinstance(shape[3], int):
                self.fixed_input_hw = (int(shape[2]), int(shape[3]))
            break

    def forward(self, image: np.ndarray, mask: np.ndarray, config: InpaintConfig) -> np.ndarray:
        original_h, original_w = image.shape[:2]
        run_image = image
        run_mask = mask
        if self.fixed_input_hw is not None:
            target_h, target_w = self.fixed_input_hw
            if (original_h, original_w) != (target_h, target_w):
                run_image = cv2.resize(run_image, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
                run_mask = cv2.resize(run_mask, (target_w, target_h), interpolation=cv2.INTER_NEAREST)

        image_n = _norm_img(run_image)
        mask_n = _norm_img(run_mask)
        mask_n = (mask_n > 0).astype("float32")
        if mask_n.shape[0] != 1:
            mask_n = mask_n[:1, ...]

        image_tensor = image_n[np.newaxis, ...]
        mask_tensor = mask_n[np.newaxis, ...]
        outputs = self.session.run(
            None,
            {
                self.input_image_name: image_tensor,
                self.input_mask_name: mask_tensor,
            },
        )
        if not outputs:
            raise RuntimeError("The LaMa model returned no output")

        output = outputs[0]
        if output.ndim == 4:
            output = output[0].transpose(1, 2, 0)
        elif output.ndim == 3 and output.shape[0] == 3:
            output = output.transpose(1, 2, 0)

        if float(output.min()) >= -0.05 and float(output.max()) <= 1.05:
            output = output * 255.0
        else:
            output = ((output + 1.0) * 127.5)

        output = np.clip(output, 0, 255).astype("uint8")
        if output.shape[:2] != (original_h, original_w):
            output = cv2.resize(output, (original_w, original_h), interpolation=cv2.INTER_CUBIC)
        return output
