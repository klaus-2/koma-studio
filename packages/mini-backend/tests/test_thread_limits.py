"""CPU thread-limit plumbing: the shared ORT SessionOptions builder, the
torch startup helper, and the diagnostics exposure."""

from __future__ import annotations

import sys
import types
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core.threads import (  # noqa: E402
    INTER_OP_THREADS_ENV,
    INTRA_OP_THREADS_ENV,
    env_thread_limit,
)
from models import onnx_utils  # noqa: E402
from services import diagnostics as diagnostics_module  # noqa: E402


class _SessionOptionsStub:
    def __init__(self) -> None:
        self.intra_op_num_threads: int | None = None
        self.inter_op_num_threads: int | None = None


@pytest.fixture
def created_options(monkeypatch: pytest.MonkeyPatch) -> list[_SessionOptionsStub]:
    created: list[_SessionOptionsStub] = []

    def _stub() -> _SessionOptionsStub:
        options = _SessionOptionsStub()
        created.append(options)
        return options

    monkeypatch.setattr(onnx_utils.ort, "SessionOptions", _stub)
    return created


def test_env_thread_limit_parse_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(INTRA_OP_THREADS_ENV, raising=False)
    assert env_thread_limit(INTRA_OP_THREADS_ENV) is None
    for raw, expected in (("4", 4), (" 2 ", 2)):
        monkeypatch.setenv(INTRA_OP_THREADS_ENV, raw)
        assert env_thread_limit(INTRA_OP_THREADS_ENV) == expected
    for raw in ("abc", "0", "-3", "1.5", ""):
        monkeypatch.setenv(INTRA_OP_THREADS_ENV, raw)
        assert env_thread_limit(INTRA_OP_THREADS_ENV) is None


def test_builder_applies_env_values(
    created_options: list[_SessionOptionsStub], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(INTRA_OP_THREADS_ENV, "4")
    monkeypatch.setenv(INTER_OP_THREADS_ENV, "2")
    options = onnx_utils.build_default_session_options()
    assert created_options == [options]
    assert options.intra_op_num_threads == 4
    assert options.inter_op_num_threads == 2


def test_builder_leaves_defaults_when_unset(
    created_options: list[_SessionOptionsStub], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv(INTRA_OP_THREADS_ENV, raising=False)
    monkeypatch.delenv(INTER_OP_THREADS_ENV, raising=False)
    options = onnx_utils.build_default_session_options()
    assert options.intra_op_num_threads is None
    assert options.inter_op_num_threads is None


@pytest.mark.parametrize("raw", ["abc", "0", "-2"])
def test_builder_leaves_defaults_on_malformed_values(
    created_options: list[_SessionOptionsStub],
    monkeypatch: pytest.MonkeyPatch,
    raw: str,
) -> None:
    monkeypatch.setenv(INTRA_OP_THREADS_ENV, raw)
    monkeypatch.setenv(INTER_OP_THREADS_ENV, raw)
    options = onnx_utils.build_default_session_options()
    assert options.intra_op_num_threads is None
    assert options.inter_op_num_threads is None


def test_builder_returns_fresh_instance_per_call(
    created_options: list[_SessionOptionsStub], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(INTRA_OP_THREADS_ENV, "4")
    first = onnx_utils.build_default_session_options()
    second = onnx_utils.build_default_session_options()
    assert first is not second
    assert created_options == [first, second]


def test_create_session_uses_built_options_when_none(
    created_options: list[_SessionOptionsStub], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv(INTRA_OP_THREADS_ENV, "3")
    captured: list[object] = []

    def factory(
        model_path: str, *, sess_options: object, providers: list[object]
    ) -> object:
        _ = model_path, providers
        captured.append(sess_options)
        return object()

    onnx_utils.create_session_with_trt_fallback(
        "model.onnx",
        ["CPUExecutionProvider"],
        session_factory=factory,
    )
    assert len(created_options) == 1
    assert captured == [created_options[0]]
    assert created_options[0].intra_op_num_threads == 3


class _FakeCuda:
    @staticmethod
    def is_available() -> bool:
        return False


class _FakeTorch(types.ModuleType):
    def __init__(self, applied: list[int]) -> None:
        super().__init__("torch")
        self._applied = applied
        self.cuda = _FakeCuda()

    def set_num_threads(self, num_threads: int) -> None:
        self._applied.append(num_threads)

    def get_num_threads(self) -> int:
        return self._applied[-1] if self._applied else 0


def _install_fake_torch(
    monkeypatch: pytest.MonkeyPatch,
) -> list[int]:
    applied: list[int] = []
    monkeypatch.setitem(sys.modules, "torch", _FakeTorch(applied))
    return applied


def test_torch_thread_helper_applies_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app

    applied = _install_fake_torch(monkeypatch)
    monkeypatch.setenv(INTRA_OP_THREADS_ENV, "4")
    app._configure_torch_thread_limit()
    assert applied == [4]


def test_torch_thread_helper_noop_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app

    applied = _install_fake_torch(monkeypatch)
    monkeypatch.delenv(INTRA_OP_THREADS_ENV, raising=False)
    app._configure_torch_thread_limit()
    assert applied == []


def test_torch_thread_helper_swallows_import_failure(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    import app

    monkeypatch.setitem(sys.modules, "torch", None)  # `import torch` raises ImportError
    monkeypatch.setenv(INTRA_OP_THREADS_ENV, "4")
    with caplog.at_level("WARNING", logger="mini-backend"):
        app._configure_torch_thread_limit()
    assert any("threads.torch_configure_failed" in message for message in caplog.messages)


def test_diagnostics_report_reflects_env_and_torch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    applied = _install_fake_torch(monkeypatch)
    applied.append(6)
    monkeypatch.setenv(INTRA_OP_THREADS_ENV, "4")
    monkeypatch.setenv(INTER_OP_THREADS_ENV, "2")

    report = diagnostics_module.collect_runtime_report()
    assert report.thread_limits.intra_op == 4
    assert report.thread_limits.inter_op == 2
    assert report.thread_limits.torch_num_threads == 6


def test_diagnostics_report_nones_when_unset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(INTRA_OP_THREADS_ENV, raising=False)
    monkeypatch.delenv(INTER_OP_THREADS_ENV, raising=False)

    report = diagnostics_module.collect_runtime_report()
    assert report.thread_limits.intra_op is None
    assert report.thread_limits.inter_op is None
