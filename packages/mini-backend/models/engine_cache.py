"""Thread-safe LRU cache for heavyweight inference engines.

Guarantees a single build per key under contention and releases evicted engines
so device memory is returned deterministically instead of waiting for GC.
"""

from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from collections.abc import Callable, Hashable
from typing import Protocol, runtime_checkable

logger = logging.getLogger(__name__)


@runtime_checkable
class Releasable(Protocol):
    def release(self) -> None: ...


def _release(engine: object) -> None:
    if isinstance(engine, Releasable):
        engine.release()


class LruEngineCache[K: Hashable, V]:
    def __init__(self, max_size: int) -> None:
        if max_size < 1:
            raise ValueError("max_size must be >= 1")
        self._max_size = max_size
        self._entries: OrderedDict[K, V] = OrderedDict()
        self._lock = threading.Lock()
        self._build_locks: dict[K, threading.Lock] = {}

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def get_or_build(self, key: K, build: Callable[[], V]) -> V:
        with self._lock:
            hit = self._entries.get(key)
            if hit is not None:
                self._entries.move_to_end(key)
                return hit
            build_lock = self._build_locks.setdefault(key, threading.Lock())

        with build_lock:
            with self._lock:
                hit = self._entries.get(key)
                if hit is not None:
                    self._entries.move_to_end(key)
                    return hit

            engine = build()

            evicted: list[V] = []
            with self._lock:
                self._entries[key] = engine
                while len(self._entries) > self._max_size:
                    _, old = self._entries.popitem(last=False)
                    evicted.append(old)
                self._build_locks.pop(key, None)

        for old in evicted:
            logger.info("engine evicted", extra={"engine": type(old).__name__})
            _release(old)
        return engine

    def clear(self) -> None:
        with self._lock:
            engines = list(self._entries.values())
            self._entries.clear()
        for engine in engines:
            _release(engine)
