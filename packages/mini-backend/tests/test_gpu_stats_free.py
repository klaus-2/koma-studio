"""Tests for the additive `free_mb` field on /memory/stats GPU stats."""

from __future__ import annotations

import sys
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

import pytest

import app as mini_app


def _fake_torch(*, free_bytes: int = 300 * mini_app.MIB, broken_probe: bool = False) -> ModuleType:
    def mem_get_info(_device: int) -> tuple[int, int]:
        if broken_probe:
            raise RuntimeError("driver unavailable")
        return free_bytes, 1000 * mini_app.MIB

    torch = ModuleType("torch")
    torch.__version__ = "test"
    torch.cuda = SimpleNamespace(
        is_available=lambda: True,
        memory_allocated=lambda _device: 100 * mini_app.MIB,
        memory_reserved=lambda _device: 200 * mini_app.MIB,
        get_device_properties=lambda _device: SimpleNamespace(total_memory=1000 * mini_app.MIB),
        mem_get_info=mem_get_info,
    )
    return torch


def _collect(torch_module: ModuleType) -> dict[str, float | None]:
    with (
        patch.object(mini_app.importlib.util, "find_spec", return_value=object()),
        patch.dict(sys.modules, {"torch": torch_module}),
    ):
        stats = mini_app._collect_gpu_stats()
    assert stats is not None
    return dict(stats)


def test_free_mb_is_reported_from_mem_get_info() -> None:
    stats = _collect(_fake_torch(free_bytes=300 * mini_app.MIB))

    assert stats["free_mb"] == 300.0
    assert stats["allocated_mb"] == 100.0
    assert stats["total_mb"] == 1000.0


def test_free_mb_falls_back_to_none_when_probe_fails() -> None:
    stats = _collect(_fake_torch(broken_probe=True))

    assert stats["free_mb"] is None
    assert stats["allocated_mb"] == 100.0


def test_gpu_stats_remain_none_when_cuda_is_unavailable() -> None:
    torch_module = _fake_torch()
    torch_module.cuda.is_available = lambda: False  # type: ignore[method-assign]

    with (
        patch.object(mini_app.importlib.util, "find_spec", return_value=object()),
        patch.dict(sys.modules, {"torch": torch_module}),
    ):
        assert mini_app._collect_gpu_stats() is None


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
