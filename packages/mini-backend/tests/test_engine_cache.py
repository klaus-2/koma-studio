"""LruEngineCache concurrency contract tests.

Run BEFORE any factory migration touches the class: these tests pin the
build-once-per-key guarantee, clear/rebuild behaviour and LRU eviction order.
"""

from __future__ import annotations

from pathlib import Path
import sys
import threading
import time
import unittest
from unittest import mock

MINI_BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(MINI_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(MINI_BACKEND_DIR))

from models.engine_cache import LruEngineCache  # noqa: E402


class LruEngineCacheTests(unittest.TestCase):
    def test_concurrent_get_or_build_builds_exactly_once(self) -> None:
        cache: LruEngineCache[str, object] = LruEngineCache(max_size=8)
        build_calls: list[str] = []
        build_lock = threading.Lock()
        start = threading.Barrier(8)
        results: list[object] = []
        errors: list[BaseException] = []

        def build() -> object:
            with build_lock:
                build_calls.append("built")
            return object()

        def worker() -> None:
            try:
                start.wait(timeout=5)
                results.append(cache.get_or_build("engine", build))
            except BaseException as exc:  # noqa: BLE001 — test boundary
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(8)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

        self.assertEqual(errors, [])
        self.assertEqual(len(build_calls), 1)
        self.assertEqual(len(results), 8)
        first = results[0]
        self.assertTrue(all(result is first for result in results))

    def test_clear_empties_and_subsequent_get_or_build_rebuilds(self) -> None:
        cache: LruEngineCache[str, object] = LruEngineCache(max_size=4)
        marker = cache.get_or_build("a", object)
        self.assertEqual(len(cache), 1)

        cache.clear()
        self.assertEqual(len(cache), 0)

        rebuilt = cache.get_or_build("a", object)
        self.assertIsNot(rebuilt, marker)

    def test_eviction_honors_max_size_in_lru_order(self) -> None:
        cache: LruEngineCache[str, int] = LruEngineCache(max_size=2)
        cache.get_or_build("a", lambda: 1)
        cache.get_or_build("b", lambda: 2)
        # Touch "a" so "b" becomes the least recently used entry.
        self.assertEqual(cache.get_or_build("a", lambda: -1), 1)

        cache.get_or_build("c", lambda: 3)
        self.assertEqual(len(cache), 2)
        # Survivors: "a" (recently used) and "c" (newest). "b" was evicted.
        self.assertEqual(cache.get_or_build("a", lambda: -1), 1)
        self.assertEqual(cache.get_or_build("c", lambda: -1), 3)
        # Re-building "b" must actually run the builder again.
        self.assertEqual(cache.get_or_build("b", lambda: 22), 22)

    def test_rejects_non_positive_max_size(self) -> None:
        with self.assertRaises(ValueError):
            LruEngineCache(max_size=0)

    def test_evict_idle_pops_only_stale_entries_and_exempts_mru(self) -> None:
        cache: LruEngineCache[str, object] = LruEngineCache(max_size=8)
        with mock.patch("time.monotonic", return_value=100.0):
            first = cache.get_or_build("first", object)
            second = cache.get_or_build("second", object)
        with mock.patch("time.monotonic", return_value=400.0):
            evicted = cache.evict_idle(idle_seconds=100.0)

        # "second" is the MRU: exempt even though it is just as stale.
        self.assertEqual(evicted, [first])
        self.assertEqual(len(cache), 1)
        self.assertIs(cache.get_or_build("second", object), second)

    def test_evict_idle_exempts_mru_even_when_stale(self) -> None:
        cache: LruEngineCache[str, object] = LruEngineCache(max_size=8)
        with mock.patch("time.monotonic", return_value=100.0):
            first = cache.get_or_build("first", object)
            second = cache.get_or_build("second", object)
        with mock.patch("time.monotonic", return_value=100_000.0):
            self.assertEqual(cache.evict_idle(idle_seconds=0.0), [first])

        self.assertIs(cache.get_or_build("second", object), second)

        single: LruEngineCache[str, object] = LruEngineCache(max_size=8)
        with mock.patch("time.monotonic", return_value=100.0):
            only = single.get_or_build("only", object)
        with mock.patch("time.monotonic", return_value=100_000.0):
            self.assertEqual(single.evict_idle(idle_seconds=0.0), [])
        self.assertIs(single.get_or_build("only", object), only)

    def test_evict_idle_huge_window_evicts_nothing(self) -> None:
        cache: LruEngineCache[str, object] = LruEngineCache(max_size=8)
        for key in ("a", "b", "c"):
            cache.get_or_build(key, object)
        with mock.patch("time.monotonic", return_value=400.0):
            self.assertEqual(cache.evict_idle(idle_seconds=1e12), [])
        self.assertEqual(len(cache), 3)

    def test_evict_idle_keeps_fresh_entries_against_real_clock(self) -> None:
        cache: LruEngineCache[str, object] = LruEngineCache(max_size=8)
        for key in ("a", "b", "c"):
            cache.get_or_build(key, object)
        # Offset from the real clock: a monotonic->time.time() swap or a
        # unit bug would read entries as aeons old and evict everything.
        with mock.patch("time.monotonic", return_value=time.monotonic() + 60.0):
            self.assertEqual(cache.evict_idle(idle_seconds=600.0), [])
        self.assertEqual(len(cache), 3)

    def test_evict_idle_never_touches_pending_builds(self) -> None:
        cache: LruEngineCache[str, object] = LruEngineCache(max_size=8)
        stale = cache.get_or_build("stale", object)
        # The decoy keeps "stale" evictable: as the sole entry it would be
        # the MRU and exempt.
        cache.get_or_build("decoy", object)
        built: list[object] = []
        started = threading.Event()
        release = threading.Event()

        def build() -> object:
            started.set()
            release.wait(timeout=5)
            engine = object()
            built.append(engine)
            return engine

        builder = threading.Thread(target=lambda: cache.get_or_build("pending", build))
        builder.start()
        try:
            self.assertTrue(started.wait(timeout=5))
            # Offset from the real clock: a fixed far-future value would fall
            # behind real monotonic time on long-uptime machines.
            with mock.patch(
                "time.monotonic", return_value=time.monotonic() + 1_000.0
            ):
                self.assertEqual(cache.evict_idle(idle_seconds=0.0), [stale])
        finally:
            release.set()
            builder.join(timeout=10)

        # The pending build completed normally and now sits in the cache.
        self.assertEqual(len(built), 1)
        self.assertIs(cache.get_or_build("pending", object), built[0])

    def test_evict_idle_then_get_or_build_rebuilds_transparently(self) -> None:
        cache: LruEngineCache[str, object] = LruEngineCache(max_size=4)
        builds: list[object] = []

        def build() -> object:
            engine = object()
            builds.append(engine)
            return engine

        first = cache.get_or_build("engine", build)
        # The decoy keeps "engine" evictable: as the sole entry it would be
        # the MRU and exempt.
        cache.get_or_build("decoy", build)
        self.assertEqual(len(builds), 2)
        # Offset from the real clock: a fixed far-future value would fall
        # behind real monotonic time on long-uptime machines.
        with mock.patch("time.monotonic", return_value=time.monotonic() + 1_000.0):
            self.assertEqual(cache.evict_idle(idle_seconds=0.0), [first])

        rebuilt = cache.get_or_build("engine", build)
        self.assertEqual(len(builds), 3)
        self.assertIs(rebuilt, builds[-1])
        self.assertIsNot(rebuilt, first)


if __name__ == "__main__":
    unittest.main()
