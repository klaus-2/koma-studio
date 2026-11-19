"""ONNX compiled-graph disk cache: keys, CPU gate, failure containment.

Everything runs offline: the fake session factory never touches a real
model — it records the ``optimized_model_filepath`` it was handed, so the
cache path assignment, the write containment and the corrupt-cache retry can
be proven without any ONNX runtime work.
"""

from __future__ import annotations

import logging
import os
import sys
import time
from collections.abc import Sequence
from pathlib import Path

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models import onnx_graph_cache, onnx_utils  # noqa: E402

_CPU = "CPUExecutionProvider"
_CUDA = "CUDAExecutionProvider"
_TRT = "TensorrtExecutionProvider"
_ONNX_GRAPH_CACHE_LOGGER = "models.onnx_graph_cache"
_ONNX_UTILS_LOGGER = "models.onnx_utils"


@pytest.fixture(autouse=True)
def _cache_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Point the cache at a throwaway dir and kill any inherited kill-switch."""
    monkeypatch.setenv("KOMA_APP_DATA_DIR", str(tmp_path / "appdata"))
    monkeypatch.delenv("MINI_BACKEND_ONNX_GRAPH_CACHE", raising=False)


def _model_file(tmp_path: Path, name: str = "model.onnx", body: bytes = b"weights") -> Path:
    model_path = tmp_path / name
    model_path.write_bytes(body)
    return model_path


class _RecordingSession:
    """Stands in for an InferenceSession; remembers the options handed to it."""

    def __init__(self, sess_options: object | None = None) -> None:
        self.sess_options = sess_options


def _recording_factory(
    calls: list[str | None], behavior: Sequence[object] = ()
) -> object:
    scripted = iter(behavior)

    def factory(
        model_path: str,
        sess_options: object | None = None,
        providers: list[str] | None = None,
    ) -> _RecordingSession:
        del model_path, providers
        filepath: str | None = getattr(sess_options, "optimized_model_filepath", None)
        calls.append(filepath if filepath else None)
        outcome: object = next(scripted, None)
        if isinstance(outcome, Exception):
            raise outcome
        return _RecordingSession(sess_options)

    return factory


def test_build_graph_cache_key_is_stable_and_content_sensitive(tmp_path: Path) -> None:
    first = _model_file(tmp_path, "a.onnx", b"weights-1")

    key_one = onnx_graph_cache.build_graph_cache_key(first, [_CPU], "1.22.0", "level")
    key_again = onnx_graph_cache.build_graph_cache_key(first, [_CPU], "1.22.0", "level")
    key_other_content = onnx_graph_cache.build_graph_cache_key(
        _model_file(tmp_path, "b.onnx", b"weights-2"), [_CPU], "1.22.0", "level"
    )
    key_other_provider = onnx_graph_cache.build_graph_cache_key(
        first, [_CPU, _CUDA], "1.22.0", "level"
    )
    key_other_version = onnx_graph_cache.build_graph_cache_key(
        first, [_CPU], "1.23.0", "level"
    )
    key_other_level = onnx_graph_cache.build_graph_cache_key(
        first, [_CPU], "1.22.0", "other-level"
    )

    assert key_one == key_again
    assert len(key_one) == 64
    assert len({key_one, key_other_content, key_other_provider, key_other_version, key_other_level}) == 5


def test_provider_order_does_not_change_the_key(tmp_path: Path) -> None:
    model_path = _model_file(tmp_path)

    key_a = onnx_graph_cache.build_graph_cache_key(
        model_path, [_CPU, _CUDA], "1.22.0", "level"
    )
    key_b = onnx_graph_cache.build_graph_cache_key(
        model_path, [_CUDA, _CPU], "1.22.0", "level"
    )

    assert key_a == key_b


def test_build_default_session_options_enables_full_graph_optimization() -> None:
    import onnxruntime as ort

    options = onnx_utils.build_default_session_options()

    assert options.graph_optimization_level == ort.GraphOptimizationLevel.ORT_ENABLE_ALL


def test_abandoned_tmp_entries_are_age_purged_on_next_apply(tmp_path: Path) -> None:
    """Promotion never crosses a restart: tmps older than 24h are removed.

    A fresh tmp survives (it may belong to a concurrent construct in this
    or another live process); a future mtime reads as a negative age and is
    also skipped.
    """
    model_path = _model_file(tmp_path)
    cache_dir = onnx_graph_cache.graph_cache_dir()
    cache_dir.mkdir(parents=True, exist_ok=True)
    abandoned = cache_dir / "stalekey.onnx.tmp-999"
    abandoned.write_bytes(b"old tmp from a dead process")
    fresh = cache_dir / "freshkey.onnx.tmp-4242"
    fresh.write_bytes(b"tmp from a live construct")
    future = cache_dir / "futurekey.onnx.tmp-123"
    future.write_bytes(b"future mtime tmp")
    other_file = cache_dir / "notatmp.onnx"
    other_file.write_bytes(b"final cache file is not tmp-named")
    now = time.time()
    for path, mtime in (
        (abandoned, now - (24 * 3600 + 3600)),
        (fresh, now - 60.0),
        (future, now + 3600.0),
    ):
        os.utime(path, (mtime, mtime))

    onnx_graph_cache.apply_graph_cache(model_path, [_CPU], onnx_utils.build_default_session_options())

    assert not abandoned.exists()
    assert fresh.is_file()
    assert future.is_file()
    assert other_file.is_file()


def test_apply_graph_cache_assigns_tmp_path_for_cpu_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(os, "getpid", lambda: 4242)
    model_path = _model_file(tmp_path)
    options = onnx_utils.build_default_session_options()

    onnx_graph_cache.apply_graph_cache(model_path, [_CPU], options)

    cache_dir = onnx_graph_cache.graph_cache_dir()
    assigned = Path(options.optimized_model_filepath)
    assert assigned.parent == cache_dir
    assert assigned.name.endswith(".onnx.tmp-4242")


def test_apply_graph_cache_gate_blocks_non_cpu_providers(tmp_path: Path) -> None:
    model_path = _model_file(tmp_path)

    for providers in ([_CPU, _CUDA], [_TRT, _CPU], [_CUDA], []):
        options = onnx_utils.build_default_session_options()
        onnx_graph_cache.apply_graph_cache(model_path, providers, options)
        assert options.optimized_model_filepath == ""


def test_apply_graph_cache_kill_switch_disables_everything(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("MINI_BACKEND_ONNX_GRAPH_CACHE", "0")
    model_path = _model_file(tmp_path)
    options = onnx_utils.build_default_session_options()

    onnx_graph_cache.apply_graph_cache(model_path, [_CPU], options)

    assert options.optimized_model_filepath == ""
    assert not onnx_graph_cache.graph_cache_dir().exists()


def test_write_failure_is_logged_and_the_load_continues(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    model_path = _model_file(tmp_path)
    cache_dir = onnx_graph_cache.graph_cache_dir()
    monkeypatch.setattr(
        onnx_graph_cache.Path,
        "mkdir",
        lambda self, *args, **kwargs: (_ for _ in ()).throw(OSError("disk full")),
    )

    options = onnx_utils.build_default_session_options()
    with caplog.at_level(logging.WARNING, logger=_ONNX_GRAPH_CACHE_LOGGER):
        onnx_graph_cache.apply_graph_cache(model_path, [_CPU], options)

    assert options.optimized_model_filepath == ""
    assert any(
        record.getMessage() == "onnx.graph_cache.write_failed"
        for record in caplog.records
    )


def _write_garbage_final_cache(model_path: Path, options: object) -> Path:
    """Materialize a corrupt cache at the path the key derivation yields.

    Mirrors the production corrupt-cache case: a previous process completed
    a write (or wrote garbage), so ``apply_graph_cache`` assigns the FINAL
    cache file directly instead of a tmp path.
    """
    import onnxruntime as ort

    key = onnx_graph_cache.build_graph_cache_key(
        model_path,
        ["CPUExecutionProvider"],
        ort.__version__,
        str(getattr(options, "graph_optimization_level")),
    )
    cache_file = onnx_graph_cache.graph_cache_dir() / f"{key}.onnx"
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_bytes(b"corrupt graph")
    return cache_file


def test_corrupt_cache_is_purged_and_the_session_load_retries_without_it(
    tmp_path: Path,
) -> None:
    model_path = _model_file(tmp_path)
    options = onnx_utils.build_default_session_options()
    corrupt_cache = _write_garbage_final_cache(model_path, options)
    calls: list[str | None] = []

    def factory_with_corrupt_cache(
        model_path_arg: str,
        sess_options: object | None = None,
        providers: list[str] | None = None,
    ) -> _RecordingSession:
        del model_path_arg, providers
        filepath = getattr(sess_options, "optimized_model_filepath", "")
        calls.append(str(filepath) if filepath else None)
        if filepath:
            raise RuntimeError("cached graph is corrupt")
        return _RecordingSession(sess_options)

    session = onnx_utils.create_session_with_trt_fallback(
        str(model_path),
        [_CPU],
        session_factory=factory_with_corrupt_cache,  # type: ignore[arg-type]
    )

    assert isinstance(session, _RecordingSession)
    assert calls[0] == str(corrupt_cache)
    assert calls[1] is None
    assert not corrupt_cache.exists()


def test_session_factory_sees_assigned_cache_path(tmp_path: Path) -> None:
    model_path = _model_file(tmp_path)
    calls: list[str | None] = []
    factory = _recording_factory(calls)

    session = onnx_utils.create_session_with_trt_fallback(
        str(model_path),
        [_CPU],
        session_factory=factory,  # type: ignore[arg-type]
    )

    assert isinstance(session, _RecordingSession)
    assert len(calls) == 1
    assert calls[0] is not None
    assert ".onnx" in Path(calls[0]).name


def test_retry_without_cache_failing_propagates_the_original_error(
    tmp_path: Path,
) -> None:
    model_path = _model_file(tmp_path)
    options = onnx_utils.build_default_session_options()
    corrupt_cache = _write_garbage_final_cache(model_path, options)
    calls: list[str | None] = []
    original_error = RuntimeError("load failed with cache")
    factory = _recording_factory(calls, [original_error, RuntimeError("also broken")])

    with pytest.raises(RuntimeError) as excinfo:
        onnx_utils.create_session_with_trt_fallback(
            str(model_path),
            [_CPU],
            session_factory=factory,  # type: ignore[arg-type]
        )

    assert excinfo.value is original_error
    assert calls[0] == str(corrupt_cache)
    assert len(calls) == 2
    assert calls[1] is None
    assert not corrupt_cache.exists()


def test_explicit_session_options_skip_the_graph_cache(tmp_path: Path) -> None:
    model_path = _model_file(tmp_path)
    explicit_options = onnx_utils.build_default_session_options()
    explicit_options.optimized_model_filepath = ""
    calls: list[str | None] = []

    def factory(
        model_path_arg: str,
        sess_options: object | None = None,
        providers: list[str] | None = None,
    ) -> _RecordingSession:
        del model_path_arg, providers
        filepath = getattr(sess_options, "optimized_model_filepath", "")
        calls.append(str(filepath) if filepath else None)
        return _RecordingSession(sess_options)

    onnx_utils.create_session_with_trt_fallback(
        str(model_path),
        [_CPU],
        sess_options=explicit_options,
        session_factory=factory,  # type: ignore[arg-type]
    )

    assert calls == [None]
