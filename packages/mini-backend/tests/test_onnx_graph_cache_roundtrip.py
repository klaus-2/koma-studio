from __future__ import annotations

import logging
import os
import struct
import sys
from pathlib import Path

import numpy as np
import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models import onnx_graph_cache, onnx_utils  # noqa: E402

_CPU = "CPUExecutionProvider"
_CUDA = "CUDAExecutionProvider"
_FLOAT = 1


def _varint(value: int) -> bytes:
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


def _field(number: int, payload: bytes) -> bytes:
    return _varint((number << 3) | 2) + _varint(len(payload)) + payload


def _int_field(number: int, value: int) -> bytes:
    return _varint(number << 3) + _varint(value)


def _text(number: int, value: str) -> bytes:
    return _field(number, value.encode("utf-8"))


def _tensor(name: str, values: list[float]) -> bytes:
    raw = struct.pack(f"<{len(values)}f", *values)
    return (
        _int_field(1, len(values))
        + _int_field(2, _FLOAT)
        + _text(8, name)
        + _field(9, raw)
    )


def _value_info(name: str, size: int) -> bytes:
    dim = _field(1, _int_field(1, size))
    tensor_type = _int_field(1, _FLOAT) + _field(2, dim)
    return _text(1, name) + _field(2, _field(1, tensor_type))


def _node(inputs: list[str], output: str, op_type: str) -> bytes:
    body = b"".join(_text(1, name) for name in inputs)
    return body + _text(2, output) + _text(4, op_type)


def _write_constant_fold_model(path: Path) -> None:
    graph = (
        _field(1, _node(["A", "B"], "C", "Add"))
        + _field(1, _node(["X", "C"], "Y", "Add"))
        + _text(2, "fold")
        + _field(5, _tensor("A", [1.0, 2.0, 3.0, 4.0]))
        + _field(5, _tensor("B", [10.0, 20.0, 30.0, 40.0]))
        + _field(11, _value_info("X", 4))
        + _field(12, _value_info("Y", 4))
    )
    opset = _text(1, "") + _int_field(2, 13)
    model = _int_field(1, 8) + _field(7, graph) + _field(8, opset)
    path.write_bytes(model)


@pytest.fixture(autouse=True)
def _cache_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("KOMA_APP_DATA_DIR", str(tmp_path / "appdata"))
    monkeypatch.delenv("MINI_BACKEND_ONNX_GRAPH_CACHE", raising=False)


def _run(session: object) -> np.ndarray:
    feed = {"X": np.array([0.5, 0.25, 0.125, 1.0], dtype=np.float32)}
    return np.asarray(session.run(None, feed)[0])  # type: ignore[attr-defined]


def _cache_entries() -> list[Path]:
    return sorted(onnx_graph_cache.graph_cache_dir().iterdir())


def test_the_first_load_stores_a_final_cache_entry(tmp_path: Path) -> None:
    model_path = tmp_path / "fold.onnx"
    _write_constant_fold_model(model_path)

    onnx_utils.create_session_with_trt_fallback(str(model_path), [_CPU])

    entries = _cache_entries()
    assert len(entries) == 1
    assert entries[0].suffix == ".onnx"
    assert ".tmp-" not in entries[0].name


def test_a_later_load_reads_the_cached_graph_with_identical_output(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    model_path = tmp_path / "fold.onnx"
    _write_constant_fold_model(model_path)
    cold = onnx_utils.create_session_with_trt_fallback(str(model_path), [_CPU])
    cached_file = _cache_entries()[0]

    with caplog.at_level(logging.INFO, logger="models.onnx_utils"):
        caplog.clear()
        warm = onnx_utils.create_session_with_trt_fallback(str(model_path), [_CPU])

    created = [r for r in caplog.records if r.getMessage() == "onnx.session_created"]
    assert [getattr(r, "graph_cache_hit") for r in created] == [True]
    assert _cache_entries() == [cached_file]
    np.testing.assert_array_equal(_run(warm), _run(cold))
    np.testing.assert_array_equal(
        _run(warm), np.array([11.5, 22.25, 33.125, 45.0], dtype=np.float32)
    )


def test_a_changed_model_never_reuses_the_old_cached_graph(tmp_path: Path) -> None:
    model_path = tmp_path / "fold.onnx"
    _write_constant_fold_model(model_path)
    onnx_utils.create_session_with_trt_fallback(str(model_path), [_CPU])

    model_path.write_bytes(model_path.read_bytes().replace(
        struct.pack("<f", 40.0), struct.pack("<f", 50.0)
    ))
    session = onnx_utils.create_session_with_trt_fallback(str(model_path), [_CPU])

    assert _run(session)[3] == pytest.approx(55.0)
    assert len(_cache_entries()) == 2


def test_the_runtime_tag_covers_the_ort_version_and_the_cpu() -> None:
    import onnxruntime as ort

    tag = onnx_graph_cache.graph_cache_runtime_tag()

    assert tag.startswith(f"{ort.__version__}|")
    assert tag.count("|") == 2


class _ProviderSession:
    def __init__(self, active: list[str]) -> None:
        self._active = active

    def get_providers(self) -> list[str]:
        return self._active


def _cuda_spec(algo: str = "HEURISTIC") -> tuple[str, dict[str, str]]:
    return (_CUDA, {"cudnn_conv_algo_search": algo, "device_id": "0"})


def _assigned_cache_name(model_path: Path, providers: list[object]) -> str:
    options = onnx_utils.build_default_session_options()
    onnx_graph_cache.apply_graph_cache(model_path, providers, options)  # type: ignore[arg-type]
    return Path(options.optimized_model_filepath).name


def test_cuda_loads_get_a_cache_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(onnx_graph_cache, "accelerator_identity", lambda: "nvidia|GTX|4.0")
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"weights")

    assert _assigned_cache_name(model_path, [_cuda_spec(), _CPU]).endswith(
        f".onnx.tmp-{os.getpid()}"
    )


