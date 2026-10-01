from __future__ import annotations

import unittest

from core.bounded_cache import BoundedModelCache


class BoundedModelCacheTests(unittest.TestCase):
    def test_evicts_lru_and_releases_it(self) -> None:
        released: list[str] = []
        cache = BoundedModelCache[str, str](name="t", max_entries=2, on_evict=released.append)
        cache.get_or_create("a", lambda: "A")
        cache.get_or_create("b", lambda: "B")
        cache.get_or_create("a", lambda: "never")  # touches "a"; "b" is now LRU
        cache.get_or_create("c", lambda: "C")
        self.assertEqual(released, ["B"])
        self.assertEqual(cache.stats().keys, ["a", "c"])

    def test_factory_not_called_on_hit(self) -> None:
        cache = BoundedModelCache[str, int](name="t", max_entries=1)
        self.assertEqual(cache.get_or_create("k", lambda: 1), 1)
        self.assertEqual(cache.get_or_create("k", lambda: 2), 1)

    def test_clear_releases_everything(self) -> None:
        released: list[int] = []
        cache = BoundedModelCache[str, int](name="t", max_entries=2, on_evict=released.append)
        cache.get_or_create("a", lambda: 1)
        cache.get_or_create("b", lambda: 2)
        cache.clear()
        self.assertEqual(sorted(released), [1, 2])
        self.assertEqual(cache.stats().entries, 0)

    def test_race_discards_duplicate_build(self) -> None:
        cache = BoundedModelCache[str, str](name="t", max_entries=2)
        cache._entries["k"] = "winner"  # noqa: SLF001 - simulate a concurrent build winning
        self.assertEqual(cache.get_or_create("k", lambda: "loser"), "winner")


if __name__ == "__main__":
    unittest.main()
