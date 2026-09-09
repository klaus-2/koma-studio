from __future__ import annotations

from pathlib import Path
import re
from typing import Sequence

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image

from core.device import get_device_info, get_onnx_execution_providers
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from models.ocr.paddleocr.storage import resolve_paddleocr_model_dir


def _resolve_static_dim(value: object, fallback: int) -> int:
    if isinstance(value, int) and value > 0:
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if stripped.isdigit():
            parsed = int(stripped)
            if parsed > 0:
                return parsed
    return fallback


class CTCLabelDecoder:
    def __init__(self, dict_path: str | Path):
        with open(dict_path, "r", encoding="utf-8") as handle:
            self.dict_chars = [line.strip("\n") for line in handle]

    def __call__(
        self, logits: np.ndarray, prob_threshold: float = 0.0
    ) -> tuple[list[str], list[float]]:
        if logits.ndim == 2:
            logits = logits[None, ...]

        num_classes = logits.shape[-1]
        dict_len = len(self.dict_chars)
        if num_classes == dict_len + 2:
            vocab = [""] + self.dict_chars + [" "]
        elif num_classes == dict_len + 1:
            vocab = [""] + self.dict_chars
        elif num_classes == dict_len:
            pad = np.zeros((*logits.shape[:-1], 1), dtype=logits.dtype)
            logits = np.concatenate([pad, logits], axis=-1)
            vocab = [""] + self.dict_chars
        else:
            extra = max(0, num_classes - (dict_len + 2))
            vocab = [""] + self.dict_chars + [" "] + ([""] * extra)

        if np.max(logits) > 1.0 or np.min(logits) < 0.0:
            exp = np.exp(logits - logits.max(axis=-1, keepdims=True))
            probs = exp / exp.sum(axis=-1, keepdims=True)
        else:
            probs = logits

        texts: list[str] = []
        scores: list[float] = []
        blank = 0
        for batch_idx in range(probs.shape[0]):
            seq = probs[batch_idx]
            idxs = seq.argmax(axis=-1)
            last = -1
            chars: list[str] = []
            char_scores: list[float] = []
            for time_idx, class_idx in enumerate(idxs):
                class_idx = int(class_idx)
                if class_idx != blank and class_idx != last:
                    prob = float(seq[time_idx, class_idx])
                    if prob < prob_threshold or class_idx >= len(vocab):
                        last = class_idx
                        continue
                    ch = vocab[class_idx]
                    if ch and all(ord(ch_i) >= 32 for ch_i in ch):
                        chars.append(ch)
                        char_scores.append(prob)
                last = class_idx
            texts.append("".join(chars))
            scores.append(float(np.mean(char_scores)) if char_scores else 0.0)

        return texts, scores


def rec_resize_norm(
    image: np.ndarray,
    img_shape: tuple[int, int, int] = (3, 48, 320),
    max_wh_ratio: float | None = None,
) -> np.ndarray:
    c, target_h, target_w = img_shape
    h, w = image.shape[:2]
    ratio = w / float(max(1, h))
    if max_wh_ratio is None:
        max_wh_ratio = target_w / float(target_h)

    padded_w = int(target_h * max_wh_ratio)
    resized_w = min(padded_w, max(1, int(np.ceil(target_h * ratio))))
    resized = cv2.resize(image, (resized_w, target_h), interpolation=cv2.INTER_LINEAR)
    x = resized.astype(np.float32) / 255.0
    x = x.transpose((2, 0, 1))
    x = (x - 0.5) / 0.5

    out = np.zeros((c, target_h, padded_w), dtype=np.float32)
    out[:, :, :resized_w] = x
    return out


