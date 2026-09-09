from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Callable, Sequence

import numpy as np
import onnxruntime as ort
from PIL import Image

from core.config import get_config
from core.device import get_device_info, get_onnx_execution_providers
from models.detection.base_detector import BaseDetector, TextDetection
from models.detection.font.classify import classify_text_regions
from models.detection.reading_order import sort_detections_in_reading_order


_MODEL_ROOT_ENV = "KOMA_MODELS_ROOT"


def _resolve_managed_font_detector_path() -> Path | None:
    raw_root = os.getenv(_MODEL_ROOT_ENV, "").strip()
    if not raw_root:
        return None

    model_dir = Path(raw_root).expanduser().resolve() / "font_rtdetr_v2"
    return model_dir / "detector.onnx"


def _mark_manifest_incomplete(model_path: Path) -> None:
    manifest_path = model_path.parent / "manifest.json"
    if not manifest_path.exists():
        return

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            return

        payload["status"] = "incomplete"
        manifest_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        # Best effort: if fixing the manifest fails, keep the original error.
        return


def _mark_manifest_installed(model_path: Path) -> None:
    manifest_path = model_path.parent / "manifest.json"
    if not manifest_path.exists():
        return

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not isinstance(payload, dict):
            return

        payload["status"] = "installed"
        payload.setdefault("modelId", model_path.parent.name)
        manifest_path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception:
        return


def font_detector_payload_available() -> bool:
    managed_model_path = _resolve_managed_font_detector_path()
    return managed_model_path is not None and managed_model_path.exists()


def repair_font_detector_manifest_if_payload_present() -> bool:
    managed_model_path = _resolve_managed_font_detector_path()
    if managed_model_path is None or not managed_model_path.exists():
        return False
    _mark_manifest_installed(managed_model_path)
    return True


