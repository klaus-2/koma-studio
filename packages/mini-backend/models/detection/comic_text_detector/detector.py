from __future__ import annotations

import math
from pathlib import Path
from typing import Sequence

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

from core.config import get_config
from core.device import get_device_info, get_onnx_execution_providers
from models.detection.base_detector import BaseDetector, TextDetection
from models.detection.reading_order import sort_detections_in_reading_order
from models.detection.storage import resolve_detection_model_path


class ComicTextDetector(BaseDetector):
    key = "comic_text_detector"
    name = "Comic Text Detector (ONNX)"

    _default_confidence = 0.15
    _min_box_size_px = 6
    _slice_ratio_threshold = 3.5
    _slice_target_ratio = 3.0
    _slice_overlap_ratio = 0.2
    _slice_min_height_ratio = 0.7

    def __init__(
        self,
        model_path: str | Path | None = None,
        confidence_threshold: float | None = None,
        nms_threshold: float | None = None,
        providers: Sequence[str] | None = None,
    ) -> None:
        config = get_config()
        self.confidence_threshold = (
            float(confidence_threshold)
            if confidence_threshold is not None
            else self._default_confidence
        )
        self.nms_threshold = (
            float(nms_threshold)
            if nms_threshold is not None
            else float(config.detection_nms_threshold)
        )

        base_dir = Path(__file__).resolve().parent
        self.model_path = Path(model_path) if model_path else (
            resolve_detection_model_path(self.key) or (base_dir / "weights" / "comictextdetector.pt.onnx")
        )
        if not self.model_path.exists():
            raise FileNotFoundError(f"ONNX detector not found: {self.model_path}")

        selected_providers = list(providers) if providers else get_onnx_execution_providers(get_device_info())
        self.session = ort.InferenceSession(str(self.model_path), providers=selected_providers)
        self.input_name = self.session.get_inputs()[0].name

    def _detect(self, image: Image.Image) -> list[TextDetection]:
        rgb = np.asarray(image.convert("RGB"))
        candidates = self._detect_with_slicing(rgb, score_threshold=self.confidence_threshold)
        if not candidates:
            return []
        merged = self._merge_text_lines(candidates, width=rgb.shape[1], height=rgb.shape[0])

        # Recall pass: if only one block was found, retry with a lower threshold
        # to recover secondary text areas (e.g. credits/watermarks at the bottom).
        recall_threshold = max(0.05, min(self.confidence_threshold * 0.5, 0.10))
        if len(merged) < 2 and recall_threshold < self.confidence_threshold:
            extra_candidates = self._detect_with_slicing(rgb, score_threshold=recall_threshold)
            if extra_candidates:
                combined = candidates + extra_candidates
                merged = self._merge_text_lines(combined, width=rgb.shape[1], height=rgb.shape[0])

        return sort_detections_in_reading_order(self._apply_nms(merged))

    def _detect_with_slicing(self, rgb: np.ndarray, score_threshold: float) -> list[TextDetection]:
        height, width = rgb.shape[:2]
        if width <= 0 or height <= 0:
            return []

        if (height / float(width)) <= self._slice_ratio_threshold:
            return self._detect_single(rgb, score_threshold=score_threshold)

        slice_height = int(width * self._slice_target_ratio)
        effective_slice_height = max(1, int(slice_height * (1.0 - self._slice_overlap_ratio)))
        num_slices = max(1, math.ceil(height / float(effective_slice_height)))

        last_slice_start = (num_slices - 1) * effective_slice_height
        last_slice_height = height - last_slice_start
        if num_slices > 1 and (last_slice_height / float(max(slice_height, 1))) < self._slice_min_height_ratio:
            num_slices -= 1

        detections: list[TextDetection] = []
        for slice_idx in range(num_slices):
            start_y = slice_idx * effective_slice_height
            end_y = height if slice_idx == num_slices - 1 else min(start_y + slice_height, height)
            slice_img = rgb[start_y:end_y, 0:width]
            for det in self._detect_single(slice_img, score_threshold=score_threshold):
                x1, y1, x2, y2 = det.bbox
                detections.append(
                    TextDetection(
                        bbox=(x1, y1 + start_y, x2, y2 + start_y),
                        score=det.score,
                        label=det.label,
                        source=det.source,
                        model_key=det.model_key,
                    ),
                )
        return detections

    def _detect_single(self, rgb: np.ndarray, score_threshold: float) -> list[TextDetection]:
        target_size = 1024
        height, width = rgb.shape[:2]
        resized = cv2.resize(rgb, (target_size, target_size), interpolation=cv2.INTER_LINEAR)
        tensor = np.transpose(resized.astype(np.float32) / 255.0, (2, 0, 1))[np.newaxis, ...]

        blk = self.session.run(None, {self.input_name: tensor})[0]
        rows = np.asarray(blk[0], dtype=np.float32)
        if rows.ndim != 2 or rows.shape[1] < 7:
            return []

        scale_x = width / float(target_size)
        scale_y = height / float(target_size)

        detections: list[TextDetection] = []
        for row in rows:
            cx, cy, bw, bh, obj_score, class_0, class_1 = [float(value) for value in row[:7]]
            score = obj_score * max(class_0, class_1)
            if score < score_threshold:
                continue

            x1 = int(max(0, min(width, round((cx - bw / 2.0) * scale_x))))
            y1 = int(max(0, min(height, round((cy - bh / 2.0) * scale_y))))
            x2 = int(max(0, min(width, round((cx + bw / 2.0) * scale_x))))
            y2 = int(max(0, min(height, round((cy + bh / 2.0) * scale_y))))

            box_width = x2 - x1
            box_height = y2 - y1
            if box_width < self._min_box_size_px or box_height < self._min_box_size_px:
                continue

            aspect = box_width / float(max(1, box_height))
            if aspect > 30.0 or aspect < 0.03:
                continue

            detections.append(
                TextDetection(
                    bbox=(x1, y1, x2, y2),
                    score=float(score),
                    label="text",
                    source="model",
                    model_key=self.key,
                ),
            )
        return self._apply_nms(detections)

    def _merge_text_lines(self, detections: list[TextDetection], width: int, height: int) -> list[TextDetection]:
        if len(detections) <= 1:
            return detections

        mask = np.zeros((height, width), dtype=np.uint8)
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            cv2.rectangle(mask, (x1, y1), (x2, y2), 255, -1)

        kx = int(max(14, min(64, round(width * 0.035))))
        ky = int(max(12, min(56, round(height * 0.020))))
        if kx % 2 == 0:
            kx += 1
        if ky % 2 == 0:
            ky += 1

        mask = cv2.dilate(
            mask,
            cv2.getStructuringElement(cv2.MORPH_RECT, (max(9, kx // 2), ky)),
            iterations=1,
        )
        mask = cv2.morphologyEx(
            mask,
            cv2.MORPH_CLOSE,
            cv2.getStructuringElement(cv2.MORPH_RECT, (max(11, kx), max(11, ky * 2))),
            iterations=1,
        )

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        min_component_area = max(200, int(width * height * 0.00002))

        merged: list[TextDetection] = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            if w * h < min_component_area:
                continue
            if w < self._min_box_size_px or h < self._min_box_size_px:
                continue

            x1, y1, x2, y2 = x, y, x + w, y + h
            best_score = 0.0
            for det in detections:
                dx1, dy1, dx2, dy2 = det.bbox
                overlap_w = max(0, min(x2, dx2) - max(x1, dx1))
                overlap_h = max(0, min(y2, dy2) - max(y1, dy1))
                if overlap_w > 0 and overlap_h > 0:
                    best_score = max(best_score, float(det.score))

            if best_score <= 0.0:
                best_score = 0.2

            merged.append(
                TextDetection(
                    bbox=(x1, y1, x2, y2),
                    score=best_score,
                    label="text",
                    source="model",
                    model_key=self.key,
                ),
            )

        if not merged:
            return detections
        return merged

    def _apply_nms(self, detections: list[TextDetection]) -> list[TextDetection]:
        if not detections:
            return []

        boxes_xywh: list[list[int]] = []
        scores: list[float] = []
        for det in detections:
            x1, y1, x2, y2 = det.bbox
            box_w = x2 - x1
            box_h = y2 - y1
            if box_w < self._min_box_size_px or box_h < self._min_box_size_px:
                continue
            boxes_xywh.append([x1, y1, box_w, box_h])
            scores.append(float(det.score))

        if not boxes_xywh:
            return []

        indices = cv2.dnn.NMSBoxes(
            boxes_xywh,
            scores,
            score_threshold=max(0.05, min(self.confidence_threshold, 0.3)),
            nms_threshold=float(self.nms_threshold),
        )
        if indices is None or len(indices) == 0:
            return sorted(detections, key=lambda item: item.score, reverse=True)

        keep = np.array(indices).reshape(-1).tolist()
        kept = [detections[idx] for idx in keep if 0 <= idx < len(detections)]
        kept.sort(key=lambda item: item.score, reverse=True)
        return kept
