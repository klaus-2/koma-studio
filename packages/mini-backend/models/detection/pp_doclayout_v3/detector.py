"""PP-DocLayoutV3 text/layout detection using HuggingFace transformers.

Uses the SafeTensors model from PaddlePaddle/PP-DocLayoutV3_safetensors.
Architecture: RT-DETR variant for document layout analysis.
Outputs bounding boxes with class labels; we filter for text-like regions.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Sequence

from PIL import Image

from core.models_store import resolve_model_dir
from models.detection.base_detector import BaseDetector, TextDetection

logger = logging.getLogger(__name__)

_TEXT_LABELS = {"text", "title", "reference", "content"}
_DEFAULT_THRESHOLD = 0.25
_INPUT_SIZE = (800, 800)


def _is_text_label(label: str) -> bool:
    lower = label.lower().strip()
    if lower in _TEXT_LABELS:
        return True
    if "text" in lower or "title" in lower:
        return True
    return False


class PPDocLayoutV3Detector(BaseDetector):
    key = "pp_doclayout_v3"
    name = "PP-DocLayout V3"

    def __init__(
        self,
        model_path: str | Path | None = None,
        confidence_threshold: float | None = None,
        nms_threshold: float | None = None,
        providers: Sequence[str] | None = None,
    ) -> None:
        self._confidence = confidence_threshold if confidence_threshold is not None else _DEFAULT_THRESHOLD
        self._nms_threshold = nms_threshold if nms_threshold is not None else 0.5
        self._providers = list(providers) if providers else []
        self._model = None
        self._processor = None

        if model_path:
            self._model_dir = Path(model_path)
        else:
            resolved = resolve_model_dir("pp_doclayout_v3")
            if resolved is None:
                raise RuntimeError("PP-DocLayoutV3 model directory not configured.")
            self._model_dir = resolved

    def _ensure_model(self) -> None:
        if self._model is not None:
            return

        try:
            import torch
            from transformers import AutoImageProcessor, AutoModelForObjectDetection
        except ImportError as exc:
            raise RuntimeError(
                "transformers and torch are required for PP-DocLayoutV3. "
                "Install with: pip install transformers torch"
            ) from exc

        model_dir = str(self._model_dir)
        safetensors_path = self._model_dir / "model.safetensors"
        if not safetensors_path.exists():
            raise FileNotFoundError(
                f"PP-DocLayoutV3 model not found at {safetensors_path}. "
                "Install the model via the Model Manager."
            )

        logger.info("Loading PP-DocLayoutV3 from %s", model_dir)
        self._processor = AutoImageProcessor.from_pretrained(model_dir)
        device = "cuda" if torch.cuda.is_available() and "CPU" not in self._providers[:1] else "cpu"
        self._model = AutoModelForObjectDetection.from_pretrained(model_dir).to(device).eval()
        self._device = device
        logger.info("PP-DocLayoutV3 loaded on %s", device)

    def _detect(self, image: Image.Image) -> list[TextDetection]:
        import torch

        self._ensure_model()
        assert self._model is not None and self._processor is not None

        orig_w, orig_h = image.size
        rgb = image.convert("RGB")

        inputs = self._processor(images=rgb, return_tensors="pt")
        inputs = {k: v.to(self._device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self._model(**inputs)

        target_sizes = torch.tensor([[orig_h, orig_w]], device=self._device)
        results = self._processor.post_process_object_detection(
            outputs, threshold=self._confidence, target_sizes=target_sizes
        )[0]

        detections: list[TextDetection] = []
        id2label = getattr(self._model.config, "id2label", {})

        scores = results["scores"].cpu().numpy()
        labels = results["labels"].cpu().numpy()
        boxes = results["boxes"].cpu().numpy()

        for score, label_id, box in zip(scores, labels, boxes):
            label_name = id2label.get(int(label_id), f"class_{label_id}")
            if not _is_text_label(label_name):
                continue

            x1, y1, x2, y2 = box
            x1 = max(0, int(round(x1)))
            y1 = max(0, int(round(y1)))
            x2 = min(orig_w, int(round(x2)))
            y2 = min(orig_h, int(round(y2)))

            if x2 <= x1 or y2 <= y1:
                continue

            detections.append(TextDetection(
                bbox=(x1, y1, x2, y2),
                score=float(score),
                label=label_name,
                source="model",
                model_key=self.key,
            ))

        if self._nms_threshold < 1.0:
            detections = self._apply_nms(detections)

        return detections

    def _apply_nms(self, detections: list[TextDetection]) -> list[TextDetection]:
        if not detections:
            return detections

        detections.sort(key=lambda d: d.score, reverse=True)
        keep: list[TextDetection] = []

        for det in detections:
            overlaps = False
            for kept in keep:
                iou = self._compute_iou(det.bbox, kept.bbox)
                if iou > self._nms_threshold:
                    overlaps = True
                    break
            if not overlaps:
                keep.append(det)
        return keep

    @staticmethod
    def _compute_iou(
        a: tuple[int, int, int, int],
        b: tuple[int, int, int, int],
    ) -> float:
        x1 = max(a[0], b[0])
        y1 = max(a[1], b[1])
        x2 = min(a[2], b[2])
        y2 = min(a[3], b[3])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        area_a = (a[2] - a[0]) * (a[3] - a[1])
        area_b = (b[2] - b[0]) * (b[3] - b[1])
        union = area_a + area_b - inter
        return inter / union if union > 0 else 0.0