def test_cuda_cache_key_tracks_provider_options_and_the_gpu(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"weights")
    gpu = {"identity": "nvidia-cuda-legacy|GTX 1050 Ti|4.0"}
    monkeypatch.setattr(onnx_graph_cache, "accelerator_identity", lambda: gpu["identity"])

    base = _assigned_cache_name(model_path, [_cuda_spec(), _CPU])
    same = _assigned_cache_name(model_path, [_cuda_spec(), _CPU])
    other_options = _assigned_cache_name(model_path, [_cuda_spec("EXHAUSTIVE"), _CPU])
    gpu["identity"] = "nvidia-cuda|RTX 4090|24.0"
    other_gpu = _assigned_cache_name(model_path, [_cuda_spec(), _CPU])
    cpu_only = _assigned_cache_name(model_path, [_CPU])

    assert base == same
    assert len({base, other_options, other_gpu, cpu_only}) == 4


def test_cpu_only_loads_never_probe_the_gpu(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def fail() -> str:
        raise AssertionError("CPU loads must not detect the accelerator")

    monkeypatch.setattr(onnx_graph_cache, "accelerator_identity", fail)
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"weights")

    assert _assigned_cache_name(model_path, [_CPU])


def test_a_cuda_load_that_fell_back_to_cpu_never_stores_its_graph(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(onnx_graph_cache, "accelerator_identity", lambda: "nvidia|GTX|4.0")
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"weights")

    def factory(model: str, sess_options: object = None, providers: object = None) -> object:
        del model, providers
        Path(getattr(sess_options, "optimized_model_filepath")).write_bytes(b"cpu graph")
        return _ProviderSession([_CPU])

    onnx_utils.create_session_with_trt_fallback(
        str(model_path), [_cuda_spec(), _CPU], session_factory=factory
    )

    assert _cache_entries() == []


def test_a_cuda_load_with_cuda_active_stores_its_graph(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(onnx_graph_cache, "accelerator_identity", lambda: "nvidia|GTX|4.0")
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"weights")

    def factory(model: str, sess_options: object = None, providers: object = None) -> object:
        del model, providers
        Path(getattr(sess_options, "optimized_model_filepath")).write_bytes(b"cuda graph")
        return _ProviderSession([_CUDA, _CPU])

    onnx_utils.create_session_with_trt_fallback(
        str(model_path), [_cuda_spec(), _CPU], session_factory=factory
    )

    entries = _cache_entries()
    assert len(entries) == 1
    assert ".tmp-" not in entries[0].name


def test_a_leftover_tmp_is_never_promoted_without_a_verified_load(tmp_path: Path) -> None:
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"weights")
    leftover = onnx_graph_cache.graph_cache_dir() / _assigned_cache_name(model_path, [_CPU])
    leftover.write_bytes(b"graph from a load that never finished")

    assert _assigned_cache_name(model_path, [_CPU]) == leftover.name
    assert [p.name for p in _cache_entries()] == [leftover.name]


def test_session_logs_the_providers_it_actually_got(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"weights")

    def factory(model: str, sess_options: object = None, providers: object = None) -> object:
        del model, sess_options, providers
        return _ProviderSession([_CPU])

    with caplog.at_level(logging.INFO, logger="models.onnx_utils"):
        onnx_utils.create_session_with_trt_fallback(
            str(model_path), [_CUDA, _CPU], session_factory=factory
        )

    created = next(r for r in caplog.records if r.getMessage() == "onnx.session_created")
    assert getattr(created, "requested_providers") == [_CUDA, _CPU]
    assert getattr(created, "active_providers") == [_CPU]
    unavailable = [
        r for r in caplog.records if r.getMessage() == "onnx.session_provider_unavailable"
    ]
    assert len(unavailable) == 1
    assert unavailable[0].levelno == logging.WARNING
    assert getattr(unavailable[0], "unavailable_providers") == [_CUDA]


def test_no_provider_warning_when_the_gpu_provider_is_active(
    tmp_path: Path, caplog: pytest.LogCaptureFixture
) -> None:
    model_path = tmp_path / "model.onnx"
    model_path.write_bytes(b"weights")

    def factory(model: str, sess_options: object = None, providers: object = None) -> object:
        del model, sess_options, providers
        return _ProviderSession([_CUDA, _CPU])

    with caplog.at_level(logging.INFO, logger="models.onnx_utils"):
        onnx_utils.create_session_with_trt_fallback(
            str(model_path), [(_CUDA, {"device_id": "0"}), _CPU], session_factory=factory
        )

    assert not [
        r for r in caplog.records if r.getMessage() == "onnx.session_provider_unavailable"
    ]
