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
from numpy.typing import NDArray
from PIL import Image

from core.device import get_device_info, get_onnx_execution_providers
from models.errors import (
    GpuOutOfMemoryError,
    InferenceError,
    ModelConfigurationError,
    ModelNotInstalledError,
)
from models.geometry import expand_bbox
from models.ocr.base_ocr import OCRInputRegion, OCRTextResult, RegionCropOCR, RgbArray
from models.ocr.manga_ocr.storage import (
    DECODER_FILE,
    DECODER_MERGED_FILE,
    DECODER_WITH_PAST_FILE,
    ENCODER_FILE,
    VOCAB_FILE,
    resolve_manga_ocr_model_dir,
)
from models.onnx_utils import (
    ONNX_RUNTIME_ERRORS,
    create_session_with_trt_fallback,
    translate_inference_error,
)

logger = logging.getLogger(__name__)

_START_TOKEN = 2
_END_TOKEN = 3
_FIRST_VOCAB_TOKEN = 5
_MAX_GENERATED_TOKENS = 300
_INPUT_SIDE = 224
_HAS_JACONV = find_spec("jaconv") is not None
_DOT_RUN = re.compile(r"[・.]{2,}")
_PAST_PREFIX = "past_key_values."
_PRESENT_PREFIX = "present."


def _find_input_name(session, candidates):
    names = [item.name for item in session.get_inputs()]
    for candidate in candidates:
        for name in names:
            if candidate in name:
                return name
    return names[0]


def _supports_dynamic_batch(session) -> bool:
    inputs = session.get_inputs()
    if not inputs:
        return False
    shape = getattr(inputs[0], "shape", None)
    if not shape:
        return False
    batch_dim = shape[0]
    if batch_dim is None or isinstance(batch_dim, str):
        return True
    if isinstance(batch_dim, int):
        return batch_dim <= 0
    return False


def _dtype_from_ort_type(ort_type: object) -> np.dtype:
    if isinstance(ort_type, str) and "float16" in ort_type:
        return np.dtype(np.float16)
    return np.dtype(np.float32)


def _initial_past_tensors(session, batch_size: int) -> dict[str, NDArray[np.floating]]:
    tensors: dict[str, NDArray[np.floating]] = {}
    for meta in session.get_inputs():
        if not meta.name.startswith(_PAST_PREFIX):
            continue
        raw_shape = getattr(meta, "shape", ()) or ()
        resolved: list[int] = []
        for idx, dim in enumerate(raw_shape):
            if idx == 0:
                resolved.append(batch_size)
            elif isinstance(dim, int) and dim >= 0:
                resolved.append(dim)
            else:
                resolved.append(0)
        tensors[meta.name] = np.zeros(tuple(resolved), dtype=_dtype_from_ort_type(getattr(meta, "type", "")))
    return tensors


def _preprocess(crop):
    pil = Image.fromarray(crop).convert("L").convert("RGB")
    pil = pil.resize((_INPUT_SIDE, _INPUT_SIDE), resample=Image.Resampling.BILINEAR)
    arr = np.asarray(pil, dtype=np.float32) / 255.0
    arr = (arr - 0.5) / 0.5
    return arr.transpose((2, 0, 1))[np.newaxis, ...].astype(np.float32, copy=False)


