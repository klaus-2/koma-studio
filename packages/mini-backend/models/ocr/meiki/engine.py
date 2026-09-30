from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Final, Literal, cast

import cv2
import numpy as np
import onnxruntime as ort
from numpy.typing import NDArray
from PIL import Image

from core.device import get_device_info, get_onnx_execution_providers
from models.ocr.base_ocr import BaseOCR, OCRInputRegion, OCRTextResult
from models.ocr.common import (
    LazyRuntime,
    ModelFilesMissingError,
    ModelsRootNotConfiguredError,
    OcrEngineError,
    build_result,
    crop_region,
    missing_files,
)
from models.ocr.meiki.storage import (
    MEIKI_HORIZONTAL_MODEL_FILE,
    MEIKI_MODEL_FILES,
    MEIKI_MODEL_ID,
    MEIKI_VERTICAL_MODEL_FILE,
    resolve_meiki_model_dir,
)

logger = logging.getLogger(__name__)

type RgbArray = NDArray[np.uint8]
type Labels = NDArray[np.int64]
type Boxes = NDArray[np.float32]
type Scores = NDArray[np.float32]

DEFAULT_CONFIDENCE_THRESHOLD: Final = 0.1
_OVERLAP_THRESHOLD: Final = 0.3
_EPSILON: Final = 1e-6
# Vertical support is beta upstream; only route clearly tall regions to it.
_VERTICAL_ASPECT_RATIO: Final = 1.5
_VERTICAL_MIN_HEIGHT_PX: Final = 64
# Labels outside this range would make chr() raise and kill the whole page.
_MAX_CODEPOINT: Final = 0x10FFFF
_SURROGATE_START: Final = 0xD800
_SURROGATE_END: Final = 0xDFFF


class MeikiModelContractError(OcrEngineError):
    """The ONNX graph did not produce the (labels, boxes, scores) triple Meiki emits."""


class TextOrientation(Enum):
    HORIZONTAL = "horizontal"
    VERTICAL = "vertical"


@dataclass(frozen=True, slots=True)
class _OrientationSpec:
    orientation: TextOrientation
    model_file: str
    canvas_width: int
    canvas_height: int
    # Axis along which characters are ordered and de-duplicated: 0 = x, 1 = y.
    primary_axis: Literal[0, 1]


_SPECS: Final[Mapping[TextOrientation, _OrientationSpec]] = {
    TextOrientation.HORIZONTAL: _OrientationSpec(
        orientation=TextOrientation.HORIZONTAL,
        model_file=MEIKI_HORIZONTAL_MODEL_FILE,
        canvas_width=960,
        canvas_height=32,
        primary_axis=0,
    ),
    TextOrientation.VERTICAL: _OrientationSpec(
        orientation=TextOrientation.VERTICAL,
        model_file=MEIKI_VERTICAL_MODEL_FILE,
        canvas_width=32,
        canvas_height=480,
        primary_axis=1,
    ),
}


@dataclass(frozen=True, slots=True)
class PreparedInput:
    tensor: NDArray[np.float32]  # (1, 3, canvas_height, canvas_width), RGB in [0, 1]
    content_width: int
    content_height: int
    scale_x: float  # original pixels per canvas pixel
    scale_y: float


def detect_orientation(*, width: int, height: int) -> TextOrientation:
    is_tall = height > max(1, int(width * _VERTICAL_ASPECT_RATIO))
    if is_tall and height >= _VERTICAL_MIN_HEIGHT_PX:
        return TextOrientation.VERTICAL
    return TextOrientation.HORIZONTAL


def prepare_input(rgb: RgbArray, spec: _OrientationSpec) -> PreparedInput:
    """Fits the crop inside the model canvas (aspect preserved, top-left aligned, zero padded)."""
    height, width = rgb.shape[:2]
    scale = min(spec.canvas_height / height, spec.canvas_width / width)
    content_width = max(1, min(spec.canvas_width, round(width * scale)))
    content_height = max(1, min(spec.canvas_height, round(height * scale)))

    resized = cv2.resize(rgb, (content_width, content_height), interpolation=cv2.INTER_LINEAR)
    canvas = np.zeros((spec.canvas_height, spec.canvas_width, 3), dtype=np.uint8)
    canvas[:content_height, :content_width] = resized

    chw = np.ascontiguousarray(canvas.transpose(2, 0, 1), dtype=np.float32)
    chw /= 255.0
    return PreparedInput(
        tensor=chw[np.newaxis],
        content_width=content_width,
        content_height=content_height,
        scale_x=width / content_width,
        scale_y=height / content_height,
    )


def _suppress_overlaps(starts: Boxes, ends: Boxes, scores: Scores) -> NDArray[np.intp]:
    """Greedy 1-D NMS on the reading axis; higher confidence wins."""
    order = np.argsort(-scores, kind="stable")
    accepted: list[int] = []
    for candidate in order.tolist():
        extent = ends[candidate] - starts[candidate] + _EPSILON
        if accepted:
            overlap = np.minimum(ends[candidate], ends[accepted]) - np.maximum(
                starts[candidate], starts[accepted]
            )
            if bool((overlap / extent > _OVERLAP_THRESHOLD).any()):
                continue
        accepted.append(candidate)
    return np.asarray(accepted, dtype=np.intp)


def _valid_codepoints(labels: NDArray[np.int64]) -> NDArray[np.bool_]:
    in_range = (labels >= 0) & (labels <= _MAX_CODEPOINT)
    surrogate = (labels >= _SURROGATE_START) & (labels <= _SURROGATE_END)
    return in_range & ~surrogate


