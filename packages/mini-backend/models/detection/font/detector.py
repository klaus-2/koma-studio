from __future__ import annotations

import json
import logging
import os
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Final, Literal

import numpy as np
import onnxruntime as ort
from PIL import Image

from onnxruntime.capi.onnxruntime_pybind11_state import (
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

from core.config import get_config
from core.device import get_device_info, get_onnx_execution_providers
from models.detection.base_detector import BaseDetector, TextDetection
from models.detection.errors import (
    DetectionModelCorruptedError,
    DetectionModelNotInstalledError,
    DetectionRuntimeError,
)
from models.detection.font.classify import classify_text_regions
from models.detection.reading_order import sort_detections_in_reading_order
from models.detection.slicing import SliceParams, compute_slice_bounds

logger = logging.getLogger(__name__)

_MODEL_ROOT_ENV: Final = "KOMA_MODELS_ROOT"
_CORRUPTED_MODEL_ERRORS: Final = (InvalidProtobuf, InvalidGraph, NoModel)
_SESSION_RUNTIME_ERRORS: Final = (
    Fail, EPFail, InvalidArgument, NoSuchFile, OrtNotImplemented, RuntimeException, OSError, ValueError
)

type ManifestStatus = Literal["installed", "incomplete"]


def _resolve_managed_font_detector_path() -> Path | None:
    raw_root = os.getenv(_MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None

    model_dir = Path(raw_root).expanduser().resolve() / "font_rtdetr_v2"
    return model_dir / "detector.onnx"


def _update_manifest_status(model_path: Path, status: ManifestStatus) -> None:
    manifest_path = model_path.parent / "manifest.json"
    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return
    except (OSError, ValueError) as exc:
        logger.warning(
            "detection.manifest_unreadable",
            extra={"manifest_path": str(manifest_path), "error": str(exc)},
        )
        return
    if not isinstance(payload, dict):
        return

    payload["status"] = status
    payload.setdefault("modelId", model_path.parent.name)
    # Write-then-rename so a crash mid-write can never leave a truncated manifest.
    temp_path = manifest_path.with_suffix(".json.tmp")
    try:
        temp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temp_path, manifest_path)
    except OSError as exc:
        temp_path.unlink(missing_ok=True)
        logger.warning(
            "detection.manifest_write_failed",
            extra={"manifest_path": str(manifest_path), "error": str(exc)},
        )


def font_detector_payload_available() -> bool:
    managed_model_path = _resolve_managed_font_detector_path()
    return managed_model_path is not None and managed_model_path.exists()


def repair_font_detector_manifest_if_payload_present() -> bool:
    managed_model_path = _resolve_managed_font_detector_path()
    if managed_model_path is None or not managed_model_path.is_file():
        return False
    _update_manifest_status(managed_model_path, "installed")
    return True


def calculate_iou(rect1: list[float], rect2: list[float]) -> float:
    x1 = max(rect1[0], rect2[0])
    y1 = max(rect1[1], rect2[1])
    x2 = min(rect1[2], rect2[2])
    y2 = min(rect1[3], rect2[3])

    intersection_area = max(0, x2 - x1) * max(0, y2 - y1)
    rect1_area = (rect1[2] - rect1[0]) * (rect1[3] - rect1[1])
    rect2_area = (rect2[2] - rect2[0]) * (rect2[3] - rect2[1])
    union_area = rect1_area + rect2_area - intersection_area

    return intersection_area / union_area if union_area > 0 else 0.0


def do_rectangles_overlap(
    rect1: list[float], rect2: list[float], iou_threshold: float = 0.2
) -> bool:
    return calculate_iou(rect1, rect2) >= iou_threshold


def is_mostly_contained(
    outer_box: list[float], inner_box: list[float], threshold: float
) -> bool:
    ix1, iy1, ix2, iy2 = inner_box
    ox1, oy1, ox2, oy2 = outer_box

    inner_area = (ix2 - ix1) * (iy2 - iy1)
    outer_area = (ox2 - ox1) * (oy2 - oy1)
    if outer_area < inner_area or inner_area <= 0:
        return False

    intersection_area = max(0, min(ix2, ox2) - max(ix1, ox1)) * max(
        0, min(iy2, oy2) - max(iy1, oy1)
    )
    return (intersection_area / inner_area) >= threshold


def merge_boxes(box1: list[float], box2: list[float]) -> list[float]:
    return [
        min(box1[0], box2[0]),
        min(box1[1], box2[1]),
        max(box1[2], box2[2]),
        max(box1[3], box2[3]),
    ]


def merge_overlapping_boxes(
    bboxes: np.ndarray,
    containment_threshold: float = 0.3,
    overlap_threshold: float = 0.5,
) -> np.ndarray:
    if bboxes.size == 0:
        return np.empty((0, 4), dtype=int)

    boxes: list[list[float]] = [[float(v) for v in row] for row in bboxes.tolist()]
    accepted: list[list[float]] = []
    for i, box in enumerate(boxes):
        merged = list(box)
        for j, other in enumerate(boxes):
            if i == j:
                continue
            if is_mostly_contained(merged, other, containment_threshold) or is_mostly_contained(
                other, merged, containment_threshold
            ):
                merged = merge_boxes(merged, other)
        if any(do_rectangles_overlap(merged, acc, overlap_threshold) for acc in accepted):
            continue
        accepted.append(merged)

    return np.array(accepted, dtype=int) if accepted else np.empty((0, 4), dtype=int)


def filter_and_fix_bboxes(
    bboxes: np.ndarray,
    image_shape: tuple[int, int] | tuple[int, int, int],
    width_tolerance: int = 5,
    height_tolerance: int = 5,
) -> np.ndarray:
    if bboxes is None or len(bboxes) == 0:
        return np.empty((0, 4), dtype=int)

    img_h, img_w = image_shape[:2]
    cleaned: list[list[int]] = []
    for box in np.asarray(bboxes):
        x1, y1, x2, y2 = [int(v) for v in box[:4]]

        x1 = max(0, min(x1, img_w))
        x2 = max(0, min(x2, img_w))
        y1 = max(0, min(y1, img_h))
        y2 = max(0, min(y2, img_h))

        w = x2 - x1
        h = y2 - y1
        if w <= width_tolerance or h <= height_tolerance:
            continue
        cleaned.append([x1, y1, x2, y2])

    if not cleaned:
        return np.empty((0, 4), dtype=int)
    return np.array(cleaned, dtype=int)


class ImageSlicer:
    def __init__(
        self,
        *,
        slice_params: SliceParams = SliceParams(),
        merge_iou_threshold: float = 0.2,
        duplicate_iou_threshold: float = 0.5,
        merge_y_distance_threshold: float = 0.1,
        containment_threshold: float = 0.85,
    ) -> None:
        self.slice_params = slice_params
        self.merge_iou_threshold = merge_iou_threshold
        self.duplicate_iou_threshold = duplicate_iou_threshold
        self.merge_y_distance_threshold = merge_y_distance_threshold
        self.containment_threshold = containment_threshold

    def box_contained(
        self, box1: list[float], box2: list[float]
    ) -> tuple[bool, float, int]:
        area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
        area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])

        ix1 = max(box1[0], box2[0])
        iy1 = max(box1[1], box2[1])
        ix2 = min(box1[2], box2[2])
        iy2 = min(box1[3], box2[3])
        if ix2 <= ix1 or iy2 <= iy1:
            return False, 0.0, 0

        intersection_area = (ix2 - ix1) * (iy2 - iy1)
        smaller_area = min(area1, area2)
        if smaller_area <= 0:
            return False, 0.0, 0

        containment_ratio = intersection_area / smaller_area
        if containment_ratio >= self.containment_threshold:
            if area1 > area2:
                return True, containment_ratio, 1
            return True, containment_ratio, 2
        return False, containment_ratio, 0

    def merge_overlapping_boxes(
        self, boxes: np.ndarray, image_height: int
    ) -> np.ndarray:
        if boxes.size == 0:
            return boxes

        box_list = boxes.tolist()
        y_distance_threshold = self.merge_y_distance_threshold * image_height

        i = 0
        while i < len(box_list) - 1:
            j = i + 1
            while j < len(box_list):
                box1 = box_list[i]
                box2 = box_list[j]
                iou = calculate_iou(box1, box2)

                box1_w = box1[2] - box1[0]
                box1_h = box1[3] - box1[1]
                box2_w = box2[2] - box2[0]
                box2_h = box2[3] - box2[1]
                box1_area = box1_w * box1_h
                box2_area = box2_w * box2_h

                is_contained, _, which_contains = self.box_contained(box1, box2)
                if is_contained:
                    if which_contains == 1:
                        box_list.pop(j)
                    else:
                        box_list[i] = box2
                        box_list.pop(j)
                    continue

                if iou >= self.duplicate_iou_threshold:
                    if box2_area > box1_area:
                        box_list[i] = box2
                    box_list.pop(j)
                    continue

                y_dist = min(abs(box1[1] - box2[3]), abs(box1[3] - box2[1]))
                local_y_threshold = min(y_distance_threshold, max(box1_h, box2_h) * 0.1)
                x_overlap = max(0, min(box1[2], box2[2]) - max(box1[0], box2[0]))
                x_overlap_ratio = x_overlap / float(max(1, min(box1_w, box2_w)))
                size_ratio = min(box1_area, box2_area) / float(
                    max(1, max(box1_area, box2_area))
                )

                should_merge = (
                    y_dist < local_y_threshold
                    and x_overlap_ratio > self.merge_iou_threshold
                    and size_ratio > 0.3
                    and abs(box1[0] - box2[0]) < 0.5 * max(box1_w, box2_w)
                    and abs(box1[2] - box2[2]) < 0.5 * max(box1_w, box2_w)
                )
                if should_merge:
                    merged = [
                        min(box1[0], box2[0]),
                        min(box1[1], box2[1]),
                        max(box1[2], box2[2]),
                        max(box1[3], box2[3]),
                    ]
                    merged_w = merged[2] - merged[0]
                    merged_h = merged[3] - merged[1]
                    merged_area = merged_w * merged_h
                    if merged_area > 3 * max(box1_area, box2_area):
                        j += 1
                        continue
                    box_list[i] = merged
                    box_list.pop(j)
                else:
                    j += 1
            i += 1

        return np.array(box_list, dtype=int)

    @staticmethod
    def _shift_y(boxes: np.ndarray, offset: int) -> np.ndarray:
        shifted = boxes.copy()
        shifted[:, [1, 3]] += offset
        return shifted

    def process_slices_for_detection(
        self,
        image: np.ndarray,
        detect_func: Callable[[np.ndarray], tuple[np.ndarray, np.ndarray]],
    ) -> tuple[np.ndarray, np.ndarray]:
        height, width = image.shape[:2]
        bounds = compute_slice_bounds(height, width, self.slice_params)
        if len(bounds) <= 1:
            return detect_func(image)

        bubble_parts: list[np.ndarray] = []
        text_parts: list[np.ndarray] = []
        for start_y, end_y in bounds:
            bubble_boxes, text_boxes = detect_func(image[start_y:end_y])
            if bubble_boxes.size > 0:
                bubble_parts.append(self._shift_y(bubble_boxes, start_y))
            if text_boxes.size > 0:
                text_parts.append(self._shift_y(text_boxes, start_y))

        empty = np.empty((0, 4), dtype=int)
        bubbles = np.vstack(bubble_parts) if bubble_parts else empty
        texts = np.vstack(text_parts) if text_parts else empty
        if bubbles.size > 0:
            bubbles = self.merge_overlapping_boxes(bubbles, image_height=height)
        if texts.size > 0:
            texts = self.merge_overlapping_boxes(texts, image_height=height)
        return bubbles, texts


