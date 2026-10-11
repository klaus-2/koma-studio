"""Thread-safe, generation-aware LRU with one concurrent build per key.

Returned values are shared references. Eviction removes cache ownership only:
it must not release resources still owned by callers.
"""

from __future__ import annotations

import logging
import threading
from collections import OrderedDict
from collections.abc import Callable, Hashable
from concurrent.futures import Future
from dataclasses import dataclass

logger = logging.getLogger(__name__)


class RecursiveEngineBuildError(RuntimeError):
    """An engine builder recursively requested its own pending cache key."""


@dataclass(frozen=True, slots=True)
class _Build[V]:
    future: Future[V]
    owner_thread: int
    generation: int


class LruEngineCache[K: Hashable, V]:
    __slots__ = (
        "_builds",
        "_entries",
        "_generation",
        "_lock",
        "_max_size",
    )

    def __init__(self, max_size: int) -> None:
        if max_size < 1:
            raise ValueError("max_size must be positive")

        self._max_size = max_size
        self._entries: OrderedDict[K, V] = OrderedDict()
        self._builds: dict[K, _Build[V]] = {}
        self._generation = 0
        self._lock = threading.Lock()

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def get_or_build(self, key: K, build: Callable[[], V]) -> V:
        owner_thread = threading.get_ident()

        with self._lock:
            if key in self._entries:
                self._entries.move_to_end(key)
                return self._entries[key]

            pending = self._builds.get(key)
            if pending is None:
                pending = _Build(
                    future=Future[V](),
                    owner_thread=owner_thread,
                    generation=self._generation,
                )
                self._builds[key] = pending
                is_builder = True
            else:
                is_builder = False
                if pending.owner_thread == owner_thread:
                    raise RecursiveEngineBuildError(
                        "An engine builder requested its own pending key"
                    )

        if not is_builder:
            return pending.future.result()

        try:
            engine = build()
        except BaseException as exc:
            # This is the builder boundary: every waiter must be completed.
            with self._lock:
                if self._builds.get(key) is pending:
                    del self._builds[key]
            pending.future.set_exception(exc)
            raise

        evicted: list[V] = []
        with self._lock:
            if (
                pending.generation == self._generation
                and self._builds.get(key) is pending
            ):
                self._entries[key] = engine
                self._entries.move_to_end(key)

                while len(self._entries) > self._max_size:
                    _, previous = self._entries.popitem(last=False)
                    evicted.append(previous)

            if self._builds.get(key) is pending:
                del self._builds[key]

        pending.future.set_result(engine)

        if evicted:
            logger.info(
                "engine_cache.evicted",
                extra={"entries": len(evicted)},
            )

        # Drop cache references outside the mutex; destructors may be expensive.
        evicted.clear()
        return engine

    def clear(self) -> None:
        with self._lock:
            self._generation += 1
            previous_entries = self._entries
            self._entries = OrderedDict()
            self._builds.clear()

        previous_entries.clear()
        logger.info("engine_cache.cleared")
