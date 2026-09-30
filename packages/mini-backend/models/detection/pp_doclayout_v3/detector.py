"""PP-DocLayoutV3 text/layout detection using HuggingFace transformers.

Uses the SafeTensors model from PaddlePaddle/PP-DocLayoutV3_safetensors.
Architecture: RT-DETR variant for document layout analysis.
Outputs bounding boxes with class labels; we filter for text-like regions.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
import numpy.typing as npt
from PIL import Image

from core.models_store import resolve_model_dir
from models.detection.base_detector import BaseDetector, TextDetection
from models.geometry import greedy_nms

if TYPE_CHECKING:
    from transformers.image_processing_utils import BaseImageProcessor  # noqa: F401

logger = logging.getLogger(__name__)

_TEXT_LABELS = frozenset({"text", "title", "reference", "content"})
_DEFAULT_CONFIDENCE = 0.25
_DEFAULT_NMS_IOU = 0.5
_CPU_PROVIDER = "CPUExecutionProvider"

type Box = tuple[int, int, int, int]


class DetectorDependencyError(RuntimeError):
    """torch/transformers are not installed in the runtime."""


class DetectorModelNotConfiguredError(RuntimeError):
    """No model directory resolved for the detector."""


def _is_text_label(label: str) -> bool:
    lowered = label.lower().strip()
    return lowered in _TEXT_LABELS or "text" in lowered or "title" in lowered


@dataclass(slots=True)
class _Runtime:
    # transformers has no complete stubs; Any keeps the protocol surface honest
    model: Any
    processor: Any
    device: str
    id2label: Mapping[int, str]


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
        self._confidence = _DEFAULT_CONFIDENCE if confidence_threshold is None else confidence_threshold
        self._nms_iou = _DEFAULT_NMS_IOU if nms_threshold is None else nms_threshold
        # The pipeline expresses "run on CPU" as a provider list headed by the
        # CPU provider. The old check ("CPU" not in self._providers[:1]) did a
        # list-membership test against a substring, so it was always False and
        # the detector never honoured the CPU fallback after OOM.
        self._prefer_cpu = bool(providers) and providers[0] == _CPU_PROVIDER
        self._runtime: _Runtime | None = None
        self._load_lock = threading.Lock()

        resolved = Path(model_path) if model_path else resolve_model_dir(self.key)
        if resolved is None:
            raise DetectorModelNotConfiguredError("PP-DocLayoutV3 model directory not configured.")
        self._model_dir = resolved

    def _ensure_runtime(self) -> _Runtime:
        if self._runtime is not None:
            return self._runtime
        with self._load_lock:
            if self._runtime is None:
                self._runtime = self._load()
            return self._runtime

    def _load(self) -> _Runtime:
        try:
            import torch
            from transformers import AutoImageProcessor, AutoModelForObjectDetection
        except ImportError as exc:
            raise DetectorDependencyError(
                "transformers and torch are required for PP-DocLayoutV3. "
                "Install with: pip install transformers torch"
            ) from exc

        model_dir = str(self._model_dir)
        weights = self._model_dir / "model.safetensors"
        if not weights.is_file():
            raise FileNotFoundError(
                f"PP-DocLayoutV3 model not found at {weights}. "
                "Install the model via the Model Manager."
            )

        device = "cuda" if torch.cuda.is_available() and not self._prefer_cpu else "cpu"
        logger.info("Loading PP-DocLayoutV3 from %s", model_dir)
        processor = AutoImageProcessor.from_pretrained(model_dir)
        model = AutoModelForObjectDetection.from_pretrained(model_dir).to(device).eval()
        id2label: Mapping[int, str] = {
            int(k): str(v) for k, v in getattr(model.config, "id2label", {}).items()
        }
        return _Runtime(model=model, processor=processor, device=device, id2label=id2label)

    def _detect(self, image: Image.Image) -> list[TextDetection]:
        import torch

        runtime = self._ensure_runtime()
        orig_w, orig_h = image.size
        rgb = image.convert("RGB")

        inputs = runtime.processor(images=rgb, return_tensors="pt")
        inputs = {k: v.to(runtime.device) for k, v in inputs.items()}

        with torch.inference_mode():
            outputs = runtime.model(**inputs)

        target_sizes = torch.tensor([[orig_h, orig_w]], device=runtime.device)
        results = runtime.processor.post_process_object_detection(
            outputs, threshold=self._confidence, target_sizes=target_sizes
        )[0]

        scores = np.asarray(results["scores"].cpu().numpy(), dtype=np.float32)
        label_ids = np.asarray(results["labels"].cpu().numpy(), dtype=np.int64)
        boxes = np.asarray(results["boxes"].cpu().numpy(), dtype=np.float32)

        candidate_boxes: list[Box] = []
        candidate_scores: list[float] = []
        candidate_labels: list[str] = []
        for score, label_id, box in zip(scores, label_ids, boxes, strict=True):
            label = runtime.id2label.get(int(label_id), f"class_{int(label_id)}")
            if not _is_text_label(label):
                continue
            x1 = max(0, int(round(float(box[0]))))
            y1 = max(0, int(round(float(box[1]))))
            x2 = min(orig_w, int(round(float(box[2]))))
            y2 = min(orig_h, int(round(float(box[3]))))
            if x2 <= x1 or y2 <= y1:
                continue
            candidate_boxes.append((x1, y1, x2, y2))
            candidate_scores.append(float(score))
            candidate_labels.append(label)

        if not candidate_boxes:
            return []

        if self._nms_iou < 1.0:
            keep = greedy_nms(
                np.asarray(candidate_boxes, dtype=np.float64),
                np.asarray(candidate_scores, dtype=np.float64),
                self._nms_iou,
            )
        else:
            keep = list(range(len(candidate_boxes)))

        return [
            TextDetection(
                bbox=candidate_boxes[i],
                score=candidate_scores[i],
                label=candidate_labels[i],
                source="model",
                model_key=self.key,
            )
            for i in keep
        ]
