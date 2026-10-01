"""LRU cache for loaded models: bounded, thread-safe, releases evicted entries."""

from __future__ import annotations

import threading
from collections import OrderedDict
from collections.abc import Callable, Hashable
from itertools import islice

from pydantic import BaseModel


class CacheStats(BaseModel):
    name: str
    entries: int
    max_entries: int
    keys: list[str]


class BoundedModelCache[K: Hashable, V]:
    __slots__ = ("_entries", "_lock", "_max_entries", "_name", "_on_evict")

    def __init__(
        self, *, name: str, max_entries: int, on_evict: Callable[[V], None] | None = None
    ) -> None:
        if max_entries < 1:
            raise ValueError("max_entries must be >= 1")
        self._name = name
        self._max_entries = max_entries
        self._on_evict = on_evict
        self._entries: OrderedDict[K, V] = OrderedDict()
        self._lock = threading.Lock()

    def get_or_create(self, key: K, factory: Callable[[], V]) -> V:
        with self._lock:
            if (hit := self._entries.get(key)) is not None:
                self._entries.move_to_end(key)
                return hit
        # Model loading is slow; never hold the lock across it. A rare double
        # load under contention is discarded below instead of blocking readers.
        created = factory()
        evicted: list[V] = []
        with self._lock:
            if (raced := self._entries.get(key)) is not None:
                evicted.append(created)
                return raced
            self._entries[key] = created
            while len(self._entries) > self._max_entries:
                _, victim = self._entries.popitem(last=False)
                evicted.append(victim)
        for item in evicted:
            self._release(item)
        return created

    def clear(self) -> None:
        with self._lock:
            victims = list(self._entries.values())
            self._entries.clear()
        for item in victims:
            self._release(item)

    def stats(self) -> CacheStats:
        with self._lock:
            return CacheStats(
                name=self._name,
                entries=len(self._entries),
                max_entries=self._max_entries,
                keys=[str(key) for key in islice(self._entries, 10)],
            )

    def _release(self, item: V) -> None:
        if self._on_evict is not None:
            self._on_evict(item)
