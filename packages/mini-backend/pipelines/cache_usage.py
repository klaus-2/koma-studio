from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CacheTableUsage:
    row_count: int
    logical_bytes: int


@dataclass(frozen=True)
class CacheStoreUsage:
    file_size_bytes: int
    page_count: int
    freelist_count: int
    tables: dict[str, CacheTableUsage]
