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
from collections.abc import Hashable
from typing import Final

from core.config import get_config
from core.device import release_gpu_memory
from models.engine_cache import LruEngineCache

logger = logging.getLogger(__name__)

_DEFAULT_POLL_INTERVAL_SECONDS: Final = 60.0

_idle_caches_lock = threading.Lock()
_idle_caches: dict[str, LruEngineCache[Hashable, object]] = {}
_last_sweep_lock = threading.Lock()
_last_sweep_evicted: dict[str, int] = {}


def register_idle_cache(name: str, cache: LruEngineCache[Hashable, object]) -> None:
    """Register a factory engine cache for idle eviction; idempotent by name."""
    with _idle_caches_lock:
        _idle_caches.setdefault(name, cache)


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


def _record_last_sweep(evicted: dict[str, int]) -> None:
    with _last_sweep_lock:
        _last_sweep_evicted.clear()
        _last_sweep_evicted.update(evicted)


async def _sweep_once() -> None:
    try:
        timeout = get_config().engine_idle_timeout_seconds
        evicted: dict[str, int] = {}
        if timeout > 0:
            evicted = await asyncio.to_thread(evict_idle_engines, float(timeout))
            if evicted:
                await asyncio.to_thread(release_gpu_memory)
        _record_last_sweep(evicted)
    except Exception:  # noqa: BLE001 — one broken cycle must not kill the loop
        logger.warning("engine_idle.sweep_failed", exc_info=True)


async def idle_sweeper_loop(
    poll_interval_seconds: float = _DEFAULT_POLL_INTERVAL_SECONDS,
) -> None:
    while True:
        await _sweep_once()
        await asyncio.sleep(poll_interval_seconds)
