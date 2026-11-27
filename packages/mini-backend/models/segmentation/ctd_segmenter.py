"""Neural pixel-level text segmentation using Comic Text Detector's U-Net `seg` head.

Reuses the already-installed ``comictextdetector.pt.onnx`` weights and runs the
segmentation head on clustered native-resolution crops (rather than full-page
downscales) so fine glyphs over dense hatching, gradients, and colored artwork
retain sharp masks without swallowing background details.
"""

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
from models.detection.storage import resolve_detection_model_path
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
    cluster_region_bboxes,
    decode_rgb,
    validate_output_budget,
)

type FloatArray = NDArray[np.float32]
type MaskArray = NDArray[np.uint8]

_CTD_INPUT_SIZE: Final[int] = 1024
_DEFAULT_PROB_THRESHOLD: Final[float] = 0.18
_BOX_GATE_PAD_PX: Final[int] = 6
_MIN_NEURAL_COVERAGE: Final[float] = 0.02
_MAX_CROP_UPSCALE: Final[float] = 1.5
_MAX_OUTPUT_BYTES: Final[int] = 64 * 1024 * 1024


class CtdTextSegmenter(BaseSegmenter):
    key: ClassVar[str] = "ctd_text_seg"
    name: ClassVar[str] = "CTD Text Mask (ONNX)"

    def __init__(
        self,
        model_path: str | Path | None = None,
        providers: Sequence[OnnxProviderSpec] | None = None,
        *,
        prob_threshold: float = _DEFAULT_PROB_THRESHOLD,
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
        self._input_name: str = "images"
        self._seg_output_name: str | None = None

    def _ensure_session(self) -> ort.InferenceSession:
        with self._lock:
            if self._session is not None:
                return self._session
            model_path = self._explicit_path or resolve_detection_model_path(
                "comic_text_detector"
            )
            if model_path is None or not model_path.is_file():
                raise ModelNotInstalledError(
                    "ctd_text_seg requires comic_text_detector weights to be installed"
                )
            session = create_session_with_trt_fallback(
                str(model_path),
                self._providers,
            )
            inputs = session.get_inputs()
            self._input_name = inputs[0].name if inputs else "images"
            outputs = session.get_outputs()
            seg_meta = next((item for item in outputs if "seg" in item.name.lower()), None)
            if seg_meta is not None:
                self._seg_output_name = seg_meta.name
            elif len(outputs) >= 2:
                self._seg_output_name = outputs[1].name
            else:
                raise InferenceError("comictextdetector model lacks segmentation output head")
            self._session = session
            return session

    def _run_seg_on_crop(
        self,
        session: ort.InferenceSession,
        crop_rgb: NDArray[np.uint8],
    ) -> FloatArray:
        ch, cw = crop_rgb.shape[:2]
        scale = min(_CTD_INPUT_SIZE / float(max(ch, cw)), _MAX_CROP_UPSCALE)
        nh = max(1, min(_CTD_INPUT_SIZE, int(round(ch * scale))))
        nw = max(1, min(_CTD_INPUT_SIZE, int(round(cw * scale))))
        interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_LINEAR
        resized = cv2.resize(crop_rgb, (nw, nh), interpolation=interp)

        canvas = np.zeros((_CTD_INPUT_SIZE, _CTD_INPUT_SIZE, 3), dtype=np.uint8)
        canvas[:nh, :nw] = resized
        tensor = np.ascontiguousarray(
            (canvas.astype(np.float32) * np.float32(1.0 / 255.0)).transpose(2, 0, 1)[np.newaxis]
        )
        assert self._seg_output_name is not None
        raw = session.run([self._seg_output_name], {self._input_name: tensor})[0]
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
        session = self._ensure_session()

        windows = cluster_region_bboxes(regions, width, height)
        full_prob = np.zeros((height, width), dtype=np.float32)
        for wx1, wy1, wx2, wy2 in windows:
            crop_prob = self._run_seg_on_crop(session, rgb[wy1:wy2, wx1:wx2])
            np.maximum(full_prob[wy1:wy2, wx1:wx2], crop_prob, out=full_prob[wy1:wy2, wx1:wx2])

        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        scratch = np.zeros((height, width), dtype=np.uint8)
        results: list[SegmentResultRegion] = []
        output_bytes = 0

        try:
            for region in regions:
                clipped = _clip_ordered(region.bbox, width, height)
                if clipped[2] <= clipped[0] or clipped[3] <= clipped[1]:
                    res, added = build_segment_result(
                        region,
                        crop_mask=np.zeros((0, 0), dtype=np.uint8),
                        crop_box=clipped,
                        image_shape=(height, width),
                        scratch=scratch,
                        segment_model_key=self.key,
                    )
                    results.append(res)
                    continue

                gx1 = max(0, clipped[0] - _BOX_GATE_PAD_PX)
                gy1 = max(0, clipped[1] - _BOX_GATE_PAD_PX)
                gx2 = min(width, clipped[2] + _BOX_GATE_PAD_PX)
                gy2 = min(height, clipped[3] + _BOX_GATE_PAD_PX)

                crop_mask: MaskArray = np.where(
                    full_prob[gy1:gy2, gx1:gx2] >= self._prob_threshold,
                    np.uint8(255),
                    np.uint8(0),
                )

                core_area = max(1, (clipped[2] - clipped[0]) * (clipped[3] - clipped[1]))
                cy1, cy2 = clipped[1] - gy1, clipped[3] - gy1
                cx1, cx2 = clipped[0] - gx1, clipped[2] - gx1
                core_cov = int(np.count_nonzero(crop_mask[cy1:cy2, cx1:cx2])) / float(core_area)
                if core_cov < _MIN_NEURAL_COVERAGE:
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
            raise InferenceError("CTD neural text segmentation failed") from exc

        return results
