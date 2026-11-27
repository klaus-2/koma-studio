from __future__ import annotations

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

from core.config import get_config
from core.device import OnnxProviderSpec, get_device_info, get_onnx_execution_providers
from models.detection.base_detector import BaseDetector, TextDetection
from models.detection.blank_bands import detect_blank_bands, filter_slices_through_content
from models.detection.bubble.shape_classifier import classify_bubble_shape
from models.detection.errors import (
    DetectionModelCorruptedError,
    DetectionModelNotInstalledError,
    DetectionRuntimeError,
)
from models.detection.reading_order import sort_detections_in_reading_order
from models.detection.slicing import SliceParams, compute_slice_bounds
from models.detection.storage import resolve_detection_model_path
from models.geometry import BBox, greedy_nms
from models.onnx_utils import create_session_with_trt_fallback

logger = logging.getLogger(__name__)

_INPUT_SIZE: Final = 1024
_PROTO_SIZE: Final = 256
_MASK_THRESHOLD: Final = 0.5
_LETTERBOX_PAD_VALUE: Final = 114

try:
    from onnxruntime.capi.onnxruntime_pybind11_state import (  # type: ignore[import-untyped]
        EPFail,
        Fail,
        InvalidArgument,
        InvalidGraph,
        InvalidProtobuf,
        NoModel,
        NoSuchFile,
        NotImplemented as OrtNotImplemented,
        RuntimeException,
    )
except ImportError:  # pragma: no cover
    EPFail = Fail = InvalidArgument = InvalidGraph = InvalidProtobuf = RuntimeError
    NoModel = NoSuchFile = OrtNotImplemented = RuntimeException = RuntimeError

_CORRUPTED_ERRORS: Final = (InvalidProtobuf, InvalidGraph, NoModel)
_RUNTIME_ERRORS: Final = (
    Fail,
    EPFail,
    InvalidArgument,
    NoSuchFile,
    OrtNotImplemented,
    RuntimeException,
    OSError,
    ValueError,
)

_SHAPE_TO_LABEL: Final[dict[str, str]] = {
    "narration": "text_narration",
    "system_box": "text_narration",
    "scream": "text_sfx",
    "speech": "bubble",
    "thought": "bubble",
    "happy": "bubble",
    "trembling": "bubble",
    "whisper": "bubble",
}


@dataclass(frozen=True, slots=True)
class BubbleInstance:
    """Segmented speech-bubble detection with a tight page-space bbox and local binary crop mask."""

    bbox: BBox
    score: float
    mask_crop: np.ndarray


def _letterbox_image(rgb: np.ndarray, target_size: int = _INPUT_SIZE) -> tuple[np.ndarray, float, int, int]:
    h, w = rgb.shape[:2]
    scale = min(float(target_size) / float(max(1, h)), float(target_size) / float(max(1, w)))
    new_w = max(1, min(target_size, int(round(w * scale))))
    new_h = max(1, min(target_size, int(round(h * scale))))
    interp = cv2.INTER_AREA if scale < 1.0 else cv2.INTER_LINEAR
    resized = cv2.resize(rgb, (new_w, new_h), interpolation=interp)

    pad_left = (target_size - new_w) // 2
    pad_top = (target_size - new_h) // 2
    canvas = np.full((target_size, target_size, 3), _LETTERBOX_PAD_VALUE, dtype=np.uint8)
    canvas[pad_top : pad_top + new_h, pad_left : pad_left + new_w] = resized
    return canvas, scale, pad_left, pad_top


def _sigmoid(x: np.ndarray) -> np.ndarray:
    clipped = np.clip(x, -40.0, 40.0)
    return 1.0 / (1.0 + np.exp(-clipped))


