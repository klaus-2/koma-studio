"""Pass-2 T2: the page-level OCR work (BGR conversion + full-page snippet
pass) must run once per ``recognize()`` call, not once per region batch.

The paddle engine is exercised end-to-end with fake ORT sessions installed
at the ``create_session_with_trt_fallback`` seam (engine.py:_load_runtime);
the fake rec session decodes wide crops to ``abc`` and narrow crops to
``a``, so the snippet fallback genuinely rewrites region text and the
hoisted path must reproduce the legacy per-batch composition exactly.
Plan Step 1 item 6 (all existing OCR tests pass UNCHANGED) is the full
pytest run, not a test in this file.
"""

from __future__ import annotations

import asyncio
import sys
import unittest
from collections.abc import Sequence
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.device import OnnxProviderSpec  # noqa: E402
from models.errors import GpuOutOfMemoryError  # noqa: E402
from models.ocr.base_ocr import OCRInputRegion, OCRTextResult  # noqa: E402
from models.ocr.paddleocr import PPOCRV5RecEngine  # noqa: E402
from models.ocr.paddleocr import engine as paddle_engine  # noqa: E402

PAGE_SIZE = (200, 150)  # (width, height); det preprocess resizes to 192x160
DET_ONNX = "ch_PP-OCRv5_mobile_det.onnx"
REC_ONNX = "eslav_PP-OCRv5_rec_mobile_infer.onnx"
DICT_TXT = "ppocrv5_eslav_dict.txt"
SNIPPET_CALLS = "snippet_calls"


class _FakeTensorInfo:
    def __init__(self, name: str, shape: list[int]) -> None:
        self.name = name
        self.shape = shape


def _ctc_logits(batch_size: int, num_classes: int, sequence: list[int]) -> np.ndarray:
    """Canned CTC logits: one hot class per time step, blank (0) elsewhere."""
    time_steps = 4
    logits = np.zeros((batch_size, time_steps, num_classes), dtype=np.float32)
    for time_idx, class_idx in enumerate(sequence):
        logits[:, time_idx, class_idx] = 5.0
    return logits


class _FakeDetSession:
    """Full-page probability map with one bright horizontal band."""

    def get_inputs(self) -> list[_FakeTensorInfo]:
        return [_FakeTensorInfo("det_in", [1, 3, 160, 192])]

    def get_outputs(self) -> list[_FakeTensorInfo]:
        return [_FakeTensorInfo("det_out", [1, 1, 160, 192])]

    def run(
        self, output_names: list[str], input_feed: dict[str, np.ndarray]
    ) -> list[np.ndarray]:
        del output_names, input_feed
        prob = np.zeros((1, 1, 160, 192), dtype=np.float32)
        prob[0, 0, 10:16, :] = 1.0
        return [prob]


class _FakeRecSession:
    """Canned CTC logits: wide crops decode to 'abc', narrow crops to 'a'.

    rec_resize_norm pads narrow crops to exactly 320 columns and wide crops
    beyond that, so the padded width discriminates primary region crops
    (aspect ~1 -> 'a') from the wide snippet det-box crop (aspect > 8 ->
    'abc') without inspecting pixels.
    """

    def __init__(self) -> None:
        self.run_batch_sizes: list[int] = []

    def get_inputs(self) -> list[_FakeTensorInfo]:
        return [_FakeTensorInfo("rec_in", [1, 3, 48, 320])]

    def get_outputs(self) -> list[_FakeTensorInfo]:
        return [_FakeTensorInfo("rec_out", [1])]

    def run(
        self, output_names: list[str], input_feed: dict[str, np.ndarray]
    ) -> list[np.ndarray]:
        del output_names
        x = next(iter(input_feed.values()))
        self.run_batch_sizes.append(int(x.shape[0]))
        sequence = [1, 2, 3, 0] if x.shape[3] > 320 else [1, 0]
        return [_ctc_logits(int(x.shape[0]), 5, sequence)]


def _install_fake_sessions(
    monkeypatch: pytest.MonkeyPatch,
) -> tuple[_FakeDetSession, _FakeRecSession]:
    det = _FakeDetSession()
    rec = _FakeRecSession()

    def fake_create_session(
        model_path: str,
        providers: Sequence[OnnxProviderSpec],
        sess_options: object | None = None,
        session_factory: object | None = None,
    ) -> _FakeDetSession | _FakeRecSession:
        del providers, sess_options, session_factory
        if model_path.endswith(DET_ONNX):
            return det
        return rec

    monkeypatch.setattr(
        paddle_engine, "create_session_with_trt_fallback", fake_create_session
    )
    return det, rec


