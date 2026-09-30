from __future__ import annotations

import gc
import logging
import re
import threading
from collections.abc import Sequence
from importlib.util import find_spec
from pathlib import Path
from typing import cast

import numpy as np
import onnxruntime as ort
from numpy.typing import NDArray
from PIL import Image

from core.device import get_device_info, get_onnx_execution_providers
from models.errors import ModelConfigurationError, ModelNotInstalledError
from models.ocr.base_ocr import RegionCropOCR, RgbArray
from models.ocr.manga_ocr.storage import (
    DECODER_FILE,
    ENCODER_FILE,
    VOCAB_FILE,
    resolve_manga_ocr_model_dir,
)
from models.onnx_utils import ONNX_RUNTIME_ERRORS, translate_inference_error

logger = logging.getLogger(__name__)

_START_TOKEN = 2
_END_TOKEN = 3
_FIRST_VOCAB_TOKEN = 5
_MAX_GENERATED_TOKENS = 300
_INPUT_SIDE = 224
_HAS_JACONV = find_spec("jaconv") is not None
_DOT_RUN = re.compile(r"[・.]{2,}")


def _find_input_name(session, candidates):
    names = [item.name for item in session.get_inputs()]
    for candidate in candidates:
        for name in names:
            if candidate in name:
                return name
    return names[0]


def _preprocess(crop):
    pil = Image.fromarray(crop).convert("L").convert("RGB")
    pil = pil.resize((_INPUT_SIDE, _INPUT_SIDE), resample=Image.Resampling.BILINEAR)
    arr = np.asarray(pil, dtype=np.float32) / 255.0
    arr = (arr - 0.5) / 0.5
    return arr.transpose((2, 0, 1))[np.newaxis, ...].astype(np.float32, copy=False)


def _postprocess(text):
    result = "".join(text.split()).replace("…", "...")
    result = _DOT_RUN.sub(lambda match: "." * len(match.group(0)), result)
    if _HAS_JACONV:
        import jaconv

        result = cast(str, jaconv.h2z(result, ascii=True, digit=True))
    return result


class MangaOCRONNX:
    __slots__ = (
        "_decoder",
        "_decoder_encoder_input",
        "_decoder_token_input",
        "_encoder",
        "_encoder_image_input",
        "_vocab",
    )

    def __init__(self, encoder_path, decoder_path, vocab_path, providers):
        provider_list = list(providers)
        self._encoder = ort.InferenceSession(str(encoder_path), providers=provider_list)
        self._decoder = ort.InferenceSession(str(decoder_path), providers=provider_list)
        self._vocab = vocab_path.read_text(encoding="utf-8").splitlines()
        self._encoder_image_input = _find_input_name(self._encoder, ("image", "pixel_values", "input"))
        self._decoder_token_input = _find_input_name(self._decoder, ("token_ids", "input_ids", "input"))
        self._decoder_encoder_input = _find_input_name(
            self._decoder,
            ("encoder_hidden_states", "encoder_outputs", "encoder_last_hidden_state"),
        )

    def predict(self, crop):
        encoder_hidden = self._encoder.run(None, {self._encoder_image_input: _preprocess(crop)})[0]
        token_ids = [_START_TOKEN]
        for _ in range(_MAX_GENERATED_TOKENS):
            raw_logits = self._decoder.run(
                None,
                {
                    self._decoder_token_input: np.array([token_ids], dtype=np.int64),
                    self._decoder_encoder_input: encoder_hidden,
                },
            )[0]
            logits = np.asarray(raw_logits, dtype=np.float32)
            next_token = int(np.argmax(logits[0, -1, :]))
            token_ids.append(next_token)
            if next_token == _END_TOKEN:
                break
        return _postprocess(self._decode(token_ids))

    def _decode(self, token_ids):
        vocab_size = len(self._vocab)
        return "".join(
            self._vocab[token_id]
            for token_id in token_ids
            if _FIRST_VOCAB_TOKEN <= token_id < vocab_size
        )


class MangaOCROnnxEngine(RegionCropOCR):
    key = "manga_ocr"
    name = "Manga OCR (ONNX)"

    def __init__(self, providers=None, model_dir=None):
        resolved = model_dir if model_dir is not None else resolve_manga_ocr_model_dir()
        if resolved is None:
            raise ModelConfigurationError(
                "Managed models directory is not configured for Manga OCR (KOMA_MODELS_ROOT)."
            )
        self._model_dir = resolved.expanduser().resolve()
        self._providers = tuple(providers) if providers else tuple(get_onnx_execution_providers(get_device_info()))
        self._lock = threading.Lock()
        self._model = None

    def _ensure_model(self):
        model = self._model
        if model is not None:
            return model
        with self._lock:
            if self._model is None:
                encoder = self._model_dir / ENCODER_FILE
                decoder = self._model_dir / DECODER_FILE
                vocab = self._model_dir / VOCAB_FILE
                if not (encoder.is_file() and decoder.is_file() and vocab.is_file()):
                    raise ModelNotInstalledError(f"manga_ocr models not found in {self._model_dir}")
                logger.info("manga_ocr loading", extra={"providers": list(self._providers)})
                self._model = MangaOCRONNX(encoder, decoder, vocab, self._providers)
            return self._model

    def _recognize_crop(self, crop, language):
        model = self._ensure_model()
        try:
            text = model.predict(crop)
        except ONNX_RUNTIME_ERRORS as exc:
            raise translate_inference_error(exc, model_key=self.key) from exc
        return text, (1.0 if text else 0.0)

    def release(self):
        with self._lock:
            self._model = None
        gc.collect()
        logger.info("manga_ocr sessions released")