def decode_predictions(
    labels: Labels,
    boxes: Boxes,
    scores: Scores,
    *,
    prepared: PreparedInput,
    spec: _OrientationSpec,
    confidence_threshold: float,
) -> tuple[str, float]:
    if not labels.shape[0] == boxes.shape[0] == scores.shape[0]:
        raise MeikiModelContractError(
            f"Output length mismatch: labels={labels.shape[0]} boxes={boxes.shape[0]} scores={scores.shape[0]}"
        )
    # A noisy label outside the Unicode range would make chr() raise and drop
    # the whole page; treat it like any other low-confidence candidate.
    keep = (scores >= confidence_threshold) & _valid_codepoints(labels)
    if not bool(keep.any()):
        return "", 0.0

    kept_labels = labels[keep]
    kept_scores = scores[keep]
    kept_boxes = boxes[keep].astype(np.float32, copy=True)
    # Predictions in the zero-padded area carry no signal; clip to the real content extent.
    np.clip(kept_boxes[:, 0::2], 0.0, float(prepared.content_width), out=kept_boxes[:, 0::2])
    np.clip(kept_boxes[:, 1::2], 0.0, float(prepared.content_height), out=kept_boxes[:, 1::2])
    kept_boxes[:, 0::2] *= prepared.scale_x
    kept_boxes[:, 1::2] *= prepared.scale_y

    starts = kept_boxes[:, spec.primary_axis]
    ends = kept_boxes[:, spec.primary_axis + 2]
    accepted = _suppress_overlaps(starts, ends, kept_scores)
    reading_order = accepted[np.argsort(starts[accepted], kind="stable")]

    text = "".join(chr(int(code)) for code in kept_labels[reading_order])
    return text, float(kept_scores[reading_order].mean())


def _run_session(
    session: ort.InferenceSession,
    prepared: PreparedInput,
    spec: _OrientationSpec,
) -> tuple[Labels, Boxes, Scores]:
    feeds: dict[str, NDArray[np.float32] | NDArray[np.int64]] = {
        "images": prepared.tensor,
        "orig_target_sizes": np.array([[spec.canvas_width, spec.canvas_height]], dtype=np.int64),
    }
    outputs = cast(list[object], session.run(None, feeds))
    if len(outputs) != 3:
        raise MeikiModelContractError(f"Expected 3 outputs from {spec.model_file}, got {len(outputs)}")
    labels = np.asarray(outputs[0])[0].astype(np.int64, copy=False)
    boxes = np.asarray(outputs[1])[0].astype(np.float32, copy=False)
    scores = np.asarray(outputs[2])[0].astype(np.float32, copy=False)
    return labels, boxes, scores


class MeikiOcrEngine(BaseOCR):
    key = "meiki_ocr"
    name = "Meiki OCR"

    def __init__(
        self,
        providers: Sequence[str] | None = None,
        model_dir: str | Path | None = None,
        confidence_threshold: float = DEFAULT_CONFIDENCE_THRESHOLD,
    ) -> None:
        resolved = Path(model_dir).expanduser().resolve() if model_dir else resolve_meiki_model_dir()
        if resolved is None:
            raise ModelsRootNotConfiguredError(MEIKI_MODEL_ID)
        self.model_dir: Path = resolved
        self.providers = (
            tuple(providers) if providers else tuple(get_onnx_execution_providers(get_device_info()))
        )
        self.confidence_threshold: float = max(0.0, confidence_threshold)
        self._sessions: LazyRuntime[Mapping[TextOrientation, ort.InferenceSession]] = LazyRuntime(
            self._load_sessions
        )

    def _load_sessions(self) -> Mapping[TextOrientation, ort.InferenceSession]:
        missing = missing_files(self.model_dir, MEIKI_MODEL_FILES)
        if missing:
            raise ModelFilesMissingError(self.model_dir, missing)
        sessions = {
            orientation: ort.InferenceSession(
                str(self.model_dir / spec.model_file), providers=list(self.providers)
            )
            for orientation, spec in _SPECS.items()
        }
        logger.info(
            "meiki_sessions_loaded",
            extra={
                "model_dir": str(self.model_dir),
                "requested_providers": list(self.providers),
            },
        )
        return sessions

    def _recognize_crop_pair(
        self,
        sessions: Mapping[TextOrientation, ort.InferenceSession],
        rgb: RgbArray,
    ) -> tuple[str, float]:
        height, width = rgb.shape[:2]
        spec = _SPECS[detect_orientation(width=width, height=height)]
        prepared = prepare_input(rgb, spec)
        labels, boxes, scores = _run_session(sessions[spec.orientation], prepared, spec)
        return decode_predictions(
            labels,
            boxes,
            scores,
            prepared=prepared,
            spec=spec,
            confidence_threshold=self.confidence_threshold,
        )

    def _recognize(
        self,
        image: Image.Image,
        regions: Sequence[OCRInputRegion],
        language: str = "ja",
    ) -> list[OCRTextResult]:
        del language  # Meiki is a Japanese-only recognizer.
        sessions = self._sessions.get()
        rgb_image = image.convert("RGB")
        results: list[OCRTextResult] = []
        for region in regions:
            crop = crop_region(rgb_image, region)
            if crop is None:
                # Degenerate region: empty result, no inference on fake pixels.
                results.append(build_result(region, model_key=self.key))
                continue
            text, score = self._recognize_crop_pair(sessions, np.asarray(crop, dtype=np.uint8))
            results.append(build_result(region, model_key=self.key, text=text, score=score))
        logger.debug("meiki_regions_recognized", extra={"region_count": len(results)})
        return results
