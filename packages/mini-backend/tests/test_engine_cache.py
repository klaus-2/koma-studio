"""LruEngineCache concurrency contract tests.

Run BEFORE any factory migration touches the class: these tests pin the
build-once-per-key guarantee, clear/rebuild behaviour and LRU eviction order.
"""

from __future__ import annotations

from pathlib import Path
import sys
import threading
import unittest

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


if __name__ == "__main__":
    unittest.main()