def _build_engine(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> tuple[PPOCRV5RecEngine, _FakeRecSession]:
    # The fake factory hands the SAME rec session object to _load_runtime,
    # so returning it here gives the session the engine will actually drive.
    _det, rec = _install_fake_sessions(monkeypatch)
    model_dir = tmp_path / "paddleocr"
    model_dir.mkdir()
    (model_dir / DET_ONNX).write_bytes(b"det")
    (model_dir / REC_ONNX).write_bytes(b"rec")
    (model_dir / DICT_TXT).write_text("a\nb\nc\n", encoding="utf-8")
    engine = PPOCRV5RecEngine(providers=["CPUExecutionProvider"], model_dir=model_dir)
    return engine, rec


def _build_regions(count: int) -> list[OCRInputRegion]:
    # All inside the bright det band (page y 8..16): every region overlaps
    # the snippet box, so the fallback aggregation rewrites every result.
    return [
        OCRInputRegion(id=str(i), bbox=(5 + i * 11, 6, 15 + i * 11, 18))
        for i in range(count)
    ]


def _spy_snippets(
    engine: PPOCRV5RecEngine, monkeypatch: pytest.MonkeyPatch
) -> list[np.ndarray]:
    calls: list[np.ndarray] = []
    original = engine._detect_and_recognize_snippets

    def spy(image_bgr: np.ndarray) -> list[tuple[int, int, int, int, float, str]]:
        calls.append(image_bgr)
        return original(image_bgr)

    monkeypatch.setattr(engine, "_detect_and_recognize_snippets", spy)
    return calls


def test_recognize_runs_snippet_pass_exactly_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, rec = _build_engine(tmp_path, monkeypatch)
    snippet_calls = _spy_snippets(engine, monkeypatch)
    regions = _build_regions(17)  # batch_size 8 -> 3 batches

    results = asyncio.run(engine.recognize(Image.new("RGB", PAGE_SIZE), regions, "en"))

    assert len(results) == 17
    assert len(snippet_calls) == 1
    # 3 primary rec runs (one per batch) + exactly 1 snippet sweep.
    assert len(rec.run_batch_sizes) == 4


def test_recognize_converts_page_to_bgr_exactly_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, _rec = _build_engine(tmp_path, monkeypatch)
    page_calls: list[Image.Image] = []
    original = PPOCRV5RecEngine._page_to_bgr

    def spy(image: Image.Image) -> np.ndarray:
        page_calls.append(image)
        return original(image)

    monkeypatch.setattr(engine, "_page_to_bgr", spy)
    regions = _build_regions(17)  # batch_size 8 -> 3 batches

    results = asyncio.run(engine.recognize(Image.new("RGB", PAGE_SIZE), regions, "en"))

    assert len(results) == 17
    assert len(page_calls) == 1


def test_recognize_matches_legacy_composition(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, _rec = _build_engine(tmp_path, monkeypatch)
    regions = _build_regions(17)
    image = Image.new("RGB", PAGE_SIZE)

    hoisted = asyncio.run(engine.recognize(image, regions, "en"))

    legacy: list[OCRTextResult] = []
    for start in range(0, len(regions), engine.batch_size):
        legacy.extend(
            engine._recognize(image, regions[start : start + engine.batch_size], "en")
        )

    assert hoisted == legacy
    # The snippet pass really fired and rewrote every region in both paths.
    assert all(result.text == "abc" for result in hoisted)


def test_oom_in_batch_releases_engine_and_reraises(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, rec = _build_engine(tmp_path, monkeypatch)

    def raise_oom(
        output_names: list[str], input_feed: dict[str, np.ndarray]
    ) -> list[np.ndarray]:
        del output_names, input_feed
        raise GpuOutOfMemoryError("rec session ran out of memory")

    monkeypatch.setattr(rec, "run", raise_oom)
    release_calls: list[bool] = []
    original_release = engine.release

    def spy_release() -> None:
        release_calls.append(True)
        original_release()

    monkeypatch.setattr(engine, "release", spy_release)
    regions = _build_regions(17)

    with pytest.raises(GpuOutOfMemoryError):
        asyncio.run(engine.recognize(Image.new("RGB", PAGE_SIZE), regions, "en"))

    assert release_calls == [True]


def test_preset_cancellation_yields_empty_tail_without_model_work(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    engine, rec = _build_engine(tmp_path, monkeypatch)
    snippet_calls = _spy_snippets(engine, monkeypatch)
    event = asyncio.Event()
    event.set()
    regions = _build_regions(17)

    results = asyncio.run(
        engine.recognize(Image.new("RGB", PAGE_SIZE), regions, "en", cancellation_event=event)
    )

    assert [result.text for result in results] == [""] * 17
    assert all(result.score == 0.0 for result in results)
    assert rec.run_batch_sizes == []
    assert snippet_calls == []


def test_recognize_emits_summary_log(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    engine, _rec = _build_engine(tmp_path, monkeypatch)
    regions = _build_regions(17)

    with caplog.at_level("INFO", logger="models.ocr.paddleocr.engine"):
        asyncio.run(engine.recognize(Image.new("RGB", PAGE_SIZE), regions, "en"))

    record = next(
        item
        for item in caplog.records
        if item.getMessage() == "paddleocr_recognize_completed"
    )
    assert record.model_key == "paddleocr"
    assert record.regions == 17
    assert record.batches == 3
    assert record.snippet_passes == 1
    assert isinstance(record.seconds, float)
    assert record.seconds >= 0.0


if __name__ == "__main__":
    unittest.main()
