from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.errors import GpuOutOfMemoryError
from models.ocr.base_ocr import OCRInputRegion
from models.ocr.manga_ocr.engine import _END_TOKEN, MangaOCROnnxEngine, MangaOCRONNX
from models.onnx_utils import ONNX_RUNTIME_ERRORS

_ORT_ERROR = ONNX_RUNTIME_ERRORS[0] if ONNX_RUNTIME_ERRORS else RuntimeError


def _tensor_meta(name: str, shape: list[object], ort_type: str = "tensor(float)") -> SimpleNamespace:
    return SimpleNamespace(name=name, shape=shape, type=ort_type)


class _FakeEncoder:
    def __init__(self, *, dynamic_batch: bool = True) -> None:
        self.calls: list[tuple[int, ...]] = []
        self._shape: list[object] = ["batch" if dynamic_batch else 1, 3, 224, 224]

    def get_inputs(self) -> list[SimpleNamespace]:
        return [_tensor_meta("pixel_values", self._shape)]

    def run(self, _output_names, feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        batch = int(feed["pixel_values"].shape[0])
        self.calls.append(tuple(feed["pixel_values"].shape))
        marker = np.arange(1, batch + 1, dtype=np.float32).reshape(batch, 1, 1)
        return [np.broadcast_to(marker, (batch, 4, 8)).copy()]


class _FakeFullPrefixDecoder:
    def __init__(self, sequences: dict[int, list[int]], *, dynamic_batch: bool = True) -> None:
        self.sequences = sequences
        self.batch_history: list[int] = []
        self._shape: list[object] = ["batch" if dynamic_batch else 1, "seq"]

    def get_inputs(self) -> list[SimpleNamespace]:
        return [
            _tensor_meta("input_ids", self._shape, "tensor(int64)"),
            _tensor_meta("encoder_hidden_states", [self._shape[0], 4, 8]),
        ]

    def get_outputs(self) -> list[SimpleNamespace]:
        return [_tensor_meta("logits", [self._shape[0], "seq", 10])]

    def run(self, _output_names, feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        token_ids = feed["input_ids"]
        hidden = feed["encoder_hidden_states"]
        batch, seq_len = token_ids.shape
        self.batch_history.append(batch)
        logits = np.zeros((batch, seq_len, 10), dtype=np.float32)
        for row in range(batch):
            marker = int(round(float(hidden[row, 0, 0])))
            seq = self.sequences[marker]
            step = seq_len - 1
            next_tok = seq[step] if step < len(seq) else _END_TOKEN
            logits[row, -1, next_tok] = 10.0
        return [logits]


class _FakeMergedKvDecoder:
    def __init__(self, sequences: dict[int, list[int]]) -> None:
        self.sequences = sequences
        self.step_token_widths: list[int] = []
        self.use_cache_flags: list[bool] = []
        self.batch_history: list[int] = []

    def get_inputs(self) -> list[SimpleNamespace]:
        return [
            _tensor_meta("input_ids", ["batch", "seq"], "tensor(int64)"),
            _tensor_meta("encoder_hidden_states", ["batch", 4, 8]),
            _tensor_meta("past_key_values.0.decoder.key", ["batch", 2, "past", 4]),
            _tensor_meta("past_key_values.0.encoder.key", ["batch", 2, 4, 4]),
            _tensor_meta("use_cache_branch", [1], "tensor(bool)"),
        ]

    def get_outputs(self) -> list[SimpleNamespace]:
        return [
            _tensor_meta("logits", ["batch", "seq", 10]),
            _tensor_meta("present.0.decoder.key", ["batch", 2, "seq", 4]),
            _tensor_meta("present.0.encoder.key", ["batch", 2, 4, 4]),
        ]

    def run(self, _output_names, feed: dict[str, object]) -> list[np.ndarray]:
        token_ids = np.asarray(feed["input_ids"])
        hidden = np.asarray(feed["encoder_hidden_states"])
        use_cache = bool(np.asarray(feed["use_cache_branch"])[0])
        past_dec = np.asarray(feed["past_key_values.0.decoder.key"])
        past_enc = np.asarray(feed["past_key_values.0.encoder.key"])
        batch, width = token_ids.shape
        self.step_token_widths.append(width)
        self.use_cache_flags.append(use_cache)
        self.batch_history.append(batch)
        if use_cache:
            assert width == 1
            assert past_enc.shape == (batch, 2, 4, 4)
            assert int(past_enc[0, 0, 0, 0]) > 0
            step = int(past_dec.shape[2])
        else:
            step = 0
        logits = np.zeros((batch, width, 10), dtype=np.float32)
        for row in range(batch):
            marker = int(round(float(hidden[row, 0, 0])))
            seq = self.sequences[marker]
            tok = seq[step] if step < len(seq) else _END_TOKEN
            logits[row, -1, tok] = 10.0
        new_dec = np.ones((batch, 2, step + 1, 4), dtype=np.float32)
        new_enc = np.broadcast_to(
            np.arange(1, batch + 1, dtype=np.float32).reshape(batch, 1, 1, 1),
            (batch, 2, 4, 4),
        ).copy()
        return [logits, new_dec, new_enc]


class _FakePrefillDecoder:
    def get_inputs(self) -> list[SimpleNamespace]:
        return [
            _tensor_meta("input_ids", ["batch", "seq"], "tensor(int64)"),
            _tensor_meta("encoder_hidden_states", ["batch", 4, 8]),
        ]

    def get_outputs(self) -> list[SimpleNamespace]:
        return [
            _tensor_meta("logits", ["batch", 1, 10]),
            _tensor_meta("present.0.decoder.key", ["batch", 2, 1, 4]),
            _tensor_meta("present.0.encoder.key", ["batch", 2, 4, 4]),
        ]

    def run(self, _output_names, feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        hidden = feed["encoder_hidden_states"]
        batch = int(hidden.shape[0])
        logits = np.zeros((batch, 1, 10), dtype=np.float32)
        logits[:, 0, 5] = 10.0
        dec = np.ones((batch, 2, 1, 4), dtype=np.float32)
        enc = np.broadcast_to(hidden[:, :2, :4][:, :, None, :], (batch, 2, 2, 4)).copy()
        return [logits, dec, enc]


class _FakePastDecoder:
    def __init__(self) -> None:
        self.calls: list[int] = []

    def get_inputs(self) -> list[SimpleNamespace]:
        return [
            _tensor_meta("input_ids", ["batch", 1], "tensor(int64)"),
            _tensor_meta("past_key_values.0.decoder.key", ["batch", 2, "past", 4]),
            _tensor_meta("past_key_values.0.encoder.key", ["batch", 2, 2, 4]),
        ]

    def get_outputs(self) -> list[SimpleNamespace]:
        return [
            _tensor_meta("logits", ["batch", 1, 10]),
            _tensor_meta("present.0.decoder.key", ["batch", 2, "seq", 4]),
        ]

    def run(self, _output_names, feed: dict[str, np.ndarray]) -> list[np.ndarray]:
        token_ids = feed["input_ids"]
        past_dec = feed["past_key_values.0.decoder.key"]
        batch = int(token_ids.shape[0])
        step = int(past_dec.shape[2])
        self.calls.append(batch)
        logits = np.zeros((batch, 1, 10), dtype=np.float32)
        next_tok = 6 if step == 1 else _END_TOKEN
        logits[:, 0, next_tok] = 10.0
        return [logits, np.ones((batch, 2, step + 1, 4), dtype=np.float32)]


def _write_vocab(directory: Path) -> Path:
    vocab = directory / "vocab.txt"
    vocab.write_text("\n".join(["<pad>", "<unk>", "<s>", "</s>", "<mask>", "あ", "い", "う", "え", "お"]), encoding="utf-8")
    return vocab


class MangaOcrBatchedTests(unittest.TestCase):
    def test_batched_encoder_and_active_sequence_compaction(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            vocab = _write_vocab(root)
            encoder = _FakeEncoder(dynamic_batch=True)
            decoder = _FakeFullPrefixDecoder({1: [5, _END_TOKEN], 2: [6, 7, 8, _END_TOKEN], 3: [9, _END_TOKEN]})
            sessions = iter([encoder, decoder])
            with patch("models.ocr.manga_ocr.engine.create_session_with_trt_fallback", side_effect=lambda *_args, **_kw: next(sessions)):
                model = MangaOCRONNX(root / "encoder.onnx", root / "decoder.onnx", vocab, ("CPUExecutionProvider",))

            crops = [np.zeros((16, 16, 3), dtype=np.uint8) for _ in range(3)]
            texts = model.predict_batch(crops)
            self.assertEqual(texts, ["あ", "いうえ", "お"])
            self.assertEqual(encoder.calls, [(3, 3, 224, 224)])
            self.assertEqual(decoder.batch_history, [3, 3, 1, 1])

    def test_merged_kv_cache_decoder_passes_single_token_after_prefill(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            vocab = _write_vocab(root)
            encoder = _FakeEncoder(dynamic_batch=True)
            decoder = _FakeMergedKvDecoder({1: [5, 6, _END_TOKEN], 2: [7, _END_TOKEN]})
            sessions = iter([encoder, decoder])
            with patch("models.ocr.manga_ocr.engine.create_session_with_trt_fallback", side_effect=lambda *_args, **_kw: next(sessions)):
                model = MangaOCRONNX(root / "encoder.onnx", root / "decoder_model_merged.onnx", vocab, ("CPUExecutionProvider",))

            texts = model.predict_batch([np.zeros((16, 16, 3), dtype=np.uint8) for _ in range(2)])
            self.assertEqual(texts, ["あい", "う"])
            self.assertEqual(decoder.use_cache_flags, [False, True, True])
            self.assertEqual(decoder.step_token_widths, [1, 1, 1])
            self.assertEqual(decoder.batch_history, [2, 2, 1])

    def test_split_kv_cache_decoder_uses_decoder_with_past(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            vocab = _write_vocab(root)
            (root / "decoder_with_past_model.onnx").write_bytes(b"stub")
            encoder = _FakeEncoder(dynamic_batch=True)
            prefill = _FakePrefillDecoder()
            with_past = _FakePastDecoder()
            sessions = iter([encoder, prefill, with_past])
            with patch("models.ocr.manga_ocr.engine.create_session_with_trt_fallback", side_effect=lambda *_args, **_kw: next(sessions)):
                model = MangaOCRONNX(
                    root / "encoder.onnx",
                    root / "decoder.onnx",
                    vocab,
                    ("CPUExecutionProvider",),
                    decoder_with_past_path=root / "decoder_with_past_model.onnx",
                )

            texts = model.predict_batch([np.zeros((16, 16, 3), dtype=np.uint8) for _ in range(2)])
            self.assertEqual(texts, ["あい", "あい"])
            self.assertEqual(with_past.calls, [2, 2])

    def test_static_batch_decoder_falls_back_cleanly(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            vocab = _write_vocab(root)
            encoder = _FakeEncoder(dynamic_batch=False)
            decoder = _FakeFullPrefixDecoder({1: [5, _END_TOKEN]}, dynamic_batch=False)
            sessions = iter([encoder, decoder])
            with patch("models.ocr.manga_ocr.engine.create_session_with_trt_fallback", side_effect=lambda *_args, **_kw: next(sessions)):
                model = MangaOCRONNX(root / "encoder.onnx", root / "decoder.onnx", vocab, ("CPUExecutionProvider",))

            texts = model.predict_batch([np.zeros((16, 16, 3), dtype=np.uint8) for _ in range(2)])
            self.assertEqual(texts, ["あ", "あ"])
            self.assertEqual(len(encoder.calls), 2)
            self.assertEqual(decoder.batch_history, [1, 1, 1, 1])

    def test_engine_recognize_batch_preserves_empty_regions_and_calls_predict_batch_once(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "encoder_model.onnx").write_bytes(b"e")
            (root / "decoder_model.onnx").write_bytes(b"d")
            _write_vocab(root)
            seen_batches: list[int] = []

            class _StubModel:
                def predict_batch(self, crops):
                    seen_batches.append(len(crops))
                    return [f"t{i}" for i in range(len(crops))]

            engine = MangaOCROnnxEngine(providers=("CPUExecutionProvider",), model_dir=root)
            engine._model = _StubModel()
            rgb = np.zeros((100, 100, 3), dtype=np.uint8)
            regions = [
                OCRInputRegion("r1", (0, 0, 20, 20)),
                OCRInputRegion("empty", (10, 10, 10, 10)),
                OCRInputRegion("r2", (30, 30, 60, 60)),
            ]
            out = engine._recognize_batch(rgb, regions, "ja")
            self.assertEqual(seen_batches, [2])
            self.assertEqual([(item.id, item.text, item.score) for item in out], [
                ("r1", "t0", 1.0),
                ("empty", "", 0.0),
                ("r2", "t1", 1.0),
            ])

    def test_engine_recognize_batch_propagates_oom(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_vocab(root)

            class _OomModel:
                def predict_batch(self, _crops):
                    raise _ORT_ERROR("CUDA out of memory while allocating tensor")

            engine = MangaOCROnnxEngine(providers=("CPUExecutionProvider",), model_dir=root)
            engine._model = _OomModel()
            rgb = np.zeros((100, 100, 3), dtype=np.uint8)
            regions = [OCRInputRegion("r1", (0, 0, 20, 20))]
            with self.assertRaises(GpuOutOfMemoryError):
                engine._recognize_batch(rgb, regions, "ja")

    def test_engine_recognize_batch_falls_back_per_crop_on_non_oom_error(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            _write_vocab(root)
            calls: list[int] = []

            class _FlakyBatchModel:
                def predict_batch(self, crops):
                    calls.append(len(crops))
                    if len(crops) > 1:
                        raise _ORT_ERROR("batch kernel mismatch")
                    crop = crops[0]
                    val = int(crop.max())
                    if val == 2:
                        raise _ORT_ERROR("bad single crop")
                    return [f"ok-{val}"]

            engine = MangaOCROnnxEngine(providers=("CPUExecutionProvider",), model_dir=root)
            engine._model = _FlakyBatchModel()
            rgb = np.zeros((100, 100, 3), dtype=np.uint8)
            rgb[0:20, 0:20] = 1
            rgb[30:50, 30:50] = 2
            rgb[60:80, 60:80] = 3
            regions = [
                OCRInputRegion("r1", (0, 0, 20, 20)),
                OCRInputRegion("r2", (30, 30, 50, 50)),
                OCRInputRegion("r3", (60, 60, 80, 80)),
            ]
            out = engine._recognize_batch(rgb, regions, "ja")
            self.assertEqual(calls, [3, 1, 1, 1])
            self.assertEqual([(item.id, item.text, item.score) for item in out], [
                ("r1", "ok-1", 1.0),
                ("r2", "", 0.0),
                ("r3", "ok-3", 1.0),
            ])


if __name__ == "__main__":
    unittest.main()
