"""Engine idle sweeper: registry idempotency, one-cycle eviction/release
behaviour, loop resilience and the ``MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS``
config clamp (0 = disabled, fallback 600, max 86400). No real sleeping: the
sweeper cycle runs via ``_sweep_once`` and the clock is mocked.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
import sys
from unittest import mock

import pytest

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from core import engine_idle  # noqa: E402
from core.config import get_config  # noqa: E402
from models.engine_cache import LruEngineCache  # noqa: E402


def _register_test_cache(name: str) -> LruEngineCache[str, object]:
    cache: LruEngineCache[str, object] = LruEngineCache(max_size=8)
    engine_idle.register_idle_cache(name, cache)
    return cache


def _reset_sweep_state(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(engine_idle, "_last_sweep_error", None)
    monkeypatch.setattr(engine_idle, "_consecutive_sweep_failures", 0)
    monkeypatch.setattr(engine_idle, "_last_sweep_at", None)


def test_register_idle_cache_is_idempotent_by_name() -> None:
    first = _register_test_cache("register-idempotent")
    second: LruEngineCache[str, object] = LruEngineCache(max_size=8)
    engine_idle.register_idle_cache("register-idempotent", second)

    with mock.patch("time.monotonic", return_value=100.0):
        first.get_or_build("engine", object)
        # The decoy keeps "engine" evictable: as the sole entry it would be
        # the MRU and exempt.
        first.get_or_build("decoy", object)
    # The first registration wins: the sweeper still evicts from it.
    counts = engine_idle.evict_idle_engines(idle_seconds=0.0)
    assert counts.get("register-idempotent") == 1
    assert len(second) == 0


def test_engine_idle_timeout_env_clamped(monkeypatch: pytest.MonkeyPatch) -> None:
    get_config.cache_clear()
    try:
        monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "0")
        get_config.cache_clear()
        assert get_config().engine_idle_timeout_seconds == 0

        monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "-5")
        get_config.cache_clear()
        assert get_config().engine_idle_timeout_seconds == 0

        monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "999999")
        get_config.cache_clear()
        assert get_config().engine_idle_timeout_seconds == 86400

        monkeypatch.delenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS")
        get_config.cache_clear()
        assert get_config().engine_idle_timeout_seconds == 600
    finally:
        get_config.cache_clear()


async def test_sweep_once_evicts_stale_and_calls_release(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "600")
    get_config.cache_clear()
    try:
        cache = _register_test_cache("sweep-evict")
        with mock.patch("time.monotonic", return_value=100.0):
            cache.get_or_build("first", object)
            second = cache.get_or_build("second", object)

        released: list[int] = []
        with (
            mock.patch("time.monotonic", return_value=100_000.0),
            mock.patch.object(
                engine_idle,
                "release_gpu_memory",
                side_effect=lambda: released.append(1),
            ),
        ):
            await engine_idle._sweep_once()

        # Only the MRU-exempt stale entry was evicted, then VRAM released.
        assert engine_idle.get_last_sweep_evicted().get("sweep-evict") == 1
        assert released == [1]
        assert len(cache) == 1
        assert cache.get_or_build("second", object) is second
    finally:
        get_config.cache_clear()


async def test_sweep_once_with_zero_timeout_disables_eviction(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "0")
    get_config.cache_clear()
    try:
        cache = _register_test_cache("sweep-disabled")
        with mock.patch("time.monotonic", return_value=100.0):
            cache.get_or_build("engine", object)

        evict_calls: list[float] = []
        with (
            mock.patch("time.monotonic", return_value=100_000.0),
            mock.patch.object(
                engine_idle,
                "evict_idle_engines",
                side_effect=evict_calls.append,
            ),
        ):
            await engine_idle._sweep_once()

        assert evict_calls == []
        assert engine_idle.get_last_sweep_evicted() == {}
        assert len(cache) == 1
    finally:
        get_config.cache_clear()


async def test_sweeper_loop_survives_failing_cycles(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "600")
    get_config.cache_clear()
    try:
        cycles: list[int] = []

        def failing_evict(idle_seconds: float) -> dict[str, int]:
            cycles.append(1)
            raise RuntimeError("boom")

        with mock.patch.object(
            engine_idle, "evict_idle_engines", side_effect=failing_evict
        ):
            task = asyncio.create_task(
                engine_idle.idle_sweeper_loop(poll_interval_seconds=0.01)
            )
            await asyncio.sleep(0.05)
            assert not task.done()
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task

        assert len(cycles) >= 2
    finally:
        get_config.cache_clear()


async def test_sweep_once_failure_records_error_and_counter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "600")
    get_config.cache_clear()
    _reset_sweep_state(monkeypatch)
    try:
        with mock.patch.object(
            engine_idle, "evict_idle_engines", side_effect=RuntimeError("boom")
        ):
            await engine_idle._sweep_once()

        status = engine_idle.get_last_sweep_status()
        assert status.ok is False
        assert status.error == "RuntimeError: boom"
        assert status.consecutive_failures == 1
        assert status.recorded_at is not None
    finally:
        get_config.cache_clear()


async def test_sweep_success_clears_error_and_counter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "600")
    get_config.cache_clear()
    _reset_sweep_state(monkeypatch)
    try:
        with mock.patch.object(
            engine_idle, "evict_idle_engines", side_effect=RuntimeError("boom")
        ):
            await engine_idle._sweep_once()
        await engine_idle._sweep_once()

        status = engine_idle.get_last_sweep_status()
        assert status.ok is True
        assert status.error is None
        assert status.consecutive_failures == 0
        assert status.recorded_at is not None
    finally:
        get_config.cache_clear()


def test_sweep_failure_level_escalates_at_three() -> None:
    assert engine_idle._sweep_failure_level(1) == logging.WARNING
    assert engine_idle._sweep_failure_level(2) == logging.WARNING
    assert engine_idle._sweep_failure_level(3) == logging.ERROR
    assert engine_idle._sweep_failure_level(5) == logging.ERROR


async def test_sweep_failure_log_escalates_and_limits_exc_info(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("MINI_BACKEND_ENGINE_IDLE_TIMEOUT_SECONDS", "600")
    get_config.cache_clear()
    _reset_sweep_state(monkeypatch)
    try:
        with (
            mock.patch.object(
                engine_idle, "evict_idle_engines", side_effect=RuntimeError("boom")
            ),
            mock.patch.object(engine_idle, "logger") as fake_logger,
        ):
            for _ in range(3):
                await engine_idle._sweep_once()

        calls = fake_logger.log.call_args_list
        levels = [call.args[0] for call in calls]
        exc_infos = [call.kwargs.get("exc_info") for call in calls]
        assert levels == [logging.WARNING, logging.WARNING, logging.ERROR]
        assert exc_infos == [True, False, False]
    finally:
        get_config.cache_clear()
