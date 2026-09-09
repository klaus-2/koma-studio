"""YuzuMarker FontDetection inference engine.

Loads the SafeTensors weights from ``fffonion/yuzumarker-font-detection`` and
produces :class:`FontStylePrediction` for cropped text-block images.

The model outputs 6162 values per image:
  [0:6150]   font classification logits
  [6150:6152] text direction logits (horizontal, vertical)
  [6152:6162] regression values (color, size, stroke, spacing, angle)
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Sequence

import numpy as np
from PIL import Image

from models.detection.font_style.types import FontCandidate, FontLabel, FontStylePrediction

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

FONT_COUNT = 6_150
DIRECTION_START = FONT_COUNT          # 6150
REGRESSION_START = FONT_COUNT + 2     # 6152
REGRESSION_DIM = 10
TOTAL_OUTPUT = FONT_COUNT + 2 + REGRESSION_DIM  # 6162

MODEL_INPUT_SIZE = 512  # ResNet50 default

NEAR_BLACK_THRESHOLD = 12
NEAR_WHITE_THRESHOLD = 12
GRAY_NEAR_BLACK_THRESHOLD = 60
GRAY_NEAR_WHITE_THRESHOLD = 60
COLOR_SIMILARITY_THRESHOLD = 16


# ── Bundled model paths ─────────────────────────────────────────────────────

def _resolve_bundled_model_dir() -> Path:
    """Return the directory containing bundled YuzuMarker weights."""
    return Path(__file__).resolve().parent / "weights"


# ── Preprocessing ────────────────────────────────────────────────────────────

def _preprocess_image(image: Image.Image, target_size: int = MODEL_INPUT_SIZE) -> np.ndarray:
    """Resize, normalize and convert to (1, 3, H, W) float32 tensor."""
    img = image.convert("RGB").resize((target_size, target_size), Image.BICUBIC)
    arr = np.asarray(img, dtype=np.float32)          # (H, W, 3) in [0, 255]
    arr = arr.transpose(2, 0, 1)                     # (3, H, W)
    arr = arr / 255.0                                 # [0, 1]
    return arr[np.newaxis, ...]                       # (1, 3, H, W)


# ── Post-processing helpers ──────────────────────────────────────────────────

def _sigmoid(x: float) -> float:
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    ex = math.exp(x)
    return ex / (1.0 + ex)


def _softmax_topk(logits: np.ndarray, k: int) -> list[tuple[int, float]]:
    """Stable softmax then top-k selection."""
    max_val = float(np.max(logits))
    exps = np.exp(logits - max_val)
    probs = exps / float(np.sum(exps))
    top_indices = np.argpartition(-probs, k)[:k]
    top_indices = top_indices[np.argsort(-probs[top_indices])]
    return [(int(idx), float(probs[idx])) for idx in top_indices]


def _clamp_color_channel(val: float) -> int:
    return max(0, min(255, round(val * 255.0)))


def _is_grayscale(r: int, g: int, b: int) -> bool:
    return (max(r, g, b) - min(r, g, b)) <= 10


def _normalize_color(r: int, g: int, b: int) -> tuple[int, int, int]:
    """Clamp near-black/near-white colors like the koharu pipeline."""
    grayscale = _is_grayscale(r, g, b)
    black_thresh = GRAY_NEAR_BLACK_THRESHOLD if grayscale else NEAR_BLACK_THRESHOLD
    white_thresh = GRAY_NEAR_WHITE_THRESHOLD if grayscale else NEAR_WHITE_THRESHOLD

    if r <= black_thresh and g <= black_thresh and b <= black_thresh:
        return (0, 0, 0)
    if r >= (255 - white_thresh) and g >= (255 - white_thresh) and b >= (255 - white_thresh):
        return (255, 255, 255)
    return (r, g, b)


def _colors_similar(c1: tuple[int, int, int], c2: tuple[int, int, int]) -> bool:
    return all(abs(a - b) <= COLOR_SIMILARITY_THRESHOLD for a, b in zip(c1, c2))


# ── Detector ─────────────────────────────────────────────────────────────────

class YuzuFontStyleDetector:
    """Font/color/style detector backed by the YuzuMarker SafeTensors model.

    The model weights are expected to be bundled inside
    ``models/detection/font_style/weights/``.
    """

    def __init__(self, model_dir: str | Path | None = None) -> None:
        self._model_dir = Path(model_dir) if model_dir else _resolve_bundled_model_dir()
        self._session = None
        self._font_labels: list[FontLabel] | None = None

    # ── Lazy loading ─────────────────────────────────────────────────────

    def _ensure_loaded(self) -> None:
        if self._session is not None:
            return
        self._load_model()
        self._load_labels()

    def _load_model(self) -> None:
        """Load SafeTensors model using ONNX Runtime or PyTorch.

        Priority: ONNX exported model > SafeTensors with torch.
        """
        onnx_path = self._model_dir / "yuzumarker-font-detection.onnx"
        if onnx_path.exists():
            self._load_onnx(onnx_path)
            return

        safetensors_path = self._model_dir / "yuzumarker-font-detection.safetensors"
        if safetensors_path.exists():
            self._load_safetensors(safetensors_path)
            return

        raise FileNotFoundError(
            f"YuzuMarker font detection model not found in {self._model_dir}. "
            "Expected yuzumarker-font-detection.onnx or .safetensors"
        )

    def _load_onnx(self, path: Path) -> None:
        try:
            import onnxruntime as ort  # type: ignore
        except ImportError as exc:
            raise RuntimeError("onnxruntime not installed for YuzuMarker font detection") from exc

        providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
        self._session = ort.InferenceSession(str(path), providers=providers)
        self._backend = "onnx"
        logger.info("YuzuMarker font detector loaded (ONNX) from %s", path)

    def _load_safetensors(self, path: Path) -> None:
        try:
            import torch  # type: ignore
            from safetensors.torch import load_file  # type: ignore
        except ImportError as exc:
            raise RuntimeError(
                "torch + safetensors not installed for YuzuMarker font detection"
            ) from exc

        state_dict = load_file(str(path))
        from models.detection.font_style.resnet_model import build_resnet50_font_model
        model = build_resnet50_font_model(TOTAL_OUTPUT)
        model.load_state_dict(state_dict, strict=False)
        model.eval()
        self._session = model
        self._backend = "torch"
        logger.info("YuzuMarker font detector loaded (SafeTensors/PyTorch) from %s", path)

    def _load_labels(self) -> None:
        labels_path = self._model_dir / "font-labels-ex.json"
        if not labels_path.exists():
            logger.warning("Font labels not found at %s – predictions will use numeric IDs", labels_path)
            self._font_labels = []
            return
        with open(labels_path, encoding="utf-8") as f:
            raw = json.load(f)
        self._font_labels = [
            FontLabel(
                path=str(entry.get("path", f"font_{i}")),
                language=entry.get("language"),
                serif=bool(entry.get("serif", False)),
            )
            for i, entry in enumerate(raw)
        ]
        logger.info("Loaded %d font labels", len(self._font_labels))

    # ── Inference ────────────────────────────────────────────────────────

    def _run_model(self, input_tensor: np.ndarray) -> np.ndarray:
        """Run inference and return (batch, 6162) output."""
        if self._backend == "onnx":
            input_name = self._session.get_inputs()[0].name
            outputs = self._session.run(None, {input_name: input_tensor})
            return outputs[0]
        else:
            import torch  # type: ignore
            with torch.no_grad():
                tensor = torch.from_numpy(input_tensor)
                result = self._session(tensor)
                return result.cpu().numpy()

    def detect(
        self,
        images: Sequence[Image.Image],
        original_widths: Sequence[int] | None = None,
        top_k: int = 1,
    ) -> list[FontStylePrediction]:
        """Run font/color/style detection on a batch of cropped text-block images.

        Parameters
        ----------
        images : sequence of PIL Images
            Cropped text-block images.
        original_widths : sequence of int, optional
            Original image width for each block (used to scale font size).
            Falls back to the image width if not provided.
        top_k : int
            How many font candidates to return per block.

        Returns
        -------
        list of FontStylePrediction
        """
        if not images:
            return []

        self._ensure_loaded()

        widths = list(original_widths) if original_widths else [img.width for img in images]
        batched = np.concatenate(
            [_preprocess_image(img, MODEL_INPUT_SIZE) for img in images],
            axis=0,
        )

        raw_output = self._run_model(batched.astype(np.float32))

        predictions: list[FontStylePrediction] = []
        for i in range(len(images)):
            row = raw_output[i]
            prediction = self._decode_row(row, widths[i], top_k)
            predictions.append(prediction)
        return predictions

    def _decode_row(self, row: np.ndarray, original_width: int, top_k: int) -> FontStylePrediction:
        """Decode a single output row into a FontStylePrediction."""
        # ── Font classification ──
        font_logits = row[:FONT_COUNT]
        top_fonts = _softmax_topk(font_logits, min(top_k, FONT_COUNT))
        labels = self._font_labels or []
        candidates = []
        for idx, prob in top_fonts:
            label = labels[idx] if idx < len(labels) else FontLabel(path=f"font_{idx}")
            candidates.append(FontCandidate(
                index=idx,
                name=label.path,
                probability=prob,
                language=label.language,
                serif=label.serif,
            ))

        # ── Direction ──
        direction = "vertical" if row[DIRECTION_START + 1] > row[DIRECTION_START] else "horizontal"

        # ── Regression ──
        reg = [max(0.0, min(1.0, _sigmoid(float(row[REGRESSION_START + j])))) for j in range(REGRESSION_DIM)]

        text_r = _clamp_color_channel(reg[0])
        text_g = _clamp_color_channel(reg[1])
        text_b = _clamp_color_channel(reg[2])
        font_size_px = reg[3] * original_width
        stroke_width_px = reg[4] * original_width
        stroke_r = _clamp_color_channel(reg[5])
        stroke_g = _clamp_color_channel(reg[6])
        stroke_b = _clamp_color_channel(reg[7])
        line_spacing_px = reg[8] * original_width
        angle_degrees = (reg[9] - 0.5) * 180.0

        # ── Normalize colors ──
        text_color = _normalize_color(text_r, text_g, text_b)
        stroke_color = _normalize_color(stroke_r, stroke_g, stroke_b)

        # ── Remove stroke if similar to text ──
        if stroke_width_px > 0.0 and _colors_similar(text_color, stroke_color):
            stroke_width_px = 0.0
            stroke_color = text_color

        # ── Line height ──
        line_height = (1.0 + line_spacing_px / font_size_px) if font_size_px > 0 else 1.2

        return FontStylePrediction(
            text_color_r=text_color[0],
            text_color_g=text_color[1],
            text_color_b=text_color[2],
            stroke_color_r=stroke_color[0],
            stroke_color_g=stroke_color[1],
            stroke_color_b=stroke_color[2],
            stroke_width_px=stroke_width_px,
            font_size_px=font_size_px,
            line_height=line_height,
            angle_degrees=angle_degrees,
            direction=direction,
            font_candidates=candidates,
        )
