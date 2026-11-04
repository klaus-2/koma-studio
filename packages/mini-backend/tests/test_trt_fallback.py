"""T5: TensorRT→CUDA degradation at ONNX session creation.

Plan Step 1 matrix: a TRT failure retries once without TRT and warns; a
failed retry propagates the original error chained; non-TRT lists keep the
single-attempt path; a working TRT list never retries.
"""

from __future__ import annotations

import logging
import sys
from collections.abc import Sequence
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models import onnx_utils  # noqa: E402

_TRT = "TensorrtExecutionProvider"
_CUDA = "CUDAExecutionProvider"
_ONNX_UTILS_LOGGER = "models.onnx_utils"


def _install_scripted_session_factory(
    monkeypatch: pytest.MonkeyPatch,
    behaviors: Sequence[object],
    calls: list[list[str]],
) -> None:
    """Replace ``ort.InferenceSession`` on the module under test.

    Each behavior is either an ``Exception`` (that attempt fails with it) or
    a sentinel object returned as the session. Every attempt appends its
    requested provider list to ``calls``.
    """
    scripted = iter(behaviors)

    def fake_inference_session(
        model_path: str,
        sess_options: object | None = None,
        providers: list[str] | None = None,
    ) -> object:
        del model_path, sess_options
        calls.append(list(providers or []))
        outcome: object = next(scripted)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(onnx_utils.ort, "InferenceSession", fake_inference_session)


def _warning_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [record for record in caplog.records if record.levelno >= logging.WARNING]


def test_trt_failure_retries_once_with_cuda_and_warns(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    calls: list[list[str]] = []
    sentinel: object = object()
    _install_scripted_session_factory(
        monkeypatch,
        [RuntimeError("TensorRT EP could not be loaded"), sentinel],
        calls,
    )

    with caplog.at_level(logging.WARNING, logger=_ONNX_UTILS_LOGGER):
        session = onnx_utils.create_session_with_trt_fallback(
            "model.onnx",
            [_TRT, _CUDA],
        )

    assert session is sentinel
    assert calls == [
        [_TRT, _CUDA],
        [_CUDA],
    ]
    warnings = _warning_records(caplog)
    assert len(warnings) == 1
    record = warnings[0]
    assert record.getMessage() == "onnx.session_provider_degraded"
    dropped: object = getattr(record, "dropped_provider")
    assert dropped == _TRT
    degraded: object = getattr(record, "degraded_providers")
    assert degraded == [_CUDA]


def test_both_attempts_failing_reraises_original_chained(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[list[str]] = []
    first_error = RuntimeError("TensorRT EP failed")
    second_error = RuntimeError("CUDA EP failed too")
    _install_scripted_session_factory(monkeypatch, [first_error, second_error], calls)

    with pytest.raises(RuntimeError) as excinfo:
        onnx_utils.create_session_with_trt_fallback("model.onnx", [_TRT, _CUDA])

    assert excinfo.value is first_error
    assert excinfo.value.__cause__ is second_error
    assert calls == [
        [_TRT, _CUDA],
        [_CUDA],
    ]


def test_cuda_only_list_keeps_single_attempt(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    calls: list[list[str]] = []
    failure = RuntimeError("CUDA EP failed")
    _install_scripted_session_factory(monkeypatch, [failure, failure], calls)

    with (
        caplog.at_level(logging.WARNING, logger=_ONNX_UTILS_LOGGER),
        pytest.raises(RuntimeError) as excinfo,
    ):
        onnx_utils.create_session_with_trt_fallback("model.onnx", [_CUDA])

    assert excinfo.value is failure
    assert calls == [[_CUDA]]
    assert _warning_records(caplog) == []


def test_working_trt_session_never_retries(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    calls: list[list[str]] = []
    sentinel: object = object()
    _install_scripted_session_factory(monkeypatch, [sentinel], calls)

    session = onnx_utils.create_session_with_trt_fallback("model.onnx", [_TRT, _CUDA])

    assert session is sentinel
    assert calls == [[_TRT, _CUDA]]
    assert _warning_records(caplog) == []