class FontRTDetrV2Detector(BaseDetector):
    key = "font_rtdetr_v2"
    name = "RT-DETR v2 (ONNX)"

    def __init__(
        self,
        model_path: str | Path | None = None,
        confidence_threshold: float | None = None,
        nms_threshold: float | None = None,
        providers: Sequence[str] | None = None,
    ) -> None:
        config = get_config()
        self.confidence_threshold = 0.3 if confidence_threshold is None else float(confidence_threshold)
        self.nms_threshold = (
            float(config.detection_nms_threshold) if nms_threshold is None else float(nms_threshold)
        )
        self.model_path: Path | None = (
            Path(model_path) if model_path else _resolve_managed_font_detector_path()
        )
        self.providers: list[str] = (
            list(providers) if providers else get_onnx_execution_providers(get_device_info())
        )
        self.session: ort.InferenceSession | None = None
        self.image_input_name: str = "images"
        self.target_size_input_name: str | None = "orig_target_sizes"
        self.image_slicer = ImageSlicer()

    def _ensure_session(self) -> None:
        if self.session is not None:
            return
        if self.model_path is None or not self.model_path.is_file():
            raise DetectionModelNotInstalledError(self.key)

        try:
            session = ort.InferenceSession(str(self.model_path), providers=self.providers)
        except _CORRUPTED_MODEL_ERRORS as exc:
            _update_manifest_status(self.model_path, "incomplete")
            raise DetectionModelCorruptedError(self.key, self.model_path, str(exc)) from exc
        except (AttributeError, *_SESSION_RUNTIME_ERRORS) as exc:
            # AttributeError covers a broken onnxruntime install where the
            # module exists but has no usable InferenceSession.
            raise DetectionRuntimeError(self.key, str(exc)) from exc

        _update_manifest_status(self.model_path, "installed")
        input_names = [item.name for item in session.get_inputs()]
        self.image_input_name = "images" if "images" in input_names else input_names[0]
        self.target_size_input_name = "orig_target_sizes" if "orig_target_sizes" in input_names else None
        self.session = session

    def _detect(self, image: Image.Image) -> list[TextDetection]:
        self._ensure_session()

        rgb_image = np.asarray(image.convert("RGB"))
        bubble_boxes, text_boxes = self.image_slicer.process_slices_for_detection(
            rgb_image, self._detect_single_image
        )

        text_boxes = filter_and_fix_bboxes(text_boxes, rgb_image.shape)
        text_boxes = merge_overlapping_boxes(text_boxes)

        classified_regions = classify_text_regions(
            image=rgb_image,
            text_boxes=text_boxes,
            bubble_boxes=bubble_boxes,
        )
        detections: list[TextDetection] = []
        for region in classified_regions:
            x1, y1, x2, y2 = region.bbox
            detections.append(
                TextDetection(
                    bbox=(x1, y1, x2, y2),
                    score=1.0,
                    label=region.label,
                    source="model",
                    model_key=self.key,
                    foreground_rgb=region.foreground_rgb,
                    structural_type=region.structural_type,
                    structural_confidence=region.structural_confidence,
                    structural_source=region.structural_source,
                    matched_reference_image=region.matched_reference_image,
                ),
            )
        return sort_detections_in_reading_order(detections)

    def _detect_single_image(self, image: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        empty = np.empty((0, 4), dtype=int)
        if self.session is None:
            return empty, empty

        pil_image = Image.fromarray(image)
        resized = pil_image.resize((640, 640), Image.Resampling.BICUBIC)
        im_data = (np.asarray(resized, dtype=np.float32) / 255.0).transpose(2, 0, 1)[np.newaxis, ...]

        feed: dict[str, np.ndarray] = {self.image_input_name: im_data}
        if self.target_size_input_name is not None:
            feed[self.target_size_input_name] = np.array(
                [[pil_image.width, pil_image.height]], dtype=np.int64
            )

        outputs = self.session.run(None, feed)
        if len(outputs) < 3:
            return empty, empty

        labels = np.asarray(outputs[0]).reshape(-1)
        boxes = np.asarray(outputs[1]).reshape(-1, 4)
        scores = np.asarray(outputs[2]).reshape(-1)

        confident = scores >= self.confidence_threshold
        labels, boxes = labels[confident], boxes[confident].astype(int)
        return boxes[labels == 0], boxes[np.isin(labels, (1, 2))]