def _is_probable_model_file_error(exc: Exception) -> bool:
    detail = str(exc).lower()
    runtime_markers = (
        "has no attribute 'inferencesession'",
        'has no attribute "inferencesession"',
        "executionprovider",
        "cuda",
        "cudnn",
        "dll",
        "provider",
        "onnxruntime",
    )
    if any(marker in detail for marker in runtime_markers):
        return False

    file_markers = (
        "invalid protobuf",
        "modelproto",
        "model proto",
        "failed to load model",
        "load model from",
        "unsupported model ir version",
        "deserialize",
        "parse",
    )
    return any(marker in detail for marker in file_markers)


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

    accepted: list[list[float]] = []
    for i, box in enumerate(bboxes.tolist()):
        merged = box.copy()
        for j, other in enumerate(bboxes.tolist()):
            if i == j:
                continue
            if is_mostly_contained(
                merged, other, containment_threshold
            ) or is_mostly_contained(other, merged, containment_threshold):
                merged = merge_boxes(merged, other)

        conflict = False
        for acc in accepted:
            if do_rectangles_overlap(merged, acc, overlap_threshold):
                conflict = True
                break
        if conflict:
            continue

        accepted = [
            acc
            for acc in accepted
            if not do_rectangles_overlap(merged, acc, overlap_threshold)
        ]
        accepted.append(merged)

    if not accepted:
        return np.empty((0, 4), dtype=int)
    return np.array(accepted, dtype=int)


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
        height_to_width_ratio_threshold: float = 3.5,
        target_slice_ratio: float = 3.0,
        overlap_height_ratio: float = 0.2,
        min_slice_height_ratio: float = 0.7,
        merge_iou_threshold: float = 0.2,
        duplicate_iou_threshold: float = 0.5,
        merge_y_distance_threshold: float = 0.1,
        containment_threshold: float = 0.85,
    ) -> None:
        self.height_to_width_ratio_threshold = height_to_width_ratio_threshold
        self.target_slice_ratio = target_slice_ratio
        self.overlap_height_ratio = overlap_height_ratio
        self.min_slice_height_ratio = min_slice_height_ratio
        self.merge_iou_threshold = merge_iou_threshold
        self.duplicate_iou_threshold = duplicate_iou_threshold
        self.merge_y_distance_threshold = merge_y_distance_threshold
        self.containment_threshold = containment_threshold

    def should_slice(self, image: np.ndarray) -> bool:
        height, width = image.shape[:2]
        return (height / float(max(width, 1))) > self.height_to_width_ratio_threshold

    def calculate_slice_params(self, image: np.ndarray) -> tuple[int, int, int, int]:
        height, width = image.shape[:2]
        slice_width = width
        slice_height = int(slice_width * self.target_slice_ratio)
        effective_slice_height = int(slice_height * (1.0 - self.overlap_height_ratio))
        num_slices = max(1, math.ceil(height / float(max(effective_slice_height, 1))))

        last_slice_start = (num_slices - 1) * effective_slice_height
        last_slice_height = height - last_slice_start
        if (
            num_slices > 1
            and (last_slice_height / float(max(slice_height, 1)))
            < self.min_slice_height_ratio
        ):
            num_slices -= 1

        return slice_width, slice_height, effective_slice_height, num_slices

    def get_slice(
        self,
        image: np.ndarray,
        slice_number: int,
        effective_slice_height: int,
        slice_height: int,
    ) -> tuple[np.ndarray, int, int]:
        height, width = image.shape[:2]
        start_y = slice_number * effective_slice_height
        end_y = (
            height
            if slice_number
            == math.ceil(height / float(max(effective_slice_height, 1))) - 1
            else min(start_y + slice_height, height)
        )
        return image[start_y:end_y, 0:width].copy(), start_y, end_y

    def adjust_box_coordinates(self, boxes: np.ndarray, start_y: int) -> np.ndarray:
        if boxes.size == 0:
            return boxes
        adjusted = boxes.copy()
        adjusted[:, 1] += start_y
        adjusted[:, 3] += start_y
        return adjusted

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

    def process_slices_for_detection(
        self,
        image: np.ndarray,
        detect_func: Callable[[np.ndarray], tuple[np.ndarray, np.ndarray]],
    ) -> tuple[np.ndarray, np.ndarray]:
        if not self.should_slice(image):
            return detect_func(image)

        _, slice_height, effective_slice_height, num_slices = (
            self.calculate_slice_params(image)
        )
        all_bubble_boxes: list[np.ndarray] = []
        all_text_boxes: list[np.ndarray] = []

        for slice_idx in range(num_slices):
            slice_img, start_y, _ = self.get_slice(
                image, slice_idx, effective_slice_height, slice_height
            )
            bubble_boxes, text_boxes = detect_func(slice_img)

            if isinstance(bubble_boxes, np.ndarray) and bubble_boxes.size > 0:
                all_bubble_boxes.append(
                    self.adjust_box_coordinates(bubble_boxes, start_y)
                )
            if isinstance(text_boxes, np.ndarray) and text_boxes.size > 0:
                all_text_boxes.append(self.adjust_box_coordinates(text_boxes, start_y))

        combined_bubble = (
            np.vstack(all_bubble_boxes)
            if all_bubble_boxes
            else np.empty((0, 4), dtype=int)
        )
        combined_text = (
            np.vstack(all_text_boxes) if all_text_boxes else np.empty((0, 4), dtype=int)
        )

        if combined_bubble.size > 0:
            combined_bubble = self.merge_overlapping_boxes(
                combined_bubble, image_height=image.shape[0]
            )
        if combined_text.size > 0:
            combined_text = self.merge_overlapping_boxes(
                combined_text, image_height=image.shape[0]
            )

        return combined_bubble, combined_text


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
        self.confidence_threshold = (
            float(confidence_threshold) if confidence_threshold is not None else 0.3
        )
        self.nms_threshold = (
            float(nms_threshold)
            if nms_threshold is not None
            else float(config.detection_nms_threshold)
        )

        self.base_dir = Path(__file__).resolve().parent
        managed_model_path = _resolve_managed_font_detector_path()
        self.model_path = (
            Path(model_path)
            if model_path
            else (managed_model_path if managed_model_path is not None else Path(""))
        )
        self.providers = (
            list(providers)
            if providers
            else get_onnx_execution_providers(get_device_info())
        )

        self.session: ort.InferenceSession | None = None
        self.image_input_name: str = "images"
        self.target_size_input_name: str | None = "orig_target_sizes"

        self.image_slicer = ImageSlicer(
            height_to_width_ratio_threshold=3.5,
            target_slice_ratio=3.0,
            overlap_height_ratio=0.2,
            min_slice_height_ratio=0.7,
        )

    def _ensure_session(self) -> None:
        if self.session is not None:
            return

        if not self.model_path.exists():
            raise RuntimeError(
                "The font_rtdetr_v2 detector.onnx model was not found in local storage. "
                "Install the model in the Model Manager before running detection.",
            )

        session_factory = getattr(ort, "InferenceSession", None)
        if not callable(session_factory):
            raise RuntimeError(
                "Failed to initialize the ONNX runtime for font_rtdetr_v2. "
                "The model file exists, but the onnxruntime package is incomplete or inconsistent. "
                f"Detalhe: {type(ort).__name__} sem InferenceSession.",
            )

        load_errors: list[str] = []
        corruption_detected = False
        try:
            self.session = session_factory(
                str(self.model_path), providers=self.providers
            )
        except Exception as exc:
            load_errors.append(f"{self.model_path}: {exc}")
            corruption_detected = _is_probable_model_file_error(exc)
            if corruption_detected:
                _mark_manifest_incomplete(self.model_path)

        if self.session is None:
            if corruption_detected:
                raise RuntimeError(
                    "The font_rtdetr_v2 model file is invalid/corrupted in local storage. "
                    "Uninstall and reinstall it in the Model Manager. "
                    f"Detalhe: {' | '.join(load_errors)}",
                )
            raise RuntimeError(
                "Failed to initialize the ONNX runtime for font_rtdetr_v2. "
                "The model file exists, but the runtime failed to open the session. "
                f"Detalhe: {' | '.join(load_errors)}",
            )

        _mark_manifest_installed(self.model_path)

        input_names = [item.name for item in self.session.get_inputs()]

        if "images" in input_names:
            self.image_input_name = "images"
        else:
            self.image_input_name = input_names[0]

        self.target_size_input_name = (
            "orig_target_sizes" if "orig_target_sizes" in input_names else None
        )

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
        for idx, region in enumerate(classified_regions, start=1):
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
        if self.session is None:
            return np.empty((0, 4), dtype=int), np.empty((0, 4), dtype=int)

        pil_image = Image.fromarray(image)
        resized = pil_image.resize((640, 640))
        arr = np.asarray(resized, dtype=np.float32) / 255.0
        arr = np.transpose(arr, (2, 0, 1))
        im_data = arr[np.newaxis, ...]

        w, h = pil_image.size
        orig_size = np.array([[w, h]], dtype=np.int64)

        feed: dict[str, np.ndarray] = {self.image_input_name: im_data}
        if self.target_size_input_name is not None:
            feed[self.target_size_input_name] = orig_size

        outputs = self.session.run(None, feed)
        if len(outputs) < 3:
            return np.empty((0, 4), dtype=int), np.empty((0, 4), dtype=int)

        labels, boxes, scores = outputs[:3]

        if isinstance(labels, np.ndarray) and labels.ndim == 2 and labels.shape[0] == 1:
            labels = labels[0]
        if isinstance(scores, np.ndarray) and scores.ndim == 2 and scores.shape[0] == 1:
            scores = scores[0]
        if isinstance(boxes, np.ndarray) and boxes.ndim == 3 and boxes.shape[0] == 1:
            boxes = boxes[0]

        bubble_boxes: list[list[int]] = []
        text_boxes: list[list[int]] = []

        for label, box, score in zip(labels, boxes, scores):
            conf = float(score)
            if conf < self.confidence_threshold:
                continue

            x1, y1, x2, y2 = [int(v) for v in box.tolist()]
            class_id = int(label)
            if class_id == 0:
                bubble_boxes.append([x1, y1, x2, y2])
            elif class_id in (1, 2):
                text_boxes.append([x1, y1, x2, y2])

        bubble_arr = (
            np.array(bubble_boxes, dtype=int)
            if bubble_boxes
            else np.empty((0, 4), dtype=int)
        )
        text_arr = (
            np.array(text_boxes, dtype=int)
            if text_boxes
            else np.empty((0, 4), dtype=int)
        )
        return bubble_arr, text_arr