def _decode_proto_crop(
    coeffs: np.ndarray,
    protos: np.ndarray,
    canvas_box: tuple[float, float, float, float],
    scale: float,
    pad_left: int,
    pad_top: int,
    img_w: int,
    img_h: int,
) -> tuple[BBox, np.ndarray] | None:
    cx1, cy1, cx2, cy2 = canvas_box
    x1 = max(0, min(img_w, int(np.floor((cx1 - pad_left) / max(scale, 1e-6)))))
    y1 = max(0, min(img_h, int(np.floor((cy1 - pad_top) / max(scale, 1e-6)))))
    x2 = max(0, min(img_w, int(np.ceil((cx2 - pad_left) / max(scale, 1e-6)))))
    y2 = max(0, min(img_h, int(np.ceil((cy2 - pad_top) / max(scale, 1e-6)))))
    if x2 - x1 < 4 or y2 - y1 < 4:
        return None

    proto_h, proto_w = protos.shape[1], protos.shape[2]
    ratio_x = float(proto_w) / float(_INPUT_SIZE)
    ratio_y = float(proto_h) / float(_INPUT_SIZE)

    px1 = max(0, min(proto_w - 1, int(np.floor(cx1 * ratio_x))))
    py1 = max(0, min(proto_h - 1, int(np.floor(cy1 * ratio_y))))
    px2 = max(px1 + 1, min(proto_w, int(np.ceil(cx2 * ratio_x))))
    py2 = max(py1 + 1, min(proto_h, int(np.ceil(cy2 * ratio_y))))

    sub_protos = protos[:, py1:py2, px1:px2]
    logits = np.tensordot(coeffs, sub_protos, axes=(0, 0)).astype(np.float32)
    probs = _sigmoid(logits)

    crop_w = x2 - x1
    crop_h = y2 - y1
    resized_prob = cv2.resize(probs, (crop_w, crop_h), interpolation=cv2.INTER_LINEAR)
    mask_crop = (resized_prob >= _MASK_THRESHOLD).astype(np.uint8) * 255
    if not np.any(mask_crop):
        mask_crop.fill(255)
    return (x1, y1, x2, y2), mask_crop


class YoloBubbleSegmenter:
    """Instance segmenter for manga/comic speech bubbles (`manga109-segmentation-bubble`)."""

    key: Final = "yolo_bubble"

    def __init__(
        self,
        model_path: str | Path | None = None,
        confidence_threshold: float = 0.35,
        nms_threshold: float = 0.5,
        providers: Sequence[OnnxProviderSpec] | None = None,
    ) -> None:
        self.confidence_threshold = float(confidence_threshold)
        self.nms_threshold = float(nms_threshold)
        self.model_path: Path | None = (
            Path(model_path) if model_path else resolve_detection_model_path(self.key)
        )
        self.providers: list[OnnxProviderSpec] = (
            list(providers) if providers else get_onnx_execution_providers(get_device_info())
        )
        self.session: ort.InferenceSession | None = None
        self.input_name: str = "images"

    def _ensure_session(self) -> None:
        if self.session is not None:
            return
        if self.model_path is None or not self.model_path.is_file():
            raise DetectionModelNotInstalledError(self.key)
        try:
            session = create_session_with_trt_fallback(
                str(self.model_path),
                self.providers,
                session_factory=ort.InferenceSession,
            )
        except _CORRUPTED_ERRORS as exc:
            raise DetectionModelCorruptedError(self.key, self.model_path, str(exc)) from exc
        except (AttributeError, *_RUNTIME_ERRORS) as exc:
            raise DetectionRuntimeError(self.key, str(exc)) from exc

        inputs = session.get_inputs()
        if inputs:
            self.input_name = inputs[0].name
        self.session = session

    def segment(self, image: Image.Image | np.ndarray) -> list[BubbleInstance]:
        self._ensure_session()
        if isinstance(image, Image.Image):
            rgb = np.asarray(image.convert("RGB"))
        else:
            arr = np.asarray(image)
            rgb = arr[..., :3] if arr.ndim == 3 else cv2.cvtColor(arr, cv2.COLOR_GRAY2RGB)
        return self._segment_rgb(rgb)

    def _segment_rgb(self, rgb: np.ndarray) -> list[BubbleInstance]:
        height, width = rgb.shape[:2]
        if height < 4 or width < 4:
            return []

        is_tall_strip = height > max(1800, int(round(2.5 * width)))
        if not is_tall_strip:
            return self._segment_single(rgb)

        bounds = compute_slice_bounds(
            height, width, SliceParams(slice_height=max(1024, width), overlap_ratio=0.25)
        )
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        slices = filter_slices_through_content(bounds, detect_blank_bands(gray))
        if len(slices) <= 1:
            return self._segment_single(rgb)

        all_instances: list[BubbleInstance] = []
        for start_y, end_y in slices:
            part = self._segment_single(rgb[start_y:end_y])
            for inst in part:
                x1, y1, x2, y2 = inst.bbox
                all_instances.append(
                    BubbleInstance(
                        bbox=(x1, y1 + start_y, x2, y2 + start_y),
                        score=inst.score,
                        mask_crop=inst.mask_crop,
                    )
                )

        if not all_instances:
            return []

        boxes_arr = np.asarray([inst.bbox for inst in all_instances], dtype=np.float64)
        scores_arr = np.asarray([inst.score for inst in all_instances], dtype=np.float64)
        keep = greedy_nms(boxes_arr, scores_arr, iou_threshold=self.nms_threshold)
        return [all_instances[idx] for idx in keep]

    def _segment_single(self, rgb: np.ndarray) -> list[BubbleInstance]:
        if self.session is None:
            return []

        img_h, img_w = rgb.shape[:2]
        canvas, scale, pad_left, pad_top = _letterbox_image(rgb, _INPUT_SIZE)
        tensor = (canvas.astype(np.float32) / 255.0).transpose(2, 0, 1)[np.newaxis, ...]
        outputs = self.session.run(None, {self.input_name: tensor})
        if len(outputs) < 2:
            return []

        raw_preds = np.asarray(outputs[0], dtype=np.float32)
        if raw_preds.ndim == 3:
            raw_preds = raw_preds[0]
        if raw_preds.shape[0] < raw_preds.shape[1]:
            preds = raw_preds.T
        else:
            preds = raw_preds

        raw_protos = np.asarray(outputs[1], dtype=np.float32)
        protos = raw_protos[0] if raw_protos.ndim == 4 else raw_protos
        if preds.ndim != 2 or preds.shape[1] < 5 or protos.ndim != 3:
            return []

        scores = preds[:, 4]
        confident = scores >= self.confidence_threshold
        if not np.any(confident):
            return []

        preds = preds[confident]
        scores = scores[confident]
        cx = preds[:, 0]
        cy = preds[:, 1]
        bw = preds[:, 2]
        bh = preds[:, 3]
        x1 = cx - 0.5 * bw
        y1 = cy - 0.5 * bh
        x2 = cx + 0.5 * bw
        y2 = cy + 0.5 * bh

        boxes_xywh = [[float(x1[i]), float(y1[i]), float(bw[i]), float(bh[i])] for i in range(len(preds))]
        indices = cv2.dnn.NMSBoxes(
            boxes_xywh,
            [float(s) for s in scores],
            score_threshold=self.confidence_threshold,
            nms_threshold=self.nms_threshold,
        )
        keep = np.asarray(indices, dtype=np.int64).reshape(-1)
        if keep.size == 0:
            return []

        proto_count = protos.shape[0]
        instances: list[BubbleInstance] = []
        for idx in keep.tolist():
            coeffs = preds[idx, 5 : 5 + proto_count]
            if coeffs.shape[0] != proto_count:
                continue
            decoded = _decode_proto_crop(
                coeffs=coeffs,
                protos=protos,
                canvas_box=(float(x1[idx]), float(y1[idx]), float(x2[idx]), float(y2[idx])),
                scale=scale,
                pad_left=pad_left,
                pad_top=pad_top,
                img_w=img_w,
                img_h=img_h,
            )
            if decoded is None:
                continue
            page_bbox, mask_crop = decoded
            instances.append(
                BubbleInstance(
                    bbox=page_bbox,
                    score=float(scores[idx]),
                    mask_crop=mask_crop,
                )
            )
        return instances