def _preprocess_batch(crops: Sequence[RgbArray]) -> NDArray[np.float32]:
    return np.concatenate([_preprocess(crop) for crop in crops], axis=0)


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
        "_decoder_dynamic_batch",
        "_decoder_encoder_input",
        "_decoder_past_inputs",
        "_decoder_present_outputs",
        "_decoder_token_input",
        "_decoder_use_cache_input",
        "_decoder_with_past",
        "_decoder_with_past_inputs",
        "_decoder_with_past_outputs",
        "_encoder",
        "_encoder_dynamic_batch",
        "_encoder_image_input",
        "_vocab",
    )

    def __init__(
        self,
        encoder_path,
        decoder_path,
        vocab_path,
        providers,
        *,
        decoder_with_past_path=None,
    ):
        provider_list = list(providers)
        self._encoder = create_session_with_trt_fallback(str(encoder_path), provider_list)
        self._decoder = create_session_with_trt_fallback(str(decoder_path), provider_list)
        self._decoder_with_past = (
            create_session_with_trt_fallback(str(decoder_with_past_path), provider_list)
            if decoder_with_past_path is not None and Path(decoder_with_past_path).is_file()
            else None
        )
        self._vocab = vocab_path.read_text(encoding="utf-8").splitlines()
        self._encoder_image_input = _find_input_name(self._encoder, ("image", "pixel_values", "input"))
        self._decoder_token_input = _find_input_name(self._decoder, ("token_ids", "input_ids", "input"))
        self._decoder_encoder_input = _find_input_name(
            self._decoder,
            ("encoder_hidden_states", "encoder_outputs", "encoder_last_hidden_state"),
        )
        decoder_input_names = [item.name for item in self._decoder.get_inputs()]
        decoder_output_names = [
            item.name for item in getattr(self._decoder, "get_outputs", lambda: ())()
        ]
        self._decoder_use_cache_input = (
            "use_cache_branch" if "use_cache_branch" in decoder_input_names else None
        )
        self._decoder_past_inputs = tuple(
            name for name in decoder_input_names if name.startswith(_PAST_PREFIX)
        )
        self._decoder_present_outputs = tuple(
            name for name in decoder_output_names if name.startswith(_PRESENT_PREFIX)
        )
        if self._decoder_with_past is not None:
            self._decoder_with_past_inputs = frozenset(
                item.name for item in self._decoder_with_past.get_inputs()
            )
            self._decoder_with_past_outputs = tuple(
                item.name
                for item in getattr(self._decoder_with_past, "get_outputs", lambda: ())()
                if item.name.startswith(_PRESENT_PREFIX)
            )
        else:
            self._decoder_with_past_inputs = frozenset()
            self._decoder_with_past_outputs = ()
        self._encoder_dynamic_batch = _supports_dynamic_batch(self._encoder)
        self._decoder_dynamic_batch = _supports_dynamic_batch(self._decoder) and (
            self._decoder_with_past is None
            or _supports_dynamic_batch(self._decoder_with_past)
        )

    def _encode_batch(self, crops: Sequence[RgbArray]) -> NDArray[np.floating]:
        if len(crops) == 1 or self._encoder_dynamic_batch:
            return np.asarray(
                self._encoder.run(None, {self._encoder_image_input: _preprocess_batch(crops)})[0]
            )
        encoded = [
            np.asarray(self._encoder.run(None, {self._encoder_image_input: _preprocess(crop)})[0])
            for crop in crops
        ]
        return np.concatenate(encoded, axis=0)

    def _update_past_kv(
        self,
        past_kv: dict[str, NDArray[np.floating]],
        output_names: Sequence[str],
        outputs: Sequence[object],
        *,
        allowed_inputs: frozenset[str] | None = None,
    ) -> dict[str, NDArray[np.floating]]:
        updated = dict(past_kv)
        for name, raw_value in zip(output_names, outputs, strict=False):
            if not name.startswith(_PRESENT_PREFIX):
                continue
            target_name = _PAST_PREFIX + name[len(_PRESENT_PREFIX) :]
            if allowed_inputs is not None and target_name not in allowed_inputs:
                continue
            arr = np.asarray(raw_value)
            if arr.size > 0 or target_name not in updated:
                updated[target_name] = arr
        return updated

    def _decode_encoded_batch(self, encoder_hidden: NDArray[np.floating]) -> list[str]:
        batch_size = int(encoder_hidden.shape[0])
        active_indices = list(range(batch_size))
        generated: list[list[int]] = [[_START_TOKEN] for _ in range(batch_size)]
        active_hidden = encoder_hidden
        use_merged_kv = bool(
            self._decoder_use_cache_input
            and self._decoder_past_inputs
            and self._decoder_present_outputs
        )
        use_split_kv = bool(
            not use_merged_kv
            and self._decoder_with_past is not None
            and self._decoder_present_outputs
        )
        past_kv: dict[str, NDArray[np.floating]] = (
            _initial_past_tensors(self._decoder, batch_size) if use_merged_kv else {}
        )
        decoder_output_names = [
            item.name for item in getattr(self._decoder, "get_outputs", lambda: ())()
        ] or ["logits", *self._decoder_present_outputs]
        split_output_names = (
            [
                item.name
                for item in getattr(self._decoder_with_past, "get_outputs", lambda: ())()
            ]
            or ["logits", *self._decoder_with_past_outputs]
            if self._decoder_with_past is not None
            else []
        )

        for step in range(_MAX_GENERATED_TOKENS):
            if not active_indices:
                break
            if use_merged_kv and self._decoder_use_cache_input is not None:
                feeds: dict[str, object] = {
                    self._decoder_encoder_input: active_hidden,
                    self._decoder_use_cache_input: np.array([step > 0], dtype=np.bool_),
                    **past_kv,
                }
                if step == 0:
                    feeds[self._decoder_token_input] = np.array(
                        [generated[idx] for idx in active_indices], dtype=np.int64
                    )
                else:
                    feeds[self._decoder_token_input] = np.array(
                        [[generated[idx][-1]] for idx in active_indices], dtype=np.int64
                    )
                outputs = self._decoder.run(None, feeds)
                logits = np.asarray(outputs[0], dtype=np.float32)
                past_kv = self._update_past_kv(
                    past_kv, decoder_output_names, outputs
                )
            elif use_split_kv and step > 0 and self._decoder_with_past is not None:
                feeds = {
                    self._decoder_token_input: np.array(
                        [[generated[idx][-1]] for idx in active_indices], dtype=np.int64
                    ),
                    **{
                        name: value
                        for name, value in past_kv.items()
                        if name in self._decoder_with_past_inputs
                    },
                }
                if self._decoder_encoder_input in self._decoder_with_past_inputs:
                    feeds[self._decoder_encoder_input] = active_hidden
                outputs = self._decoder_with_past.run(None, feeds)
                logits = np.asarray(outputs[0], dtype=np.float32)
                past_kv = self._update_past_kv(
                    past_kv,
                    split_output_names,
                    outputs,
                    allowed_inputs=self._decoder_with_past_inputs,
                )
            else:
                tokens_arr = (
                    np.array([[generated[idx][0]] for idx in active_indices], dtype=np.int64)
                    if use_split_kv
                    else np.array([generated[idx] for idx in active_indices], dtype=np.int64)
                )
                outputs = self._decoder.run(
                    None,
                    {
                        self._decoder_token_input: tokens_arr,
                        self._decoder_encoder_input: active_hidden,
                    },
                )
                logits = np.asarray(outputs[0], dtype=np.float32)
                if use_split_kv:
                    past_kv = self._update_past_kv(
                        past_kv,
                        decoder_output_names,
                        outputs,
                        allowed_inputs=self._decoder_with_past_inputs,
                    )

            next_tokens = np.argmax(logits[:, -1, :], axis=-1)
            keep_local: list[int] = []
            for local_idx, seq_idx in enumerate(active_indices):
                token = int(next_tokens[local_idx])
                generated[seq_idx].append(token)
                if token != _END_TOKEN:
                    keep_local.append(local_idx)

            if not keep_local:
                break
            if len(keep_local) < len(active_indices):
                keep_arr = np.asarray(keep_local, dtype=np.int64)
                active_indices = [active_indices[idx] for idx in keep_local]
                active_hidden = active_hidden[keep_arr]
                if past_kv:
                    past_kv = {key: value[keep_arr] for key, value in past_kv.items()}

        return [_postprocess(self._decode(seq)) for seq in generated]

    def predict_batch(self, crops: Sequence[RgbArray]) -> list[str]:
        if not crops:
            return []
        encoded = self._encode_batch(crops)
        if len(crops) == 1 or self._decoder_dynamic_batch:
            return self._decode_encoded_batch(encoded)
        return [
            self._decode_encoded_batch(encoded[idx : idx + 1])[0]
            for idx in range(len(crops))
        ]

    def predict(self, crop):
        return self.predict_batch([crop])[0]

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
                merged_decoder = self._model_dir / DECODER_MERGED_FILE
                decoder = merged_decoder if merged_decoder.is_file() else self._model_dir / DECODER_FILE
                decoder_with_past = (
                    None if merged_decoder.is_file() else self._model_dir / DECODER_WITH_PAST_FILE
                )
                vocab = self._model_dir / VOCAB_FILE
                if not (encoder.is_file() and decoder.is_file() and vocab.is_file()):
                    raise ModelNotInstalledError(f"manga_ocr models not found in {self._model_dir}")
                logger.info("manga_ocr loading", extra={"providers": list(self._providers)})
                self._model = MangaOCRONNX(
                    encoder,
                    decoder,
                    vocab,
                    self._providers,
                    decoder_with_past_path=decoder_with_past,
                )
            return self._model

    def _recognize_batch(
        self,
        rgb: RgbArray,
        regions: Sequence[OCRInputRegion],
        language: str,
    ) -> list[OCRTextResult]:
        model = self._ensure_model()
        height, width = rgb.shape[:2]
        results = [OCRTextResult.empty(region, model_key=self.key) for region in regions]
        valid_indices: list[int] = []
        crops: list[RgbArray] = []
        for idx, region in enumerate(regions):
            bbox = expand_bbox(region.bbox, width, height, self.expansion_percentage)
            if bbox is None:
                continue
            x1, y1, x2, y2 = bbox
            crop = rgb[y1:y2, x1:x2]
            if crop.size == 0:
                continue
            valid_indices.append(idx)
            crops.append(crop)
        if not crops:
            return results
        try:
            texts = model.predict_batch(crops)
        except ONNX_RUNTIME_ERRORS as exc:
            err = translate_inference_error(exc, model_key=self.key)
            if isinstance(err, GpuOutOfMemoryError):
                raise err from exc
            for region_idx, crop in zip(valid_indices, crops, strict=True):
                region = regions[region_idx]
                try:
                    text, score = self._recognize_crop(crop, language)
                except GpuOutOfMemoryError:
                    raise
                except InferenceError as crop_exc:
                    logger.warning(
                        "ocr region failed",
                        extra={"model_key": self.key, "region_id": region.id, "error": str(crop_exc)},
                    )
                    continue
                results[region_idx] = OCRTextResult.from_region(
                    region,
                    text=text,
                    score=score,
                    model_key=self.key,
                )
            return results
        for region_idx, text in zip(valid_indices, texts, strict=True):
            results[region_idx] = OCRTextResult.from_region(
                regions[region_idx],
                text=text,
                score=1.0 if text else 0.0,
                model_key=self.key,
            )
        return results

    def _recognize_crop(self, crop, language):
        del language
        model = self._ensure_model()
        try:
            text = model.predict_batch([crop])[0]
        except ONNX_RUNTIME_ERRORS as exc:
            raise translate_inference_error(exc, model_key=self.key) from exc
        return text, (1.0 if text else 0.0)

    def release(self):
        with self._lock:
            self._model = None
        gc.collect()
        logger.info("manga_ocr sessions released")
