"""Idle engine sweeper: drops ``LruEngineCache`` entries unused for the
configured timeout. Eviction is reference-drop only; VRAM reclamation goes
through the lease-respecting ``release_gpu_memory`` after any eviction.
The timeout is re-read from ``get_config()`` every cycle (0 = disabled);
a failing cycle is logged and the loop continues.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
from collections.abc import Hashable
from dataclasses import dataclass
from typing import Final

from core.config import get_config
from core.device import release_gpu_memory
from models.engine_cache import LruEngineCache

logger = logging.getLogger(__name__)

_DEFAULT_POLL_INTERVAL_SECONDS: Final = 60.0
_ERROR_ESCALATION_THRESHOLD: Final = 3

_idle_caches_lock = threading.Lock()
_idle_caches: dict[str, LruEngineCache[Hashable, object]] = {}
_last_sweep_lock = threading.Lock()
_last_sweep_evicted: dict[str, int] = {}
_last_sweep_error: str | None = None
_consecutive_sweep_failures: int = 0
_last_sweep_at: float | None = None
_has_swept: bool = False


@dataclass(frozen=True, slots=True)
class SweepStatus:
    """Outcome of the most recently completed sweeper cycle; ``ok`` is False
    until the first cycle has finished (success or failure)."""

    ok: bool
    error: str | None
    consecutive_failures: int
    recorded_at: float | None


def register_idle_cache(name: str, cache: LruEngineCache[Hashable, object]) -> None:
    """Register a factory engine cache for idle eviction; idempotent by name."""
    with _idle_caches_lock:
        _idle_caches.setdefault(name, cache)


def registered_idle_cache_names() -> frozenset[str]:
    """Names of every cache currently registered for idle eviction."""
    with _idle_caches_lock:
        return frozenset(_idle_caches)


def evict_idle_engines(idle_seconds: float) -> dict[str, int]:
    """Evict idle entries from every registered cache.

    Returns per-cache eviction counts ({} when nothing was evicted);
    evicted engine references are dropped before returning.
    """
    with _idle_caches_lock:
        caches = dict(_idle_caches)
    counts: dict[str, int] = {}
    for name, cache in caches.items():
        values = cache.evict_idle(idle_seconds)
        if values:
            counts[name] = len(values)
        values.clear()
    return counts


def get_last_sweep_evicted() -> dict[str, int]:
    with _last_sweep_lock:
        return dict(_last_sweep_evicted)


def get_last_sweep_status() -> SweepStatus:
    with _last_sweep_lock:
        return SweepStatus(
            ok=_has_swept and _last_sweep_error is None,
            error=_last_sweep_error,
            consecutive_failures=_consecutive_sweep_failures,
            recorded_at=_last_sweep_at,
        )


def _sweep_failure_level(consecutive_failures: int) -> int:
    """WARNING until three consecutive failures, then ERROR."""
    if consecutive_failures >= _ERROR_ESCALATION_THRESHOLD:
        return logging.ERROR
    return logging.WARNING


def _record_last_sweep(evicted: dict[str, int], error: str | None) -> int:
    """Record one finished cycle (success or failure); returns the new
    consecutive-failure count (0 after a success)."""
    global _consecutive_sweep_failures, _has_swept, _last_sweep_at, _last_sweep_error
    with _last_sweep_lock:
        _last_sweep_evicted.clear()
        _last_sweep_evicted.update(evicted)
        if error is None:
            _last_sweep_error = None
            _consecutive_sweep_failures = 0
        else:
            _last_sweep_error = error
            _consecutive_sweep_failures += 1
        _last_sweep_at = time.time()
        _has_swept = True
        return _consecutive_sweep_failures


async def _sweep_once() -> None:
    evicted: dict[str, int] = {}
    try:
        timeout = get_config().engine_idle_timeout_seconds
        if timeout > 0:
            evicted = await asyncio.to_thread(evict_idle_engines, float(timeout))
            if evicted:
                await asyncio.to_thread(release_gpu_memory)
    except Exception as exc:  # noqa: BLE001 — one broken cycle must not kill the loop
        error = f"{type(exc).__name__}: {exc}"
        failures = _record_last_sweep(evicted, error)
        logger.log(
            _sweep_failure_level(failures),
            "engine_idle.sweep_failed",
            exc_info=failures == 1,
            extra={"error": error},
        )
    else:
        _record_last_sweep(evicted, None)


async def idle_sweeper_loop(
    poll_interval_seconds: float = _DEFAULT_POLL_INTERVAL_SECONDS,
) -> None:
    while True:
        await _sweep_once()
        await asyncio.sleep(poll_interval_seconds)