class PPOCRV5RecEngine(BaseOCR):
    key = "paddleocr"
    name = "PaddleOCR v5 (ONNX)"

    def __init__(
        self,
        providers: Sequence[str] | None = None,
        expansion_percentage: int = 5,
        batch_size: int = 8,
        rec_model_filename: str = "eslav_PP-OCRv5_rec_mobile_infer.onnx",
        dict_filename: str = "ppocrv5_eslav_dict.txt",
        det_model_filename: str = "ch_PP-OCRv5_mobile_det.onnx",
        model_dir: str | Path | None = None,
        model_id: str = "paddleocr",
    ) -> None:
        self.expansion_percentage = max(0, expansion_percentage)
        self.batch_size = max(1, batch_size)
        if model_dir is not None:
            self.model_dir = Path(model_dir).expanduser().resolve()
        else:
            resolved_dir = resolve_paddleocr_model_dir(model_id)
            if resolved_dir is None:
                raise RuntimeError(
                    "Managed models directory is not configured for PaddleOCR. "
                    "Verifique KOMA_MODELS_ROOT.",
                )
            self.model_dir = resolved_dir
        self.det_model_path = self.model_dir / det_model_filename
        self.model_path = self.model_dir / rec_model_filename
        self.dict_path = self.model_dir / dict_filename
        self.providers = (
            list(providers)
            if providers
            else get_onnx_execution_providers(get_device_info())
        )
        self.img_shape = (3, 48, 320)
        self.det_limit_side_len = 960
        self.det_thresh = 0.3
        self.det_box_thresh = 0.5
        self.det_unclip_ratio = 2.0
        self.det_use_dilation = False

        self.session: ort.InferenceSession | None = None
        self.det_session: ort.InferenceSession | None = None
        self.decoder: CTCLabelDecoder | None = None

    def _ensure_session(self) -> None:
        if (
            self.session is not None
            and self.det_session is not None
            and self.decoder is not None
        ):
            return
        if (
            not self.model_path.exists()
            or not self.dict_path.exists()
            or not self.det_model_path.exists()
        ):
            raise FileNotFoundError(
                f"paddleocr models not found in {self.model_dir}",
            )
        self.det_session = ort.InferenceSession(
            str(self.det_model_path), providers=self.providers
        )
        self.session = ort.InferenceSession(
            str(self.model_path), providers=self.providers
        )
        model_input_shape = self.session.get_inputs()[0].shape
        if isinstance(model_input_shape, (list, tuple)) and len(model_input_shape) >= 4:
            channels = _resolve_static_dim(model_input_shape[1], self.img_shape[0])
            height = _resolve_static_dim(model_input_shape[2], self.img_shape[1])
            width = _resolve_static_dim(model_input_shape[3], self.img_shape[2])
            self.img_shape = (channels, height, width)
        self.decoder = CTCLabelDecoder(self.dict_path)

    def _expand_box(
        self,
        bbox: tuple[int, int, int, int],
        width: int,
        height: int,
    ) -> tuple[int, int, int, int]:
        x1, y1, x2, y2 = bbox
        box_w = max(1, x2 - x1)
        box_h = max(1, y2 - y1)
        base_dx = int(box_w * self.expansion_percentage / 100.0)
        base_dy = int(box_h * self.expansion_percentage / 100.0)
        min_padding = 4 if self.expansion_percentage > 0 else 0
        dx = max(min_padding, base_dx)
        dy = max(min_padding, base_dy)
        nx1 = max(0, x1 - dx)
        ny1 = max(0, y1 - dy)
        nx2 = min(width, x2 + dx)
        ny2 = min(height, y2 + dy)
        return nx1, ny1, nx2, ny2

    def _run_recognition(
        self, crops: list[np.ndarray]
    ) -> tuple[list[str], list[float]]:
        assert self.session is not None
        assert self.decoder is not None
        if not crops:
            return [], []

        ratios = [crop.shape[1] / float(max(1, crop.shape[0])) for crop in crops]
        order = np.argsort(ratios)
        texts = [""] * len(crops)
        scores = [0.0] * len(crops)
        input_name = self.session.get_inputs()[0].name
        output_name = self.session.get_outputs()[0].name
        c, h, w = self.img_shape

        for start in range(0, len(crops), self.batch_size):
            batch_indices = order[start : start + self.batch_size]
            if batch_indices.size == 0:
                continue
            max_ratio = max(ratios[idx] for idx in batch_indices)
            batch = [
                rec_resize_norm(crops[idx], self.img_shape, max_ratio)[None, ...]
                for idx in batch_indices
            ]
            x = np.concatenate(batch, axis=0).astype(np.float32)
            logits = self.session.run([output_name], {input_name: x})[0]
            if logits.ndim == 3 and logits.shape[1] > logits.shape[2]:
                logits = np.transpose(logits, (0, 2, 1))
            decoded_texts, decoded_scores = self.decoder(logits, prob_threshold=0.0)
            for idx, text, score in zip(batch_indices, decoded_texts, decoded_scores):
                texts[int(idx)] = text
                scores[int(idx)] = float(score)

        return texts, scores

    @staticmethod
    def _resize_keep_stride(
        image: np.ndarray,
        limit_side_len: int = 960,
        limit_type: str = "min",
    ) -> np.ndarray:
        h, w = image.shape[:2]
        if limit_type == "max":
            if max(h, w) > limit_side_len:
                ratio = float(limit_side_len) / float(max(h, w))
            else:
                ratio = 1.0
        else:
            if min(h, w) < limit_side_len:
                ratio = float(limit_side_len) / float(min(h, w))
            else:
                ratio = 1.0
        nh = int(round((h * ratio) / 32) * 32)
        nw = int(round((w * ratio) / 32) * 32)
        nh = max(32, nh)
        nw = max(32, nw)
        if nh == h and nw == w:
            return image
        return cv2.resize(image, (nw, nh), interpolation=cv2.INTER_LINEAR)

    def _det_preprocess(self, image: np.ndarray) -> tuple[np.ndarray, int, int]:
        resized = self._resize_keep_stride(image, self.det_limit_side_len, "max")
        x = resized.astype(np.float32) / 255.0
        x = (x - 0.5) / 0.5
        x = x.transpose((2, 0, 1))[None].astype(np.float32)
        rh, rw = resized.shape[:2]
        return x, rh, rw

    @staticmethod
    def _quad_score(prob_map: np.ndarray, quad: np.ndarray) -> float:
        h, w = prob_map.shape[:2]
        xs = quad[:, 0]
        ys = quad[:, 1]
        xmin = int(np.clip(np.floor(xs.min()), 0, w - 1))
        xmax = int(np.clip(np.ceil(xs.max()), 0, w - 1))
        ymin = int(np.clip(np.floor(ys.min()), 0, h - 1))
        ymax = int(np.clip(np.ceil(ys.max()), 0, h - 1))
        if xmax <= xmin or ymax <= ymin:
            return 0.0

        mask = np.zeros((ymax - ymin + 1, xmax - xmin + 1), dtype=np.uint8)
        pts = quad.copy()
        pts[:, 0] -= xmin
        pts[:, 1] -= ymin
        cv2.fillPoly(mask, [pts.astype(np.int32)], 1)
        region = prob_map[ymin : ymax + 1, xmin : xmax + 1]
        values = region[mask > 0]
        if values.size == 0:
            return 0.0
        return float(values.mean())

    @staticmethod
    def _nms_boxes(
        boxes: list[tuple[int, int, int, int, float]],
        iou_thresh: float = 0.4,
    ) -> list[tuple[int, int, int, int, float]]:
        if not boxes:
            return []
        ordered = sorted(boxes, key=lambda item: item[4], reverse=True)
        kept: list[tuple[int, int, int, int, float]] = []
        for candidate in ordered:
            x1, y1, x2, y2, score = candidate
            area = max(1, x2 - x1) * max(1, y2 - y1)
            should_keep = True
            for existing in kept:
                ex1, ey1, ex2, ey2, _ = existing
                ix1 = max(x1, ex1)
                iy1 = max(y1, ey1)
                ix2 = min(x2, ex2)
                iy2 = min(y2, ey2)
                iw = max(0, ix2 - ix1)
                ih = max(0, iy2 - iy1)
                inter = iw * ih
                if inter == 0:
                    continue
                existing_area = max(1, ex2 - ex1) * max(1, ey2 - ey1)
                union = area + existing_area - inter
                if union <= 0:
                    continue
                iou = inter / float(union)
                if iou >= iou_thresh:
                    should_keep = False
                    break
            if should_keep:
                kept.append((x1, y1, x2, y2, score))
        return kept

    def _detect_text_boxes(
        self, image_bgr: np.ndarray
    ) -> list[tuple[int, int, int, int, float]]:
        assert self.det_session is not None
        img_h, img_w = image_bgr.shape[:2]
        x, resized_h, resized_w = self._det_preprocess(image_bgr)
        input_name = self.det_session.get_inputs()[0].name
        output_name = self.det_session.get_outputs()[0].name
        pred = self.det_session.run([output_name], {input_name: x})[0]
        if pred.ndim == 4:
            prob_map = pred[0, 0]
        elif pred.ndim == 3:
            prob_map = pred[0]
        else:
            return []

        mask = (prob_map > self.det_thresh).astype(np.uint8) * 255
        if self.det_use_dilation:
            mask = cv2.dilate(mask, np.ones((2, 2), np.uint8), iterations=1)
        contours, _ = cv2.findContours(mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        scale_x = img_w / float(max(1, resized_w))
        scale_y = img_h / float(max(1, resized_h))
        candidates: list[tuple[int, int, int, int, float]] = []

        for contour in contours[:1200]:
            rect = cv2.minAreaRect(contour)
            rw, rh = rect[1]
            if min(rw, rh) < 3:
                continue
            quad = cv2.boxPoints(rect).astype(np.float32)
            score = self._quad_score(prob_map, quad)
            if score < self.det_box_thresh:
                continue
            xs = quad[:, 0]
            ys = quad[:, 1]
            x1 = int(np.floor(xs.min()))
            y1 = int(np.floor(ys.min()))
            x2 = int(np.ceil(xs.max()))
            y2 = int(np.ceil(ys.max()))
            box_w = max(1, x2 - x1)
            box_h = max(1, y2 - y1)
            dx = int((box_w * (self.det_unclip_ratio - 1.0)) / 2.0)
            dy = int((box_h * (self.det_unclip_ratio - 1.0)) / 2.0)
            x1 = max(0, x1 - dx)
            y1 = max(0, y1 - dy)
            x2 = min(resized_w - 1, x2 + dx)
            y2 = min(resized_h - 1, y2 + dy)
            ox1 = int(np.clip(round(x1 * scale_x), 0, img_w - 1))
            oy1 = int(np.clip(round(y1 * scale_y), 0, img_h - 1))
            ox2 = int(np.clip(round(x2 * scale_x), 0, img_w))
            oy2 = int(np.clip(round(y2 * scale_y), 0, img_h))
            if ox2 - ox1 <= 5 or oy2 - oy1 <= 5:
                continue
            candidates.append((ox1, oy1, ox2, oy2, float(score)))
        return self._nms_boxes(candidates, iou_thresh=0.4)

    @staticmethod
    def _overlap_ratio(
        bbox_a: tuple[int, int, int, int],
        bbox_b: tuple[int, int, int, int],
    ) -> float:
        ax1, ay1, ax2, ay2 = bbox_a
        bx1, by1, bx2, by2 = bbox_b
        ix1 = max(ax1, bx1)
        iy1 = max(ay1, by1)
        ix2 = min(ax2, bx2)
        iy2 = min(ay2, by2)
        iw = max(0, ix2 - ix1)
        ih = max(0, iy2 - iy1)
        inter = iw * ih
        if inter == 0:
            return 0.0
        area_a = max(1, ax2 - ax1) * max(1, ay2 - ay1)
        area_b = max(1, bx2 - bx1) * max(1, by2 - by1)
        return inter / float(min(area_a, area_b))

    @staticmethod
    def _center_in_box(
        inner_bbox: tuple[int, int, int, int],
        outer_bbox: tuple[int, int, int, int],
    ) -> bool:
        ix1, iy1, ix2, iy2 = inner_bbox
        ox1, oy1, ox2, oy2 = outer_bbox
        cx = (ix1 + ix2) / 2.0
        cy = (iy1 + iy2) / 2.0
        return ox1 <= cx <= ox2 and oy1 <= cy <= oy2

    def _aggregate_text_for_region(
        self,
        region_bbox: tuple[int, int, int, int],
        snippet_boxes: list[tuple[int, int, int, int, float, str]],
    ) -> tuple[str, float]:
        hits: list[tuple[int, int, int, int, float, str]] = []
        for candidate in snippet_boxes:
            x1, y1, x2, y2, score, text = candidate
            if not text.strip():
                continue
            candidate_bbox = (x1, y1, x2, y2)
            overlap = self._overlap_ratio(region_bbox, candidate_bbox)
            if overlap >= 0.2 or self._center_in_box(candidate_bbox, region_bbox):
                hits.append(candidate)
        if not hits:
            return "", 0.0
        hits.sort(key=lambda item: (item[1], item[0]))
        text = " ".join(item[5] for item in hits if item[5].strip()).strip()
        scores = [item[4] for item in hits if item[5].strip()]
        score = float(np.mean(scores)) if scores else 0.0
        return text, score

    @staticmethod
    def _language_uses_spaces(language: str) -> bool:
        normalized = (language or "").strip().lower()
        return normalized not in {"ja", "zh", "zh-cn", "zh-tw", "ko"}

    @classmethod
    def _text_quality(cls, text: str, language: str) -> float:
        value = (text or "").strip()
        if not value:
            return -1.0

        alnum_count = sum(ch.isalnum() for ch in value)
        spaces = value.count(" ")
        quality = float(alnum_count) + min(8.0, spaces * 1.5)

        if not cls._language_uses_spaces(language):
            return quality

        tokens = [token for token in re.split(r"\s+", value) if token]
        normalized_tokens = [re.sub(r"^[^\w]+|[^\w]+$", "", token) for token in tokens]
        token_lengths = [len(token) for token in normalized_tokens if token]
        longest_token = max(token_lengths) if token_lengths else len(value)
        quality -= max(0, longest_token - 14) * 1.8

        if len(value) >= 12 and spaces == 0:
            quality -= 6.0
        if re.search(r"[.,;:!?¡¿](?=\w)", value):
            quality -= 3.0
        return quality

    @classmethod
    def _should_attempt_snippet_fallback(
        cls,
        text: str,
        score: float,
        language: str,
    ) -> bool:
        value = (text or "").strip()
        if not value:
            return True
        if score < 0.55:
            return True
        if not cls._language_uses_spaces(language):
            return False
        if len(value) >= 12 and " " not in value:
            return True
        if len(value) >= 7 and " " not in value and score < 0.9:
            return True
        if re.search(r"[.,;:!?¡¿](?=\w)", value):
            return True
        tokens = [token for token in re.split(r"\s+", value) if token]
        normalized_tokens = [re.sub(r"^[^\w]+|[^\w]+$", "", token) for token in tokens]
        if any(len(token) >= 16 for token in normalized_tokens if token):
            return True
        if score < 0.72 and len(value) < 6:
            return True
        return False

    @classmethod
    def _prefer_snippet_text(
        cls,
        primary_text: str,
        primary_score: float,
        snippet_text: str,
        snippet_score: float,
        language: str,
    ) -> bool:
        primary = (primary_text or "").strip()
        snippet = (snippet_text or "").strip()
        if not snippet:
            return False
        if not primary:
            return True
        if snippet_score >= primary_score + 0.08:
            return True

        primary_quality = cls._text_quality(primary, language)
        snippet_quality = cls._text_quality(snippet, language)
        if (
            cls._language_uses_spaces(language)
            and " " not in primary
            and " " in snippet
            and len(snippet) >= len(primary) + 3
            and snippet_score >= primary_score - 0.10
        ):
            return True
        if (
            snippet_quality >= primary_quality + 2.0
            and snippet_score >= primary_score - 0.05
        ):
            return True

        if cls._should_attempt_snippet_fallback(primary, primary_score, language):
            if (
                len(snippet) > len(primary) * 1.25
                and snippet_score >= primary_score - 0.08
            ):
                return True
            if (
                snippet_quality > primary_quality
                and snippet_score >= primary_score - 0.02
            ):
                return True
        return False

    def _detect_and_recognize_snippets(
        self,
        image_bgr: np.ndarray,
    ) -> list[tuple[int, int, int, int, float, str]]:
        boxes = self._detect_text_boxes(image_bgr)
        if not boxes:
            return []
        crops: list[np.ndarray] = []
        valid_boxes: list[tuple[int, int, int, int, float]] = []
        for x1, y1, x2, y2, score in boxes:
            crop = image_bgr[y1:y2, x1:x2]
            if crop.size == 0:
                continue
            valid_boxes.append((x1, y1, x2, y2, score))
            crops.append(crop)
        if not crops:
            return []

        texts, scores = self._run_recognition(crops)
        snippets: list[tuple[int, int, int, int, float, str]] = []
        for idx, (x1, y1, x2, y2, _) in enumerate(valid_boxes):
            text = texts[idx].strip()
            if not text:
                continue
            snippets.append((x1, y1, x2, y2, float(scores[idx]), text))
        return snippets

    def _recognize(
        self,
        image: Image.Image,
        regions: list[OCRInputRegion],
        language: str = "en",
    ) -> list[OCRTextResult]:
        self._ensure_session()
        bgr = cv2.cvtColor(np.asarray(image.convert("RGB")), cv2.COLOR_RGB2BGR)
        img_h, img_w = bgr.shape[:2]

        crops: list[np.ndarray] = []
        valid_indices: list[int] = []
        results: list[OCRTextResult] = []

        for idx, region in enumerate(regions):
            x1, y1, x2, y2 = self._expand_box(region.bbox, img_w, img_h)
            if x2 <= x1 or y2 <= y1:
                results.append(
                    OCRTextResult(
                        id=region.id,
                        bbox=region.bbox,
                        text="",
                        score=0.0,
                        source=region.source,
                        detector_model_key=region.detector_model_key,
                        model_key=self.key,
                    ),
                )
                continue

            crop = bgr[y1:y2, x1:x2]
            if crop.size == 0:
                results.append(
                    OCRTextResult(
                        id=region.id,
                        bbox=region.bbox,
                        text="",
                        score=0.0,
                        source=region.source,
                        detector_model_key=region.detector_model_key,
                        model_key=self.key,
                    ),
                )
                continue

            valid_indices.append(idx)
            crops.append(crop)
            results.append(
                OCRTextResult(
                    id=region.id,
                    bbox=region.bbox,
                    text="",
                    score=0.0,
                    source=region.source,
                    detector_model_key=region.detector_model_key,
                    model_key=self.key,
                ),
            )

        if not crops:
            return results

        texts, scores = self._run_recognition(crops)
        for local_idx, global_idx in enumerate(valid_indices):
            current = results[global_idx]
            results[global_idx] = OCRTextResult(
                id=current.id,
                bbox=current.bbox,
                text=texts[local_idx],
                score=scores[local_idx],
                source=current.source,
                detector_model_key=current.detector_model_key,
                model_key=current.model_key,
            )

        fallback_indices = [
            idx
            for idx, item in enumerate(results)
            if self._should_attempt_snippet_fallback(item.text, item.score, language)
        ]
        if not fallback_indices and self._language_uses_spaces(language):
            fallback_indices = [
                idx for idx, item in enumerate(results) if (item.text or "").strip()
            ]
        if fallback_indices:
            snippets = self._detect_and_recognize_snippets(bgr)
            if snippets:
                for idx in fallback_indices:
                    current = results[idx]
                    expanded_bbox = self._expand_box(current.bbox, img_w, img_h)
                    text, score = self._aggregate_text_for_region(
                        expanded_bbox, snippets
                    )
                    if not self._prefer_snippet_text(
                        current.text,
                        current.score,
                        text,
                        score,
                        language,
                    ):
                        continue
                    results[idx] = OCRTextResult(
                        id=current.id,
                        bbox=current.bbox,
                        text=text,
                        score=score,
                        source=current.source,
                        detector_model_key=current.detector_model_key,
                        model_key=current.model_key,
                    )
        return results


class PPOCRV5EnglishRecEngine(PPOCRV5RecEngine):
    key = "paddleocr_en_v5"
    name = "PaddleOCR v5 English (ONNX)"

    def __init__(
        self,
        providers: Sequence[str] | None = None,
        expansion_percentage: int = 5,
        batch_size: int = 8,
        model_dir: str | Path | None = None,
    ) -> None:
        super().__init__(
            providers=providers,
            expansion_percentage=expansion_percentage,
            batch_size=batch_size,
            rec_model_filename="en_PP-OCRv5_mobile_rec.onnx",
            dict_filename="ppocrv5_en_dict.txt",
            det_model_filename="ch_PP-OCRv5_mobile_det.onnx",
            model_dir=model_dir,
            model_id="paddleocr_en_v5",
        )


class PPOCRV5LatinRecEngine(PPOCRV5RecEngine):
    key = "paddleocr_latin_v5"
    name = "PaddleOCR v5 Latin (ONNX)"

    def __init__(
        self,
        providers: Sequence[str] | None = None,
        expansion_percentage: int = 5,
        batch_size: int = 8,
        model_dir: str | Path | None = None,
    ) -> None:
        super().__init__(
            providers=providers,
            expansion_percentage=expansion_percentage,
            batch_size=batch_size,
            rec_model_filename="latin_PP-OCRv5_rec_mobile_infer.onnx",
            dict_filename="ppocrv5_latin_dict.txt",
            det_model_filename="ch_PP-OCRv5_mobile_det.onnx",
            model_dir=model_dir,
            model_id="paddleocr_latin_v5",
        )


class PPOCRV5ChineseRecEngine(PPOCRV5RecEngine):
    key = "paddleocr_ch_v5"
    name = "PaddleOCR v5 Chinese (ONNX)"

    def __init__(
        self,
        providers: Sequence[str] | None = None,
        expansion_percentage: int = 5,
        batch_size: int = 8,
        model_dir: str | Path | None = None,
    ) -> None:
        super().__init__(
            providers=providers,
            expansion_percentage=expansion_percentage,
            batch_size=batch_size,
            rec_model_filename="ch_PP-OCRv5_rec_mobile_infer.onnx",
            dict_filename="ppocrv5_dict.txt",
            det_model_filename="ch_PP-OCRv5_mobile_det.onnx",
            model_dir=model_dir,
            model_id="paddleocr_ch_v5",
        )
