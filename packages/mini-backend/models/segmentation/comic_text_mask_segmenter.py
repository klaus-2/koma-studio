"""Crop-level neural binary text segmenter using DeWoke/comic-text-mask-onnx."""

from __future__ import annotations

import threading
from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar, Final

import cv2
import numpy as np
import onnxruntime as ort
from numpy.typing import NDArray

from core.device import OnnxProviderSpec, get_device_info, get_onnx_execution_providers
from models.errors import InferenceError, ModelNotInstalledError
from models.onnx_utils import create_session_with_trt_fallback
from models.segmentation.baka_segmenter import _clip_ordered, _detect_content
from models.segmentation.base_segmenter import (
    BaseSegmenter,
    SegmentInputRegion,
    SegmentResultRegion,
)
from models.segmentation.postprocess import (
    build_segment_result,
    decode_rgb,
    validate_output_budget,
)
from models.segmentation.storage import resolve_segmentation_model_dir

type MaskArray = NDArray[np.uint8]

_INPUT_SIZE: Final[int] = 384
_DEFAULT_THRESHOLD: Final[float] = 0.5
_GATE_PAD_PX: Final[int] = 4
_MIN_NEURAL_COVERAGE: Final[float] = 0.015
_MAX_OUTPUT_BYTES: Final[int] = 64 * 1024 * 1024
_MODEL_FILENAME: Final[str] = "model.onnx"


class ComicTextMaskSegmenter(BaseSegmenter):
    """Per-region 384x384 U-Net (ResNet-18) text-mask segmenter (TareHimself/DeWoke)."""

    key: ClassVar[str] = "comic_text_mask"
    name: ClassVar[str] = "Comic Text Mask (ONNX)"

    def __init__(
        self,
        model_path: str | Path | None = None,
        providers: Sequence[OnnxProviderSpec] | None = None,
        *,
        prob_threshold: float = _DEFAULT_THRESHOLD,
    ) -> None:
        self._explicit_path = Path(model_path) if model_path else None
        self._providers: tuple[OnnxProviderSpec, ...] = (
            tuple(providers)
            if providers
            else tuple(get_onnx_execution_providers(get_device_info()))
        )
        self._prob_threshold = float(prob_threshold)
        self._lock = threading.Lock()
        self._session: ort.InferenceSession | None = None
        self._input_name: str = "image"
        self._output_name: str = "prob"

    def _resolve_model_path(self) -> Path | None:
        if self._explicit_path is not None:
            return self._explicit_path
        model_dir = resolve_segmentation_model_dir(self.key)
        return None if model_dir is None else model_dir / _MODEL_FILENAME

    def _ensure_session(self) -> ort.InferenceSession:
        with self._lock:
            if self._session is not None:
                return self._session
            model_path = self._resolve_model_path()
            if model_path is None or not model_path.is_file():
                raise ModelNotInstalledError(
                    "comic_text_mask weights are not installed"
                )
            session = create_session_with_trt_fallback(
                str(model_path),
                self._providers,
            )
            inputs = session.get_inputs()
            outputs = session.get_outputs()
            self._input_name = inputs[0].name if inputs else "image"
            self._output_name = outputs[0].name if outputs else "prob"
            self._session = session
            return session

    def _segment_crop_prob(
        self,
        session: ort.InferenceSession,
        crop_rgb: NDArray[np.uint8],
    ) -> NDArray[np.float32]:
        ch, cw = crop_rgb.shape[:2]
        scale = _INPUT_SIZE / float(max(ch, cw))
        nh = max(1, min(_INPUT_SIZE, int(round(ch * scale))))
        nw = max(1, min(_INPUT_SIZE, int(round(cw * scale))))
        interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_LINEAR
        resized = cv2.resize(crop_rgb, (nw, nh), interpolation=interp)

        canvas = np.zeros((_INPUT_SIZE, _INPUT_SIZE, 3), dtype=np.uint8)
        canvas[:nh, :nw] = resized
        tensor = np.ascontiguousarray(canvas.transpose(2, 0, 1)[np.newaxis], dtype=np.uint8)
        raw = session.run([self._output_name], {self._input_name: tensor})[0]
        prob = np.asarray(raw, dtype=np.float32)[0, 0, :nh, :nw]
        return np.asarray(
            cv2.resize(prob, (cw, ch), interpolation=cv2.INTER_LINEAR),
            dtype=np.float32,
        )

    def _segment(
        self,
        image_bytes: bytes,
        regions: Sequence[SegmentInputRegion],
    ) -> list[SegmentResultRegion]:
        if not regions:
            return []

        rgb = decode_rgb(image_bytes)
        height, width = rgb.shape[:2]
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        session = self._ensure_session()
        scratch = np.zeros((height, width), dtype=np.uint8)
        results: list[SegmentResultRegion] = []
        output_bytes = 0

        try:
            for region in regions:
                clipped = _clip_ordered(region.bbox, width, height)
                if clipped[2] <= clipped[0] or clipped[3] <= clipped[1]:
                    res, _ = build_segment_result(
                        region,
                        crop_mask=np.zeros((0, 0), dtype=np.uint8),
                        crop_box=clipped,
                        image_shape=(height, width),
                        scratch=scratch,
                        segment_model_key=self.key,
                    )
                    results.append(res)
                    continue

                bw = clipped[2] - clipped[0]
                bh = clipped[3] - clipped[1]
                ctx_pad = max(16, int(round(0.15 * max(bw, bh))))
                cx1 = max(0, clipped[0] - ctx_pad)
                cy1 = max(0, clipped[1] - ctx_pad)
                cx2 = min(width, clipped[2] + ctx_pad)
                cy2 = min(height, clipped[3] + ctx_pad)

                crop_prob = self._segment_crop_prob(session, rgb[cy1:cy2, cx1:cx2])

                gx1 = max(cx1, clipped[0] - _GATE_PAD_PX)
                gy1 = max(cy1, clipped[1] - _GATE_PAD_PX)
                gx2 = min(cx2, clipped[2] + _GATE_PAD_PX)
                gy2 = min(cy2, clipped[3] + _GATE_PAD_PX)

                gated_prob = crop_prob[(gy1 - cy1) : (gy2 - cy1), (gx1 - cx1) : (gx2 - cx1)]
                crop_mask: MaskArray = np.where(
                    gated_prob >= self._prob_threshold,
                    np.uint8(255),
                    np.uint8(0),
                )

                core_area = max(1, bw * bh)
                core_slice = crop_mask[
                    (clipped[1] - gy1) : (clipped[3] - gy1),
                    (clipped[0] - gx1) : (clipped[2] - gx1),
                ]
                if int(np.count_nonzero(core_slice)) / float(core_area) < _MIN_NEURAL_COVERAGE:
                    _, fallback_mask = _detect_content(gray[gy1:gy2, gx1:gx2])
                    if fallback_mask.any():
                        np.bitwise_or(crop_mask, fallback_mask, out=crop_mask)

                res, added = build_segment_result(
                    region,
                    crop_mask=crop_mask,
                    crop_box=(gx1, gy1, gx2, gy2),
                    image_shape=(height, width),
                    scratch=scratch,
                    segment_model_key=self.key,
                )
                output_bytes = validate_output_budget(added, output_bytes, _MAX_OUTPUT_BYTES)
                results.append(res)
        except cv2.error as exc:
            raise InferenceError("ComicTextMask neural segmentation failed") from exc

        return results