class YoloBubbleDetector(BaseDetector):
    """High-level bubble detector wrapper exposing `yolo_bubble` via the detection factory."""

    key = "yolo_bubble"
    name = "YOLO Bubble Seg"

    def __init__(
        self,
        model_path: str | Path | None = None,
        confidence_threshold: float = 0.35,
        nms_threshold: float | None = None,
        providers: Sequence[OnnxProviderSpec] | None = None,
        segmenter: YoloBubbleSegmenter | None = None,
    ) -> None:
        config = get_config()
        resolved_nms = float(config.detection_nms_threshold) if nms_threshold is None else float(nms_threshold)
        self.segmenter = segmenter or YoloBubbleSegmenter(
            model_path=model_path,
            confidence_threshold=confidence_threshold,
            nms_threshold=resolved_nms,
            providers=providers,
        )

    def _detect(self, image: Image.Image) -> list[TextDetection]:
        rgb = np.asarray(image.convert("RGB"))
        instances = self.segmenter.segment(rgb)
        detections: list[TextDetection] = []
        for inst in instances:
            x1, y1, x2, y2 = inst.bbox
            crop = rgb[y1:y2, x1:x2]
            shape_result = classify_bubble_shape(inst.mask_crop, crop_rgb=crop)
            label = _SHAPE_TO_LABEL.get(shape_result.shape, "bubble")
            detections.append(
                TextDetection(
                    bbox=inst.bbox,
                    score=inst.score,
                    label=label,
                    source="model",
                    model_key=self.key,
                    structural_type=shape_result.shape,
                    structural_confidence=shape_result.confidence,
                    structural_source=shape_result.source,
                    matched_reference_image=None,
                )
            )
        return sort_detections_in_reading_order(detections)
